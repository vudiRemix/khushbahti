'use strict';
/* Боссы уровней: башня короля (Clash Royale), Боузер (Mario), Эндер-дракон (Minecraft),
   полицейский вертолёт (GTA) и Скибиди-Титан. У всех общий интерфейс:
   box — зона попадания, attack() — снаряд в экран, special() — особая атака,
   onRage() — подкрепление на 66% и 33% здоровья. */

class Boss {
  constructor(kind, hp) {
    this.kind = kind;
    this.hp = this.max = hp;
    this.dead = false;
    this.deadT = 0;
    this.boomT = 0;
    this.phase = 0;
    this.hit = 0;
    this.fire = 0;
    this.laugh = 0;
    this.emote = '';
    this.emoteT = 0;
    this.stunT = 0;
    this.t = 0;
    this.attackT = 6;
    this.specialT = 12;
    this.projectile = 'ball';
  }
  get box() {
    return { x: 510, y: 10, w: 260, h: 156 };
  }
  get center() {
    const b = this.box;
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  }
  get muzzle() {
    return { x: 640, y: 98 };
  }
  hitSpecial() {
    return false;
  }
  attackInterval(g) {
    return Math.max(4.0, 8.5 - g.stars * 0.5 - (1 - this.hp / this.max) * 2) * rand(0.85, 1.15);
  }
  specialInterval() {
    return 999;
  }
  move() {}
  update(dt, g) {
    this.t += dt;
    if (this.fire > 0) this.fire -= dt;
    if (this.laugh > 0) this.laugh -= dt;
    if (this.emoteT > 0) this.emoteT -= dt;
    this.move(dt, g);
    if (this.stunT > 0) {
      this.stunT -= dt;
      return;
    }
    this.attackT -= dt;
    if (this.attackT <= 0) {
      this.attackT = this.attackInterval(g);
      this.attack(g);
    }
    this.specialT -= dt;
    if (this.specialT <= 0) {
      this.specialT = this.specialInterval(g);
      this.special(g);
    }
  }
  attack(g) {
    const m = this.muzzle;
    g.cannonballs.push(new Cannonball(rand(220, 1060), rand(230, 560), m.x, m.y, this.projectile));
    this.fire = 0.3;
    Sound.cannon();
    FX.burst(g, m.x, m.y, 8, { colors: ['rgba(80,80,80,0.6)'], size: 20, speed: 80, grav: -30, life: 0.8, shape: 'circle' });
  }
  special() {}
  onRage() {}
}

// ---------- 1. Королевская башня ----------
class TowerBoss extends Boss {
  constructor(hp) {
    super('tower', hp);
    this.name = 'Королевская башня';
    this.speaker = 'Король';
    this.rageText = 'Из башни вышел Мегарыцарь!';
    this.deathText = 'Король повержен';
    this.emotes = ['Хе-хе-хе!', 'Ха-ха!', 'Получай!'];
  }
  onRage(g) {
    g.spawnEnemy('mega');
    for (let i = 0; i < 4; i++) g.spawnEnemy(choice(['pawn', 'zombie', 'cone', 'knight']));
    if (!g.enemies.some((e) => e.alive && e.type === 'snake')) g.spawnEnemy('snake');
  }
  draw(ctx, t) {
    drawTower(ctx, 640, t, { hpRatio: this.hp / this.max, hp: this.hp, hit: Math.max(0, this.hit), rage: this.phase > 0 ? 1 : 0, fire: Math.max(0, this.fire), laugh: this.laugh });
  }
}

