// Generates perfect-clear puzzles for Pocket Tetris and proves each one solvable.
// Levels already in puzzles.js are kept as they are (players' progress points at them by index);
// only the levels the plan has beyond them are generated, then every level is re-verified.
// Run: node tools/puzzlegen.js   (rewrites puzzles.js; delete it first to regenerate everything)
//
// Two kinds of physics:
//  - drop: the piece is turned and hard-dropped straight from above (chapters 1-3);
//  - full: the game's real moves in puzzle mode. Pieces don't fall on their own, so the player can
//    soft-drop, slide sideways and turn (with the game's wall kicks) before the hard drop. That lets
//    a piece tuck under a ledge, which a straight drop can't reach (chapters 4-5). A piece lowered onto
//    something locks after half a second unless it keeps moving, so the searched paths assume quick input.
// Both: full rows clear at once, one HOLD per piece, and when the queue runs out the held piece is played last.
const fs = require('fs');
const path = require('path');

// Pieces and wall kicks come from the game's own rules, so the solver can't drift from what the game allows.
const Engine = require('../server/engine.js');
const SHAPES = Engine.SHAPES;
const KEYS = Engine.KEYS;
const FULL = 1023, COLS = 10, ROWS = 20;
const KICKS = Engine.KICKS;

function rot(m) { const n = m.length, r = m.map(() => Array(n).fill(0)); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) r[j][n - 1 - i] = m[i][j]; return r; }

// Boards are arrays of 10-bit rows, index 0 = bottom row; bit x = column x.
const POP = Array.from({ length: 1024 }, (_, v) => { let c = 0; while (v) { c += v & 1; v >>= 1; } return c; });
const cellsOf = rows => rows.reduce((a, v) => a + POP[v], 0);
function settle(rows) {
  const n = rows.filter(v => v !== FULL);
  while (n.length && n[n.length - 1] === 0) n.pop();
  return n;
}

/* ---------- drop physics ---------- */
// Each distinct orientation as [x, rowFromBottom] cells, normalized so the lowest cell sits on row 0.
const ORIENTS = {};
for (const k of KEYS) {
  const out = [], seen = new Set(); let m = SHAPES[k];
  for (let r = 0; r < 4; r++) {
    const cells = [];
    m.forEach((row, y) => row.forEach((v, x) => { if (v) cells.push([x, y]); }));
    const minx = Math.min(...cells.map(c => c[0])), maxy = Math.max(...cells.map(c => c[1]));
    const norm = cells.map(([x, y]) => [x - minx, maxy - y]);
    const key = norm.map(c => c.join(',')).sort().join(';');
    if (!seen.has(key)) { seen.add(key); out.push({ cells: norm, w: Math.max(...norm.map(c => c[0])) + 1 }); }
    m = rot(m);
  }
  ORIENTS[k] = out;
}
function drop(rows, o, x) {
  const fits = b => o.cells.every(([cx, cy]) => { const r = b + cy; return r >= rows.length || !(rows[r] & (1 << (x + cx))); });
  let b = rows.length;
  while (b > 0 && fits(b - 1)) b--;
  const next = rows.slice();
  for (const [cx, cy] of o.cells) { const r = b + cy; while (next.length <= r) next.push(0); next[r] |= 1 << (x + cx); }
  return settle(next);
}
function dropPlacements(rows, key) {
  const seen = new Set(), res = [];
  for (const o of ORIENTS[key]) for (let x = 0; x + o.w <= COLS; x++) {
    const n = drop(rows, o, x), s = n.join(',');
    if (!seen.has(s)) { seen.add(s); res.push(n); }
  }
  return res;
}

