'use strict';
/* Кампания: 5 уровней, у каждого свой босс, доска и набор врагов.
   pool — [тип врага, вес, с какого числа звёзд розыска появляется]. */

const LEVELS = [
  {
    name: 'Королевская башня', ref: 'Clash Royale', boss: 'tower', hp: 1000, theme: 'classic', clock: 8 * 60, bonusStars: 0, mines: 10,
    tip: 'Сбивай ядра короля и проходи сапёра — мины летят в башню.',
    pool: [['pawn', 5, 1], ['zombie', 4, 1], ['cone', 3, 2], ['knight', 2, 2], ['creeper', 1.5, 2], ['snake', 0.8, 3], ['skibidi', 1.2, 3], ['rook', 1.6, 4], ['bishop', 1.6, 5], ['draugr', 0.7, 3]],
  },
  {
    name: 'Замок Боузера', ref: 'Super Mario', boss: 'bowser', hp: 1100, theme: 'castle', clock: 10 * 60, bonusStars: 0, mines: 11,
    tip: 'Огонь Боузера выжигает целый столбец. На 30% HP появится топор — стреляй по нему!',
    pool: [['goomba', 5, 1], ['koopa', 3, 1], ['zombie', 3, 1], ['pawn', 3, 1], ['cone', 2, 2], ['knight', 1.5, 2], ['sonic', 0.6, 2], ['creeper', 1, 3], ['snake', 0.8, 3], ['rook', 1, 4], ['draugr', 0.8, 3]],
  },
  {
    name: 'Край', ref: 'Minecraft', boss: 'dragon', hp: 1250, theme: 'end', clock: 17 * 60, bonusStars: 1, mines: 11,
    tip: 'Кристаллы Края лечат дракона — разбей их первыми. Не держи прицел на эндермене!',
    pool: [['enderman', 2.5, 1], ['zombie', 4, 1], ['creeper', 2.5, 1], ['pawn', 3, 1], ['cone', 2, 2], ['sonic', 0.5, 2], ['bishop', 1.5, 3], ['snake', 0.8, 3], ['rook', 1.5, 4], ['draugr', 1.2, 2]],
  },
  {
    name: 'Лос-Сантос', ref: 'GTA', boss: 'heli', hp: 1200, theme: 'city', clock: 19 * 60, bonusStars: 2, mines: 12,
    tip: 'Вертолёт поливает столбцы очередями — красная полоса показывает куда.',
    pool: [['cop', 4, 1], ['zombie', 3, 1], ['pawn', 3, 1], ['cone', 2, 2], ['knight', 2, 2], ['sonic', 0.8, 2], ['skibidi', 1.5, 3], ['snake', 0.8, 3], ['rook', 1.5, 4], ['draugr', 1.2, 2]],
  },
  {
    name: 'Скибиди-Титан', ref: 'финал', boss: 'titan', hp: 1300, theme: 'bath', clock: 22 * 60, bonusStars: 2, mines: 12,
    tip: 'Когда Титан заряжает лазер, стреляй ему в глаза — иначе сгорит весь ряд фигур.',
    pool: [['skibidi', 4, 1], ['cop', 2, 1], ['goomba', 2, 1], ['koopa', 2, 1], ['enderman', 1.5, 2], ['creeper', 1.5, 2], ['cone', 2, 2], ['sonic', 0.6, 2], ['snake', 0.6, 3], ['rook', 1, 4], ['bishop', 1, 4], ['draugr', 1.5, 2]],
  },
];

// Оформление доски. top — фон верхних двух рядов, где стоит босс.
const THEMES = {
  classic: { light: '#eeeed2', dark: '#769656', top: 'chess' },
  castle: { light: '#c9a27e', dark: '#8a5a3c', top: 'lava' },
  end: { light: '#efeab8', dark: '#c9c084', top: 'void' },
  city: { light: '#a9a9a9', dark: '#7b7b7b', top: 'skyline' },
  bath: { light: '#f4f8fb', dark: '#a8d4f0', top: 'tiles' },
};