// ---------- 2. Боузер ----------
function drawBowser(ctx, x, y, t, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  const breath = o.breath || 0;
  // панцирь со спайками
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    poly(ctx, [Math.cos(a - 0.12) * 50, 4 + Math.sin(a - 0.12) * 44, Math.cos(a) * 70, 4 + Math.sin(a) * 62, Math.cos(a + 0.12) * 50, 4 + Math.sin(a + 0.12) * 44], '#f5f5f5', '#555', 2);
  }
  ell(ctx, 0, 6, 56, 50, '#f5e6b8');
  ell(ctx, 0, 6, 50, 45, '#2e7d32');
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#1b5e20';
  ctx.stroke();
  // ноги
  ell(ctx, -26, 66, 18, 12, '#e9a43a');
  ell(ctx, 26, 66, 18, 12, '#e9a43a');
  // живот
  ell(ctx, 0, 30, 32, 36, '#f6d36b');
  for (let i = 0; i < 4; i++) line(ctx, -26 + i * 2, 12 + i * 14, 26 - i * 2, 12 + i * 14, 'rgba(120,80,20,0.45)', 2);
  // руки с браслетами
  for (const sx of [-1, 1]) {
    ell(ctx, sx * 40, 26, 13, 20, '#e9a43a');
    rr(ctx, sx * 40 - 12, 36, 24, 8, 3);
    ctx.fillStyle = '#111';
    ctx.fill();
    for (let i = 0; i < 3; i++) poly(ctx, [sx * 40 - 8 + i * 8, 36, sx * 40 - 4 + i * 8, 28, sx * 40 + i * 8, 36], '#fff');
  }
  // голова
  const hy = -28;
  poly(ctx, [-34, hy - 8, -48, hy - 30, -26, hy - 18], '#f5e6b8', '#8d6e63', 2);
  poly(ctx, [34, hy - 8, 48, hy - 30, 26, hy - 18], '#f5e6b8', '#8d6e63', 2);
  for (let i = -2; i <= 2; i++) poly(ctx, [i * 9 - 6, hy - 20, i * 9, hy - 40 - Math.abs(i) * -2, i * 9 + 6, hy - 20], '#e53935');
  ell(ctx, 0, hy, 32, 26, '#f0b34a');
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#a5651d';
  ctx.stroke();
  ell(ctx, 0, hy + 12, 22, 13, '#f8d58a');
  circ(ctx, -6, hy + 6, 2.5, '#5a3a10');
  circ(ctx, 6, hy + 6, 2.5, '#5a3a10');
  ell(ctx, -12, hy - 8, 6, 7, '#fff');
  ell(ctx, 12, hy - 8, 6, 7, '#fff');
  circ(ctx, -11, hy - 7, 3, '#c62828');
  circ(ctx, 11, hy - 7, 3, '#c62828');
  line(ctx, -22, hy - 18, -5, hy - 12, '#c62828', 4);
  line(ctx, 22, hy - 18, 5, hy - 12, '#c62828', 4);
  ell(ctx, 0, hy + 20, 16, 4 + breath * 8, '#5a0d0d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(-12, hy + 16, 4, 4);
  ctx.fillRect(8, hy + 16, 4, 4);
  ctx.restore();
}