/* ---------- full physics: the game's moves ---------- */
// The game keeps a piece as a square matrix at (px, py), py counted from the top of the 20-row board,
// and turns the whole matrix; MATS[key][turn] lists that matrix's cells as [col, row].
const MATS = {};
for (const k of KEYS) {
  MATS[k] = []; let m = SHAPES[k];
  for (let t = 0; t < 4; t++) {
    const cells = [];
    m.forEach((row, y) => row.forEach((v, x) => { if (v) cells.push([x, y]); }));
    MATS[k].push(cells);
    m = rot(m);
  }
}
function hits(rows, cells, px, py) {
  for (const [c, r] of cells) {
    const x = px + c, y = py + r;
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    const b = ROWS - 1 - y;
    if (b < rows.length && (rows[b] >> x) & 1) return true;
  }
  return false;
}
// Every resting spot a piece can be hard-dropped from, found by searching the game's moves:
// left, right, soft drop and both turns with kicks. Above the stack the board is empty, so every
// position there is reachable; the search starts from the lowest few rows of that open space.
// Returns [{ rows, path }] where path is the key presses from the spawn position (for replay tests).
const fullCache = new Map();
function fullPlacements(rows, key, withPaths) {
  const ck = rows.join(',') + key;
  if (!withPaths && fullCache.has(ck)) return fullCache.get(ck);
  const mats = MATS[key], H = rows.length, openBottom = ROWS - 1 - H;
  const id = (t, x, y) => (t * 16 + x + 4) * 32 + y + 4;
  const prev = new Map(), queue = [];
  const visit = (t, x, y, from, move) => {
    const k = id(t, x, y);
    if (prev.has(k)) return;
    prev.set(k, [from, move, t, x, y]);
    queue.push([t, x, y]);
  };
  for (let t = 0; t < 4; t++) {
    const low = Math.max(...mats[t].map(c => c[1]));
    const yMax = openBottom - low;
    for (let y = Math.max(0, yMax - 4); y <= yMax; y++) for (let x = -3; x < COLS; x++) {
      if (!hits(rows, mats[t], x, y)) visit(t, x, y, null, 'seed');
    }
  }
  const res = new Map();
  for (let qi = 0; qi < queue.length; qi++) {
    const [t, x, y] = queue[qi], here = id(t, x, y);
    if (!hits(rows, mats[t], x - 1, y)) visit(t, x - 1, y, here, 'L');
    if (!hits(rows, mats[t], x + 1, y)) visit(t, x + 1, y, here, 'R');
    if (!hits(rows, mats[t], x, y + 1)) visit(t, x, y + 1, here, 'D');
    else {
      const next = rows.slice();
      for (const [c, r] of mats[t]) { const b = ROWS - 1 - (y + r); while (next.length <= b) next.push(0); next[b] |= 1 << (x + c); }
      const n = settle(next), s = n.join(',');
      if (!res.has(s)) res.set(s, { rows: n, at: here });
    }
    for (const [dt, move] of [[1, 'CW'], [3, 'CCW']]) {
      const t2 = (t + dt) % 4;
      for (const [kx, ky] of KICKS) {
        if (!hits(rows, mats[t2], x + kx, y + ky)) { visit(t2, x + kx, y + ky, here, move); break; }
      }
    }
  }
  const out = [...res.values()].map(p => ({ rows: p.rows, path: withPaths ? pathTo(prev, p.at, key) : null }));
  if (!withPaths) {
    if (fullCache.size > 300000) fullCache.clear();
    fullCache.set(ck, out);
  }
  return out;
}
// Key presses from the spawn position to a searched spot: turn at the top, slide over, fall to the seed, then the moves.
function pathTo(prev, at, key) {
  const moves = [];
  let cur = prev.get(at);
  while (cur[1] !== 'seed') { moves.push(cur[1]); cur = prev.get(cur[0]); }
  const [, , t, x, y] = cur;
  const n = SHAPES[key].length, spawnX = ((COLS - n) / 2) | 0, head = [];
  for (let i = 0; i < t; i++) head.push('CW');
  for (let i = spawnX; i < x; i++) head.push('R');
  for (let i = spawnX; i > x; i--) head.push('L');
  for (let i = 0; i < y; i++) head.push('D');
  return head.concat(moves.reverse());
}

