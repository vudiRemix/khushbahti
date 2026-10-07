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
  // Топор Левиафан (God of War): не стреляет — бросается и возвращается (Game.axeAction).
  axe: {
    name: 'Топор Левиафан', dmg: 6, interval: 0.3, mag: 1, reserveMax: 0, reload: 0.01,
    spread: 0, heatSpread: 0, heatAdd: 0, auto: false, pellets: 1, pierce: false,
    kick: 10, shake: 2, muzzle: { x: -250, y: -40 }, scale: 0.9, refill: 0, iconCx: -130, iconScale: 0.17,
  },
};
const WEAPON_ORDER = ['ak', 'nova', 'awp', 'axe'];
const AXE = { speed: 1500, freeze: 1.5, hand: { x: 1150, y: 630 } };

// Цены как в CS (почти).
const BUY_ITEMS = [
  { key: 'awp', name: 'AWP', price: 4750, desc: '12 урона, прошивает врагов насквозь' },
  { key: 'nova', name: 'Дробовик Nova', price: 1050, desc: '9 дробин веером, против толпы' },
  { key: 'he', name: 'HE-граната', price: 300, desc: 'бросок на G, большой взрыв' },
  { key: 'kevlar', name: 'Кевлар + шлем', price: 1000, desc: 'броня до 100' },
  { key: 'ammo', name: 'Патроны', price: 200, desc: 'пачка к текущему стволу: АК +90, Nova +16, AWP +10' },
  { key: 'detector', name: 'Миноискатель', price: 800, desc: 'ставит флажок на одну мину' },
  { key: 'axe', name: 'Топор Левиафан', price: 2500, desc: 'God of War: бросок и возврат, морозит врагов' },
];
const buyRect = (i) => ({ x: 70, y: 160 + i * 56, w: 520, h: 50 });

// Левиафан от первого лица: обмотанная рукоять, широкое лезвие с инеем и рунами.
// empty — топор брошен, в руке пусто.
function drawLeviathan(ctx, hands = true, empty = false) {
  if (hands) drawSleeve(ctx);
  if (!empty) {
    // рукоять
    rr(ctx, -200, -22, 250, 18, 8);
    ctx.fillStyle = '#4e342e';
    ctx.fill();
    for (let x = -190; x < 40; x += 14) line(ctx, x, -22, x + 8, -4, 'rgba(0,0,0,0.35)', 3);
    circ(ctx, 52, -13, 11, '#78909c');
    // обух
    rr(ctx, -214, -30, 24, 34, 4);
    ctx.fillStyle = '#90a4ae';
    ctx.fill();
    // лезвие
    ctx.save();
    ctx.shadowColor = '#80d8ff';
    ctx.shadowBlur = 16;
    const steel = ctx.createLinearGradient(-300, -100, -200, 20);
    steel.addColorStop(0, '#eceff1');
    steel.addColorStop(1, '#78909c');
    ctx.beginPath();
    ctx.moveTo(-214, -26);
    ctx.lineTo(-232, -78);
    ctx.quadraticCurveTo(-276, -112, -312, -86);
    ctx.quadraticCurveTo(-328, -30, -300, 18);
    ctx.quadraticCurveTo(-262, 30, -236, 6);
    ctx.lineTo(-214, 2);
    ctx.closePath();
    ctx.fillStyle = steel;
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#455a64';
    ctx.stroke();
    // заточенная кромка и руны
    ctx.beginPath();
    ctx.moveTo(-308, -84);
    ctx.quadraticCurveTo(-322, -30, -298, 14);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    for (const [x, y] of [[-262, -60], [-272, -30], [-260, -4]]) {
      line(ctx, x, y - 8, x, y + 8, '#4fc3f7', 2.5);
      line(ctx, x, y - 2, x + 7, y - 9, '#4fc3f7', 2.5);
    }
  }
  if (hands) drawGlove(ctx);
}

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

function drawWeapon(ctx, key, flash, hands = true, empty = false) {
  if (key === 'axe') drawLeviathan(ctx, hands, empty);
  else if (key === 'awp') drawAWP(ctx, flash, hands);
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

// Брошенный топор: крутится в полёте, торчит, воткнувшись.
function drawThrownAxe(ctx, A) {
  ctx.save();
  ctx.translate(A.x, A.y);
  ctx.rotate(A.state === 'stuck' ? -0.5 : A.spin);
  ctx.scale(0.32, 0.32);
  ctx.translate(250, 30);
  drawLeviathan(ctx, false);
  ctx.restore();
}