class BowserBoss extends Boss {
  constructor(hp) {
    super('bowser', hp);
    this.name = 'Боузер';
    this.speaker = 'Боузер';
    this.rageText = 'Боузер зовёт Купа и Гумб!';
    this.deathText = 'Боузер упал в лаву';
    this.emotes = ['ГРА-А-А!', 'Бва-ха-ха!', 'Принцесса в другом замке!'];
    this.projectile = 'fire';
    this.x = 640;
    this.axeOn = false;
    this.axeHp = 5;
    this.specialT = 9;
    this.breathT = 0;
  }
  get box() {
    return { x: this.x - 70, y: 0, w: 140, h: 140 };
  }
  get muzzle() {
    return { x: this.x, y: 22 };
  }
  move(dt, g) {
    this.x = 640 + Math.sin(this.t * 0.5) * 80;
    if (this.breathT > 0) this.breathT -= dt;
    if (!this.axeOn && this.hp / this.max <= 0.3) {
      this.axeOn = true;
      g.banner('ТОПОР!', 'Стреляй по топору справа от моста — Боузер рухнет в лаву', '#ffd54a');
    }
  }
  specialInterval() {
    return rand(9, 12);
  }
  special(g) {
    const cols = [];
    for (let c = 1; c < COLS; c++) if (g.def[c]) cols.push(c);
    const c = cols.length ? choice(cols) : randi(1, COLS - 1);
    g.addHazard('fire', c, 1.4);
    this.breathT = 1.6;
    g.bossEmote('ГРА-А-А!');
  }
  hitSpecial(x, y, g) {
    if (!this.axeOn || Math.abs(x - 838) > 26 || y < 62 || y > 150) return false;
    this.axeHp--;
    FX.burst(g, x, y, 6, { colors: ['#bdbdbd', '#fff'], size: 4, speed: 160, life: 0.4 });
    Sound.stone();
    if (this.axeHp <= 0) {
      this.axeOn = false;
      g.banner('МОСТ РУХНУЛ!', 'Боузер летит в лаву', '#ff7043');
      g.damageTower(this.hp, true);
    }
    return true;
  }
  onRage(g) {
    for (let i = 0; i < 3; i++) g.spawnEnemy('koopa');
    for (let i = 0; i < 2; i++) g.spawnEnemy('goomba');
  }
  draw(ctx, t) {
    // мост с цепью
    ctx.fillStyle = '#8d4b1a';
    ctx.fillRect(440, 126, 380, 24);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 20; i++) line(ctx, 440 + i * 19, 126, 440 + i * 19, 150, 'rgba(0,0,0,0.35)', 2);
    line(ctx, 440, 126, 820, 126, '#c97a3a', 3);
    for (let i = 0; i < 5; i++) circ(ctx, 820 - i * 8, 120 - i * 14, 5, '#9e9e9e');
    if (this.axeOn) {
      line(ctx, 838, 150, 838, 78, '#6d4c2f', 6);
      poly(ctx, [838, 80, 868, 70, 872, 108, 838, 100], '#cfd8dc', '#455a64', 2);
      poly(ctx, [838, 80, 868, 70, 872, 108, 838, 100], '#cfd8dc');
      if (Math.floor(t * 4) % 2 === 0) text(ctx, '◄ БЕЙ', 878, 96, { font: `bold 14px ${FONT.ui}`, color: '#ffd54a', stroke: '#000', lw: 3 });
    }
    ctx.save();
    if (this.hit > 0) ctx.translate(rand(-3, 3), rand(-2, 2));
    drawBowser(ctx, this.x, 62, t, { breath: this.breathT > 0 || this.fire > 0 ? 1 : 0 });
    ctx.restore();
  }
}

// ---------- 3. Эндер-дракон ----------
function drawDragon(ctx, x, y, t, o = {}) {
  const f = Math.sin(t * 4);
  ctx.save();
  ctx.translate(x, y);
  // хвост
  for (let i = 0; i < 6; i++) circ(ctx, Math.sin(t * 2 + i * 0.6) * 6 * i, -26 - i * 11, 13 - i * 1.6, '#16161b');
  // крылья
  for (const sx of [-1, 1]) {
    const pts = [sx * 22, -12, sx * 170, -46 - f * 46, sx * 210, -6 - f * 30, sx * 150, 16, sx * 90, 24, sx * 40, 18];
    poly(ctx, pts, '#2b2b33', '#111', 2);
    poly(ctx, pts, '#2b2b33');
    for (const [px, py] of [[170, -46 - f * 46], [210, -6 - f * 30], [150, 16]]) line(ctx, sx * 22, -10, sx * px, py, '#5a5a66', 2);
  }
  // тело
  ell(ctx, 0, 0, 36, 30, '#1c1c22');
  ell(ctx, 0, 8, 22, 16, '#3a3a44');
  for (let i = -2; i <= 2; i++) poly(ctx, [i * 12 - 5, -24, i * 12, -36, i * 12 + 5, -24], '#6e6e7a');
  // шея и голова
  ell(ctx, 0, 34, 13, 16, '#1c1c22');
  rr(ctx, -28, 44, 56, 30, 8);
  ctx.fillStyle = '#1c1c22';
  ctx.fill();
  rr(ctx, -20, 66, 40, 14, 5);
  ctx.fillStyle = o.open ? '#3a0d3a' : '#26262e';
  ctx.fill();
  poly(ctx, [-24, 46, -32, 30, -16, 44], '#6e6e7a');
  poly(ctx, [24, 46, 32, 30, 16, 44], '#6e6e7a');
  ctx.shadowColor = '#e040fb';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#e040fb';
  ctx.fillRect(-20, 52, 14, 5);
  ctx.fillRect(6, 52, 14, 5);
  ctx.shadowBlur = 0;
  ctx.restore();
}

