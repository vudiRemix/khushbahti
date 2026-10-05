'use strict';
/* Вся графика рисуется кодом — никаких картинок.
   Здесь функции рисования персонажей, предметов и элементов интерфейса. */

// ---------- базовые примитивы ----------
function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function ell(ctx, x, y, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, TAU);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
}
function circ(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, Math.abs(r), 0, TAU);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
}
function poly(ctx, pts, fill, stroke, lw) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  if (stroke) {
    ctx.lineWidth = lw || 2;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
}
function line(ctx, x1, y1, x2, y2, color, lw) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw || 1;
  ctx.stroke();
}
function text(ctx, str, x, y, o = {}) {
  ctx.font = o.font || `16px ${FONT.ui}`;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'alphabetic';
  if (o.stroke) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = o.lw || 4;
    ctx.strokeStyle = o.stroke;
    ctx.strokeText(str, x, y);
  }
  if (o.shadow) {
    ctx.fillStyle = o.shadow;
    ctx.fillText(str, x + (o.sx || 2), y + (o.sy || 2));
  }
  ctx.fillStyle = o.color || '#fff';
  ctx.fillText(str, x, y);
}

// ---------- пиксель-арт ----------
function compilePixel(rows, pal) {
  const groups = new Map();
  let w = 0;
  rows.forEach((row, y) => {
    w = Math.max(w, row.length);
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]];
      if (!col) continue;
      if (!groups.has(col)) groups.set(col, new Path2D());
      groups.get(col).rect(x, y, 1, 1);
    }
  });
  return { w, h: rows.length, layers: [...groups.entries()] };
}
function drawPixel(ctx, art, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  for (const [c, p] of art.layers) {
    ctx.fillStyle = c;
    ctx.fill(p);
  }
  ctx.restore();
}

const PIX = {
  steak: compilePixel([
    '............',
    '....kkkk....',
    '..kkbbbbkk..',
    '.kbbrrbbbbk.',
    '.kbrbbbbrbk.',
    'kbbbbbbbbbbk',
    'kbbrbbbbbbbk',
    '.kbbbbbrbbk.',
    '..kbbbbbbkw.',
    '...kkbbbkwWk',
    '.....kkk.kk.',
    '............',
  ], { k: '#3b1d0e', b: '#8f4b2a', r: '#b8683e', w: '#e6dcc8', W: '#ffffff' }),
  gapple: compilePixel([
    '......kG....',
    '.....k.GG...',
    '...yyky.....',
    '..yYYyyyy...',
    '.yYYyyyyyy..',
    '.yYyyyyyyyo.',
    '.yyyyyyyyyo.',
    '.yyyyyyyyoo.',
    '..yyyyyyoo..',
    '..oyyyyooo..',
    '...oo..oo...',
    '............',
  ], { y: '#f7cf2a', Y: '#fff6a8', o: '#c48d00', k: '#5a3a10', G: '#3fa34d' }),
  potion: compilePixel([
    '....kkkk....',
    '....kwwk....',
    '.....kk.....',
    '.....kk.....',
    '....kWpk....',
    '...kWpppk...',
    '..kWppppPk..',
    '..kpppppPk..',
    '..kpppppPk..',
    '...kpppPk...',
    '....kkkk....',
    '............',
  ], { k: '#2a2a3a', w: '#c8a070', W: '#ffffff', p: '#f05aa8', P: '#c2307a' }),
  totem: compilePixel([
    '...yyyyyy...',
    '...yGyyGy...',
    '...yyyyyy...',
    '....yooy....',
    '.yyyyyyyyyy.',
    'yy.yoyyoy.yy',
    'y..yyyyyy..y',
    '...yoyyoy...',
    '....yyyy....',
    '....yGGy....',
    '.....yy.....',
    '............',
  ], { y: '#f2c230', o: '#b7861a', G: '#2fa84f' }),
  heart: compilePixel([
    '.kk.kk.',
    'krrkrrk',
    'krwrrrk',
    'krrrrrk',
    '.krrrk.',
    '..krk..',
    '...k...',
  ], { k: '#1a0000', r: '#e01b1b', w: '#ffd0d0' }),
  heartEmpty: compilePixel([
    '.kk.kk.',
    'keekeek',
    'keeeeek',
    'keeeeek',
    '.keeek.',
    '..kek..',
    '...k...',
  ], { k: '#1a0000', e: '#3d1414' }),
  food: compilePixel([
    '...kkk.',
    '..kmmmk',
    '.kmMmmk',
    '.kmmmmk',
    'kbkmmk.',
    'kbbkk..',
    '.kk....',
  ], { k: '#2e1608', m: '#a65a2a', M: '#d7894a', b: '#ece4d4' }),
  foodEmpty: compilePixel([
    '...kkk.',
    '..keeek',
    '.keeeek',
    '.keeeek',
    'kekeek.',
    'keekk..',
    '.kk....',
  ], { k: '#2e1608', e: '#3a2a1e' }),
};

// Цифры сапёра 1..8 (8×8 пикселей, как в классическом «Сапёре»).
const MS_DIGITS = {
  1: ['...##...', '..###...', '.####...', '...##...', '...##...', '...##...', '...##...', '.######.'],
  2: ['.######.', '##....##', '......##', '..#####.', '.##.....', '##......', '##......', '########'],
  3: ['.######.', '##....##', '......##', '...####.', '......##', '......##', '##....##', '.######.'],
  4: ['....###.', '...####.', '..##.##.', '.##..##.', '##...##.', '########', '.....##.', '.....##.'],
  5: ['########', '##......', '##......', '#######.', '......##', '......##', '##....##', '.######.'],
  6: ['.######.', '##....##', '##......', '#######.', '##....##', '##....##', '##....##', '.######.'],
  7: ['########', '##....##', '.....##.', '....##..', '...##...', '...##...', '...##...', '...##...'],
  8: ['.######.', '##....##', '##....##', '.######.', '##....##', '##....##', '##....##', '.######.'],
};
const MS_COLORS = { 1: '#1a1aff', 2: '#118a11', 3: '#ee1c1c', 4: '#0b0b7a', 5: '#7d0a0a', 6: '#0a7d7d', 7: '#111', 8: '#777' };
const MS_ART = {};
for (const n in MS_DIGITS) MS_ART[n] = compilePixel(MS_DIGITS[n], { '#': MS_COLORS[n] });

