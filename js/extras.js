'use strict';
/* Новые механики: Крипер, Скибиди-туалет, Мегарыцарь, «?»-блоки Марио,
   утки из Duck Hunt, подсолнух и горохострел из PvZ, амогус. */

Object.assign(ENEMY_DEF, {
  creeper: { hp: 6, dmg: 3, bounty: 180, xp: 6, hw: 22, top: 50, bot: 36, name: 'Крипер' },
  skibidi: { hp: 7, dmg: 3, bounty: 250, xp: 8, hw: 28, top: 40, bot: 36, name: 'Скибиди-туалет' },
  mega: { hp: 50, dmg: 6, bounty: 1000, xp: 25, hw: 38, top: 66, bot: 40, name: 'Мегарыцарь' },
});

Object.assign(DEF_STATS, {
  sunflower: { hp: 4, cost: 50, cd: 12, name: 'Подсолнух', plant: true, info: 'раз в 12 сек даёт солнце' },
  peashooter: { hp: 4, cost: 100, cd: 1.4, name: 'Горохострел', plant: true, info: 'стреляет горохом вверх по столбцу' },
});
PACKETS.splice(0, PACKETS.length, 'pawn', 'sunflower', 'peashooter', 'bishop', 'rook');

// ---------- Крипер: подходит к твоим фигурам, шипит и взрывается ----------
const CREEPER_HEAD = compilePixel([
  'GgGGgGGG',
  'GGgGGGgG',
  'GKKGGKKG',
  'GKKGgKKG',
  'gGGKKGGg',
  'GGKKKKGG',
  'GgKKKKGG',
  'GGKGgKGG',
], { G: '#5cb84a', g: '#86d672', K: '#0b0b0b' });
const CREEPER_BODY = compilePixel([
  'GgGGGg',
  'GGGgGG',
  'gGGGGG',
  'GGgGGg',
  'GGGGgG',
  'gGGGGG',
  'GGgGGG',
  'GGGGgG',
], { G: '#4ea83e', g: '#7fd06a' });

function drawCreeper(ctx, x, y, t, o = {}) {
  const sw = o.swell || 0;
  const k = 1 + sw * 0.28 + (sw > 0 ? Math.sin(t * 40) * 0.03 : 0);
  ctx.save();
  ctx.translate(x, y + 34);
  ctx.scale(k, k);
  ctx.translate(-x, -(y + 34));
  ell(ctx, x, y + 38, 22, 6, 'rgba(0,0,0,0.25)');
  const step = o.walking ? Math.sin(t * 9) * 3 : 0;
  ctx.fillStyle = '#3f8f31';
  ctx.fillRect(x - 15, y + 20 + step, 13, 16);
  ctx.fillRect(x + 2, y + 20 - step, 13, 16);
  drawPixel(ctx, CREEPER_BODY, x - 12, y - 18, 4.5);
  drawPixel(ctx, CREEPER_HEAD, x - 18, y - 54, 4.5);
  if (o.white) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(x - 18, y - 54, 36, 36);
    ctx.fillRect(x - 15, y - 18, 30, 54);
  }
  ctx.restore();
}

class Creeper extends Enemy {
  constructor(c) {
    super('creeper', colX(c) + rand(-4, 4), rowY(MF.r0) - 10);
    this.speed = 21;
    this.fuse = -1;
    this.phase = rand(0, 10);
  }
  update(dt, g) {
    if (this.baseUpdate(dt)) return;
    if (this.fuse >= 0) {
      this.fuse += dt;
      if (this.fuse >= 1.5) {
        this.dead = true;
        this.remove = true;
        g.creeperBoom(this);
      }
      return;
    }
    if (this.y >= PAWN_ROW * T - 44) {
      this.fuse = 0;
      Sound.creeperHiss();
      FX.text(g, this.x, this.y - 66, 'ссссс...', { color: '#86d672', font: `bold 18px ${FONT.ui}` });
      return;
    }
    this.y += this.speed * dt;
    this.gy = this.y;
    g.checkTrapAt(this.x, this.y, this);
  }
  draw(ctx, t) {
    this.beginDraw(ctx);
    const sw = this.fuse >= 0 ? this.fuse / 1.5 : 0;
    if (this.dead) {
      ctx.translate(this.x, this.y + 34);
      ctx.rotate(Math.min(1, this.deathT / 0.4) * 1.4);
      ctx.translate(-this.x, -(this.y + 34));
    }
    drawCreeper(ctx, this.x, this.y, t + this.phase, {
      swell: sw,
      white: sw > 0 && Math.floor(this.fuse * (5 + sw * 12)) % 2 === 0,
      walking: this.fuse < 0 && this.frozen <= 0 && !this.dead,
    });
    this.endDraw(ctx);
  }
}

