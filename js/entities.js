'use strict';
/* Враги, белые фигуры-защитники, Пак-Ман, предметы, аирдропы и снаряды. */

const ENEMY_DEF = {
  pawn: { hp: 3, dmg: 2, bounty: 50, xp: 3, hw: 24, top: 36, bot: 34, name: 'Чёрная пешка', piece: 'p' },
  knight: { hp: 5, dmg: 3, bounty: 120, xp: 5, hw: 26, top: 38, bot: 34, name: 'Чёрный конь', piece: 'n' },
  rook: { hp: 9, dmg: 4, bounty: 200, xp: 8, hw: 26, top: 36, bot: 34, name: 'Чёрная ладья', piece: 'r' },
  bishop: { hp: 6, dmg: 3, bounty: 150, xp: 6, hw: 24, top: 40, bot: 34, name: 'Чёрный слон', piece: 'b' },
  zombie: { hp: 5, dmg: 4, bounty: 100, xp: 4, hw: 24, top: 42, bot: 36, name: 'Зомби' },
  cone: { hp: 10, dmg: 4, bounty: 150, xp: 6, hw: 24, top: 64, bot: 36, name: 'Зомби с конусом' },
  freddy: { hp: 6, dmg: 6, bounty: 500, xp: 15, hw: 26, top: 56, bot: 36, name: 'Золотой Фредди' },
  snake: { hp: 15, dmg: 4, bounty: 300, xp: 12, hw: 30, top: 30, bot: 30, name: 'Змейка' },
};

const FX = {
  burst(g, x, y, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = o.angle !== undefined ? o.angle + rand(-o.spread, o.spread) : rand(0, TAU);
      const sp = rand((o.speed || 200) * 0.3, o.speed || 200);
      const life = rand((o.life || 0.6) * 0.6, o.life || 0.6);
      g.particles.push({
        x: x + rand(-(o.jitter || 0), o.jitter || 0),
        y: y + rand(-(o.jitter || 0), o.jitter || 0),
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (o.up || 0),
        grav: o.grav !== undefined ? o.grav : 500,
        life,
        max: life,
        size: rand((o.size || 5) * 0.6, o.size || 5),
        color: Array.isArray(o.colors) ? choice(o.colors) : o.colors || '#fff',
        shape: o.shape || 'sq',
        rot: rand(0, TAU),
        vr: rand(-10, 10),
        drag: o.drag || 0,
      });
    }
    if (g.particles.length > 700) g.particles.splice(0, g.particles.length - 700);
  },
  text(g, x, y, str, o = {}) {
    g.texts.push({
      x, y, str,
      color: o.color || '#fff',
      font: o.font || `bold 18px ${FONT.ui}`,
      life: o.life || 1.1,
      max: o.life || 1.1,
      vy: o.vy !== undefined ? o.vy : -50,
      stroke: o.stroke || '#000',
    });
  },
};

