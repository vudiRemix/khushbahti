'use strict';
/* Испытания босса. Впадая в ярость, босс зовёт тебя на испытание прямо посреди боя:
   • «Дурак» (js/durak.js);
   • «Королевский матч» — три в ряд, как Royal Match и Toon Blast: ракеты, бомбы, диско-шар;
   • «Блок-бласт» — как Block Blast: три фигуры, собирай полные ряды и столбцы.
   Всё, что собрал, бьёт по HP босса; провалил — теряешь сердечки. Доска босса просвечивает. */

const CH_NAMES = { durak: 'ДУРАК', match3: 'КОРОЛЕВСКИЙ МАТЧ', blast: 'БЛОК-БЛАСТ' };
const CH_CAP = 0.3; // больше 30% HP босса за одно испытание не снять
const CH_INVITE = {
  durak: 'Сыграем в дурака? Проиграешь — колпак твой!',
  match3: 'Королевский матч! Собери мне корон — если сможешь!',
  blast: 'Блок-бласт! Посмотрим, как ты складываешь фигуры!',
};

// ---------- три в ряд ----------
const M3 = { cols: 7, rows: 7, size: 64, kinds: 5, moves: 14, goal: 12, tileDmg: 0.0015, crownDmg: 0.003, goalBonus: 0.08, fail: 3, money: 700 };
const M3_COLORS = ['#ffca28', '#1e88e5', '#e53935', '#43a047', '#8e24aa'];

function drawM3Tile(ctx, k, s, x, y, size, now) {
  const r = size * 0.36;
  ctx.save();
  ctx.translate(x, y);
  if (k === 0) drawCrown(ctx, 0, 4, size / 70, '#ffca28');
  else if (k === 1) {
    // синяя книга
    rr(ctx, -r, -r * 0.85, r * 2, r * 1.7, 5);
    ctx.fillStyle = '#1e88e5';
    ctx.fill();
    ctx.fillStyle = '#e3f2fd';
    ctx.fillRect(-r + 4, r * 0.55, r * 2 - 8, 5);
    line(ctx, -r + 6, -r * 0.4, r - 6, -r * 0.4, '#bbdefb', 3);
  } else if (k === 2) {
    // красный самоцвет
    poly(ctx, [0, -r, r, -r * 0.2, 0, r, -r, -r * 0.2], '#e53935', '#7f0000', 2);
    poly(ctx, [0, -r, r * 0.45, -r * 0.2, 0, r * 0.2, -r * 0.45, -r * 0.2], 'rgba(255,255,255,0.35)');
  } else if (k === 3) {
    // зелёный лист
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.62, r, 0.6, 0, TAU);
    ctx.fillStyle = '#43a047';
    ctx.fill();
    line(ctx, -r * 0.5, r * 0.6, r * 0.5, -r * 0.6, '#1b5e20', 2.5);
  } else {
    // фиолетовое зелье
    circ(ctx, 0, r * 0.2, r * 0.8, '#8e24aa');
    ctx.fillStyle = '#ce93d8';
    ctx.fillRect(-r * 0.25, -r, r * 0.5, r * 0.6);
    circ(ctx, -r * 0.25, 0, r * 0.18, 'rgba(255,255,255,0.6)');
  }
  if (s) {
    // особые фишки: ракета, бомба, диско-шар
    if (s === 'h' || s === 'v') {
      ctx.save();
      if (s === 'v') ctx.rotate(Math.PI / 2);
      rr(ctx, -r * 1.05, -r * 0.32, r * 2.1, r * 0.64, r * 0.3);
      ctx.fillStyle = '#eceff1';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#37474f';
      ctx.stroke();
      poly(ctx, [r * 1.05, 0, r * 0.7, -r * 0.32, r * 0.7, r * 0.32], '#e53935');
      poly(ctx, [-r * 1.05, 0, -r * 0.7, -r * 0.32, -r * 0.7, r * 0.32], '#e53935');
      ctx.restore();
    } else if (s === 'bomb') {
      circ(ctx, 0, 2, r * 0.75, '#263238');
      ctx.fillStyle = '#d32f2f';
      ctx.fillRect(-r * 0.5, -r * 0.2, r, r * 0.4);
      text(ctx, 'TNT', 0, 6, { font: `bold ${Math.round(r * 0.5)}px ${FONT.ui}`, color: '#fff', align: 'center' });
    } else if (s === 'disco') {
      const gr = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r);
      gr.addColorStop(0, '#fff');
      gr.addColorStop(1, `hsl(${(now * 200) % 360},80%,55%)`);
      circ(ctx, 0, 0, r * 0.95, gr);
      for (let i = 0; i < 6; i++) circ(ctx, Math.cos(i + now * 3) * r * 0.55, Math.sin(i + now * 3) * r * 0.55, 3, '#fff');
    }
  }
  ctx.restore();
}

