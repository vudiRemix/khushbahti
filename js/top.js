'use strict';
/* Зал славы — как на старых игровых автоматах: закончил забег, вписал ник — попал в топ.
   Топ этого устройства хранится в браузере. Общий топ — на тех же бесплатных MQTT-серверах,
   что и дуэль: у каждого ника одно «закреплённое» (retained) сообщение с его лучшим забегом,
   и каждый, кто открывает зал славы, получает их все. Ни регистрации, ни базы данных —
   и никакой защиты: топ держится на честном слове игроков. Свои рекорды игра помнит и
   при каждом заходе в зал славы досылает их, если сервер их потерял. */

const TOP_TOPIC = NET_PREFIX + '/top';
const TOP_LOCAL = 10; // строк в топе устройства
const TOP_MAX = 100; // строк в общем топе
const TOP_ROWS = 10; // строк на странице

// Ключ ника: регистр и «ё» не важны. Два разных 32-битных хеша — чтобы ники почти не совпадали.
function topKey(nick) {
  const s = cleanNick(nick).toLowerCase().replace(/ё/g, 'е');
  let a = 0x811c9dc5, b = 0x9747b28c;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    a = Math.imul(a ^ c, 16777619) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
    b = (b ^ (b >>> 15)) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

// Запись из сети — чужие данные: проверяем и обрезаем.
function cleanTopEntry(o) {
  if (!o || typeof o !== 'object') return null;
  const n = cleanNick(o.n);
  const s = Math.floor(Number(o.s));
  if (!n || !Number.isFinite(s) || s <= 0 || s > 1e9) return null;
  const int = (v, max) => clamp(Math.floor(Number(v)) || 0, 0, max);
  return { n, s, l: int(o.l, 9), w: o.w ? 1 : 0, k: int(o.k, 1e6), t: int(o.t, 1e6), d: int(o.d, 4e12) };
}

function loadJson(key, def) {
  try {
    const v = JSON.parse(Store.get(key) || 'null');
    return v && typeof v === 'object' ? v : def;
  } catch (e) {
    return def;
  }
}

const fmtScore = (s) => '$' + String(s).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// Одна короткая сессия с сервером: забрать все записи топа и дослать свои, если их там нет.
function topSession(url, mine) {
  return new Promise((resolve) => {
    const got = new Map();
    let client = null, done = false, idle = null;
    const finish = (ok) => {
      if (done) return;
      done = true;
      clearTimeout(idle);
      clearTimeout(hard);
      if (client) client.end(true);
      resolve(ok ? got : null);
    };
    const hard = setTimeout(() => finish(got.size > 0), 12000);
    const publishMine = () => {
      const send = mine.filter((e) => !(got.has(topKey(e.n)) && got.get(topKey(e.n)).s >= e.s));
      if (!send.length) return finish(true);
      let left = send.length;
      for (const e of send) {
        client.publish(`${TOP_TOPIC}/${topKey(e.n)}`, JSON.stringify(e), { qos: 1, retain: true }, (err) => {
          if (!err) got.set(topKey(e.n), e);
          if (--left === 0) finish(true);
        });
      }
    };
    // закреплённые сообщения приходят сразу после подписки — ждём, пока поток стихнет
    const wait = () => {
      clearTimeout(idle);
      idle = setTimeout(publishMine, 1300);
    };
    connectMqtt(url, 'kdt_' + Math.random().toString(36).slice(2, 10)).then((c) => {
      if (!c) return finish(false);
      if (done) return c.end(true);
      client = c;
      c.on('message', (topic, payload) => {
        const key = String(topic).split('/').pop();
        if (got.size >= 500 || !/^[0-9a-f]{16}$/.test(key)) return;
        let e = null;
        try {
          e = cleanTopEntry(JSON.parse(String(payload)));
        } catch (err) {
          /* мусор пропускаем */
        }
        if (e && topKey(e.n) === key) got.set(key, e);
        wait();
      });
      c.subscribe(TOP_TOPIC + '/+', { qos: 0 }, (err) => (err ? finish(false) : wait()));
    });
  });
}

const Top = {
  local: loadJson('kd_top', []).map(cleanTopEntry).filter(Boolean).slice(0, TOP_LOCAL),
  localIds: loadJson('kd_top_ids', []),
  mine: loadJson('kd_top_mine', {}), // лучший забег каждого своего ника — его досылаем серверу
  auto: Store.get('kd_top_auto') === '1', // уже записывался — дальше записываем сам
  global: [],
  status: 'idle', // idle | loading | ready | offline
  error: '',
  loadedAt: 0,
  syncing: null,
  run: null, // { id, entry, sent }
  tab: 'all', // all | local
  page: 0,
  back: 'title',

  available() {
    return /^https?:$/.test(location.protocol) || !!window.KD_MQTT_BROKERS;
  },

  saveLocal() {
    Store.set('kd_top', JSON.stringify(this.local));
    Store.set('kd_top_ids', JSON.stringify(this.localIds));
  },

  // Конец забега (смерть или победа над боссом): обновить запись этого забега.
  record(g) {
    if (g.duel || g.cheated) return;
    const s = Math.floor(g.player.earned);
    if (s <= 0) return;
    if (!this.run || this.run.id !== g.runId) this.run = { id: g.runId, entry: null, sent: false };
    const final = g.state === 'win' && g.levelIdx >= LEVELS.length - 1;
    this.run.entry = { n: Duel.name, s, l: g.levelIdx + 1, w: final ? 1 : 0, k: g.kills, t: Math.round(g.runT), d: Date.now() };
    this.putLocal(this.run);
    if (this.auto || this.run.sent) this.submit();
    else if (Date.now() - this.loadedAt > 15000) this.sync();
  },

  // Топ устройства: одна строка на забег.
  putLocal(run) {
    const i = this.localIds.indexOf(run.id);
    if (i >= 0) {
      this.local.splice(i, 1);
      this.localIds.splice(i, 1);
    }
    const at = this.local.findIndex((e) => e.s < run.entry.s);
    const pos = at < 0 ? this.local.length : at;
    this.local.splice(pos, 0, { ...run.entry });
    this.localIds.splice(pos, 0, run.id);
    this.local.length = Math.min(this.local.length, TOP_LOCAL);
    this.localIds.length = this.local.length;
    this.saveLocal();
  },

  // Записать забег в общий топ под текущим ником.
  submit() {
    const r = this.run;
    if (!r || !r.entry) return;
    r.entry.n = Duel.name;
    r.sent = true;
    this.putLocal(r);
    const key = topKey(r.entry.n);
    if (!this.mine[key] || this.mine[key].s < r.entry.s) {
      this.mine[key] = { ...r.entry };
      Store.set('kd_top_mine', JSON.stringify(this.mine));
    }
    if (!this.auto) {
      this.auto = true;
      Store.set('kd_top_auto', '1');
    }
    // своя запись видна в таблице сразу, не дожидаясь сервера
    this.merge(new Map([[key, this.mine[key]]]));
    this.sync(true);
  },

  merge(map) {
    const all = new Map(this.global.map((e) => [topKey(e.n), e]));
    for (const [k, e] of map) if (!all.has(k) || all.get(k).s < e.s) all.set(k, e);
    this.global = [...all.values()].sort((a, b) => b.s - a.s || a.d - b.d).slice(0, TOP_MAX);
  },

  // Забрать общий топ со всех серверов (и дослать свои записи).
  sync(again) {
    if (this.syncing) {
      if (again) this.syncAgain = true;
      return this.syncing;
    }
    if (!this.available()) {
      this.status = 'offline';
      this.error = 'Общий топ работает, когда игра открыта с сайта.';
      return Promise.resolve();
    }
    this.status = 'loading';
    this.syncing = (async () => {
      if (!(await loadMqttLib())) {
        this.status = 'offline';
        this.error = 'Нет интернета — не загрузилась библиотека связи.';
        return;
      }
      const mine = Object.values(this.mine);
      const res = await Promise.all(MQTT_BROKERS.map((u) => topSession(u, mine)));
      const ok = res.filter(Boolean);
      if (!ok.length) {
        this.status = 'offline';
        this.error = 'Нет связи с сервером. Твои рекорды сохранены — отправлю, когда появится связь.';
        return;
      }
      this.global = [];
      for (const m of ok) this.merge(m);
      this.merge(new Map(mine.map((e) => [topKey(e.n), e])));
      this.status = 'ready';
      this.error = '';
      this.loadedAt = Date.now();
    })().finally(() => {
      this.syncing = null;
      if (this.syncAgain) {
        this.syncAgain = false;
        this.sync();
      }
    });
    return this.syncing;
  },

  open(g) {
    if (g.state !== 'top') this.back = g.state === 'dead' || g.state === 'win' ? g.state : 'title';
    g.state = 'top';
    this.page = 0;
    if (this.status !== 'loading' && Date.now() - this.loadedAt > 15000) this.sync();
  },

  close(g) {
    if (this.back === 'title') g.toTitle();
    else g.state = this.back;
  },

  list() {
    return this.tab === 'local' ? this.local : this.global;
  },

  pages() {
    return Math.max(1, Math.ceil(this.list().length / TOP_ROWS));
  },

  flip(d) {
    this.page = clamp(this.page + d, 0, this.pages() - 1);
  },

  // Место забега в общем топе (1 — первое).
  rank(entry) {
    const key = topKey(entry.n);
    return 1 + this.global.filter((e) => e.s > entry.s && topKey(e.n) !== key).length;
  },

  editNick(then) {
    askNick('Под этим ником тебя увидят в зале славы и в дуэлях. До 16 символов.', (nick) => {
      if (Duel.setNick(nick)) Sound.coin();
      if (then) then();
    });
  },
};

// ---------- экраны ----------
const TOP_NEON = { pink: '#ff2a8a', cyan: '#33e6ff', sun: '#ffb13b' };

function neonText(ctx, str, x, y, font, color, blur = 18) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  text(ctx, str, x, y, { font, color, align: 'center' });
  ctx.restore();
  text(ctx, str, x, y, { font, color: '#fff7fb', align: 'center' });
}