class Enemy {
  constructor(type, x, y) {
    const d = ENEMY_DEF[type];
    this.type = type;
    this.def = d;
    this.x = x;
    this.y = y;
    this.gy = y;
    this.hp = d.hp;
    this.maxHp = d.hp;
    this.flash = 0;
    this.frozen = 0;
    this.dazed = 0; // оглушён (крик футболиста): стоит, над головой кружатся звёзды
    this.age = 0;
    this.dead = false;
    this.remove = false;
    this.deathT = 0;
    this.air = false;
    this.spawnFx = 0.35;
  }
  get alive() {
    return !this.dead && !this.remove;
  }
  get col() {
    return clamp(Math.floor(this.x / T), 0, COLS - 1);
  }
  hit(px, py) {
    const d = this.def;
    return px >= this.x - d.hw && px <= this.x + d.hw && py >= this.y - d.top && py <= this.y + d.bot;
  }
  distTo(px, py) {
    return Math.hypot(px - this.x, py - this.y);
  }
  damage(n, g, src) {
    if (!this.alive) return false;
    if (g.hotline && src !== 'plague') n = Math.max(n, this.hp); // маска Ричарда: с одного удара
    this.hp -= n;
    this.flash = 0.09;
    if (this.hp <= 0) {
      this.dead = true;
      this.deathT = 0;
      g.onKill(this, src);
    }
    return true;
  }
  // Общая часть обновления. true — движение в этом кадре пропускается.
  baseUpdate(dt) {
    this.age += dt;
    if (this.spawnFx > 0) this.spawnFx -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.dead) {
      this.deathT += dt;
      if (this.deathT > 0.6) this.remove = true;
      return true;
    }
    if (this.frozen > 0) {
      this.frozen -= dt;
      return true;
    }
    if (this.dazed > 0) {
      this.dazed -= dt;
      return true;
    }
    return false;
  }
  beginDraw(ctx) {
    ctx.save();
    if (this.dead) ctx.globalAlpha = Math.max(0, 1 - this.deathT / 0.6);
    if (this.flash > 0) ctx.filter = 'brightness(2.6)';
    if (this.spawnFx > 0) {
      const k = 1 - this.spawnFx / 0.35;
      ctx.globalAlpha *= k;
    }
  }
  endDraw(ctx) {
    ctx.restore();
    // заражён чумой: зелёное облачко и знак биоопасности
    if (this.infected && !this.dead) {
      const d = this.def;
      ctx.save();
      ctx.globalAlpha = 0.22 + Math.sin(this.age * 5) * 0.06;
      ell(ctx, this.x, this.y - d.top / 2 + d.bot / 2, d.hw + 8, (d.top + d.bot) / 2 + 6, '#76ff03');
      ctx.restore();
      drawBiohazard(ctx, this.x + d.hw * 0.7, this.y - d.top - 4, 9, '#64dd17');
    }
    if (this.dazed > 0 && !this.dead) {
      const d = this.def, a = this.age * 6;
      for (let i = 0; i < 3; i++) {
        const k = a + (i * TAU) / 3;
        drawStar(ctx, this.x + Math.cos(k) * (d.hw * 0.8), this.y - d.top - 8 + Math.sin(k) * 5, 6, '#ffd54a', '#7a5b00');
      }
    }
    if (this.frozen > 0 && !this.dead) {
      const d = this.def;
      rr(ctx, this.x - d.hw - 4, this.y - d.top - 4, d.hw * 2 + 8, d.top + d.bot + 8, 8);
      ctx.fillStyle = 'rgba(170,225,255,0.45)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.stroke();
    }
    if (this.alive && this.hp < this.maxHp) {
      const w = 40, x = this.x - w / 2, y = this.y - this.def.top - 12;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - 1, y - 1, w + 2, 6);
      ctx.fillStyle = '#e53935';
      ctx.fillRect(x, y, w * Math.max(0, this.hp / this.maxHp), 4);
    }
  }
}

