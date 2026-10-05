'use strict';
/* Внезапный бой «как в Undertale» посреди кампании: экран чернеет, душа-сердечко и скелет Санс.
   Твой ход — БИТЬ (останови полоску в центре), ДЕЙСТВ., ВЕЩЬ или ПОЩАДА.
   Его ход — уворачивайся душой в белой рамке от костей, дождя и черепов-бластеров;
   синие кости ранят, только если двигаешься. Здоровье общее с кампанией.
   Пощадишь — вылечит и даст неуязвимость; одолеешь — деньги; погибнешь — погибнешь и в игре. */

const UT = {
  hp: 60, // здоровье Санса
  soulSpeed: 170,
  soulR: 7,
  dmg: 1, // как у Санса — по единичке, зато часто
  iframes: 0.8,
  turnTime: 6.5,
  text: { x: 140, y: 300, w: 1000, h: 170 }, // рамка с текстом
  arena: { x: 490, y: 290, w: 300, h: 210 }, // рамка во время атаки
  btnY: 588,
  sansX: 640,
  sansY: 160,
};

const UT_BUTTONS = [
  { key: 'fight', label: 'БИТЬ' },
  { key: 'act', label: 'ДЕЙСТВ.' },
  { key: 'item', label: 'ВЕЩЬ' },
  { key: 'mercy', label: 'ПОЩАДА' },
];
const UT_ACTS = ['Проверить', 'Пошутить', 'Подмигнуть', 'Хот-дог'];
const UT_FLAVOR = [
  '* Санс преградил путь.',
  '* Санс выглядит подозрительно расслабленным.',
  '* Пахнет хот-догами.',
  '* Где-то тикают шахматные часы.',
  '* Санс делает вид, что ему всё равно.',
  '* Санс зевнул. Демонстративно.',
];
const UT_TALK = [
  'ну что, приятель. начнём?',
  'хе-хе. неплохо уворачиваешься.',
  'вообще-то я должен спать на посту.',
  'шахматная доска? я тут проездом.',
  'сдаваться не будешь? я тоже.',
  'ладно. последняя атака. честно.',
];
const UT_PATTERNS = ['bones', 'rain', 'blasters', 'blue', 'mix', 'storm'];

// ---------- рисунки ----------
function drawSoul(ctx, x, y, s = 1, color = '#ff1a1a') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.bezierCurveTo(-9, 0, -10, -6, -5, -8);
  ctx.bezierCurveTo(-2, -9, 0, -6, 0, -4);
  ctx.bezierCurveTo(0, -6, 2, -9, 5, -8);
  ctx.bezierCurveTo(10, -6, 9, 0, 0, 7);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

// Скелет в голубой худи, шортах и розовых тапках.
function drawSans(ctx, x, y, t, o = {}) {
  const bob = o.still ? 0 : Math.sin(t * 2) * 2;
  ctx.save();
  ctx.translate(x + (o.dx || 0), y + bob);
  ctx.globalAlpha *= o.alpha === undefined ? 1 : o.alpha;
  // ноги и тапки
  ctx.fillStyle = '#fff';
  ctx.fillRect(-24, 64, 8, 24);
  ctx.fillRect(16, 64, 8, 24);
  ell(ctx, -22, 92, 16, 7, '#f48fb1');
  ell(ctx, 22, 92, 16, 7, '#f48fb1');
  // шорты с лампасами
  rr(ctx, -36, 38, 72, 32, 6);
  ctx.fillStyle = '#1b1b1b';
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(-34, 44, 4, 24);
  ctx.fillRect(30, 44, 4, 24);
  // рукава и кисти
  for (const sx of [-1, 1]) {
    rr(ctx, sx > 0 ? 40 : -62, -16, 22, 58, 9);
    ctx.fillStyle = '#3b7dc4';
    ctx.fill();
    ctx.strokeStyle = '#0d2a4a';
    ctx.lineWidth = 2;
    ctx.stroke();
    circ(ctx, sx * 51, 46, 8, '#fff');
  }
  // худи
  rr(ctx, -50, -24, 100, 68, 16);
  ctx.fillStyle = '#3b7dc4';
  ctx.fill();
  ctx.strokeStyle = '#0d2a4a';
  ctx.lineWidth = 3;
  ctx.stroke();
  line(ctx, 0, -14, 0, 40, '#0d2a4a', 2);
  rr(ctx, -40, 18, 26, 16, 4);
  ctx.strokeStyle = '#2a5d96';
  ctx.stroke();
  rr(ctx, 14, 18, 26, 16, 4);
  ctx.stroke();
  // мех капюшона
  ell(ctx, 0, -24, 50, 13, '#e3ecf5');
  for (let i = -4; i <= 4; i++) circ(ctx, i * 11, -20 + Math.abs(i) * 0.6, 6, '#eef3f8');
  // череп
  ctx.beginPath();
  ctx.ellipse(0, -64, 40, 35, 0, 0, TAU);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.stroke();
  ell(ctx, -15, -70, 10, 9, '#000');
  ell(ctx, 15, -70, 10, 9, '#000');
  if (o.eye) {
    const gr = ctx.createRadialGradient(-15, -70, 1, -15, -70, 16);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.35, o.eye);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    circ(ctx, -15, -70, 16, gr);
  } else if (!o.closed) {
    circ(ctx, -15, -70, 3.2, '#fff');
    circ(ctx, 15, -70, 3.2, '#fff');
  }
  poly(ctx, [0, -60, -4, -53, 4, -53], '#111');
  // улыбка
  ctx.beginPath();
  ctx.moveTo(-26, -46);
  ctx.quadraticCurveTo(0, -30, 26, -46);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
  ctx.stroke();
  for (let i = -3; i <= 3; i++) line(ctx, i * 6, -44 + Math.abs(i) * 0.4, i * 6, -38 + Math.abs(i) * 0.9, '#111', 2);
  if (o.tired) {
    ctx.beginPath();
    ctx.moveTo(32, -86);
    ctx.quadraticCurveTo(40, -74, 32, -70);
    ctx.quadraticCurveTo(24, -74, 32, -86);
    ctx.fillStyle = '#81d4fa';
    ctx.fill();
  }
  ctx.restore();
}

