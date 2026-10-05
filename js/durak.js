'use strict';
/* Дурак — подкидной. Главное место — бой с боссом кампании: впадая в ярость, босс вызывает
   сыграть в дурака (колода 24 карты). Карты, которые забрал босс, бьют по его HP, карты,
   которые забрал ты, — по твоему здоровью; итог партии — большой урон боссу или колпак тебе.
   Ещё можно сыграть вдвоём: с ботом (36 карт) или с другом по сети (режим дуэли).
   Правила (dk*) — чистые функции над состоянием партии. Хозяин комнаты (или игра с ботом)
   ведёт настоящее состояние; гость шлёт свои ходы и рисует то, что прислал хозяин.
   На валетах, дамах и королях — шахматные конь, ферзь и король, в тему доски. */

const DK_RANKS = ['6', '7', '8', '9', '10', 'В', 'Д', 'К', 'Т'];
const DK_SUITS = ['♠', '♣', '♦', '♥'];
const DK = { w: 84, h: 120, think: [0.7, 1.2], auto: 0.9 };
// Партия с боссом: колода с девяток, урон за взятые карты и за итог.
const DK_BOSS = { minRank: 3, perCard: 0.02, hurtPerCard: 0.5, win: 0.2, money: 1000, lose: 4, cap: 20 };
const DK_TAUNTS = {
  attack: ['Козыри у меня!', 'Лови!', 'Отбивайся, если сможешь!', 'Хе-хе-хе!'],
  beat: ['Бито!', 'Слабовато!', 'И это всё?'],
  take: ['Беру… пока что.', 'Ах ты ж!', 'Это ещё не конец!'],
  youTake: ['Бери-бери!', 'Хе-хе, полная рука!', 'Дурак растёт!'],
  bito: ['Ладно, бито…', 'Повезло тебе.'],
};

const dkSuit = (c) => Math.floor(c / 9);
const dkRank = (c) => c % 9;
const dkRed = (c) => dkSuit(c) >= 2;
const dkName = (c) => DK_RANKS[dkRank(c)] + DK_SUITS[dkSuit(c)];

// Бьёт ли карта d карту a.
function dkBeats(a, d, trump) {
  if (dkSuit(d) === dkSuit(a)) return dkRank(d) > dkRank(a);
  return dkSuit(d) === trump && dkSuit(a) !== trump;
}

function dkSort(hand, trump) {
  const key = (c) => (dkSuit(c) === trump ? 100 : 0) + dkRank(c) * 4 + dkSuit(c);
  return hand.sort((a, b) => key(a) - key(b));
}

// Новая раздача: по 6 карт, нижняя карта колоды — козырь, первым ходит тот, у кого младший козырь.
// minRank — с какого достоинства колода: 0 — с шестёрок (36 карт), 3 — с девяток (24).
function dkNew(minRank = 0) {
  const deck = shuffle([...Array(36).keys()].filter((c) => dkRank(c) >= minRank));
  const st = { deck, trumpCard: deck[0], trump: dkSuit(deck[0]), hands: [[], []], table: [], out: 0, attacker: 0, taking: false, limit: 6, over: false, fool: -1, v: 1, log: '', end: '' };
  for (let i = 0; i < 6; i++) for (const p of [0, 1]) st.hands[p].push(deck.pop());
  let best = null;
  for (const p of [0, 1]) {
    for (const c of st.hands[p]) if (dkSuit(c) === st.trump && (!best || dkRank(c) < best.r)) best = { p, r: dkRank(c), c };
    dkSort(st.hands[p], st.trump);
  }
  st.attacker = best ? best.p : randi(0, 1);
  st.firstTrump = best ? best.c : -1;
  st.limit = Math.min(6, st.hands[1 - st.attacker].length);
  return st;
}

const dkUnbeaten = (st) => st.table.filter((p) => p.d === null).length;

// Можно ли атакующему положить (подкинуть) эту карту.
function dkCanThrow(st, c) {
  if (st.over || st.table.length >= st.limit) return false;
  if (!st.table.length) return !st.taking;
  const ranks = new Set();
  for (const p of st.table) {
    ranks.add(dkRank(p.a));
    if (p.d !== null) ranks.add(dkRank(p.d));
  }
  // неотбитых карт не больше, чем карт у защищающегося
  return ranks.has(dkRank(c)) && dkUnbeaten(st) + 1 <= st.hands[1 - st.attacker].length;
}

// Ход игрока who: play — положить/подкинуть, beat — отбить карту стола i, take — взять, done — бито / хватит.
function dkAct(st, who, a) {
  if (st.over || !a) return false;
  const att = st.attacker, def = 1 - att, hand = st.hands[who];
  const take = (c) => hand.splice(hand.indexOf(c), 1);
  if (a.t === 'play') {
    if (who !== att || !hand.includes(a.c) || !dkCanThrow(st, a.c)) return false;
    take(a.c);
    st.table.push({ a: a.c, d: null });
    st.log = (st.table.length > 1 ? 'подкинул ' : 'ходит ') + dkName(a.c);
  } else if (a.t === 'beat') {
    const p = st.table[a.i];
    if (who !== def || st.taking || !p || p.d !== null || !hand.includes(a.c) || !dkBeats(p.a, a.c, st.trump)) return false;
    take(a.c);
    p.d = a.c;
    st.log = `бьёт ${dkName(p.a)} картой ${dkName(a.c)}`;
  } else if (a.t === 'take') {
    if (who !== def || st.taking || !dkUnbeaten(st)) return false;
    st.taking = true;
    st.log = 'берёт';
  } else if (a.t === 'done') {
    if (who !== att || !st.table.length || (!st.taking && dkUnbeaten(st))) return false;
    dkEndBout(st);
  } else return false;
  st.v++;
  return true;
}

