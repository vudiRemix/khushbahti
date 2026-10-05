'use strict';
/* Шахматная доска (фон) и логика поля «Сапёра». */

const Board = {
  canvas: null,
  key: '',
  LIGHT: '#eeeed2',
  DARK: '#769656',

  // Фон рисуется один раз в отдельный холст под текущее разрешение экрана.
  get(view) {
    const key = view.pw + 'x' + view.ph;
    if (this.canvas && this.key === key) return this.canvas;
    const c = this.canvas || document.createElement('canvas');
    c.width = view.pw;
    c.height = view.ph;
    const ctx = c.getContext('2d');
    ctx.setTransform(view.k, 0, 0, view.k, 0, 0);
    this.paint(ctx);
    this.canvas = c;
    this.key = key;
    return c;
  },

  paint(ctx) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? this.LIGHT : this.DARK;
        ctx.fillRect(c * T, r * T, T, T);
      }
    }
    // лёгкая виньетка, чтобы края не спорили с интерфейсом
    const g = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 820);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // чёрные фигуры — тыл короля
    const back = [[4, 'r'], [5, 'n'], [10, 'b'], [11, 'r']];
    for (const [c, k] of back) drawPiece(ctx, k, false, colX(c), rowY(0) + 2, 68);
    for (const c of [4, 5, 10, 11]) drawPiece(ctx, 'p', false, colX(c), rowY(1), 60);
    // белые фигуры у игрока
    const wb = [[0, 'n'], [1, 'b'], [2, 'r'], [3, 'q'], [12, 'k'], [13, 'r'], [14, 'b'], [15, 'n']];
    for (const [c, k] of wb) drawPiece(ctx, k, true, colX(c), rowY(8) - 4, 64);
    // рамка поля сапёра
    const x = MF.c0 * T, y = MF.r0 * T, w = MF.cols * T, h = MF.rows * T;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x - 3, y + h, w + 6, 6);
    ctx.fillStyle = '#7b7b7b';
    ctx.fillRect(x - 4, y - 4, w + 8, 4);
    ctx.fillRect(x - 4, y - 4, 4, h + 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 4, y + h, w + 8, 4);
    ctx.fillRect(x + w, y - 4, 4, h + 8);
  },
};

// Состояния клетки
const HIDDEN = 0, OPEN = 1, FLAG = 2, BOOM = 3;

class Minefield {
  constructor(mines) {
    this.reset(mines);
  }

  reset(mines) {
    this.mines = mines;
    this.cells = [];
    for (let i = 0; i < MF.cols * MF.rows; i++) this.cells.push({ mine: false, adj: 0, s: HIDDEN, anim: 1, pop: 0 });
    this.generated = false;
    this.done = false;
    this.time = 0;
  }

  // Анимация «перестройки» поля после зачистки.
  rebuild(mines) {
    this.reset(mines);
    for (let r = 0; r < MF.rows; r++) for (let c = 0; c < MF.cols; c++) this.cell(c, r).pop = -(c + r) * 0.04;
  }

