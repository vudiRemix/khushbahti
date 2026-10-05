'use strict';
/* Враги кампании: Гумба и Купа (Mario), Эндермен (Minecraft), коп (GTA), Соник,
   драугр-щитоносец (Skyrim). */

Object.assign(ENEMY_DEF, {
  goomba: { hp: 2, dmg: 2, bounty: 60, xp: 2, hw: 26, top: 30, bot: 30, name: 'Гумба' },
  koopa: { hp: 4, dmg: 3, bounty: 120, xp: 4, hw: 24, top: 46, bot: 34, name: 'Купа' },
  enderman: { hp: 10, dmg: 4, bounty: 300, xp: 10, hw: 20, top: 88, bot: 36, name: 'Эндермен' },
  cop: { hp: 5, dmg: 3, bounty: 150, xp: 5, hw: 22, top: 52, bot: 36, name: 'Коп' },
  sonic: { hp: 4, dmg: 3, bounty: 400, xp: 10, hw: 28, top: 34, bot: 30, name: 'Соник' },
});

// ---------- Гумба ----------
function drawGoomba(ctx, x, y, t, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  if (o.squash) ctx.scale(1 + o.squash * 0.4, 1 - o.squash * 0.7);
  ell(ctx, 0, 32, 24, 6, 'rgba(0,0,0,0.25)');
  const step = o.walking ? Math.sin(t * 10) * 4 : 0;
  ell(ctx, -12 + step, 26, 12, 7, '#3e2008');
  ell(ctx, 12 - step, 26, 12, 7, '#3e2008');
  rr(ctx, -14, 2, 28, 22, 8);
  ctx.fillStyle = '#f2c79a';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-30, 8);
  ctx.quadraticCurveTo(-30, -30, 0, -30);
  ctx.quadraticCurveTo(30, -30, 30, 8);
  ctx.quadraticCurveTo(0, 14, -30, 8);
  ctx.fillStyle = '#8d4b1a';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#4e2a0c';
  ctx.stroke();
  ell(ctx, -9, -6, 6, 8, '#fff');
  ell(ctx, 9, -6, 6, 8, '#fff');
  circ(ctx, -7, -4, 3, '#111');
  circ(ctx, 7, -4, 3, '#111');
  line(ctx, -16, -16, -3, -11, '#111', 4);
  line(ctx, 16, -16, 3, -11, '#111', 4);
  poly(ctx, [-8, 6, -4, 6, -6, 11], '#fff');
  poly(ctx, [4, 6, 8, 6, 6, 11], '#fff');
  ctx.restore();
}

class Goomba extends Zombie {
  constructor(c) {
    super('goomba', c);
    this.speed = 30;
    this.groanT = 999;
  }
  draw(ctx, t) {
    this.beginDraw(ctx);
    drawGoomba(ctx, this.x, this.y, t + this.phase, { walking: !this.eating && this.frozen <= 0 && !this.dead, squash: this.dead ? Math.min(1, this.deathT / 0.15) : 0 });
    this.endDraw(ctx);
  }
}

// ---------- Купа ----------
function drawKoopa(ctx, x, y, t, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  ell(ctx, 0, 34, 22, 6, 'rgba(0,0,0,0.25)');
  const step = o.walking ? Math.sin(t * 7) * 3 : 0;
  ell(ctx, -10, 28 + step, 9, 6, '#ff9800');
  ell(ctx, 10, 28 - step, 9, 6, '#ff9800');
  ell(ctx, 0, 8, 22, 24, '#2e7d32');
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#f5f5f5';
  ctx.stroke();
  ell(ctx, 0, 10, 14, 18, '#fff3c4');
  for (let i = 0; i < 3; i++) line(ctx, -10, 2 + i * 8, 10, 2 + i * 8, 'rgba(150,120,40,0.5)', 2);
  ell(ctx, -20, 6, 6, 9, '#ffd54f');
  ell(ctx, 20, 6, 6, 9, '#ffd54f');
  circ(ctx, 0, -26, 14, '#ffd54f');
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#c79100';
  ctx.stroke();
  ell(ctx, -5, -30, 4, 6, '#fff');
  ell(ctx, 5, -30, 4, 6, '#fff');
  circ(ctx, -4, -29, 2, '#111');
  circ(ctx, 6, -29, 2, '#111');
  ell(ctx, 0, -20, 7, 3, '#e6a800');
  ctx.restore();
}