function dkEndBout(st) {
  const att = st.attacker, def = 1 - att;
  const cards = [];
  for (const p of st.table) {
    cards.push(p.a);
    if (p.d !== null) cards.push(p.d);
  }
  if (st.taking) st.hands[def].push(...cards);
  else st.out += cards.length;
  st.end = st.taking ? 'take' : 'bito';
  st.log = st.taking ? 'забрал карты' : 'бито';
  st.table = [];
  for (const p of [att, def]) while (st.hands[p].length < 6 && st.deck.length) st.hands[p].push(st.deck.pop());
  if (!st.taking) st.attacker = def;
  st.taking = false;
  for (const h of st.hands) dkSort(h, st.trump);
  if (!st.deck.length) {
    const e0 = !st.hands[0].length, e1 = !st.hands[1].length;
    if (e0 || e1) {
      st.over = true;
      st.fool = e0 && e1 ? 2 : e0 ? 1 : 0; // 2 — ничья
    }
  }
  st.limit = Math.min(6, st.hands[1 - st.attacker].length);
}

// Ход, который делается сам: атакующему нечего подкинуть — бито (или «хватит», если берут).
function dkForced(st) {
  if (st.over || !st.table.length || (!st.taking && dkUnbeaten(st))) return null;
  const att = st.attacker;
  if (st.hands[att].some((c) => dkCanThrow(st, c))) return null;
  return { who: att, a: { t: 'done' } };
}

// Бот: ходит младшими, подкидывает мелочь, козыри бережёт; дорого отбиваться в начале — берёт.
function dkBotMove(st, me) {
  const hand = st.hands[me], trump = st.trump, end = !st.deck.length;
  const val = (c) => dkRank(c) + (dkSuit(c) === trump ? 10 : 0);
  const low = (list) => list.reduce((a, b) => (val(b) < val(a) ? b : a));
  if (st.attacker === me) {
    const legal = hand.filter((c) => dkCanThrow(st, c));
    if (!st.table.length) return legal.length ? { t: 'play', c: low(legal) } : null;
    const cheap = legal.filter((c) => end || (dkSuit(c) !== trump && (st.taking || dkRank(c) <= 5)));
    return cheap.length ? { t: 'play', c: low(cheap) } : { t: 'done' };
  }
  if (st.taking) return null;
  const open = st.table.map((p, i) => ({ p, i })).filter((x) => x.p.d === null);
  if (!open.length) return null;
  const avail = hand.slice(), plan = [];
  for (const x of open.sort((a, b) => val(b.p.a) - val(a.p.a))) {
    const opts = avail.filter((c) => dkBeats(x.p.a, c, trump));
    if (!opts.length) return { t: 'take' };
    const c = low(opts);
    plan.push({ i: x.i, c });
    avail.splice(avail.indexOf(c), 1);
  }
  const cost = plan.reduce((s, p) => s + (dkSuit(p.c) === trump ? 10 + dkRank(p.c) : 0), 0);
  if (st.deck.length > 8 && cost >= 16) return { t: 'take' };
  return { t: 'beat', c: plan[0].c, i: plan[0].i };
}

// ---------- звуки ----------
function dkSound(kind) {
  const a = Sound.audio();
  if (!a || Sound.muted) return;
  const { ctx, master, noiseBuf } = a;
  const t = ctx.currentTime;
  if (kind === 'card') {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    f.type = 'bandpass';
    f.frequency.value = rand(2600, 3400);
    f.Q.value = 0.8;
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.08);
  } else if (kind === 'fool') {
    // грустный тромбон: «вау-вау-вау-ваааа»
    [[311, 0], [294, 0.38], [277, 0.76], [262, 1.14]].forEach(([f, d], i) => {
      const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t + d);
      const len = i === 3 ? 1.1 : 0.34;
      if (i === 3) {
        const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = 5;
        lg.gain.value = 9;
        lfo.connect(lg);
        lg.connect(o.frequency);
        lfo.start(t + d);
        lfo.stop(t + d + len);
      }
      fl.type = 'lowpass';
      fl.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.16, t + d + 0.05);
      g.gain.setValueAtTime(0.16, t + d + len - 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + len);
      o.connect(fl);
      fl.connect(g);
      g.connect(master);
      o.start(t + d);
      o.stop(t + d + len + 0.02);
    });
  }
}

// ---------- карты ----------
function drawCardBack(ctx, x, y, rot, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  const w = DK.w, h = DK.h;
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  rr(ctx, -w / 2, -h / 2, w, h, 8);
  ctx.fillStyle = '#f4f1e8';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  rr(ctx, -w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 5);
  ctx.fillStyle = '#7a1c1c';
  ctx.fill();
  // шахматная рубашка
  const cw = (w - 14) / 4, chh = (h - 14) / 6;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 6; j++) {
      if ((i + j) % 2) continue;
      ctx.fillStyle = 'rgba(255,214,120,0.28)';
      ctx.fillRect(-w / 2 + 7 + i * cw, -h / 2 + 7 + j * chh, cw, chh);
    }
  }
  circ(ctx, 0, 0, 15, '#f2c230');
  text(ctx, 'ХД', 0, 5, { font: `bold 13px ${FONT.title}`, color: '#7a1c1c', align: 'center' });
  ctx.restore();
}