function drawMsDigit(ctx, n, cx, cy, s = 5) {
  drawPixel(ctx, MS_ART[n], cx - 4 * s, cy - 4 * s, s);
}

// ---------- шахматные фигуры ----------
const PIECE_SVG = {
  p: 'M50 14a14 14 0 1 1 0 28a14 14 0 1 1 0-28Z M38 44H62L59 50H56Q57 66 67 77L72 84V92H28V84L33 77Q43 66 44 50H41Z',
  r: 'M28 92H72V84L66 79L62 45L68 40V20H60V27H54V20H46V27H40V20H32V40L38 45L34 79L28 84Z',
  n: 'M30 92H72V84L67 79Q72 55 66 38Q60 20 44 15L42 8L36 16Q28 21 25 33L17 48Q15 56 22 58L29 55Q36 52 42 49Q37 62 30 71L34 79L30 84Z',
  b: 'M50 6a6 6 0 1 1 0 12a6 6 0 1 1 0-12Z M50 18Q68 30 62 50L58 53L62 58H38L42 53L38 50Q32 30 50 18Z M41 60H59Q58 70 67 79L72 84V92H28V84L33 79Q42 70 41 60Z',
  q: 'M28 92H72V84L66 79Q60 64 63 50L75 28L61 40L58 20L50 38L42 20L39 40L25 28L37 50Q40 64 34 79L28 84Z',
  k: 'M47 4H53V11H60V17H53V24H47V17H40V11H47Z M28 92H72V84L66 79Q60 64 66 48Q74 32 61 29Q53 28 50 37Q47 28 39 29Q26 32 34 48Q40 64 34 79L28 84Z',
};
const _piecePaths = {};
function piecePath(k) {
  if (!_piecePaths[k]) _piecePaths[k] = new Path2D(PIECE_SVG[k]);
  return _piecePaths[k];
}
function drawPiece(ctx, kind, white, x, y, size = 72, o = {}) {
  const s = size / 100;
  ctx.save();
  ctx.translate(x, y + size * 0.5);
  ctx.scale(s, s);
  ctx.translate(-50, -96);
  if (o.shadow !== false) ell(ctx, 50, 92, 26, 6, 'rgba(0,0,0,0.25)');
  const p = piecePath(kind);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = white ? '#2a2a2a' : '#050505';
  ctx.stroke(p);
  let fill;
  if (o.tint) fill = o.tint;
  else {
    fill = ctx.createLinearGradient(25, 0, 75, 0);
    if (white) {
      fill.addColorStop(0, '#ffffff');
      fill.addColorStop(1, '#cdcdc4');
    } else {
      fill.addColorStop(0, '#5c5c5c');
      fill.addColorStop(0.45, '#2b2b2b');
      fill.addColorStop(1, '#0e0e0e');
    }
  }
  ctx.fillStyle = fill;
  ctx.fill(p);
  const detail = white ? '#3a3a3a' : '#9a9a9a';
  if (kind === 'n') circ(ctx, 34, 30, 3, detail);
  if (kind === 'b') line(ctx, 55, 28, 46, 41, detail, 3);
  if (kind === 'q') {
    for (const [bx, by] of [[25, 27], [42, 19], [58, 19], [75, 27]]) {
      circ(ctx, bx, by, 5.5, white ? '#2a2a2a' : '#050505');
      circ(ctx, bx, by, 3.5, white ? '#f4f4f4' : '#3a3a3a');
    }
  }
  ctx.restore();
}

// ---------- королевская башня (босс) ----------
function drawCrown(ctx, x, y, s, fill = '#ffcc33') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  poly(ctx, [-12, 6, -14, -8, -6, -1, 0, -11, 6, -1, 14, -8, 12, 6], fill, '#7a4d00', 3);
  poly(ctx, [-12, 6, -14, -8, -6, -1, 0, -11, 6, -1, 14, -8, 12, 6], fill);
  circ(ctx, 0, 1, 2.6, '#e53935');
  ctx.restore();
}

