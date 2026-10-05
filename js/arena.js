'use strict';
/* Арена: PvP вдвоём на одной доске — без ботов, только вы.
   Каждый сам считает своего бойца (бег, выстрелы, подборы) и рассылает это в «присутствии»
   (Duel.publish → Arena.netState). Попадание пулей засчитывает стрелок — при задержке сети
   так честнее для того, кто целится; урон от гранат и мин считает тот, кого задело.
   Карта у обоих одинаковая: она строится из кода комнаты. */

const ARENA = {
  hp: 100,
  r: 22, // радиус бойца
  speed: 255,
  frags: 7, // до скольки фрагов
  time: 240, // секунд на матч
  respawn: 3,
  shield: 1.6, // неуязвимость после возрождения
  nadeR: 150,
  nadeDmg: 80,
  nadeFuse: 1.25,
  nadeFly: 0.55,
  nadeRange: 430,
  mineDmg: 45,
  mineR: 100,
  detect: 210, // радиус, в котором видны цифры «Сапёра»
  lag: 140, // на сколько мс соперник рисуется «в прошлом» ради плавности
};

const ARENA_GUNS = {
  ak: { dmg: 12, interval: 0.1, mag: 30, reserve: 90, reload: 2.0, spread: 0.035, moveSpread: 0.05, pellets: 1, range: 1100, auto: true },
  nova: { dmg: 11, interval: 0.85, mag: 6, reserve: 18, reload: 2.4, spread: 0.2, moveSpread: 0, pellets: 8, range: 430, auto: false },
  awp: { dmg: 95, interval: 1.45, mag: 5, reserve: 5, reload: 3.0, spread: 0.004, moveSpread: 0.12, pellets: 1, range: 1600, auto: false },
};
const ARENA_GUN_ORDER = ['ak', 'nova', 'awp'];
const ARENA_GUN_SCALE = 0.1;

// Точки возрождения хозяина комнаты; у гостя — зеркально.
const ARENA_SPAWNS = [[1, 4], [1, 1], [1, 7]];

// Предметы на карте (симметрично для обоих).
const ARENA_SPOTS = [
  { kind: 'awp', x: W / 2, y: H / 2, every: 30, first: 15 },
  { kind: 'gapple', c: 3, r: 1, every: 15 },
  { kind: 'gapple', c: 12, r: 7, every: 15 },
  { kind: 'vest', c: 3, r: 7, every: 20 },
  { kind: 'vest', c: 12, r: 1, every: 20 },
  { kind: 'ammo', c: 5, r: 4, every: 18 },
  { kind: 'ammo', c: 10, r: 4, every: 18 },
];
for (const s of ARENA_SPOTS) {
  if (s.c !== undefined) {
    s.x = colX(s.c);
    s.y = rowY(s.r);
  }
}

const mirrorCell = (c, r) => [COLS - 1 - c, ROWS - 1 - r];
const cellKey = (c, r) => c + ',' + r;