function drawBone(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  if (h >= w) {
    ctx.fillRect(x + w * 0.25, y + w * 0.4, w * 0.5, Math.max(0, h - w * 0.8));
    circ(ctx, x + w * 0.3, y + w * 0.35, w * 0.32, color);
    circ(ctx, x + w * 0.7, y + w * 0.35, w * 0.32, color);
    circ(ctx, x + w * 0.3, y + h - w * 0.35, w * 0.32, color);
    circ(ctx, x + w * 0.7, y + h - w * 0.35, w * 0.32, color);
  } else {
    ctx.fillRect(x + h * 0.4, y + h * 0.25, Math.max(0, w - h * 0.8), h * 0.5);
    circ(ctx, x + h * 0.35, y + h * 0.3, h * 0.32, color);
    circ(ctx, x + h * 0.35, y + h * 0.7, h * 0.32, color);
    circ(ctx, x + w - h * 0.35, y + h * 0.3, h * 0.32, color);
    circ(ctx, x + w - h * 0.35, y + h * 0.7, h * 0.32, color);
  }
}

// Череп-бластер: смотрит вдоль ang, при выстреле открывает пасть.
function drawBlaster(ctx, x, y, ang, open) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang - Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(-26, -30);
  ctx.quadraticCurveTo(0, -46, 26, -30);
  ctx.lineTo(22, 10);
  ctx.lineTo(-22, 10);
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
  ell(ctx, -11, -14, 7, 6, '#000');
  ell(ctx, 11, -14, 7, 6, '#000');
  if (open) {
    circ(ctx, -11, -14, 3, '#40c4ff');
    circ(ctx, 11, -14, 3, '#40c4ff');
  }
  const jaw = 10 + open * 12;
  ctx.fillStyle = '#fff';
  ctx.fillRect(-18, jaw, 36, 10);
  ctx.fillStyle = '#000';
  for (let i = -2; i <= 2; i++) ctx.fillRect(i * 7 - 1, 8, 2, 4);
  ctx.restore();
}