// ---------- Скибиди-туалет: быстрые рывки, поёт, смывает фигуры ----------
function drawSkibidi(ctx, x, y, t, o = {}) {
  const sway = Math.sin(t * 8) * 4;
  ctx.save();
  ctx.translate(x, y);
  ell(ctx, 0, 38, 26, 7, 'rgba(0,0,0,0.25)');
  // бачок
  rr(ctx, -22, -34, 44, 26, 5);
  ctx.fillStyle = '#f2f2f2';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#9e9e9e';
  ctx.stroke();
  rr(ctx, -6, -40, 12, 7, 2);
  ctx.fillStyle = '#cfd8dc';
  ctx.fill();
  // голова из унитаза
  const hx = sway, hy = -6 - Math.abs(Math.sin(t * 8)) * 4;
  circ(ctx, hx, hy, 16, '#f0c49a');
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#a5754e';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(hx, hy - 3, 16, Math.PI * 1.05, Math.PI * 1.95);
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#4e342e';
  ctx.stroke();
  circ(ctx, hx - 6, hy - 2, 4, '#fff');
  circ(ctx, hx + 6, hy - 2, 4, '#fff');
  circ(ctx, hx - 5 + Math.sin(t * 5), hy - 2, 2, '#111');
  circ(ctx, hx + 7 + Math.sin(t * 5), hy - 2, 2, '#111');
  if (o.singing) ell(ctx, hx, hy + 8, 6, 3 + Math.abs(Math.sin(t * 16)) * 4, '#5a1010');
  else {
    ctx.beginPath();
    ctx.arc(hx, hy + 4, 7, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.strokeStyle = '#5a1010';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // чаша
  ell(ctx, 0, 14, 28, 15, '#f7f7f7');
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#9e9e9e';
  ctx.stroke();
  ell(ctx, 0, 8, 24, 8, '#e3e3e3');
  ell(ctx, 0, 8, 17, 5, '#9fd4ff');
  poly(ctx, [-13, 24, 13, 24, 9, 38, -9, 38], '#f2f2f2', '#9e9e9e', 2);
  poly(ctx, [-13, 24, 13, 24, 9, 38, -9, 38], '#f2f2f2');
  ctx.restore();
}

class Skibidi extends Enemy {
  constructor(c) {
    super('skibidi', colX(c), rowY(MF.r0));
    this.dashT = rand(0.6, 1.2);
    this.mv = null;
    this.sing = 1.6;
    this.singT = rand(6, 10);
    this.phase = rand(0, 10);
    Sound.skibidi();
  }
  update(dt, g) {
    if (this.baseUpdate(dt)) return;
    if (this.sing > 0) this.sing -= dt;
    this.singT -= dt;
    if (this.singT <= 0) {
      this.singT = rand(6, 10);
      this.sing = 1.6;
      Sound.skibidi();
    }
    if (this.mv) {
      const m = this.mv;
      m.t += dt / m.dur;
      const k = Math.min(1, m.t), e = easeInOut(k);
      this.x = lerp(m.fx, m.tx, e);
      this.y = this.gy = lerp(m.fy, m.ty, e);
      if (k >= 1) {
        this.mv = null;
        g.checkTrapAt(this.x, this.y, this);
        this.afterMove(g);
      }
      return;
    }
    this.dashT -= dt;
    if (this.dashT <= 0) {
      this.dashT = rand(0.7, 1.1);
      const tx = clamp(this.x + rand(-0.6, 0.6) * T, T / 2, W - T / 2);
      this.mv = { fx: this.x, fy: this.y, tx, ty: this.y + T * 0.8, t: 0, dur: 0.28 };
    }
  }
  afterMove(g) {
    const c = this.col;
    if (this.y >= PAWN_ROW * T - 30 && this.y < PAWN_ROW * T + 40 && g.def[c]) {
      g.killDefender(c, this);
      FX.text(g, this.x, this.y - 50, 'СМЫТО!', { color: '#9be7ff', font: `bold 22px ${FONT.gta}` });
      Sound.flush();
    }
    if (this.y >= ROWS * T - 60) g.enemyReached(this);
  }
  draw(ctx, t) {
    this.beginDraw(ctx);
    if (this.dead) {
      ctx.translate(this.x, this.y + 30);
      ctx.rotate(Math.min(1, this.deathT / 0.4) * 1.6);
      ctx.translate(-this.x, -(this.y + 30));
    }
    drawSkibidi(ctx, this.x, this.y, t + this.phase, { singing: this.sing > 0 });
    this.endDraw(ctx);
  }
}

// ---------- Мегарыцарь из Clash Royale: прыгает и давит фигуры ----------
function drawMegaKnight(ctx, x, y, t, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.15, 1.15);
  if (!o.air) ell(ctx, 0, 40, 34, 8, 'rgba(0,0,0,0.3)');
  // плащ
  poly(ctx, [-26, -20, 26, -20, 34, 30, -34, 30], '#5b2d8a');
  // ноги
  ctx.fillStyle = '#2c2f38';
  rr(ctx, -20, 12, 16, 26, 4);
  ctx.fill();
  rr(ctx, 4, 12, 16, 26, 4);
  ctx.fill();
  ell(ctx, -12, 38, 11, 5, '#15161b');
  ell(ctx, 12, 38, 11, 5, '#15161b');
  // корпус
  ell(ctx, 0, -2, 28, 24, '#3b3f4a');
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#15161b';
  ctx.stroke();
  ell(ctx, 0, -6, 18, 14, '#5a5f6e');
  ctx.fillStyle = '#7b4fb0';
  ctx.fillRect(-26, 10, 52, 6);
  // наплечники с шипами
  for (const sx of [-1, 1]) {
    ell(ctx, sx * 30, -16, 15, 11, '#2c2f38');
    poly(ctx, [sx * 24, -24, sx * 30, -40, sx * 36, -24], '#c0c4cf');
    poly(ctx, [sx * 34, -20, sx * 46, -30, sx * 42, -14], '#c0c4cf');
  }
  // булавы
  const swing = Math.sin(t * 3) * 4;
  for (const sx of [-1, 1]) {
    line(ctx, sx * 34, -2, sx * 44, 22 + swing * sx, '#4e342e', 5);
    const bx = sx * 46, by = 30 + swing * sx;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      poly(ctx, [bx + Math.cos(a) * 9, by + Math.sin(a) * 9, bx + Math.cos(a + 0.2) * 17, by + Math.sin(a + 0.2) * 17, bx + Math.cos(a + 0.4) * 9, by + Math.sin(a + 0.4) * 9], '#9ea3ae');
    }
    circ(ctx, bx, by, 11, '#4a4d57');
  }
  // шлем
  rr(ctx, -18, -56, 36, 36, 12);
  ctx.fillStyle = '#2c2f38';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#111';
  ctx.stroke();
  ctx.fillStyle = '#ffb300';
  ctx.fillRect(-12, -42, 24, 5);
  poly(ctx, [-6, -56, 0, -70, 6, -56], '#c0c4cf');
  ctx.restore();
}