class Koopa extends Zombie {
  constructor(c) {
    super('koopa', c);
    this.speed = 20;
    this.groanT = 999;
  }
  draw(ctx, t) {
    this.beginDraw(ctx);
    if (this.dead) ctx.globalAlpha *= 0.5;
    drawKoopa(ctx, this.x, this.y, t + this.phase, { walking: !this.eating && this.frozen <= 0 && !this.dead });
    this.endDraw(ctx);
  }
}

// Панцирь убитого Купы катится по ряду и сбивает врагов.
class Shell {
  constructor(x, y, dir) {
    this.x = x;
    this.y = y;
    this.vx = dir * 560;
    this.bounces = 1;
    this.hitSet = new Set();
    this.t = 0;
    this.gone = false;
  }
  update(dt, g) {
    this.t += dt;
    this.x += this.vx * dt;
    if ((this.x < 30 && this.vx < 0) || (this.x > W - 30 && this.vx > 0)) {
      if (this.bounces-- > 0) {
        this.vx *= -1;
        this.hitSet.clear();
        Sound.bump();
      } else this.gone = true;
    }
    for (const e of g.enemies) {
      if (!e.alive || this.hitSet.has(e)) continue;
      if (Math.abs(e.y - this.y) < 42 && Math.abs(e.x - this.x) < 34) {
        this.hitSet.add(e);
        e.damage(6, g, 'shell');
        FX.text(g, e.x, e.y - 40, 'БАМ!', { color: '#7ee03c', font: `bold 18px ${FONT.gta}` });
        Sound.kick();
      }
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y + 14);
    ctx.rotate(this.t * 20);
    ell(ctx, 0, 0, 22, 18, '#2e7d32');
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#f5f5f5';
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      line(ctx, 0, 0, Math.cos(a) * 18, Math.sin(a) * 14, 'rgba(27,94,32,0.8)', 2);
    }
    ctx.restore();
  }
}

// ---------- Эндермен: телепортируется, если долго держать на нём прицел ----------
function drawEnderman(ctx, x, y, t, o = {}) {
  ctx.save();
  ctx.translate(x + (o.shake ? rand(-2, 2) : 0), y);
  ell(ctx, 0, 36, 18, 5, 'rgba(0,0,0,0.3)');
  const step = o.walking ? Math.sin(t * 4) * 3 : 0;
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(-9, -10, 5, 46 + step);
  ctx.fillRect(4, -10, 5, 46 - step);
  ctx.fillRect(-11, -46, 22, 38);
  ctx.fillRect(-18, -44, 5, 50);
  ctx.fillRect(13, -44, 5, 50);
  ctx.fillRect(-15, -78, 30, 30);
  ctx.shadowColor = '#e040fb';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#e040fb';
  ctx.fillRect(-12, -62, 9, 4);
  ctx.fillRect(3, -62, 9, 4);
  ctx.fillStyle = '#f3e5f5';
  ctx.fillRect(-9, -62, 3, 4);
  ctx.fillRect(6, -62, 3, 4);
  ctx.shadowBlur = 0;
  if (o.carry) {
    ctx.fillStyle = '#c3c3c3';
    ctx.fillRect(-14, -10, 28, 22);
    drawFlag(ctx, 0, -2, 0.7);
  }
  ctx.restore();
}