class Match3 {
  constructor(ch) {
    this.ch = ch;
    this.moves = M3.moves;
    this.crowns = 0;
    this.sel = null;
    this.busy = 0; // пока фишки падают и взрываются — ход не принимаем
    this.cascade = 0;
    this.grid = [];
    for (let r = 0; r < M3.rows; r++) {
      this.grid.push([]);
      for (let c = 0; c < M3.cols; c++) {
        let k;
        do k = randi(0, M3.kinds - 1);
        while ((c >= 2 && this.grid[r][c - 1].k === k && this.grid[r][c - 2].k === k) || (r >= 2 && this.grid[r - 1][c].k === k && this.grid[r - 2][c].k === k));
        this.grid[r].push({ k, s: '', oy: -(M3.rows - r) * M3.size - 40 });
      }
    }
    this.x0 = 640 - (M3.cols * M3.size) / 2;
    this.y0 = 214;
  }

  cellXY(c, r) {
    return { x: this.x0 + c * M3.size + M3.size / 2, y: this.y0 + r * M3.size + M3.size / 2 };
  }

  // Ряды из 3+ одинаковых фишек.
  runs() {
    const out = [];
    const G = this.grid;
    for (let r = 0; r < M3.rows; r++) {
      let c = 0;
      while (c < M3.cols) {
        let e = c;
        while (e + 1 < M3.cols && G[r][e + 1].k === G[r][c].k) e++;
        if (e - c >= 2) out.push({ dir: 'h', cells: Array.from({ length: e - c + 1 }, (_, i) => [c + i, r]) });
        c = e + 1;
      }
    }
    for (let c = 0; c < M3.cols; c++) {
      let r = 0;
      while (r < M3.rows) {
        let e = r;
        while (e + 1 < M3.rows && G[e + 1][c].k === G[r][c].k) e++;
        if (e - r >= 2) out.push({ dir: 'v', cells: Array.from({ length: e - r + 1 }, (_, i) => [c, r + i]) });
        r = e + 1;
      }
    }
    return out;
  }

  // Нажата фишка.
  click(c, r) {
    if (this.busy > 0 || this.ch.done) return;
    const t = this.grid[r][c];
    if (this.sel && this.sel.c === c && this.sel.r === r) {
      // второй щелчок по особой фишке — взорвать её (как в Toon Blast)
      if (t.s) {
        this.moves--;
        this.resolve([[c, r]], null);
      }
      this.sel = null;
      return;
    }
    if (this.sel && Math.abs(this.sel.c - c) + Math.abs(this.sel.r - r) === 1) {
      const a = this.sel;
      this.sel = null;
      this.swap(a.c, a.r, c, r);
      return;
    }
    this.sel = { c, r };
    dkSound('card');
  }

  swap(c1, r1, c2, r2) {
    const G = this.grid, A = G[r1][c1], B = G[r2][c2];
    G[r1][c1] = B;
    G[r2][c2] = A;
    if (A.s || B.s) {
      // особые фишки срабатывают от любого обмена; диско-шар забирает цвет соседа
      this.moves--;
      const seed = [];
      if (A.s) seed.push([c2, r2]);
      if (B.s) seed.push([c1, r1]);
      this.discoKind = A.s === 'disco' ? B.k : B.s === 'disco' ? A.k : null;
      this.resolve(seed, [c2, r2]);
      return;
    }
    if (!this.runs().length) {
      G[r1][c1] = A;
      G[r2][c2] = B;
      this.ch.hint('Так ряд не собрать', 1);
      Sound.empty();
      return;
    }
    this.moves--;
    this.resolve([], [c2, r2]);
  }

