'use strict';
/* Босс-рейд: бой с боссом пешком на арене — одному или вдвоём с другом.
   Босс сидит в логове наверху и бьёт залпами, кольцом снарядов, метками на земле и
   ударной волной (если подойти вплотную), а ещё зовёт миньонов: свою свиту, слаймов
   из Genshin и хедкрабов из Half-Life.
   Мозг босса и миньоны живут у хозяина комнаты: он решает, когда босс атакует, и двигает
   миньонов, а второй игрок получает это через «присутствие». Урон по себе каждый считает
   сам, урон по боссу — тот, кто стрелял; здоровье босса = максимум − урон обоих. */

const RAID = {
  hpSolo: 4500,
  hpDuo: 7500,
  time: 300,
  lives: 3,
  respawn: 4,
  near: 280, // «вплотную» — ближе этого к боссу урон выше
  nearBonus: 1.4,
  projSpeed: 330,
  projDmg: 12,
  ringDmg: 10,
  markDmg: 26,
  markR: 85,
  markDelay: 1.3,
  waveDmg: 18,
  waveR: 330,
  waveTime: 0.7,
  contactDmg: 10,
  maxMinions: 8,
  minionR: 22,
};

const RAID_MINIONS = {
  pawn: { hp: 40, speed: 85 },
  knight: { hp: 60, speed: 115 },
  goomba: { hp: 35, speed: 95 },
  koopa: { hp: 60, speed: 80 },
  enderman: { hp: 70, speed: 120 },
  cop: { hp: 60, speed: 95 },
  skibidi: { hp: 80, speed: 80 },
  slime: { hp: 45, speed: 95 },
  headcrab: { hp: 25, speed: 115 },
};
const RAID_THEMED = { tower: ['pawn', 'knight'], bowser: ['goomba', 'koopa'], dragon: ['enderman'], heli: ['cop'], titan: ['skibidi'] };

// Слайм из Genshin: прыгучая капля своей стихии.
function drawSlime(ctx, x, y, t, el) {
  const c = ELEMENTS[el] ? ELEMENTS[el].color : '#7ee03c';
  const b = Math.abs(Math.sin(t * 5));
  ell(ctx, x, y + 18, 20 - b * 4, 5, 'rgba(0,0,0,0.25)');
  ctx.save();
  ctx.translate(x, y + 16 - b * 16);
  ctx.scale(1 + (1 - b) * 0.12, 1 - (1 - b) * 0.12);
  ctx.beginPath();
  ctx.arc(0, -14, 20, Math.PI, 0);
  ctx.lineTo(20, 0);
  ctx.quadraticCurveTo(0, 6, -20, 0);
  ctx.closePath();
  ctx.fillStyle = c;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  circ(ctx, -8, -24, 5, 'rgba(255,255,255,0.55)');
  circ(ctx, -6, -10, 3, '#1a1a1a');
  circ(ctx, 6, -10, 3, '#1a1a1a');
  ctx.restore();
}

// Хедкраб из Half-Life: плоский, на четырёх парах ног, прыгает в лицо.
function drawHeadcrab(ctx, x, y, t, leaping) {
  const lift = leaping ? 16 : 0;
  ell(ctx, x, y + 16, 22, 6, 'rgba(0,0,0,0.3)');
  ctx.save();
  ctx.translate(x, y + 8 - lift);
  for (let i = 0; i < 4; i++) {
    const s = Math.sin(t * 14 + i) * 3;
    for (const sx of [-1, 1]) {
      line(ctx, sx * (6 + i * 3), -2, sx * (18 + i * 2), 8 + s * sx, '#8d6e63', 3);
    }
  }
  ell(ctx, 0, -4, 20, 12, '#d7b98a');
  ell(ctx, 0, -8, 15, 7, '#a1887f');
  circ(ctx, 0, 4, 6, '#ef9a9a');
  circ(ctx, 0, 4, 3, '#b71c1c');
  ctx.restore();
}

