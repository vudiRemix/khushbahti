'use strict';
/* Гости посреди боя:
   • Дуо (Duolingo) — «Время урока!»: переведи слово. Верно — лечение, деньги и ударный режим 🔥;
     ошибся или промолчал — прилетает Злой Дуо и утаскивает твою фигуру.
   • Мита (MiSide) — «Ты ведь останешься со мной?»: останешься — она помогает ножницами,
     уйдёшь — по доске к тебе крадётся Безумная Мита.
   • Гренни (Granny) — «Тише!»: полминуты нельзя шуметь. Выстрелы и взрывы поднимают шум,
     удочка, флажки и растения — тихие. Шкала полная — Гренни бьёт битой.
   Дуо и Мита ставят бой на паузу (g.visit), Гренни идёт прямо в бою (g.granny). */

const VISIT = {
  duoEvery: [110, 190],
  mitaAt: [70, 150],
  grannyAt: [85, 170],
  duoTime: 10, // секунд на ответ
  duoHeal: 3,
  duoMoney: 300,
  mitaHelp: 25, // сколько секунд Мита помогает
  mitaSnip: 1.5,
  grannyTime: 30,
  grannyHit: 4,
  grannyMoney: 1000,
  noise: { ak: 6, nova: 12, awp: 16, axe: 4, fist: 3, boom: 25 },
  calm: 10, // на сколько шум стихает за секунду
};

const DUO_WORDS = [
  ['cat', 'кошка'], ['dog', 'собака'], ['apple', 'яблоко'], ['house', 'дом'], ['water', 'вода'],
  ['bread', 'хлеб'], ['king', 'король'], ['tower', 'башня'], ['owl', 'сова'], ['friend', 'друг'],
  ['school', 'школа'], ['book', 'книга'], ['sun', 'солнце'], ['moon', 'луна'], ['night', 'ночь'],
  ['money', 'деньги'], ['heart', 'сердце'], ['key', 'ключ'], ['fire', 'огонь'], ['snake', 'змея'],
  ['horse', 'лошадь'], ['chair', 'стул'], ['window', 'окно'], ['green', 'зелёный'], ['red', 'красный'],
  ['boss', 'босс'], ['winner', 'победитель'], ['lesson', 'урок'], ['streak', 'серия'], ['bear', 'медведь'],
];

// ---------- рисунки ----------
function drawDuo(ctx, x, y, s, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const green = o.angry ? '#4caf50' : '#58cc02';
  // крылья
  ell(ctx, -42, 10, 16, 30, '#46a302');
  ell(ctx, 42, 10, 16, 30, '#46a302');
  // тело
  ell(ctx, 0, 0, 46, 54, green);
  ell(ctx, 0, 22, 30, 28, '#d7ffb8');
  // глаза
  for (const sx of [-1, 1]) {
    circ(ctx, sx * 18, -14, 15, '#fff');
    circ(ctx, sx * 18 + (o.look || 0), -12, 7, o.angry ? '#b71c1c' : '#1a1a1a');
    circ(ctx, sx * 18 + 2, -15, 2.5, '#fff');
  }
  if (o.angry) {
    line(ctx, -32, -34, -8, -24, '#1b5e20', 5);
    line(ctx, 32, -34, 8, -24, '#1b5e20', 5);
  } else {
    poly(ctx, [-30, -38, -20, -50, -12, -36], green);
    poly(ctx, [30, -38, 20, -50, 12, -36], green);
  }
  // клюв и лапы
  poly(ctx, [-8, -2, 8, -2, 0, 10], '#ff9600');
  ell(ctx, -14, 52, 9, 5, '#ff9600');
  ell(ctx, 14, 52, 9, 5, '#ff9600');
  ctx.restore();
}