class DragonBoss extends Boss {
  constructor(hp) {
    super('dragon', hp);
    this.name = 'Эндер-дракон';
    this.speaker = 'Дракон';
    this.rageText = 'Из пустоты лезут эндермены!';
    this.deathText = 'Дракон рассыпался в опыт';
    this.emotes = ['РРРАААР!', '*бьёт крыльями*', 'ГРРР!'];
    this.projectile = 'ender';
    this.x = 640;
    this.y = 80;
    this.specialT = 10;
    this.crystals = [380, 640, 900].map((cx) => ({ x: cx, y: 46, hp: 6, alive: true }));
  }
  get box() {
    return { x: this.x - 120, y: this.y - 50, w: 240, h: 130 };
  }
  get muzzle() {
    return { x: this.x, y: this.y + 70 };
  }
  move(dt) {
    this.x = 640 + Math.sin(this.t * 0.45) * 360;
    this.y = 84 + Math.sin(this.t * 1.3) * 22;
    const alive = this.crystals.filter((c) => c.alive).length;
    if (alive && !this.dead) this.hp = Math.min(this.max, this.hp + 2 * alive * dt);
  }
  specialInterval() {
    return rand(9, 12);
  }
  special(g) {
    const c = clamp(toCol(this.x) + randi(-2, 2), 1, COLS - 1);
    g.addHazard('breath', c, 1.4);
    g.bossEmote('РРРАААР!');
  }
  hitSpecial(x, y, g) {
    for (const c of this.crystals) {
      if (!c.alive || Math.abs(x - c.x) > 20 || Math.abs(y - c.y) > 24) continue;
      c.hp--;
      FX.burst(g, c.x, c.y, 6, { colors: ['#ff80ff', '#fff'], size: 4, speed: 160, life: 0.4 });
      if (c.hp <= 0) {
        c.alive = false;
        g.explosions.push({ x: c.x, y: c.y, r: 70, t: 0 });
        Sound.explosion(false);
        const left = this.crystals.filter((k) => k.alive).length;
        g.banner('КРИСТАЛЛ РАЗБИТ!', left ? `Осталось кристаллов: ${left}` : 'Дракон больше не лечится', '#ff80ff');
      }
      return true;
    }
    return false;
  }
  onRage(g) {
    for (let i = 0; i < 3; i++) g.spawnEnemy('enderman');
    g.spawnEnemy('creeper');
  }
  draw(ctx, t) {
    for (const c of this.crystals) {
      ctx.fillStyle = '#1b1026';
      ctx.fillRect(c.x - 16, c.y + 18, 32, 150 - c.y);
      ctx.fillStyle = 'rgba(160,90,220,0.35)';
      for (let i = 0; i < 6; i++) ctx.fillRect(c.x - 12 + ((i * 7) % 24), c.y + 30 + i * 16, 4, 4);
      if (!c.alive) continue;
      line(ctx, c.x, c.y, this.x, this.y, 'rgba(255,128,255,0.35)', 5);
      line(ctx, c.x, c.y, this.x, this.y, 'rgba(255,220,255,0.7)', 1.5);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(t * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-16, -16, 32, 32);
      ctx.rotate(-t * 4);
      poly(ctx, [0, -12, 12, 0, 0, 12, -12, 0], '#ff80ff', '#7b1fa2', 2);
      poly(ctx, [0, -12, 12, 0, 0, 12, -12, 0], '#ff80ff');
      ctx.restore();
    }
    ctx.save();
    if (this.hit > 0) ctx.translate(rand(-3, 3), rand(-2, 2));
    drawDragon(ctx, this.x, this.y, t, { open: this.fire > 0 });
    ctx.restore();
  }
}

