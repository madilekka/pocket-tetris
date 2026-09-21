// Pocket Tetris server: online battles, the daily and weekly tops, challenges, player names and progress.
// Battles: pairs two players in a room and relays their messages. Messages go down to players as
// Server-Sent Events and come up as small POSTs. Rooms live in memory, so run a single instance.
// Daily top: everyone plays the same pieces each day. A player sends a recording of their best game's key presses,
// and the server replays it with the game's own rules (engine.js) and counts the score itself.
// Names: a name belongs to the player who took it first. No dependencies.
const http = require('http');
const crypto = require('crypto');
const Engine = require('./engine.js');

const PORT = Number(process.env.PORT) || 8094;
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || 'https://pocket-tetris.onrender.com,http://127.0.0.1:8093').split(',')
);
const MAX_BODY = 2048, MAX_DAILY_BODY = 128 * 1024;
const ROOM_TTL_MS = 30 * 60 * 1000;
// A room is taken over by its creator right after it's made; one that nobody ever joined goes after 30 s.
const EMPTY_ROOM_TTL_MS = 2 * 60 * 1000, NEW_ROOM_TTL_MS = 30 * 1000;
const HEARTBEAT_MS = 20 * 1000;
// "won" claims the rival went silent; it's only relayed if the rival really hasn't posted for this long.
const WON_QUIET_MS = 15 * 1000;
// One clear sends at most 5 rows (4 for a tetris, +1 in a combo), and nobody sends more than 12 in 4 seconds.
const MAX_ATTACK = 5, ATTACK_WINDOW_MS = 4000, ATTACK_PER_WINDOW = 12;
// The free Render instance forgets its memory whenever it sleeps, so daily scores go to Upstash Redis when it's configured.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TOP_SIZE = 10;
const DAY_KEEP_S = 3 * 24 * 3600, NAME_KEEP_S = 90 * 24 * 3600;
const MAX_PLAYERS_PER_DAY = 5000;
// Limits per address in a 10-minute window, plus one for all score submissions together.
const WINDOW_MS = 10 * 60 * 1000;
const ROOMS_PER_WINDOW = 10, SUBMITS_PER_WINDOW = 30, NAMES_PER_WINDOW = 10, ALL_SUBMITS_PER_WINDOW = 600;
const CHALLENGES_PER_WINDOW = 20, ALL_CHALLENGES_PER_WINDOW = 300, PROGRESS_PER_WINDOW = 30;
// Challenges: a link to play the same pieces as a friend, kept two weeks, with at most 100 results each.
// A MARATHON can run long, so its recording may be bigger than a DAILY's, and a replay stops after an hour of play.
const MAX_CHALLENGE_BODY = 320 * 1024, CHALLENGE_KEEP_S = 14 * 24 * 3600, CHALLENGE_RESULTS = 100;
const MAX_CHALLENGE_TICKS = 60 * 60 * Engine.TICKS_PER_SECOND;
const WEEK_KEEP_S = 21 * 24 * 3600, PROGRESS_KEEP_S = 180 * 24 * 3600;

// code -> { players: [{ pid, res, ready, postedAt, attacks }], touched, emptySince, joined }
const rooms = new Map();

function allowOrigin(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}