// Детерминированный генератор случайных чисел (одинаковый у обоих игроков).
function arenaRng(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Луч из (x,y) в направлении (dx,dy) против прямоугольника: расстояние до входа или Infinity.
function rayRect(x, y, dx, dy, rx, ry, rw, rh) {
  let t0 = 0, t1 = Infinity;
  for (const [p, d, lo, hi] of [[x, dx, rx, rx + rw], [y, dy, ry, ry + rh]]) {
    if (Math.abs(d) < 1e-9) {
      if (p < lo || p > hi) return Infinity;
    } else {
      let a = (lo - p) / d, b = (hi - p) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      if (t0 > t1) return Infinity;
    }
  }
  return t0;
}

function rayCircle(x, y, dx, dy, cx, cy, r) {
  const fx = x - cx, fy = y - cy;
  const b = fx * dx + fy * dy;
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : c <= 0 ? 0 : Infinity;
}

const Arena = {
  on: false,
  theme: 'classic',
  role: 'host',
  t: 0,
  me: null,
  blocks: [], // { c, r, x, y, kind }
  blocked: new Set(),
  mines: [], // { c, r, x, y }
  exploded: 0,
  numbers: [],
  gen: [],
  readyAt: [],
  // сеть
  q: 0,
  shots: [],
  hits: [],
  myNades: [],
  shotSeq: 0,
  hitSeq: 0,
  nadeSeq: 0,
  seenShot: 0,
  seenHit: 0,
  seenNade: 0,
  lastQ: null,
  buf: [],
  op: null,
  opDn: 0,
  // эффекты
  fx: { particles: [], texts: [] },
  booms: [],
  tracers: [],
  nades: [],
  craters: [],
  feed: [],
  bigMsg: null,
  shake: 0,
  hitMarkT: 0,
  menu: false,
  suppress: false,
  stats: { shots: 0, hitShots: 0, dealt: 0, taken: 0 },
  bg: null,
  bgKey: '',

  // ---------- запуск ----------
  start(g, seed, theme, role) {
    this.on = true;
    this.theme = theme;
    this.role = role;
    this.t = 0;
    this.q = 0;
    this.shots = [];
    this.hits = [];
    this.myNades = [];
    this.shotSeq = this.hitSeq = this.nadeSeq = 0;
    this.seenShot = this.seenHit = this.seenNade = 0;
    this.lastQ = null;
    this.buf = [];
    this.op = { hp: ARENA.hp, ar: 0, w: 'ak', dead: false, sh: false, dn: 0, dmg: 0, acc: 0, flashT: 0, deadAt: null };
    this.opDn = 0;
    this.fx = { particles: [], texts: [] };
    this.booms = [];
    this.tracers = [];
    this.nades = [];
    this.craters = [];
    this.feed = [];
    this.bigMsg = { str: 'АРЕНА!', sub: `До ${ARENA.frags} фрагов. Удачи!`, t: 0, life: 2.6, color: '#ff8a65' };
    this.shake = 0;
    this.hitMarkT = 0;
    this.menu = false;
    this.suppress = true;
    this.stats = { shots: 0, hitShots: 0, dealt: 0, taken: 0 };
    this.buildMap(seed);
    this.gen = ARENA_SPOTS.map(() => 0);
    this.readyAt = ARENA_SPOTS.map((s) => s.first || 0);
    const sp = this.spawnPoints()[0];
    this.me = {
      x: sp[0], y: sp[1], a: role === 'host' ? 0 : Math.PI,
      hp: ARENA.hp, ar: 0, dead: false, dn: 0, lk: '', respawnT: 0, shieldT: ARENA.shield,
      w: 'ak', guns: {}, nades: 1, cool: 0, reloadT: 0, hurtT: 0, flashT: 0, vx: 0, vy: 0, held: false,
    };
    this.resetGuns();
  },

  stop() {
    this.on = false;
    this.menu = false;
  },

  // Карта: укрытия и мины, зеркально-симметрично относительно центра.
  buildMap(seed) {
    const rng = arenaRng('kd-arena-' + seed);
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    const reserved = new Set();
    const reserve = (c, r) => {
      for (const [cc, rr2] of [[c, r], mirrorCell(c, r)]) reserved.add(cellKey(cc, rr2));
    };
    for (const [c, r] of ARENA_SPAWNS) {
      reserve(c, r);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) reserve(c + dc, r + dr);
    }
    for (const s of ARENA_SPOTS) if (s.c !== undefined) reserve(s.c, s.r);
    reserve(7, 4);
    reserve(8, 4);

    let blocks = [], mines = [];
    for (let attempt = 0; attempt < 40; attempt++) {
      const used = new Map();
      let n = 0, tries = 0;
      while (n < 7 && tries++ < 300) {
        const c = 1 + Math.floor(rng() * 7), r = 1 + Math.floor(rng() * (ROWS - 2));
        const horiz = rng() < 0.5, long = rng() < 0.45;
        const cells = [[c, r]];
        if (long) cells.push(horiz ? [c + 1, r] : [c, r + 1]);
        if (cells.some(([cc, rr2]) => cc > 7 || rr2 >= ROWS - 1 || reserved.has(cellKey(cc, rr2)) || used.has(cellKey(cc, rr2)))) continue;
        const kind = pick(['crate', 'stone', 'rook', 'crate', 'stone']);
        for (const [cc, rr2] of cells) {
          used.set(cellKey(cc, rr2), kind);
          const [mc, mr] = mirrorCell(cc, rr2);
          used.set(cellKey(mc, mr), kind);
        }
        n++;
      }
      // мины только там, где нет укрытий и стартовых клеток
      const ms = [];
      tries = 0;
      while (ms.length < 4 && tries++ < 300) {
        const c = 2 + Math.floor(rng() * 6), r = 1 + Math.floor(rng() * (ROWS - 2));
        const k = cellKey(c, r);
        if (reserved.has(k) || used.has(k) || ms.some((m) => Math.abs(m[0] - c) + Math.abs(m[1] - r) < 2)) continue;
        ms.push([c, r]);
      }
      if (!this.connected(used)) continue;
      blocks = [...used].map(([k, kind]) => {
        const [c, r] = k.split(',').map(Number);
        return { c, r, x: c * T, y: r * T, kind };
      });
      mines = [];
      for (const [c, r] of ms) mines.push([c, r]);
      for (const [c, r] of ms) mines.push(mirrorCell(c, r));
      break;
    }
    this.blocks = blocks;
    this.blocked = new Set(blocks.map((b) => cellKey(b.c, b.r)));
    this.mines = mines.map(([c, r]) => ({ c, r, x: colX(c), y: rowY(r) }));
    this.exploded = 0;
    this.updateNumbers();
  },

  // Все свободные клетки достижимы друг из друга.
  connected(used) {
    const free = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!used.has(cellKey(c, r))) free.push(cellKey(c, r));
    const seen = new Set([free[0]]);
    const stack = [free[0]];
    while (stack.length) {
      const [c, r] = stack.pop().split(',').map(Number);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr, k = cellKey(nc, nr);
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS || used.has(k) || seen.has(k)) continue;
        seen.add(k);
        stack.push(k);
      }
    }
    return seen.size === free.length;
  },

  // Цифры «Сапёра» вокруг ещё не взорванных мин.
  updateNumbers() {
    const nums = new Map();
    this.mines.forEach((m, i) => {
      if (this.exploded & (1 << i)) return;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dc && !dr) continue;
          const c = m.c + dc, r = m.r + dr, k = cellKey(c, r);
          if (c < 0 || r < 0 || c >= COLS || r >= ROWS || this.blocked.has(k)) continue;
          nums.set(k, (nums.get(k) || 0) + 1);
        }
      }
    });
    this.mines.forEach((m, i) => {
      if (!(this.exploded & (1 << i))) nums.delete(cellKey(m.c, m.r));
    });
    this.numbers = [...nums].map(([k, n]) => {
      const [c, r] = k.split(',').map(Number);
      return { x: colX(c), y: rowY(r), n };
    });
  },

  spawnPoints() {
    const own = ARENA_SPAWNS.map(([c, r]) => (this.role === 'host' ? [c, r] : mirrorCell(c, r)));
    const other = ARENA_SPAWNS.map(([c, r]) => (this.role === 'host' ? mirrorCell(c, r) : [c, r]));
    return [...own, ...other].map(([c, r]) => [colX(c), rowY(r)]);
  },

  resetGuns() {
    const me = this.me;
    me.guns = {
      ak: { mag: ARENA_GUNS.ak.mag, res: ARENA_GUNS.ak.reserve },
      nova: { mag: ARENA_GUNS.nova.mag, res: ARENA_GUNS.nova.reserve },
    };
    me.w = 'ak';
    me.reloadT = 0;
    me.cool = 0;
  },

  respawn() {
    const me = this.me;
    const op = this.oppNow();
    let best = null, bestD = -1;
    for (const p of this.spawnPoints()) {
      const d = op && !this.op.dead ? dist(p[0], p[1], op.x, op.y) : rand(0, 100);
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
    me.x = best[0];
    me.y = best[1];
    me.hp = ARENA.hp;
    me.ar = 0;
    me.dead = false;
    me.shieldT = ARENA.shield;
    me.nades = 1;
    this.resetGuns();
    this.suppress = true;
    Sound.powerUp();
  },

  // ---------- кадр ----------
  update(dt, g) {
    if (!this.on) return;
    this.t += dt;
    const me = this.me;
    if (this.suppress && !Input.lmb) this.suppress = false;
    if (me.shieldT > 0) me.shieldT -= dt;
    if (this.bigMsg) {
      this.bigMsg.t += dt;
      if (this.bigMsg.t > this.bigMsg.life) this.bigMsg = null;
    }

    if (me.dead) {
      me.respawnT -= dt;
      if (me.respawnT <= 0) this.respawn();
    } else {
      this.updateMove(dt);
      this.updateAim();
      this.updateGun(dt);
      this.checkPickups();
      this.checkMines();
    }
    this.updateNades(dt);
    this.updateFx(dt);
  },

  updateMove(dt) {
    const me = this.me, k = Input.keys;
    let mx = 0, my = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) my -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) my += 1;
    const st = Input.stick;
    if (st && st.id !== null) {
      const dx = st.x - st.ox, dy = st.y - st.oy, d = Math.hypot(dx, dy);
      if (d > 10) {
        const p = Math.min(1, d / 70);
        mx = (dx / d) * p;
        my = (dy / d) * p;
      }
    }
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    if (this.menu) mx = my = 0;
    me.vx = mx * ARENA.speed;
    me.vy = my * ARENA.speed;
    me.x += me.vx * dt;
    this.collide(me);
    me.y += me.vy * dt;
    this.collide(me);
  },

  collide(f) {
    const r = ARENA.r;
    for (let pass = 0; pass < 2; pass++) {
      f.x = clamp(f.x, r, W - r);
      f.y = clamp(f.y, r, H - r);
      for (const b of this.blocks) {
        const cx = clamp(f.x, b.x, b.x + T), cy = clamp(f.y, b.y, b.y + T);
        const dx = f.x - cx, dy = f.y - cy, d = Math.hypot(dx, dy);
        if (d >= r) continue;
        if (d > 0.001) {
          f.x += (dx / d) * (r - d);
          f.y += (dy / d) * (r - d);
        } else {
          // центр внутри блока — выталкиваем по ближайшей стороне
          const opts = [[b.x - r - f.x, 0], [b.x + T + r - f.x, 0], [0, b.y - r - f.y], [0, b.y + T + r - f.y]];
          opts.sort((p, q) => Math.abs(p[0] + p[1]) - Math.abs(q[0] + q[1]));
          f.x += opts[0][0];
          f.y += opts[0][1];
        }
      }
    }
  },

  updateAim() {
    const me = this.me;
    if (!Input.touch || Input.lmb) {
      me.a = Math.atan2(Input.y - (me.y - 6), Input.x - me.x);
    } else if (Math.hypot(me.vx, me.vy) > 20) {
      me.a = Math.atan2(me.vy, me.vx);
    }
  },

  updateGun(dt) {
    const me = this.me;
    if (me.cool > 0) me.cool -= dt;
    const gun = ARENA_GUNS[me.w], st = me.guns[me.w];
    if (me.reloadT > 0) {
      me.reloadT -= dt;
      if (me.reloadT <= 0) {
        const take = Math.min(gun.mag - st.mag, st.res);
        st.mag += take;
        st.res -= take;
      }
      return;
    }
    const want = Input.lmb && !this.menu && !this.suppress;
    if (!want) {
      me.held = false;
      return;
    }
    if (me.cool > 0 || (!gun.auto && me.held)) return;
    me.held = true;
    if (st.mag <= 0) {
      if (st.res > 0) this.reload();
      else {
        Sound.empty();
        me.cool = 0.3;
        if (me.w === 'awp') this.dropAwp();
      }
      return;
    }
    this.fire();
  },

  reload() {
    const me = this.me, gun = ARENA_GUNS[me.w], st = me.guns[me.w];
    if (me.reloadT > 0 || st.mag >= gun.mag || st.res <= 0) return;
    me.reloadT = gun.reload;
    Sound.reload();
  },

  dropAwp() {
    const me = this.me;
    delete me.guns.awp;
    if (me.w === 'awp') this.setGun('ak');
  },

  setGun(w) {
    const me = this.me;
    if (!me.guns[w] || me.w === w || me.dead) return;
    me.w = w;
    me.reloadT = 0;
    me.cool = Math.max(me.cool, 0.25);
    me.held = true;
    Sound.weapon();
  },

  cycleGun(d) {
    const own = ARENA_GUN_ORDER.filter((w) => this.me.guns[w]);
    const i = own.indexOf(this.me.w);
    this.setGun(own[(i + d + own.length) % own.length]);
  },

  muzzle() {
    const me = this.me;
    const len = -WEAPONS[me.w].muzzle.x * ARENA_GUN_SCALE * 0.95;
    return [me.x + Math.cos(me.a) * (len + 8), me.y + 2 + Math.sin(me.a) * (len + 8)];
  },

  fire() {
    const me = this.me, gun = ARENA_GUNS[me.w], st = me.guns[me.w];
    st.mag--;
    me.cool = gun.interval;
    me.flashT = 0.06;
    const [mx, my] = this.muzzle();
    const moving = Math.hypot(me.vx, me.vy) > 30;
    const spread = gun.spread + (moving ? gun.moveSpread : 0);
    const op = this.oppNow();
    const target = op && !this.op.dead && !this.op.sh;
    let dmg = 0;
    const ends = [];
    for (let p = 0; p < gun.pellets; p++) {
      const ang = me.a + (gun.pellets > 1 ? rand(-spread, spread) : (rand(-1, 1) + rand(-1, 1)) * 0.5 * spread);
      const dx = Math.cos(ang), dy = Math.sin(ang);
      let tEnd = Math.min(gun.range, this.wallT(mx, my, dx, dy));
      const wallHit = tEnd < gun.range;
      let hit = false;
      if (target) {
        const tc = rayCircle(mx, my, dx, dy, op.x, op.y - 8, ARENA.r + 5);
        if (tc < tEnd) {
          tEnd = tc;
          hit = true;
          dmg += me.w === 'nova' ? gun.dmg * clamp(1.25 - tc / gun.range, 0.35, 1) : gun.dmg;
        }
      }
      const ex = mx + dx * tEnd, ey = my + dy * tEnd;
      ends.push([Math.round(ex), Math.round(ey)]);
      this.tracers.push({ x1: mx, y1: my, x2: ex, y2: ey, t: 0, w: me.w === 'awp' ? 4 : 2 });
      if (!hit && wallHit) FX.burst(this.fx, ex, ey, 3, { colors: ['#ffe082', '#bdbdbd'], size: 3, speed: 160, grav: 0, life: 0.25 });
    }
    this.stats.shots++;
    if (dmg > 0) {
      dmg = Math.round(dmg);
      this.stats.hitShots++;
      this.stats.dealt += dmg;
      this.hits.push({ i: ++this.hitSeq, d: dmg, w: me.w });
      if (this.hits.length > 12) this.hits.shift();
      this.hitMarkT = 0.16;
      FX.burst(this.fx, op.x, op.y - 10, 8, { colors: ['#c62828', '#8e0000'], size: 5, speed: 180, grav: 300, life: 0.45 });
      FX.text(this.fx, op.x + rand(-10, 10), op.y - 52, `-${dmg}`, { color: '#ffeb3b', font: `bold 18px ${FONT.ui}`, life: 0.7 });
      Sound.hit();
    }
    this.shots.push({ i: ++this.shotSeq, x: Math.round(mx), y: Math.round(my), w: me.w, e: ends });
    if (this.shots.length > 5) this.shots.shift();
    this.gunSound(me.w);
    this.shake = Math.max(this.shake, me.w === 'awp' ? 6 : me.w === 'nova' ? 4 : 1.2);
    if (st.mag <= 0 && st.res > 0) this.reload();
  },

  gunSound(w) {
    if (w === 'awp') Sound.awp();
    else if (w === 'nova') Sound.shotgun();
    else Sound.shot();
  },

  // Расстояние до ближайшего укрытия или края арены.
  wallT(x, y, dx, dy) {
    let best = rayRect(x, y, dx, dy, -2000, -2000, 2000, H + 4000);
    best = Math.min(best, rayRect(x, y, dx, dy, W, -2000, 2000, H + 4000));
    best = Math.min(best, rayRect(x, y, dx, dy, -2000, -2000, W + 4000, 2000));
    best = Math.min(best, rayRect(x, y, dx, dy, -2000, H, W + 4000, 2000));
    for (const b of this.blocks) best = Math.min(best, rayRect(x, y, dx, dy, b.x, b.y, T, T));
    return best;
  },

  throwNade(tx, ty) {
    const me = this.me;
    if (me.dead || me.nades <= 0 || this.menu) return;
    me.nades--;
    const d = dist(me.x, me.y, tx, ty);
    if (d > ARENA.nadeRange) {
      tx = me.x + ((tx - me.x) / d) * ARENA.nadeRange;
      ty = me.y + ((ty - me.y) / d) * ARENA.nadeRange;
    }
    tx = clamp(tx, 10, W - 10);
    ty = clamp(ty, 10, H - 10);
    const n = { i: ++this.nadeSeq, x0: Math.round(me.x), y0: Math.round(me.y), x1: Math.round(tx), y1: Math.round(ty) };
    this.myNades.push(n);
    if (this.myNades.length > 3) this.myNades.shift();
    this.nades.push({ ...n, t: 0, own: true });
    Sound.whoosh();
  },

  updateNades(dt) {
    for (const n of this.nades) {
      n.t += dt;
      if (n.t >= ARENA.nadeFuse && !n.done) {
        n.done = true;
        this.boom(n.x1, n.y1, ARENA.nadeR);
        const me = this.me;
        const d = dist(me.x, me.y, n.x1, n.y1);
        if (!me.dead && d < ARENA.nadeR) this.hurt(ARENA.nadeDmg * (1 - d / ARENA.nadeR) * (n.own ? 0.6 : 1), n.own ? 'self' : 'nade');
      }
    }
    this.nades = this.nades.filter((n) => !n.done);
  },

  boom(x, y, r) {
    this.booms.push({ x, y, r, t: 0 });
    this.craters.push({ x, y, t: 0 });
    if (this.craters.length > 14) this.craters.shift();
    FX.burst(this.fx, x, y, 26, { colors: ['#ffd54a', '#ff7043', '#5d4037', '#212121'], size: 7, speed: 340, grav: 120, life: 0.7 });
    Sound.explosion(true);
    this.shake = Math.max(this.shake, 9);
  },

  checkMines() {
    const me = this.me;
    this.mines.forEach((m, i) => {
      if (this.exploded & (1 << i)) return;
      if (dist(me.x, me.y, m.x, m.y) < 30) this.explodeMine(i, true);
    });
  },

  explodeMine(i, mine) {
    if (this.exploded & (1 << i)) return;
    this.exploded |= 1 << i;
    const m = this.mines[i];
    this.boom(m.x, m.y, ARENA.mineR);
    this.updateNumbers();
    const me = this.me;
    if (mine) this.hurt(ARENA.mineDmg, 'mine');
    else {
      const d = dist(me.x, me.y, m.x, m.y);
      if (!me.dead && d < ARENA.mineR) this.hurt(ARENA.mineDmg * (1 - d / ARENA.mineR), 'mine');
    }
  },

  checkPickups() {
    const me = this.me, now = this.t;
    ARENA_SPOTS.forEach((s, k) => {
      if (now < this.readyAt[k] || dist(me.x, me.y, s.x, s.y) > 40) return;
      if (s.kind === 'gapple') {
        if (me.hp >= ARENA.hp) return;
        me.hp = Math.min(ARENA.hp, me.hp + 40);
        Sound.eat();
        FX.text(this.fx, me.x, me.y - 50, '+40 HP', { color: '#7ee03c' });
      } else if (s.kind === 'vest') {
        if (me.ar >= 100) return;
        me.ar = Math.min(100, me.ar + 50);
        Sound.pickup();
        FX.text(this.fx, me.x, me.y - 50, '+50 брони', { color: '#40c4ff' });
      } else if (s.kind === 'ammo') {
        me.nades = Math.min(3, me.nades + 1);
        me.guns.ak.res = Math.min(180, me.guns.ak.res + 60);
        me.guns.nova.res = Math.min(36, me.guns.nova.res + 6);
        Sound.pickup();
        FX.text(this.fx, me.x, me.y - 50, '+граната, +патроны', { color: '#ffd54a' });
      } else if (s.kind === 'awp') {
        me.guns.awp = { mag: ARENA_GUNS.awp.mag, res: ARENA_GUNS.awp.reserve };
        me.w = 'nova';
        this.setGun('awp');
        FX.text(this.fx, me.x, me.y - 50, 'AWP!', { color: '#ffd54a', font: `bold 22px ${FONT.ui}` });
      }
      this.gen[k]++;
      this.readyAt[k] = now + s.every;
    });
  },

  hurt(d, cause) {
    const me = this.me;
    if (me.dead || me.shieldT > 0 || !(d > 0)) return;
    const absorbed = Math.min(me.ar, d * 0.5);
    me.ar -= absorbed;
    me.hp -= d - absorbed;
    me.hurtT = 0.35;
    this.stats.taken += d;
    FX.burst(this.fx, me.x, me.y - 10, 6, { colors: ['#c62828', '#8e0000'], size: 5, speed: 160, grav: 300, life: 0.4 });
    Sound.hurt();
    if (me.hp <= 0) this.die(cause);
  },

  die(cause) {
    const me = this.me;
    me.dead = true;
    me.hp = 0;
    me.dn++;
    me.lk = cause;
    me.respawnT = ARENA.respawn;
    me.reloadT = 0;
    this.craters.push({ x: me.x, y: me.y, t: 0, grave: true });
    FX.burst(this.fx, me.x, me.y, 20, { colors: ['#c62828', '#8e0000', '#fff'], size: 6, speed: 260, grav: 300, life: 0.7 });
    this.addFeed(cause, Duel.oppName || 'Соперник', Duel.name, false);
    this.bigMsg = { str: 'WASTED', sub: '', t: 0, life: ARENA.respawn, color: '#ff5252', wasted: true };
    Sound.wasted();
  },

  addFeed(cause, killer, victim, mine) {
    let str;
    if (cause === 'mine') str = `${victim} подорвался на мине`;
    else if (cause === 'self') str = `${victim} подорвал сам себя`;
    else str = `${killer}  [${cause === 'nade' ? 'граната' : WEAPONS[cause] ? WEAPONS[cause].name : 'АК-47'}]  ${victim}`;
    this.feed.unshift({ str, t: this.t, mine });
    if (this.feed.length > 5) this.feed.pop();
  },

  // ---------- сеть ----------
  netState() {
    const me = this.me;
    return {
      mode: 'arena',
      x: Math.round(me.x),
      y: Math.round(me.y),
      a: Math.round(me.a * 100) / 100,
      hp: Math.max(0, Math.ceil(me.hp)),
      ar: Math.ceil(me.ar),
      w: me.w,
      dead: me.dead ? 1 : 0,
      sh: me.shieldT > 0 ? 1 : 0,
      dn: me.dn,
      lk: me.lk,
      q: ++this.q,
      s: this.shots,
      hi: this.hits,
      gr: this.myNades,
      pk: this.gen.slice(),
      mn: this.exploded,
      dmg: Math.round(this.stats.dealt),
      acc: this.accuracy(),
    };
  },

  accuracy() {
    return this.stats.shots ? Math.round((this.stats.hitShots / this.stats.shots) * 100) : 0;
  },

  // Новое состояние соперника из его «присутствия».
  remote(st) {
    if (!this.on || !st || typeof st.x !== 'number' || st.q === this.lastQ) return;
    this.lastQ = st.q;
    const now = performance.now();
    const op = this.op;
    const dead = !!st.dead;
    const s = { t: now, x: clamp(num(st.x), 0, W), y: clamp(num(st.y), 0, H), a: num(st.a) };
    const last = this.buf[this.buf.length - 1];
    if (last && (dist(last.x, last.y, s.x, s.y) > 180 || dead !== op.dead)) this.buf = [];
    this.buf.push(s);
    if (this.buf.length > 30) this.buf.shift();
    if (dead && !op.dead) op.deadAt = { x: s.x, y: s.y };
    op.dead = dead;
    op.hp = clamp(num(st.hp), 0, ARENA.hp);
    op.ar = clamp(num(st.ar), 0, 100);
    op.w = ARENA_GUNS[st.w] ? st.w : 'ak';
    op.sh = !!st.sh;
    op.dmg = num(st.dmg);
    op.acc = num(st.acc);

    // соперник погиб — фраг тебе
    const dn = Math.max(0, Math.floor(num(st.dn)));
    if (dn > this.opDn) {
      const cause = ['mine', 'self', 'nade', ...ARENA_GUN_ORDER].includes(st.lk) ? st.lk : 'ak';
      this.addFeed(cause, Duel.name, Duel.oppName || 'Соперник', true);
      this.craters.push({ x: s.x, y: s.y, t: 0, grave: true });
      FX.text(this.fx, 640, 120, '+1 ФРАГ', { color: '#7ee03c', font: `bold 30px ${FONT.ui}`, life: 1.4, vy: -20 });
      Sound.coin();
    }
    this.opDn = dn;

    const list = (v, n) => (Array.isArray(v) ? v.filter((e) => e && typeof e === 'object' && Number.isFinite(e.i)).slice(-n) : []);
    // выстрелы соперника — трассеры и звук
    let sounded = false;
    for (const sh of list(st.s, 8)) {
      if (sh.i <= this.seenShot) continue;
      this.seenShot = sh.i;
      const ends = Array.isArray(sh.e) ? sh.e.slice(0, 12) : [];
      for (const e of ends) {
        if (!Array.isArray(e)) continue;
        this.tracers.push({ x1: num(sh.x), y1: num(sh.y), x2: num(e[0]), y2: num(e[1]), t: 0, w: sh.w === 'awp' ? 4 : 2 });
      }
      op.flashT = 0.06;
      if (!sounded) {
        this.gunSound(ARENA_GUNS[sh.w] ? sh.w : 'ak');
        sounded = true;
      }
    }
    // попадания по тебе (считает стрелок)
    for (const h of list(st.hi, 16)) {
      if (h.i <= this.seenHit) continue;
      this.seenHit = h.i;
      this.hurt(clamp(num(h.d), 0, 150), ARENA_GUNS[h.w] ? h.w : 'ak');
    }
    // гранаты соперника — урон по тебе считаешь ты
    for (const n of list(st.gr, 4)) {
      if (n.i <= this.seenNade) continue;
      this.seenNade = n.i;
      this.nades.push({ x0: num(n.x0), y0: num(n.y0), x1: clamp(num(n.x1), 0, W), y1: clamp(num(n.y1), 0, H), t: 0, own: false });
    }
    // подобранные предметы
    if (Array.isArray(st.pk)) {
      ARENA_SPOTS.forEach((sp, k) => {
        const gv = Math.floor(num(st.pk[k]));
        if (gv > this.gen[k]) {
          this.gen[k] = gv;
          this.readyAt[k] = this.t + sp.every;
        }
      });
    }
    // взорванные мины
    const mn = Math.floor(num(st.mn)) & ((1 << this.mines.length) - 1);
    this.mines.forEach((m, i) => {
      if (mn & (1 << i) && !(this.exploded & (1 << i))) this.explodeMine(i, false);
    });
  },

  // Где соперник сейчас (с небольшой задержкой — так движение плавное).
  oppNow() {
    const b = this.buf;
    if (!b.length) return null;
    const rt = performance.now() - ARENA.lag;
    if (rt <= b[0].t) return b[0];
    for (let i = b.length - 1; i > 0; i--) {
      const A = b[i - 1], B = b[i];
      if (A.t <= rt) {
        if (rt >= B.t) return B;
        const k = (rt - A.t) / (B.t - A.t);
        let da = B.a - A.a;
        while (da > Math.PI) da -= TAU;
        while (da < -Math.PI) da += TAU;
        return { x: lerp(A.x, B.x, k), y: lerp(A.y, B.y, k), a: A.a + da * k };
      }
    }
    return b[b.length - 1];
  },

  // Итог матча, если он уже ясен.
  check() {
    const mine = this.opDn, theirs = this.me.dn;
    const opp = Duel.oppName || 'Соперник';
    if (mine >= ARENA.frags) return { win: true, reason: `Ты первым набрал ${ARENA.frags} фрагов` };
    if (theirs >= ARENA.frags) return { win: false, reason: `${opp} первым набрал ${ARENA.frags} фрагов` };
    if (this.t >= ARENA.time) {
      if (mine > theirs) return { win: true, reason: `Время вышло: ${mine}:${theirs}` };
      if (mine < theirs) return { win: false, reason: `Время вышло: ${mine}:${theirs}` };
      return { win: null, reason: `Время вышло: ${mine}:${theirs}` };
    }
    return null;
  },

  // ---------- клавиши ----------
  onKey(code, g) {
    if (code === 'Escape' || code === 'KeyP') {
      this.menu = !this.menu;
      this.suppress = true;
      return;
    }
    if (this.menu) return;
    const me = this.me;
    if (code === 'KeyR') this.reload();
    else if (code === 'Digit1') this.setGun('ak');
    else if (code === 'Digit2') this.setGun('nova');
    else if (code === 'Digit3') this.setGun('awp');
    else if (code === 'KeyQ' || code === 'KeyX') this.cycleGun(1);
    else if (code === 'KeyG') {
      if (Input.touch && !Input.lmb) this.throwNade(me.x + Math.cos(me.a) * 300, me.y + Math.sin(me.a) * 300);
      else this.throwNade(Input.x, Input.y);
    }
  },

  updateFx(dt) {
    const me = this.me;
    if (me.hurtT > 0) me.hurtT -= dt;
    if (me.flashT > 0) me.flashT -= dt;
    if (this.op.flashT > 0) this.op.flashT -= dt;
    if (this.hitMarkT > 0) this.hitMarkT -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);
    for (const p of this.fx.particles) {
      p.life -= dt;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.fx.particles = this.fx.particles.filter((p) => p.life > 0);
    for (const tx of this.fx.texts) {
      tx.life -= dt;
      tx.y += tx.vy * dt;
    }
    this.fx.texts = this.fx.texts.filter((tx) => tx.life > 0);
    for (const b of this.booms) b.t += dt;
    this.booms = this.booms.filter((b) => b.t < 0.55);
    for (const tr of this.tracers) tr.t += dt;
    this.tracers = this.tracers.filter((tr) => tr.t < 0.08);
    for (const c of this.craters) c.t += dt;
  },
};