// ---------- 4. Полицейский вертолёт ----------
function drawHeli(ctx, x, y, t, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  if (o.light) {
    const g = ctx.createLinearGradient(0, 30, 0, 420);
    g.addColorStop(0, 'rgba(255,250,200,0.35)');
    g.addColorStop(1, 'rgba(255,250,200,0)');
    const sw = Math.sin(t * 0.9) * 120;
    poly(ctx, [-12, 34, 12, 34, sw + 90, 420, sw - 90, 420], g);
  }
  line(ctx, -50, 44, 50, 44, '#222', 4);
  line(ctx, -30, 30, -36, 44, '#222', 3);
  line(ctx, 30, 30, 36, 44, '#222', 3);
  ell(ctx, 0, 0, 72, 34, '#111');
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, 72, 34, 0, 0, TAU);
  ctx.clip();
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(-72, -34, 144, 30);
  ctx.restore();
  ell(ctx, 0, 6, 34, 22, '#7fb3d5');
  ell(ctx, -10, 0, 10, 8, 'rgba(255,255,255,0.6)');
  text(ctx, 'ПОЛИЦИЯ', 0, -12, { font: `bold 13px ${FONT.ui}`, color: '#111', align: 'center' });
  const blink = Math.floor(t * 6) % 2;
  circ(ctx, -22, -34, 5, blink ? '#ff1744' : '#5a0010');
  circ(ctx, 22, -34, 5, blink ? '#2962ff' : '#0a1a50');
  rr(ctx, -4, -46, 8, 12, 2);
  ctx.fillStyle = '#333';
  ctx.fill();
  ell(ctx, 0, -48, 170, 7, 'rgba(40,40,40,0.35)');
  const a = t * 30;
  line(ctx, Math.cos(a) * -170, -48 + Math.sin(a) * 4, Math.cos(a) * 170, -48 - Math.sin(a) * 4, '#222', 4);
  ctx.restore();
}

class HeliBoss extends Boss {
  constructor(hp) {
    super('heli', hp);
    this.name = 'Полицейский вертолёт';
    this.speaker = 'Пилот';
    this.rageText = 'Вызвано подкрепление: копы!';
    this.deathText = 'Вертолёт сбит';
    this.emotes = ['Остановитесь, это полиция!', 'Вы окружены!', 'Брось удочку!'];
    this.projectile = 'rocket';
    this.x = 640;
    this.y = 78;
    this.specialT = 7;
  }
  get box() {
    return { x: this.x - 90, y: this.y - 40, w: 180, h: 88 };
  }
  get muzzle() {
    return { x: this.x, y: this.y + 30 };
  }
  move() {
    this.x = 640 + Math.sin(this.t * 0.6) * 260;
    this.y = 82 + Math.sin(this.t * 1.7) * 8;
  }
  specialInterval() {
    return rand(7, 9);
  }
  special(g) {
    const c = clamp(toCol(this.x), 1, COLS - 1);
    g.addHazard('strafe', c, 1.1);
    g.addHazard('strafe', clamp(c + choice([-2, 2]), 1, COLS - 1), 1.6);
    Sound.siren();
  }
  onRage(g) {
    for (let i = 0; i < 4; i++) g.spawnEnemy('cop');
    g.bonusStars++;
  }
  draw(ctx, t, g) {
    ctx.save();
    if (this.hit > 0) ctx.translate(rand(-3, 3), rand(-2, 2));
    drawHeli(ctx, this.x, this.y, t, { light: g && g.darkness > 0.1 });
    ctx.restore();
  }
}