// Шахматные фигуры ходят по правилам (почти).
class ChessEnemy extends Enemy {
  constructor(type, c, r) {
    super(type, colX(c), rowY(r));
    this.c = c;
    this.r = r;
    this.wait = this.interval() * rand(0.5, 0.9);
    this.mv = null;
    this.dx = Math.random() < 0.5 ? -1 : 1;
  }
  interval() {
    return { pawn: 2.4, knight: 2.6, rook: 3.0, bishop: 2.3 }[this.type];
  }
  update(dt, g) {
    if (this.baseUpdate(dt)) return;
    if (this.mv) {
      const m = this.mv;
      m.t += dt / m.dur;
      const k = Math.min(1, m.t);
      const e = easeInOut(k);
      this.x = lerp(m.fx, m.tx, e);
      this.gy = lerp(m.fy, m.ty, e);
      this.y = this.gy - Math.sin(k * Math.PI) * m.arc;
      this.air = m.arc > 0 && k < 0.9;
      if (k >= 1) {
        this.mv = null;
        this.air = false;
        this.c = m.c;
        this.r = m.r;
        this.land(g, m);
      }
      return;
    }
    this.wait -= dt;
    if (this.wait <= 0) {
      this.wait = this.interval() * rand(0.85, 1.15);
      this.plan(g);
    }
  }
  moveTo(c, r, capture, arc, dur) {
    this.mv = { fx: this.x, fy: this.gy, tx: colX(c), ty: rowY(r), c, r, capture, arc, dur, t: 0 };
  }
  land(g, m) {
    Sound.tok();
    if (m.capture && g.def[m.c]) {
      g.killDefender(m.c, this);
      FX.text(g, this.x, this.y - 40, 'ВЗЯТИЕ!', { color: '#ffd54a' });
    }
    if (this.r >= ROWS - 1) {
      if (this.type === 'pawn') FX.text(g, this.x, this.y - 50, 'ПРЕВРАЩЕНИЕ!', { color: '#ff7aa8' });
      g.enemyReached(this);
      return;
    }
    g.checkTrapAt(this.x, this.gy, this);
  }
  plan(g) {
    const c = this.c, r = this.r;
    if (this.type === 'pawn') {
      const nr = r + 1;
      if (nr === PAWN_ROW && g.def[c]) {
        // пешка не может идти вперёд в занятую клетку — только бить наискосок
        const opts = [c - 1, c + 1].filter((cc) => cc >= 0 && cc < COLS && g.def[cc]);
        if (opts.length) this.moveTo(choice(opts), nr, true, 20, 0.35);
      } else {
        this.moveTo(c, nr, false, 20, 0.35);
      }
    } else if (this.type === 'knight') {
      const opts = [];
      for (const [dr, dc] of [[2, 1], [2, -1], [1, 2], [1, -2]]) {
        const cc = c + dc, rr2 = r + dr;
        if (cc >= 0 && cc < COLS && rr2 <= ROWS - 1) opts.push([cc, rr2]);
      }
      const [cc, rr2] = opts.length ? choice(opts) : [c, r + 1];
      this.moveTo(cc, rr2, rr2 === PAWN_ROW && !!g.def[cc], 46, 0.45);
    } else if (this.type === 'rook') {
      let nr = Math.min(ROWS - 1, r + 2);
      if (r < PAWN_ROW && nr >= PAWN_ROW && g.def[c]) nr = PAWN_ROW;
      this.moveTo(c, nr, nr === PAWN_ROW && !!g.def[c], 0, 0.3);
    } else if (this.type === 'bishop') {
      if (c + this.dx < 0 || c + this.dx >= COLS) this.dx *= -1;
      const cc = c + this.dx, nr = r + 1;
      this.moveTo(cc, nr, nr === PAWN_ROW && !!g.def[cc], 12, 0.35);
    }
  }
  draw(ctx) {
    if (this.air) ell(ctx, this.x, this.gy + 34, 22, 6, 'rgba(0,0,0,0.22)');
    this.beginDraw(ctx);
    if (this.dead) {
      ctx.translate(this.x, this.gy + 34);
      ctx.rotate(Math.min(1, this.deathT / 0.4) * 1.4);
      ctx.translate(-this.x, -(this.gy + 34));
    }
    drawPiece(ctx, this.def.piece, false, this.x, this.y, 70, { shadow: !this.air });
    this.endDraw(ctx);
  }
}

class Zombie extends Enemy {
  constructor(type, c) {
    super(type, colX(c) + rand(-6, 6), rowY(MF.r0) - 10);
    this.speed = type === 'cone' ? 13 : 15;
    this.eating = false;
    this.chompT = 0;
    this.groanT = rand(3, 9);
    this.phase = rand(0, 10);
  }
  damage(n, g, src) {
    const hadCone = this.type === 'cone' && this.hp > 5;
    const r = super.damage(n, g, src);
    if (hadCone && this.hp <= 5 && !this.dead) {
      FX.burst(g, this.x, this.y - 60, 6, { colors: ['#f08a24', '#ffb35c'], size: 8, speed: 180, up: 120 });
      FX.text(g, this.x, this.y - 70, 'конус слетел!', { color: '#ffb35c', font: `bold 14px ${FONT.ui}` });
    }
    return r;
  }
  update(dt, g) {
    if (this.baseUpdate(dt)) return;
    const c = this.col, d = g.def[c];
    const contact = PAWN_ROW * T - 24;
    if (d && this.y >= contact && this.y < PAWN_ROW * T + 30) {
      this.eating = true;
      d.hp -= dt;
      d.hurt = 0.1;
      this.chompT -= dt;
      if (this.chompT <= 0) {
        this.chompT = 0.5;
        Sound.chomp();
      }
      if (d.hp <= 0) g.killDefender(c, this);
    } else {
      this.eating = false;
      this.y += this.speed * dt * (g.bloodMoon ? 1.4 : 1);
    }
    this.gy = this.y;
    this.groanT -= dt;
    if (this.groanT <= 0) {
      this.groanT = rand(7, 15);
      Sound.groan();
    }
    g.checkTrapAt(this.x, this.y, this);
    if (this.y >= ROWS * T - 60) g.enemyReached(this);
  }
  draw(ctx, t) {
    this.beginDraw(ctx);
    if (this.dead) {
      ctx.translate(this.x, this.y + 30);
      ctx.rotate(-Math.min(1, this.deathT / 0.45) * 1.5);
      ctx.translate(-this.x, -(this.y + 30));
    }
    drawZombie(ctx, this.x, this.y, t + this.phase, {
      cone: this.type === 'cone' && this.hp > 5,
      eating: this.eating,
      walking: !this.eating && this.frozen <= 0 && !this.dead,
    });
    this.endDraw(ctx);
  }
}

