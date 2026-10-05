'use strict';
/* Дуэль: двое играют каждый свою доску, видят друг друга и шлют «подарки».
   Состояние матча живёт в «присутствии» каждого игрока: здоровье, босс, исход
   и список последних отправленных атак с номерами (получатель берёт только новые). */

const DUEL_NICKS = ['Сапёр', 'Скибиди', 'Крипер', 'Нубик', 'Про100', 'Фредди', 'Гумба', 'Король', 'Пешка', 'Амогус', 'Купа', 'Соник'];

// Что получает соперник за твои успехи.
const DUEL_ATTACKS = {
  mega: { name: 'Мегарыцарь', spawn: ['mega'], why: 'пройденный сапёр' },
  wave: { name: 'волна врагов', spawn: 'pool3', why: 'каждые 15 убийств' },
  creeper: { name: 'крипер', spawn: ['creeper'], why: 'подстреленная утка' },
  skibidi: { name: 'два скибиди-туалета', spawn: ['skibidi', 'skibidi'], why: 'звезда Марио' },
  stars: { name: '+1 звезда розыска', stars: 1, why: 'ярость твоего босса' },
};

function randomNick() {
  return choice(DUEL_NICKS) + randi(10, 99);
}

const NICK_MAX = 16;

// Ник: без управляющих символов и лишних пробелов, не длиннее NICK_MAX.
function cleanNick(s) {
  return Array.from(String(s || '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '').replace(/\s+/g, ' ').trim())
    .slice(0, NICK_MAX)
    .join('')
    .trim();
}

const Duel = {
  phase: 'off', // off | connecting | lobby | hosting | joining | countdown | playing | over | unavailable
  active: false, // идёт матч (игровые хуки включены)
  name: cleanNick(Store.get('kd_nick')) || randomNick(),
  nickAsked: !!Store.get('kd_nick'),
  lvl: 0,
  role: '',
  code: '',
  lobby: null,
  room: null,
  opp: null,
  oppName: '',
  oppSeen: 0,
  joinT: 0,
  countT: 0,
  pubT: 0,
  seq: 0,
  out: [],
  seen: 0,
  killsForWave: 0,
  result: null,
  note: '',

  // ---------- лобби ----------
  async open(g) {
    g.state = 'duel';
    this.note = '';
    if (this.lobby) {
      this.phase = 'lobby';
      return;
    }
    this.phase = 'connecting';
    const ok = await Net.init();
    if (!ok) {
      this.phase = 'unavailable';
      return;
    }
    try {
      this.lobby = await Net.channel('lobby');
    } catch (e) {
      this.phase = 'unavailable';
      Net.error = 'Не удалось войти в лобби дуэлей.';
      return;
    }
    this.lobbyState(null);
    if (this.phase === 'connecting') this.phase = 'lobby';
    // первый раз — сразу предлагаем придумать ник, чтобы друг узнал тебя в списке
    if (!this.nickAsked && this.phase === 'lobby') this.editNick();
  },

  lobbyState(host) {
    if (this.lobby) this.lobby.set({ v: 1, name: this.name, host, lvl: this.lvl });
  },

  newNick() {
    this.setNick(randomNick());
  },

  setNick(raw) {
    const nick = cleanNick(raw);
    if (!nick || this.phase !== 'lobby') return false;
    this.name = nick;
    this.nickAsked = true;
    Store.set('kd_nick', nick);
    this.lobbyState(null);
    return true;
  },

  // Окно ввода ника (обычное поле, чтобы на телефоне появилась клавиатура).
  editNick() {
    const box = document.getElementById('nick');
    if (!box || this.phase !== 'lobby') return;
    const form = box.querySelector('form');
    const input = box.querySelector('input');
    this.nickAsked = true;
    input.maxLength = NICK_MAX;
    input.value = this.name;
    box.hidden = false;
    const close = () => {
      box.hidden = true;
      form.onsubmit = null;
      box.onclick = null;
      input.onkeydown = null;
      input.blur();
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      if (this.setNick(input.value)) Sound.coin();
      close();
    };
    box.onclick = (e) => {
      if (e.target === box || e.target.closest('[data-nick=cancel]')) close();
      else if (e.target.closest('[data-nick=random]')) input.value = randomNick();
    };
    input.onkeydown = (e) => {
      if (e.key === 'Escape') close();
    };
    setTimeout(() => {
      input.focus();
      input.select();
    }, 30);
  },

  nickOpen() {
    const box = document.getElementById('nick');
    return !!box && !box.hidden;
  },

  // Сменить MQTT-сервер (если с другом не видите друг друга).
  async switchServer(g) {
    if (this.phase !== 'lobby' || !Net.canSwitch()) return;
    if (this.lobby) this.lobby.leave();
    this.lobby = null;
    Net.nextServer();
    await this.open(g);
  },

  changeLevel(d) {
    if (this.phase !== 'lobby') return;
    this.lvl = (this.lvl + d + LEVELS.length) % LEVELS.length;
    this.lobbyState(null);
  },

  // Открытые дуэли других игроков.
  openDuels() {
    if (!this.lobby) return [];
    return this.lobby
      .peers()
      .filter((p) => !p.me && p.state && p.state.v === 1 && typeof p.state.host === 'string' && /^[a-z0-9]{4}$/.test(p.state.host))
      .slice(0, 5)
      .map((p) => ({ code: p.state.host, name: cleanNick(p.state.name) || 'Игрок', lvl: clamp(Number(p.state.lvl) || 0, 0, LEVELS.length - 1) }));
  },

  async host() {
    if (this.phase !== 'lobby') return;
    const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
    this.code = Array.from({ length: 4 }, () => abc[randi(0, abc.length - 1)]).join('');
    this.role = 'host';
    this.phase = 'hosting';
    try {
      this.room = await Net.channel('kd-duel-' + this.code);
    } catch (e) {
      this.phase = 'lobby';
      this.note = 'Не получилось создать комнату. Попробуй ещё раз.';
      return;
    }
    this.resetMatch();
    this.publish('wait');
    this.lobbyState(this.code);
  },

  async join(code, lvl) {
    if (this.phase !== 'lobby') return;
    this.code = code;
    this.lvl = lvl;
    this.role = 'guest';
    this.phase = 'joining';
    this.joinT = 0;
    try {
      this.room = await Net.channel('kd-duel-' + code);
    } catch (e) {
      this.phase = 'lobby';
      this.note = 'Не получилось войти в комнату.';
      return;
    }
    this.resetMatch();
    this.publish('wait');
  },

  async cancel() {
    await this.leaveRoom();
    this.phase = this.lobby ? 'lobby' : 'off';
    this.lobbyState(null);
  },

  async leaveRoom() {
    const r = this.room;
    this.room = null;
    this.opp = null;
    this.active = false;
    if (r) await r.leave();
  },

  // Полный выход из дуэлей (в главное меню).
  shutdown() {
    this.leaveRoom();
    if (this.lobby) this.lobby.leave();
    this.lobby = null;
    this.phase = 'off';
    this.active = false;
  },

  close(g) {
    this.shutdown();
    g.toTitle();
  },

  async toLobby(g) {
    await this.leaveRoom();
    this.result = null;
    g.duel = false;
    g.state = 'duel';
    this.phase = this.lobby ? 'lobby' : 'off';
    this.lobbyState(null);
  },

  // ---------- матч ----------
  resetMatch() {
    this.opp = null;
    this.oppName = '';
    this.oppSeen = performance.now();
    this.seq = 0;
    this.out = [];
    this.seen = 0;
    this.killsForWave = 0;
    this.result = null;
    this.pubT = 0;
  },

  publish(st, g) {
    if (!this.room) return;
    const s = { v: 1, name: this.name, role: this.role, st, lvl: this.lvl };
    if (g) {
      const p = g.player, tw = g.tower;
      Object.assign(s, {
        hp: Math.max(0, Math.ceil(p.hp)),
        mhp: p.maxHp,
        boss: Math.round(clamp(tw.hp / tw.max, 0, 1) * 100),
        kills: g.kills,
        money: p.money,
        atk: this.out.slice(-6),
      });
    }
    this.room.set(s);
  },

  startCountdown() {
    this.phase = 'countdown';
    this.countT = 3.5;
    this.publish('count');
    this.lobbyState(null);
    Sound.star();
  },

  begin(g) {
    this.active = true;
    this.phase = 'playing';
    this.oppSeen = performance.now();
    g.startDuel(this.lvl);
    this.publish('play', g);
  },

  // Каждый кадр.
  update(dt, g) {
    if (!this.room) return;
    const others = this.room.peers().filter((p) => !p.me && p.state && p.state.v === 1);
    let opp = this.opp ? others.find((p) => p.id === this.opp.id) : null;
    if (!opp && !this.opp && (this.phase === 'hosting' || this.phase === 'joining')) {
      opp = others.find((p) => p.state.role === (this.role === 'host' ? 'guest' : 'host'));
    }
    if (opp) {
      this.opp = opp;
      this.oppName = cleanNick(opp.state.name) || 'Соперник';
      this.oppSeen = performance.now();
    }
    if (this.phase === 'hosting') {
      if (opp) this.startCountdown();
    } else if (this.phase === 'joining') {
      this.joinT += dt;
      if (opp && opp.state.st === 'count') {
        this.lvl = clamp(Number(opp.state.lvl) || 0, 0, LEVELS.length - 1);
        this.startCountdown();
      } else if (this.joinT > 12) {
        this.note = 'Соперник не ответил. Выбери другую дуэль.';
        this.cancel();
      }
    } else if (this.phase === 'countdown') {
      this.countT -= dt;
      if (this.countT <= 0) this.begin(g);
    } else if (this.phase === 'playing') {
      this.tick(dt, g, opp);
    }
  },

  tick(dt, g, opp) {
    this.pubT -= dt;
    if (this.pubT <= 0) {
      this.pubT = 0.25;
      const st = g.state === 'dead' ? 'dead' : g.state === 'win' ? 'win' : 'play';
      this.publish(st, g);
    }
    if (opp) {
      const atk = Array.isArray(opp.state.atk) ? opp.state.atk.filter((a) => a && Number.isFinite(a.i)).sort((a, b) => a.i - b.i) : [];
      for (const a of atk) {
        if (a.i > this.seen && DUEL_ATTACKS[a.k]) {
          this.seen = a.i;
          g.receiveAttack(a.k, this.oppName);
        }
      }
      if (!this.result) {
        if (opp.state.st === 'dead') this.finish(g, true, `${this.oppName} погиб`);
        else if (opp.state.st === 'win') this.finish(g, false, `${this.oppName} первым победил босса`);
      }
    } else if (!this.result && performance.now() - this.oppSeen > 6000) {
      this.finish(g, true, 'Соперник вышел из игры');
    }
    if (!this.result) {
      if (g.state === 'dead') this.finish(g, false, 'Ты погиб');
      else if (g.state === 'win') this.finish(g, true, 'Ты первым победил босса');
    }
  },

  finish(g, win, reason) {
    this.result = { win, reason };
    this.phase = 'over';
    const st = g.state === 'dead' ? 'dead' : g.state === 'win' ? 'win' : 'play';
    this.publish(st, g);
    if (['play', 'pause', 'buy', 'cheats'].includes(g.state)) {
      g.state = 'duelover';
      g.winT = 0;
      if (win) Sound.win();
      else Sound.wasted();
    }
    if (win) Ach.unlock('duel');
  },

  // Отправить «подарок» сопернику.
  send(kind, g) {
    if (!this.active || this.result || !DUEL_ATTACKS[kind]) return;
    this.out.push({ i: ++this.seq, k: kind });
    if (this.out.length > 12) this.out.shift();
    this.pubT = 0;
    if (g) FX.text(g, 640, 560, `Сопернику: ${DUEL_ATTACKS[kind].name}!`, { color: '#ffab91', font: `bold 18px ${FONT.ui}`, life: 1.6 });
  },

  countKill(g) {
    if (!this.active) return;
    if (++this.killsForWave >= 15) {
      this.killsForWave = 0;
      this.send('wave', g);
    }
  },
};