  // Каскад: совпадения → особые фишки → взрывы → падение → снова совпадения.
  resolve(seed, at) {
    const G = this.grid, kill = new Set(), key = (c, r) => c + ',' + r;
    const make = [];
    for (const [c, r] of seed) kill.add(key(c, r));
    const runs = this.runs();
    const count = new Map();
    for (const run of runs) for (const [c, r] of run.cells) count.set(key(c, r), (count.get(key(c, r)) || 0) + 1);
    for (const run of runs) {
      for (const [c, r] of run.cells) kill.add(key(c, r));
      // где появится особая фишка: в точке обмена, если она в ряду, иначе посередине
      const inRun = at && run.cells.some(([c, r]) => c === at[0] && r === at[1]);
      const [mc, mr] = inRun ? at : run.cells[Math.floor(run.cells.length / 2)];
      const cross = run.cells.find(([c, r]) => count.get(key(c, r)) > 1);
      if (run.cells.length >= 5) make.push({ c: mc, r: mr, s: 'disco', k: G[mr][mc].k });
      else if (cross) make.push({ c: cross[0], r: cross[1], s: 'bomb', k: G[cross[1]][cross[0]].k });
      else if (run.cells.length === 4) make.push({ c: mc, r: mr, s: run.dir === 'h' ? 'v' : 'h', k: G[mr][mc].k });
    }
    if (!kill.size) {
      this.busy = 0;
      this.cascade = 0;
      this.afterMove();
      return;
    }
    // взрывы особых фишек тянут за собой новые клетки
    const queue = [...kill];
    const fired = new Set();
    while (queue.length) {
      const k = queue.pop();
      if (fired.has(k)) continue;
      const [c, r] = k.split(',').map(Number);
      const t = G[r][c];
      if (!t.s) continue;
      fired.add(k);
      const add = (x, y) => {
        if (x < 0 || y < 0 || x >= M3.cols || y >= M3.rows) return;
        const kk = key(x, y);
        if (!kill.has(kk)) {
          kill.add(kk);
          queue.push(kk);
        }
      };
      if (t.s === 'h') for (let x = 0; x < M3.cols; x++) add(x, r);
      else if (t.s === 'v') for (let y = 0; y < M3.rows; y++) add(c, y);
      else if (t.s === 'bomb') for (let y = r - 1; y <= r + 1; y++) for (let x = c - 1; x <= c + 1; x++) add(x, y);
      else if (t.s === 'disco') {
        const tally = [0, 0, 0, 0, 0];
        for (const row of G) for (const q of row) tally[q.k]++;
        const kind = this.discoKind !== null && this.discoKind !== undefined ? this.discoKind : tally.indexOf(Math.max(...tally));
        for (let y = 0; y < M3.rows; y++) for (let x = 0; x < M3.cols; x++) if (G[y][x].k === kind) add(x, y);
      }
      if (t.s === 'h' || t.s === 'v') Sound.whoosh();
      else Sound.explosion(false);
    }
    this.discoKind = null;
    // убираем фишки, считаем урон и короны
    let crowns = 0, tiles = 0;
    for (const k of kill) {
      const [c, r] = k.split(',').map(Number);
      if (make.some((m) => m.c === c && m.r === r)) continue;
      const t = G[r][c];
      tiles++;
      if (t.k === 0) crowns++;
      const p = this.cellXY(c, r);
      FX.burst(this.ch.g, p.x, p.y, 4, { colors: [M3_COLORS[t.k], '#fff'], size: 5, speed: 180, grav: 300, life: 0.4 });
      G[r][c] = null;
    }
    for (const m of make) G[m.r][m.c] = { k: m.k, s: m.s, oy: 0 };
    this.crowns += crowns;
    this.cascade++;
    const pct = tiles * M3.tileDmg + crowns * M3.crownDmg;
    this.ch.hitBoss(pct, this.cascade > 1 ? `каскад ×${this.cascade}` : '');
    if (crowns) this.ch.float(`+${crowns} 👑`, 1080, 330, '#ffd54a');
    Sound.coin();
    // падение и новые фишки сверху
    for (let c = 0; c < M3.cols; c++) {
      let w = M3.rows - 1;
      for (let r = M3.rows - 1; r >= 0; r--) {
        if (G[r][c]) {
          if (w !== r) {
            G[w][c] = G[r][c];
            G[w][c].oy -= (w - r) * M3.size;
            G[r][c] = null;
          }
          w--;
        }
      }
      for (let r = w; r >= 0; r--) G[r][c] = { k: randi(0, M3.kinds - 1), s: '', oy: -(w + 1) * M3.size - 30 };
    }
    this.busy = 0.32;
    this.next = true;
  }

  afterMove() {
    if (this.moves <= 0) return this.ch.finish();
    if (!this.hasMove()) {
      // ходов нет — перемешиваем
      const all = this.grid.flat();
      shuffle(all);
      for (let r = 0; r < M3.rows; r++) for (let c = 0; c < M3.cols; c++) this.grid[r][c] = all[r * M3.cols + c];
      this.ch.hint('Ходов нет — перемешал', 1.4);
      if (this.runs().length) this.resolve([], null);
    }
  }