function paintThemeTop(ctx, theme) {
  const top = THEMES[theme].top;
  if (top === 'chess') {
    const back = [[4, 'r'], [5, 'n'], [10, 'b'], [11, 'r']];
    for (const [c, k] of back) drawPiece(ctx, k, false, colX(c), rowY(0) + 2, 68);
    for (const c of [4, 5, 10, 11]) drawPiece(ctx, 'p', false, colX(c), rowY(1), 60);
    return;
  }
  if (top === 'lava') {
    const g = ctx.createLinearGradient(0, 0, 0, 2 * T);
    g.addColorStop(0, '#3e0b00');
    g.addColorStop(0.55, '#b71c1c');
    g.addColorStop(1, '#ff6d00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, 2 * T);
    for (let i = 0; i < 40; i++) circ(ctx, (i * 97) % W, 120 + ((i * 37) % 40), 3 + (i % 4), 'rgba(255,214,0,0.55)');
    // кирпичная стена замка по краям
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(0, 0, W, 18);
    for (let x = 0; x < W; x += 64) {
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(x + 4, 0, 26, 30);
    }
    return;
  }
  if (top === 'void') {
    ctx.fillStyle = '#0b0614';
    ctx.fillRect(0, 0, W, 2 * T);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = i % 5 ? 'rgba(255,255,255,0.6)' : 'rgba(224,64,251,0.8)';
      ctx.fillRect((i * 137.5) % W, (i * 53.3) % (2 * T), 2, 2);
    }
    const g = ctx.createLinearGradient(0, 2 * T - 30, 0, 2 * T);
    g.addColorStop(0, 'rgba(11,6,20,0)');
    g.addColorStop(1, 'rgba(201,192,132,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 2 * T - 30, W, 30);
    return;
  }
  if (top === 'skyline') {
    const g = ctx.createLinearGradient(0, 0, 0, 2 * T);
    g.addColorStop(0, '#1a1340');
    g.addColorStop(1, '#ff7043');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, 2 * T);
    let x = 0, i = 0;
    while (x < W) {
      const w = 40 + ((i * 53) % 50), h = 50 + ((i * 71) % 90);
      ctx.fillStyle = i % 2 ? '#1c1c2b' : '#252538';
      ctx.fillRect(x, 2 * T - h, w, h);
      ctx.fillStyle = 'rgba(255,224,130,0.8)';
      for (let wy = 2 * T - h + 8; wy < 2 * T - 8; wy += 14) for (let wx = x + 6; wx < x + w - 8; wx += 12) if ((wx + wy + i) % 3) ctx.fillRect(wx, wy, 5, 6);
      x += w + 4;
      i++;
    }
    return;
  }
  if (top === 'tiles') {
    ctx.fillStyle = '#d6ecf7';
    ctx.fillRect(0, 0, W, 2 * T);
    ctx.strokeStyle = 'rgba(120,160,190,0.6)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= W; x += 40) line(ctx, x, 0, x, 2 * T, 'rgba(120,160,190,0.6)', 2);
    for (let y = 0; y <= 2 * T; y += 40) line(ctx, 0, y, W, y, 'rgba(120,160,190,0.6)', 2);
  }
}

// Дополнительные детали на основной доске (разметка дороги, швы плитки).
function paintThemeBoard(ctx, theme) {
  if (theme === 'city') {
    for (const x of [2 * T, 14 * T]) {
      for (let y = 2 * T; y < 8 * T; y += 40) {
        ctx.fillStyle = '#ffd600';
        ctx.fillRect(x - 3, y, 6, 22);
      }
    }
  } else if (theme === 'bath') {
    for (let x = 0; x <= W; x += T) line(ctx, x, 2 * T, x, H, 'rgba(90,130,160,0.5)', 2);
    for (let y = 2 * T; y <= H; y += T) line(ctx, 0, y, W, y, 'rgba(90,130,160,0.5)', 2);
  } else if (theme === 'castle') {
    for (let i = 0; i < 30; i++) {
      const x = (i * 211) % W, y = 2 * T + ((i * 97) % (6 * T));
      line(ctx, x, y, x + 18, y + 10, 'rgba(255,87,34,0.35)', 2);
    }
  }
}