function drawMita(ctx, x, y, s, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const crazy = o.crazy, hair = '#24305e';
  if (crazy && Math.random() < 0.25) ctx.translate(rand(-4, 4), 0);
  // волосы сзади
  ctx.beginPath();
  ctx.moveTo(-46, -30);
  ctx.quadraticCurveTo(-60, 60, -40, 120);
  ctx.lineTo(40, 120);
  ctx.quadraticCurveTo(60, 60, 46, -30);
  ctx.closePath();
  ctx.fillStyle = hair;
  ctx.fill();
  // кофта
  rr(ctx, -40, 50, 80, 80, 20);
  ctx.fillStyle = '#d32f2f';
  ctx.fill();
  poly(ctx, [-12, 50, 12, 50, 0, 66], '#fff');
  // лицо
  ell(ctx, 0, 0, 38, 44, '#ffe0cc');
  // чёлка
  ctx.beginPath();
  ctx.moveTo(-40, -6);
  ctx.quadraticCurveTo(-36, -52, 0, -50);
  ctx.quadraticCurveTo(36, -52, 40, -6);
  ctx.lineTo(26, -20);
  ctx.lineTo(14, -6);
  ctx.lineTo(2, -22);
  ctx.lineTo(-10, -6);
  ctx.lineTo(-22, -20);
  ctx.closePath();
  ctx.fillStyle = hair;
  ctx.fill();
  // красная заколка
  poly(ctx, [24, -40, 40, -48, 36, -30], '#e53935');
  poly(ctx, [24, -40, 12, -52, 18, -32], '#e53935');
  // глаза
  for (const sx of [-1, 1]) {
    ell(ctx, sx * 15, 4, 9, 11, '#fff');
    ell(ctx, sx * 15, 6, 6.5, 8.5, crazy ? '#120000' : '#3949ab');
    circ(ctx, sx * 15, 6, crazy ? 2 : 3, crazy ? '#ff1744' : '#0d1440');
    if (!crazy) circ(ctx, sx * 15 + 2, 2, 2, '#fff');
  }
  // румянец и рот
  if (!crazy) {
    ell(ctx, -24, 18, 6, 3, 'rgba(255,120,140,0.5)');
    ell(ctx, 24, 18, 6, 3, 'rgba(255,120,140,0.5)');
    ctx.beginPath();
    ctx.arc(0, 22, 6, 0.2, Math.PI - 0.2);
    ctx.strokeStyle = '#b5524e';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-18, 22);
    ctx.quadraticCurveTo(0, 40, 18, 22);
    ctx.strokeStyle = '#4a0000';
    ctx.lineWidth = 3;
    ctx.stroke();
    for (let i = -14; i <= 14; i += 7) line(ctx, i, 24, i, 30, '#fff', 2);
    // ножницы
    ctx.save();
    ctx.translate(46, 70);
    ctx.rotate(-0.6 + Math.sin(o.t * 12) * 0.2);
    line(ctx, 0, 0, 0, -46, '#cfd8dc', 4);
    line(ctx, 6, 0, 2, -46, '#90a4ae', 4);
    circ(ctx, -4, 8, 7, '#e53935');
    circ(ctx, 10, 8, 7, '#e53935');
    ctx.restore();
  }
  ctx.restore();
}

function drawGranny(ctx, x, y, s, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // ночнушка
  poly(ctx, [-30, -10, 30, -10, 44, 110, -44, 110], '#e8e4da');
  for (const [bx, by] of [[-12, 40], [10, 70], [-20, 90]]) circ(ctx, bx, by, 6, 'rgba(140,0,0,0.6)');
  // руки и бита
  line(ctx, 28, 0, 52, 40, '#d9c7b8', 8);
  ctx.save();
  ctx.translate(54, 42);
  ctx.rotate(o.swing ? -1.6 : -0.4);
  rr(ctx, -5, -90, 12, 96, 6);
  ctx.fillStyle = '#8d6e63';
  ctx.fill();
  ctx.restore();
  line(ctx, -28, 0, -40, 50, '#d9c7b8', 8);
  // голова: седой пучок, бледное лицо
  circ(ctx, 0, -64, 18, '#bdbdbd');
  ell(ctx, 0, -38, 26, 30, '#e6d9cf');
  ell(ctx, -26, -50, 10, 22, '#bdbdbd');
  ell(ctx, 26, -50, 10, 22, '#bdbdbd');
  const glow = o.glow || 0;
  for (const sx of [-1, 1]) {
    circ(ctx, sx * 10, -42, 7, '#1a1a1a');
    if (glow > 0) {
      ctx.save();
      ctx.shadowColor = '#ff1744';
      ctx.shadowBlur = 12 * glow;
      circ(ctx, sx * 10, -42, 2.5 + glow * 1.5, `rgba(255,23,68,${0.4 + glow * 0.6})`);
      ctx.restore();
    }
  }
  line(ctx, -14, -24, 14, -24, '#5d4037', 2);
  for (const wy of [-54, -50]) line(ctx, -16, wy, 16, wy, 'rgba(120,100,90,0.35)', 1);
  ctx.restore();
}