  hasMove() {
    const G = this.grid;
    for (let r = 0; r < M3.rows; r++) {
      for (let c = 0; c < M3.cols; c++) {
        if (G[r][c].s) return true;
        for (const [dc, dr] of [[1, 0], [0, 1]]) {
          const c2 = c + dc, r2 = r + dr;
          if (c2 >= M3.cols || r2 >= M3.rows) continue;
          [G[r][c], G[r2][c2]] = [G[r2][c2], G[r][c]];
          const ok = this.runs().length > 0;
          [G[r][c], G[r2][c2]] = [G[r2][c2], G[r][c]];
          if (ok) return true;
        }
      }
    }
    return false;
  }

  update(dt) {
    for (const row of this.grid) for (const t of row) if (t) t.oy = Math.min(0, t.oy + dt * 900);
    if (this.busy > 0) {
      this.busy -= dt;
      if (this.busy <= 0 && this.next) {
        this.next = false;
        this.resolve([], null);
      }
    }
  }

  result() {
    return { goal: this.crowns >= M3.goal };
  }

  draw(ctx, g, now) {
    const s = M3.size;
    rr(ctx, this.x0 - 10, this.y0 - 10, M3.cols * s + 20, M3.rows * s + 20, 16);
    ctx.fillStyle = 'rgba(40,24,70,0.92)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffca28';
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.x0, this.y0, M3.cols * s, M3.rows * s);
    ctx.clip();
    for (let r = 0; r < M3.rows; r++) {
      for (let c = 0; c < M3.cols; c++) {
        const p = this.cellXY(c, r);
        ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.11)';
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        const t = this.grid[r][c];
        if (!t) continue;
        const sel = this.sel && this.sel.c === c && this.sel.r === r;
        if (sel) {
          rr(ctx, p.x - s / 2 + 3, p.y - s / 2 + 3, s - 6, s - 6, 10);
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.fill();
        }
        drawM3Tile(ctx, t.k, t.s, p.x, p.y + t.oy + (sel ? Math.sin(now * 10) * 2 : 0), s, now);
        if (!this.ch.done && !this.ch.menu) g.buttons.push({ x: p.x - s / 2, y: p.y - s / 2, w: s, h: s, action: () => this.click(c, r) });
      }
    }
    ctx.restore();
    // ходы и цель — как в Royal Match
    panel(ctx, 70, 230, 230, 200);
    text(ctx, 'ХОДЫ', 185, 268, { font: `14px ${FONT.pixel}`, color: '#ffd54a', align: 'center' });
    text(ctx, String(this.moves), 185, 330, { font: `64px ${FONT.title}`, color: this.moves <= 3 ? '#ff5252' : '#fff', stroke: '#000', lw: 6, align: 'center' });
    text(ctx, 'нажми фишку, потом соседнюю', 185, 372, { font: `bold 13px ${FONT.ui}`, color: '#e1d5f0', align: 'center' });
    text(ctx, 'особую — нажми дважды', 185, 392, { font: `bold 13px ${FONT.ui}`, color: '#e1d5f0', align: 'center' });
    panel(ctx, 980, 230, 230, 200);
    text(ctx, 'ЦЕЛЬ', 1095, 268, { font: `14px ${FONT.pixel}`, color: '#ffd54a', align: 'center' });
    drawCrown(ctx, 1060, 320, 0.8, '#ffca28');
    text(ctx, `${Math.min(this.crowns, M3.goal)}/${M3.goal}`, 1125, 332, { font: `34px ${FONT.title}`, color: this.crowns >= M3.goal ? '#7ee05a' : '#fff', stroke: '#000', lw: 5, align: 'center' });
    text(ctx, '4 в ряд — ракета', 1095, 372, { font: `bold 13px ${FONT.ui}`, color: '#e1d5f0', align: 'center' });
    text(ctx, 'угол — бомба, 5 — диско', 1095, 392, { font: `bold 13px ${FONT.ui}`, color: '#e1d5f0', align: 'center' });
  }
}

function panel(ctx, x, y, w, h) {
  rr(ctx, x, y, w, h, 14);
  ctx.fillStyle = 'rgba(20,10,35,0.85)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,202,40,0.6)';
  ctx.stroke();
}