function drawKing(ctx, x, y, t, o) {
  ctx.save();
  ctx.translate(x, y);
  const bob = Math.sin(t * 2) * 1.5;
  // мантия
  ctx.beginPath();
  ctx.arc(0, 40 + bob, 36, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = '#c62828';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffd54f';
  ctx.beginPath();
  ctx.arc(0, 40 + bob, 34, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  // голова
  const hy = 6 + bob;
  circ(ctx, 0, hy, 21, '#f4c28f');
  // борода
  ctx.beginPath();
  ctx.moveTo(-20, hy + 2);
  ctx.quadraticCurveTo(-18, hy + 34, 0, hy + 38);
  ctx.quadraticCurveTo(18, hy + 34, 20, hy + 2);
  ctx.quadraticCurveTo(10, hy + 14, 0, hy + 12);
  ctx.quadraticCurveTo(-10, hy + 14, -20, hy + 2);
  ctx.fillStyle = '#7a4a24';
  ctx.fill();
  // усы
  ell(ctx, -7, hy + 9, 8, 3.5, '#5d3518');
  ell(ctx, 7, hy + 9, 8, 3.5, '#5d3518');
  // глаза
  const angry = o.rage > 0.5;
  ell(ctx, -7, hy - 2, 3.2, 4, '#fff');
  ell(ctx, 7, hy - 2, 3.2, 4, '#fff');
  circ(ctx, -6.5, hy - 1, 1.8, '#222');
  circ(ctx, 7.5, hy - 1, 1.8, '#222');
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#5d3518';
  ctx.beginPath();
  ctx.moveTo(-12, hy - (angry ? 9 : 8));
  ctx.lineTo(-3, hy - (angry ? 5 : 8));
  ctx.moveTo(12, hy - (angry ? 9 : 8));
  ctx.lineTo(3, hy - (angry ? 5 : 8));
  ctx.stroke();
  if (o.laugh > 0) {
    ell(ctx, 0, hy + 14, 7, 5 + Math.abs(Math.sin(t * 18)) * 3, '#5a0d0d');
  }
  // корона
  poly(ctx, [-17, hy - 12, -19, hy - 32, -9, hy - 22, 0, hy - 36, 9, hy - 22, 19, hy - 32, 17, hy - 12], '#ffcc33', '#8a5a00', 3);
  poly(ctx, [-17, hy - 12, -19, hy - 32, -9, hy - 22, 0, hy - 36, 9, hy - 22, 19, hy - 32, 17, hy - 12], '#ffcc33');
  circ(ctx, 0, hy - 19, 3.5, '#e53935');
  // руки на пушке
  circ(ctx, -26, 52 + bob, 7, '#f4c28f');
  circ(ctx, 26, 52 + bob, 7, '#f4c28f');
  ctx.restore();
}

function drawTower(ctx, cx, t, o) {
  ctx.save();
  if (o.hit > 0) ctx.translate(rand(-4, 4) * o.hit * 6, rand(-2, 2) * o.hit * 6);
  ctx.translate(cx, 0);
  ell(ctx, 0, 162, 150, 14, 'rgba(0,0,0,0.3)');
  // угловые башенки
  for (const sx of [-1, 1]) {
    ctx.save();
    ctx.translate(sx * 112, 0);
    const g = ctx.createLinearGradient(-30, 0, 30, 0);
    g.addColorStop(0, '#80838f');
    g.addColorStop(1, '#a9acb9');
    rr(ctx, -30, 34, 60, 110, 8);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#4b4d58';
    ctx.stroke();
    rr(ctx, -33, 22, 66, 24, 7);
    ctx.fillStyle = '#d8332f';
    ctx.fill();
    ctx.stroke();
    rr(ctx, -27, 25, 54, 7, 3);
    ctx.fillStyle = '#ff6a5a';
    ctx.fill();
    ctx.restore();
  }
  // основной каменный блок
  const g = ctx.createLinearGradient(-135, 0, 135, 0);
  g.addColorStop(0, '#7c7f8e');
  g.addColorStop(0.5, '#b3b6c4');
  g.addColorStop(1, '#6f7282');
  rr(ctx, -125, 58, 250, 104, 10);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#4b4d58';
  ctx.stroke();
  // кладка
  ctx.save();
  rr(ctx, -125, 58, 250, 104, 10);
  ctx.clip();
  ctx.strokeStyle = 'rgba(40,40,60,0.35)';
  ctx.lineWidth = 2;
  for (let row = 0; row < 5; row++) {
    const yy = 58 + row * 21;
    line(ctx, -125, yy, 125, yy, 'rgba(40,40,60,0.35)', 2);
    for (let i = 0; i < 9; i++) {
      const xx = -125 + (i + (row % 2) * 0.5) * 32;
      line(ctx, xx, yy, xx, yy + 21, 'rgba(40,40,60,0.35)', 2);
    }
  }
  ctx.restore();
  // платформа короля
  rr(ctx, -70, 50, 140, 16, 6);
  ctx.fillStyle = '#5a5d6b';
  ctx.fill();
  drawKing(ctx, 0, 8, t, o);
  // пушка, смотрящая на игрока
  const recoil = o.fire > 0 ? -o.fire * 8 : 0;
  const cg = ctx.createLinearGradient(-22, 0, 22, 0);
  cg.addColorStop(0, '#2a2a2e');
  cg.addColorStop(0.5, '#6b6b74');
  cg.addColorStop(1, '#222226');
  rr(ctx, -22, 56 + recoil, 44, 42, 10);
  ctx.fillStyle = cg;
  ctx.fill();
  ell(ctx, 0, 98 + recoil, 24, 11, '#3c3c44');
  ell(ctx, 0, 98 + recoil, 16, 7, '#050505');
  // табличка с короной
  rr(ctx, -40, 108, 80, 30, 8);
  ctx.fillStyle = '#273a7a';
  ctx.fill();
  ctx.strokeStyle = '#ffcc33';
  ctx.lineWidth = 3;
  ctx.stroke();
  drawCrown(ctx, 0, 124, 1.3);
  // полоса здоровья в стиле Clash Royale
  const bw = 190;
  rr(ctx, -bw / 2, 142, bw, 16, 5);
  ctx.fillStyle = '#2a1414';
  ctx.fill();
  if (o.hpRatio > 0) {
    rr(ctx, -bw / 2 + 2, 144, (bw - 4) * o.hpRatio, 12, 4);
    ctx.fillStyle = '#e53935';
    ctx.fill();
    rr(ctx, -bw / 2 + 2, 144, (bw - 4) * o.hpRatio, 4, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
  }
  drawCrown(ctx, -bw / 2 - 6, 150, 0.95);
  text(ctx, String(Math.ceil(o.hp)), 0, 155, { font: `bold 13px ${FONT.ui}`, align: 'center', stroke: '#000', lw: 3 });
  // трещины, когда башня слабеет
  if (o.hpRatio < 0.66) {
    ctx.strokeStyle = 'rgba(30,30,40,0.7)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-90, 70);
    ctx.lineTo(-76, 92);
    ctx.lineTo(-84, 110);
    ctx.lineTo(-70, 128);
    if (o.hpRatio < 0.33) {
      ctx.moveTo(80, 64);
      ctx.lineTo(70, 84);
      ctx.lineTo(86, 100);
      ctx.moveTo(-20, 160);
      ctx.lineTo(-8, 144);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- враги ----------
function drawZombie(ctx, x, y, t, o = {}) {
  const s = o.scale || 0.82;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const ph = t * 5;
  const step = o.walking ? Math.sin(ph) : 0;
  ell(ctx, 0, 40, 24, 7, 'rgba(0,0,0,0.25)');
  // ноги
  ctx.fillStyle = '#4b3d30';
  rr(ctx, -13, 12 + step * 3, 10, 26, 3);
  ctx.fill();
  rr(ctx, 3, 12 - step * 3, 10, 26, 3);
  ctx.fill();
  ell(ctx, -9, 39 + step * 3, 8, 4, '#1e1a16');
  ell(ctx, 9, 39 - step * 3, 8, 4, '#1e1a16');
  // пиджак
  rr(ctx, -18, -14, 36, 32, 6);
  ctx.fillStyle = '#6d4c2f';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#3e2a18';
  ctx.stroke();
  poly(ctx, [-7, -14, 7, -14, 0, 6], '#f0ece0');
  poly(ctx, [0, -12, -3, -4, 0, 9, 3, -4], '#c62828');
  // руки вперёд
  const arm = o.eating ? Math.sin(t * 14) * 4 : Math.sin(ph) * 2;
  ctx.fillStyle = '#6d4c2f';
  rr(ctx, -27, -10 + arm, 10, 22, 4);
  ctx.fill();
  rr(ctx, 17, -10 - arm, 10, 22, 4);
  ctx.fill();
  circ(ctx, -22, 14 + arm, 6, '#9fb48a');
  circ(ctx, 22, 14 - arm, 6, '#9fb48a');
  // голова
  const hy = -32 + (o.eating ? Math.abs(Math.sin(t * 14)) * 3 : 0);
  ell(ctx, 0, hy, 16, 17, '#b9c9a5');
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#6f7f60';
  ctx.stroke();
  circ(ctx, -6, hy - 3, 5.5, '#fff');
  circ(ctx, 6, hy - 2, 4.2, '#fff');
  circ(ctx, -5, hy - 2, 1.8, '#111');
  circ(ctx, 7, hy - 1, 1.5, '#111');
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-7, hy + 8);
  ctx.quadraticCurveTo(0, hy + (o.eating ? 13 : 10), 8, hy + 7);
  ctx.stroke();
  ctx.fillStyle = '#f5f5e8';
  ctx.fillRect(1, hy + 8, 3, 3);
  // волоски
  line(ctx, -3, hy - 16, -6, hy - 22, '#333', 1.5);
  line(ctx, 2, hy - 16, 3, hy - 23, '#333', 1.5);
  if (o.cone) {
    ctx.save();
    ctx.translate(2, hy - 12);
    ctx.rotate(0.15);
    poly(ctx, [-16, 2, 16, 2, 3, -40], '#f08a24', '#a3500e', 2.5);
    poly(ctx, [-16, 2, 16, 2, 3, -40], '#f08a24');
    poly(ctx, [-11, -10, 12, -10, 9, -18, -7, -18], '#ffb35c');
    ell(ctx, 0, 2, 18, 4, '#d9701a');
    ctx.restore();
  }
  ctx.restore();
}

function drawFreddy(ctx, x, y, t, o = {}) {
  const s = o.scale || 0.85;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const body = '#c9a92c', dark = '#6b5510', light = '#e3cc6a';
  if (!o.face) {
    ell(ctx, 0, 40, 22, 6, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = body;
    rr(ctx, -14, 16, 11, 22, 4);
    ctx.fill();
    rr(ctx, 3, 16, 11, 22, 4);
    ctx.fill();
    ell(ctx, -9, 39, 8, 4, dark);
    ell(ctx, 9, 39, 8, 4, dark);
    ell(ctx, 0, 2, 18, 19, body);
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark;
    ctx.stroke();
    ell(ctx, 0, 6, 11, 12, light);
    ctx.fillStyle = body;
    rr(ctx, -28, -10, 10, 28, 5);
    ctx.fill();
    rr(ctx, 18, -10, 10, 28, 5);
    ctx.fill();
    circ(ctx, -23, 19, 6, body);
    circ(ctx, 23, 19, 6, body);
  }
  // голова
  for (const ex of [-15, 15]) {
    circ(ctx, ex, -48, 7, body);
    circ(ctx, ex, -48, 3.5, dark);
  }
  ell(ctx, 0, -32, 19, 17, body);
  ctx.lineWidth = 2;
  ctx.strokeStyle = dark;
  ctx.stroke();
  ell(ctx, 0, -24, 10, 7, light);
  ell(ctx, 0, -28, 3.5, 2.5, '#1a1a1a');
  ell(ctx, -7, -35, 4.5, 5, '#050505');
  ell(ctx, 7, -35, 4.5, 5, '#050505');
  if (o.glow) {
    circ(ctx, -7, -35, 1.4, '#fff');
    circ(ctx, 7, -35, 1.4, '#fff');
  }
  if (o.scream) {
    ell(ctx, 0, -17, 9, 6, '#1a0505');
    ctx.fillStyle = '#eee';
    for (let i = -3; i <= 3; i++) ctx.fillRect(i * 2.4 - 1, -22, 1.6, 3);
  } else {
    line(ctx, -6, -19, 6, -19, '#3a2c06', 1.5);
    ctx.fillStyle = '#f2ead0';
    for (let i = -2; i <= 2; i++) ctx.fillRect(i * 2.4 - 0.8, -19, 1.6, 2);
  }
  // шляпа и бабочка
  ctx.fillStyle = '#111';
  ctx.fillRect(-7, -61, 14, 11);
  ctx.fillRect(-11, -51, 22, 3);
  if (!o.face) {
    poly(ctx, [-9, -16, -9, -7, 0, -11.5], '#111');
    poly(ctx, [9, -16, 9, -7, 0, -11.5], '#111');
    circ(ctx, 0, -11.5, 2.2, '#111');
  }
  ctx.restore();
}

function drawPac(ctx, x, y, r, dir, mouth, color = '#ffe600') {
  const a = 0.04 + Math.abs(Math.sin(mouth)) * 0.62;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dir);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r, a, TAU - a);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#a88b00';
  ctx.stroke();
  circ(ctx, r * 0.12, -r * 0.55, r * 0.12, '#111');
  ctx.restore();
}

function drawSnake(ctx, pts, dx, dy, t, o = {}) {
  if (!pts.length) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  };
  if (pts.length > 1) {
    path();
    ctx.strokeStyle = '#27479f';
    ctx.lineWidth = 58;
    ctx.stroke();
    path();
    ctx.strokeStyle = o.color || '#4a7cf0';
    ctx.lineWidth = 50;
    ctx.stroke();
    path();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 14;
    ctx.stroke();
  }
  const h = pts[0];
  circ(ctx, h.x, h.y, 31, '#27479f');
  circ(ctx, h.x, h.y, 27, o.color || '#4a7cf0');
  const px = -dy, py = dx;
  for (const sgn of [-1, 1]) {
    const ex = h.x + dx * 8 + px * 12 * sgn, ey = h.y + dy * 8 + py * 12 * sgn;
    circ(ctx, ex, ey, 10, '#fff');
    circ(ctx, ex + dx * 4, ey + dy * 4, 5, '#1d2340');
  }
  if (Math.sin(t * 3) > 0.7) {
    const tx = h.x + dx * 30, ty = h.y + dy * 30;
    line(ctx, tx, ty, tx + dx * 12, ty + dy * 12, '#e53935', 3);
    line(ctx, tx + dx * 12, ty + dy * 12, tx + dx * 16 + px * 5, ty + dy * 16 + py * 5, '#e53935', 2);
    line(ctx, tx + dx * 12, ty + dy * 12, tx + dx * 16 - px * 5, ty + dy * 16 - py * 5, '#e53935', 2);
  }
  ctx.restore();
}

// ---------- предметы ----------
function drawSun(ctx, x, y, r, t) {
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.9);
  g.addColorStop(0, 'rgba(255,240,120,0.55)');
  g.addColorStop(1, 'rgba(255,220,60,0)');
  ctx.fillStyle = g;
  circ(ctx, x, y, r * 1.9);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.8);
  ctx.fillStyle = '#ffd21f';
  for (let i = 0; i < 12; i++) {
    ctx.rotate(TAU / 12);
    ctx.beginPath();
    ctx.moveTo(r * 0.7, -r * 0.24);
    ctx.lineTo(r * 1.38, 0);
    ctx.lineTo(r * 0.7, r * 0.24);
    ctx.fill();
  }
  ctx.restore();
  const cg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  cg.addColorStop(0, '#fffbd0');
  cg.addColorStop(0.5, '#ffd000');
  cg.addColorStop(1, '#f5a800');
  circ(ctx, x, y, r, cg);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#e09000';
  ctx.stroke();
}

function drawMine(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = r * 0.28;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 4;
    line(ctx, Math.cos(a) * r * 1.45, Math.sin(a) * r * 1.45, -Math.cos(a) * r * 1.45, -Math.sin(a) * r * 1.45, '#000', r * 0.28);
  }
  circ(ctx, 0, 0, r, '#000');
  ctx.fillStyle = '#fff';
  ctx.fillRect(-r * 0.5, -r * 0.5, r * 0.36, r * 0.36);
  ctx.restore();
}