class Enderman extends Zombie {
  constructor(c) {
    super('enderman', c);
    this.speed = 12;
    this.groanT = 999;
    this.lookT = 0;
    this.tpCd = 0;
    this.carry = false;
  }
  update(dt, g) {
    if (this.dead || this.frozen > 0) return super.update(dt, g);
    if (this.tpCd > 0) this.tpCd -= dt;
    // на телефоне «взгляд» считается, только пока палец на экране
    if (g.state === 'play' && (!Input.touch || Input.lmb) && this.hit(Input.x, Input.y)) this.lookT += dt;
    else this.lookT = Math.max(0, this.lookT - dt);
    if (this.lookT >= 0.45 && this.tpCd <= 0) {
      FX.burst(g, this.x, this.y - 30, 16, { colors: ['#e040fb', '#7b1fa2', '#111'], size: 5, speed: 180, grav: 0, life: 0.6 });
      const row = Math.min(6, toRow(this.y) + randi(1, 2));
      this.x = colX(clamp(this.col + randi(-3, 3), 0, COLS - 1));
      this.y = this.gy = rowY(row);
      FX.burst(g, this.x, this.y - 30, 16, { colors: ['#e040fb', '#7b1fa2', '#111'], size: 5, speed: 180, grav: 0, life: 0.6 });
      FX.text(g, this.x, this.y - 100, 'ВЖУХ', { color: '#e040fb', font: `bold 16px ${FONT.ui}` });
      Sound.enderTp();
      this.lookT = 0;
      this.tpCd = 1.6;
    }
    super.update(dt, g);
    if (this.carry || !this.alive) return;
    const m = g.mf.at(this.x, this.y);
    if (m && m.cell.s === FLAG && !m.cell.mine && m.cell.pop >= 1) {
      m.cell.s = HIDDEN;
      this.carry = true;
      FX.text(g, this.x, this.y - 100, 'украл флажок!', { color: '#ce93d8', font: `bold 15px ${FONT.ui}` });
    }
  }
  draw(ctx, t) {
    this.beginDraw(ctx);
    drawEnderman(ctx, this.x, this.y, t + this.phase, { walking: !this.eating && this.frozen <= 0 && !this.dead, shake: this.lookT > 0, carry: this.carry });
    this.endDraw(ctx);
  }
}

// ---------- Коп: встаёт на 6-й ряд и стреляет по фигурам ----------
function drawCop(ctx, x, y, t, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  ell(ctx, 0, 38, 22, 6, 'rgba(0,0,0,0.25)');
  const step = o.walking ? Math.sin(t * 7) * 3 : 0;
  ctx.fillStyle = '#1a1a2e';
  rr(ctx, -12, 12 + step, 10, 26, 3);
  ctx.fill();
  rr(ctx, 2, 12 - step, 10, 26, 3);
  ctx.fill();
  rr(ctx, -17, -16, 34, 32, 6);
  ctx.fillStyle = '#1e3a8a';
  ctx.fill();
  ctx.fillStyle = '#ffd54f';
  ctx.fillRect(4, -10, 7, 7);
  ctx.fillStyle = '#111';
  ctx.fillRect(-17, 10, 34, 5);
  rr(ctx, 16, -8, 9, 20, 4);
  ctx.fillStyle = '#1e3a8a';
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(18, 10, 6, 12);
  ctx.fillRect(16, 18, 4, 8);
  if (o.flash) circ(ctx, 21, 28, 6, '#ffeb3b');
  circ(ctx, 0, -30, 14, '#e0ac69');
  ctx.fillStyle = '#111';
  ctx.fillRect(-11, -34, 22, 6);
  rr(ctx, -15, -48, 30, 10, 4);
  ctx.fillStyle = '#16213e';
  ctx.fill();
  ctx.fillRect(-18, -40, 36, 4);
  ctx.fillStyle = '#ffd54f';
  ctx.fillRect(-3, -46, 6, 5);
  line(ctx, -5, -21, 5, -21, '#6d4c41', 2);
  ctx.restore();
}

