// Pocket Tetris battle server: pairs two players in a room and relays their messages.
// No dependencies. Messages go down to players as Server-Sent Events and come up as small POSTs.
// Rooms live in memory, so run a single instance.
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
}, HEARTBEAT_MS);

server.listen(PORT, () => console.log('battle server on port ' + PORT));