function drawFlag(ctx, x, y, s = 1) {
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 2 * s, y - 16 * s, 4 * s, 26 * s);
  ctx.fillRect(x - 13 * s, y + 9 * s, 26 * s, 5 * s);
  ctx.fillRect(x - 7 * s, y + 5 * s, 14 * s, 5 * s);
  poly(ctx, [x + 2 * s, y - 18 * s, x - 15 * s, y - 9 * s, x + 2 * s, y], '#e01b1b');
}

const DICE_PIPS = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};
function drawDice(ctx, x, y, size, face = 5, rot = 0) {
  const h = size / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  rr(ctx, -h + size * 0.08, -h + size * 0.1, size, size, size * 0.2);
  ctx.fillStyle = '#7a0d0d';
  ctx.fill();
  rr(ctx, -h, -h, size, size, size * 0.2);
  const g = ctx.createLinearGradient(-h, -h, h, h);
  g.addColorStop(0, '#ff5a4f');
  g.addColorStop(1, '#c11d1d');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.strokeStyle = '#6e0a0a';
  ctx.stroke();
  for (const [px, py] of DICE_PIPS[face] || DICE_PIPS[5]) circ(ctx, px * size * 0.26, py * size * 0.26, size * 0.09, '#fff');
  ctx.restore();
}