function drawCardFace(ctx, c, x, y, rot, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const w = DK.w, h = DK.h, r = dkRank(c), red = dkRed(c);
  const col = red ? '#c62828' : '#1b1b1b';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = o.lift ? 14 : 6;
  ctx.shadowOffsetY = o.lift ? 6 : 2;
  rr(ctx, -w / 2, -h / 2, w, h, 8);
  ctx.fillStyle = '#fdfcf6';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#b8b2a0';
  ctx.stroke();
  const suit = DK_SUITS[dkSuit(c)], rank = DK_RANKS[r];
  const corner = () => {
    text(ctx, rank, -w / 2 + 7, -h / 2 + 20, { font: `bold ${rank === '10' ? 16 : 19}px ${FONT.ui}`, color: col });
    text(ctx, suit, -w / 2 + 7, -h / 2 + 38, { font: `17px ${FONT.ui}`, color: col });
  };
  corner();
  ctx.save();
  ctx.rotate(Math.PI);
  corner();
  ctx.restore();
  if (r >= 5 && r <= 7) {
    // валет, дама, король — шахматные фигуры
    drawPiece(ctx, ['n', 'q', 'k'][r - 5], red, 2, 6, 58, { shadow: false, tint: red ? '#e8c9c3' : undefined });
    text(ctx, suit, 20, -24, { font: `16px ${FONT.ui}`, color: col, align: 'center' });
  } else if (r === 8) {
    text(ctx, suit, 0, 18, { font: `54px ${FONT.ui}`, color: col, align: 'center' });
    drawCrown(ctx, 0, -30, 0.5, '#f2c230');
  } else text(ctx, suit, 0, 16, { font: `42px ${FONT.ui}`, color: col, align: 'center' });
  if (o.trump) {
    rr(ctx, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 7);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(242,194,48,0.85)';
    ctx.stroke();
  }
  if (o.dim) {
    rr(ctx, -w / 2, -h / 2, w, h, 8);
    ctx.fillStyle = 'rgba(20,30,20,0.38)';
    ctx.fill();
  }
  if (o.glow || o.sel) {
    rr(ctx, -w / 2 - 2, -h / 2 - 2, w + 4, h + 4, 9);
    ctx.lineWidth = o.sel ? 5 : 3;
    ctx.strokeStyle = o.sel ? '#33e6ff' : '#ffd54a';
    ctx.stroke();
  }
  ctx.restore();
}

// Колпак дурака.
function drawFoolCap(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  poly(ctx, [-26, 0, 0, -70, 26, 0], '#ffd54a', '#7a5b00', 3);
  poly(ctx, [-16, -24, 0, -70, 6, -40], '#e53935');
  circ(ctx, 0, -72, 7, '#e53935');
  rr(ctx, -30, -6, 60, 12, 5);
  ctx.fillStyle = '#e53935';
  ctx.fill();
  ctx.restore();
}

