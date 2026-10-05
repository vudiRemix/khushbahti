'use strict';
/* Оружие в стиле CS: характеристики, отрисовка от первого лица и меню закупки (B). */

const WEAPONS = {
  ak: {
    name: 'АК-47', dmg: 1, interval: CFG.fireInterval, mag: CFG.magSize, reserveMax: CFG.maxReserve, reload: CFG.reloadTime,
    spread: 2, heatSpread: 30, heatAdd: 0.09, auto: true, pellets: 1, pierce: false,
    kick: 14, shake: 1.5, muzzle: { x: -396, y: -10 }, scale: 0.86, refill: 90, iconCx: -110, iconScale: 0.115,
  },
  nova: {
    name: 'Nova', dmg: 1, interval: 0.85, mag: 8, reserveMax: 40, reload: 2.4,
    spread: 48, heatSpread: 0, heatAdd: 0, auto: false, pellets: 9, pierce: false,
    kick: 26, shake: 5, muzzle: { x: -380, y: -15 }, scale: 0.86, refill: 16, iconCx: -105, iconScale: 0.12,
  },
  awp: {
    name: 'AWP', dmg: 12, interval: 1.45, mag: 5, reserveMax: 30, reload: 3.0,
    spread: 0, heatSpread: 0, heatAdd: 0, auto: false, pellets: 1, pierce: true,
    kick: 34, shake: 7, muzzle: { x: -512, y: -10 }, scale: 0.8, refill: 10, iconCx: -165, iconScale: 0.095,
  },
};
const WEAPON_ORDER = ['ak', 'nova', 'awp'];

// Цены как в CS (почти).
const BUY_ITEMS = [
  { key: 'awp', name: 'AWP', price: 4750, desc: '12 урона, прошивает врагов насквозь' },
  { key: 'nova', name: 'Дробовик Nova', price: 1050, desc: '9 дробин веером, против толпы' },
  { key: 'he', name: 'HE-граната', price: 300, desc: 'бросок на G, большой взрыв' },
  { key: 'kevlar', name: 'Кевлар + шлем', price: 1000, desc: 'броня до 100' },
  { key: 'ammo', name: 'Патроны', price: 200, desc: 'пачка к текущему стволу: АК +90, Nova +16, AWP +10' },
  { key: 'detector', name: 'Миноискатель', price: 800, desc: 'ставит флажок на одну мину' },
];
const buyRect = (i) => ({ x: 70, y: 168 + i * 62, w: 520, h: 54 });

function drawSleeve(ctx) {
  poly(ctx, [-10, 30, 40, 20, 200, 160, 120, 230], '#3f4a2c');
}
function drawGlove(ctx) {
  rr(ctx, -36, 14, 50, 46, 18);
  ctx.fillStyle = '#1f1f22';
  ctx.fill();
  for (let i = 0; i < 3; i++) line(ctx, -30 + i * 13, 20, -30 + i * 13, 32, 'rgba(255,255,255,0.08)', 2);
}

function drawNova(ctx, flash, hands = true) {
  const poly1 = [30, -18, 150, -8, 162, 34, 140, 38, 30, 12];
  poly(ctx, poly1, '#262628', '#0b0b0c', 3);
  poly(ctx, poly1, '#262628');
  if (hands) drawSleeve(ctx);
  rr(ctx, -124, -26, 158, 32, 6);
  ctx.fillStyle = '#2d2e32';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#0b0b0d';
  ctx.stroke();
  line(ctx, -116, -18, 24, -18, 'rgba(255,255,255,0.12)', 2);
  rr(ctx, -378, -24, 258, 10, 3);
  ctx.fillStyle = '#1b1b1d';
  ctx.fill();
  rr(ctx, -350, -13, 230, 11, 5);
  ctx.fillStyle = '#232326';
  ctx.fill();
  rr(ctx, -290, -18, 104, 26, 9);
  ctx.fillStyle = '#3c3d42';
  ctx.fill();
  for (let i = 0; i < 6; i++) line(ctx, -280 + i * 16, -14, -280 + i * 16, 4, 'rgba(0,0,0,0.45)', 3);
  circ(ctx, -370, -27, 3, '#e0e0e0');
  poly(ctx, [-24, 6, 6, 6, 18, 58, -8, 62], '#1e1e20', '#050505', 2);
  ctx.beginPath();
  ctx.arc(-36, 12, 11, 0, Math.PI);
  ctx.strokeStyle = '#1a1a1d';
  ctx.lineWidth = 3;
  ctx.stroke();
  if (hands) drawGlove(ctx);
  if (flash > 0) drawMuzzleFlash(ctx, WEAPONS.nova.muzzle.x, WEAPONS.nova.muzzle.y, 1.3);
}