class MegaKnight extends Enemy {
  constructor() {
    super('mega', 640, rowY(MF.r0));
    this.jumpT = 2.5;
    this.mv = null;
    this.spawnFx = 0.6;
  }
  update(dt, g) {
    if (this.baseUpdate(dt)) return;
    if (this.mv) {
      const m = this.mv;
      m.t += dt / m.dur;
      const k = Math.min(1, m.t), e = easeInOut(k);
      this.x = lerp(m.fx, m.tx, e);
      this.gy = lerp(m.fy, m.ty, e);
      this.y = this.gy - Math.sin(k * Math.PI) * 150;
      this.air = k < 0.9;
      if (k >= 1) {
        this.mv = null;
        this.air = false;
        this.y = this.gy;
        this.land(g);
      }
      return;
    }
    this.y += 6 * dt;
    this.gy = this.y;
    this.jumpT -= dt;
    if (this.jumpT <= 0) {
      this.jumpT = 3.2;
      const row = toRow(this.gy);
      let tc = this.col;
      let best = 99;
      for (let c = 1; c < COLS; c++) {
        if (g.def[c] && Math.abs(c - this.col) < best) {
          best = Math.abs(c - this.col);
          tc = c;
        }
      }
      tc = clamp(tc, this.col - 2, this.col + 2);
      const tr = row >= PAWN_ROW ? ROWS - 1 : Math.min(PAWN_ROW, row + 2);
      this.mv = { fx: this.x, fy: this.gy, tx: colX(tc), ty: rowY(tr), t: 0, dur: 0.85 };
      Sound.whoosh();
    }
  }
  land(g) {
    Sound.megaLand();
    g.shake = Math.max(g.shake, 14);
    g.explosions.push({ x: this.x, y: this.y + 30, r: 90, t: 0 });
    FX.burst(g, this.x, this.y + 30, 18, { colors: ['#8d6e63', '#bcaaa4', '#7b4fb0'], size: 8, speed: 300, up: 120 });
    FX.text(g, this.x, this.y - 70, 'МЕГАРЫЦАРЬ!', { color: '#b388ff', font: `22px ${FONT.title}` });
    for (let c = 1; c < COLS; c++) {
      if (g.def[c] && Math.abs(colX(c) - this.x) <= T * 1.3 && Math.abs(rowY(PAWN_ROW) - this.y) <= T * 1.2) g.killDefender(c, this);
    }
    g.checkTrapAt(this.x, this.y, this);
    if (toRow(this.y) >= ROWS - 1) g.enemyReached(this);
  }
  draw(ctx, t) {
    if (this.air) ell(ctx, this.x, this.gy + 44, 34, 8, 'rgba(0,0,0,0.25)');
    this.beginDraw(ctx);
    drawMegaKnight(ctx, this.x, this.y, t, { air: this.air });
    this.endDraw(ctx);
  }
}