function reply(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

function push(player, event, data) {
  if (player.res) player.res.write('event: ' + event + '\ndata: ' + JSON.stringify(data || {}) + '\n\n');
}

function readBody(req, res, limit, done) {
  let size = 0, over = false;
  const chunks = [];
  req.on('data', c => {
    if (over) return;
    size += c.length;
    if (size > limit) { over = true; reply(res, 413); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    if (over) return;
    try { done(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { done(null); }
  });
}

// The player's address, for the limits. Render sits behind Cloudflare, which sets CF-Connecting-IP and
// True-Client-IP itself, while X-Forwarded-For keeps whatever the client put in it, so that one is the last resort.
function clientIp(req) {
  const h = req.headers;
  return String(h['cf-connecting-ip'] || h['true-client-ip'] || String(h['x-forwarded-for'] || '').split(',')[0] ||
    req.socket.remoteAddress || '').trim();
}

// Fixed-window counters: limit(key) is false once the key has used up its allowance for the window.
function limiter(max) {
  const hits = new Map();
  const limit = key => {
    const now = Date.now();
    let s = hits.get(key);
    if (!s || now - s.since > WINDOW_MS) { s = { since: now, count: 0 }; hits.set(key, s); }
    return ++s.count <= max;
  };
  limit.sweep = now => { for (const [k, s] of hits) if (now - s.since > WINDOW_MS) hits.delete(k); };
  return limit;
}
const roomLimit = limiter(ROOMS_PER_WINDOW), submitLimit = limiter(SUBMITS_PER_WINDOW);
const nameLimit = limiter(NAMES_PER_WINDOW), allSubmitLimit = limiter(ALL_SUBMITS_PER_WINDOW);
const challengeLimit = limiter(CHALLENGES_PER_WINDOW), allChallengeLimit = limiter(ALL_CHALLENGES_PER_WINDOW);
const progressLimit = limiter(PROGRESS_PER_WINDOW);

/* ---------- battles ---------- */
function newCode() {
  for (let i = 0; i < 100; i++) {
    const code = String(crypto.randomInt(1000, 10000));
    if (!rooms.has(code)) return code;
  }
  return null;
}

const validPid = pid => typeof pid === 'string' && /^[a-z0-9]{8,32}$/i.test(pid);

// What each message may carry; anything else is dropped rather than relayed.
const MESSAGES = {
  ready: () => true,
  lost: () => true,
  won: () => true,
  attack: d => Number.isInteger(d) && d >= 1 && d <= MAX_ATTACK,
  board: d => typeof d === 'string' && /^[012]{200}$/.test(d)
};

function openStream(req, res, room, code, pid) {
  let player = room.players.find(p => p.pid === pid);
  if (!player) {
    if (room.players.length >= 2) return reply(res, 409, { error: 'full' });
    player = { pid, res: null, ready: false };
    room.players.push(player);
  } else if (player.res) {
    player.res.end();
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('retry: 3000\n\n');
  player.res = res;
  room.touched = Date.now();
  room.emptySince = 0;
  room.joined = true;
  push(player, 'joined', { code, players: room.players.length });
  for (const other of room.players) if (other !== player) push(other, 'peer', { players: room.players.length });

  req.on('close', () => {
    if (player.res !== res) return;
    room.players = room.players.filter(p => p !== player);
    for (const other of room.players) { other.ready = false; push(other, 'peer', { players: room.players.length, left: true }); }
    if (!room.players.length) room.emptySince = Date.now();
  });
}

function handleMessage(res, room, msg) {
  if (!msg || !validPid(msg.pid) || !Object.prototype.hasOwnProperty.call(MESSAGES, msg.type)) return reply(res, 400);
  const player = room.players.find(p => p.pid === msg.pid);
  if (!player) return reply(res, 403);
  if (!MESSAGES[msg.type](msg.data)) return reply(res, 400);
  const now = Date.now();
  room.touched = now;
  player.postedAt = now;
  const others = room.players.filter(p => p !== player);
  if (msg.type === 'won' && others.some(p => now - (p.postedAt || 0) < WON_QUIET_MS)) return reply(res, 409);
  if (msg.type === 'attack') {
    player.attacks = (player.attacks || []).filter(a => now - a[0] < ATTACK_WINDOW_MS);
    if (player.attacks.reduce((sum, a) => sum + a[1], 0) + msg.data > ATTACK_PER_WINDOW) return reply(res, 429);
    player.attacks.push([now, msg.data]);
  }

  if (msg.type === 'ready') {
    player.ready = true;
    if (room.players.length === 2 && room.players.every(p => p.ready)) {
      // Both players get the same seed, so both are dealt the same pieces.
      const seed = crypto.randomInt(1, 2 ** 31);
      for (const p of room.players) { p.ready = false; push(p, 'start', { seed }); }
    } else {
      for (const p of others) push(p, 'peer-ready');
    }
  } else {
    for (const p of others) push(p, 'msg', { type: msg.type, data: msg.data });
  }
  reply(res, 204);
}

/* ---------- daily top, week, names ---------- */
// The day is counted in Kazakhstan time (UTC+5), the same way the game seeds its daily pieces.
function dayKey(daysAgo) {
  const t = new Date(Date.now() + 5 * 3600 * 1000 - (daysAgo || 0) * 86400 * 1000);
  return t.getUTCFullYear() * 10000 + (t.getUTCMonth() + 1) * 100 + t.getUTCDate();
}
// A game that started just before midnight ends on the next day, so yesterday's list still takes scores.
const validDay = d => d === dayKey(0) || d === dayKey(1);
// A week is named by its Monday. It adds up each player's best DAILY of every day in it.
function weekOf(day) {
  const t = new Date(Date.UTC(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100));
  t.setUTCDate(t.getUTCDate() - (t.getUTCDay() + 6) % 7);
  return t.getUTCFullYear() * 10000 + (t.getUTCMonth() + 1) * 100 + t.getUTCDate();
}
const validWeek = w => w === weekOf(dayKey(0)) || w === weekOf(dayKey(1));
// Names are shown in the game's pixel font, which has Latin and Russian letters.
function cleanName(name) {
  if (typeof name !== 'string') return null;
  const n = name.trim().replace(/\s+/g, ' ').toUpperCase();
  return /^[A-Z0-9А-ЯЁ][A-Z0-9А-ЯЁ _.-]{0,9}$/.test(n) ? n : null;
}
// A player's id is their secret (it's also the recovery code), so the lists and URLs use a hash of it instead.
const validCode = pid => typeof pid === 'string' && /^[0-9a-f]{16}$/.test(pid);
const validPub = pub => typeof pub === 'string' && /^[0-9a-f]{16}$/.test(pub);
const pubOf = pid => crypto.createHash('sha256').update(pid).digest('hex').slice(0, 16);
// Equal scores rank by who got there first: the fraction shrinks as the day goes on.
// Sorted-set scores are doubles, which keep this fraction exactly for any score a game can reach.
const rankValue = score => score + (86400 - Math.floor((Date.now() + 5 * 3600 * 1000) / 1000) % 86400) / 100000;

/* ---------- challenges ---------- */
// A challenge is a game a player shares: the same mode, options and pieces (seed) for whoever opens the link.
// Every result, the first one included, is a recording the server replays, like the daily top.
const TIMED = { sprint: true, dig: true };
function validOpt(mode, opt) {
  if (mode === 'marathon') return Number.isInteger(opt) && opt >= 0 && opt <= 9;
  if (mode === 'ultra') return opt === 5 || opt === 7 || opt === 10;
  return (mode === 'sprint' || mode === 'dig') && opt === 0;
}
const validSeed = s => Number.isInteger(s) && s >= 0 && s <= 0xffffffff;
// value orders results, higher is better: points, or for the timed modes a finish beats any unfinished run.
function resultOf(mode, g, name) {
  const done = g.over === 'complete', dug = mode === 'dig' ? Engine.DIG_ROWS - g.digLeft : 0;
  const value = TIMED[mode] ? (done ? 1e9 - g.tick : (mode === 'dig' ? dug : g.lines)) : g.score;
  return { name, score: g.score, lines: g.lines, ticks: g.tick, done, dug, value, at: Date.now() };
}
function replayChallenge(meta, rec) {
  if (typeof rec !== 'string' || rec.length > MAX_CHALLENGE_BODY) return null;
  const g = Engine.replay(Engine.modeRules(meta.mode, meta.opt, meta.seed), rec, MAX_CHALLENGE_TICKS);
  return g && g.state === 'over' ? g : null;
}
const ID_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
function newChallengeId() { let s = ''; for (let i = 0; i < 6; i++) s += ID_CHARS[crypto.randomInt(ID_CHARS.length)]; return s; }
function sortResults(list) { return list.sort((a, b) => b.value - a.value || a.at - b.at); }

// Progress a player keeps under their recovery code: colors, solved puzzles, spent hints, records, daily streak.
const RECORD_KEYS = ['marathon', 'sprint', 'ta5', 'ta7', 'ta10', 'dig'];
function cleanProgress(d) {
  if (!d || typeof d !== 'object') return null;
  const ints = a => Array.isArray(a) ? [...new Set(a.filter(i => Number.isInteger(i) && i >= 0 && i < 1000))].slice(0, 1000) : [];
  const skins = Array.isArray(d.skins) ? [...new Set(d.skins.filter(s => typeof s === 'string' && /^[a-z]{1,12}$/.test(s)))].slice(0, 20) : [];
  const rec = {};
  if (d.rec && typeof d.rec === 'object') for (const k of RECORD_KEYS) if (Number.isInteger(d.rec[k]) && d.rec[k] >= 0 && d.rec[k] <= 1e9) rec[k] = d.rec[k];
  const s = d.streak, streak = s && Number.isInteger(s.last) && Number.isInteger(s.n) && s.n >= 0 && s.n <= 100000 ? { last: s.last, n: s.n } : null;
  return { skins, puzzles: ints(d.puzzles), hints: ints(d.hints), rec, streak };
}

function memoryStore() {
  const days = new Map(), weeks = new Map(); // day or week -> Map(pub -> { name, value })
  const weekParts = new Map(); // 'pub:day' -> how much of that day's best the week already holds
  const owners = new Map(), handles = new Map(); // name -> pub, pub -> name
  const challenges = new Map(), progress = new Map();
  const list = (boards, key) => [...(boards.get(key) || new Map()).entries()].sort((a, b) => b[1].value - a[1].value);
  function board(boards, key, me) {
    const all = list(boards, key), at = me ? all.findIndex(e => e[0] === me) : -1;
    return {
      players: all.length,
      top: all.slice(0, TOP_SIZE).map(([p, e]) => ({ name: e.name, score: Math.floor(e.value), me: p === me })),
      me: at === -1 ? null : { rank: at + 1, score: Math.floor(all[at][1].value) }
    };
  }
  return {
    async claim(pub, name) {
      const owner = owners.get(name);
      if (owner && owner !== pub) return false;
      const old = handles.get(pub);
      if (old && old !== name && owners.get(old) === pub) owners.delete(old);
      owners.set(name, pub);
      handles.set(pub, name);
      for (const boards of [days, weeks]) for (const players of boards.values()) { const e = players.get(pub); if (e) e.name = name; }
      return true;
    },
    async nameOf(pub) { return handles.get(pub) || null; },
    async submit(day, pub, name, score) {
      if (!days.has(day)) days.set(day, new Map());
      const players = days.get(day), had = players.get(pub), value = rankValue(score);
      if (!had && players.size >= MAX_PLAYERS_PER_DAY) return null;
      players.set(pub, { name, value: had && had.value >= value ? had.value : value });
      // The week holds the sum of each day's best: it takes whatever part of this day's best it doesn't have yet.
      const week = weekOf(day), best = Math.floor(players.get(pub).value), key = pub + ':' + day;
      const gain = best - (weekParts.get(key) || 0);
      if (gain > 0) {
        if (!weeks.has(week)) weeks.set(week, new Map());
        const w = weeks.get(week), e = w.get(pub);
        w.set(pub, { name, value: (e ? e.value : 0) + gain });
        weekParts.set(key, best);
      }
      for (const d of days.keys()) if (!validDay(d)) days.delete(d);
      for (const w of weeks.keys()) if (!validWeek(w)) weeks.delete(w);
      for (const k of weekParts.keys()) if (!validDay(Number(k.split(':')[1]))) weekParts.delete(k);
      const all = list(days, day);
      return { rank: all.findIndex(e => e[0] === pub) + 1, players: all.length };
    },
    async top(day, me) { return board(days, day, me); },
    async week(week, me) { return board(weeks, week, me); },
    async createChallenge(meta) {
      let id;
      do id = newChallengeId(); while (challenges.has(id));
      challenges.set(id, { meta, results: new Map(), until: Date.now() + CHALLENGE_KEEP_S * 1000 });
      return id;
    },
    async challenge(id) {
      const c = challenges.get(id);
      if (!c || c.until < Date.now()) return null;
      return { meta: c.meta, results: [...c.results.entries()].map(([pub, r]) => Object.assign({ pub }, r)) };
    },
    async addResult(id, pub, r) {
      const c = challenges.get(id);
      if (!c) return false;
      const had = c.results.get(pub);
      if (!had && c.results.size >= CHALLENGE_RESULTS) return false;
      if (!had || r.value > had.value) c.results.set(pub, r);
      else if (had.name !== r.name) had.name = r.name;
      return true;
    },
    async saveProgress(pub, data) { progress.set(pub, data); },
    async loadProgress(pub) { return progress.get(pub) || null; },
    sweep(now) { for (const [id, c] of challenges) if (c.until < now) challenges.delete(id); }
  };
}

// Upstash Redis over its REST API. Per day: a sorted set of best scores and a hash of names; per week the same
// for the sums. Per name the player who owns it and per player their name, kept 90 days after last use.
// Per challenge: its settings and a hash of results. Per player: their progress.
function redisStore() {
  async function run(commands) {
    const res = await fetch(REDIS_URL + '/pipeline', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands)
    });
    if (!res.ok) throw new Error('redis ' + res.status);
    const out = await res.json();
    const failed = out.find(r => r.error);
    if (failed) throw new Error('redis ' + failed.error);
    return out.map(r => r.result);
  }
  const keys = day => ['pt:d2:' + day, 'pt:n2:' + day];
  const weekKeys = week => ['pt:w2:' + week, 'pt:wn2:' + week];
  const ownerKey = name => 'pt:owner:' + name, handleKey = pub => 'pt:handle:' + pub;
  const chKey = id => 'pt:ch:' + id, chResKey = id => 'pt:chr:' + id, progKey = pub => 'pt:prog:' + pub;
  const keep = String(NAME_KEEP_S);
  async function board([z, n], me) {
    const [flat, players, rank, mine] = await run([
      ['ZREVRANGE', z, '0', String(TOP_SIZE - 1), 'WITHSCORES'], ['ZCARD', z],
      ['ZREVRANK', z, me || '-'], ['ZSCORE', z, me || '-']
    ]);
    const pubs = [];
    for (let i = 0; i < flat.length; i += 2) pubs.push(flat[i]);
    const names = pubs.length ? (await run([['HMGET', n, ...pubs]]))[0] : [];
    return {
      players,
      top: pubs.map((p, i) => ({ name: names[i] || '?', score: Math.floor(Number(flat[2 * i + 1])), me: p === me })),
      me: !me || rank === null ? null : { rank: rank + 1, score: Math.floor(Number(mine)) }
    };
  }
  return {
    async claim(pub, name) {
      // SET NX makes taking a free name atomic, so two players can't both get it.
      const [, owner, old] = await run([['SET', ownerKey(name), pub, 'NX', 'EX', keep], ['GET', ownerKey(name)], ['GET', handleKey(pub)]]);
      if (owner !== pub) return false;
      const cmds = [['EXPIRE', ownerKey(name), keep], ['SET', handleKey(pub), name, 'EX', keep]];
      if (old && old !== name) {
        // A new name frees the old one, and the current lists show the new one.
        const [oldOwner] = await run([['GET', ownerKey(old)]]);
        if (oldOwner === pub) cmds.push(['DEL', ownerKey(old)]);
        for (const [z, n] of [keys(dayKey(0)), keys(dayKey(1)), weekKeys(weekOf(dayKey(0)))]) {
          const [was] = await run([['ZSCORE', z, pub]]);
          if (was !== null) cmds.push(['HSET', n, pub, name]);
        }
      }
      await run(cmds);
      return true;
    },
    async nameOf(pub) { return (await run([['GET', handleKey(pub)]]))[0]; },
    async submit(day, pub, name, score) {
      const [z, n] = keys(day), [wz, wn] = weekKeys(weekOf(day));
      const [had, count] = await run([['ZSCORE', z, pub], ['ZCARD', z]]);
      if (had === null && count >= MAX_PLAYERS_PER_DAY) return null;
      const cmds = [
        ['ZADD', z, 'GT', String(rankValue(score)), pub], ['HSET', n, pub, name],
        ['EXPIRE', z, String(DAY_KEEP_S)], ['EXPIRE', n, String(DAY_KEEP_S)],
        ['ZREVRANK', z, pub], ['ZCARD', z]
      ];
      // The week holds the sum of each day's best: it takes whatever part of this day's best it doesn't have yet,
      // which also brings in a best set before the week was being counted.
      const wp = 'pt:wp2:' + weekOf(day), part = pub + ':' + day;
      cmds.push(['ZSCORE', z, pub], ['HGET', wp, part]);
      const r = await run(cmds);
      const best = Math.floor(Number(r[6])), gain = best - Number(r[7] || 0);
      if (gain > 0) await run([['ZINCRBY', wz, String(gain), pub], ['HSET', wn, pub, name], ['HSET', wp, part, String(best)],
        ['EXPIRE', wz, String(WEEK_KEEP_S)], ['EXPIRE', wn, String(WEEK_KEEP_S)], ['EXPIRE', wp, String(WEEK_KEEP_S)]]);
      return { rank: r[4] + 1, players: r[5] };
    },
    async top(day, me) { return board(keys(day), me); },
    async week(week, me) { return board(weekKeys(week), me); },
    async createChallenge(meta) {
      for (let i = 0; i < 10; i++) {
        const id = newChallengeId();
        const [ok] = await run([['SET', chKey(id), JSON.stringify(meta), 'NX', 'EX', String(CHALLENGE_KEEP_S)]]);
        if (ok) return id;
      }
      throw new Error('no free challenge id');
    },
    async challenge(id) {
      const [meta, flat] = await run([['GET', chKey(id)], ['HGETALL', chResKey(id)]]);
      if (!meta) return null;
      const results = [];
      for (let i = 0; i < flat.length; i += 2) results.push(Object.assign({ pub: flat[i] }, JSON.parse(flat[i + 1])));
      return { meta: JSON.parse(meta), results };
    },
    async addResult(id, pub, r) {
      const [had, count] = await run([['HGET', chResKey(id), pub], ['HLEN', chResKey(id)]]);
      if (!had && count >= CHALLENGE_RESULTS) return false;
      const old = had && JSON.parse(had);
      const keepR = old && old.value >= r.value ? Object.assign(old, { name: r.name }) : r;
      await run([['HSET', chResKey(id), pub, JSON.stringify(keepR)], ['EXPIRE', chResKey(id), String(CHALLENGE_KEEP_S)]]);
      return true;
    },
    async saveProgress(pub, data) { await run([['SET', progKey(pub), JSON.stringify(data), 'EX', String(PROGRESS_KEEP_S)]]); },
    async loadProgress(pub) { const [s] = await run([['GET', progKey(pub)]]); return s ? JSON.parse(s) : null; },
    sweep() {}
  };
}

const store = REDIS_URL && REDIS_TOKEN ? redisStore() : memoryStore();
const failed = res => e => { console.error(e.message); reply(res, 503); };

// POST /daily {pid, name, day, v, rec}: the score is whatever the recording scores when replayed here.
function handleSubmit(req, res, msg) {
  if (!msg || !validCode(msg.pid) || typeof msg.rec !== 'string') return reply(res, 400);
  const name = cleanName(msg.name);
  if (!name || !Number.isInteger(msg.day) || !validDay(msg.day)) return reply(res, 400);
  // A recording only replays the same way under the rules it was played with.
  if (msg.v !== Engine.VERSION) return reply(res, 426, { error: 'update the game' });
  if (!submitLimit(clientIp(req)) || !allSubmitLimit('all')) return reply(res, 429);
  const game = Engine.replay(Engine.dailyRules(msg.day), msg.rec);
  if (!game) return reply(res, 400);
  if (game.score < 1) return reply(res, 422, { error: 'no score' });
  const pub = pubOf(msg.pid), score = game.score;
  store.claim(pub, name).then(ok => {
    if (!ok) return reply(res, 409, { error: 'name taken' });
    return store.submit(msg.day, pub, name, score)
      .then(r => r ? reply(res, 200, { rank: r.rank, players: r.players, score }) : reply(res, 429, { error: 'full' }));
  }).catch(failed(res));
}

// POST /name {pid, name}: takes a name if it's free (or already this player's).
function handleName(req, res, msg) {
  if (!msg || !validCode(msg.pid)) return reply(res, 400);
  const name = cleanName(msg.name);
  if (!name) return reply(res, 400);
  if (!nameLimit(clientIp(req))) return reply(res, 429);
  store.claim(pubOf(msg.pid), name)
    .then(ok => ok ? reply(res, 200, { name }) : reply(res, 409, { error: 'name taken' }))
    .catch(failed(res));
}

// The challenge as the game shows it: settings and results best first, the asking player's marked.
function challengeView(id, c, me) {
  const all = sortResults(c.results), at = me ? all.findIndex(r => r.pub === me) : -1;
  const pick = (r, i) => ({ rank: i + 1, name: r.name, score: r.score, lines: r.lines, ticks: r.ticks, done: r.done, dug: r.dug, me: r.pub === me });
  return {
    id, mode: c.meta.mode, opt: c.meta.opt, seed: c.meta.seed, v: c.meta.v, by: c.meta.by, players: all.length,
    top: all.slice(0, TOP_SIZE).map(pick), me: at === -1 ? null : pick(all[at], at)
  };
}

// POST /challenge {pid, name, mode, opt, seed, v, rec}: shares a finished game as a challenge.
function handleChallenge(req, res, msg) {
  if (!msg || !validCode(msg.pid) || !Engine.modeRules(msg.mode, 0, 0) || !validOpt(msg.mode, msg.opt) || !validSeed(msg.seed)) return reply(res, 400);
  const name = cleanName(msg.name);
  if (!name) return reply(res, 400);
  if (msg.v !== Engine.VERSION) return reply(res, 426, { error: 'update the game' });
  if (!challengeLimit(clientIp(req)) || !allChallengeLimit('all')) return reply(res, 429);
  const meta = { mode: msg.mode, opt: msg.opt, seed: msg.seed, v: msg.v, by: name };
  const g = replayChallenge(meta, msg.rec);
  if (!g) return reply(res, 400);
  const pub = pubOf(msg.pid);
  store.claim(pub, name).then(async ok => {
    if (!ok) return reply(res, 409, { error: 'name taken' });
    const id = await store.createChallenge(meta);
    await store.addResult(id, pub, resultOf(meta.mode, g, name));
    reply(res, 200, { id });
  }).catch(failed(res));
}

// POST /challenge/<id>/result {pid, name, v, rec}: a friend's attempt at the challenge.
function handleChallengeResult(req, res, id, msg) {
  if (!msg || !validCode(msg.pid)) return reply(res, 400);
  const name = cleanName(msg.name);
  if (!name) return reply(res, 400);
  if (!challengeLimit(clientIp(req)) || !allChallengeLimit('all')) return reply(res, 429);
  const pub = pubOf(msg.pid);
  store.challenge(id).then(async c => {
    if (!c) return reply(res, 404);
    if (msg.v !== c.meta.v || msg.v !== Engine.VERSION) return reply(res, 426, { error: 'update the game' });
    const g = replayChallenge(c.meta, msg.rec);
    if (!g) return reply(res, 400);
    if (!(await store.claim(pub, name))) return reply(res, 409, { error: 'name taken' });
    if (!(await store.addResult(id, pub, resultOf(c.meta.mode, g, name)))) return reply(res, 429, { error: 'full' });
    reply(res, 200, challengeView(id, await store.challenge(id), pub));
  }).catch(failed(res));
}

// POST /progress {pid, data} saves, POST /progress/load {pid} brings it back on another phone.
// Only players with a name can keep progress, so a stranger can't fill the store with ids.
function handleProgress(req, res, msg, load) {
  if (!msg || !validCode(msg.pid)) return reply(res, 400);
  if (!progressLimit(clientIp(req))) return reply(res, 429);
  const pub = pubOf(msg.pid);
  if (load) return store.loadProgress(pub).then(data => data ? reply(res, 200, { data }) : reply(res, 404)).catch(failed(res));
  const data = cleanProgress(msg.data);
  if (!data) return reply(res, 400);
  store.nameOf(pub).then(async name => {
    if (!name) return reply(res, 403);
    await store.saveProgress(pub, data);
    reply(res, 204);
  }).catch(failed(res));
}

const server = http.createServer((req, res) => {
  allowOrigin(req, res);
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);
  const me = url.searchParams.get('me');
  if (me !== null && !validPub(me)) return reply(res, 400);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' });
    return res.end();
  }
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    return res.end('ok');
  }
  if (req.method === 'POST' && url.pathname === '/daily') return readBody(req, res, MAX_DAILY_BODY, msg => handleSubmit(req, res, msg));
  if (req.method === 'GET' && parts[0] === 'daily' && /^\d{8}$/.test(parts[1] || '') && parts.length === 2) {
    const day = Number(parts[1]);
    if (!validDay(day)) return reply(res, 400);
    return store.top(day, me).then(r => reply(res, 200, r)).catch(failed(res));
  }
  if (req.method === 'GET' && parts[0] === 'week' && /^\d{8}$/.test(parts[1] || '') && parts.length === 2) {
    const week = Number(parts[1]);
    if (!validWeek(week)) return reply(res, 400);
    return store.week(week, me).then(r => reply(res, 200, r)).catch(failed(res));
  }
  if (req.method === 'POST' && url.pathname === '/name') return readBody(req, res, MAX_BODY, msg => handleName(req, res, msg));
  // GET /name/<pub>: the name a recovery code belongs to (the game hashes the code before asking).
  if (req.method === 'GET' && parts[0] === 'name' && parts.length === 2) {
    if (!validPub(parts[1])) return reply(res, 400);
    return store.nameOf(parts[1]).then(name => name ? reply(res, 200, { name }) : reply(res, 404)).catch(failed(res));
  }
  if (req.method === 'POST' && url.pathname === '/challenge') return readBody(req, res, MAX_CHALLENGE_BODY, msg => handleChallenge(req, res, msg));
  if (parts[0] === 'challenge' && /^[a-z2-9]{6}$/.test(parts[1] || '')) {
    const id = parts[1];
    if (req.method === 'GET' && parts.length === 2) {
      return store.challenge(id).then(c => c ? reply(res, 200, challengeView(id, c, me)) : reply(res, 404)).catch(failed(res));
    }
    if (req.method === 'POST' && parts[2] === 'result' && parts.length === 3) return readBody(req, res, MAX_CHALLENGE_BODY, msg => handleChallengeResult(req, res, id, msg));
  }
  if (req.method === 'POST' && url.pathname === '/progress') return readBody(req, res, MAX_BODY * 4, msg => handleProgress(req, res, msg, false));
  if (req.method === 'POST' && url.pathname === '/progress/load') return readBody(req, res, MAX_BODY, msg => handleProgress(req, res, msg, true));
  if (req.method === 'POST' && url.pathname === '/rooms') {
    if (!roomLimit(clientIp(req))) return reply(res, 429, { error: 'too many rooms' });
    const code = newCode();
    if (!code) return reply(res, 503);
    rooms.set(code, { players: [], touched: Date.now(), emptySince: Date.now(), joined: false });
    return reply(res, 200, { code });
  }
  if (parts[0] === 'rooms' && /^\d{4}$/.test(parts[1] || '')) {
    const code = parts[1];
    const room = rooms.get(code);
    if (!room) return reply(res, 404, { error: 'not found' });
    if (req.method === 'GET' && parts.length === 2) return reply(res, 200, { players: room.players.length });
    if (req.method === 'GET' && parts[2] === 'events') {
      const pid = url.searchParams.get('pid');
      if (!validPid(pid)) return reply(res, 400);
      return openStream(req, res, room, code, pid);
    }
    if (req.method === 'POST' && parts[2] === 'msg') return readBody(req, res, MAX_BODY, msg => handleMessage(res, room, msg));
  }
  reply(res, 404, { error: 'not found' });
});

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const idle = now - room.touched > ROOM_TTL_MS;
    const abandoned = room.emptySince && now - room.emptySince > (room.joined ? EMPTY_ROOM_TTL_MS : NEW_ROOM_TTL_MS);
    if (idle || abandoned) {
      for (const p of room.players) if (p.res) p.res.end();
      rooms.delete(code);
      continue;
    }
    for (const p of room.players) if (p.res) p.res.write(': ping\n\n');
  }
  for (const limit of [roomLimit, submitLimit, nameLimit, allSubmitLimit, challengeLimit, allChallengeLimit, progressLimit]) limit.sweep(now);
  store.sweep(now);
}, HEARTBEAT_MS);

server.listen(PORT, () => console.log('server on port ' + PORT + ', daily top in ' + (REDIS_URL && REDIS_TOKEN ? 'Upstash Redis' : 'memory')));