// Появляется только ночью (с 00:00 до 06:00) и телепортируется к игроку.
class Freddy extends Enemy {
  constructor(c, r) {
    super('freddy', colX(c), rowY(r));
    this.c = c;
    this.r = r;
    this.tp = 1.9;
    this.glitch = 0.4;
    this.spawnFx = 0.6;
    Sound.staticNoise();
  }
  update(dt, g) {
    if (this.baseUpdate(dt)) return;
    if (this.glitch > 0) this.glitch -= dt;
    this.tp -= dt;
    if (this.tp <= 0) {
      this.tp = rand(1.4, 2.0);
      if (this.r + 1 >= PAWN_ROW) {
        g.startJumpscare(this);
        return;
      }
      this.r += 1;
      this.c = clamp(this.c + randi(-1, 1), 0, COLS - 1);
      this.x = colX(this.c);
      this.y = this.gy = rowY(this.r);
      this.glitch = 0.25;
      g.staticFx = 0.15;
      Sound.staticNoise();
    }
  }
  draw(ctx, t) {
    this.beginDraw(ctx);
    ctx.globalAlpha *= 0.82 + Math.sin(t * 23) * 0.12;
    let ox = 0;
    if (this.glitch > 0) ox = rand(-8, 8);
    drawFreddy(ctx, this.x + ox, this.y, t, { glow: true });
    if (this.glitch > 0) {
      ctx.globalAlpha *= 0.4;
      drawFreddy(ctx, this.x - ox * 2, this.y, t, { glow: true });
    }
    this.endDraw(ctx);
  }
}

