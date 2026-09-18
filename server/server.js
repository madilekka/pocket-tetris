// Pocket Tetris server: online battles and the daily top.
// Battles: pairs two players in a room and relays their messages. Messages go down to players as
// Server-Sent Events and come up as small POSTs. Rooms live in memory, so run a single instance.
// Daily top: everyone plays the same pieces each day, so each player's best score of the day goes on a shared list.
// No dependencies.
const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 8094;
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || 'https://pocket-tetris.onrender.com,http://127.0.0.1:8093').split(',')
);
const MAX_BODY = 2048;
const ROOM_TTL_MS = 30 * 60 * 1000;
const EMPTY_ROOM_TTL_MS = 2 * 60 * 1000;
const HEARTBEAT_MS = 20 * 1000;
// The free Render instance forgets its memory whenever it sleeps, so daily scores go to Upstash Redis when it's configured.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TOP_SIZE = 10;
const MAX_SCORE = 10000000;
const DAY_KEEP_S = 3 * 24 * 3600;
const SUBMITS_PER_WINDOW = 30, SUBMIT_WINDOW_MS = 10 * 60 * 1000;

// code -> { players: [{ pid, res, ready }], touched, emptySince }
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
  attack: d => Number.isInteger(d) && d >= 1 && d <= 10,
  board: d => typeof d === 'string' && /^[012]{200}$/.test(d)
};

function readBody(req, done) {
  let size = 0;
  const chunks = [];
  req.on('data', c => {
    size += c.length;
    if (size > MAX_BODY) { req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    try { done(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { done(null); }
  });
}

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
  room.touched = Date.now();
  const others = room.players.filter(p => p !== player);

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

/* ---------- daily top ---------- */
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
// Equal scores rank by who got there first: the fraction shrinks as the day goes on.
// Sorted-set scores are doubles, which keep this fraction exactly for scores far above MAX_SCORE.
const rankValue = score => score + (86400 - Math.floor((Date.now() + 5 * 3600 * 1000) / 1000) % 86400) / 100000;

function memoryStore() {
  const days = new Map(); // day -> Map(pid -> { name, value })
  const list = day => [...(days.get(day) || new Map()).entries()].sort((a, b) => b[1].value - a[1].value);
  return {
    async submit(day, pid, name, score) {
      if (!days.has(day)) days.set(day, new Map());
      const players = days.get(day), had = players.get(pid), value = rankValue(score);
      players.set(pid, { name, value: had && had.value >= value ? had.value : value });
      for (const d of days.keys()) if (!validDay(d)) days.delete(d);
      const all = list(day);
      return { rank: all.findIndex(e => e[0] === pid) + 1, players: all.length };
    },
    async top(day, pid) {
      const all = list(day), at = all.findIndex(e => e[0] === pid);
      return {
        players: all.length,
        top: all.slice(0, TOP_SIZE).map(([p, e]) => ({ name: e.name, score: Math.floor(e.value), me: p === pid })),
        me: at === -1 ? null : { rank: at + 1, score: Math.floor(all[at][1].value) }
      };
    }
  };
}

// Upstash Redis over its REST API: a sorted set of best scores and a hash of names per day.
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
  const keys = day => ['pt:daily:' + day, 'pt:names:' + day];
  return {
    async submit(day, pid, name, score) {
      const [z, n] = keys(day);
      const r = await run([
        ['ZADD', z, 'GT', String(rankValue(score)), pid], ['HSET', n, pid, name],
        ['EXPIRE', z, String(DAY_KEEP_S)], ['EXPIRE', n, String(DAY_KEEP_S)],
        ['ZREVRANK', z, pid], ['ZCARD', z]
      ]);
      return { rank: r[4] + 1, players: r[5] };
    },
    async top(day, pid) {
      const [z, n] = keys(day);
      const [flat, players, rank, mine] = await run([
        ['ZREVRANGE', z, '0', String(TOP_SIZE - 1), 'WITHSCORES'], ['ZCARD', z], ['ZREVRANK', z, pid], ['ZSCORE', z, pid]
      ]);
      const pids = [];
      for (let i = 0; i < flat.length; i += 2) pids.push(flat[i]);
      const names = pids.length ? (await run([['HMGET', n, ...pids]]))[0] : [];
      return {
        players,
        top: pids.map((p, i) => ({ name: names[i] || '?', score: Math.floor(Number(flat[2 * i + 1])), me: p === pid })),
        me: rank === null ? null : { rank: rank + 1, score: Math.floor(Number(mine)) }
      };
    }
  };
}

const store = REDIS_URL && REDIS_TOKEN ? redisStore() : memoryStore();

// Each address may submit a limited number of scores per window.
const submits = new Map();
function allowSubmit(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const now = Date.now();
  let s = submits.get(ip);
  if (!s || now - s.since > SUBMIT_WINDOW_MS) { s = { since: now, count: 0 }; submits.set(ip, s); }
  return ++s.count <= SUBMITS_PER_WINDOW;
}

function handleSubmit(req, res, msg) {
  if (!msg || !validPid(msg.pid)) return reply(res, 400);
  const name = cleanName(msg.name);
  if (!name || !Number.isInteger(msg.day) || !validDay(msg.day)) return reply(res, 400);
  if (!Number.isInteger(msg.score) || msg.score < 1 || msg.score > MAX_SCORE) return reply(res, 400);
  if (!allowSubmit(req)) return reply(res, 429);
  store.submit(msg.day, msg.pid, name, msg.score)
    .then(r => reply(res, 200, r))
    .catch(e => { console.error(e.message); reply(res, 503); });
}

function handleTop(res, day, pid) {
  if (!validDay(day) || !validPid(pid)) return reply(res, 400);
  store.top(day, pid)
    .then(r => reply(res, 200, r))
    .catch(e => { console.error(e.message); reply(res, 503); });
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
  if (req.method === 'POST' && url.pathname === '/daily') return readBody(req, msg => handleSubmit(req, res, msg));
  if (req.method === 'GET' && parts[0] === 'daily' && /^\d{8}$/.test(parts[1] || '') && parts.length === 2) {
    return handleTop(res, Number(parts[1]), url.searchParams.get('pid'));
  }
  if (req.method === 'POST' && url.pathname === '/rooms') {
    const code = newCode();
    if (!code) return reply(res, 503);
    rooms.set(code, { players: [], touched: Date.now(), emptySince: Date.now() });
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
    if (req.method === 'POST' && parts[2] === 'msg') return readBody(req, msg => handleMessage(res, room, msg));
  }
  reply(res, 404, { error: 'not found' });
});

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const idle = now - room.touched > ROOM_TTL_MS;
    const abandoned = room.emptySince && now - room.emptySince > EMPTY_ROOM_TTL_MS;
    if (idle || abandoned) {
      for (const p of room.players) if (p.res) p.res.end();
      rooms.delete(code);
      continue;
    }
    for (const p of room.players) if (p.res) p.res.write(': ping\n\n');
  }
  for (const [ip, s] of submits) if (now - s.since > SUBMIT_WINDOW_MS) submits.delete(ip);
}, HEARTBEAT_MS);

server.listen(PORT, () => console.log('server on port ' + PORT + ', daily top in ' + (REDIS_URL && REDIS_TOKEN ? 'Upstash Redis' : 'memory')));