// ---------- Марио: «?»-блоки ----------
class QBlock {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.t = 0;
    this.state = 'active';
    this.bumpT = 0;
    this.life = 22;
    this.pop = 0;
    this.gone = false;
  }
  get oy() {
    return this.y + Math.sin(this.t * 2) * 4 - Math.sin(Math.max(0, this.bumpT) / 0.25 * Math.PI) * 14;
  }
  hit(px, py) {
    return this.state === 'active' && this.pop >= 1 && Math.abs(px - this.x) < 30 && Math.abs(py - this.oy) < 30;
  }
  update(dt) {
    this.t += dt;
    this.pop = Math.min(1, this.pop + dt * 3);
    if (this.bumpT > 0) this.bumpT -= dt;
    this.life -= dt;
    if (this.life <= 0) this.gone = true;
  }
  draw(ctx) {
    if (this.state === 'active' && this.life < 3 && Math.floor(this.t * 8) % 2 === 0) return;
    const s = 52 * easeOutCubic(this.pop);
    const x = this.x - s / 2, y = this.oy - s / 2;
    ell(ctx, this.x, this.y + 40, 22, 6, 'rgba(0,0,0,0.25)');
    ctx.save();
    if (this.state === 'empty') ctx.globalAlpha = Math.min(1, this.life);
    ctx.fillStyle = '#5a2a00';
    ctx.fillRect(x - 2, y - 2, s + 4, s + 4);
    ctx.fillStyle = this.state === 'active' ? '#f8b800' : '#9a5a24';
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = this.state === 'active' ? '#ffe28a' : '#b8743a';
    ctx.fillRect(x, y, s, s * 0.08);
    ctx.fillRect(x, y, s * 0.08, s);
    ctx.fillStyle = '#5a2a00';
    for (const [dx, dy] of [[0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]]) ctx.fillRect(x + s * dx - 2, y + s * dy - 2, 4, 4);
    if (this.state === 'active' && s > 20) {
      text(ctx, '?', this.x + 3, this.oy + s * 0.27 + 3, { font: `bold ${Math.round(s * 0.75)}px ${FONT.title}`, color: '#5a2a00', align: 'center' });
      text(ctx, '?', this.x, this.oy + s * 0.27, { font: `bold ${Math.round(s * 0.75)}px ${FONT.title}`, color: '#fff', align: 'center' });
    }
    ctx.restore();
  }
}