const Durak = {
  on: false,
  mode: 'bot', // bot | host | guest
  st: null, // у бота и хозяина — настоящее состояние, у гостя — то, что прислал хозяин
  me: 0,
  oppName: '',
  sel: null,
  botT: 0,
  autoT: 0,
  menu: false,
  hint: '',
  hintT: 0,
  ended: false,
  anim: new Map(),
  ghosts: [],
  lastV: 0,
  // сеть
  acts: [],
  seq: 0,
  seen: 0,
  dirty: false,
  score: loadJson('kd_durak', { w: 0, l: 0, d: 0 }),

  start(g, mode = 'bot') {
    this.on = true;
    this.mode = mode;
    this.g = g;
    this.me = mode === 'guest' ? 1 : 0;
    this.oppName = mode === 'bot' ? 'Бот ' + choice(DUEL_NICKS) : mode === 'boss' ? g.tower.name : Duel.oppName || 'Соперник';
    this.hurt = 0; // сколько здоровья снимем с тебя, когда вернёшься в бой
    this.ko = false; // босс погиб прямо за картами
    this.floats = [];
    this.taunt = mode === 'boss' ? 'Сыграем в дурака? Проиграешь — колпак твой!' : '';
    this.tauntT = mode === 'boss' ? 3 : 0;
    this.acts = [];
    this.seq = 0;
    this.seen = 0;
    this.menu = false;
    this.st = null;
    this.netPrev = null;
    if (mode !== 'guest') this.newGame();
    g.state = 'durak';
    g.duel = mode === 'host' || mode === 'guest';
    Input.lmb = false;
  },

  stop() {
    this.on = false;
    this.st = null;
  },

  newGame() {
    this.st = dkNew(this.mode === 'boss' ? DK_BOSS.minRank : 0);
    this.gameId = (this.gameId || 0) + 1;
    this.resetView();
    this.botT = rand(...DK.think) + 0.6;
    this.dirty = true;
    for (let i = 0; i < 6; i++) setTimeout(() => dkSound('card'), i * 70);
  },

  resetView() {
    this.anim.clear();
    this.ghosts = [];
    this.sel = null;
    this.ended = false;
    this.autoT = 0;
    this.lastV = 0;
  },

  // Мой ход (у бота и хозяина — сразу, гость отправляет хозяину).
  act(a) {
    const st = this.st;
    if (!st || st.over) return;
    if (this.mode === 'guest') {
      this.acts.push({ i: ++this.seq, t: a.t, c: a.c === undefined ? -1 : a.c, x: a.i === undefined ? -1 : a.i });
      if (this.acts.length > 8) this.acts.shift();
      this.dirty = true;
      // карту на стол показываем сразу; добор и «взять» — когда ответит хозяин
      if ((a.t === 'play' || a.t === 'beat') && dkAct(st, this.me, a)) dkSound('card');
      return;
    }
    this.doAct(this.me, a);
  },

  // Ход у бота, у хозяина и в бою с боссом: правила + последствия.
  doAct(who, a) {
    const st = this.st, taking = st.taking, def = 1 - st.attacker, first = !st.table.length;
    const n = st.table.reduce((k, p) => k + (p.d === null ? 1 : 2), 0);
    if (!dkAct(st, who, a)) return false;
    dkSound('card');
    this.dirty = true;
    this.autoT = 0;
    if (this.mode === 'boss') this.bossHook(who, a, taking, def, n, first);
    return true;
  },

  // Бой с боссом: взятые карты — урон, реплики босса.
  bossHook(who, a, taking, def, n, first) {
    const g = this.g, tw = g.tower;
    if (a.t === 'done' && taking) {
      if (def === 1) {
        const dmg = Math.round(tw.max * DK_BOSS.perCard * n);
        g.damageTower(dmg, false);
        this.float(`−${dmg} боссу`, 640, 190, '#ff5252');
        this.tease('take');
        if (tw.dead) {
          this.ko = true;
          Ach.unlock('cardko');
          Sound.win();
        }
      } else {
        this.hurt += DK_BOSS.hurtPerCard * n;
        this.float(`−${DK_BOSS.hurtPerCard * n} ❤`, 640, 560, '#ff8a80');
        this.tease('youTake');
      }
    } else if (a.t === 'done') this.tease(who === 1 ? 'bito' : 'beat');
    else if (a.t === 'take' && who === 1) this.tease('take');
    else if (a.t === 'play' && who === 1 && first) this.tease('attack');
  },

  tease(kind) {
    this.taunt = choice(DK_TAUNTS[kind]);
    this.tauntT = 2.2;
  },

  float(str, x, y, color) {
    this.floats.push({ str, x, y, color, t: 0 });
  },

  // Обратно в бой с боссом: итог партии и взятые карты.
  exitBoss(surrender = false) {
    const g = this.g, st = this.st;
    this.on = false;
    g.state = 'play';
    g.suppressFire = true;
    Input.lmb = false;
    const lost = surrender || (st && st.over && st.fool === 0);
    if (lost) {
      this.hurt += DK_BOSS.lose;
      g.foolCapT = DK_BOSS.cap;
      g.say(`<${g.tower.speaker}> Ха! Дурак! Носи колпак.`, '#ff8a65');
    } else if (st && st.over && st.fool === 1) g.say(`${g.tower.name} остался в дураках!`, '#ffd54a');
    if (this.hurt > 0) g.takeDamage(this.hurt, 'Дурак');
    this.st = null;
  },

  again() {
    if (this.mode === 'guest') {
      this.acts.push({ i: ++this.seq, t: 'again', c: -1, x: -1 });
      this.dirty = true;
    } else if (this.st && this.st.over) this.newGame();
  },

  // ---------- сеть ----------
  netState() {
    if (this.mode === 'guest') return { dka: this.acts.slice(-8) };
    const st = this.st;
    if (!st) return {};
    return {
      dk: {
        v: st.v,
        hc: st.hands[0].length,
        g: st.hands[1].slice(),
        tb: st.table.map((p) => [p.a, p.d === null ? -1 : p.d]),
        dc: st.deck.length,
        tc: st.trumpCard,
        o: st.out,
        at: st.attacker,
        tk: st.taking ? 1 : 0,
        lim: st.limit,
        f: st.over ? st.fool : -1,
        e: st.end,
        lg: st.log,
        gid: this.gameId || 0,
      },
    };
  },

  remote(s) {
    if (!s) return;
    if (this.mode === 'host' && Array.isArray(s.dka)) {
      for (const a of s.dka) {
        if (!a || !(a.i > this.seen)) continue;
        this.seen = a.i;
        if (a.t === 'again') {
          if (this.st.over) this.newGame();
        } else if (dkAct(this.st, 1, { t: a.t, c: Number(a.c), i: Number(a.x) })) {
          this.dirty = true;
          this.autoT = 0;
          dkSound('card');
        }
      }
    } else if (this.mode === 'guest' && s.dk && typeof s.dk === 'object') {
      const st = this.fromNet(s.dk);
      if (!st) return;
      const prev = this.netPrev;
      const fresh = !prev || st.gid !== prev.gid;
      // свой ход гость уже показал заранее — заменяем его, только когда у хозяина что-то изменилось
      if (fresh || st.v !== prev.v) {
        if (fresh) this.resetView();
        else if (st.hands[0].length !== prev.hands[0].length) dkSound('card');
        this.netPrev = st;
        this.st = this.fromNet(s.dk);
      }
    }
  },

  // Состояние от хозяина — чужие данные: проверяем.
  fromNet(dk) {
    const card = (c) => Number.isInteger(c) && c >= 0 && c < 36;
    const int = (v, a, b) => (Number.isInteger(v) && v >= a && v <= b ? v : null);
    if (!Array.isArray(dk.g) || !Array.isArray(dk.tb) || !dk.g.every(card) || !card(dk.tc)) return null;
    const hc = int(dk.hc, 0, 36), dc = int(dk.dc, 0, 36), at = int(dk.at, 0, 1), o = int(dk.o, 0, 36);
    if (hc === null || dc === null || at === null || o === null || dk.tb.length > 6) return null;
    const table = [];
    for (const p of dk.tb) {
      if (!Array.isArray(p) || !card(p[0]) || !(p[1] === -1 || card(p[1]))) return null;
      table.push({ a: p[0], d: p[1] === -1 ? null : p[1] });
    }
    const f = int(dk.f, -1, 2);
    return {
      v: int(dk.v, 0, 1e9) || 0,
      gid: int(dk.gid, 0, 1e9) || 0,
      hands: [Array(hc).fill(-1), dkSort(dk.g.slice(0, 36), dkSuit(dk.tc))],
      table,
      deck: Array(dc).fill(-1),
      trumpCard: dk.tc,
      trump: dkSuit(dk.tc),
      out: o,
      attacker: at,
      taking: !!dk.tk,
      limit: int(dk.lim, 0, 6) ?? 6,
      over: f !== null && f >= 0,
      fool: f === null ? -1 : f,
      end: dk.e === 'take' ? 'take' : 'bito',
      log: typeof dk.lg === 'string' ? dk.lg.slice(0, 60) : '',
    };
  },

  // ---------- кадр ----------
  update(dt, g) {
    if (this.hintT > 0) this.hintT -= dt;
    if (this.tauntT > 0) this.tauntT -= dt;
    for (const f of this.floats || []) f.t += dt;
    if (this.floats) this.floats = this.floats.filter((f) => f.t < 1.4);
    if (this.ko) return this.animate(dt);
    const st = this.st;
    if (!st) return this.animate(dt);
    if (this.mode !== 'guest' && !st.over && !this.menu) {
      // бот думает
      if (this.mode === 'bot' || this.mode === 'boss') {
        const who = this.mustAct(st);
        if (who === 1) {
          this.botT -= dt;
          if (this.botT <= 0) {
            this.botT = rand(...DK.think);
            const a = dkBotMove(st, 1);
            if (a) this.doAct(1, a);
          }
        }
      }
      // нечего подкинуть — «бито» само
      const f = dkForced(st);
      if (f) {
        this.autoT += dt;
        if (this.autoT >= DK.auto) {
          this.autoT = 0;
          this.doAct(f.who, f.a);
        }
      } else this.autoT = 0;
    }
    if (st.over && !this.ended) this.onOver(st);
    this.animate(dt);
  },

  // Кто сейчас должен что-то сделать (для бота).
  mustAct(st) {
    if (st.over) return -1;
    const att = st.attacker, def = 1 - att;
    if (!st.table.length) return att;
    if (!st.taking && dkUnbeaten(st)) return def;
    return att;
  },

  onOver(st) {
    this.ended = true;
    const win = st.fool === 1 - this.me, draw = st.fool === 2;
    if (this.mode === 'boss' && win) {
      // босс в дураках — большой урон сразу, чтобы было видно на полоске
      const tw = this.g.tower;
      this.g.damageTower(Math.round(tw.max * DK_BOSS.win), true);
      this.g.addMoney(DK_BOSS.money);
      if (tw.dead) Ach.unlock('cardko');
    }
    if (this.mode === 'boss') this.tease(win ? 'take' : 'youTake');
    if (draw) Sound.whoosh();
    else if (win) {
      Sound.win();
      Ach.unlock('durak');
    } else dkSound('fool');
    if (this.mode === 'bot') {
      if (draw) this.score.d++;
      else if (win) this.score.w++;
      else this.score.l++;
      Store.set('kd_durak', JSON.stringify(this.score));
    }
  },

  onKey(code, g) {
    if (code === 'Escape') this.menu = !this.menu;
    else if ((code === 'Enter' || code === 'Space') && this.mode === 'boss' && (this.ko || (this.st && this.st.over))) this.exitBoss();
    else if ((code === 'Enter' || code === 'Space') && this.st && this.st.over) this.again();
    else if (code === 'Space' && !this.menu) {
      const b = this.mainButton();
      if (b) b.action();
    }
  },

  say(str) {
    this.hint = str;
    this.hintT = 1.8;
  },

  // Нажата карта своей руки.
  clickHand(c) {
    const st = this.st;
    if (!st || st.over || this.menu) return;
    const att = st.attacker === this.me;
    if (att) {
      if (dkCanThrow(st, c)) this.act({ t: 'play', c });
      else if (st.table.length && !st.taking && dkUnbeaten(st) === 0 && st.table.length >= st.limit) this.say('Больше подкидывать нельзя — жми «БИТО»');
      else this.say(st.table.length ? 'Подкидывать можно только карты того же достоинства, что на столе' : 'Сейчас не твой ход');
      return;
    }
    if (st.taking || !dkUnbeaten(st)) return this.say(st.taking ? 'Ты берёшь — ждём, что ещё подкинут' : 'Сейчас ходит соперник');
    const targets = st.table.map((p, i) => i).filter((i) => st.table[i].d === null && dkBeats(st.table[i].a, c, st.trump));
    if (!targets.length) return this.say('Этой картой не отбиться: нужна старше той же масти или козырь');
    if (targets.length === 1) this.act({ t: 'beat', c, i: targets[0] });
    else {
      this.sel = this.sel === c ? null : c;
      if (this.sel !== null) this.say('Теперь нажми карту на столе, которую бьёшь');
    }
  },

  clickTable(i) {
    const st = this.st;
    if (!st || this.sel === null) return;
    const p = st.table[i];
    if (p && p.d === null && dkBeats(p.a, this.sel, st.trump)) this.act({ t: 'beat', c: this.sel, i });
    else this.say('Эту карту выбранной не побить');
    this.sel = null;
  },

  mainButton() {
    const st = this.st;
    if (!st || st.over) return null;
    const me = this.me;
    if (st.attacker === me && st.table.length && (st.taking || !dkUnbeaten(st))) {
      return { label: st.taking ? 'ХВАТИТ' : 'БИТО', action: () => this.act({ t: 'done' }) };
    }
    if (st.attacker !== me && !st.taking && dkUnbeaten(st)) return { label: 'ВЗЯТЬ', action: () => this.act({ t: 'take' }) };
    return null;
  },

  status() {
    const st = this.st, me = this.me;
    if (!st) return 'Ждём, пока хозяин раздаст карты…';
    if (st.over) return '';
    const opp = this.oppName;
    if (st.attacker === me) {
      if (!st.table.length) return 'Твой ход: положи любую карту';
      if (st.taking) return `${opp} берёт — подкинь ещё или жми «ХВАТИТ»`;
      if (!dkUnbeaten(st)) return 'Отбился — подкинь того же достоинства или «БИТО»';
      return `${opp} отбивается…`;
    }
    if (!st.table.length) return `Ходит ${opp}…`;
    if (st.taking) return 'Ты берёшь — ждём, что ещё подкинут';
    if (dkUnbeaten(st)) return 'Отбивайся: старшей картой той же масти или козырем — или бери';
    return `Отбился! ${opp} думает, подкинуть ли ещё…`;
  },

  // ---------- раскладка и анимация ----------
  layout() {
    const st = this.st, out = [];
    if (!st) return out;
    const me = this.me, opp = 1 - me;
    // рука соперника — рубашкой вверх
    const oh = st.hands[opp], on = oh.length, osp = Math.min(46, 560 / Math.max(1, on));
    oh.forEach((c, i) => {
      const k = i - (on - 1) / 2;
      out.push({ key: c >= 0 ? c : 'o' + i, id: -1, x: 640 + k * osp, y: 58 + Math.abs(k) * 1.5, rot: k * 0.025 + Math.PI, z: 1, zone: 'opp' });
    });
    // стол
    const n = st.table.length;
    st.table.forEach((p, i) => {
      const x = 640 + (i - (n - 1) / 2) * 116;
      out.push({ key: p.a, id: p.a, x, y: 300, rot: -0.04, z: 2, zone: 'table', ti: i });
      if (p.d !== null) out.push({ key: p.d, id: p.d, x: x + 18, y: 330, rot: 0.14, z: 3, zone: 'table', ti: i });
    });
    // моя рука
    const mh = st.hands[me], mn = mh.length, sp = Math.min(92, 860 / Math.max(1, mn));
    mh.forEach((c, i) => {
      const k = i - (mn - 1) / 2;
      out.push({ key: c, id: c, x: 640 + k * sp, y: 612 + Math.abs(k) * 2, rot: k * 0.03, z: 4, zone: 'hand' });
    });
    return out;
  },

  animate(dt) {
    const L = this.layout(), seen = new Set(), st = this.st;
    const deckPos = { x: 120, y: 318 }, oppPos = { x: 640, y: 40 };
    for (const c of L) {
      seen.add(c.key);
      let a = this.anim.get(c.key);
      if (!a) {
        // откуда прилетела новая карта: в руки — из колоды, на стол — от соперника (свои уже были в руке)
        const from = c.zone === 'table' ? oppPos : deckPos;
        a = { x: from.x, y: from.y, rot: c.zone === 'hand' ? 0 : Math.PI, zone: c.zone };
        this.anim.set(c.key, a);
      }
      const k = 1 - Math.exp(-dt * 11);
      a.x += (c.x - a.x) * k;
      a.y += (c.y - a.y) * k;
      a.rot += (c.rot - a.rot) * k;
      a.zone = c.zone;
    }
    // ушедшие со стола карты улетают в «бито» или в руку соперника
    for (const [key, a] of this.anim) {
      if (seen.has(key)) continue;
      this.anim.delete(key);
      if (a.zone === 'table') this.ghosts.push({ x: a.x, y: a.y, rot: a.rot, t: 0, to: st && st.end === 'take' ? oppPos : { x: 1160, y: 318 } });
    }
    for (const gh of this.ghosts) {
      gh.t += dt;
      const k = 1 - Math.exp(-dt * 9);
      gh.x += (gh.to.x - gh.x) * k;
      gh.y += (gh.to.y - gh.y) * k;
      gh.rot += dt * 3;
    }
    this.ghosts = this.ghosts.filter((gh) => gh.t < 0.5);
  },
};