function drawTNT(ctx, x, y, size) {
  const h = size / 2;
  ctx.fillStyle = '#c62b20';
  ctx.fillRect(x - h, y - h, size, size);
  ctx.fillStyle = '#e8473a';
  for (let i = 0; i < 4; i++) ctx.fillRect(x - h + i * size * 0.25, y - h, size * 0.12, size);
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(x - h, y - size * 0.18, size, size * 0.36);
  text(ctx, 'TNT', x, y + size * 0.12, { font: `bold ${Math.round(size * 0.32)}px ${FONT.ui}`, align: 'center', color: '#111' });
  ctx.strokeStyle = '#5a120c';
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.strokeRect(x - h, y - h, size, size);
}

function drawAmmoBox(ctx, x, y, size) {
  const h = size / 2;
  for (let i = 0; i < 3; i++) {
    const bx = x - h * 0.55 + i * h * 0.55;
    ctx.fillStyle = '#d4a017';
    rr(ctx, bx - size * 0.07, y - h * 0.95, size * 0.14, size * 0.42, size * 0.07);
    ctx.fill();
    ctx.fillStyle = '#b07a12';
    ctx.fillRect(bx - size * 0.07, y - h * 0.5, size * 0.14, size * 0.06);
  }
  rr(ctx, x - h, y - h * 0.4, size, size * 0.7, size * 0.06);
  ctx.fillStyle = '#4f5b2e';
  ctx.fill();
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.strokeStyle = '#262d12';
  ctx.stroke();
  text(ctx, '7.62', x, y + h * 0.4, { font: `bold ${Math.round(size * 0.26)}px ${FONT.ui}`, align: 'center', color: '#e7e2b0' });
}