// ---------- Block Blast ----------
const BB = { n: 8, size: 54, lineDmg: 0.022, time: 90, fail: 3, minLines: 3 };
const BB_COLORS = ['#ef5350', '#ffa726', '#ffee58', '#66bb6a', '#29b6f6', '#5c6bc0', '#ab47bc'];
const BB_SHAPES = [
  [[0, 0]],
  [[0, 0], [1, 0]], [[0, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [0, 1], [0, 2], [0, 3]],
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
  [[0, 0], [0, 1], [1, 1]], [[1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 2]], [[1, 0], [1, 1], [1, 2], [0, 2]], [[0, 0], [1, 0], [2, 0], [0, 1]], [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]], [[1, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [0, 1], [1, 1]],
];

function drawBlock(ctx, x, y, s, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  rr(ctx, x + 1, y + 1, s - 2, s - 2, 6);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.fillRect(x + 5, y + 4, s - 10, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x + 5, y + s - 9, s - 10, 5);
  ctx.restore();
}

class Blast {
  constructor(ch) {
    this.ch = ch;
    this.grid = Array.from({ length: BB.n }, () => Array(BB.n).fill(null));
    this.lines = 0;
    this.combo = 0;
    this.best = 0;
    this.score = 0;
    this.time = BB.time;
    this.sel = -1;
    this.flash = []; // очищенные клетки мигают
    this.x0 = 640 - (BB.n * BB.size) / 2;
    this.y0 = 214;
    this.deal();
  }

  deal() {
    this.tray = [0, 1, 2].map(() => ({ cells: choice(BB_SHAPES), color: choice(BB_COLORS), used: false }));
  }

  fits(cells, c, r) {
    return cells.every(([dx, dy]) => {
      const x = c + dx, y = r + dy;
      return x >= 0 && y >= 0 && x < BB.n && y < BB.n && !this.grid[y][x];
    });
  }

  anyFits() {
    return this.tray.some((t) => !t.used && this.grid.some((row, r) => row.some((_, c) => this.fits(t.cells, c, r))));
  }

  // Клетка, куда встанет левый верхний угол фигуры, если курсор в точке (x, y).
  anchor(cells, x, y) {
    const w = Math.max(...cells.map((p) => p[0])) + 1, h = Math.max(...cells.map((p) => p[1])) + 1;
    return { c: Math.round((x - this.x0) / BB.size - w / 2), r: Math.round((y - this.y0) / BB.size - h / 2) };
  }

  pick(i) {
    if (this.ch.done || this.tray[i].used) return;
    this.sel = this.sel === i ? -1 : i;
    dkSound('card');
  }

  drop(x, y) {
    if (this.sel < 0 || this.ch.done) return;
    const t = this.tray[this.sel];
    const { c, r } = this.anchor(t.cells, x, y);
    if (!this.fits(t.cells, c, r)) {
      Sound.empty();
      this.ch.hint('Сюда не влезет', 0.8);
      return;
    }
    for (const [dx, dy] of t.cells) this.grid[r + dy][c + dx] = t.color;
    t.used = true;
    this.sel = -1;
    this.score += t.cells.length;
    Sound.tok();
    // полные ряды и столбцы
    const rows = [], cols = [];
    for (let i = 0; i < BB.n; i++) {
      if (this.grid[i].every(Boolean)) rows.push(i);
      if (this.grid.every((row) => row[i])) cols.push(i);
    }
    const n = rows.length + cols.length;
    if (n) {
      for (const y of rows) for (let x = 0; x < BB.n; x++) this.clearCell(x, y);
      for (const x of cols) for (let y = 0; y < BB.n; y++) this.clearCell(x, y);
      this.combo++;
      this.lines += n;
      this.best = Math.max(this.best, n);
      this.score += n * 10 * this.combo;
      this.ch.hitBoss(BB.lineDmg * n * Math.min(2, 1 + 0.5 * (this.combo - 1)), n > 1 ? `${n} ЛИНИИ!` : this.combo > 1 ? `КОМБО ×${this.combo}` : 'BLAST!');
      if (n >= 3) Ach.unlock('blast');
      Sound.explosion(n > 1);
    } else this.combo = 0;
    if (this.tray.every((q) => q.used)) this.deal();
    if (!this.anyFits()) {
      this.ch.hint('Фигуры больше не влезают!', 2);
      this.ch.finish();
    }
  }

  clearCell(x, y) {
    if (!this.grid[y][x]) return;
    this.flash.push({ x, y, color: this.grid[y][x], t: 0 });
    this.grid[y][x] = null;
  }

  update(dt) {
    for (const f of this.flash) f.t += dt;
    this.flash = this.flash.filter((f) => f.t < 0.4);
    if (!this.ch.done && !this.ch.menu) {
      this.time -= dt;
      if (this.time <= 0) {
        this.time = 0;
        this.ch.finish();
      }
    }
  }

  result() {
    return { goal: this.lines >= BB.minLines };
  }

  draw(ctx, g, now) {
    const s = BB.size, n = BB.n, x0 = this.x0, y0 = this.y0;
    rr(ctx, x0 - 10, y0 - 10, n * s + 20, n * s + 20, 14);
    ctx.fillStyle = 'rgba(20,30,70,0.94)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#29b6f6';
    ctx.stroke();
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(x0 + c * s + 2, y0 + r * s + 2, s - 4, s - 4);
        if (this.grid[r][c]) drawBlock(ctx, x0 + c * s, y0 + r * s, s, this.grid[r][c]);
      }
    }
    for (const f of this.flash) {
      const k = f.t / 0.4;
      drawBlock(ctx, x0 + f.x * s - k * 6, y0 + f.y * s - k * 6, s + k * 12, '#fff', 1 - k);
    }
    // призрак фигуры под курсором
    if (this.sel >= 0 && !this.ch.done) {
      const t = this.tray[this.sel];
      const { c, r } = this.anchor(t.cells, Input.x, Input.y);
      const ok = this.fits(t.cells, c, r);
      if (Input.x > x0 - s && Input.x < x0 + (n + 1) * s && Input.y > y0 - s && Input.y < y0 + (n + 1) * s) {
        for (const [dx, dy] of t.cells) {
          const x = c + dx, y = r + dy;
          if (x >= 0 && y >= 0 && x < n && y < n) drawBlock(ctx, x0 + x * s, y0 + y * s, s, ok ? t.color : '#9e9e9e', 0.45);
        }
      }
    }
    if (!this.ch.done && !this.ch.menu) g.buttons.push({ x: x0, y: y0, w: n * s, h: n * s, action: () => this.drop(Input.x, Input.y) });
    // три фигуры справа
    panel(ctx, 900, 214, 330, 432);
    text(ctx, 'ФИГУРЫ', 1065, 246, { font: `14px ${FONT.pixel}`, color: '#ffd54a', align: 'center' });
    this.tray.forEach((t, i) => {
      const cy = 330 + i * 120;
      if (this.sel === i) {
        rr(ctx, 915, cy - 56, 300, 112, 12);
        ctx.fillStyle = 'rgba(41,182,246,0.25)';
        ctx.fill();
      }
      if (!t.used) {
        const w = Math.max(...t.cells.map((p) => p[0])) + 1, h = Math.max(...t.cells.map((p) => p[1])) + 1;
        const bs = Math.min(30, 100 / Math.max(w, h));
        for (const [dx, dy] of t.cells) drawBlock(ctx, 1065 - (w * bs) / 2 + dx * bs, cy - (h * bs) / 2 + dy * bs, bs, t.color);
      }
      if (!this.ch.done && !this.ch.menu && !t.used) g.buttons.push({ x: 915, y: cy - 56, w: 300, h: 112, action: () => this.pick(i) });
    });
    // счёт и время
    panel(ctx, 70, 214, 230, 432);
    text(ctx, 'ЛИНИИ', 185, 252, { font: `14px ${FONT.pixel}`, color: '#ffd54a', align: 'center' });
    text(ctx, String(this.lines), 185, 318, { font: `60px ${FONT.title}`, color: this.lines >= BB.minLines ? '#7ee05a' : '#fff', stroke: '#000', lw: 6, align: 'center' });
    text(ctx, `нужно хотя бы ${BB.minLines}`, 185, 346, { font: `bold 13px ${FONT.ui}`, color: '#e1d5f0', align: 'center' });
    text(ctx, 'ВРЕМЯ', 185, 400, { font: `14px ${FONT.pixel}`, color: '#ffd54a', align: 'center' });
    text(ctx, `${Math.ceil(this.time)}`, 185, 450, { font: `44px ${FONT.title}`, color: this.time < 15 ? '#ff5252' : '#fff', stroke: '#000', lw: 5, align: 'center' });
    if (this.combo > 1) text(ctx, `КОМБО ×${this.combo}`, 185, 500, { font: `24px ${FONT.gta}`, color: '#ffa726', stroke: '#000', lw: 5, align: 'center' });
    text(ctx, 'выбери фигуру,', 185, 580, { font: `bold 13px ${FONT.ui}`, color: '#e1d5f0', align: 'center' });
    text(ctx, 'потом место на поле', 185, 600, { font: `bold 13px ${FONT.ui}`, color: '#e1d5f0', align: 'center' });
  }
}