class Cop extends Zombie {
  constructor(c) {
    super('cop', c);
    this.speed = 22;
    this.groanT = 999;
    this.shootT = rand(0.5, 1.2);
    this.flashT = 0;
    this.shooting = false;
  }
  update(dt, g) {
    if (this.dead || this.frozen > 0) return super.update(dt, g);
    if (this.flashT > 0) this.flashT -= dt;
    const targets = [];
    for (let c = 1; c < COLS; c++) if (g.def[c]) targets.push(c);
    if (this.y >= rowY(5) - 10 && targets.length) {
      this.baseUpdate(dt);
      this.shooting = true;
      this.shootT -= dt;
      if (this.shootT <= 0) {
        this.shootT = 1.8;
        const c = targets.reduce((a, b) => (Math.abs(b - this.col) < Math.abs(a - this.col) ? b : a));
        const d = g.def[c];
        d.hp -= 1;
        d.hurt = 0.15;
        this.flashT = 0.08;
        g.tracers.push({ x1: this.x + 20, y1: this.y + 26, x2: colX(c), y2: rowY(PAWN_ROW), t: 0, w: 2 });
        Sound.pistol();
        if (d.hp <= 0) g.killDefender(c, this);
      }
      return;
    }
    this.shooting = false;
    super.update(dt, g);
  }
  draw(ctx, t) {
    this.beginDraw(ctx);
    drawCop(ctx, this.x, this.y, t + this.phase, { walking: !this.shooting && !this.eating && this.frozen <= 0 && !this.dead, flash: this.flashT > 0 });
    this.endDraw(ctx);
  }
}

// ---------- Соник: носится зигзагом, при попадании теряет кольца ----------
function drawSonic(ctx, x, y, t, o = {}) {
  const dir = o.dir || 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ell(ctx, 0, 30, 22, 6, 'rgba(0,0,0,0.25)');
  for (let i = 0; i < 3; i++) poly(ctx, [-10, -20 + i * 14, -40 - i * 2, -24 + i * 16, -12, -8 + i * 14], '#1e4fd8');
  circ(ctx, 0, -6, 22, '#2a5ff0');
  ell(ctx, 6, 2, 12, 12, '#f5cfa0');
  ell(ctx, 4, -12, 12, 10, '#fff');
  ell(ctx, 8, -12, 4, 6, '#2e7d32');
  circ(ctx, 18, -2, 3, '#111');
  const run = Math.sin(t * 30) * 6;
  ell(ctx, -6 + run, 22, 10, 6, '#e53935');
  ell(ctx, 6 - run, 24, 10, 6, '#e53935');
  ctx.fillStyle = '#fff';
  ctx.fillRect(-10 + run, 20, 8, 3);
  ctx.restore();
}

class Sonic extends Enemy {
  constructor(c) {
    super('sonic', colX(c), rowY(MF.r0));
    this.vx = choice([-1, 1]) * 240;
    this.vy = 42;
    this.sp = 1;
    this.stun = 0;
    this.phase = rand(0, 10);
  }
  damage(n, g, src) {
    const r = super.damage(n, g, src);
    if (!this.dead && r) {
      g.dropRings(this.x, this.y, 4);
      this.stun = 0.25;
      this.sp *= 1.15;
    }
    return r;
  }
  update(dt, g) {
    if (this.baseUpdate(dt)) return;
    if (this.stun > 0) {
      this.stun -= dt;
      return;
    }
    this.x += this.vx * this.sp * dt;
    this.y += this.vy * dt;
    this.gy = this.y;
    if ((this.x < 40 && this.vx < 0) || (this.x > W - 40 && this.vx > 0)) this.vx *= -1;
    g.checkTrapAt(this.x, this.y, this);
    if (this.y >= ROWS * T - 60) g.enemyReached(this);
  }
  draw(ctx, t) {
    this.beginDraw(ctx);
    if (this.stun > 0) ctx.globalAlpha *= 0.6;
    drawSonic(ctx, this.x, this.y, t + this.phase, { dir: Math.sign(this.vx) });
    this.endDraw(ctx);
  }
}

function drawRing(ctx, x, y, t) {
  const w = Math.abs(Math.cos(t * 6)) * 11 + 2;
  ctx.beginPath();
  ctx.ellipse(x, y, w, 12, 0, 0, TAU);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#f8b800';
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#fff3b0';
  ctx.stroke();
}

