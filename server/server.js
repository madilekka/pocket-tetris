// Pocket Tetris server: online battles, the daily top and player names.
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

/* ---------- daily top and names ---------- */
// The day is counted in Kazakhstan time (UTC+5), the same way the game seeds its daily pieces.
function dayKey(daysAgo) {
  const t = new Date(Date.now() + 5 * 3600 * 1000 - (daysAgo || 0) * 86400 * 1000);
  return t.getUTCFullYear() * 10000 + (t.getUTCMonth() + 1) * 100 + t.getUTCDate();
}
// A game that started just before midnight ends on the next day, so yesterday's list still takes scores.
const validDay = d => d === dayKey(0) || d === dayKey(1);
// Names are shown in the game's pixel font, which has Latin and Russian letters.
function cleanName(name) {
  if (typeof name !== 'string') return null;
  const n = name.trim().replace(/\s+/g, ' ').toUpperCase();
  return /^[A-Z0-9А-ЯЁ][A-Z0-9А-ЯЁ _.-]{0,9}$/.test(n) ? n : null;
}
// A player's id is their secret (it's also the recovery code), so the list and URLs use a hash of it instead.
const validCode = pid => typeof pid === 'string' && /^[0-9a-f]{16}$/.test(pid);
const validPub = pub => typeof pub === 'string' && /^[0-9a-f]{16}$/.test(pub);
const pubOf = pid => crypto.createHash('sha256').update(pid).digest('hex').slice(0, 16);
// Equal scores rank by who got there first: the fraction shrinks as the day goes on.
// Sorted-set scores are doubles, which keep this fraction exactly for any score a game can reach.
const rankValue = score => score + (86400 - Math.floor((Date.now() + 5 * 3600 * 1000) / 1000) % 86400) / 100000;

function memoryStore() {
  const days = new Map(); // day -> Map(pub -> { name, value })
  const owners = new Map(), handles = new Map(); // name -> pub, pub -> name
  const list = day => [...(days.get(day) || new Map()).entries()].sort((a, b) => b[1].value - a[1].value);
  return {
    async claim(pub, name) {
      const owner = owners.get(name);
      if (owner && owner !== pub) return false;
      const old = handles.get(pub);
      if (old && old !== name && owners.get(old) === pub) owners.delete(old);
      owners.set(name, pub);
      handles.set(pub, name);
      for (const players of days.values()) { const e = players.get(pub); if (e) e.name = name; }
      return true;
    },
    async nameOf(pub) { return handles.get(pub) || null; },
    async submit(day, pub, name, score) {
      if (!days.has(day)) days.set(day, new Map());
      const players = days.get(day), had = players.get(pub), value = rankValue(score);
      if (!had && players.size >= MAX_PLAYERS_PER_DAY) return null;
      players.set(pub, { name, value: had && had.value >= value ? had.value : value });
      for (const d of days.keys()) if (!validDay(d)) days.delete(d);
      const all = list(day);
      return { rank: all.findIndex(e => e[0] === pub) + 1, players: all.length };
    },
    async top(day, me) {
      const all = list(day), at = me ? all.findIndex(e => e[0] === me) : -1;
      return {
        players: all.length,
        top: all.slice(0, TOP_SIZE).map(([p, e]) => ({ name: e.name, score: Math.floor(e.value), me: p === me })),
        me: at === -1 ? null : { rank: at + 1, score: Math.floor(all[at][1].value) }
      };
    }
  };
}

// Upstash Redis over its REST API: per day a sorted set of best scores and a hash of names;
// per name the player who owns it, and per player their name, kept for 90 days after last use.
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
  const ownerKey = name => 'pt:owner:' + name, handleKey = pub => 'pt:handle:' + pub;
  const keep = String(NAME_KEEP_S);
  return {
    async claim(pub, name) {
      // SET NX makes taking a free name atomic, so two players can't both get it.
      const [, owner, old] = await run([['SET', ownerKey(name), pub, 'NX', 'EX', keep], ['GET', ownerKey(name)], ['GET', handleKey(pub)]]);
      if (owner !== pub) return false;
      const cmds = [['EXPIRE', ownerKey(name), keep], ['SET', handleKey(pub), name, 'EX', keep]];
      if (old && old !== name) {
        // A new name frees the old one, and today's and yesterday's lists show the new one.
        const [oldOwner] = await run([['GET', ownerKey(old)]]);
        if (oldOwner === pub) cmds.push(['DEL', ownerKey(old)]);
        for (const d of [dayKey(0), dayKey(1)]) {
          const [z, n] = keys(d);
          const [was] = await run([['ZSCORE', z, pub]]);
          if (was !== null) cmds.push(['HSET', n, pub, name]);
        }
      }
      await run(cmds);
      return true;
    },
    async nameOf(pub) { return (await run([['GET', handleKey(pub)]]))[0]; },
    async submit(day, pub, name, score) {
      const [z, n] = keys(day);
      const [had, count] = await run([['ZSCORE', z, pub], ['ZCARD', z]]);
      if (had === null && count >= MAX_PLAYERS_PER_DAY) return null;
      const r = await run([
        ['ZADD', z, 'GT', String(rankValue(score)), pub], ['HSET', n, pub, name],
        ['EXPIRE', z, String(DAY_KEEP_S)], ['EXPIRE', n, String(DAY_KEEP_S)],
        ['ZREVRANK', z, pub], ['ZCARD', z]
      ]);
      return { rank: r[4] + 1, players: r[5] };
    },
    async top(day, me) {
      const [z, n] = keys(day);
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

const server = http.createServer((req, res) => {
  allowOrigin(req, res);
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);

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
    const day = Number(parts[1]), me = url.searchParams.get('me');
    if (!validDay(day) || (me !== null && !validPub(me))) return reply(res, 400);
    return store.top(day, me).then(r => reply(res, 200, r)).catch(failed(res));
  }
  if (req.method === 'POST' && url.pathname === '/name') return readBody(req, res, MAX_BODY, msg => handleName(req, res, msg));
  // GET /name/<pub>: the name a recovery code belongs to (the game hashes the code before asking).
  if (req.method === 'GET' && parts[0] === 'name' && parts.length === 2) {
    if (!validPub(parts[1])) return reply(res, 400);
    return store.nameOf(parts[1]).then(name => name ? reply(res, 200, { name }) : reply(res, 404)).catch(failed(res));
  }
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
  for (const limit of [roomLimit, submitLimit, nameLimit, allSubmitLimit]) limit.sweep(now);
}, HEARTBEAT_MS);

server.listen(PORT, () => console.log('server on port ' + PORT + ', daily top in ' + (REDIS_URL && REDIS_TOKEN ? 'Upstash Redis' : 'memory')));