// Змейка ползёт «змейкой» по рядам, как в старых играх, и ест предметы.
class Snake extends Enemy {
  constructor(fromLeft) {
    super('snake', 0, 0);
    this.dir = fromLeft ? 1 : -1;
    const len = 5;
    this.segs = [];
    for (let i = 0; i < len; i++) this.segs.push({ c: fromLeft ? -1 - i : COLS + i, r: MF.r0 });
    this.prev = this.segs.map((s) => ({ ...s }));
    this.hp = this.maxHp = len * 3;
    this.stepT = 0;
    this.stepDur = 0.26;
    this.k = 1;
    this.mdx = this.dir;
    this.mdy = 0;
    this.spawnFx = 0;
    this.sync();
    Sound.hiss();
  }
  segPos(i) {
    const a = this.prev[i] || this.segs[i], b = this.segs[i];
    return { x: lerp(colX(a.c), colX(b.c), this.k), y: lerp(rowY(a.r), rowY(b.r), this.k) };
  }
  sync() {
    const h = this.segPos(0);
    this.x = h.x;
    this.y = this.gy = h.y;
  }
  hit(px, py) {
    for (let i = 0; i < this.segs.length; i++) {
      const p = this.segPos(i);
      if (dist2(px, py, p.x, p.y) < 34 * 34) return true;
    }
    return false;
  }
  distTo(px, py) {
    let best = Infinity;
    for (let i = 0; i < this.segs.length; i++) {
      const p = this.segPos(i);
      best = Math.min(best, Math.hypot(px - p.x, py - p.y));
    }
    return best;
  }
  inRow(row) {
    return this.segs.some((s) => s.r === row);
  }
  damage(n, g, src) {
    const r = super.damage(n, g, src);
    while (!this.dead && this.segs.length > 2 && this.hp <= 3 * (this.segs.length - 1)) {
      const tail = this.segs.pop();
      this.prev.length = this.segs.length;
      FX.burst(g, colX(tail.c), rowY(tail.r), 10, { colors: ['#4a7cf0', '#27479f', '#9bb8ff'], size: 9, speed: 220 });
    }
    return r;
  }
  update(dt, g) {
    if (this.baseUpdate(dt)) return;
    this.stepT += dt;
    this.k = Math.min(1, this.stepT / this.stepDur);
    if (this.stepT >= this.stepDur) {
      this.stepT -= this.stepDur;
      this.k = 0;
      this.step(g);
    }
    this.sync();
  }
  step(g) {
    this.prev = this.segs.map((s) => ({ ...s }));
    const h = this.segs[0];
    let nc = h.c + this.dir, nr = h.r;
    const inside = h.c >= 0 && h.c < COLS;
    if (inside && (nc < 0 || nc >= COLS)) {
      nc = h.c;
      nr = h.r + 1;
      this.dir *= -1;
    }
    this.mdx = Math.sign(nc - h.c);
    this.mdy = Math.sign(nr - h.r);
    for (let i = this.segs.length - 1; i > 0; i--) this.segs[i] = { ...this.segs[i - 1] };
    this.segs[0] = { c: nc, r: nr };
    if (nr >= PAWN_ROW) {
      if (g.def[nc]) g.killDefender(nc, this);
      g.enemyReached(this);
      return;
    }
    // съедает предметы на пути и растёт
    const hx = colX(nc), hy = rowY(nr);
    for (const it of g.items) {
      if (it.gone || it.falling) continue;
      if (Math.abs(it.x - hx) < T / 2 && Math.abs(it.y - hy) < T / 2) {
        it.gone = true;
        const tail = this.prev[this.prev.length - 1];
        this.segs.push({ ...tail });
        this.prev.push({ ...tail });
        this.hp += 3;
        this.maxHp += 3;
        FX.text(g, hx, hy - 40, 'ням!', { color: '#9bb8ff' });
        Sound.chomp();
      }
    }
    g.checkTrapAt(hx, hy, this);
  }
  draw(ctx, t) {
    const pts = this.segs.map((_, i) => this.segPos(i));
    ctx.save();
    if (this.dead) ctx.globalAlpha = Math.max(0, 1 - this.deathT / 0.6);
    if (this.flash > 0) ctx.filter = 'brightness(1.8)';
    drawSnake(ctx, pts, this.mdx, this.mdy, t, { color: this.frozen > 0 ? '#9fd4ff' : null });
    ctx.restore();
    if (this.alive && this.hp < this.maxHp) {
      const w = 40, x = this.x - w / 2, y = this.y - 46;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - 1, y - 1, w + 2, 6);
      ctx.fillStyle = '#e53935';
      ctx.fillRect(x, y, w * Math.max(0, this.hp / this.maxHp), 4);
    }
  }
}

// ---------- белые фигуры игрока ----------
const DEF_STATS = {
  pawn: { hp: 4, cost: 50, cd: 1.4, name: 'Пешка', piece: 'p', info: 'бьёт наискосок' },
  bishop: { hp: 4, cost: 100, cd: 1.8, name: 'Слон', piece: 'b', info: 'стреляет по диагоналям' },
  rook: { hp: 14, cost: 125, cd: 0, name: 'Ладья', piece: 'r', info: 'крепкая стена' },
};
const PACKETS = ['pawn', 'bishop', 'rook'];

function makeDefender(type) {
  const s = DEF_STATS[type];
  const cd = type === 'sunflower' ? 5 : rand(0, s.cd);
  return { type, hp: s.hp, maxHp: s.hp, cd, lunge: 0, lungeDir: 0, pop: 0, hurt: 0, glow: 0, shoot: 0 };
}