  inside(c, r) {
    return c >= 0 && r >= 0 && c < MF.cols && r < MF.rows;
  }
  cell(c, r) {
    return this.inside(c, r) ? this.cells[r * MF.cols + c] : null;
  }
  at(x, y) {
    const c = toCol(x) - MF.c0, r = toRow(y) - MF.r0;
    return this.inside(c, r) ? { c, r, cell: this.cell(c, r) } : null;
  }
  center(c, r) {
    return { x: colX(c + MF.c0), y: rowY(r + MF.r0) };
  }
  neighbors(c, r) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if ((dr || dc) && this.inside(c + dc, r + dr)) out.push([c + dc, r + dr]);
      }
    }
    return out;
  }

  // Мины расставляются после первого хода: первая клетка и её соседи всегда безопасны.
  generate(sc, sr) {
    const free = [];
    for (let r = 0; r < MF.rows; r++) {
      for (let c = 0; c < MF.cols; c++) {
        if (Math.abs(c - sc) <= 1 && Math.abs(r - sr) <= 1) continue;
        free.push([c, r]);
      }
    }
    shuffle(free);
    for (let i = 0; i < Math.min(this.mines, free.length); i++) this.cell(free[i][0], free[i][1]).mine = true;
    for (let r = 0; r < MF.rows; r++) {
      for (let c = 0; c < MF.cols; c++) {
        this.cell(c, r).adj = this.neighbors(c, r).filter(([nc, nr]) => this.cell(nc, nr).mine).length;
      }
    }
    this.generated = true;
  }

  // Открыть клетку. Возвращает список открытых клеток и признак мины.
  open(c, r) {
    if (!this.generated) this.generate(c, r);
    const start = this.cell(c, r);
    const res = { opened: [], mine: null };
    if (!start || start.s !== HIDDEN) return res;
    if (start.mine) {
      start.s = BOOM;
      res.mine = { c, r };
      return res;
    }
    const queue = [[c, r]];
    while (queue.length) {
      const [qc, qr] = queue.pop();
      const cell = this.cell(qc, qr);
      if (cell.s !== HIDDEN || cell.mine) continue;
      cell.s = OPEN;
      cell.anim = 0;
      res.opened.push({ c: qc, r: qr });
      if (cell.adj === 0) {
        for (const [nc, nr] of this.neighbors(qc, qr)) if (this.cell(nc, nr).s === HIDDEN) queue.push([nc, nr]);
      }
    }
    return res;
  }

  // «Аккорд»: если вокруг числа стоит столько же флажков, открыть остальных соседей.
  chord(c, r) {
    const cell = this.cell(c, r);
    const res = { opened: [], mines: [] };
    if (!cell || cell.s !== OPEN || cell.adj === 0) return res;
    const nb = this.neighbors(c, r);
    const marked = nb.filter(([nc, nr]) => {
      const s = this.cell(nc, nr).s;
      return s === FLAG || s === BOOM;
    }).length;
    if (marked !== cell.adj) return res;
    for (const [nc, nr] of nb) {
      if (this.cell(nc, nr).s !== HIDDEN) continue;
      const o = this.open(nc, nr);
      res.opened.push(...o.opened);
      if (o.mine) res.mines.push(o.mine);
    }
    return res;
  }

  toggleFlag(c, r) {
    const cell = this.cell(c, r);
    if (!cell) return null;
    if (cell.s === HIDDEN) cell.s = FLAG;
    else if (cell.s === FLAG) cell.s = HIDDEN;
    else return null;
    return cell.s;
  }

  detonate(c, r) {
    const cell = this.cell(c, r);
    if (cell) cell.s = BOOM;
  }

  count(fn) {
    let n = 0;
    for (const cell of this.cells) if (fn(cell)) n++;
    return n;
  }
  get flags() {
    return this.count((c) => c.s === FLAG);
  }
  get booms() {
    return this.count((c) => c.s === BOOM);
  }
  get minesLeft() {
    return this.mines - this.flags - this.booms;
  }
  liveMines() {
    const out = [];
    for (let r = 0; r < MF.rows; r++) for (let c = 0; c < MF.cols; c++) {
      const cell = this.cell(c, r);
      if (cell.mine && cell.s !== BOOM) out.push({ c, r });
    }
    return out;
  }
  isCleared() {
    return this.generated && this.count((c) => !c.mine && c.s !== OPEN) === 0;
  }

  update(dt) {
    if (this.generated && !this.done) this.time += dt;
    for (const cell of this.cells) {
      if (cell.anim < 1) cell.anim = Math.min(1, cell.anim + dt * 5);
      if (cell.pop < 1) cell.pop = Math.min(1, cell.pop + dt * 2.5);
    }
  }

  draw(ctx, hover, t) {
    const x0 = MF.c0 * T, y0 = MF.r0 * T;
    for (let r = 0; r < MF.rows; r++) {
      for (let c = 0; c < MF.cols; c++) {
        const cell = this.cell(c, r);
        const x = x0 + c * T, y = y0 + r * T;
        const pop = Math.max(0, cell.pop);
        if (pop < 1) {
          // поле собирается заново — клетки «вырастают»
          if (pop <= 0) continue;
          ctx.save();
          ctx.translate(x + T / 2, y + T / 2);
          ctx.scale(easeOutCubic(pop), easeOutCubic(pop));
          ctx.translate(-T / 2, -T / 2);
          this.drawHidden(ctx, 0, 0, false);
          ctx.restore();
          continue;
        }
        if (cell.s === OPEN || cell.s === BOOM) {
          ctx.fillStyle = cell.s === BOOM ? '#e86a5a' : '#d9d9d9';
          ctx.fillRect(x, y, T, T);
          ctx.strokeStyle = '#9e9e9e';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
          if (cell.s === BOOM) {
            circ(ctx, x + T / 2, y + T / 2, 30, 'rgba(40,20,10,0.35)');
            drawMine(ctx, x + T / 2, y + T / 2, 15);
          } else if (cell.adj > 0) {
            drawMsDigit(ctx, cell.adj, x + T / 2, y + T / 2, 5);
          }
          if (cell.anim < 1) {
            // исчезающая крышка клетки
            const k = cell.anim;
            ctx.save();
            ctx.globalAlpha = 1 - k;
            ctx.translate(x + T / 2, y + T / 2);
            ctx.scale(1 - k * 0.4, 1 - k * 0.4);
            ctx.translate(-T / 2, -T / 2);
            this.drawHidden(ctx, 0, 0, false);
            ctx.restore();
          }
        } else {
          const hov = hover && hover.c === c && hover.r === r;
          this.drawHidden(ctx, x, y, hov);
          if (cell.s === FLAG) drawFlag(ctx, x + T / 2 + 2, y + T / 2 - 2, 1.5);
        }
      }
    }
  }

  // Закрытая клетка в стиле классического «Сапёра» (выпуклая).
  drawHidden(ctx, x, y, hover) {
    ctx.fillStyle = hover ? '#d8d8d8' : '#c3c3c3';
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, T, 6);
    ctx.fillRect(x, y, 6, T);
    ctx.fillStyle = '#7b7b7b';
    ctx.fillRect(x, y + T - 6, T, 6);
    ctx.fillRect(x + T - 6, y, 6, T);
    ctx.fillStyle = '#a8a8a8';
    ctx.fillRect(x + T - 6, y, 6, 6);
    ctx.fillRect(x, y + T - 6, 6, 6);
  }
}
