// Generates perfect-clear puzzles for Pocket Tetris and proves each one solvable.
// Physics match the game: hard drops from above, any rotation/column, full rows clear at once,
// one HOLD per piece, and when the queue runs out the held piece is played last.
const SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1],[0,0,0]], S: [[0,1,1],[1,1,0],[0,0,0]], Z: [[1,1,0],[0,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]], L: [[0,0,1],[1,1,1],[0,0,0]]
};
const KEYS = Object.keys(SHAPES);
const FULL = 1023;

function rot(m) { const n = m.length, r = m.map(() => Array(n).fill(0)); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) r[j][n - 1 - i] = m[i][j]; return r; }
// Each orientation as [x, rowFromBottom] cells, normalized so the lowest cell sits on row 0.
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
  return next.filter(v => v !== FULL);
}
function placements(rows, key) {
  const seen = new Set(), res = [];
  for (const o of ORIENTS[key]) for (let x = 0; x + o.w <= 10; x++) {
    const n = drop(rows, o, x), s = n.join(',');
    if (!seen.has(s)) { seen.add(s); res.push(n); }
  }
  return res;
}

const POP = Array.from({ length: 1024 }, (_, v) => { let c = 0; while (v) { c += v & 1; v >>= 1; } return c; });
const cellsOf = rows => rows.reduce((a, v) => a + POP[v], 0);

// Counts [winning move sequences, all move sequences] from a state; memoized.
// A branch is dropped as lost as soon as the stack is taller than the rows the remaining cells can fill:
// every piece is needed for the perfect clear, so such a stack can never be cleared.
function solve(rows0, queue, allowHold) {
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
    for (const n of placements(rows, cur)) {
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

// Small seeded RNG so the level set is reproducible.
let seed = 20260918;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }

function heightsToRows(h, k) {
  const rows = [];
  for (let r = 0; r < k; r++) { let v = 0; for (let x = 0; x < 10; x++) if (h[x] > r) v |= 1 << x; rows.push(v); }
  return rows;
}
function randomHeights(k) {
  const h = []; let cur = Math.floor(rnd() * (k + 1));
  for (let x = 0; x < 10; x++) { cur = Math.max(0, Math.min(k, cur + pick([-2, -1, -1, 0, 0, 1, 1, 2]))); h.push(cur); }
  if (Math.max(...h) < k) h[Math.floor(rnd() * 10)] = k;
  return h;
}

function candidate(k, p, fixedQueue) {
  for (let tries = 0; tries < 400; tries++) {
    const h = randomHeights(k), rows = heightsToRows(h, k);
    if (rows.some(v => v === FULL)) continue;
    const cells = h.reduce((a, b) => a + b, 0);
    if ((10 * k - cells) !== 4 * p) continue;
    const queue = fixedQueue || Array.from({ length: p }, () => pick(KEYS)).join('');
    const [win, all] = solve(rows, queue, true);
    if (!win) continue;
    const [winNoHold] = solve(rows, queue, false);
    return { h, k, queue, win, all, ratio: win / all, needsHold: winNoHold === 0 };
  }
  return null;
}

function render(p) {
  const lines = [];
  for (let r = p.k - 1; r >= 0; r--) lines.push(p.h.map(v => (v > r ? '#' : '.')).join(''));
  return lines;
}

// Chapters: pieces per puzzle, and which of the solvable candidates to keep.
// "easy" keeps the one random play solves most often, "hard" the rarest; chapter 3 prefers ones that need HOLD.
const PLAN = [
  ...['T', 'O', 'L'].map(q => ({ p: 1, ks: [2, 3], pickBy: 'easy', queue: q })),
  ...[2, 2, 2, 2].map(p => ({ p, ks: [2, 3], pickBy: 'easy', distinctPieces: true })),
  ...[3, 3, 3, 3, 4, 4, 4, 4].map(p => ({ p, ks: [2, 3, 4], pickBy: 'mid' })),
  ...[5, 5, 5, 5].map(p => ({ p, ks: [3, 4], pickBy: 'mid' })),
  ...[6, 6, 6, 6].map(p => ({ p, ks: [3, 4], pickBy: 'hard', preferHold: true }))
];
const CANDIDATES = 6, BUDGET_MS = 30000;

const levels = [{ h: [4, 4, 4, 4, 4, 4, 4, 4, 4, 0], k: 4, queue: 'I', ratio: undefined }];
const seen = new Set([levels[0].h.join('') + levels[0].queue]);
PLAN.forEach((spec, n) => {
  const found = [], started = Date.now();
  while (found.length < CANDIDATES && Date.now() - started < BUDGET_MS) {
    const c = candidate(pick(spec.ks), spec.p, spec.queue);
    if (!c) continue;
    const id = c.h.join('') + c.queue;
    if (seen.has(id)) continue;
    // Early two-piece levels should each teach a different pair of pieces.
    if (spec.distinctPieces && (c.queue[0] === c.queue[1] || levels.some(l => [...l.queue].sort().join('') === [...c.queue].sort().join('')))) continue;
    found.push(c);
  }
  if (!found.length) { console.error('no puzzle for', JSON.stringify(spec)); process.exit(1); }
  let pool = found;
  if (spec.preferHold && found.some(c => c.needsHold)) pool = found.filter(c => c.needsHold);
  pool.sort((a, b) => a.ratio - b.ratio);
  const best = spec.pickBy === 'easy' ? pool[pool.length - 1] : spec.pickBy === 'hard' ? pool[0] : pool[Math.floor(pool.length / 2)];
  seen.add(best.h.join('') + best.queue);
  levels.push(best);
  console.error(`level ${n + 2}/24: ${found.length} candidates in ${((Date.now() - started) / 1000).toFixed(1)} s`);
});

// Re-verify every level from scratch before writing it out.
for (const l of levels) {
  const [win] = solve(heightsToRows(l.h, l.k), l.queue, true);
  if (!win) { console.error('UNSOLVABLE', l); process.exit(1); }
}

levels.forEach((l, i) => {
  const name = (Math.floor(i / 8) + 1) + '-' + (i % 8 + 1);
  console.log(`${name}  pieces ${l.queue}  ${l.ratio !== undefined ? 'win share ' + (l.ratio * 100).toFixed(2) + '%' : ''}${l.needsHold ? '  NEEDS HOLD' : ''}`);
  render(l).forEach(r => console.log('   ' + r));
});

const data = levels.map(l => ({ rows: render(l), pieces: l.queue }));
require('fs').writeFileSync(process.argv[2] || 'puzzles.json', JSON.stringify(data));