// ---------- враги ----------
Object.assign(ENEMY_DEF, {
  duo: { hp: 8, dmg: 4, bounty: 300, xp: 8, hw: 30, top: 50, bot: 40, name: 'Злой Дуо' },
  mita: { hp: 12, dmg: 6, bounty: 800, xp: 15, hw: 28, top: 60, bot: 60, name: 'Безумная Мита' },
});

// Злой Дуо летит волнами и утаскивает фигуру.
class AngryDuo extends Enemy {
  constructor() {
    super('duo', rand(200, 1080), rowY(MF.r0) - 20);
    this.air = true;
    this.vx = choice([-1, 1]) * 120;
    this.phase = rand(0, 10);
    this.spawnFx = 0.5;
  }
  update(dt, g) {
    if (this.baseUpdate(dt)) return;
    this.x += this.vx * dt;
    if (this.x < 180 || this.x > 1100) this.vx *= -1;
    this.y += 34 * dt * (g.bloodMoon ? 1.4 : 1);
    this.gy = this.y;
    if (this.y >= PAWN_ROW * T - 20) {
      const c = this.col;
      if (g.def[c]) {
        g.killDefender(c, this);
        g.say('<Дуо> Ты пропустил урок. Фигура уходит со мной.', '#58cc02');
      } else g.enemyReached(this);
      this.remove = true;
    }
  }
  draw(ctx, t) {
    this.beginDraw(ctx);
    drawDuo(ctx, this.x, this.y - 6 + Math.sin(t * 6 + this.phase) * 6, 0.62, { angry: true, look: Math.sign(this.vx) * 3 });
    this.endDraw(ctx);
  }
}

// Безумная Мита: исчезает и появляется ближе, как Фредди; дошла — скример.
class CrazyMita extends Enemy {
  constructor() {
    super('mita', colX(randi(3, COLS - 4)), rowY(MF.r0));
    this.r = MF.r0;
    this.tp = 2.2;
    this.spawnFx = 0.7;
    this.t = 0;
  }
  update(dt, g) {
    if (this.baseUpdate(dt)) return;
    this.t += dt;
    this.tp -= dt;
    if (this.tp <= 0) {
      this.tp = rand(1.8, 2.4);
      if (this.r + 1 >= PAWN_ROW) {
        Visitors.mitaScare(g);
        this.remove = true;
        return;
      }
      this.r++;
      this.x = colX(clamp(this.col + randi(-1, 1), 1, COLS - 2));
      this.y = this.gy = rowY(this.r);
      g.staticFx = 0.12;
      Sound.staticNoise();
    }
  }
  draw(ctx, t) {
    this.beginDraw(ctx);
    drawMita(ctx, this.x, this.y - 10, 0.55, { crazy: true, t });
    this.endDraw(ctx);
  }
}