const Battle = {
  phase: 'off', // intro | menu | sub | text | fight | slash | bubble | attack | dust | gameover | out
  g: null,
  t: 0,
  pt: 0, // время в текущей фазе
  sel: 0,
  subSel: 0,
  subKind: '',
  hp: UT.hp,
  mercy: 0,
  turn: 0,
  dodged: false,
  items: [],
  hotdog: 1,
  msg: '',
  shown: 0,
  next: null,
  bubble: '',
  box: { ...UT.text },
  soul: { x: 640, y: 395, invT: 0, moved: false },
  bullets: [],
  blasters: [],
  spawnT: 0,
  spawnT2: 0,
  pattern: 'bones',
  bar: { x: 0, stop: false },
  slash: null,
  shake: 0,
  blueHint: false,
  outcome: '',

  start(g) {
    this.g = g;
    this.phase = 'intro';
    this.t = 0;
    this.pt = 0;
    this.sel = 0;
    this.hp = UT.hp;
    this.mercy = 0;
    this.turn = 0;
    this.dodged = false;
    this.items = [{ name: 'Ириска', heal: 8 }, { name: 'Пирог', heal: 99 }];
    this.hotdog = 1;
    this.box = { ...UT.text };
    this.bullets = [];
    this.blasters = [];
    this.slash = null;
    this.bubble = '';
    this.outcome = '';
    g.state = 'ut';
    Input.lmb = false;
    Sound.warn();
  },

  spareable() {
    return this.mercy >= 2 || this.turn >= 5;
  },

  // ---------- текст ----------
  say(str, next) {
    this.phase = 'text';
    this.pt = 0;
    this.msg = str;
    this.shown = 0;
    this.next = next;
  },

  toMenu() {
    this.phase = 'menu';
    this.pt = 0;
    this.msg = this.spareable() ? '* Санс выглядит уставшим. Может, пощадить?' : UT_FLAVOR[this.turn % UT_FLAVOR.length];
    this.shown = 0;
    this.next = null;
  },

  typed() {
    return this.shown >= this.msg.length;
  },

  // ---------- ввод ----------
  confirm() {
    const ph = this.phase;
    if (ph === 'text' || ph === 'out') {
      if (!this.typed()) this.shown = this.msg.length;
      else if (this.next) {
        const n = this.next;
        this.next = null;
        n();
      }
    } else if (ph === 'menu') this.choose(this.sel);
    else if (ph === 'sub') this.pickSub(this.subSel);
    else if (ph === 'fight') this.strike();
    else if (ph === 'bubble' && this.pt > 0.4) this.startAttack();
  },

  cancel() {
    if (this.phase === 'sub') {
      this.phase = 'menu';
      this.shown = this.msg.length;
    }
  },

  onKey(code) {
    if (code === 'Enter' || code === 'KeyZ' || code === 'Space') return this.confirm();
    if (code === 'KeyX' || code === 'Escape' || code === 'ShiftLeft' || code === 'Backspace') return this.cancel();
    const dx = code === 'ArrowLeft' || code === 'KeyA' ? -1 : code === 'ArrowRight' || code === 'KeyD' ? 1 : 0;
    const dy = code === 'ArrowUp' || code === 'KeyW' ? -1 : code === 'ArrowDown' || code === 'KeyS' ? 1 : 0;
    if (!dx && !dy) return;
    if (this.phase === 'menu' && dx) {
      this.sel = (this.sel + dx + 4) % 4;
      Sound.click();
    } else if (this.phase === 'sub') {
      const n = this.subList().length;
      this.subSel = clamp(this.subSel + dx + dy * 2, 0, n - 1);
      Sound.click();
    }
  },

  subList() {
    if (this.subKind === 'act') return UT_ACTS.map((a) => ({ label: a }));
    if (this.subKind === 'item') return this.items.map((it) => ({ label: it.name }));
    return [{ label: 'Пощадить', yellow: this.spareable() }, { label: 'Сбежать' }];
  },

  choose(i) {
    this.sel = i;
    const key = UT_BUTTONS[i].key;
    Sound.click();
    if (key === 'fight') {
      this.phase = 'fight';
      this.pt = 0;
      this.bar = { x: UT.text.x + 12, stop: false };
    } else if (key === 'item' && !this.items.length) {
      this.say('* У тебя не осталось вещей.', () => this.toMenu());
    } else {
      this.subKind = key;
      this.subSel = 0;
      this.phase = 'sub';
    }
  },

  pickSub(i) {
    const p = this.g.player;
    Sound.click();
    if (this.subKind === 'act') {
      const a = UT_ACTS[i];
      if (a === 'Проверить') this.say('* САНС — АТК 1, ЗАЩ 1.\n* Самый лёгкий враг. Может нанести всего 1 урон.\n* ...но это не точно.', () => this.enemyTurn());
      else if (a === 'Пошутить') {
        this.mercy++;
        this.say('* Ты рассказал анекдот про шахматного коня.\n* Санс хихикнул. Кажется, ты ему нравишься.', () => this.enemyTurn());
      } else if (a === 'Подмигнуть') this.say('* Ты подмигнул.\n* Санс подмигнул в ответ. Он, кажется, всегда так.', () => this.enemyTurn());
      else if (this.hotdog > 0) {
        this.hotdog--;
        this.mercy++;
        this.say('* Ты угостил Санса хот-догом.\n* Он положил его себе на голову. Зачем?..', () => this.enemyTurn());
      } else this.say('* Хот-доги кончились. Санс разочарован.', () => this.enemyTurn());
    } else if (this.subKind === 'item') {
      const it = this.items.splice(i, 1)[0];
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + it.heal);
      Sound.eat();
      const healed = Math.round(p.hp - before);
      this.say(`* Ты съел ${it.name.toLowerCase()}.\n* ${p.hp >= p.maxHp ? 'Здоровье восстановлено полностью' : `Восстановлено ${healed} ОЗ`}.`, () => this.enemyTurn());
    } else if (i === 0) {
      if (this.spareable()) {
        this.outcome = 'spare';
        this.say('* Ты пощадил Санса.\n* Ты получил 0 опыта, $500 и немного решимости.', () => this.exit());
      } else this.say('* Санс пока не хочет пощады.', () => this.enemyTurn());
    } else if (Math.random() < 0.6) {
      this.outcome = 'flee';
      this.say('* Ты сбежал...\n* Санс машет тебе вслед.', () => this.exit());
    } else this.say('* Санс телепортировался и перекрыл выход. Хе-хе.', () => this.enemyTurn());
  },

  // Полоска удара остановлена.
  strike() {
    if (this.bar.stop) return;
    this.bar.stop = true;
    const c = UT.text.x + UT.text.w / 2;
    const acc = clamp(1 - Math.abs(this.bar.x - c) / (UT.text.w / 2), 0, 1);
    let dmg = Math.round(4 + acc * 22);
    if (acc > 0.93) dmg = Math.round(dmg * 1.4);
    const miss = !this.dodged;
    if (miss) this.dodged = true;
    this.slash = { t: 0, dmg, miss };
    this.phase = 'slash';
    this.pt = 0;
    Sound.whoosh();
  },

  enemyTurn() {
    this.phase = 'bubble';
    this.pt = 0;
    this.bubble = this.spareable() ? 'я устал. может, разойдёмся миром?' : UT_TALK[Math.min(this.turn, UT_TALK.length - 1)];
  },

  startAttack() {
    this.phase = 'attack';
    this.pt = 0;
    this.pattern = UT_PATTERNS[this.turn % UT_PATTERNS.length];
    this.bullets = [];
    this.blasters = [];
    this.spawnT = 0.3;
    this.spawnT2 = 0.5;
    const a = UT.arena;
    this.soul.x = a.x + a.w / 2;
    this.soul.y = a.y + a.h / 2;
    this.soul.invT = 0;
    if (this.pattern === 'blue' && !this.blueHint) this.blueHint = true;
  },

  exit() {
    const g = this.g, p = g.player;
    if (this.outcome === 'spare') {
      p.money += 500;
      p.hp = p.maxHp;
      g.starT = 6;
      Ach.unlock('ut_spare');
    } else if (this.outcome === 'kill') {
      p.money += 1000;
      Ach.unlock('ut_kill');
    }
    this.phase = 'out';
    this.pt = 0;
    this.msg = '';
    this.next = null;
  },

  // ---------- кадр ----------
  update(dt) {
    const g = this.g;
    this.t += dt;
    this.pt += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);
    // рамка плавно меняет размер
    const target = this.phase === 'attack' ? UT.arena : UT.text;
    for (const k of ['x', 'y', 'w', 'h']) this.box[k] = lerp(this.box[k], target[k], Math.min(1, dt * 12));
    if ((this.phase === 'text' || this.phase === 'menu' || this.phase === 'out') && this.shown < this.msg.length) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(this.msg.length, this.shown + dt * 40);
      if (Math.floor(this.shown) !== before && Math.floor(this.shown) % 2 === 0 && this.msg[Math.floor(this.shown)] !== ' ') Sound.click();
    }
    const ph = this.phase;
    if (ph === 'intro' && this.pt > 1.0) this.toMenu();
    else if (ph === 'fight' && !this.bar.stop) {
      this.bar.x += dt * (UT.text.w / 1.3);
      if (this.bar.x >= UT.text.x + UT.text.w - 12) {
        this.bar.stop = true;
        this.slash = { t: 0, dmg: 0, miss: true, none: true };
        this.phase = 'slash';
        this.pt = 0;
      }
    } else if (ph === 'slash') {
      this.slash.t += dt;
      if (this.pt > 0.25 && !this.slash.applied) {
        this.slash.applied = true;
        if (!this.slash.miss) {
          this.hp = Math.max(0, this.hp - this.slash.dmg);
          this.shake = 8;
          Sound.hit();
        }
      }
      if (this.pt > 1.3) {
        if (this.hp <= 0) {
          this.phase = 'dust';
          this.pt = 0;
          Sound.explosion(false);
        } else this.enemyTurn();
      }
    } else if (ph === 'dust' && this.pt > 1.6) {
      this.outcome = 'kill';
      this.say('* Санс рассыпался в пыль.\n* Ты получил $1000.\n* ...оно того стоило?', () => this.exit());
    } else if (ph === 'bubble' && this.pt > 2.4) this.startAttack();
    else if (ph === 'attack') this.updateAttack(dt);
    else if (ph === 'gameover' && this.pt > 4.2) this.finishGameOver();
    else if (ph === 'out' && this.pt > 0.5) {
      this.phase = 'off';
      g.state = 'play';
      g.suppressFire = true;
    }
  },

  updateAttack(dt) {
    const a = UT.arena, s = this.soul, k = 1 + this.turn * 0.08;
    // душа
    const kk = Input.keys;
    let mx = 0, my = 0;
    if (kk.has('ArrowLeft') || kk.has('KeyA')) mx -= 1;
    if (kk.has('ArrowRight') || kk.has('KeyD')) mx += 1;
    if (kk.has('ArrowUp') || kk.has('KeyW')) my -= 1;
    if (kk.has('ArrowDown') || kk.has('KeyS')) my += 1;
    const st = Input.stick;
    if (st && st.id !== null) {
      const dx = st.x - st.ox, dy = st.y - st.oy, d = Math.hypot(dx, dy);
      if (d > 8) {
        const p = Math.min(1, d / 50);
        mx = (dx / d) * p;
        my = (dy / d) * p;
      }
    }
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    s.moved = len > 0.05;
    s.x = clamp(s.x + mx * UT.soulSpeed * dt, a.x + 10, a.x + a.w - 10);
    s.y = clamp(s.y + my * UT.soulSpeed * dt, a.y + 10, a.y + a.h - 10);
    if (s.invT > 0) s.invT -= dt;

    // появление снарядов
    const pat = this.pattern;
    this.spawnT -= dt;
    this.spawnT2 -= dt;
    const left = a.x, right = a.x + a.w, top = a.y, bottom = a.y + a.h;
    const bone = (blue) => {
      const fromLeft = Math.random() < 0.5, floor = Math.random() < 0.5;
      const h = blue ? a.h - 40 : rand(40, a.h - 80);
      this.bullets.push({ kind: 'bone', x: fromLeft ? left - 16 : right, y: floor ? bottom - h : top, w: 14, h, vx: (fromLeft ? 1 : -1) * 170 * k, vy: 0, blue });
    };
    if (this.pt < UT.turnTime - 0.8) {
      if ((pat === 'bones' || pat === 'mix') && this.spawnT <= 0) {
        this.spawnT = (pat === 'mix' ? 0.9 : 0.55) / k;
        bone(false);
      }
      if (pat === 'blue' && this.spawnT <= 0) {
        this.spawnT = 0.7 / k;
        bone(true);
      }
      if ((pat === 'rain' || pat === 'mix' || pat === 'storm') && this.spawnT2 <= 0) {
        this.spawnT2 = (pat === 'rain' ? 0.09 : 0.2) / k;
        this.bullets.push({ kind: 'pellet', x: rand(left + 6, right - 6), y: top + 4, r: 5, vx: rand(-20, 20), vy: rand(150, 210) * k });
      }
      if ((pat === 'blasters' || pat === 'storm') && this.spawnT <= 0) {
        this.spawnT = (pat === 'storm' ? 1.4 : 1.1) / k;
        const r = Math.random();
        if (r < 0.4) this.blasters.push({ x: left - 70, y: clamp(s.y + rand(-10, 10), top + 10, bottom - 10), ang: 0, t: 0 });
        else if (r < 0.8) this.blasters.push({ x: right + 70, y: clamp(s.y + rand(-10, 10), top + 10, bottom - 10), ang: Math.PI, t: 0 });
        else this.blasters.push({ x: clamp(s.x + rand(-10, 10), left + 10, right - 10), y: top - 70, ang: Math.PI / 2, t: 0 });
        Sound.laserCharge();
      }
    }
    // движение и попадания
    const hit = () => {
      if (s.invT > 0) return;
      s.invT = UT.iframes;
      this.g.player.hp -= UT.dmg;
      this.shake = 6;
      Sound.hurt();
      if (this.g.player.hp <= 0) {
        this.g.player.hp = 0;
        this.phase = 'gameover';
        this.pt = 0;
        Sound.wasted();
      }
    };
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.kind === 'bone') {
        const cx = clamp(s.x, b.x, b.x + b.w), cy = clamp(s.y, b.y, b.y + b.h);
        if (Math.hypot(s.x - cx, s.y - cy) < UT.soulR && (!b.blue || s.moved)) hit();
        if (b.x < left - 40 || b.x > right + 40) b.dead = true;
      } else {
        if (Math.hypot(s.x - b.x, s.y - b.y) < b.r + UT.soulR - 2) {
          hit();
          b.dead = true;
        }
        if (b.y > bottom + 10) b.dead = true;
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
    for (const bl of this.blasters) {
      const was = bl.t;
      bl.t += dt;
      if (was < 0.7 && bl.t >= 0.7) {
        Sound.laser();
        this.shake = 4;
      }
      if (bl.t >= 0.7 && bl.t < 1.15) {
        // луч — полоса шириной 36 вдоль направления черепа
        const dx = Math.cos(bl.ang), dy = Math.sin(bl.ang);
        const px = s.x - bl.x, py = s.y - bl.y;
        const along = px * dx + py * dy, across = Math.abs(-px * dy + py * dx);
        if (along > 0 && across < 18 + UT.soulR - 3) hit();
      }
    }
    this.blasters = this.blasters.filter((bl) => bl.t < 1.3);
    if (this.phase === 'attack' && this.pt >= UT.turnTime) {
      this.turn++;
      this.bullets = [];
      this.blasters = [];
      this.toMenu();
    }
  },

  finishGameOver() {
    const g = this.g;
    this.phase = 'off';
    g.state = 'play';
    g.suppressFire = true;
    g.player.hp = 0.5;
    g.starT = 0; // неуязвимость от прошлой пощады тут не спасает
    g.takeDamage(999, 'Санс');
  },
};