function drawIce(ctx, x, y, size) {
  const h = size / 2;
  ctx.fillStyle = '#9fd4ff';
  ctx.fillRect(x - h, y - h, size, size);
  ctx.fillStyle = '#c9e9ff';
  ctx.fillRect(x - h, y - h, size, size * 0.18);
  ctx.fillRect(x - h, y - h, size * 0.18, size);
  ctx.fillStyle = '#6aaee6';
  ctx.fillRect(x - h, y + h - size * 0.14, size, size * 0.14);
  ctx.fillRect(x + h - size * 0.14, y - h, size * 0.14, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(1, size * 0.07);
  ctx.beginPath();
  ctx.moveTo(x - h * 0.4, y + h * 0.1);
  ctx.lineTo(x + h * 0.1, y - h * 0.4);
  ctx.moveTo(x - h * 0.1, y + h * 0.45);
  ctx.lineTo(x + h * 0.45, y);
  ctx.stroke();
}

function drawPellet(ctx, x, y, size, t = 0) {
  const r = size * 0.32 * (1 + Math.sin(t * 8) * 0.08);
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
  g.addColorStop(0, 'rgba(255,190,170,0.9)');
  g.addColorStop(1, 'rgba(255,190,170,0)');
  circ(ctx, x, y, r * 2, g);
  circ(ctx, x, y, r, '#ffb8ae');
  circ(ctx, x - r * 0.3, y - r * 0.3, r * 0.3, '#fff');
}

function drawVest(ctx, x, y, size) {
  const h = size / 2;
  poly(ctx, [x - h * 0.9, y - h * 0.7, x - h * 0.35, y - h, x, y - h * 0.6, x + h * 0.35, y - h, x + h * 0.9, y - h * 0.7, x + h * 0.8, y + h, x - h * 0.8, y + h], '#55613a', '#1f2611', 2);
  poly(ctx, [x - h * 0.9, y - h * 0.7, x - h * 0.35, y - h, x, y - h * 0.6, x + h * 0.35, y - h, x + h * 0.9, y - h * 0.7, x + h * 0.8, y + h, x - h * 0.8, y + h], '#55613a');
  ctx.fillStyle = '#3d4628';
  ctx.fillRect(x - h * 0.6, y, size * 0.25, size * 0.3);
  ctx.fillRect(x + h * 0.1, y, size * 0.25, size * 0.3);
}

const ITEM_INFO = {
  steak: { name: 'Стейк', desc: '+8 к сытости' },
  gapple: { name: 'Золотое яблоко', desc: '+6 HP, +20 брони' },
  potion: { name: 'Зелье лечения', desc: '+10 HP' },
  tnt: { name: 'Динамит', desc: 'бросок в прицел' },
  dice: { name: 'Кубик', desc: 'случайный эффект' },
  ammo: { name: 'Патроны 7.62', desc: '+90 патронов' },
  ice: { name: 'Лёд', desc: 'заморозка врагов' },
  pellet: { name: 'Энерджайзер', desc: 'Пак-Ман на охоту' },
  totem: { name: 'Тотем бессмертия', desc: 'спасёт от смерти' },
  vest: { name: 'Бронежилет 3 ур.', desc: '+50 брони' },
};

function drawItemIcon(ctx, key, x, y, size, t = 0) {
  switch (key) {
    case 'steak':
    case 'gapple':
    case 'potion':
    case 'totem': {
      const s = size / 12;
      drawPixel(ctx, PIX[key], x - 6 * s, y - 6 * s, s);
      break;
    }
    case 'tnt': drawTNT(ctx, x, y, size * 0.8); break;
    case 'dice': drawDice(ctx, x, y, size * 0.72, 5, -0.15); break;
    case 'ammo': drawAmmoBox(ctx, x, y + size * 0.05, size * 0.85); break;
    case 'ice': drawIce(ctx, x, y, size * 0.78); break;
    case 'pellet': drawPellet(ctx, x, y, size, t); break;
    case 'vest': drawVest(ctx, x, y, size * 0.85); break;
    case 'sun': drawSun(ctx, x, y, size * 0.32, t); break;
  }
}

// ---------- аирдроп ----------
function drawAirdrop(ctx, x, y, t, landed) {
  if (!landed) {
    const cy = y - 125;
    const sway = Math.sin(t * 1.6) * 0.06;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sway);
    ctx.translate(-x, -y);
    // стропы
    ctx.strokeStyle = 'rgba(40,40,40,0.7)';
    ctx.lineWidth = 1.2;
    const pts = [-92, -55, -18, 18, 55, 92];
    for (const p of pts) line(ctx, x + p, cy + 8, x + Math.sign(p) * 24, y - 22, 'rgba(40,40,40,0.7)', 1.2);
    // купол
    ctx.beginPath();
    ctx.ellipse(x, cy, 96, 60, 0, Math.PI, 0);
    for (let i = pts.length - 1; i >= 0; i--) {
      const px = x + pts[i] + (i === pts.length - 1 ? 4 : 0);
      ctx.quadraticCurveTo(px + 19, cy + 18, px, cy + 6);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(x - 96, cy - 60, x + 96, cy);
    g.addColorStop(0, '#7da447');
    g.addColorStop(1, '#3d5a21');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2a3d15';
    ctx.stroke();
    ctx.strokeStyle = 'rgba(25,40,10,0.55)';
    ctx.lineWidth = 2;
    for (const p of pts) {
      ctx.beginPath();
      ctx.moveTo(x, cy - 58);
      ctx.quadraticCurveTo(x + p * 0.7, cy - 40, x + p, cy + 6);
      ctx.stroke();
    }
    ctx.restore();
  }
  // ящик
  rr(ctx, x - 32, y - 24, 64, 48, 5);
  ctx.fillStyle = '#b3261e';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#4d0c08';
  ctx.stroke();
  ctx.fillStyle = '#2f62c9';
  ctx.fillRect(x - 32, y - 6, 64, 12);
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(x - 5, y - 24, 10, 48);
  text(ctx, 'ГРУЗ', x, y + 4, { font: `bold 10px ${FONT.ui}`, align: 'center', color: '#fff' });
}

// ---------- руки игрока: АК-47 и удочка ----------
const AK_MUZZLE = { x: -396, y: -10 };

function drawAK(ctx, flash) {
  // Локальные координаты: ствол смотрит влево (−x), рукоять в (0,0).
  // приклад
  const wood = ctx.createLinearGradient(0, -30, 0, 40);
  wood.addColorStop(0, '#a0471f');
  wood.addColorStop(1, '#5e2410');
  poly(ctx, [30, -18, 160, -6, 175, 40, 150, 44, 30, 12], wood, '#2b0f05', 3);
  poly(ctx, [30, -18, 160, -6, 175, 40, 150, 44, 30, 12], wood);
  // правая рука в рукаве (под оружием)
  poly(ctx, [-10, 30, 40, 20, 200, 160, 120, 230], '#3f4a2c');
  // ствольная коробка
  const metal = ctx.createLinearGradient(0, -26, 0, 8);
  metal.addColorStop(0, '#55565c');
  metal.addColorStop(0.4, '#2d2e33');
  metal.addColorStop(1, '#17171a');
  rr(ctx, -152, -26, 190, 32, 5);
  ctx.fillStyle = metal;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#0b0b0d';
  ctx.stroke();
  line(ctx, -140, -18, 24, -18, 'rgba(255,255,255,0.15)', 2);
  // целик
  poly(ctx, [-150, -26, -140, -36, -128, -36, -122, -26], '#1c1c1f');
  // газовая трубка и цевьё
  rr(ctx, -278, -32, 128, 10, 3);
  ctx.fillStyle = '#2f3034';
  ctx.fill();
  rr(ctx, -272, -24, 122, 12, 4);
  ctx.fillStyle = wood;
  ctx.fill();
  rr(ctx, -276, -14, 126, 24, 8);
  ctx.fillStyle = wood;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#2b0f05';
  ctx.stroke();
  // ствол, мушка, дульный тормоз
  rr(ctx, -384, -15, 112, 9, 3);
  ctx.fillStyle = '#1d1d20';
  ctx.fill();
  poly(ctx, [-356, -15, -350, -36, -340, -36, -336, -15], '#18181b');
  rr(ctx, -398, -18, 20, 14, 3);
  ctx.fillStyle = '#26262a';
  ctx.fill();
  // изогнутый магазин
  ctx.beginPath();
  ctx.moveTo(-122, 6);
  ctx.lineTo(-82, 6);
  ctx.quadraticCurveTo(-80, 44, -100, 82);
  ctx.lineTo(-140, 70);
  ctx.quadraticCurveTo(-120, 42, -122, 6);
  ctx.closePath();
  ctx.fillStyle = '#9a4a1c';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#3d1806';
  ctx.stroke();
  for (let i = 1; i < 4; i++) line(ctx, -122 + i * 3, 6 + i * 18, -84 - i * 4, 8 + i * 18, 'rgba(0,0,0,0.25)', 2);
  // пистолетная рукоять и спуск
  poly(ctx, [-34, 6, -2, 6, 12, 60, -16, 64], '#2a1a10', '#0d0704', 2);
  ctx.beginPath();
  ctx.arc(-46, 12, 12, 0, Math.PI);
  ctx.strokeStyle = '#1a1a1d';
  ctx.lineWidth = 3;
  ctx.stroke();
  // перчатки
  rr(ctx, -36, 14, 50, 46, 18);
  ctx.fillStyle = '#1f1f22';
  ctx.fill();
  for (let i = 0; i < 3; i++) line(ctx, -30 + i * 13, 20, -30 + i * 13, 32, 'rgba(255,255,255,0.08)', 2);
  // вспышка
  if (flash > 0) {
    ctx.save();
    ctx.translate(AK_MUZZLE.x, AK_MUZZLE.y);
    const sc = 0.8 + Math.random() * 0.6;
    ctx.scale(sc, sc);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 60);
    g.addColorStop(0, 'rgba(255,255,220,1)');
    g.addColorStop(0.3, 'rgba(255,200,60,0.9)');
    g.addColorStop(1, 'rgba(255,120,0,0)');
    circ(ctx, -10, 0, 60, g);
    poly(ctx, [0, -10, -70, 0, 0, 10, -20, 0], '#fff7c0');
    poly(ctx, [-8, -4, -30, -34, -16, -2], '#ffd54a');
    poly(ctx, [-8, 4, -30, 34, -16, 2], '#ffd54a');
    ctx.restore();
  }
}