function drawMarioItem(ctx, kind, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (kind === 'coin') {
    const w = Math.abs(Math.cos(t * 10)) * 10 + 2;
    ell(ctx, 0, 0, w, 14, '#f8b800');
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#a86a00';
    ctx.stroke();
  } else if (kind === 'star') {
    drawStar(ctx, 0, 0, 18, '#ffd23f', '#b07800');
    circ(ctx, -4, -2, 2, '#111');
    circ(ctx, 4, -2, 2, '#111');
  } else {
    // гриб: красный — супергриб, зелёный — 1-UP
    const cap = kind === 'oneup' ? '#2fa84f' : '#e53935';
    ctx.beginPath();
    ctx.arc(0, 0, 17, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = cap;
    ctx.fill();
    circ(ctx, -8, -8, 4.5, '#fff');
    circ(ctx, 7, -9, 4, '#fff');
    circ(ctx, 0, -14, 3, '#fff');
    rr(ctx, -10, 0, 20, 14, 5);
    ctx.fillStyle = '#ffe0b2';
    ctx.fill();
    circ(ctx, -4, 6, 1.8, '#111');
    circ(ctx, 4, 6, 1.8, '#111');
  }
  ctx.restore();
}

// ---------- Duck Hunt ----------
class Duck {
  constructor() {
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.x = this.dir > 0 ? -40 : W + 40;
    this.y = rand(200, 420);
    this.vx = this.dir * rand(200, 260);
    this.vy = rand(-160, 160);
    this.t = 0;
    this.state = 'fly';
    this.life = 6.5;
    this.hitT = 0;
    this.gone = false;
  }
  hit(px, py) {
    return this.state === 'fly' && dist2(px, py, this.x, this.y) < 32 * 32;
  }
  update(dt, g) {
    this.t += dt;
    if (this.state === 'fly') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if ((this.x < 40 && this.vx < 0) || (this.x > W - 40 && this.vx > 0)) {
        if (this.t > 1) this.vx *= -1;
      }
      if (this.y < 170 || this.y > 470) {
        this.vy *= -1;
        this.y = clamp(this.y, 170, 470);
      }
      if (Math.random() < dt * 0.8) this.vy = rand(-180, 180);
      if (this.t % 1.2 < dt) Sound.quack();
      this.life -= dt;
      if (this.life <= 0) {
        this.state = 'escape';
        g.say('Утка улетела... собака над тобой ржёт.', '#d7ccc8');
      }
    } else if (this.state === 'escape') {
      this.y -= 320 * dt;
      this.x += this.vx * 0.3 * dt;
      if (this.y < -60) {
        this.gone = true;
        g.dogLaugh();
      }
    } else if (this.state === 'hit') {
      this.hitT += dt;
      if (this.hitT > 0.45) this.state = 'fall';
    } else if (this.state === 'fall') {
      this.y += 420 * dt;
      if (this.y >= 540) {
        this.gone = true;
        const key = weighted(TILE_LOOT.filter(([k]) => k !== 'sun'));
        g.items.push(new Loot('item', key, this.x, 500, 540, 120));
        Sound.thud();
      }
    }
  }
  draw(ctx) {
    const flap = this.state === 'fly' || this.state === 'escape' ? Math.sin(this.t * 18) : 0;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.state === 'fall') ctx.rotate(Math.PI / 2);
    ctx.scale(this.vx < 0 ? -1 : 1, 1);
    // тело
    ell(ctx, 0, 4, 22, 12, '#8d5a2b');
    ell(ctx, 6, 8, 12, 6, '#e8d8b0');
    // крыло
    poly(ctx, [-8, 0, 8, 0, -4, -22 * flap - 4], '#5a3a1a');
    // хвост
    poly(ctx, [-20, 0, -30, -6, -26, 8], '#3e2a14');
    // шея и голова
    ctx.fillStyle = '#fff';
    ctx.fillRect(12, -6, 7, 4);
    circ(ctx, 18, -12, 9, '#1b6b2a');
    poly(ctx, [25, -14, 36, -11, 25, -8], '#ff9800');
    if (this.state === 'hit' || this.state === 'fall') {
      line(ctx, 15, -16, 21, -10, '#fff', 2);
      line(ctx, 21, -16, 15, -10, '#fff', 2);
    } else {
      circ(ctx, 20, -14, 2.5, '#fff');
      circ(ctx, 20.5, -14, 1.2, '#111');
    }
    ctx.restore();
  }
}