// ---------- экран ----------
function renderDurak(ctx, g, now) {
  const D = Durak, st = D.st, boss = D.mode === 'boss';
  g.buttons = [];
  // сукно: зелёное, а в бою с боссом — бордовое
  const felt = ctx.createRadialGradient(640, 360, 80, 640, 360, 760);
  felt.addColorStop(0, boss ? '#6b1f2a' : '#1f6b3a');
  felt.addColorStop(1, boss ? '#2a0b10' : '#0b2e18');
  ctx.fillStyle = felt;
  ctx.globalAlpha = boss ? 0.84 : 1;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 2;
  rr(ctx, 230, 200, 820, 250, 30);
  ctx.stroke();
  text(ctx, boss ? 'ДУРАК С БОССОМ' : 'ДУРАК', 24, 40, { font: `30px ${FONT.title}`, color: '#ffd54a', stroke: '#000', lw: 5 });
  const sub = boss
    ? `взятая боссом карта — −${Math.round(DK_BOSS.perCard * 100)}% его HP, твоя — −${DK_BOSS.hurtPerCard} ❤`
    : D.mode === 'bot' ? `против бота · счёт ${D.score.w} : ${D.score.l}` : 'с другом по сети';
  text(ctx, sub, 24, 64, { font: `bold 14px ${FONT.ui}`, color: boss ? '#ffcdd2' : '#c8e6c9' });
  mcButton(ctx, g, 'МЕНЮ', 1130, 14, 130, 40, () => (D.menu = true), { size: 11 });
  if (!st) {
    text(ctx, D.status(), 640, 360, { font: `bold 24px ${FONT.ui}`, color: '#fff', align: 'center' });
    return drawDurakMenu(ctx, g);
  }
  const me = D.me, opp = 1 - me;
  // соперник
  text(ctx, `${D.oppName} · карт: ${st.hands[opp].length}`, 640, 150, { font: `bold 16px ${FONT.ui}`, color: '#fff', align: 'center', stroke: 'rgba(0,0,0,0.5)', lw: 3 });
  if (boss) {
    // полоска HP босса — та же, что в бою
    const tw = g.tower, k = clamp(tw.hp / tw.max, 0, 1);
    rr(ctx, 490, 160, 300, 14, 7);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();
    if (k > 0) {
      rr(ctx, 490, 160, 300 * k, 14, 7);
      ctx.fillStyle = '#e53935';
      ctx.fill();
    }
    text(ctx, `${Math.ceil(tw.hp)} / ${tw.max}`, 640, 172, { font: `bold 11px ${FONT.ui}`, color: '#fff', align: 'center' });
    if (D.tauntT > 0 && D.taunt) {
      ctx.font = `bold 17px ${FONT.ui}`;
      const w = ctx.measureText(D.taunt).width + 28;
      rr(ctx, 820, 96, w, 40, 12);
      ctx.fillStyle = '#fff';
      ctx.fill();
      poly(ctx, [834, 130, 812, 146, 852, 134], '#fff');
      text(ctx, D.taunt, 834, 122, { font: `bold 17px ${FONT.ui}`, color: '#111' });
    }
  } else if (st.attacker === opp && !st.over) text(ctx, 'ходит', 640, 170, { font: `bold 13px ${FONT.ui}`, color: '#ffd54a', align: 'center' });
  // колода и козырь
  if (st.deck.length) {
    drawCardFace(ctx, st.trumpCard, 150, 318, Math.PI / 2, { trump: true });
    if (st.deck.length > 1) for (let i = 0; i < Math.min(5, Math.ceil((st.deck.length - 1) / 6)); i++) drawCardBack(ctx, 120 - i * 1.2, 318 - i * 1.5, 0);
    text(ctx, `в колоде: ${st.deck.length}`, 130, 404, { font: `bold 14px ${FONT.ui}`, color: '#e8f5e9', align: 'center' });
  }
  rr(ctx, 70, 424, 120, 30, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();
  text(ctx, `козырь ${DK_SUITS[st.trump]}`, 130, 445, { font: `bold 17px ${FONT.ui}`, color: dkRed(st.trumpCard) ? '#ff8a80' : '#fff', align: 'center' });
  // бито
  if (st.out) {
    for (let i = 0; i < Math.min(4, Math.ceil(st.out / 6)); i++) drawCardBack(ctx, 1160 + Math.sin(i * 7) * 6, 318 + i * 2, 0.3 + Math.sin(i * 3) * 0.25);
    text(ctx, `бито: ${st.out}`, 1160, 404, { font: `bold 14px ${FONT.ui}`, color: '#e8f5e9', align: 'center' });
  }

  // карты
  const L = D.layout().sort((a, b) => a.z - b.z);
  const myTurn = !st.over && D.mustActMe();
  let hover = null;
  const handCards = L.filter((c) => c.zone === 'hand');
  for (let i = handCards.length - 1; i >= 0; i--) {
    const c = handCards[i], a = D.anim.get(c.key);
    if (a && Math.abs(Input.x - a.x) < DK.w / 2 && Math.abs(Input.y - a.y) < DK.h / 2) {
      hover = c.key;
      break;
    }
  }
  for (const c of L) {
    const a = D.anim.get(c.key) || c;
    if (c.zone === 'opp') {
      drawCardBack(ctx, a.x, a.y, a.rot);
      continue;
    }
    if (c.zone === 'table') {
      const open = st.table[c.ti] && st.table[c.ti].d === null && c.id === st.table[c.ti].a;
      const target = open && D.sel !== null && dkBeats(c.id, D.sel, st.trump);
      drawCardFace(ctx, c.id, a.x, a.y, a.rot, { trump: dkSuit(c.id) === st.trump, glow: target });
      continue;
    }
    const legal = myTurn && D.legal(c.id);
    const lift = c.key === hover || D.sel === c.id;
    drawCardFace(ctx, c.id, a.x, a.y - (lift ? 26 : 0), a.rot, { trump: dkSuit(c.id) === st.trump, dim: myTurn && !legal, sel: D.sel === c.id, lift });
  }
  for (const gh of D.ghosts) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - gh.t / 0.5);
    drawCardBack(ctx, gh.x, gh.y, gh.rot);
    ctx.restore();
  }
  // кликабельные зоны: сначала верхние карты
  if (!D.menu && !st.over) {
    for (let i = handCards.length - 1; i >= 0; i--) {
      const c = handCards[i], a = D.anim.get(c.key) || c;
      g.buttons.push({ x: a.x - DK.w / 2, y: a.y - DK.h / 2 - 26, w: DK.w, h: DK.h + 26, action: () => D.clickHand(c.id) });
    }
    st.table.forEach((p, i) => {
      if (p.d !== null) return;
      const a = D.anim.get(p.a);
      if (a) g.buttons.push({ x: a.x - DK.w / 2, y: a.y - DK.h / 2, w: DK.w, h: DK.h, action: () => D.clickTable(i) });
    });
  }

  for (const f of D.floats || []) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - f.t / 1.4);
    text(ctx, f.str, f.x, f.y - f.t * 40, { font: `30px ${FONT.gta}`, color: f.color, stroke: '#000', lw: 6, align: 'center' });
    ctx.restore();
  }
  if (boss && D.hurt > 0 && !st.over) text(ctx, `взято карт: −${D.hurt} ❤ после партии`, 24, 700, { font: `bold 15px ${FONT.ui}`, color: '#ff8a80' });
  if (boss && st.attacker === opp && !st.over) text(ctx, 'ходит босс', 640, 190, { font: `bold 13px ${FONT.ui}`, color: '#ffd54a', align: 'center' });
  // подсказки и кнопка
  const msg = D.hintT > 0 ? D.hint : D.status();
  if (msg) text(ctx, msg, 640, 498, { font: `bold 19px ${FONT.ui}`, color: D.hintT > 0 ? '#ffcc80' : '#fff', align: 'center', stroke: 'rgba(0,0,0,0.55)', lw: 4 });
  const b = D.mainButton();
  if (b && !D.menu) mcButton(ctx, g, b.label, 1050, 456, 200, 56, b.action, { size: 16, fill: b.label === 'ВЗЯТЬ' ? '#8a4a3a' : '#2e7d32' });
  if (Duel.result && D.mode !== 'bot') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, Duel.result.reason, 640, 330, { font: `bold 28px ${FONT.ui}`, color: '#fff', align: 'center' });
    mcButton(ctx, g, 'В ЛОББИ', 440, 380, 190, 50, () => Duel.toLobby(g), { size: 13 });
    mcButton(ctx, g, 'В МЕНЮ', 650, 380, 190, 50, () => Duel.close(g), { size: 13 });
    return;
  }
  if (D.ko) drawDurakKo(ctx, g, now);
  else if (st.over) drawDurakOver(ctx, g, now);
  drawDurakMenu(ctx, g);
}