// ---------- Драугр-щитоносец (Skyrim) ----------
// Огромный круглый щит держит пули и горох. Щит опускается, только когда драугр кричит
// «ФУС РО ДА!» — крик оглушает твои фигуры рядом. Взрывы, мины, мяч и AWP щит не держит,
// а после DRAUGR.shield попаданий он раскалывается.
Object.assign(ENEMY_DEF, {
  draugr: { hp: 14, dmg: 5, bounty: 400, xp: 14, hw: 30, top: 76, bot: 36, name: 'Драугр-щитоносец' },
});

const DRAUGR = { shield: 14, speed: 11, shoutEvery: [5, 7.5], shoutTime: 1.6, stun: 2.5, stunR: 2.6 * T };

// Щит отбил пулю: металлический звон.
function draugrClank() {
  const a = Sound.audio();
  if (!a || Sound.muted) return;
  const t = a.ctx.currentTime;
  for (const [f, v] of [[1870, 0.05], [2710, 0.035], [940, 0.04]]) {
    const o = a.ctx.createOscillator(), g = a.ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(f * rand(0.97, 1.03), t);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g);
    g.connect(a.master);
    o.start(t);
    o.stop(t + 0.2);
  }
}

// «ФУС РО ДА!»: низкий рык с порывом ветра.
function draugrShout() {
  const a = Sound.audio();
  if (!a || Sound.muted) return;
  const { ctx, master, noiseBuf } = a;
  const t = ctx.currentTime;
  [0, 0.28, 0.56].forEach((d, i) => {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime([92, 84, 70][i], t + d);
    o.frequency.exponentialRampToValueAtTime([80, 74, 48][i], t + d + (i === 2 ? 0.7 : 0.24));
    f.type = 'lowpass';
    f.frequency.value = 700;
    g.gain.setValueAtTime(0.0001, t + d);
    g.gain.exponentialRampToValueAtTime(0.22, t + d + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + (i === 2 ? 0.8 : 0.26));
    o.connect(f);
    f.connect(g);
    g.connect(master);
    o.start(t + d);
    o.stop(t + d + 0.85);
  });
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuf;
  f.type = 'bandpass';
  f.frequency.setValueAtTime(400, t + 0.5);
  f.frequency.exponentialRampToValueAtTime(1800, t + 1.1);
  g.gain.setValueAtTime(0.0001, t + 0.5);
  g.gain.exponentialRampToValueAtTime(0.3, t + 0.65);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t + 0.5);
  src.stop(t + 1.35);
}