/* ---------- solver ---------- */
// Counts [winning move sequences, all move sequences] from a state; memoized.
// A branch is dropped as lost as soon as the stack is taller than the rows the remaining cells can fill:
// every piece is needed for the perfect clear, so such a stack can never be cleared.
function solve(rows0, queue, allowHold, full) {
  const place = full ? (r, k) => fullPlacements(r, k, false).map(p => p.rows) : dropPlacements;
  const memo = new Map();
  function next(qi, hold) {
    if (qi < queue.length) return { cur: queue[qi], qi: qi + 1, hold };
    if (hold) return { cur: hold, qi, hold: null };
    return null;
  }
  function go(rows, cur, qi, hold, holdUsed) {
    const key = rows.join(',') + '|' + cur + qi + (hold || '-') + (holdUsed ? 1 : 0);
    if (memo.has(key)) return memo.get(key);
    let win = 0, all = 0;
    const piecesLeft = (queue.length - qi) + (hold ? 1 : 0);
    for (const n of place(rows, cur)) {
      if (n.length === 0) { win++; all++; continue; }
      if (n.length * 10 > cellsOf(n) + 4 * piecesLeft) { all++; continue; }
      const s = next(qi, hold);
      if (!s) { all++; continue; }
      const [w, a] = go(n, s.cur, s.qi, s.hold, false);
      win += w; all += a;
    }
    if (allowHold && !holdUsed) {
      if (hold) { const [w, a] = go(rows, hold, qi, cur, true); win += w; all += a; }
      else if (qi < queue.length) { const [w, a] = go(rows, queue[qi], qi + 1, cur, true); win += w; all += a; }
    }
    const r = [win, all];
    memo.set(key, r);
    return r;
  }
  return go(rows0, queue[0], 1, null, false);
}

// One winning line as game inputs (full physics), for replaying a level in the real game.
function solution(rows0, queue) {
  const seen = new Set();
  function go(rows, cur, qi, hold, holdUsed) {
    const key = rows.join(',') + '|' + cur + qi + (hold || '-') + (holdUsed ? 1 : 0);
    if (seen.has(key)) return null;
    seen.add(key);
    const piecesLeft = (queue.length - qi) + (hold ? 1 : 0);
    for (const p of fullPlacements(rows, cur, true)) {
      const step = p.path.concat('DROP');
      if (p.rows.length === 0) return step;
      if (p.rows.length * 10 > cellsOf(p.rows) + 4 * piecesLeft) continue;
      const nx = qi < queue.length ? { cur: queue[qi], qi: qi + 1, hold } : hold ? { cur: hold, qi, hold: null } : null;
      if (!nx) continue;
      const rest = go(p.rows, nx.cur, nx.qi, nx.hold, false);
      if (rest) return step.concat(rest);
    }
    if (!holdUsed) {
      let rest = null;
      if (hold) rest = go(rows, hold, qi, cur, true);
      else if (qi < queue.length) rest = go(rows, queue[qi], qi + 1, cur, true);
      if (rest) return ['HOLD'].concat(rest);
    }
    return null;
  }
  return go(rows0, queue[0], 1, null, false);
}

/* ---------- random boards ---------- */
// Small seeded RNG so a run is reproducible on the same machine (the time budget can still vary the result).
let seed = 20260918;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }

function randomHeights(k) {
  const h = []; let cur = Math.floor(rnd() * (k + 1));
  for (let x = 0; x < COLS; x++) { cur = Math.max(0, Math.min(k, cur + pick([-2, -1, -1, 0, 0, 1, 1, 2]))); h.push(cur); }
  if (Math.max(...h) < k) h[Math.floor(rnd() * COLS)] = k;
  return h;
}
function heightsToRows(h, k) {
  const rows = [];
  for (let r = 0; r < k; r++) { let v = 0; for (let x = 0; x < COLS; x++) if (h[x] > r) v |= 1 << x; rows.push(v); }
  return rows;
}
// Ledges: empty a cell that has a block above it and opens sideways onto a lower column,
// sometimes widening the gap one more cell under the same roof.
function carveLedges(rows, h, count) {
  for (let i = 0; i < count; i++) {
    const spots = [];
    for (let x = 0; x < COLS; x++) for (let r = 0; r + 1 < h[x]; r++) {
      for (const nx of [x - 1, x + 1]) if (nx >= 0 && nx < COLS && !((rows[r] >> nx) & 1) && (rows[r] >> x) & 1) spots.push([x, r, nx]);
    }
    if (!spots.length) return;
    const [x, r, nx] = pick(spots);
    rows[r] &= ~(1 << x);
    const far = x + (x - nx);
    if (rnd() < 0.4 && far >= 0 && far < COLS && r + 1 < h[far] && (rows[r] >> far) & 1) rows[r] &= ~(1 << far);
  }
}