// Фон в духе 80-х: закат с полосами и сетка до горизонта.
function drawSynthBackdrop(ctx, now) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#07020f');
  sky.addColorStop(0.55, '#1f0633');
  sky.addColorStop(0.56, '#090212');
  sky.addColorStop(1, '#030106');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  const hy = 400;
  ctx.save();
  ctx.globalAlpha = 0.5;
  const sun = ctx.createLinearGradient(0, hy - 230, 0, hy);
  sun.addColorStop(0, '#ffe36e');
  sun.addColorStop(1, '#ff2a8a');
  ctx.beginPath();
  ctx.arc(640, hy, 230, Math.PI, 0);
  ctx.fillStyle = sun;
  ctx.fill();
  ctx.fillStyle = '#1f0633';
  for (let i = 0; i < 7; i++) ctx.fillRect(400, hy - 20 - i * 26, 480, 3 + i * 1.6);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(255,42,138,0.45)';
  ctx.lineWidth = 1.5;
  for (let i = -16; i <= 16; i++) {
    ctx.beginPath();
    ctx.moveTo(640 + i * 14, hy);
    ctx.lineTo(640 + i * 120, H);
    ctx.stroke();
  }
  const off = (now * 0.6) % 1;
  for (let i = 0; i < 9; i++) {
    const k = (i + off) / 9;
    const y = hy + (H - hy) * k * k;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTopScreen(ctx, g, now) {
  drawSynthBackdrop(ctx, now);
  ctx.fillStyle = 'rgba(4,0,10,0.55)';
  ctx.fillRect(0, 0, W, H);
  neonText(ctx, 'ЗАЛ СЛАВЫ', 640, 74, `56px ${FONT.title}`, TOP_NEON.pink, 24);
  text(ctx, 'как на игровом автомате: лучший забег каждого ника', 640, 104, { font: `bold 16px ${FONT.ui}`, color: TOP_NEON.cyan, align: 'center' });
  const tabs = [['all', 'ВСЕ ИГРОКИ'], ['local', 'ЭТО УСТРОЙСТВО']];
  tabs.forEach(([id, label], i) => {
    mcButton(ctx, g, label, 400 + i * 250, 120, 230, 40, () => {
      Top.tab = id;
      Top.page = 0;
    }, { size: 11, fill: Top.tab === id ? '#c2185b' : '#3a2a4a' });
  });

  const x0 = 140, w = 1000, y0 = 176, rowH = 38;
  rr(ctx, x0, y0, w, 38 + TOP_ROWS * rowH + 8, 12);
  ctx.fillStyle = 'rgba(10,2,22,0.82)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,42,138,0.6)';
  ctx.stroke();
  const cols = [
    ['МЕСТО', 196, 'center'],
    ['НИК', 250, 'left'],
    ['ОЧКИ', 680, 'right'],
    ['УРОВЕНЬ', 790, 'center'],
    ['УБИЙСТВ', 905, 'center'],
    ['ВРЕМЯ', 1005, 'center'],
    ['ДАТА', 1090, 'center'],
  ];
  for (const [label, x, align] of cols) text(ctx, label, x, y0 + 26, { font: `10px ${FONT.pixel}`, color: TOP_NEON.cyan, align });

  const list = Top.list();
  Top.page = clamp(Top.page, 0, Top.pages() - 1);
  const me = topKey(Duel.name);
  const from = Top.page * TOP_ROWS;
  list.slice(from, from + TOP_ROWS).forEach((e, i) => {
    const y = y0 + 40 + i * rowH, rank = from + i + 1;
    const mine = Top.tab === 'local' ? Top.run && Top.localIds[from + i] === Top.run.id : topKey(e.n) === me;
    if (mine) {
      ctx.fillStyle = `rgba(51,230,255,${0.16 + Math.sin(now * 5) * 0.06})`;
      ctx.fillRect(x0 + 6, y, w - 12, rowH - 4);
    } else if (i % 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(x0 + 6, y, w - 12, rowH - 4);
    }
    const ty = y + 25;
    const medal = ['#ffd54a', '#e0e0e0', '#ffab70'][rank - 1];
    text(ctx, String(rank), 196, ty, { font: `bold 20px ${FONT.ui}`, color: medal || '#b39ddb', align: 'center' });
    text(ctx, e.n, 250, ty, { font: `bold 19px ${FONT.ui}`, color: mine ? TOP_NEON.cyan : '#fff' });
    text(ctx, fmtScore(e.s), 680, ty, { font: `22px ${FONT.gta}`, color: '#7ee05a', align: 'right' });
    text(ctx, e.w ? 'ВСЕ 5 ★' : `${e.l} из ${LEVELS.length}`, 790, ty, { font: `bold 16px ${FONT.ui}`, color: e.w ? TOP_NEON.sun : '#e1d5f0', align: 'center' });
    text(ctx, String(e.k), 905, ty, { font: `bold 16px ${FONT.ui}`, color: '#e1d5f0', align: 'center' });
    text(ctx, `${Math.floor(e.t / 60)}:${pad(e.t % 60, 2)}`, 1005, ty, { font: `bold 16px ${FONT.ui}`, color: '#e1d5f0', align: 'center' });
    const d = new Date(e.d);
    text(ctx, e.d ? `${pad(d.getDate(), 2)}.${pad(d.getMonth() + 1, 2)}` : '—', 1090, ty, { font: `bold 15px ${FONT.ui}`, color: '#b39ddb', align: 'center' });
  });

  // что под таблицей: пусто, загрузка, нет связи
  let note = '';
  if (Top.tab === 'all') {
    if (Top.status === 'loading') note = 'Связь с сервером' + '.'.repeat(1 + (Math.floor(now * 3) % 3));
    else if (Top.status === 'offline') note = Top.error;
    else if (!list.length && Top.status === 'ready') note = 'Пока пусто — сыграй и стань первым!';
  } else if (!list.length) note = 'На этом устройстве ещё никто не играл.';
  if (note && !list.length) text(ctx, note, 640, y0 + 200, { font: `bold 20px ${FONT.ui}`, color: '#e1d5f0', align: 'center' });
  else if (note) text(ctx, note, 640, 628, { font: `bold 15px ${FONT.ui}`, color: '#ffab91', align: 'center' });

  if (Top.pages() > 1) {
    mcButton(ctx, g, '◄', 470, 596, 60, 34, () => Top.flip(-1), { size: 12 });
    text(ctx, `стр. ${Top.page + 1} из ${Top.pages()}`, 640, 619, { font: `bold 16px ${FONT.ui}`, color: '#e1d5f0', align: 'center' });
    mcButton(ctx, g, '►', 750, 596, 60, 34, () => Top.flip(1), { size: 12 });
  }
  mcButton(ctx, g, 'НАЗАД', 150, 656, 230, 44, () => Top.close(g), { size: 12 });
  mcButton(ctx, g, Top.status === 'loading' ? 'ЖДУ...' : 'ОБНОВИТЬ', 525, 656, 230, 44, () => Top.sync(), { size: 12 });
  mcButton(ctx, g, `НИК: ${Duel.name}`, 900, 656, 230, 44, () => Top.editNick(), { size: 9, fill: '#8a4a3a' });
}

// Панель на экранах смерти и победы: записаться в топ.
function drawTopPanel(ctx, g, now) {
  const x = 866, y = 318, w = 384, h = 190;
  rr(ctx, x, y, w, h, 12);
  ctx.fillStyle = 'rgba(16,3,30,0.86)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,42,138,0.75)';
  ctx.stroke();
  neonText(ctx, 'ЗАЛ СЛАВЫ', x + w / 2, y + 34, `24px ${FONT.title}`, TOP_NEON.pink, 14);
  const r = Top.run;
  const line = (str, yy, color = '#e1d5f0') => text(ctx, str, x + w / 2, yy, { font: `bold 15px ${FONT.ui}`, color, align: 'center' });
  if (g.cheated) return line('С читами в зал славы не пускают', y + 100, '#ff8a80');
  if (!r || r.id !== g.runId || !r.entry) return line('Заработай хоть доллар — и попадёшь в топ', y + 100);
  text(ctx, fmtScore(r.entry.s), x + w / 2, y + 68, { font: `30px ${FONT.gta}`, color: '#7ee05a', align: 'center' });
  if (!r.sent) {
    line('Впиши ник — и ты в общем топе', y + 92);
    mcButton(ctx, g, `В ТОП КАК ${Duel.name}`, x + 22, y + 102, w - 44, 38, () => Top.submit(), { size: 10, fill: '#c2185b' });
    mcButton(ctx, g, 'ДРУГОЙ НИК', x + 22, y + 146, w - 44, 32, () => Top.editNick(() => Top.submit()), { size: 9 });
    return;
  }
  if (Top.status === 'loading') line('Записываю в зал славы' + '.'.repeat(1 + (Math.floor(now * 3) % 3)), y + 96);
  else if (Top.status === 'offline') {
    line('Нет связи — рекорд сохранён,', y + 90, '#ffab91');
    line('отправлю при следующем заходе', y + 110, '#ffab91');
  } else line(`Место #${Top.rank(r.entry)} из ${Top.global.length} · ${r.entry.n}`, y + 96, TOP_NEON.cyan);
  mcButton(ctx, g, 'ОТКРЫТЬ ТОП', x + 22, y + 124, 196, 34, () => Top.open(g), { size: 9, fill: '#c2185b' });
  mcButton(ctx, g, 'ДРУГОЙ НИК', x + 226, y + 124, w - 248, 34, () => Top.editNick(() => Top.submit()), { size: 8 });
}