// ---------- общее ----------
const Challenge = {
  on: false,
  kind: '',
  last: '',
  g: null,
  game: null,
  done: false,
  ko: false,
  menu: false,
  dealt: 0, // сколько HP снято с босса
  hurt: 0,
  floats: [],
  taunt: '',
  tauntT: 0,
  hintStr: '',
  hintT: 0,

  // Какое испытание будет: каждый раз другое.
  pick() {
    const all = ['durak', 'match3', 'blast'].filter((k) => k !== this.last);
    return choice(all);
  },

  start(g, kind) {
    this.last = kind;
    if (kind === 'durak') return Durak.start(g, 'boss');
    this.on = true;
    this.kind = kind;
    this.g = g;
    this.done = false;
    this.ko = false;
    this.menu = false;
    this.dealt = 0;
    this.hurt = 0;
    this.floats = [];
    this.taunt = CH_INVITE[kind];
    this.tauntT = 3;
    this.hintT = 0;
    this.game = kind === 'match3' ? new Match3(this) : new Blast(this);
    g.state = 'challenge';
    Input.lmb = false;
    Sound.star();
  },

  stop() {
    this.on = false;
    this.game = null;
  },

  hint(str, t) {
    this.hintStr = str;
    this.hintT = t;
  },

  float(str, x, y, color) {
    this.floats.push({ str, x, y, color, t: 0 });
  },

  // Урон боссу в долях его HP.
  hitBoss(pct, label) {
    const g = this.g, tw = g.tower;
    // одно испытание снимает не больше CH_CAP от HP босса
    const left = Math.round(tw.max * CH_CAP) - this.dealt;
    if (tw.dead || pct <= 0 || left <= 0) return;
    const dmg = Math.min(left, Math.max(1, Math.round(tw.max * pct)));
    g.damageTower(dmg, false);
    this.dealt += dmg;
    this.float(`−${dmg}${label ? ' · ' + label : ''}`, 640, 196, '#ff5252');
    if (Math.random() < 0.35) {
      this.taunt = choice(['Ай!', 'Нечестно!', 'Это ещё не конец!', 'Мои короны!', 'Хватит!']);
      this.tauntT = 1.6;
    }
    if (tw.dead) {
      this.ko = true;
      this.done = true;
      Ach.unlock('cardko');
      Sound.win();
    }
  },

  // Испытание окончено: подводим итог.
  finish() {
    if (this.done) return;
    this.done = true;
    const r = this.game.result(), g = this.g;
    this.goal = r.goal;
    if (this.kind === 'match3' && r.goal) {
      this.hitBoss(M3.goalBonus, 'цель!');
      g.addMoney(M3.money);
      Ach.unlock('royal');
    }
    if (!r.goal) this.hurt += this.kind === 'match3' ? M3.fail : BB.fail;
    if (r.goal) Sound.win();
    else Sound.wasted();
    this.taunt = r.goal ? 'Ладно, ты силён…' : 'Ха! Слабак!';
    this.tauntT = 3;
  },

  exit(surrender = false) {
    const g = this.g;
    if (surrender) this.hurt += 3;
    this.on = false;
    g.state = 'play';
    g.suppressFire = true;
    Input.lmb = false;
    g.say(`${CH_NAMES[this.kind]}: −${this.dealt} HP боссу${this.hurt ? `, тебе −${this.hurt} ❤` : ''}`, this.hurt ? '#ff8a80' : '#ffd54a');
    if (this.hurt > 0) g.takeDamage(this.hurt, CH_NAMES[this.kind]);
    this.game = null;
  },

  update(dt) {
    if (this.tauntT > 0) this.tauntT -= dt;
    if (this.hintT > 0) this.hintT -= dt;
    for (const f of this.floats) f.t += dt;
    this.floats = this.floats.filter((f) => f.t < 1.4);
    if (this.game && !this.menu) this.game.update(dt);
  },

  onKey(code) {
    if (code === 'Escape') this.menu = !this.menu;
    else if ((code === 'Enter' || code === 'Space') && this.done) this.exit();
  },
};