function candidate(spec) {
  for (let tries = 0; tries < 400; tries++) {
    const k = pick(spec.ks), h = randomHeights(k), rows = heightsToRows(h, k);
    if (spec.ledges) carveLedges(rows, h, pick(spec.ledges));
    if (rows.some(v => v === FULL || v === 0) || rows.length !== k) continue;
    if ((COLS * k - cellsOf(rows)) !== 4 * spec.p) continue;
    const queue = spec.queue || Array.from({ length: spec.p }, () => pick(KEYS)).join('');
    const [win, all] = solve(rows, queue, true, spec.full);
    if (!win) continue;
    const needsTuck = spec.full ? solve(rows, queue, true, false)[0] === 0 : false;
    if (spec.needsTuck && !needsTuck) continue;
    const needsHold = solve(rows, queue, false, spec.full)[0] === 0;
    return { rows, queue, ratio: win / all, needsHold, needsTuck };
  }
  return null;
}

function render(rows) {
  const lines = [];
  for (let r = rows.length - 1; r >= 0; r--) { let s = ''; for (let x = 0; x < COLS; x++) s += (rows[r] >> x) & 1 ? '#' : '.'; lines.push(s); }
  return lines;
}
function parse(lines) {
  return lines.slice().reverse().map(s => { let v = 0; for (let x = 0; x < COLS; x++) if (s[x] === '#') v |= 1 << x; return v; });
}

/* ---------- the plan: 8 levels per chapter ---------- */
// "easy" keeps the candidate random play solves most often, "hard" the rarest, "mid" the median.
// Level 1-1 is hand-made: an I piece into a well.
const PLAN = [
  { fixed: { rows: ['#########.', '#########.', '#########.', '#########.'], pieces: 'I' } },
  // Chapter 1: one or two pieces, straight drops.
  ...['T', 'O', 'L'].map(q => ({ p: 1, ks: [2, 3], pickBy: 'easy', queue: q })),
  ...[2, 2, 2, 2].map(p => ({ p, ks: [2, 3], pickBy: 'easy', distinctPieces: true })),
  // Chapters 2-3: longer queues; chapter 3 prefers levels that need HOLD.
  ...[3, 3, 3, 3, 4, 4, 4, 4].map(p => ({ p, ks: [2, 3, 4], pickBy: 'mid' })),
  ...[5, 5, 5, 5].map(p => ({ p, ks: [3, 4], pickBy: 'mid' })),
  ...[6, 6, 6, 6].map(p => ({ p, ks: [3, 4], pickBy: 'hard', preferTricky: true })),
  // Chapter 4: every board has a ledge that a straight drop can't fill — soft-drop and slide the piece under it.
  // It starts at two pieces: with a single piece there is no room left to slide it anywhere.
  { p: 2, ks: [2, 3], ledges: [1], full: true, needsTuck: true, pickBy: 'easy', tip: 'SOFT DROP,\nTHEN SLIDE\nUNDER THE LEDGE' },
  ...[2, 2, 3, 3, 3, 4, 4].map((p, i) => ({ p, ks: p < 4 ? [2, 3] : [3, 4], ledges: [1, 2], full: true, needsTuck: true, pickBy: i < 1 ? 'easy' : i < 5 ? 'mid' : 'hard' })),
  // Chapter 5: long queues with ledges; the rarest solutions, preferring ones that need HOLD or a tuck.
  ...[4, 4, 5, 5, 5, 5, 6, 6].map(p => ({ p, ks: [3, 4], ledges: [1, 2], full: true, pickBy: 'hard', preferTricky: true }))
];
const CANDIDATES = 6, BUDGET_MS = 60000;