function drawDraugr(ctx, x, y, t, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  ell(ctx, 0, 32, 30, 7, 'rgba(0,0,0,0.28)');
  const step = o.walking ? Math.sin(t * 6) * 5 : 0;
  const bone = '#d8ccb0', boneD = '#8f846c';
  // ноги в лохмотьях
  line(ctx, -8, 6, -10 + step, 30, bone, 6);
  line(ctx, 8, 6, 10 - step, 30, bone, 6);
  rr(ctx, -15 + step, 26, 12, 7, 3);
  ctx.fillStyle = '#3a3129';
  ctx.fill();
  rr(ctx, 3 - step, 26, 12, 7, 3);
  ctx.fill();
  poly(ctx, [-17, 2, 17, 2, 20, 18, 8, 14, 0, 20, -8, 14, -20, 18], '#3b2f25');
  // ржавая кираса
  poly(ctx, [-17, -38, 17, -38, 14, 6, -14, 6], '#4f4b45');
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#2b2925';
  ctx.stroke();
  for (const [rx, ry] of [[-11, -32], [11, -32], [-9, 0], [9, 0]]) circ(ctx, rx, ry, 1.8, '#a1886a');
  line(ctx, -15, -16, 15, -16, '#3a3732', 2);
  // рука с мечом: машет, когда рубит фигуру
  const sw = o.swing ? Math.sin(t * 9) * 0.9 : 0;
  ctx.save();
  ctx.translate(15, -30);
  ctx.rotate(-0.5 + sw);
  line(ctx, 0, 0, 14, -14, bone, 5);
  line(ctx, 14, -14, 12, -58, '#a9b1b6', 6);
  line(ctx, 14, -14, 13, -56, '#e3e8ea', 2);
  line(ctx, 6, -16, 22, -12, '#6d5a3c', 4);
  ctx.restore();
  // голова: череп в рогатом шлеме, глаза светятся
  const open = o.shout ? 1 : 0;
  ell(ctx, 0, -52, 12, 13, bone);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = boneD;
  ctx.stroke();
  rr(ctx, -8, -45 + open * 2, 16, 6 + open * 6, 2);
  ctx.fillStyle = open ? '#0d1a22' : '#5c5446';
  ctx.fill();
  for (let i = -6; i <= 6; i += 3) line(ctx, i, -45 + open * 2, i, -42 + open * 2, bone, 1.5);
  ctx.save();
  ctx.shadowColor = '#7fdcff';
  ctx.shadowBlur = 10;
  circ(ctx, -5, -53, 3.2, '#bff0ff');
  circ(ctx, 5, -53, 3.2, '#bff0ff');
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, -55, 14, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = '#5b5f63';
  ctx.fill();
  ctx.stroke();
  line(ctx, 0, -69, 0, -55, '#3d4043', 3);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 12, -60);
    ctx.quadraticCurveTo(s * 30, -62, s * 28, -80);
    ctx.quadraticCurveTo(s * 22, -68, s * 10, -66);
    ctx.closePath();
    ctx.fillStyle = '#e6dcc3';
    ctx.fill();
    ctx.strokeStyle = '#8f846c';
    ctx.stroke();
  }
  // крик: голубые волны вперёд, к твоим фигурам
  if (o.shout) {
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const k = (t * 1.8 + i / 3) % 1;
      ctx.globalAlpha = (1 - k) * 0.7;
      ctx.beginPath();
      ctx.ellipse(0, -36 + k * 70, 14 + k * 70, 6 + k * 24, 0, 0, Math.PI);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#9fe3ff';
      ctx.stroke();
    }
    ctx.restore();
  }
  // огромный круглый щит: спереди — держит пули; во время крика отведён в сторону
  if (o.shield) {
    ctx.save();
    if (o.shout) {
      ctx.translate(-30, -4);
      ctx.scale(0.55, 1);
    } else ctx.translate(-2, -12);
    circ(ctx, 0, 0, 30, '#6a4f33');
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#7d8084';
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#c9a66b';
    ctx.beginPath();
    for (let a = 0; a < 5.4 * Math.PI; a += 0.2) {
      const r = 3 + a * 1.4;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    for (let i = 0; i < 8; i++) circ(ctx, Math.cos((i * TAU) / 8) * 25, Math.sin((i * TAU) / 8) * 25, 1.8, '#b0b4b8');
    circ(ctx, 0, 0, 5, '#9a9ea3');
    if (o.cracks) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(25,15,8,0.85)';
      ctx.beginPath();
      ctx.moveTo(-20, -14);
      ctx.lineTo(-6, -3);
      ctx.lineTo(-10, 10);
      if (o.cracks > 1) {
        ctx.moveTo(18, -16);
        ctx.lineTo(6, 2);
        ctx.lineTo(16, 18);
      }
      ctx.stroke();
    }
    ctx.restore();
  } else line(ctx, -15, -30, -26, -6, bone, 5);
  ctx.restore();
}