// ---------- отрисовка ----------
function drawUtText(ctx, str, x, y, max) {
  const lines = str.slice(0, max).split('\n');
  lines.forEach((ln, i) => text(ctx, ln, x, y + i * 34, { font: `18px ${FONT.pixel}`, color: '#fff' }));
}

function renderBattle(ctx, g, now) {
  const B = Battle, t = B.t;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  g.buttons = [];
  ctx.save();
  if (B.shake > 0) ctx.translate(rand(-1, 1) * B.shake, rand(-1, 1) * B.shake);

  if (B.phase === 'intro') {
    // как в Undertale: душа мигает, потом бой
    if (Math.floor(B.pt * 8) % 2 === 0) drawSoul(ctx, 640, 360, 3);
    ctx.restore();
    return;
  }
  if (B.phase === 'gameover') {
    ctx.restore();
    drawUtGameOver(ctx, B);
    return;
  }

  // Санс
  const sl = B.slash;
  let dx = 0;
  if (B.phase === 'slash' && sl && sl.miss && !sl.none) dx = -Math.sin(Math.min(1, sl.t / 0.9) * Math.PI) * 90;
  const dust = B.phase === 'dust' ? Math.min(1, B.pt / 1.4) : 0;
  if (B.phase !== 'out' || B.outcome !== 'kill') {
    if (dust < 1) {
      drawSans(ctx, UT.sansX, UT.sansY, t, {
        dx,
        alpha: 1 - dust,
        eye: B.phase === 'attack' && B.pattern !== 'rain' ? (Math.floor(t * 6) % 2 ? '#40c4ff' : '#ffeb3b') : null,
        closed: B.phase === 'slash' && sl && !sl.miss,
        tired: B.spareable(),
        still: dust > 0,
      });
    }
    if (dust > 0) {
      for (let i = 0; i < 40; i++) {
        const px = UT.sansX + Math.sin(i * 12.9) * 50, py = UT.sansY - 90 + ((i * 37) % 180) - dust * 60 * ((i % 5) + 1) * 0.3;
        ctx.fillStyle = `rgba(255,255,255,${1 - dust})`;
        ctx.fillRect(px, py, 4, 4);
      }
    }
  }
  // реплика
  if (B.phase === 'bubble') {
    ctx.font = `bold 18px ${FONT.ui}`;
    const w = Math.max(220, ctx.measureText(B.bubble).width + 36);
    rr(ctx, 720, 78, w, 56, 10);
    ctx.fillStyle = '#fff';
    ctx.fill();
    poly(ctx, [722, 100, 704, 110, 722, 116], '#fff');
    text(ctx, B.bubble.slice(0, Math.floor(B.pt * 40)), 738, 112, { font: `bold 18px ${FONT.ui}`, color: '#000' });
  }
  // удар
  if (B.phase === 'slash' && sl) {
    const k = Math.min(1, sl.t / 0.3);
    if (!sl.none) {
      for (let i = 0; i < 3; i++) line(ctx, UT.sansX - 50 + i * 30, UT.sansY - 90, UT.sansX - 50 + i * 30 + 60 * k, UT.sansY - 90 + 120 * k, '#ff1744', 5);
    }
    if (sl.t > 0.25) {
      const yy = UT.sansY - 40 - Math.min(20, (sl.t - 0.25) * 60);
      text(ctx, sl.miss ? 'MISS' : String(sl.dmg), UT.sansX + 130, yy, { font: `28px ${FONT.pixel}`, color: sl.miss ? '#bdbdbd' : '#ff1744', stroke: '#000', lw: 4, align: 'center' });
      if (!sl.miss) {
        ctx.fillStyle = '#8b0000';
        ctx.fillRect(UT.sansX - 60, UT.sansY + 108, 120, 12);
        ctx.fillStyle = '#7ee03c';
        ctx.fillRect(UT.sansX - 60, UT.sansY + 108, 120 * (B.hp / UT.hp), 12);
      }
    }
  }

  // рамка
  const bx = B.box;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 5;
  ctx.strokeRect(bx.x, bx.y, bx.w, bx.h);

  if (B.phase === 'menu' || B.phase === 'text' || B.phase === 'out') {
    drawUtText(ctx, B.msg, UT.text.x + 30, UT.text.y + 46, Math.floor(B.shown));
    if (B.phase !== 'menu') g.buttons.push({ x: 0, y: 0, w: W, h: H, action: () => B.confirm() });
  } else if (B.phase === 'sub') {
    B.subList().forEach((it, i) => {
      const x = UT.text.x + 60 + (i % 2) * 460, y = UT.text.y + 50 + Math.floor(i / 2) * 50;
      if (i === B.subSel) drawSoul(ctx, x - 22, y - 7, 1.4);
      text(ctx, `* ${it.label}`, x, y, { font: `18px ${FONT.pixel}`, color: it.yellow ? '#ffff00' : '#fff' });
      g.buttons.push({ x: x - 40, y: y - 30, w: 440, h: 44, action: () => B.pickSub(i) });
    });
    text(ctx, '◄ назад', UT.text.x + UT.text.w - 30, UT.text.y + UT.text.h - 18, { font: `12px ${FONT.pixel}`, color: '#9e9e9e', align: 'right' });
    g.buttons.push({ x: UT.text.x + UT.text.w - 200, y: UT.text.y + UT.text.h - 44, w: 190, h: 40, action: () => B.cancel() });
  } else if (B.phase === 'fight' || (B.phase === 'slash' && sl && !sl.none)) {
    // мишень и бегущая полоска
    const tx = UT.text.x + 10, ty = UT.text.y + 12, tw = UT.text.w - 20, th = UT.text.h - 24;
    for (let i = 0; i < 6; i++) {
      const k = i / 6;
      ctx.beginPath();
      ctx.ellipse(tx + tw / 2, ty + th / 2, (tw / 2) * (1 - k), (th / 2) * (1 - k * 0.6), 0, 0, TAU);
      ctx.fillStyle = i % 2 ? '#0b3d0b' : '#145a14';
      ctx.fill();
    }
    line(ctx, tx + tw / 2, ty, tx + tw / 2, ty + th, '#fff', 3);
    const blink = B.bar.stop && Math.floor(B.pt * 12) % 2;
    ctx.fillStyle = blink ? '#000' : '#fff';
    ctx.fillRect(B.bar.x - 6, ty - 4, 12, th + 8);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(B.bar.x - 6, ty - 4, 12, th + 8);
    if (B.phase === 'fight') g.buttons.push({ x: 0, y: 0, w: W, h: H, action: () => B.confirm() });
  } else if (B.phase === 'bubble') {
    g.buttons.push({ x: 0, y: 0, w: W, h: H, action: () => B.confirm() });
  } else if (B.phase === 'attack') {
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx.x + 3, bx.y + 3, bx.w - 6, bx.h - 6);
    ctx.clip();
    for (const b of B.bullets) {
      if (b.kind === 'bone') drawBone(ctx, b.x, b.y, b.w, b.h, b.blue ? '#29b6f6' : '#fff');
      else circ(ctx, b.x, b.y, b.r, '#fff');
    }
    ctx.restore();
    for (const bl of B.blasters) {
      const open = bl.t >= 0.7 ? 1 : 0;
      if (bl.t >= 0.7 && bl.t < 1.15) {
        ctx.save();
        ctx.translate(bl.x, bl.y);
        ctx.rotate(bl.ang);
        const wv = 36 * (1 - Math.max(0, bl.t - 1.0) / 0.15) + Math.sin(t * 60) * 2;
        ctx.fillStyle = '#fff';
        ctx.fillRect(20, -wv / 2, 1400, wv);
        ctx.restore();
      }
      drawBlaster(ctx, bl.x, bl.y, bl.ang, open);
    }
    if (!(B.soul.invT > 0 && Math.floor(B.soul.invT * 14) % 2)) drawSoul(ctx, B.soul.x, B.soul.y, 1.6);
    if (B.pattern === 'blue') text(ctx, 'Синие кости ранят, только если двигаешься!', 640, 278, { font: `bold 16px ${FONT.ui}`, color: '#29b6f6', align: 'center' });
  }

  // имя, уровень и здоровье
  const p = g.player;
  text(ctx, `ХАОС   LV ${p.level + 1}`, 150, UT.btnY - 30, { font: `16px ${FONT.pixel}`, color: '#fff' });
  text(ctx, 'HP', 500, UT.btnY - 30, { font: `14px ${FONT.pixel}`, color: '#fff' });
  ctx.fillStyle = '#c00';
  ctx.fillRect(540, UT.btnY - 48, p.maxHp * 6, 22);
  ctx.fillStyle = '#ffff00';
  ctx.fillRect(540, UT.btnY - 48, Math.max(0, p.hp) * 6, 22);
  text(ctx, `${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`, 560 + p.maxHp * 6, UT.btnY - 30, { font: `16px ${FONT.pixel}`, color: '#fff' });

  // кнопки
  UT_BUTTONS.forEach((b, i) => {
    const x = 150 + i * 260, y = UT.btnY, w = 220, h = 56;
    const on = (B.phase === 'menu' || B.phase === 'sub') && B.sel === i;
    const c = on ? '#ffff00' : '#ff9f1a';
    ctx.strokeStyle = c;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    if (on) drawSoul(ctx, x + 30, y + h / 2, 1.6);
    else drawUtIcon(ctx, b.key, x + 30, y + h / 2, c);
    text(ctx, b.label, x + 58, y + 37, { font: `18px ${FONT.pixel}`, color: c });
    if (B.phase === 'menu' || B.phase === 'sub') g.buttons.push({ x, y, w, h, action: () => B.choose(i) });
  });
  if (B.phase === 'menu') g.buttons.push({ x: 0, y: 0, w: W, h: H, action: () => B.typed() || (B.shown = B.msg.length) });
  ctx.restore();

  if (B.phase === 'out') {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, B.pt / 0.5)})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (Input.touch && B.phase === 'attack' && B.pt < 3) {
    text(ctx, 'Води пальцем по экрану — душа двигается', 640, 690, { font: `bold 15px ${FONT.ui}`, color: '#9e9e9e', align: 'center' });
  } else if (!Input.touch && B.phase === 'menu') {
    text(ctx, '← → выбор · Z / Enter — ок · X — назад', 640, 690, { font: `13px ${FONT.ui}`, color: '#616161', align: 'center' });
  }
}