function drawRaidMinion(ctx, m, x, y, t) {
  const ph = t + m.id * 0.37;
  switch (m.type) {
    case 'pawn': drawPiece(ctx, 'p', false, x, y - 10, 54); break;
    case 'knight': drawPiece(ctx, 'n', false, x, y - 12, 60); break;
    case 'goomba': drawGoomba(ctx, x, y - 14, ph, { walking: true }); break;
    case 'koopa': drawKoopa(ctx, x, y - 14, ph, { walking: true }); break;
    case 'enderman': drawEnderman(ctx, x, y - 18, ph, { walking: true }); break;
    case 'cop': drawCop(ctx, x, y - 18, ph, { walking: true }); break;
    case 'skibidi': drawSkibidi(ctx, x, y - 18, ph, { singing: true }); break;
    case 'slime': drawSlime(ctx, x, y, ph, m.el); break;
    case 'headcrab': drawHeadcrab(ctx, x, y, ph, m.leapT > 0); break;
  }
  const max = RAID_MINIONS[m.type].hp;
  if (m.hp < max) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 21, y - 52, 42, 6);
    ctx.fillStyle = '#ff7043';
    ctx.fillRect(x - 20, y - 51, 40 * clamp(m.hp / max, 0, 1), 4);
  }
}

const Raid = {
  on: false,
  kind: 'tower',
  boss: null,
  host: true,
  solo: false,
  max: 1,
  bd: 0, // твой урон по боссу
  oppBd: 0, // урон друга
  kills: 0,
  oppKills: 0,
  minions: new Map(),
  nextId: 1,
  events: [],
  evSeq: 0,
  seenEv: 0,
  mh: [],
  mhSeq: 0,
  seenMh: 0,
  projs: [],
  marks: [],
  waves: [],
  timers: null,
  ragePhase: 0,
  hitT: 0,
  fireT: 0,
  deadT: 0,
  // заглушка «игры» для методов боссов кампании (нам нужны только их движение и рисунок)
  stub: { banner() {}, say() {}, bossEmote() {}, spawnEnemy() {}, addHazard() { return {}; }, def: [], darkness: 0 },

  start(kind, host, solo) {
    this.on = true;
    this.kind = RAID_THEMED[kind] ? kind : 'tower';
    this.host = host;
    this.solo = solo;
    this.boss = makeBoss(this.kind, 1000);
    if (this.boss.crystals) for (const c of this.boss.crystals) c.alive = false;
    this.max = solo ? RAID.hpSolo : RAID.hpDuo;
    if (this.kind !== 'bowser') this.boss.max = this.max;
    this.bd = this.oppBd = 0;
    this.kills = this.oppKills = 0;
    this.minions = new Map();
    this.nextId = 1;
    this.events = [];
    this.evSeq = this.seenEv = 0;
    this.mh = [];
    this.mhSeq = this.seenMh = 0;
    this.projs = [];
    this.marks = [];
    this.waves = [];
    this.timers = { volley: 3, ring: 9, mark: 6, summon: 3, wave: 0 };
    this.ragePhase = 0;
    this.hitT = this.fireT = this.deadT = 0;
    this.boomed = false;
  },

  stop() {
    this.on = false;
    this.minions = new Map();
    this.projs = [];
    this.marks = [];
    this.waves = [];
  },

  hp() {
    return Math.max(0, this.max - this.bd - this.oppBd);
  },

  dead() {
    return this.on && this.hp() <= 0;
  },

  // Живые игроки, по которым может бить босс.
  targets() {
    const out = [];
    const me = Arena.me;
    if (!me.dead) out.push({ x: me.x, y: me.y });
    if (!Arena.solo) {
      const op = Arena.oppNow();
      if (op && !Arena.op.dead) out.push({ x: op.x, y: op.y });
    }
    return out;
  },

  minionPos(m) {
    if (this.host) return m;
    return interpBuf(m.buf, ARENA.lag) || m;
  },

  update(dt) {
    const b = this.boss;
    b.t = Arena.t;
    if (this.dead()) this.deadT += dt;
    else b.move(dt, this.stub);
    // полоска на башне показывает здоровье рейда; у Боузера держим полное — иначе всплывёт «топор» из кампании
    b.hp = this.kind === 'bowser' ? b.max : Math.max(1, this.hp());
    if (this.hitT > 0) this.hitT -= dt;
    if (this.fireT > 0) this.fireT -= dt;
    b.hit = Math.max(0, this.hitT);
    b.fire = Math.max(0, this.fireT);
    if (this.host && !this.dead()) {
      this.ai(dt);
      this.moveMinions(dt);
    }
    this.updateShots(dt);
  },

  // Мозг босса (только у хозяина комнаты).
  ai(dt) {
    const tg = this.targets();
    if (!tg.length) return;
    const rage = 1 - this.hp() / this.max;
    const sp = 1 + rage * 0.7;
    const tm = this.timers;
    tm.volley -= dt * sp;
    tm.ring -= dt * sp;
    tm.mark -= dt * sp;
    tm.summon -= dt * sp;
    tm.wave -= dt;
    if (tm.volley <= 0) {
      tm.volley = rand(1.8, 2.6);
      const p = choice(tg);
      this.emit({ k: 'v', tx: Math.round(p.x), ty: Math.round(p.y) });
    }
    if (tm.ring <= 0) {
      tm.ring = rand(8, 10);
      this.emit({ k: 'r', o: Math.round(rand(0, 100)) / 100 });
    }
    if (tm.mark <= 0) {
      tm.mark = rand(6, 8);
      this.emit({ k: 'm', p: tg.map((p) => [Math.round(p.x + rand(-25, 25)), Math.round(p.y + rand(-25, 25))]) });
    }
    const c = this.boss.center;
    if (tm.wave <= 0 && tg.some((p) => dist(p.x, p.y, c.x, c.y) < RAID.near)) {
      tm.wave = 4.5;
      this.emit({ k: 'w' });
    }
    if (tm.summon <= 0) {
      tm.summon = rand(10, 13);
      this.summon(2);
    }
    const phase = rage >= 0.67 ? 2 : rage >= 0.34 ? 1 : 0;
    if (phase > this.ragePhase) {
      this.ragePhase = phase;
      this.summon(3);
      this.emit({ k: 'e', s: this.boss.rageText || 'Босс в ярости!' });
    }
  },

  summon(n) {
    const themed = RAID_THEMED[this.kind];
    const list = [];
    for (let i = 0; i < n; i++) list.push(choice(themed));
    list.push(Math.random() < 0.5 ? 'slime' : 'headcrab');
    for (const type of list) {
      if (this.minions.size >= RAID.maxMinions) break;
      const m = { id: this.nextId++, type, x: rand(220, W - 220), y: 2 * T + 30, hp: RAID_MINIONS[type].hp, el: type === 'slime' ? choice(EL_KEYS) : '', leapT: 0, leapCd: rand(0.5, 2), buf: [] };
      Arena.collide(m, RAID.minionR);
      this.minions.set(m.id, m);
    }
    Sound.groan();
  },

  moveMinions(dt) {
    const tg = this.targets();
    for (const m of this.minions.values()) {
      if (m.leapT > 0) m.leapT -= dt;
      if (m.leapCd > 0) m.leapCd -= dt;
      if (!tg.length) continue;
      let best = tg[0], bd = Infinity;
      for (const p of tg) {
        const d = dist(m.x, m.y, p.x, p.y);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      if (m.type === 'headcrab' && bd < 200 && m.leapCd <= 0) {
        m.leapT = 0.35;
        m.leapCd = 2.2;
        Sound.hiss();
      }
      const sp = RAID_MINIONS[m.type].speed * (m.leapT > 0 ? 3.2 : 1);
      if (bd > 26) {
        m.x += ((best.x - m.x) / bd) * sp * dt;
        m.y += ((best.y - m.y) / bd) * sp * dt;
      }
      Arena.collide(m, RAID.minionR);
    }
  },

  // Событие босса: хозяин создаёт, оба проигрывают одинаково.
  emit(e) {
    e.i = ++this.evSeq;
    this.events.push(e);
    if (this.events.length > 6) this.events.shift();
    this.apply(e);
  },

  apply(e) {
    const b = this.boss, mz = b.muzzle, c = b.center;
    const kind = b.projectile;
    if (e.k === 'v') {
      const base = Math.atan2(num(e.ty) - mz.y, num(e.tx) - mz.x);
      for (const off of [-0.16, 0, 0.16]) this.proj(mz.x, mz.y, base + off, RAID.projSpeed, RAID.projDmg, kind);
      this.fireT = 0.3;
      Sound.cannon();
    } else if (e.k === 'r') {
      const n = 12;
      for (let i = 0; i < n; i++) this.proj(c.x, c.y + 30, Math.PI * (0.1 + (0.8 * (i + num(e.o) * 0.5)) / n), 250, RAID.ringDmg, kind);
      this.fireT = 0.4;
      Sound.roar();
    } else if (e.k === 'm') {
      for (const p of Array.isArray(e.p) ? e.p.slice(0, 3) : []) {
        if (Array.isArray(p)) this.marks.push({ x: clamp(num(p[0]), 0, W), y: clamp(num(p[1]), 2 * T, H), t: 0 });
      }
      Sound.warn();
    } else if (e.k === 'w') {
      this.waves.push({ x: c.x, y: c.y, t: 0, hit: false });
      Sound.thud();
      Arena.shake = Math.max(Arena.shake, 6);
    } else if (e.k === 'e') {
      Arena.bigMsg = { str: 'ЯРОСТЬ!', sub: String(e.s || '').slice(0, 60), t: 0, life: 2.4, color: '#ff5252' };
      Sound.roar();
    }
  },

  proj(x, y, ang, speed, dmg, kind) {
    this.projs.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, dmg, kind, r: 13 });
  },

  // Снаряды, метки, волны и миньоны бьют по тебе — урон считаешь ты сам.
  updateShots(dt) {
    const me = Arena.me;
    for (const p of this.projs) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < -30 || p.x > W + 30 || p.y > H + 30 || p.y < -30) {
        p.dead = true;
        continue;
      }
      if (p.y > 2 * T && Arena.blocks.some((b) => p.x > b.x && p.x < b.x + T && p.y > b.y && p.y < b.y + T)) {
        p.dead = true;
        FX.burst(Arena.fx, p.x, p.y, 5, { colors: ['#bdbdbd', '#ffcc80'], size: 4, speed: 140, grav: 0, life: 0.3 });
        continue;
      }
      if (!me.dead && dist(p.x, p.y, me.x, me.y - 8) < ARENA.r + p.r) {
        p.dead = true;
        Arena.hurt(p.dmg, 'boss');
      }
    }
    this.projs = this.projs.filter((p) => !p.dead);
    for (const mk of this.marks) {
      mk.t += dt;
      if (mk.t >= RAID.markDelay && !mk.done) {
        mk.done = true;
        Arena.boom(mk.x, mk.y, RAID.markR);
        if (!me.dead && dist(me.x, me.y, mk.x, mk.y) < RAID.markR) Arena.hurt(RAID.markDmg, 'boss');
      }
    }
    this.marks = this.marks.filter((mk) => !mk.done);
    for (const w of this.waves) {
      const r0 = (w.t / RAID.waveTime) * RAID.waveR;
      w.t += dt;
      const r1 = (w.t / RAID.waveTime) * RAID.waveR;
      if (!me.dead && !w.hit) {
        const d = dist(me.x, me.y, w.x, w.y);
        if (d > r0 - 20 && d <= r1 + 20 && d <= RAID.waveR) {
          w.hit = true;
          Arena.hurt(RAID.waveDmg, 'boss');
        }
      }
    }
    this.waves = this.waves.filter((w) => w.t < RAID.waveTime);
    if (!me.dead && me.contactCd <= 0) {
      for (const m of this.minions.values()) {
        if (m.dying) continue;
        const p = this.minionPos(m);
        if (dist(p.x, p.y, me.x, me.y) > 40) continue;
        me.contactCd = 0.7;
        const d = RAID.contactDmg * (m.type === 'headcrab' && m.leapT > 0 ? 1.5 : 1);
        if (m.el) Arena.hurtHit({ d, el: m.el }, 'minion');
        else Arena.hurt(d, 'minion');
        break;
      }
    }
  },

  // ---------- игроки бьют босса и миньонов ----------
  ray(x, y, dx, dy, tMax) {
    let best = null;
    if (!this.dead()) {
      const b = this.boss.box;
      const tb = rayRect(x, y, dx, dy, b.x, b.y, b.w, b.h);
      if (tb < tMax) {
        tMax = tb;
        best = { t: tb, target: 'boss' };
      }
    }
    for (const m of this.minions.values()) {
      if (m.dying) continue;
      const p = this.minionPos(m);
      const tc = rayCircle(x, y, dx, dy, p.x, p.y - 10, RAID.minionR + 4);
      if (tc < tMax) {
        tMax = tc;
        best = { t: tc, target: m };
      }
    }
    return best;
  },

  near(x, y) {
    const c = this.boss.center;
    return dist(x, y, c.x, c.y) < RAID.near;
  },

  hitBoss(d, el) {
    if (this.dead()) return 0;
    const me = Arena.me;
    if (this.near(me.x, me.y)) d *= RAID.nearBonus;
    d = Math.round(d);
    this.bd += d;
    this.hitT = 0.12;
    const c = this.boss.center;
    FX.text(Arena.fx, c.x + rand(-70, 70), c.y + rand(0, 40), `-${d}`, { color: el ? ELEMENTS[el].color : '#ffeb3b', font: `bold 18px ${FONT.ui}`, life: 0.7 });
    if (this.dead()) this.onBossDead();
    return d;
  },

  hitMinion(m, d) {
    if (m.dying) return 0;
    d = Math.round(d);
    const p = this.minionPos(m);
    FX.burst(Arena.fx, p.x, p.y - 10, 6, { colors: m.el ? [ELEMENTS[m.el].color, '#fff'] : ['#8d6e63', '#3e2723'], size: 5, speed: 160, grav: 300, life: 0.4 });
    FX.text(Arena.fx, p.x + rand(-8, 8), p.y - 50, `-${d}`, { color: '#ffeb3b', font: `bold 15px ${FONT.ui}`, life: 0.6 });
    m.hp -= d;
    if (this.host) {
      if (m.hp <= 0) this.killMinion(m, true);
    } else {
      this.mh.push({ i: ++this.mhSeq, id: m.id, d });
      if (this.mh.length > 16) this.mh.shift();
      if (m.hp <= 0) {
        m.dying = true;
        this.kills++;
        Sound.splat();
      }
    }
    return d;
  },

  killMinion(m, mine) {
    this.minions.delete(m.id);
    if (mine) this.kills++;
    FX.burst(Arena.fx, m.x, m.y, 14, { colors: m.el ? [ELEMENTS[m.el].color, '#fff'] : ['#8d6e63', '#3e2723', '#fff'], size: 6, speed: 220, grav: 300, life: 0.6 });
    Sound.splat();
  },

  // Монтировка: босс — если стоишь у самого логова, миньоны — в дуге удара.
  melee(me, gun, inArc, el) {
    let total = 0;
    if (!this.dead()) {
      const b = this.boss.box;
      const cx = clamp(me.x, b.x, b.x + b.w), cy = clamp(me.y, b.y, b.y + b.h);
      if (dist(me.x, me.y, cx, cy) <= gun.range + 10) total += this.hitBoss(gun.dmg, el);
    }
    for (const m of [...this.minions.values()]) {
      if (m.dying) continue;
      const p = this.minionPos(m);
      if (inArc(p.x, p.y - 8, RAID.minionR)) total += this.hitMinion(m, gun.dmg);
    }
    return total;
  },

  // Взрыв твоей гранаты.
  blast(x, y, r, dmg) {
    let total = 0;
    if (!this.dead()) {
      const b = this.boss.box;
      const cx = clamp(x, b.x, b.x + b.w), cy = clamp(y, b.y, b.y + b.h);
      const d = dist(x, y, cx, cy);
      if (d < r) total += this.hitBoss(dmg * (1 - d / r) * 1.5, null);
    }
    for (const m of [...this.minions.values()]) {
      if (m.dying) continue;
      const p = this.minionPos(m);
      const d = dist(x, y, p.x, p.y);
      if (d < r) total += this.hitMinion(m, dmg * (1 - d / r) + 10);
    }
    return total;
  },

  onBossDead() {
    if (this.boomed) return;
    this.boomed = true;
    const c = this.boss.center;
    for (let i = 0; i < 5; i++) Arena.booms.push({ x: c.x + rand(-100, 100), y: c.y + rand(-50, 50), r: 90 + i * 20, t: 0 });
    Arena.shake = 14;
    Sound.explosion(true);
  },

  check() {
    if (this.dead()) {
      if (Arena.solo) return { win: true, reason: 'Босс повержен!' };
      if (Math.round(this.bd) === Math.round(this.oppBd)) return { win: true, reason: 'Босс повержен! Урон поровну' };
      return { win: true, reason: `Босс повержен! MVP — ${this.bd > this.oppBd ? Duel.name : Duel.oppName || 'друг'}` };
    }
    if (Arena.solo && Arena.me.lives <= 0 && Arena.me.dead) return { win: false, reason: 'Жизни кончились — босс победил' };
    if (Arena.t >= RAID.time) return { win: false, reason: 'Время вышло — босс победил' };
    return null;
  },

  // ---------- сеть ----------
  netState() {
    const s = { bd: Math.round(this.bd), mk: this.kills };
    if (this.host) {
      s.be = this.events;
      s.mo = [...this.minions.values()].slice(0, 10).map((m) => [m.id, m.type, Math.round(m.x), Math.round(m.y), Math.max(0, Math.ceil(m.hp)), m.el || '', m.leapT > 0 ? 1 : 0]);
    } else s.mh = this.mh;
    return s;
  },

  remote(st) {
    if (!this.on) return;
    this.oppBd = Math.max(0, num(st.bd));
    this.oppKills = Math.max(0, num(st.mk));
    if (this.dead()) this.onBossDead();
    const list = (v, n) => (Array.isArray(v) ? v.filter((e) => e && typeof e === 'object' && Number.isFinite(e.i)).slice(-n) : []);
    if (this.host) {
      // попадания друга по миньонам
      for (const h of list(st.mh, 16)) {
        if (h.i <= this.seenMh) continue;
        this.seenMh = h.i;
        const m = this.minions.get(num(h.id));
        if (!m) continue;
        m.hp -= clamp(num(h.d), 0, 300);
        if (m.hp <= 0) this.killMinion(m, false);
      }
      return;
    }
    // гость: атаки босса и миньоны от хозяина
    for (const e of list(st.be, 8)) {
      if (e.i <= this.seenEv) continue;
      this.seenEv = e.i;
      this.apply(e);
    }
    if (Array.isArray(st.mo)) {
      const now = performance.now();
      const seen = new Set();
      for (const row of st.mo.slice(0, 12)) {
        if (!Array.isArray(row)) continue;
        const [id, type, x, y, hp, el, leap] = row;
        if (!RAID_MINIONS[type] || !Number.isFinite(id)) continue;
        seen.add(id);
        let m = this.minions.get(id);
        if (!m) {
          m = { id, type, x: num(x), y: num(y), hp: num(hp), el: ELEMENTS[el] ? el : '', buf: [], leapT: 0 };
          this.minions.set(id, m);
        }
        m.hp = Math.min(m.hp, num(hp));
        m.leapT = leap ? 0.2 : 0;
        m.buf.push({ t: now, x: clamp(num(x), 0, W), y: clamp(num(y), 0, H) });
        if (m.buf.length > 20) m.buf.shift();
      }
      for (const id of [...this.minions.keys()]) if (!seen.has(id)) this.minions.delete(id);
    }
  },

  // ---------- отрисовка ----------
  drawBoss(ctx, t) {
    const b = this.boss;
    ctx.save();
    if (this.dead()) {
      ctx.globalAlpha = Math.max(0, 1 - this.deadT / 1.5);
      ctx.translate(0, this.deadT * 30);
    }
    if (ctx.globalAlpha > 0) b.draw(ctx, t, this.stub);
    ctx.restore();
    if (this.dead()) return;
    // зона «вплотную»
    const c = b.center, me = Arena.me;
    const near = !me.dead && this.near(me.x, me.y);
    ctx.beginPath();
    ctx.arc(c.x, c.y, RAID.near, Math.PI * 0.08, Math.PI * 0.92);
    ctx.setLineDash([10, 10]);
    ctx.strokeStyle = near ? 'rgba(255,213,74,0.7)' : 'rgba(255,82,82,0.35)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([]);
    if (near) text(ctx, 'ВПЛОТНУЮ ×1.4', me.x, me.y + 46, { font: `bold 12px ${FONT.ui}`, color: '#ffd54a', stroke: '#000', lw: 3, align: 'center' });
  },

  addMinions(list, ctx, t) {
    for (const m of this.minions.values()) {
      if (m.dying) continue;
      const p = this.minionPos(m);
      list.push({ y: p.y + 20, draw: () => drawRaidMinion(ctx, m, p.x, p.y, t) });
    }
  },

  drawShots(ctx, t) {
    for (const mk of this.marks) {
      const k = mk.t / RAID.markDelay;
      ctx.beginPath();
      ctx.arc(mk.x, mk.y, RAID.markR, 0, TAU);
      ctx.fillStyle = `rgba(255,23,68,${0.12 + k * 0.2})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,23,68,0.85)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(mk.x, mk.y, RAID.markR * k, 0, TAU);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      text(ctx, '!', mk.x, mk.y + 12, { font: `bold 34px ${FONT.ui}`, color: '#fff', stroke: '#b71c1c', lw: 5, align: 'center' });
    }
    for (const w of this.waves) {
      const r = (w.t / RAID.waveTime) * RAID.waveR;
      ctx.beginPath();
      ctx.arc(w.x, w.y, r, 0, Math.PI);
      ctx.strokeStyle = `rgba(255,213,74,${1 - w.t / RAID.waveTime})`;
      ctx.lineWidth = 14;
      ctx.stroke();
    }
    for (const p of this.projs) drawProjectile(ctx, p.kind, p.x, p.y, p.r, t);
  },

  drawHud(ctx, t) {
    rr(ctx, 12, 8, 400, 76, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fill();
    text(ctx, this.boss.name, 26, 32, { font: `bold 17px ${FONT.ui}`, color: '#ffab91' });
    const left = Math.max(0, Math.ceil(RAID.time - Arena.t));
    text(ctx, `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, 398, 32, { font: `bold 16px ${FONT.ui}`, color: left <= 30 ? '#ff8a80' : '#b0bec5', align: 'right' });
    const k = this.hp() / this.max;
    ctx.fillStyle = '#3a1010';
    ctx.fillRect(26, 42, 372, 14);
    ctx.fillStyle = k > 0.33 ? '#e53935' : '#ff1744';
    ctx.fillRect(26, 42, 372 * k, 14);
    text(ctx, `${Math.ceil(this.hp())} / ${this.max}`, 212, 54, { font: `bold 11px ${FONT.ui}`, color: '#fff', align: 'center' });
    let sub;
    if (Arena.solo) sub = `Жизни: ${'❤'.repeat(Math.max(0, Arena.me.lives))}${'♡'.repeat(Math.max(0, RAID.lives - Arena.me.lives))}`;
    else sub = `Урон: ты ${Math.round(this.bd)} · ${Duel.oppName || 'друг'} ${Math.round(this.oppBd)}`;
    text(ctx, sub, 26, 76, { font: `bold 13px ${FONT.ui}`, color: '#eceff1' });
  },
};