class Draugr extends Enemy {
  constructor(c) {
    super('draugr', colX(clamp(c, 1, COLS - 2)), rowY(MF.r0) - 14);
    this.shield = DRAUGR.shield; // сколько пуль ещё выдержит щит
    this.shoutT = rand(3, DRAUGR.shoutEvery[1]);
    this.shouting = 0; // > 0 — кричит, щит отведён
    this.eating = false;
    this.chompT = 0;
    this.phase = rand(0, 10);
  }
  get guarded() {
    return this.shield > 0 && this.shouting <= 0;
  }
  damage(n, g, src) {
    if (!this.alive) return false;
    if (this.guarded && ((src === 'gun' && g.weapon !== 'awp') || src === 'pea' || src === 'fist')) {
      this.shield--;
      this.shieldHit = true; // для hitFx: искры вместо крови
      FX.burst(g, this.x + rand(-16, 12), this.y - 12 + rand(-16, 16), 6, { colors: ['#fff6c0', '#ffd54a', '#cfd8dc'], size: 4, speed: 280, grav: 500, life: 0.3 });
      draugrClank();
      if (this.shield <= 0) {
        FX.burst(g, this.x - 2, this.y - 12, 16, { colors: ['#6a4f33', '#8d6e4a', '#7d8084'], size: 9, speed: 260, grav: 700, life: 0.8 });
        FX.text(g, this.x, this.y - 92, 'щит расколот!', { color: '#ffcc80', font: `bold 16px ${FONT.ui}` });
        Sound.stone();
      } else if (Math.random() < 0.3) FX.text(g, this.x, this.y - 88, 'БЛОК', { color: '#cfd8dc', font: `bold 14px ${FONT.ui}`, life: 0.6 });
      return false;
    }
    const r = super.damage(n, g, src);
    if (this.dead && this.shouting > 0) Ach.unlock('dovah');
    return r;
  }
  shout(g) {
    this.shouting = DRAUGR.shoutTime;
    this.shoutT = rand(...DRAUGR.shoutEvery);
    FX.text(g, this.x, this.y - 96, 'ФУС РО ДА!', { color: '#9fe3ff', font: `bold 22px ${FONT.title}`, life: 1.6, vy: -30 });
    draugrShout();
    g.shake = Math.max(g.shake, 6);
    // крик оглушает твои фигуры рядом: какое-то время они не бьют
    for (let c = 1; c < COLS; c++) {
      const d = g.def[c];
      if (d && Math.hypot(colX(c) - this.x, rowY(PAWN_ROW) - this.y) < DRAUGR.stunR) {
        d.cd = Math.max(d.cd, DRAUGR.stun);
        d.hurt = 0.3;
        FX.text(g, colX(c), rowY(PAWN_ROW) - 50, 'оглушён', { color: '#9fe3ff', font: `bold 13px ${FONT.ui}`, life: 1.2 });
      }
    }
  }
  update(dt, g) {
    if (this.baseUpdate(dt)) return;
    if (this.shouting > 0) this.shouting -= dt;
    else {
      this.shoutT -= dt;
      if (this.shoutT <= 0) this.shout(g);
    }
    const c = this.col, d = g.def[c];
    if (d && this.y >= PAWN_ROW * T - 26 && this.y < PAWN_ROW * T + 30) {
      this.eating = true;
      d.hp -= dt * 1.5;
      d.hurt = 0.1;
      this.chompT -= dt;
      if (this.chompT <= 0) {
        this.chompT = 0.6;
        Sound.punch();
      }
      if (d.hp <= 0) g.killDefender(c, this);
    } else {
      this.eating = false;
      if (this.shouting <= 0) this.y += DRAUGR.speed * dt * (g.bloodMoon ? 1.4 : 1);
    }
    this.gy = this.y;
    g.checkTrapAt(this.x, this.y, this);
    if (this.y >= ROWS * T - 60) g.enemyReached(this);
  }
  draw(ctx, t) {
    this.beginDraw(ctx);
    if (this.dead) {
      ctx.translate(this.x, this.y + 30);
      ctx.rotate(Math.min(1, this.deathT / 0.45) * 1.5);
      ctx.translate(-this.x, -(this.y + 30));
    }
    const lost = DRAUGR.shield - this.shield;
    drawDraugr(ctx, this.x, this.y, t + this.phase, {
      shield: this.shield > 0,
      cracks: lost >= DRAUGR.shield * 0.66 ? 2 : lost >= DRAUGR.shield * 0.33 ? 1 : 0,
      shout: this.shouting > 0,
      swing: this.eating,
      walking: !this.eating && this.shouting <= 0 && this.frozen <= 0 && !this.dead,
    });
    this.endDraw(ctx);
  }
}
