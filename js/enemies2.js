'use strict';
/* Враги кампании: Гумба и Купа (Mario), Эндермен (Minecraft), коп (GTA), Соник. */

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
    if (g.state === 'play' && this.hit(Input.x, Input.y)) this.lookT += dt;
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