// Босс погиб прямо за картами.
function drawDurakKo(ctx, g, now) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);
  const sc = 1 + Math.sin(now * 4) * 0.03;
  ctx.save();
  ctx.translate(640, 300);
  ctx.scale(sc, sc);
  text(ctx, 'БОСС ПОВЕРЖЕН КАРТАМИ!', 0, 0, { font: `60px ${FONT.title}`, color: '#ffd54a', stroke: '#000', lw: 9, align: 'center' });
  ctx.restore();
  text(ctx, `${Durak.oppName} не унёс столько карт`, 640, 350, { font: `bold 22px ${FONT.ui}`, color: '#fff', align: 'center' });
  mcButton(ctx, g, 'В БОЙ!', 540, 400, 200, 54, () => Durak.exitBoss(), { size: 16, fill: '#c62828' });
}

Object.assign(Durak, {
  // Нужно ли сейчас что-то делать мне.
  mustActMe() {
    const st = this.st;
    if (!st || st.over) return false;
    return this.mustAct(st) === this.me && !(st.attacker !== this.me && st.taking);
  },
  legal(c) {
    const st = this.st;
    if (st.attacker === this.me) return dkCanThrow(st, c);
    return !st.taking && st.table.some((p) => p.d === null && dkBeats(p.a, c, st.trump));
  },
});