// ---------- отрисовка ----------
function arenaBackground(theme) {
  const key = View.pw + 'x' + View.ph + ':' + theme;
  if (Arena.bg && Arena.bgKey === key) return Arena.bg;
  const c = Arena.bg || document.createElement('canvas');
  c.width = View.pw;
  c.height = View.ph;
  const ctx = c.getContext('2d');
  ctx.setTransform(View.k, 0, 0, View.k, 0, 0);
  const th = THEMES[theme] || THEMES.classic;
  for (let r = 0; r < ROWS; r++) {
    for (let col = 0; col < COLS; col++) {
      ctx.fillStyle = (r + col) % 2 === 0 ? th.light : th.dark;
      ctx.fillRect(col * T, r * T, T, T);
    }
  }
  paintThemeBoard(ctx, theme);
  const g = ctx.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 820);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  Arena.bg = c;
  Arena.bgKey = key;
  return c;
}

function drawArenaBlock(ctx, b) {
  const x = b.x, y = b.y;
  ell(ctx, x + T / 2, y + T - 4, 40, 9, 'rgba(0,0,0,0.25)');
  if (b.kind === 'crate') {
    ctx.fillStyle = '#6d4513';
    ctx.fillRect(x + 4, y + 12, T - 8, T - 14);
    ctx.fillStyle = '#b07a35';
    ctx.fillRect(x + 4, y + 2, T - 8, T - 18);
    ctx.strokeStyle = '#5a3a10';
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 6, y + 4, T - 12, T - 22);
    line(ctx, x + 8, y + 6, x + T - 8, y + T - 20, '#5a3a10', 4);
    line(ctx, x + T - 8, y + 6, x + 8, y + T - 20, 'rgba(90,58,16,0.5)', 3);
    ctx.fillStyle = '#4e310c';
    ctx.fillRect(x + 4, y + T - 16, T - 8, 14);
  } else if (b.kind === 'stone') {
    ctx.fillStyle = '#5f5f5f';
    ctx.fillRect(x + 3, y + T - 18, T - 6, 16);
    ctx.fillStyle = '#8a8a8a';
    ctx.fillRect(x + 3, y + 2, T - 6, T - 18);
    const rng = arenaRng(b.c * 31 + b.r);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = rng() < 0.5 ? '#6f6f6f' : '#a3a3a3';
      ctx.fillRect(x + 6 + Math.floor(rng() * 6) * 11, y + 5 + Math.floor(rng() * 5) * 11, 13, 9);
    }
    ctx.strokeStyle = '#3d3d3d';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 3, y + 2, T - 6, T - 4);
  } else {
    ctx.fillStyle = '#3e3a36';
    ctx.fillRect(x + 6, y + T - 20, T - 12, 16);
    ctx.fillStyle = '#5b5550';
    ctx.fillRect(x + 6, y + 18, T - 12, T - 38);
    drawPiece(ctx, 'r', (b.c + b.r) % 2 === 0, x + T / 2, y + 22, 74, { shadow: false });
  }
}