// ---------- 5. Скибиди-Титан ----------
function drawTitan(ctx, x, y, t, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  // бачок
  rr(ctx, -100, -80, 200, 70, 10);
  ctx.fillStyle = '#eceff1';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#90a4ae';
  ctx.stroke();
  rr(ctx, -20, -92, 40, 14, 4);
  ctx.fillStyle = '#b0bec5';
  ctx.fill();
  // голова
  const sway = Math.sin(t * 3) * 8, bob = Math.abs(Math.sin(t * 6)) * 6;
  const hx = sway, hy = -6 - bob;
  circ(ctx, hx, hy, 52, '#f0c49a');
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#a5754e';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(hx, hy - 8, 52, Math.PI * 1.05, Math.PI * 1.95);
  ctx.lineWidth = 18;
  ctx.strokeStyle = '#3e2723';
  ctx.stroke();
  const charge = o.charge || 0;
  for (const sx of [-1, 1]) {
    const ex = hx + sx * 20, ey = hy - 4;
    circ(ctx, ex, ey, 13, '#fff');
    if (charge > 0) {
      ctx.shadowColor = '#ff1744';
      ctx.shadowBlur = 20 * charge;
      circ(ctx, ex, ey, 6 + charge * 6, '#ff1744');
      ctx.shadowBlur = 0;
    } else circ(ctx, ex + Math.sin(t * 4) * 3, ey, 6, '#111');
  }
  ell(ctx, hx, hy + 26, 16, 6 + Math.abs(Math.sin(t * 12)) * 10, '#5a1010');
  // чаша
  ell(ctx, 0, 54, 140, 34, '#fafafa');
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#90a4ae';
  ctx.stroke();
  ell(ctx, 0, 42, 120, 16, '#e0e0e0');
  ell(ctx, 0, 42, 92, 10, '#9fd4ff');
  ctx.restore();
}

class TitanBoss extends Boss {
  constructor(hp) {
    super('titan', hp);
    this.name = 'Скибиди-Титан';
    this.speaker = 'Титан';
    this.rageText = 'Скибиди-армия идёт на помощь!';
    this.deathText = 'Титан смыт';
    this.emotes = ['СКИБИДИ ДОП ДОП!', 'ЕС ЕС!', 'Ду-ду-ду!'];
    this.projectile = 'plunger';
    this.specialT = 12;
    this.charge = null;
  }
  get box() {
    return { x: 500, y: 0, w: 280, h: 160 };
  }
  get muzzle() {
    return { x: 640, y: 110 };
  }
  get eyes() {
    const sway = Math.sin(this.t * 3) * 8, bob = Math.abs(Math.sin(this.t * 6)) * 6;
    return [-1, 1].map((sx) => ({ x: 640 + sway + sx * 20, y: 92 - 6 - bob - 4 }));
  }
  move(dt, g) {
    if (this.charge) {
      this.charge.t += dt;
      if (this.charge.t >= this.charge.dur) this.charge = null;
    }
  }
  specialInterval() {
    return rand(11, 14);
  }
  special(g) {
    const h = g.addHazard('laser', PAWN_ROW, 2.0);
    this.charge = { t: 0, dur: 2.0, eyeHp: 6, hazard: h };
    Sound.laserCharge();
    g.say('Титан заряжает лазер! Стреляй ему в глаза!', '#ff5252');
  }
  hitSpecial(x, y, g) {
    if (!this.charge) return false;
    for (const e of this.eyes) {
      if (dist2(x, y, e.x, e.y) > 16 * 16) continue;
      this.charge.eyeHp--;
      FX.burst(g, x, y, 6, { colors: ['#ff1744', '#fff'], size: 4, speed: 160, life: 0.4 });
      Sound.hit();
      if (this.charge.eyeHp <= 0) {
        this.charge.hazard.cancel = true;
        this.charge = null;
        this.stunT = 2.5;
        g.banner('ЛАЗЕР СОРВАН!', 'Титан оглушён', '#7ee03c');
        g.damageTower(40, true);
      }
      return true;
    }
    return false;
  }
  onRage(g) {
    for (let i = 0; i < 3; i++) g.spawnEnemy('skibidi');
    g.spawnEnemy('mega');
  }
  draw(ctx, t) {
    ctx.save();
    if (this.hit > 0 || this.stunT > 0) ctx.translate(rand(-3, 3), rand(-2, 2));
    drawTitan(ctx, 640, 92, t, { charge: this.charge ? Math.min(1, this.charge.t / this.charge.dur) : 0 });
    if (this.stunT > 0) text(ctx, '★ ★ ★', 640, 40, { font: `bold 20px ${FONT.ui}`, color: '#ffd23f', align: 'center', stroke: '#000', lw: 3 });
    ctx.restore();
  }
}