/* ---------- run ---------- */
const OUT = path.join(__dirname, '..', 'puzzles.js');
let existing = [];
if (fs.existsSync(OUT)) {
  const src = fs.readFileSync(OUT, 'utf8');
  existing = JSON.parse(src.slice(src.indexOf('['), src.lastIndexOf(']') + 1));
}
const levels = existing.map(l => ({ rows: parse(l.rows), queue: l.pieces, tip: l.tip, kept: true }));
const seen = new Set(levels.map(l => l.rows.join(',') + l.queue));

PLAN.forEach((spec, n) => {
  if (n < levels.length) return;
  if (spec.fixed) { levels.push({ rows: parse(spec.fixed.rows), queue: spec.fixed.pieces }); return; }
  const found = [], started = Date.now();
  while (found.length < CANDIDATES && Date.now() - started < BUDGET_MS) {
    const c = candidate(spec);
    if (!c) continue;
    const id = c.rows.join(',') + c.queue;
    if (seen.has(id) || found.some(f => f.rows.join(',') + f.queue === id)) continue;
    // Early two-piece levels should each teach a different pair of pieces.
    if (spec.distinctPieces && (c.queue[0] === c.queue[1] || levels.some(l => [...l.queue].sort().join('') === [...c.queue].sort().join('')))) continue;
    found.push(c);
  }
  if (!found.length) { console.error('no puzzle for', JSON.stringify(spec)); process.exit(1); }
  let pool = found;
  if (spec.preferTricky && found.some(c => c.needsHold || c.needsTuck)) pool = found.filter(c => c.needsHold || c.needsTuck);
  pool.sort((a, b) => a.ratio - b.ratio);
  const best = spec.pickBy === 'easy' ? pool[pool.length - 1] : spec.pickBy === 'hard' ? pool[0] : pool[Math.floor(pool.length / 2)];
  best.tip = spec.tip;
  seen.add(best.rows.join(',') + best.queue);
  levels.push(best);
  console.error(`level ${n + 1}/${PLAN.length}: ${found.length} candidates in ${((Date.now() - started) / 1000).toFixed(1)} s`);
});

// Re-verify every level from scratch with the game's real moves before writing it out.
for (const l of levels) {
  if (!solve(l.rows, l.queue, true, true)[0]) { console.error('UNSOLVABLE', render(l.rows), l.queue); process.exit(1); }
}

levels.forEach((l, i) => {
  const name = (Math.floor(i / 8) + 1) + '-' + (i % 8 + 1);
  const notes = [l.kept ? 'kept' : '', l.ratio !== undefined ? 'win share ' + (l.ratio * 100).toFixed(2) + '%' : '', l.needsHold ? 'NEEDS HOLD' : '', l.needsTuck ? 'NEEDS TUCK' : ''];
  console.log(`${name}  pieces ${l.queue}  ${notes.filter(Boolean).join('  ')}`);
  render(l.rows).forEach(r => console.log('   ' + r));
});

// Winning inputs for each level, so a browser test can replay them in the real game.
if (process.argv.includes('--solutions')) {
  const sols = levels.map(l => solution(l.rows, l.queue));
  fs.writeFileSync(process.argv[process.argv.indexOf('--solutions') + 1], JSON.stringify(sols));
}

const body = levels.map(l => {
  const o = { rows: render(l.rows), pieces: l.queue };
  if (l.tip) o.tip = l.tip;
  return '  ' + JSON.stringify(o);
}).join(',\n');
fs.writeFileSync(OUT,
  '// Generated by tools/puzzlegen.js: every level is a perfect clear that the solver has proven possible.\n' +
  '// rows go top to bottom and sit on the floor of the board; pieces are dealt in this order.\n' +
  '// tip, when present, is shown when the level starts.\n' +
  'window.POCKET_PUZZLES=[\n' + body + '\n];\n');
console.error('wrote ' + levels.length + ' levels to ' + OUT);