function drawArenaPickup(ctx, s, k, t) {
  const ready = t >= Arena.readyAt[k];
  if (!ready) {
    const left = Math.ceil(Arena.readyAt[k] - t);
    ctx.globalAlpha = 0.35;
    ell(ctx, s.x, s.y + 14, 18, 5, 'rgba(0,0,0,0.5)');
    text(ctx, String(left), s.x, s.y + 6, { font: `bold 14px ${FONT.ui}`, color: '#fff', stroke: '#000', lw: 3, align: 'center' });
    ctx.globalAlpha = 1;
    return;
  }
  const bob = Math.sin(t * 3 + k) * 4;
  ell(ctx, s.x, s.y + 18, 20, 6, 'rgba(0,0,0,0.3)');
  circ(ctx, s.x, s.y + bob, 24, 'rgba(255,255,255,0.18)');
  if (s.kind === 'awp') {
    ctx.save();
    ctx.translate(s.x, s.y + bob);
    ctx.scale(0.13, 0.13);
    ctx.translate(250, 0);
    drawWeapon(ctx, 'awp', 0, false);
    ctx.restore();
  } else if (s.kind === 'ammo') {
    drawAmmoBox(ctx, s.x, s.y + bob, 34);
    drawGrenade(ctx, s.x + 16, s.y + bob - 12, 0.8);
  } else {
    drawItemIcon(ctx, s.kind, s.x, s.y + bob, 36, t);
  }
}