function drawFist(ctx, x, y, s, fill = '#2a2a2a') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = fill;
  for (let i = 0; i < 4; i++) {
    rr(ctx, -20 + i * 10, -16, 10, 14, 4);
    ctx.fill();
  }
  rr(ctx, -21, -6, 42, 26, 8);
  ctx.fill();
  rr(ctx, -26, -2, 18, 10, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) line(ctx, -20 + i * 10, -14, -20 + i * 10, -4, 'rgba(255,255,255,0.25)', 1.5);
  ctx.restore();
}

// Удочка: рука в левом нижнем углу, кончик и поплавок.
function drawRod(ctx, o) {
  const hx = 96, hy = 712;
  const tipX = o.tipX, tipY = o.tipY;
  // рукав и перчатка
  poly(ctx, [-20, 760, 60, 640, 140, 690, 80, 780], '#46512f');
  // удилище (как палка из Minecraft — сегментами)
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 1) / n;
    line(ctx, lerp(hx, tipX, a), lerp(hy, tipY, a), lerp(hx, tipX, b), lerp(hy, tipY, b), i % 2 ? '#7a5230' : '#9a6a3c', 9 - i * 0.8);
  }
  circ(ctx, lerp(hx, tipX, 0.12), lerp(hy, tipY, 0.12), 9, '#555');
  circ(ctx, lerp(hx, tipX, 0.12), lerp(hy, tipY, 0.12), 4, '#999');
  rr(ctx, hx - 26, hy - 26, 52, 40, 16);
  ctx.fillStyle = '#1f1f22';
  ctx.fill();
  // леска и поплавок
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  const sag = o.sag || 0;
  ctx.quadraticCurveTo((tipX + o.bx) / 2, Math.max(tipY, o.by) + sag, o.bx, o.by);
  ctx.strokeStyle = 'rgba(230,230,230,0.85)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  circ(ctx, o.bx, o.by, 7, '#fff');
  ctx.beginPath();
  ctx.arc(o.bx, o.by, 7, Math.PI, 0);
  ctx.fillStyle = '#e53935';
  ctx.fill();
  line(ctx, o.bx, o.by - 7, o.bx, o.by - 12, '#333', 1.5);
}