function drawDurakOver(ctx, g, now) {
  const D = Durak, st = D.st;
  const win = st.fool === 1 - D.me, draw = st.fool === 2;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);
  const boss = D.mode === 'boss';
  const title = draw ? 'НИЧЬЯ' : win ? (boss ? 'БОСС — ДУРАК!' : 'ПОБЕДА!') : 'ТЫ ДУРАК!';
  const sc = 1 + Math.sin(now * 4) * 0.03;
  ctx.save();
  ctx.translate(640, 300);
  ctx.scale(sc, sc);
  text(ctx, title, 0, 0, { font: `84px ${FONT.title}`, color: draw ? '#fff' : win ? '#ffd54a' : '#ff5252', stroke: '#000', lw: 10, align: 'center' });
  ctx.restore();
  // колпак — над тем, кто остался в дураках: над соперником или над твоими картами
  if (!draw) drawFoolCap(ctx, 640, (win ? 130 : 560) + Math.sin(now * 3) * 4, 1.1);
  let sub = draw ? 'Оба вышли одновременно' : win ? `${D.oppName} остался в дураках` : `У тебя остались карты — колпак твой`;
  if (boss && win) sub = `${D.oppName} в дураках: −${Math.round(DK_BOSS.win * 100)}% HP боссу и +$${DK_BOSS.money}`;
  if (boss && !win && !draw) sub = `Колпак твой на ${DK_BOSS.cap} секунд и −${DK_BOSS.lose + D.hurt} ❤`;
  text(ctx, sub, 640, 350, { font: `bold 22px ${FONT.ui}`, color: '#fff', align: 'center' });
  if (boss) {
    mcButton(ctx, g, 'В БОЙ!', 540, 410, 200, 54, () => D.exitBoss(), { size: 16, fill: '#c62828' });
    return;
  }
  if (D.mode === 'bot') text(ctx, `Счёт против бота: ${D.score.w} : ${D.score.l}${D.score.d ? ` (ничьих ${D.score.d})` : ''}`, 640, 384, { font: `bold 18px ${FONT.ui}`, color: '#c8e6c9', align: 'center' });
  mcButton(ctx, g, 'ЕЩЁ РАЗ', 440, 420, 190, 52, () => D.again(), { size: 14, fill: '#2e7d32' });
  if (D.mode === 'bot') mcButton(ctx, g, 'В МЕНЮ', 650, 420, 190, 52, () => g.toTitle(), { size: 14 });
  else mcButton(ctx, g, 'В ЛОББИ', 650, 420, 190, 52, () => Duel.toLobby(g), { size: 14 });
}