function drawFighter(ctx, f, white, me, t) {
  // f: { x, y, a, w, hp, ar, sh, hurt, flash, name }
  const x = f.x, y = f.y;
  ell(ctx, x, y + 20, 26, 8, 'rgba(0,0,0,0.3)');
  ctx.beginPath();
  ctx.ellipse(x, y + 20, 28, 9, 0, 0, TAU);
  ctx.strokeStyle = me ? 'rgba(126,224,60,0.9)' : 'rgba(255,82,82,0.9)';
  ctx.lineWidth = 3;
  ctx.stroke();
  const back = Math.sin(f.a) < -0.3; // целится вверх — оружие за фигурой
  const gun = () => {
    ctx.save();
    ctx.translate(x + Math.cos(f.a) * 6, y + 2);
    ctx.rotate(f.a + Math.PI);
    if (Math.cos(f.a) > 0) ctx.scale(1, -1);
    ctx.scale(ARENA_GUN_SCALE, ARENA_GUN_SCALE);
    drawWeapon(ctx, f.w, f.flash > 0 ? 1 : 0, false);
    ctx.restore();
    if (f.flash > 0) {
      const len = -WEAPONS[f.w].muzzle.x * ARENA_GUN_SCALE * 0.95 + 10;
      ctx.save();
      ctx.translate(x + Math.cos(f.a) * len, y + 2 + Math.sin(f.a) * len);
      ctx.rotate(f.a + Math.PI);
      drawMuzzleFlash(ctx, 0, 0, 0.3);
      ctx.restore();
    }
  };
  if (back) gun();
  drawPiece(ctx, 'k', white, x, y - 12, 66, { shadow: false, tint: f.hurt > 0 ? '#ff6e6e' : undefined });
  if (!back) gun();
  if (f.sh) {
    ctx.beginPath();
    ctx.arc(x, y - 8, 42 + Math.sin(t * 10) * 2, 0, TAU);
    ctx.strokeStyle = 'rgba(64,196,255,0.85)';
    ctx.lineWidth = 3;
    ctx.stroke();
    circ(ctx, x, y - 8, 42, 'rgba(64,196,255,0.12)');
  }
  // полоски здоровья и брони, ник
  const bw = 60, bx = x - bw / 2, by = y - 62;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(bx - 2, by - 2, bw + 4, 12);
  ctx.fillStyle = me ? '#7ee03c' : '#ff5252';
  ctx.fillRect(bx, by, bw * clamp(f.hp / ARENA.hp, 0, 1), 5);
  ctx.fillStyle = '#40c4ff';
  ctx.fillRect(bx, by + 6, bw * clamp(f.ar / 100, 0, 1), 2);
  text(ctx, f.name, x, by - 6, { font: `bold 14px ${FONT.ui}`, color: me ? '#c5f5a0' : '#ffcdd2', stroke: '#000', lw: 4, align: 'center' });
}