// ---------- гости ----------
const Visitors = {
  streak: Number(Store.get('kd_duo_streak')) || 0,

  reset(g) {
    g.visit = null;
    g.duoT = rand(...VISIT.duoEvery);
    g.mitaT = Math.random() < 0.6 ? rand(...VISIT.mitaAt) : 0; // Мита приходит не на каждый уровень
    g.grannyT = Math.random() < 0.6 ? rand(...VISIT.grannyAt) : 0;
    g.granny = null;
    g.mitaHelp = null;
  },

  // Таймеры гостей — из игрового цикла (dt — игровое время).
  tick(dt, g) {
    if (g.duel) return;
    const free = !g.visit && !g.meeting && !g.jumpscare && !g.tower.dead;
    if (g.duoT > 0) {
      g.duoT -= dt;
      if (g.duoT <= 0 && free) this.startDuo(g);
      else if (g.duoT <= 0) g.duoT = 5;
    }
    if (g.mitaT > 0) {
      g.mitaT -= dt;
      if (g.mitaT <= 0 && free) this.startMita(g);
      else if (g.mitaT <= 0) g.mitaT = 5;
    }
    if (g.grannyT > 0) {
      g.grannyT -= dt;
      if (g.grannyT <= 0) this.startGranny(g);
    }
    this.updateGranny(dt, g);
    this.updateMitaHelp(dt, g);
  },

  // ---------- Дуо ----------
  startDuo(g) {
    g.duoT = rand(...VISIT.duoEvery);
    const [en, ru] = choice(DUO_WORDS);
    const toEn = Math.random() < 0.5;
    const right = toEn ? en : ru;
    const wrong = shuffle(DUO_WORDS.filter((w) => w[0] !== en)).slice(0, 3).map((w) => (toEn ? w[0] : w[1]));
    g.visit = {
      kind: 'duo',
      t: 0,
      q: toEn ? `Как будет «${ru}» по-английски?` : `Как переводится «${en}»?`,
      opts: shuffle([right, ...wrong]),
      right,
      answer: null,
      outT: 0,
    };
    Input.lmb = false;
    Sound.levelUp();
  },

  answerDuo(g, i) {
    const v = g.visit;
    if (!v || v.answer !== null) return;
    v.answer = i;
    v.outT = 1.6;
    const ok = i >= 0 && v.opts[i] === v.right;
    v.ok = ok;
    if (ok) {
      this.streak++;
      Store.set('kd_duo_streak', this.streak);
      g.heal(VISIT.duoHeal);
      g.addMoney(VISIT.duoMoney);
      Sound.achievement();
      if (this.streak >= 5) Ach.unlock('duo');
    } else {
      this.streak = 0;
      Store.set('kd_duo_streak', 0);
      Sound.wasted();
    }
  },

  // ---------- Мита ----------
  startMita(g) {
    g.mitaT = 0;
    g.visit = { kind: 'mita', t: 0, choice: null, outT: 0 };
    Input.lmb = false;
    Sound.staticNoise();
  },

  chooseMita(g, stay) {
    const v = g.visit;
    if (!v || v.choice !== null) return;
    v.choice = stay;
    v.outT = 2.2;
    if (stay) {
      g.mitaHelp = { t: VISIT.mitaHelp, cd: 1, snip: null };
      Ach.unlock('mita');
      Sound.achievement();
    } else {
      Sound.staticNoise();
      g.staticFx = 0.5;
    }
  },

  updateMitaHelp(dt, g) {
    const h = g.mitaHelp;
    if (!h) return;
    h.t -= dt;
    if (h.snip) {
      h.snip.t += dt;
      if (h.snip.t > 0.3) h.snip = null;
    }
    h.cd -= dt;
    if (h.cd <= 0) {
      h.cd = VISIT.mitaSnip;
      let best = null;
      for (const e of g.enemies) if (e.alive && !e.air && (!best || e.y > best.y)) best = e;
      if (best) {
        best.damage(3, g, 'mita');
        h.snip = { x: best.x, y: best.y - 20, t: 0 };
        Sound.zap();
      }
    }
    if (h.t <= 0) {
      g.mitaHelp = null;
      g.say('<Мита> Ты ведь вернёшься?.. Я буду ждать. Всегда.', '#ff8a80');
    }
  },

  mitaScare(g) {
    g.mitaScareT = 0.9;
    Sound.jumpscare();
    g.shake = 18;
    g.takeDamage(5, 'Безумная Мита');
  },

  // ---------- Гренни ----------
  startGranny(g) {
    g.grannyT = 0;
    g.granny = { t: VISIT.grannyTime, noise: 0, hits: 0, swing: 0, scare: 0 };
    g.banner('ГРЕННИ ДОМА', 'Тише! Выстрелы и взрывы её будят. Удочка, флажки и растения — тихие', '#e0e0e0');
    Sound.staticNoise();
  },

  // Шум от выстрела, взрыва и т.п.
  noise(g, kind) {
    const G = g.granny;
    if (!G || G.scare > 0) return;
    G.noise = Math.min(100, G.noise + (VISIT.noise[kind] || 5));
    // шкала полная — Гренни проснулась (проверяем сразу, пока шум не начал стихать)
    if (G.noise >= 100) {
      G.hits++;
      G.noise = 25;
      G.scare = 0.9;
      g.shake = 16;
      Sound.jumpscare();
    }
  },

  updateGranny(dt, g) {
    const G = g.granny;
    if (!G) return;
    G.t -= dt;
    if (G.scare > 0) {
      G.scare -= dt;
      if (G.scare <= 0) {
        g.takeDamage(VISIT.grannyHit, 'Гренни');
        g.say(`<Гренни> ДЕНЬ ${G.hits + 1}. Тише надо было!`, '#e0e0e0');
      }
      return;
    }
    G.noise = Math.max(0, G.noise - dt * VISIT.calm);
    if (G.t <= 0) {
      if (!G.hits) {
        g.addMoney(VISIT.grannyMoney, 1150, 400, '#e0e0e0');
        Ach.unlock('granny');
        g.say('Гренни ушла спать. Ты не попался — +$' + VISIT.grannyMoney, '#e0e0e0');
      } else g.say('Гренни ушла спать. Ну и ночка…', '#e0e0e0');
      g.granny = null;
    }
  },

  // ---------- пауза-гость ----------
  updateVisit(dt, g) {
    const v = g.visit;
    v.t += dt;
    if (v.kind === 'duo' && v.answer === null && v.t >= VISIT.duoTime) this.answerDuo(g, -1);
    if (v.outT > 0) {
      v.outT -= dt;
      if (v.outT <= 0) {
        if (v.kind === 'duo' && !v.ok) {
          g.enemies.push(new AngryDuo());
          g.say('<Дуо> Ты пропустил урок… Я иду за тобой.', '#58cc02');
        }
        if (v.kind === 'mita' && v.choice === false) {
          g.enemies.push(new CrazyMita());
          g.say('<Мита> Уходишь?.. Тогда я сама к тебе приду.', '#ff1744');
        }
        g.visit = null;
        g.suppressFire = true;
      }
    }
  },

  onKey(g, code) {
    const v = g.visit;
    if (!v) return false;
    const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[code];
    if (v.kind === 'duo' && n !== undefined) this.answerDuo(g, n);
    if (v.kind === 'mita' && (n === 0 || n === 1)) this.chooseMita(g, n === 0);
    return true;
  },
};