function drawAWP(ctx, flash, hands = true) {
  const olive = '#4b5a32', dark = '#2c351c';
  const stock = [20, -22, 172, -14, 184, 38, 152, 42, 124, 18, 70, 14, 40, 20, 20, 10];
  poly(ctx, stock, olive, dark, 3);
  poly(ctx, stock, olive);
  ell(ctx, 92, 6, 22, 9, dark);
  if (hands) drawSleeve(ctx);
  // ствол и цевьё
  rr(ctx, -506, -15, 370, 10, 3);
  ctx.fillStyle = '#202022';
  ctx.fill();
  rr(ctx, -520, -19, 24, 18, 3);
  ctx.fillStyle = '#18181a';
  ctx.fill();
  rr(ctx, -310, -22, 176, 26, 9);
  ctx.fillStyle = olive;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = dark;
  ctx.stroke();
  // ствольная коробка
  rr(ctx, -142, -26, 176, 32, 5);
  ctx.fillStyle = olive;
  ctx.fill();
  ctx.stroke();
  // магазин и рукоять
  rr(ctx, -96, 6, 34, 30, 4);
  ctx.fillStyle = '#1d1d1f';
  ctx.fill();
  poly(ctx, [-22, 6, 6, 6, 18, 58, -8, 62], dark, '#111', 2);
  // затвор
  line(ctx, 8, -10, 22, 8, '#1d1d1f', 5);
  circ(ctx, 24, 10, 6, '#1d1d1f');
  // прицел
  rr(ctx, -124, -38, 14, 14, 2);
  ctx.fillStyle = '#111';
  ctx.fill();
  rr(ctx, -18, -38, 14, 14, 2);
  ctx.fill();
  rr(ctx, -176, -62, 196, 26, 12);
  const sg = ctx.createLinearGradient(0, -62, 0, -36);
  sg.addColorStop(0, '#3a3a3e');
  sg.addColorStop(1, '#0d0d0f');
  ctx.fillStyle = sg;
  ctx.fill();
  ell(ctx, -176, -49, 7, 15, '#0d0d0f');
  ell(ctx, -176, -49, 4, 11, '#2a7fd0');
  ell(ctx, -178, -54, 1.5, 4, 'rgba(255,255,255,0.8)');
  rr(ctx, 14, -60, 26, 22, 6);
  ctx.fillStyle = '#111';
  ctx.fill();
  if (hands) drawGlove(ctx);
  if (flash > 0) drawMuzzleFlash(ctx, WEAPONS.awp.muzzle.x, WEAPONS.awp.muzzle.y, 1.6);
}

function drawWeapon(ctx, key, flash, hands = true) {
  if (key === 'awp') drawAWP(ctx, flash, hands);
  else if (key === 'nova') drawNova(ctx, flash, hands);
  else drawAK(ctx, flash, hands);
}

function drawWeaponIcon(ctx, key, x, y) {
  const w = WEAPONS[key];
  ctx.save();
  ctx.translate(x - w.iconCx * w.iconScale, y);
  ctx.scale(w.iconScale, w.iconScale);
  drawWeapon(ctx, key, 0, false);
  ctx.restore();
}

function drawGrenade(ctx, x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ell(ctx, 0, 3, 10, 13, '#4f5b2e');
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#262d12';
  ctx.stroke();
  line(ctx, -8, 0, 8, 0, 'rgba(0,0,0,0.3)', 2);
  line(ctx, -8, 7, 8, 7, 'rgba(0,0,0,0.3)', 2);
  ctx.fillStyle = '#9e9e9e';
  ctx.fillRect(-4, -14, 8, 6);
  line(ctx, 3, -12, 11, 4, '#bdbdbd', 2.5);
  ctx.beginPath();
  ctx.arc(-6, -15, 4, 0, TAU);
  ctx.strokeStyle = '#d0d0d0';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}