// Полоска HP босса и его реплики — общие для испытаний.
function drawBossHeader(ctx, g, title, sub, taunt, tauntT) {
  text(ctx, title, 24, 40, { font: `30px ${FONT.title}`, color: '#ffd54a', stroke: '#000', lw: 5 });
  text(ctx, sub, 24, 64, { font: `bold 14px ${FONT.ui}`, color: '#ffcdd2' });
  const tw = g.tower, k = clamp(tw.hp / tw.max, 0, 1);
  text(ctx, tw.name, 640, 150, { font: `bold 18px ${FONT.ui}`, color: '#fff', align: 'center', stroke: 'rgba(0,0,0,0.6)', lw: 4 });
  rr(ctx, 490, 160, 300, 16, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fill();
  if (k > 0) {
    rr(ctx, 490, 160, 300 * k, 16, 8);
    ctx.fillStyle = '#e53935';
    ctx.fill();
  }
  text(ctx, `${Math.ceil(tw.hp)} / ${tw.max}`, 640, 173, { font: `bold 12px ${FONT.ui}`, color: '#fff', align: 'center' });
  if (tauntT > 0 && taunt) {
    ctx.font = `bold 17px ${FONT.ui}`;
    const w = ctx.measureText(taunt).width + 28;
    const x = Math.min(820, W - 16 - w);
    rr(ctx, x, 96, w, 40, 12);
    ctx.fillStyle = '#fff';
    ctx.fill();
    poly(ctx, [x + 14, 130, x - 8, 146, x + 32, 134], '#fff');
    text(ctx, taunt, x + 14, 122, { font: `bold 17px ${FONT.ui}`, color: '#111' });
  }
}

function renderChallenge(ctx, g, now) {
  const C = Challenge;
  g.buttons = [];
  ctx.fillStyle = 'rgba(12,4,24,0.8)';
  ctx.fillRect(0, 0, W, H);
  const sub = C.kind === 'match3'
    ? `каждая фишка бьёт босса, корона — вдвое; собери ${M3.goal} корон за ${M3.moves} ходов`
    : `каждая собранная линия — −${Math.round(BB.lineDmg * 100)}% HP босса, комбо сильнее; собери ${BB.minLines}+ линии`;
  drawBossHeader(ctx, g, CH_NAMES[C.kind], sub, C.taunt, C.tauntT);
  mcButton(ctx, g, 'МЕНЮ', 1130, 14, 130, 40, () => (C.menu = true), { size: 11 });
  if (C.game) C.game.draw(ctx, g, now);
  drawFx(ctx, g);
  for (const f of C.floats) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - f.t / 1.4);
    text(ctx, f.str, f.x, f.y - f.t * 40, { font: `30px ${FONT.gta}`, color: f.color, stroke: '#000', lw: 6, align: 'center' });
    ctx.restore();
  }
  if (C.hintT > 0) text(ctx, C.hintStr, 640, 700, { font: `bold 18px ${FONT.ui}`, color: '#ffcc80', align: 'center', stroke: '#000', lw: 4 });
  if (C.done) {
    g.buttons = [];
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    const title = C.ko ? 'БОСС ПОВЕРЖЕН!' : C.goal ? 'ИСПЫТАНИЕ ПРОЙДЕНО!' : 'ПРОВАЛ!';
    text(ctx, title, 640, 300, { font: `64px ${FONT.title}`, color: C.ko || C.goal ? '#ffd54a' : '#ff5252', stroke: '#000', lw: 9, align: 'center' });
    const lines = [`Урон боссу: −${C.dealt} HP`];
    if (C.kind === 'match3' && C.goal) lines.push(`Цель выполнена: +$${M3.money}`);
    if (C.hurt) lines.push(`Тебе: −${C.hurt} ❤`);
    lines.forEach((s, i) => text(ctx, s, 640, 350 + i * 30, { font: `bold 22px ${FONT.ui}`, color: '#fff', align: 'center' }));
    mcButton(ctx, g, 'В БОЙ!', 540, 350 + lines.length * 30 + 10, 200, 54, () => C.exit(), { size: 16, fill: '#c62828' });
  }
  if (C.menu && !C.done) {
    g.buttons = [];
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'ПАУЗА', 640, 220, { font: `56px ${FONT.title}`, color: '#fff', stroke: '#000', lw: 8, align: 'center' });
    mcButton(ctx, g, 'ПРОДОЛЖИТЬ', 480, 260, 320, 46, () => (C.menu = false));
    mcButton(ctx, g, 'СДАТЬСЯ (−3 ❤)', 480, 316, 320, 46, () => {
      C.menu = false;
      C.exit(true);
    });
    mcButton(ctx, g, Music.on ? 'МУЗЫКА: ВКЛ' : 'МУЗЫКА: ВЫКЛ', 480, 372, 320, 40, () => Music.toggle(), { size: 11 });
  }
}

// Частицы поверх испытания (сама доска в это время стоит).
function drawFx(ctx, g) {
  for (const p of g.particles) {
    ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.6);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}