// ---------- отрисовка ----------
function drawVisit(ctx, g, now) {
  const v = g.visit;
  ctx.fillStyle = v.kind === 'mita' ? 'rgba(30,10,30,0.72)' : 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);
  if (v.kind === 'duo') {
    const bob = Math.sin(now * 4) * 6;
    drawDuo(ctx, 300, 330 + bob, 1.6, { angry: v.answer !== null && !v.ok, look: Math.sin(now * 2) * 3 });
    rr(ctx, 480, 170, 640, 120, 22);
    ctx.fillStyle = '#fff';
    ctx.fill();
    poly(ctx, [480, 250, 440, 280, 500, 266], '#fff');
    text(ctx, 'ВРЕМЯ УРОКА!', 510, 210, { font: `bold 22px ${FONT.ui}`, color: '#58cc02' });
    text(ctx, v.q, 510, 254, { font: `bold 26px ${FONT.ui}`, color: '#3c3c3c' });
    text(ctx, `🔥 ${Visitors.streak}`, 1090, 210, { font: `bold 22px ${FONT.ui}`, color: '#ff9600', align: 'right' });
    v.opts.forEach((o, i) => {
      const x = 480 + (i % 2) * 330, y = 320 + Math.floor(i / 2) * 84;
      const done = v.answer !== null, right = o === v.right, picked = v.answer === i;
      rr(ctx, x, y, 310, 66, 16);
      ctx.fillStyle = done && right ? '#d7ffb8' : done && picked ? '#ffdfe0' : '#fff';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = done && right ? '#58cc02' : done && picked ? '#ff4b4b' : '#e5e5e5';
      ctx.stroke();
      text(ctx, `${i + 1}`, x + 22, y + 42, { font: `bold 18px ${FONT.ui}`, color: '#afafaf' });
      text(ctx, o, x + 155, y + 43, { font: `bold 24px ${FONT.ui}`, color: '#3c3c3c', align: 'center' });
      if (!done) g.buttons.push({ x, y, w: 310, h: 66, action: () => Visitors.answerDuo(g, i) });
    });
    if (v.answer === null) {
      const k = 1 - v.t / VISIT.duoTime;
      rr(ctx, 480, 500, 640 * k, 12, 6);
      ctx.fillStyle = k > 0.3 ? '#58cc02' : '#ff4b4b';
      ctx.fill();
    } else {
      const msg = v.ok ? `Отлично! +${VISIT.duoHeal} ❤, +$${VISIT.duoMoney}, ударный режим ${Visitors.streak} 🔥` : `Правильно: «${v.right}». Дуо очень разочарован…`;
      text(ctx, msg, 800, 548, { font: `bold 22px ${FONT.ui}`, color: v.ok ? '#d7ffb8' : '#ff8a80', align: 'center', stroke: '#000', lw: 4 });
    }
    return;
  }
  // Мита: как в визуальной новелле
  drawMita(ctx, 640, 250 + Math.sin(now * 2) * 3, 2.1, { crazy: v.choice === false, t: now });
  rr(ctx, 140, 470, 1000, 200, 18);
  ctx.fillStyle = 'rgba(16,10,30,0.92)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = v.choice === false ? '#ff1744' : '#f48fb1';
  ctx.stroke();
  rr(ctx, 170, 450, 140, 40, 10);
  ctx.fillStyle = '#d32f2f';
  ctx.fill();
  text(ctx, 'Мита', 240, 477, { font: `bold 22px ${FONT.ui}`, color: '#fff', align: 'center' });
  const say = v.choice === null
    ? 'Привет! Наконец-то ты пришёл. Тут так скучно одной… Ты ведь останешься со мной? Навсегда?'
    : v.choice
      ? 'Я так рада! Давай я помогу тебе с этими противными фигурками. Чик-чик!'
      : 'Уходишь?.. Нет-нет-нет. Отсюда никто не уходит. Я приду за тобой.';
  const shown = say.slice(0, Math.floor(v.t * 40));
  wrapText(ctx, shown, 180, 528, 920, 30, { font: `bold 24px ${FONT.ui}`, color: v.choice === false ? '#ff8a80' : '#fff' });
  if (v.choice === null && v.t > 1) {
    mcButton(ctx, g, '1. КОНЕЧНО, ОСТАНУСЬ', 200, 600, 400, 50, () => Visitors.chooseMita(g, true), { size: 12, fill: '#ad1457' });
    mcButton(ctx, g, '2. МНЕ ПОРА ИДТИ', 680, 600, 400, 50, () => Visitors.chooseMita(g, false), { size: 12 });
  }
}