// ---------- интерфейс ----------
const LED_SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g' };
function drawLedDigit(ctx, ch, x, y, w, h) {
  const t = w * 0.2;
  const hh = h / 2;
  const segs = {
    a: [x + t, y, w - 2 * t, t],
    b: [x + w - t, y + t, t, hh - t * 1.5],
    c: [x + w - t, y + hh + t * 0.5, t, hh - t * 1.5],
    d: [x + t, y + h - t, w - 2 * t, t],
    e: [x, y + hh + t * 0.5, t, hh - t * 1.5],
    f: [x, y + t, t, hh - t * 1.5],
    g: [x + t, y + hh - t / 2, w - 2 * t, t],
  };
  const on = LED_SEG[ch] || '';
  for (const k in segs) {
    ctx.fillStyle = on.includes(k) ? '#ff1f1f' : '#3a0000';
    const s = segs[k];
    ctx.fillRect(s[0], s[1], s[2], s[3]);
  }
}
function drawLed(ctx, value, x, y) {
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y, 66, 36);
  const str = value < 0 ? '-' + pad(-value, 2) : pad(Math.min(999, value), 3);
  for (let i = 0; i < 3; i++) drawLedDigit(ctx, str[i], x + 4 + i * 21, y + 4, 17, 28);
}
function bevel(ctx, x, y, w, h, raised, k = 3) {
  ctx.fillStyle = '#c0c0c0';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = raised ? '#ffffff' : '#7b7b7b';
  ctx.fillRect(x, y, w, k);
  ctx.fillRect(x, y, k, h);
  ctx.fillStyle = raised ? '#7b7b7b' : '#ffffff';
  ctx.fillRect(x, y + h - k, w, k);
  ctx.fillRect(x + w - k, y, k, h);
}
function drawSmiley(ctx, x, y, r, state) {
  circ(ctx, x, y, r, '#ffe62e');
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000';
  ctx.stroke();
  if (state === 'dead') {
    for (const ex of [-5, 5]) {
      line(ctx, x + ex - 2.5, y - 6.5, x + ex + 2.5, y - 1.5, '#000', 1.8);
      line(ctx, x + ex + 2.5, y - 6.5, x + ex - 2.5, y - 1.5, '#000', 1.8);
    }
    ctx.beginPath();
    ctx.arc(x, y + 9, 5, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  } else if (state === 'cool') {
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 10, y - 6, 20, 5);
    rr(ctx, x - 10, y - 6, 8, 7, 2);
    ctx.fill();
    rr(ctx, x + 2, y - 6, 8, 7, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y + 2, 6, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  } else {
    circ(ctx, x - 5, y - 4, 1.8, '#000');
    circ(ctx, x + 5, y - 4, 1.8, '#000');
    if (state === 'o') {
      ctx.beginPath();
      ctx.arc(x, y + 5, 3.5, 0, TAU);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y + 1, 6.5, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    }
  }
}
function drawStar(ctx, x, y, r, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
}