const BOSS_CLASSES = { tower: TowerBoss, bowser: BowserBoss, dragon: DragonBoss, heli: HeliBoss, titan: TitanBoss };

function makeBoss(kind, hp) {
  return new BOSS_CLASSES[kind](hp);
}

// Портрет для выбора уровня и заставки «VS».
function drawBossPortrait(ctx, kind, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (kind === 'tower') {
    ctx.translate(-640, -85);
    drawTower(ctx, 640, t, { hpRatio: 1, hp: 1000, hit: 0, rage: 0, fire: 0, laugh: 0 });
  } else if (kind === 'bowser') drawBowser(ctx, 0, 10, t, {});
  else if (kind === 'dragon') drawDragon(ctx, 0, -10, t, {});
  else if (kind === 'heli') drawHeli(ctx, 0, 0, t, {});
  else if (kind === 'titan') drawTitan(ctx, 0, 0, t, {});
  ctx.restore();
}

// Снаряды боссов летят в камеру — отрисовка по виду.
function drawProjectile(ctx, kind, x, y, r, t) {
  if (kind === 'fire') {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
    g.addColorStop(0, '#fff59d');
    g.addColorStop(0.4, '#ff9800');
    g.addColorStop(1, 'rgba(255,60,0,0)');
    circ(ctx, x, y, r * 1.6, g);
    circ(ctx, x, y, r * 0.8, '#ffeb3b');
  } else if (kind === 'ender') {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
    g.addColorStop(0, '#f3e5f5');
    g.addColorStop(0.4, '#ab47bc');
    g.addColorStop(1, 'rgba(80,0,120,0)');
    circ(ctx, x, y, r * 1.6, g);
    for (let i = 0; i < 5; i++) {
      const a = t * 6 + i * 1.3;
      circ(ctx, x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2, r * 0.18, '#e040fb');
    }
  } else if (kind === 'rocket') {
    ctx.save();
    ctx.translate(x, y);
    const g = ctx.createRadialGradient(0, -r, 0, 0, -r, r * 1.6);
    g.addColorStop(0, 'rgba(255,200,80,0.9)');
    g.addColorStop(1, 'rgba(255,80,0,0)');
    circ(ctx, 0, -r * 1.2, r * 1.4, g);
    circ(ctx, 0, 0, r * 0.75, '#9e9e9e');
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.strokeStyle = '#424242';
    ctx.stroke();
    circ(ctx, 0, 0, r * 0.3, '#e53935');
    for (let i = 0; i < 4; i++) {
      const a = i * (Math.PI / 2) + 0.4;
      line(ctx, Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75, Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15, '#616161', Math.max(1, r * 0.15));
    }
    ctx.restore();
  } else if (kind === 'plunger') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 8);
    rr(ctx, -r * 0.12, -r * 1.3, r * 0.24, r * 1.3, r * 0.1);
    ctx.fillStyle = '#a1887f';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.75, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#c62828';
    ctx.fill();
    ctx.restore();
  } else {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, '#8a8a96');
    g.addColorStop(0.6, '#2c2c34');
    g.addColorStop(1, '#0d0d10');
    circ(ctx, x, y, r, g);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,120,40,0.6)';
    ctx.stroke();
  }
}