function drawDefender(ctx, d, c, t) {
  const x = colX(c) + d.lungeDir * Math.sin(d.lunge * Math.PI) * 26;
  const y = rowY(PAWN_ROW) - Math.sin(d.lunge * Math.PI) * 18;
  const k = easeOutCubic(Math.min(1, d.pop));
  ctx.save();
  ctx.translate(x, y + 30);
  ctx.scale(k, k);
  ctx.translate(-x, -(y + 30));
  if (d.hurt > 0) ctx.filter = 'brightness(0.7) sepia(1) hue-rotate(-50deg) saturate(4)';
  if (DEF_STATS[d.type].plant) drawPlant(ctx, d.type, x, y, t, { glow: d.glow, shoot: d.shoot });
  else drawPiece(ctx, DEF_STATS[d.type].piece, true, x, y, d.type === 'rook' ? 70 : 66);
  ctx.restore();
  if (d.hp < d.maxHp) {
    const w = 36, bx = colX(c) - w / 2, by = rowY(PAWN_ROW) - 42;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(bx - 1, by - 1, w + 2, 5);
    ctx.fillStyle = '#7ee03c';
    ctx.fillRect(bx, by, w * Math.max(0, d.hp / d.maxHp), 3);
  }
}

// ---------- Пак-Ман: «газонокосилка» последнего ряда ----------
class PacMan {
  constructor() {
    this.state = 'parked';
    this.x = 40;
    this.row = PAWN_ROW;
    this.y = rowY(PAWN_ROW);
    this.mouth = 0;
    this.cool = 0;
    this.combo = 0;
    this.power = false;
    this.wakaT = 0;
  }
  launch(row, power) {
    if (this.state === 'run') return false;
    this.row = row;
    this.y = rowY(row);
    if (!(this.state === 'parked' && row === PAWN_ROW)) this.x = -50;
    this.state = 'run';
    this.combo = 0;
    this.power = power;
    return true;
  }
  update(dt, g) {
    this.mouth += dt * 14;
    if (this.state === 'run') {
      this.x += 640 * dt;
      this.wakaT -= dt;
      if (this.wakaT <= 0) {
        this.wakaT = 0.13;
        Sound.waka();
      }
      const band = this.row === PAWN_ROW ? 72 : 46;
      for (const e of g.enemies) {
        if (!e.alive) continue;
        let near;
        if (e instanceof Snake) near = e.segs.some((s) => Math.abs(rowY(s.r) - this.y) < band && Math.abs(colX(s.c) - this.x) < 40);
        else near = Math.abs(e.y - this.y) < band && Math.abs(e.x - this.x) < 40;
        if (near) {
          this.combo++;
          const pts = 100 * Math.pow(2, Math.min(4, this.combo));
          e.damage(999, g, 'pac');
          g.addMoney(pts, e.x, e.y - 50, '#7ff');
          Sound.pacEat();
          if (this.combo >= 5) Ach.unlock('waka');
        }
      }
      if (this.x > W + 60) {
        if (this.power) {
          this.state = 'return';
          this.x = -50;
          this.row = PAWN_ROW;
          this.y = rowY(PAWN_ROW);
        } else {
          this.state = 'gone';
          this.cool = 35;
        }
      }
    } else if (this.state === 'gone') {
      this.cool -= dt;
      if (this.cool <= 0) {
        this.state = 'return';
        this.x = -50;
        this.row = PAWN_ROW;
        this.y = rowY(PAWN_ROW);
      }
    } else if (this.state === 'return') {
      this.x += 110 * dt;
      if (this.x >= 40) {
        this.x = 40;
        this.state = 'parked';
        g.say('Пак-Ман вернулся на пост.', '#ffe600');
      }
    }
  }
  draw(ctx, t) {
    if (this.state === 'gone') return;
    const r = this.power ? 34 : 28;
    if (this.state === 'parked') {
      for (const dx of [84, 108]) circ(ctx, dx, this.y, 4, '#ffe9b0');
    }
    drawPac(ctx, this.x, this.y, r, 0, this.state === 'parked' ? this.mouth * 0.4 : this.mouth, this.power ? '#fff04a' : '#ffe600');
  }
}