// Мита-помощница и Гренни поверх доски.
function drawVisitorsWorld(ctx, g, now) {
  const h = g.mitaHelp;
  if (h) {
    drawMita(ctx, 70, 470 + Math.sin(now * 3) * 3, 0.5, {});
    text(ctx, `Мита ${Math.ceil(h.t)}`, 70, 420, { font: `bold 13px ${FONT.ui}`, color: '#f8bbd0', stroke: '#000', lw: 3, align: 'center' });
    if (h.snip) {
      const k = h.snip.t / 0.3;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      line(ctx, h.snip.x - 30, h.snip.y - 30 + k * 10, h.snip.x + 30, h.snip.y + 30 - k * 10, '#fff', 4);
      line(ctx, h.snip.x + 30, h.snip.y - 30 + k * 10, h.snip.x - 30, h.snip.y + 30 - k * 10, '#fff', 4);
      ctx.restore();
    }
  }
  const G = g.granny;
  if (G) {
    const k = G.noise / 100;
    drawGranny(ctx, 1210 - k * 30, 400, 1, { glow: Math.max(0, k * 1.4 - 0.4), swing: G.scare > 0 });
  }
}

function drawVisitorsHud(ctx, g, now) {
  const G = g.granny;
  if (G) {
    const k = G.noise / 100;
    rr(ctx, 470, 172, 340, 30, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fill();
    rr(ctx, 520, 180, 280 * k, 14, 7);
    ctx.fillStyle = k > 0.7 ? '#ff1744' : k > 0.4 ? '#ffb300' : '#9e9e9e';
    ctx.fill();
    text(ctx, '👂', 494, 194, { font: `18px ${FONT.ui}`, align: 'center' });
    text(ctx, `ГРЕННИ · ТИШЕ! ${Math.ceil(G.t)}`, 640, 220, { font: `bold 13px ${FONT.ui}`, color: '#e0e0e0', stroke: '#000', lw: 3, align: 'center' });
    if (G.scare > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, W, H);
      drawGranny(ctx, 640 + rand(-8, 8), 470, 4.2, { glow: 1, swing: true });
    }
  }
  if (g.mitaScareT > 0) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    drawMita(ctx, 640 + rand(-14, 14), 300, 4.5, { crazy: true, t: now });
  }
}