function drawUtIcon(ctx, key, x, y, c) {
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineWidth = 3;
  if (key === 'fight') {
    line(ctx, x - 9, y + 9, x + 9, y - 9, c, 3);
    line(ctx, x - 9, y + 2, x - 2, y + 9, c, 3);
  } else if (key === 'act') {
    ctx.beginPath();
    ctx.arc(x, y - 1, 9, 0, TAU);
    ctx.stroke();
    poly(ctx, [x - 4, y + 7, x - 9, y + 12, x + 1, y + 8], c);
  } else if (key === 'item') {
    ctx.strokeRect(x - 8, y - 5, 16, 14);
    ctx.beginPath();
    ctx.arc(x, y - 5, 5, Math.PI, 0);
    ctx.stroke();
  } else {
    line(ctx, x - 8, y - 8, x + 8, y + 8, c, 3);
    line(ctx, x + 8, y - 8, x - 8, y + 8, c, 3);
  }
}

function drawUtGameOver(ctx, B) {
  const pt = B.pt;
  if (pt < 0.5) {
    drawSoul(ctx, B.soul.x, B.soul.y, 1.6);
    if (pt > 0.25) line(ctx, B.soul.x - 2, B.soul.y - 8, B.soul.x + 3, B.soul.y + 8, '#000', 3);
  } else if (pt < 1.4) {
    const k = (pt - 0.5) / 0.9;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.4;
      ctx.fillStyle = '#ff1a1a';
      ctx.fillRect(B.soul.x + Math.cos(a) * k * 90, B.soul.y + Math.sin(a) * k * 90 + k * k * 120, 5, 5);
    }
  } else {
    const k = Math.min(1, (pt - 1.4) / 0.8);
    ctx.globalAlpha = k;
    text(ctx, 'GAME', 640, 260, { font: `90px ${FONT.title}`, color: '#fff', align: 'center' });
    text(ctx, 'OVER', 640, 360, { font: `90px ${FONT.title}`, color: '#fff', align: 'center' });
    const msg = '* Не теряй решимость!';
    text(ctx, msg.slice(0, Math.floor(Math.max(0, pt - 2.2) * 25)), 640, 470, { font: `20px ${FONT.pixel}`, color: '#fff', align: 'center' });
    ctx.globalAlpha = 1;
  }
}