function drawArena(ctx, g, now) {
  const A = Arena, t = A.t;
  ctx.save();
  if (A.shake > 0) ctx.translate(rand(-1, 1) * A.shake, rand(-1, 1) * A.shake);
  ctx.drawImage(arenaBackground(A.theme), 0, 0, W, H);

  // цифры «Сапёра» видны только рядом с тобой — как миноискатель
  const me0 = A.me;
  if (!me0.dead) {
    for (const n of A.numbers) {
      const d = dist(n.x, n.y, me0.x, me0.y);
      if (d > ARENA.detect) continue;
      ctx.globalAlpha = 0.7 * clamp((ARENA.detect - d) / 70, 0, 1);
      text(ctx, String(n.n), n.x, n.y + 12, { font: `bold 32px ${FONT.pixel}`, color: MS_COLORS[n.n] || '#333', align: 'center' });
    }
    ctx.globalAlpha = 1;
  }
  // воронки и могилы
  for (const c of A.craters) {
    if (c.grave) {
      ctx.globalAlpha = Math.max(0, 1 - c.t / 6);
      if (ctx.globalAlpha <= 0) continue;
      drawPiece(ctx, 'k', true, c.x, c.y, 40, { tint: 'rgba(60,60,60,0.7)', shadow: false });
      line(ctx, c.x - 14, c.y - 14, c.x + 14, c.y + 14, '#c62828', 4);
      line(ctx, c.x + 14, c.y - 14, c.x - 14, c.y + 14, '#c62828', 4);
    } else {
      ctx.globalAlpha = 0.55;
      ell(ctx, c.x, c.y, 34, 22, '#2b2118');
      ell(ctx, c.x, c.y, 22, 13, '#16100b');
    }
  }
  ctx.globalAlpha = 1;
  ARENA_SPOTS.forEach((s, k) => drawArenaPickup(ctx, s, k, t));

  // укрытия и бойцы — по глубине
  const list = A.blocks.map((b) => ({ y: b.y + T, draw: () => drawArenaBlock(ctx, b) }));
  const me = A.me;
  const host = A.role === 'host';
  if (!me.dead) {
    list.push({ y: me.y + 20, draw: () => drawFighter(ctx, { x: me.x, y: me.y, a: me.a, w: me.w, hp: me.hp, ar: me.ar, sh: me.shieldT > 0, hurt: me.hurtT, flash: me.flashT, name: Duel.name }, host, true, t) });
  }
  const op = A.oppNow();
  if (op && !A.op.dead) {
    list.push({ y: op.y + 20, draw: () => drawFighter(ctx, { x: op.x, y: op.y, a: op.a, w: A.op.w, hp: A.op.hp, ar: A.op.ar, sh: A.op.sh, hurt: 0, flash: A.op.flashT, name: Duel.oppName || 'Соперник' }, !host, false, t) });
  }
  list.sort((p, q) => p.y - q.y);
  for (const it of list) it.draw();

  // гранаты в полёте
  for (const n of A.nades) {
    const k = Math.min(1, n.t / ARENA.nadeFly);
    const x = lerp(n.x0, n.x1, k), y = lerp(n.y0, n.y1, k) - Math.sin(Math.PI * k) * 70;
    ell(ctx, lerp(n.x0, n.x1, k), lerp(n.y0, n.y1, k) + 6, 8, 3, 'rgba(0,0,0,0.35)');
    drawGrenade(ctx, x, y, 0.9);
    if (k >= 1 && Math.floor(n.t * 8) % 2 === 0) {
      ctx.beginPath();
      ctx.arc(n.x1, n.y1, ARENA.nadeR, 0, TAU);
      ctx.strokeStyle = 'rgba(255,82,82,0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  // трассеры
  for (const tr of A.tracers) {
    ctx.globalAlpha = 1 - tr.t / 0.08;
    line(ctx, tr.x1, tr.y1, tr.x2, tr.y2, '#fff59d', tr.w);
  }
  ctx.globalAlpha = 1;
  // взрывы и частицы
  for (const ex of A.booms) {
    const k = ex.t / 0.55;
    const r = ex.r * (0.35 + k * 0.75);
    const gr = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, r);
    gr.addColorStop(0, `rgba(255,250,210,${1 - k})`);
    gr.addColorStop(0.4, `rgba(255,170,30,${0.9 * (1 - k)})`);
    gr.addColorStop(1, 'rgba(200,60,0,0)');
    circ(ctx, ex.x, ex.y, r, gr);
  }
  for (const p of A.fx.particles) {
    ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.6);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (const tx of A.fx.texts) {
    ctx.globalAlpha = Math.min(1, (tx.life / tx.max) * 2);
    text(ctx, tx.str, tx.x, tx.y, { font: tx.font, color: tx.color, stroke: tx.stroke, lw: 4, align: 'center' });
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (me.hurtT > 0) vignette(ctx, 'rgba(220,0,0,A)', Math.min(0.7, me.hurtT * 2), 180);
  drawArenaHud(ctx, g, now);
}

function drawArenaHud(ctx, g, now) {
  const A = Arena, me = A.me, t = A.t;
  // счёт и время
  rr(ctx, 430, 6, 420, 64, 12);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fill();
  text(ctx, Duel.name, 590, 34, { font: `bold 18px ${FONT.ui}`, color: '#c5f5a0', align: 'right' });
  text(ctx, `${A.opDn} : ${me.dn}`, 640, 40, { font: `34px ${FONT.title}`, color: '#fff', align: 'center' });
  text(ctx, Duel.oppName || 'Соперник', 690, 34, { font: `bold 18px ${FONT.ui}`, color: '#ffcdd2' });
  const left = Math.max(0, Math.ceil(ARENA.time - t));
  text(ctx, `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}  ·  до ${ARENA.frags} фрагов`, 640, 62, { font: `13px ${FONT.ui}`, color: left <= 30 ? '#ff8a80' : '#b0bec5', align: 'center' });
  if (Duel.phase === 'playing' && performance.now() - Duel.oppSeen > 2500) {
    text(ctx, 'Соперник не на связи…', 640, 92, { font: `bold 16px ${FONT.ui}`, color: '#ffab91', stroke: '#000', lw: 4, align: 'center' });
  }

  // лента убийств
  let fy = 24;
  for (const f of A.feed) {
    const age = t - f.t;
    if (age > 7) continue;
    ctx.globalAlpha = Math.min(1, (7 - age) / 1.5);
    ctx.font = `bold 14px ${FONT.ui}`;
    const w = ctx.measureText(f.str).width + 20;
    rr(ctx, 1268 - w, fy - 16, w, 24, 6);
    ctx.fillStyle = f.mine ? 'rgba(46,125,50,0.75)' : 'rgba(183,28,28,0.75)';
    ctx.fill();
    text(ctx, f.str, 1258, fy + 1, { font: `bold 14px ${FONT.ui}`, color: '#fff', align: 'right' });
    fy += 28;
  }
  ctx.globalAlpha = 1;

  // здоровье, броня, гранаты
  rr(ctx, 12, 646, 292, 62, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();
  text(ctx, '❤', 26, 674, { font: `18px ${FONT.ui}`, color: '#ff5252' });
  ctx.fillStyle = '#3a1010';
  ctx.fillRect(52, 660, 160, 16);
  ctx.fillStyle = me.hp > 35 ? '#7ee03c' : '#ff5252';
  ctx.fillRect(52, 660, 160 * clamp(me.hp / ARENA.hp, 0, 1), 16);
  text(ctx, String(Math.max(0, Math.ceil(me.hp))), 222, 674, { font: `bold 16px ${FONT.ui}`, color: '#fff' });
  ctx.fillStyle = '#0d2530';
  ctx.fillRect(52, 684, 160, 9);
  ctx.fillStyle = '#40c4ff';
  ctx.fillRect(52, 684, 160 * clamp(me.ar / 100, 0, 1), 9);
  text(ctx, String(Math.ceil(me.ar)), 222, 694, { font: `12px ${FONT.ui}`, color: '#b3e5fc' });
  if (me.nades > 0) {
    drawGrenade(ctx, 272, 672, 0.75);
    text(ctx, `×${me.nades}`, 282, 700, { font: `bold 12px ${FONT.ui}`, color: '#fff' });
  }

  // оружие и патроны
  const st = me.guns[me.w] || { mag: 0, res: 0 };
  rr(ctx, 1008, 646, 260, 62, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();
  drawWeaponIcon(ctx, me.w, 1060, 677);
  text(ctx, `${st.mag}`, 1196, 686, { font: `30px ${FONT.title}`, color: st.mag ? '#fff' : '#ff5252', align: 'right' });
  text(ctx, `/ ${st.res}`, 1204, 686, { font: `16px ${FONT.ui}`, color: '#b0bec5' });
  const own = ARENA_GUN_ORDER.filter((w) => me.guns[w]);
  text(ctx, own.map((w, i) => (w === me.w ? `[${ARENA_GUN_ORDER.indexOf(w) + 1}]` : `${ARENA_GUN_ORDER.indexOf(w) + 1}`)).join(' '), 1138, 702, { font: `11px ${FONT.ui}`, color: '#90a4ae', align: 'center' });
  if (me.reloadT > 0) {
    const k = 1 - me.reloadT / ARENA_GUNS[me.w].reload;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(1020, 650, 236, 4);
    ctx.fillStyle = '#ffd54a';
    ctx.fillRect(1020, 650, 236 * k, 4);
  }

  // подсказка в начале
  if (t < 9) {
    ctx.globalAlpha = Math.min(1, (9 - t) / 1.5);
    const hint = Input.touch
      ? 'Левый палец — бег (джойстик), правый — прицел и огонь. Кнопки по бокам: граната, оружие, перезарядка'
      : 'WASD — бег · мышь — прицел и огонь · R — перезарядка · 1/2/3 или колесо — оружие · G — граната · Esc — меню';
    wrapText(ctx, hint, 640, 626, 700, 18, { font: `bold 14px ${FONT.ui}`, color: '#fff', stroke: '#000', lw: 4, align: 'center' });
    ctx.globalAlpha = 1;
  }

  // большие надписи
  const m = A.bigMsg;
  if (m) {
    const k = Math.min(1, m.t * 4, (m.life - m.t) * 3);
    ctx.globalAlpha = clamp(k, 0, 1);
    if (m.wasted) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 300, W, 120);
      text(ctx, 'WASTED', 640, 380, { font: `84px ${FONT.gta}`, color: '#d32f2f', stroke: '#000', lw: 8, align: 'center' });
      text(ctx, `Возрождение через ${Math.max(1, Math.ceil(me.respawnT))}…`, 640, 412, { font: `bold 18px ${FONT.ui}`, color: '#fff', stroke: '#000', lw: 4, align: 'center' });
    } else {
      text(ctx, m.str, 640, 300, { font: `72px ${FONT.title}`, color: m.color, stroke: '#000', lw: 9, align: 'center' });
      if (m.sub) text(ctx, m.sub, 640, 340, { font: `bold 22px ${FONT.ui}`, color: '#fff', stroke: '#000', lw: 5, align: 'center' });
    }
    ctx.globalAlpha = 1;
  }

  // джойстик на телефоне
  const sk = Input.stick;
  if (Input.touch && sk && sk.id !== null) {
    ctx.beginPath();
    ctx.arc(sk.ox, sk.oy, 70, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    ctx.stroke();
    const dx = sk.x - sk.ox, dy = sk.y - sk.oy, d = Math.hypot(dx, dy), k = d > 70 ? 70 / d : 1;
    circ(ctx, sk.ox + dx * k, sk.oy + dy * k, 28, 'rgba(255,255,255,0.45)');
  } else if (Input.touch && t < 12) {
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(170, 520, 60, 0, TAU);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
    text(ctx, 'бег', 170, 526, { font: `bold 16px ${FONT.ui}`, color: '#fff', align: 'center' });
    ctx.globalAlpha = 1;
  }

  // меню
  g.buttons = [];
  if (A.menu) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'МЕНЮ', 640, 250, { font: `56px ${FONT.title}`, color: '#fff', stroke: '#000', lw: 8, align: 'center' });
    text(ctx, 'Игра не на паузе — соперник продолжает!', 640, 290, { font: `bold 18px ${FONT.ui}`, color: '#ffab91', align: 'center' });
    mcButton(ctx, g, 'ПРОДОЛЖИТЬ', 640 - 160, 330, 320, 52, () => {
      A.menu = false;
      A.suppress = true;
    });
    mcButton(ctx, g, 'СДАТЬСЯ И ВЫЙТИ', 640 - 160, 398, 320, 52, () => Duel.close(g), { fill: '#8a3a3a' });
  }
}

function drawArenaCrosshair(ctx) {
  const A = Arena;
  if (A.menu || A.me.dead) return;
  let x = Input.x, y = Input.y;
  if (Input.touch) {
    if (!Input.lmb) return;
  }
  const gap = A.me.w === 'nova' ? 14 : 7;
  ctx.lineWidth = 2;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    line(ctx, x + dx * gap, y + dy * gap, x + dx * (gap + 10), y + dy * (gap + 10), '#000', 4);
    line(ctx, x + dx * gap, y + dy * gap, x + dx * (gap + 10), y + dy * (gap + 10), '#7ee03c', 2);
  }
  if (A.hitMarkT > 0) {
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) line(ctx, x + dx * 6, y + dy * 6, x + dx * 14, y + dy * 14, '#fff', 3);
  }
}

// Весь кадр в режиме арены (и экран итога поверх неё).
function renderArena(ctx, g, now) {
  drawArena(ctx, g, now);
  if (g.state === 'duelover') {
    g.buttons = [];
    drawDuelOver(ctx, g, now);
  }
  Ach.draw(ctx);
  if (g.state === 'arena' && !Arena.menu) drawArenaCrosshair(ctx);
  else if (!Input.touch) drawPointer(ctx);
}