function drawDog(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y + Math.abs(Math.sin(t * 14)) * -6);
  // туловище
  ell(ctx, 0, 70, 40, 46, '#a0682a');
  ell(ctx, 0, 70, 24, 34, '#f2e6d0');
  // лапы
  ell(ctx, -30, 36, 10, 14, '#a0682a');
  ell(ctx, 30, 36, 10, 14, '#a0682a');
  // голова
  ell(ctx, 0, 0, 30, 32, '#a0682a');
  ell(ctx, -30, 10, 12, 26, '#5a3510');
  ell(ctx, 30, 10, 12, 26, '#5a3510');
  ell(ctx, 0, 14, 20, 16, '#f2e6d0');
  ell(ctx, 0, 2, 7, 5, '#111');
  // глаза зажмурены от смеха
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(-11, -12, 6, Math.PI * 1.1, Math.PI * 1.9);
  ctx.moveTo(17, -12);
  ctx.arc(11, -12, 6, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  // пасть
  ell(ctx, 0, 22, 12, 8 + Math.abs(Math.sin(t * 14)) * 4, '#5a1010');
  ell(ctx, 0, 28, 7, 4, '#ff7a8a');
  ctx.restore();
}

// ---------- PvZ: подсолнух и горохострел ----------
function drawPlant(ctx, type, x, y, t, o = {}) {
  const sway = Math.sin(t * 2 + x) * 0.08;
  ctx.save();
  ctx.translate(x, y + 34);
  ctx.rotate(sway);
  ctx.translate(-x, -(y + 34));
  ell(ctx, x, y + 34, 22, 6, 'rgba(0,0,0,0.25)');
  line(ctx, x, y + 34, x, y - 2, '#2e7d32', 5);
  ell(ctx, x - 12, y + 22, 13, 6, '#43a047');
  ell(ctx, x + 12, y + 18, 13, 6, '#43a047');
  if (type === 'sunflower') {
    const hy = y - 10;
    if (o.glow > 0) circ(ctx, x, hy, 34, `rgba(255,230,80,${o.glow * 0.6})`);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + t * 0.3;
      ctx.save();
      ctx.translate(x + Math.cos(a) * 17, hy + Math.sin(a) * 17);
      ctx.rotate(a);
      ell(ctx, 0, 0, 9, 5, '#ffd21f');
      ctx.restore();
    }
    circ(ctx, x, hy, 14, '#7a4a18');
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#4e2c0a';
    ctx.stroke();
    ell(ctx, x - 5, hy - 3, 2, 3, '#111');
    ell(ctx, x + 5, hy - 3, 2, 3, '#111');
    ctx.beginPath();
    ctx.arc(x, hy + 2, 6, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    const rec = (o.shoot || 0) * 6;
    const hy = y - 8 + rec;
    poly(ctx, [x + 10, hy + 4, x + 26, hy - 2, x + 18, hy + 12], '#2e7d32');
    circ(ctx, x, hy, 18, '#66bb6a');
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#2e7d32';
    ctx.stroke();
    rr(ctx, x - 8, hy - 36, 16, 26, 4);
    ctx.fillStyle = '#66bb6a';
    ctx.fill();
    ctx.stroke();
    ell(ctx, x, hy - 36, 10, 5, '#1b5e20');
    circ(ctx, x - 7, hy - 2, 4, '#111');
    circ(ctx, x - 8, hy - 3, 1.3, '#fff');
  }
  ctx.restore();
}

// ---------- Among Us ----------
function drawCrewmate(ctx, x, y, s, color, t = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#111';
  rr(ctx, -30, -10, 14, 36, 6);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.stroke();
  rr(ctx, -20, -40, 44, 74, 22);
  ctx.fill();
  ctx.stroke();
  rr(ctx, -18, 22, 16, 22, 5);
  ctx.fill();
  ctx.stroke();
  rr(ctx, 6, 22, 16, 22, 5);
  ctx.fill();
  ctx.stroke();
  rr(ctx, -4, -28, 34, 20, 10);
  ctx.fillStyle = '#8fd3ff';
  ctx.fill();
  ctx.stroke();
  rr(ctx, 6, -24, 14, 6, 3);
  ctx.fillStyle = '#e8f7ff';
  ctx.fill();
  ctx.restore();
}