function drawDurakMenu(ctx, g) {
  const D = Durak;
  if (!D.menu) return;
  g.buttons = [];
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, 'ПАУЗА', 640, 220, { font: `56px ${FONT.title}`, color: '#fff', stroke: '#000', lw: 8, align: 'center' });
  mcButton(ctx, g, 'ПРОДОЛЖИТЬ', 480, 260, 320, 46, () => (D.menu = false));
  if (D.mode === 'boss') {
    mcButton(ctx, g, 'СДАТЬСЯ (ТЫ ДУРАК)', 480, 316, 320, 46, () => {
      D.menu = false;
      D.exitBoss(true);
    });
  } else if (D.mode === 'bot') {
    mcButton(ctx, g, 'НОВАЯ РАЗДАЧА', 480, 316, 320, 46, () => {
      D.menu = false;
      D.newGame();
    });
    mcButton(ctx, g, 'ИГРАТЬ С ДРУГОМ', 480, 372, 320, 46, () => {
      Duel.mode = 'durak';
      Store.set('kd_mode', 'durak');
      Duel.open(g);
    });
    mcButton(ctx, g, 'В ГЛАВНОЕ МЕНЮ', 480, 428, 320, 46, () => g.toTitle());
  } else {
    mcButton(ctx, g, 'ВЫЙТИ В ЛОББИ', 480, 316, 320, 46, () => Duel.toLobby(g));
    mcButton(ctx, g, 'В ГЛАВНОЕ МЕНЮ', 480, 372, 320, 46, () => Duel.close(g));
  }
  mcButton(ctx, g, Music.on ? 'МУЗЫКА: ВКЛ' : 'МУЗЫКА: ВЫКЛ', 480, 500, 320, 40, () => Music.toggle(), { size: 11 });
}