// ---------- предметы на доске ----------
class Loot {
  constructor(kind, key, x, y, ty, vy) {
    this.kind = kind; // 'sun' | 'item'
    this.key = key;
    this.x = x;
    this.y = y;
    this.ty = ty;
    this.vy = vy;
    this.falling = y < ty;
    this.life = kind === 'sun' ? 12 : 14;
    this.t = rand(0, 5);
    this.gone = false;
  }
  update(dt) {
    this.t += dt;
    if (this.falling) {
      this.y += this.vy * dt;
      if (this.y >= this.ty) {
        this.y = this.ty;
        this.falling = false;
      }
    } else {
      this.life -= dt;
      if (this.life <= 0) this.gone = true;
    }
  }
  draw(ctx) {
    if (this.life < 3 && Math.floor(this.t * 8) % 2 === 0) return;
    if (this.kind === 'sun') {
      drawSun(ctx, this.x, this.y, 20, this.t);
    } else {
      const by = this.y + Math.sin(this.t * 3) * 3;
      circ(ctx, this.x, by, 24, 'rgba(255,255,255,0.35)');
      drawItemIcon(ctx, this.key, this.x, by, 34, this.t);
    }
  }
}

class Airdrop {
  constructor() {
    this.x = rand(260, 1020);
    this.y = -120;
    this.ty = rand(270, 470);
    this.state = 'fall';
    this.t = 0;
    this.life = 16;
    this.smokeT = 0;
    this.gone = false;
  }
  update(dt, g) {
    this.t += dt;
    if (this.state === 'fall') {
      this.y += 48 * dt;
      if (this.y >= this.ty) {
        this.y = this.ty;
        this.state = 'land';
        Sound.thud();
        FX.burst(g, this.x, this.y + 20, 14, { colors: ['#c8b89a', '#a89878'], size: 6, speed: 160, grav: 300 });
      }
    } else {
      this.life -= dt;
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = 0.08;
        FX.burst(g, this.x + 26, this.y - 20, 1, { colors: ['rgba(230,60,50,0.55)', 'rgba(255,90,80,0.45)'], size: 22, speed: 30, grav: -60, life: 1.8, shape: 'circle', angle: -Math.PI / 2, spread: 0.6 });
      }
      if (this.life <= 0) this.gone = true;
    }
  }
  hit(px, py) {
    if (Math.abs(px - this.x) < 40 && py > this.y - 34 && py < this.y + 34) return true;
    return this.state === 'fall' && Math.abs(px - this.x) < 96 && py > this.y - 190 && py < this.y - 30;
  }
  draw(ctx) {
    if (this.state === 'land' && this.life < 3 && Math.floor(this.t * 8) % 2 === 0) return;
    drawAirdrop(ctx, this.x, this.y, this.t, this.state === 'land');
  }
}

// Ядро из королевской пушки летит прямо в камеру — его надо сбить.
class Cannonball {
  constructor(tx, ty, sx = 640, sy = 98, kind = 'ball') {
    this.kind = kind;
    this.sx = sx;
    this.sy = sy;
    this.tx = tx;
    this.ty = ty;
    this.t = 0;
    this.dur = 2.8;
    this.gone = false;
  }
  get k() {
    return Math.min(1, this.t / this.dur);
  }
  get pos() {
    const k = this.k;
    return { x: lerp(this.sx, this.tx, k), y: lerp(this.sy, this.ty, k) - Math.sin(k * Math.PI) * 70, s: 0.25 + 2.1 * k * k };
  }
  hit(px, py) {
    const p = this.pos;
    const r = 15 * p.s + 16;
    return dist2(px, py, p.x, p.y) < r * r;
  }
  draw(ctx) {
    const p = this.pos;
    const k = this.k;
    // прицельная метка — куда прилетит
    ctx.save();
    ctx.globalAlpha = 0.4 + k * 0.5;
    ctx.strokeStyle = '#ff2b2b';
    ctx.lineWidth = 3;
    const rr2 = 60 - k * 30;
    ctx.beginPath();
    ctx.arc(this.tx, this.ty, rr2, 0, TAU);
    ctx.stroke();
    line(ctx, this.tx - rr2 - 8, this.ty, this.tx - rr2 + 10, this.ty, '#ff2b2b', 3);
    line(ctx, this.tx + rr2 - 10, this.ty, this.tx + rr2 + 8, this.ty, '#ff2b2b', 3);
    ctx.restore();
    drawProjectile(ctx, this.kind, p.x, p.y, 15 * p.s, this.t);
  }
}
