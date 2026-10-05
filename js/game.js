'use strict';
/* Логика игры: состояние, правила, ввод. Отрисовка — в render.js. */

const HOTBAR = ['steak', 'gapple', 'potion', 'tnt', 'dice', 'ammo', 'ice', 'pellet', 'totem'];

// [время, подсказка для ПК, подсказка для телефона]
const HINTS = [
  [1.5, 'ЛКМ — стрелять из АК-47, R — перезарядка.', 'Касайся доски — стреляешь. Держи палец — очередь.'],
  [6, 'ПКМ — закинуть удочку: открыть клетку сапёра или подобрать предмет.', 'Кнопка 🎣 — режим удочки: открывай клетки сапёра и подбирай предметы.'],
  [11, 'F или Пробел — флажок. Враг, наступивший на флажок с миной, взрывается!', 'Кнопка 🚩 — флажки. Враг, наступивший на флажок с миной, взрывается!'],
  [17, 'Открой все безопасные клетки — оставшиеся мины полетят в башню короля.', 'Открой все безопасные клетки — оставшиеся мины полетят в босса.'],
  [24, 'Лови солнце удочкой. ПКМ по пустой клетке в ряду белых — посадить фигуру (Q — выбор).', 'Лови солнце удочкой. Удочкой по пустой клетке у белых — посадить (карточки справа вверху).'],
  [31, 'Цифры 1–9 — предметы из хотбара. Shift — замедление времени.', 'Касайся предметов в хотбаре внизу. Держи ⏳ — замедление времени.'],
  [40, 'B — меню закупки как в CS: AWP, дробовик, гранаты, кевлар.', 'Кнопка 🛒 — закупка как в CS: AWP, дробовик, гранаты, кевлар.'],
  [48, 'Колесо мыши или X — смена оружия, G — бросить HE-гранату.', '🔁 — смена оружия, 💣 — граната (потом коснись цели).'],
  [56, 'Стреляй по «?»-блокам и уткам — внутри награды!', 'Стреляй по «?»-блокам и уткам — внутри награды!'],
];

// Чит-коды из GTA San Andreas (и один местный).
const CHEATS = {
  HESOYAM: 'здоровье, броня и $250 000',
  AEZAKMI: 'розыск сброшен',
  FULLCLIP: 'бесконечные патроны',
  LXGIWYL: 'набор оружия',
  OSRBLHH: 'розыск +2 звезды',
  SKIBIDI: 'скибиди доп-доп ес-ес',
};

const TILE_LOOT = [['sun', 16], ['steak', 22], ['ammo', 14], ['tnt', 9], ['dice', 11], ['potion', 8], ['gapple', 5], ['ice', 7], ['pellet', 5]];
const DROP_LOOT = [['gapple', 20], ['potion', 15], ['totem', 6], ['ammo', 20], ['tnt', 15], ['pellet', 8], ['ice', 8], ['vest', 18], ['dice', 10], ['steak', 12]];

const LAYOUT = {
  hotbar: { x: 433, y: 674, slot: 46 },
  bank: { x: 950, y: 6, w: 324, h: 82 },
  led: { x: 950, y: 94, w: 324, h: 48 },
};
const hotbarSlotRect = (i) => ({ x: LAYOUT.hotbar.x + i * LAYOUT.hotbar.slot, y: LAYOUT.hotbar.y, w: LAYOUT.hotbar.slot, h: LAYOUT.hotbar.slot });
const packetRect = (i) => ({ x: 1018 + i * 51, y: 12, w: 46, h: 70 });

class Game {
  constructor() {
    this.state = 'title';
    this.best = Number(Store.get('kd_best')) || 0;
    this.unlocked = clamp(Number(Store.get('kd_unlocked')) || 0, 0, LEVELS.length - 1);
    this.levelIdx = 0;
    this.titleT = 0;
    this.introT = 0;
    this.buttons = [];
    this.reset();
  }

  reset() {
    this.resetRun();
    this.resetLevel();
  }

  // То, что переносится между уровнями кампании.
  resetRun() {
    this.player = { hp: CFG.playerHp, maxHp: CFG.playerHp, armor: CFG.startArmor, hunger: 20, boost: 100, xp: 0, level: 0, money: 0, earned: 0, regenT: 0, hungerT: 0, starveT: 0 };
    this.arsenal = {
      ak: { owned: true, mag: CFG.magSize, reserve: CFG.startReserve },
      nova: { owned: false, mag: 0, reserve: 0 },
      awp: { owned: false, mag: 0, reserve: 0 },
    };
    this.weapon = 'ak';
    this.grenades = 1;
    this.infAmmo = false;
    this.cheated = false;
    this.inv = { steak: 3, gapple: 1, potion: 1, tnt: 2, dice: 2, ammo: 1, ice: 1, pellet: 1, totem: 0 };
    this.sel = 0;
    this.kills = 0;
    this.tilesOpened = 0;
    this.ducksShot = 0;
    this.totalFields = 0;
    this.runT = 0;
    this.trapKills = 0;
    this.spent = 0;
    this.plantsPlanted = 0;
    this.ringsGot = 0;
    this.shellKills = 0;
    this.newRecord = false;
  }

  // То, что начинается заново на каждом уровне.
  resetLevel() {
    const L = this.level;
    const p = this.player;
    p.hp = p.maxHp;
    p.hunger = 20;
    p.boost = 100;
    this.t = 0;
    this.clock = L.clock;
    this.nights = 0;
    this.gun = { cd: 0, reload: 0, heat: 0, kick: 0, flash: 0, punch: 0, switchT: 0 };
    this.weaponNameT = 0;
    this.typed = '';
    this.cheatMsg = null;
    this.buyMsg = null;
    this.peas = [];
    this.qblocks = [];
    this.ducks = [];
    this.popups = [];
    this.hazards = [];
    this.shells = [];
    this.rings = [];
    this.qT = 18;
    this.duckT = rand(25, 35);
    this.meetingT = rand(120, 170);
    this.meeting = null;
    this.dogT = 0;
    this.starT = 0;
    this.starOffset = 0;
    this.bloodMoon = false;
    this.fieldBlasts = 0;
    this.pendingThrow = null;
    this.rod = { state: 'idle', t: 0, tx: 0, ty: 0, cd: 0, carry: null };
    this.slotFlash = new Array(9).fill(0);
    this.sun = CFG.startSun;
    this.packet = 'pawn';
    this.def = new Array(COLS).fill(null);
    for (let c = 1; c < COLS; c++) {
      this.def[c] = makeDefender('pawn');
      this.def[c].pop = 1;
    }
    this.enemies = [];
    this.items = [];
    this.airdrops = [];
    this.cannonballs = [];
    this.missiles = [];
    this.tnts = [];
    this.particles = [];
    this.texts = [];
    this.decals = [];
    this.explosions = [];
    this.beams = [];
    this.tracers = [];
    this.cracks = [];
    this.flyers = [];
    this.mf = new Minefield(L.mines);
    this.fieldsCleared = 0;
    this.rebuildT = 0;
    this.tower = makeBoss(L.boss, L.hp);
    this.pac = new PacMan();
    this.bonusStars = L.bonusStars;
    this.stars = 1 + L.bonusStars;
    this.starFlash = 0;
    this.spawnT = 3;
    this.freddyT = 4;
    this.sunT = 4;
    this.dropT = 40;
    this.shake = 0;
    this.hurtFlash = 0;
    this.heartShake = 0;
    this.staticFx = 0;
    this.frostFx = 0;
    this.totemFx = 0;
    this.slowmo = false;
    this.boostLock = false;
    this.boostIdle = 0;
    this.timeScale = 1;
    this.chat = [];
    this.bannerObj = null;
    this.jumpscare = null;
    this.dice = null;
    this.smiley = 'normal';
    this.smileyT = 0;
    this.hintIdx = this.levelIdx === 0 ? 0 : HINTS.length;
    this.deadT = 0;
    this.winT = 0;
    this.deathCause = '';
    this.suppressFire = false;
    this.gunAlpha = 1;
  }

  // ---------- состояния экрана ----------
  get level() {
    return LEVELS[this.levelIdx];
  }
  start() {
    this.startCampaign(0);
  }
  // Новый забег с уровня i. На поздних уровнях даём стартовые деньги на закупку.
  startCampaign(i) {
    Sound.init();
    this.levelIdx = clamp(i, 0, LEVELS.length - 1);
    this.resetRun();
    this.player.money = this.levelIdx * 2500;
    this.resetLevel();
    this.state = 'intro';
    this.introT = 0;
  }
  retry() {
    this.startCampaign(this.levelIdx);
  }
  nextLevel() {
    if (this.levelIdx >= LEVELS.length - 1) return this.toTitle();
    this.levelIdx++;
    this.resetLevel();
    this.state = 'intro';
    this.introT = 0;
  }
  beginLevel() {
    this.state = 'play';
    this.suppressFire = true;
    const L = this.level;
    this.say(`Уровень ${this.levelIdx + 1}: ${L.name}. ${L.tip}`, '#ffd54a');
  }
  pause() {
    if (this.state === 'play') this.state = 'pause';
  }
  resume() {
    if (this.state === 'pause') {
      this.state = 'play';
      this.suppressFire = true;
    }
  }
  toTitle() {
    this.state = 'title';
    this.titleT = 0;
  }
  onBlur() {
    Input.lmb = false;
    Input.rmb = false;
    this.pause();
  }
  endT() {
    return this.state === 'dead' ? this.deadT : this.winT;
  }
  saveBest() {
    if (this.cheated) return;
    if (this.player.earned > this.best) {
      this.best = this.player.earned;
      Store.set('kd_best', this.best);
      this.newRecord = true;
    }
  }

  // ---------- главный цикл ----------
  update(realDt) {
    realDt = Math.min(realDt, 0.05);
    this.processInput();
    Ach.update(realDt);
    if (this.state === 'title' || this.state === 'levels' || this.state === 'achievements') {
      this.titleT += realDt;
      this.pac.mouth += realDt * 10;
      return;
    }
    if (this.state === 'intro') {
      this.introT += realDt;
      if (this.introT > 7) this.beginLevel();
      return;
    }
    if (this.state === 'pause' || this.state === 'buy' || this.state === 'cheats') return;
    if (this.state === 'dead') {
      this.deadT += realDt;
      this.updateFx(realDt * 0.3, realDt);
      return;
    }
    if (this.state === 'win') {
      this.winT += realDt;
      if (Math.random() < 0.15) {
        FX.burst(this, rand(100, 1180), rand(80, 400), 18, { colors: ['#ffd54a', '#ff5252', '#7ee03c', '#40c4ff', '#fff'], size: 6, speed: 260, grav: 150, life: 1.2 });
      }
      this.updateFx(realDt, realDt);
      return;
    }

    // --- игра ---
    this.updateBoost(realDt);
    this.updateGun(realDt);
    this.updateRod(realDt);
    if (this.smileyT > 0) {
      this.smileyT -= realDt;
      if (this.smileyT <= 0) this.smiley = 'normal';
    }
    for (let i = 0; i < 9; i++) if (this.slotFlash[i] > 0) this.slotFlash[i] -= realDt;
    if (this.dice) this.updateDice(realDt);

    if (this.jumpscare) {
      this.jumpscare.t += realDt;
      if (this.jumpscare.t >= 0.95) {
        this.jumpscare = null;
        this.takeDamage(6, 'Золотой Фредди');
        this.say("<Золотой Фредди> IT'S ME", '#ffd54a');
      }
      this.updateFx(realDt * 0.2, realDt);
      return;
    }
    if (this.meeting) {
      this.updateMeeting(realDt);
      this.updateFx(realDt * 0.2, realDt);
      return;
    }

    const dt = realDt * this.timeScale;
    this.t += dt;
    this.runT += dt;
    if (this.starT > 0) this.starT -= dt;
    while (this.hintIdx < HINTS.length && this.t >= HINTS[this.hintIdx][0]) {
      this.say('[Подсказка] ' + HINTS[this.hintIdx][Input.touch ? 2 : 1], '#9be7ff');
      this.hintIdx++;
    }
    this.updateClock(dt);
    this.updatePlayer(dt);
    this.updateDirector(dt);
    this.updateTower(dt);
    this.mf.update(dt);
    if (this.rebuildT > 0) {
      this.rebuildT -= dt;
      if (this.rebuildT <= 0) {
        const mines = Math.min(CFG.maxMines, this.level.mines + this.fieldsCleared);
        this.mf.rebuild(mines);
        this.fieldBlasts = 0;
        this.say(`Новое поле сапёра: ${mines} мин. Король нервничает.`, '#e0e0e0');
      }
    }

    for (const e of this.enemies) e.update(dt, this);
    if (this.pac.state === 'parked') {
      const close = this.enemies.find((e) => e.alive && e.type !== 'freddy' && e.y >= PAWN_ROW * T - 26);
      if (close && this.pac.launch(PAWN_ROW, false)) this.say('Пак-Ман выкатился на защиту последнего ряда!', '#ffe600');
    }
    this.pac.update(dt, this);
    this.updateDefenders(dt);
    for (const it of this.items) it.update(dt);
    for (const a of this.airdrops) a.update(dt, this);
    this.updateCannonballs(dt);
    this.updateMissiles(dt);
    this.updateTNT(dt);
    this.updatePeas(dt);
    this.updateHazards(dt);
    this.updateRings(dt);
    for (const sh of this.shells) sh.update(dt, this);
    this.shells = this.shells.filter((sh) => !sh.gone);
    for (const q of this.qblocks) q.update(dt);
    for (const d of this.ducks) d.update(dt, this);
    this.updateFx(dt, realDt);
    this.qblocks = this.qblocks.filter((q) => !q.gone);
    this.ducks = this.ducks.filter((d) => !d.gone);

    this.enemies = this.enemies.filter((e) => !e.remove);
    this.items = this.items.filter((i) => !i.gone);
    this.airdrops = this.airdrops.filter((a) => !a.gone);
    this.cannonballs = this.cannonballs.filter((c) => !c.gone);
    this.missiles = this.missiles.filter((m) => !m.gone);
    this.tnts = this.tnts.filter((t) => !t.gone);
  }

  updateFx(dt, realDt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const tx of this.texts) {
      tx.life -= realDt;
      tx.y += tx.vy * realDt;
    }
    this.texts = this.texts.filter((tx) => tx.life > 0);
    for (const d of this.decals) d.life -= dt;
    this.decals = this.decals.filter((d) => d.life > 0);
    for (const ex of this.explosions) ex.t += dt;
    this.explosions = this.explosions.filter((ex) => ex.t < 0.55);
    for (const b of this.beams) b.t += dt;
    this.beams = this.beams.filter((b) => b.t < 0.22);
    for (const tr of this.tracers) tr.t += realDt;
    this.tracers = this.tracers.filter((tr) => tr.t < 0.07);
    for (const c of this.cracks) c.t += realDt;
    this.cracks = this.cracks.filter((c) => c.t < 2.6);
    for (const f of this.flyers) f.t += realDt * 2.2;
    this.flyers = this.flyers.filter((f) => f.t < 1);
    for (const m of this.chat) m.t += realDt;
    this.chat = this.chat.filter((m) => m.t < 8);
    if (this.bannerObj) {
      this.bannerObj.t += realDt;
      if (this.bannerObj.t > this.bannerObj.dur) this.bannerObj = null;
    }
    this.shake = Math.max(0, this.shake - realDt * 40);
    this.hurtFlash = Math.max(0, this.hurtFlash - realDt);
    this.heartShake = Math.max(0, this.heartShake - realDt);
    this.staticFx = Math.max(0, this.staticFx - realDt);
    this.frostFx = Math.max(0, this.frostFx - realDt * 0.6);
    this.totemFx = Math.max(0, this.totemFx - realDt);
    this.starFlash = Math.max(0, this.starFlash - realDt);
    for (const p of this.popups) p.t += realDt;
    this.popups = this.popups.filter((p) => p.t < 1.2);
    if (this.dogT > 0) this.dogT -= realDt;
    if (this.cheatMsg) {
      this.cheatMsg.t += realDt;
      if (this.cheatMsg.t > 4) this.cheatMsg = null;
    }
    const tw = this.tower;
    if (tw.hit > 0) tw.hit -= realDt;
  }

  // ---------- ввод ----------
  processInput() {
    const q = Input.queue;
    Input.queue = [];
    for (const ev of q) {
      if (ev.type === 'key') this.onKey(ev.code);
      else if (ev.type === 'down') this.onMouseDown(ev.button, ev.x, ev.y);
      else if (ev.type === 'up' && ev.button === 0) this.suppressFire = false;
      else if (ev.type === 'wheel' && this.state === 'play') this.switchWeapon(ev.dy);
    }
  }

  onKey(code) {
    // чит-коды проверяются первыми, иначе буква M в HESOYAM выключила бы звук
    if (this.state === 'play' && !this.jumpscare && !this.meeting && this.handleCheatKey(code)) return;
    if (code === 'KeyM') {
      Sound.toggleMute();
      this.say(Sound.muted ? 'Звук выключен (M)' : 'Звук включён (M)', '#e0e0e0');
      return;
    }
    if (this.state === 'title') {
      if (code === 'Enter' || code === 'Space') this.start();
      return;
    }
    if (this.state === 'levels' || this.state === 'achievements') {
      if (code === 'Escape' || code === 'Backspace') this.toTitle();
      return;
    }
    if (this.state === 'intro') {
      if (code === 'Enter' || code === 'Space' || code === 'Escape') this.beginLevel();
      return;
    }
    if (this.state === 'cheats') {
      if (code === 'Escape' || code === 'Backspace') this.state = 'pause';
      return;
    }
    if (this.state === 'pause') {
      if (code === 'Escape' || code === 'KeyP' || code === 'Enter') this.resume();
      else if (code === 'KeyN') this.retry();
      return;
    }
    if (this.state === 'dead' || this.state === 'win') {
      if ((code === 'Enter' || code === 'Space') && this.endT() > 1.5) {
        if (this.state === 'dead') this.retry();
        else this.nextLevel();
      }
      else if (code === 'Escape') this.toTitle();
      return;
    }
    if (this.state === 'buy') {
      if (code === 'KeyB' || code === 'Escape') this.closeBuy();
      else {
        const m = /^(Digit|Numpad)([1-9])$/.exec(code);
        if (m) this.buy(Number(m[2]) - 1);
      }
      return;
    }
    if (code === 'Escape' || code === 'KeyP') {
      this.pause();
      return;
    }
    if (this.jumpscare || this.meeting) return;
    if (code === 'KeyR') this.reload();
    else if (code === 'KeyB') this.openBuy();
    else if (code === 'KeyG') this.throwGrenade();
    else if (code === 'KeyX') this.switchWeapon(1);
    else if (code === 'KeyF' || code === 'Space') this.flagAt(Input.x, Input.y);
    else if (code === 'KeyQ') this.cyclePacket();
    else if (code === 'KeyE') this.useItem(this.sel);
    else {
      const m = /^(Digit|Numpad)([1-9])$/.exec(code);
      if (m) this.useItem(Number(m[2]) - 1);
    }
  }

  onMouseDown(btn, x, y) {
    if (this.state !== 'play') {
      if (btn === 0) this.clickButtons(x, y);
      return;
    }
    if (this.jumpscare || this.meeting) return;
    if (btn === 0) {
      if (this.uiClick(x, y)) {
        this.suppressFire = true;
        return;
      }
      if (this.pendingThrow) {
        this.throwAt(this.pendingThrow, x, y);
        this.pendingThrow = null;
        this.suppressFire = true;
        return;
      }
      this.suppressFire = false;
      this.tryFire();
    } else if (btn === 2) {
      this.castRod(x, y);
    } else if (btn === 1) {
      this.flagAt(x, y);
    }
  }

  // Касание попало в интерфейс (хотбар или карточки растений)?
  isUiPoint(x, y) {
    for (let i = 0; i < 9; i++) if (inRect(x, y, hotbarSlotRect(i))) return true;
    for (let i = 0; i < PACKETS.length; i++) if (inRect(x, y, packetRect(i))) return true;
    return false;
  }

  // На телефоне гранату и динамит бросают в два касания: кнопка, потом цель.
  armThrow(kind) {
    if (this.state !== 'play') return;
    if (this.pendingThrow === kind) {
      this.pendingThrow = null;
      return;
    }
    if (kind === 'he' && this.grenades <= 0) {
      FX.text(this, 640, 600, 'Нет гранат — купи в закупке', { color: '#ffd54a', font: `bold 18px ${FONT.ui}` });
      Sound.empty();
      return;
    }
    if (kind === 'tnt' && !this.inv.tnt) return;
    this.pendingThrow = kind;
    Sound.click();
  }

  throwAt(kind, x, y) {
    if (kind === 'he') {
      if (this.grenades <= 0) return;
      this.grenades--;
      this.tnts.push({ kind: 'he', x0: 640, y0: 760, x1: x, y1: y, t: 0, dur: 0.5, fuse: 0.5, state: 'fly', gone: false });
      this.say('<Ты> Fire in the hole!', '#ffcc80');
    } else {
      if (!this.inv.tnt) return;
      this.inv.tnt--;
      this.tnts.push({ x0: 640, y0: 760, x1: x, y1: y, t: 0, dur: 0.45, fuse: 0.7, state: 'fly', gone: false });
    }
    Sound.whoosh();
  }

  uiClick(x, y) {
    for (let i = 0; i < 9; i++) {
      if (inRect(x, y, hotbarSlotRect(i))) {
        this.useItem(i);
        return true;
      }
    }
    for (let i = 0; i < PACKETS.length; i++) {
      if (inRect(x, y, packetRect(i))) {
        this.packet = PACKETS[i];
        Sound.click();
        return true;
      }
    }
    return false;
  }

  clickButtons(x, y) {
    for (const b of this.buttons) {
      if (inRect(x, y, b)) {
        Sound.click();
        b.action();
        return;
      }
    }
    if (this.state === 'title') this.start();
    else if (this.state === 'intro') this.beginLevel();
  }

  cyclePacket() {
    const i = PACKETS.indexOf(this.packet);
    this.packet = PACKETS[(i + 1) % PACKETS.length];
    Sound.click();
    const s = DEF_STATS[this.packet];
    this.say(`Посадка: ${s.name} (${s.cost} ☀) — ${s.info}`, '#ffe082');
  }

  // ---------- АК-47 ----------
  get fireRate() {
    return 1 + Math.min(0.6, this.player.level * 0.03);
  }

  get cur() {
    return this.arsenal[this.weapon];
  }
  get wdef() {
    return WEAPONS[this.weapon];
  }

  updateGun(dt) {
    const gun = this.gun, wd = this.wdef, a = this.cur;
    gun.cd = Math.max(0, gun.cd - dt);
    gun.flash = Math.max(0, gun.flash - dt);
    gun.kick = Math.max(0, gun.kick - dt * 8);
    gun.punch = Math.max(0, gun.punch - dt);
    gun.switchT = Math.max(0, gun.switchT - dt);
    gun.heat = Math.max(0, gun.heat - dt * (Input.lmb ? 0.7 : 2.4));
    if (this.weaponNameT > 0) this.weaponNameT -= dt;
    if (gun.reload > 0) {
      gun.reload -= dt;
      if (gun.reload <= 0) {
        const take = Math.min(wd.mag - a.mag, a.reserve);
        a.mag += take;
        a.reserve -= take;
        gun.reload = 0;
      }
    }
    if (Input.lmb && !this.suppressFire && !this.jumpscare && !this.meeting) this.tryFire();
    // оружие становится прозрачным, если прицел под ним
    const under = Input.x > 900 && Input.y > 430;
    this.gunAlpha = lerp(this.gunAlpha, under ? 0.3 : 1, Math.min(1, dt * 10));
  }

  reload() {
    const gun = this.gun, a = this.cur;
    if (this.infAmmo || gun.reload > 0 || a.mag >= this.wdef.mag || a.reserve <= 0) return;
    gun.reload = this.wdef.reload;
    Sound.reload();
  }

  setWeapon(key) {
    if (!this.arsenal[key].owned || key === this.weapon) return;
    this.weapon = key;
    this.gun.reload = 0;
    this.gun.switchT = 0.35;
    this.gun.heat = 0;
    this.weaponNameT = 1.5;
    Sound.weapon();
  }

  switchWeapon(dir) {
    const owned = WEAPON_ORDER.filter((k) => this.arsenal[k].owned);
    if (owned.length < 2) {
      if (this.weaponNameT <= 0) {
        FX.text(this, 1100, 600, Input.touch ? 'Купи оружие в закупке 🛒' : 'Купи оружие в меню B', { color: '#ffd54a', font: `bold 15px ${FONT.ui}` });
        this.weaponNameT = 1.2;
      }
      return;
    }
    const i = owned.indexOf(this.weapon);
    this.setWeapon(owned[(i + dir + owned.length * 2) % owned.length]);
  }

  tryFire() {
    const gun = this.gun, wd = this.wdef, a = this.cur;
    if (gun.reload > 0 || gun.cd > 0 || gun.switchT > 0) return;
    if (a.mag <= 0 && !this.infAmmo) {
      if (a.reserve > 0) this.reload();
      else if (this.weapon !== 'ak' && this.arsenal.ak.mag + this.arsenal.ak.reserve > 0) this.setWeapon('ak');
      else this.punch();
      return;
    }
    if (!this.infAmmo) a.mag--;
    gun.cd = wd.interval / (this.weapon === 'ak' ? this.fireRate : 1);
    if (!wd.auto) this.suppressFire = true;
    gun.kick = 1;
    gun.flash = 0.05;
    this.shake = Math.max(this.shake, wd.shake);
    if (this.weapon === 'awp') Sound.awp();
    else if (this.weapon === 'nova') Sound.shotgun();
    else Sound.shot();
    const pose = this.gunPose();
    const dmg = wd.dmg * (this.starT > 0 ? 2 : 1);
    const spread = wd.spread + gun.heat * wd.heatSpread;
    for (let i = 0; i < wd.pellets; i++) {
      const ang = rand(0, TAU), d = Math.sqrt(Math.random()) * spread;
      const hx = Input.x + Math.cos(ang) * d, hy = Input.y + Math.sin(ang) * d;
      if (i < 4) this.tracers.push({ x1: pose.mx, y1: pose.my, x2: hx, y2: hy, t: 0, w: wd.pierce ? 5 : 2 });
      this.hitAt(hx, hy, dmg, wd.pierce);
    }
    gun.heat = Math.min(1, gun.heat + wd.heatAdd);
    FX.burst(this, pose.ex, pose.ey, 1, { colors: [this.weapon === 'nova' ? '#c62828' : '#d4a017'], size: 5, speed: 260, angle: pose.rot - Math.PI / 2 + 0.6, spread: 0.3, grav: 900, life: 0.6 });
    if (a.mag === 0 && a.reserve > 0 && !this.infAmmo) this.reload();
  }

  punch() {
    const gun = this.gun;
    if (gun.punch > 0) return;
    gun.punch = 0.4;
    gun.cd = 0.4;
    Sound.punch();
    let best = null;
    for (const e of this.enemies) if (e.alive && e.distTo(Input.x, Input.y) < 50 && (!best || e.y > best.y)) best = e;
    if (best) {
      best.damage(this.starT > 0 ? 3 : 1, this, 'fist');
      FX.text(this, Input.x, Input.y - 30, 'БАЦ!', { color: '#fff', font: `bold 22px ${FONT.gta}` });
    } else if (Math.random() < 0.3) {
      FX.text(this, Input.x, Input.y - 30, 'Нет патронов — бей кулаком или купи (B)!', { color: '#ffd54a', font: `bold 14px ${FONT.ui}` });
    }
  }

  // Положение оружия в кадре (общая функция для логики и отрисовки).
  gunPose() {
    const gun = this.gun, wd = this.wdef;
    let px = 1178, py = 655;
    let dir = Math.atan2(Input.y - py, Input.x - px);
    if (dir > 0) dir -= TAU;
    dir = clamp(dir, -3.5, -1.7);
    const base = -2.6;
    let rot = base + (dir - base) * 0.65 + Math.PI;
    const s = wd.scale;
    if (gun.reload > 0) {
      const p = 1 - gun.reload / wd.reload;
      const k = Math.sin(p * Math.PI);
      rot += k * 0.55;
      py += k * 120;
    }
    if (gun.switchT > 0) py += (gun.switchT / 0.35) * 200;
    rot -= gun.kick * (this.weapon === 'ak' ? 0.05 : 0.14);
    px += Math.cos(rot) * gun.kick * wd.kick;
    py += Math.sin(rot) * gun.kick * wd.kick;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const lx = wd.muzzle.x * s, ly = wd.muzzle.y * s;
    const ex = -60 * s, ey = -26 * s;
    return { px, py, rot, s, mx: px + lx * cr - ly * sr, my: py + lx * sr + ly * cr, ex: px + ex * cr - ey * sr, ey: py + ex * sr + ey * cr };
  }

  hitFx(e, x, y) {
    const colors = {
      zombie: ['#7fa35c', '#4e6b2f'],
      cone: ['#7fa35c', '#f08a24'],
      freddy: ['#ffd54a', '#c9a92c'],
      snake: ['#4a7cf0', '#9bb8ff'],
      creeper: ['#5cb84a', '#86d672'],
      skibidi: ['#ffffff', '#9fd4ff'],
      mega: ['#c0c4cf', '#7b4fb0'],
    }[e.type] || ['#222', '#555', '#8a8a8a'];
    FX.burst(this, x, y, 5, { colors, size: 5, speed: 200, grav: 600, life: 0.4 });
    Sound.hit();
  }

  // pierce — пуля AWP: задевает всё, что оказалось в точке попадания.
  hitAt(x, y, dmg, pierce = false) {
    let any = false;
    for (const cb of this.cannonballs) {
      if (!cb.gone && cb.hit(x, y)) {
        cb.gone = true;
        const p = cb.pos;
        FX.burst(this, p.x, p.y, 16, { colors: ['#ffcc80', '#fff', '#555'], size: 6, speed: 300, grav: 300 });
        FX.text(this, p.x, p.y - 30, 'СБИТО!', { color: '#ffd54a', font: `bold 22px ${FONT.gta}` });
        this.addMoney(25);
        Sound.stone();
        if (!pierce) return;
        any = true;
      }
    }
    for (const d of this.ducks) {
      if (d.hit(x, y)) {
        this.shootDuck(d);
        if (!pierce) return;
        any = true;
      }
    }
    for (const q of this.qblocks) {
      if (q.hit(x, y)) {
        this.hitQBlock(q);
        if (!pierce) return;
        any = true;
      }
    }
    if (!this.tower.dead && this.tower.hitSpecial(x, y, this)) return;
    if (pierce) {
      let killed = 0;
      for (const e of this.enemies) {
        if (e.alive && e.hit(x, y)) {
          e.damage(dmg, this, 'gun');
          this.hitFx(e, x, y);
          if (!e.alive) killed++;
          any = true;
        }
      }
      if (killed >= 2) Ach.unlock('sniper');
    } else {
      let best = null;
      for (const e of this.enemies) if (e.alive && e.hit(x, y) && (!best || e.y > best.y)) best = e;
      if (best) {
        best.damage(dmg, this, 'gun');
        this.hitFx(best, x, y);
        return;
      }
    }
    if (!this.tower.dead && inRect(x, y, this.tower.box)) {
      // башня бронированная: одна пуля снимает не больше 3 HP
      this.damageTower(Math.min(dmg, 3), false);
      FX.burst(this, x, y, 4, { colors: ['#9a9dab', '#6f7282', '#ddd'], size: 5, speed: 180, grav: 600, life: 0.4 });
      Sound.stone();
      return;
    }
    if (any) return;
    this.decals.push({ x, y, life: 4 });
    if (this.decals.length > 60) this.decals.shift();
    FX.burst(this, x, y, 2, { colors: ['rgba(120,100,70,0.8)'], size: 4, speed: 80, grav: 300, life: 0.3 });
  }

  throwGrenade() {
    if (this.grenades <= 0) {
      FX.text(this, Input.x, Input.y - 30, 'Нет гранат — купи в меню B', { color: '#ffd54a', font: `bold 15px ${FONT.ui}` });
      Sound.empty();
      return;
    }
    this.grenades--;
    this.tnts.push({ kind: 'he', x0: 640, y0: 760, x1: Input.x, y1: Input.y, t: 0, dur: 0.5, fuse: 0.5, state: 'fly', gone: false });
    Sound.whoosh();
    this.say('<Ты> Fire in the hole!', '#ffcc80');
  }

  // ---------- меню закупки CS ----------
  openBuy() {
    this.state = 'buy';
    this.buyMsg = null;
    Input.lmb = false;
    Sound.weapon();
  }
  closeBuy() {
    if (this.state !== 'buy') return;
    this.state = 'play';
    this.suppressFire = true;
  }
  buy(i) {
    const it = BUY_ITEMS[i];
    if (!it) return;
    const p = this.player;
    const fail = (msg) => {
      this.buyMsg = { text: msg, bad: true };
      Sound.empty();
    };
    if (p.money < it.price) return fail(`Не хватает денег: нужно $${it.price}`);
    switch (it.key) {
      case 'awp':
      case 'nova': {
        const a = this.arsenal[it.key];
        if (a.owned) return fail(`${it.name} уже есть. Патроны — пункт 5`);
        a.owned = true;
        a.mag = WEAPONS[it.key].mag;
        a.reserve = WEAPONS[it.key].refill * 2;
        this.setWeapon(it.key);
        break;
      }
      case 'he':
        if (this.grenades >= 5) return fail('Больше 5 гранат не унести');
        this.grenades++;
        break;
      case 'kevlar':
        if (p.armor >= 100) return fail('Броня и так полная');
        p.armor = 100;
        break;
      case 'ammo': {
        const a = this.cur, wd = this.wdef;
        if (a.reserve >= wd.reserveMax) return fail(`Запас ${wd.name} и так полный`);
        a.reserve = Math.min(wd.reserveMax, a.reserve + wd.refill);
        break;
      }
      case 'detector':
        if (!this.useDetector()) return fail('Сначала открой поле сапёра');
        break;
    }
    p.money -= it.price;
    this.spent += it.price;
    if (this.spent >= 10000) Ach.unlock('shopper');
    Sound.buy();
    this.buyMsg = { text: `Куплено: ${it.name}`, bad: false };
  }

  useDetector() {
    const mf = this.mf;
    if (!mf.generated || mf.done) return false;
    const cand = [];
    for (let r = 0; r < MF.rows; r++) {
      for (let c = 0; c < MF.cols; c++) {
        const cell = mf.cell(c, r);
        if (!cell.mine || cell.s !== HIDDEN) continue;
        cand.push({ c, r, near: mf.neighbors(c, r).some(([nc, nr]) => mf.cell(nc, nr).s === OPEN) });
      }
    }
    if (!cand.length) return false;
    const near = cand.filter((x) => x.near);
    const pick = choice(near.length ? near : cand);
    mf.cell(pick.c, pick.r).s = FLAG;
    const p = mf.center(pick.c, pick.r);
    FX.burst(this, p.x, p.y, 14, { colors: ['#40c4ff', '#fff'], size: 5, speed: 160, life: 0.6 });
    this.say('Миноискатель нашёл мину и поставил флажок.', '#40c4ff');
    return true;
  }

  // ---------- удочка ----------
  castRod(x, y) {
    const rod = this.rod;
    if (rod.state !== 'idle' || rod.cd > 0) return;
    rod.state = 'out';
    rod.t = 0;
    rod.tx = x;
    rod.ty = y;
    Sound.cast();
    if (this.smiley === 'normal') {
      this.smiley = 'o';
      this.smileyT = 0.35;
    }
  }

  updateRod(dt) {
    const rod = this.rod;
    rod.cd = Math.max(0, rod.cd - dt);
    if (rod.state === 'out') {
      rod.t += dt / 0.13;
      if (rod.t >= 1) {
        rod.t = 0;
        rod.state = 'back';
        rod.carry = this.resolveRod(rod.tx, rod.ty);
      }
    } else if (rod.state === 'back') {
      rod.t += dt / 0.22;
      if (rod.t >= 1) {
        rod.state = 'idle';
        rod.cd = 0.08;
        rod.carry = null;
      }
    }
  }

  rodTip() {
    return { x: 318, y: 352 };
  }

  resolveRod(x, y) {
    for (const a of this.airdrops) {
      if (!a.gone && a.hit(x, y)) {
        this.openAirdrop(a);
        return 'crate';
      }
    }
    let best = null, bd = 42 * 42;
    for (const it of this.items) {
      if (it.gone) continue;
      const d = dist2(x, y, it.x, it.y);
      if (d < bd) {
        bd = d;
        best = it;
      }
    }
    if (best) {
      best.gone = true;
      if (best.kind === 'sun') {
        this.sun += CFG.sunValue;
        Sound.sun();
        FX.text(this, best.x, best.y - 26, `+${CFG.sunValue} ☀`, { color: '#ffe066', font: `bold 20px ${FONT.ui}` });
        return 'sun';
      }
      this.giveItem(best.key, 1, best.x, best.y);
      return best.key;
    }
    const m = this.mf.at(x, y);
    if (m && m.cell.pop >= 1) {
      if (this.mf.done) {
        FX.text(this, x, y - 30, 'Поле перестраивается...', { color: '#e0e0e0', font: `bold 14px ${FONT.ui}` });
        return null;
      }
      if (m.cell.s === HIDDEN) this.openCell(m.c, m.r);
      else if (m.cell.s === OPEN) this.chordCell(m.c, m.r);
      else if (m.cell.s === FLAG) {
        FX.text(this, x, y - 30, Input.touch ? 'Тут флажок. Сними в режиме 🚩' : 'Тут флажок. Снять — F', { color: '#ffcdd2', font: `bold 14px ${FONT.ui}` });
        Sound.empty();
      }
      return null;
    }
    const c = toCol(x), r = toRow(y);
    if (r === PAWN_ROW && c >= 1 && c < COLS) {
      if (!this.def[c]) this.plant(c);
      else FX.text(this, colX(c), rowY(PAWN_ROW) - 46, 'Клетка занята', { color: '#e0e0e0', font: `bold 14px ${FONT.ui}` });
      return null;
    }
    Sound.splash();
    FX.burst(this, x, y, 6, { colors: ['#81d4fa', '#e1f5fe'], size: 4, speed: 120, grav: 500, up: 80, life: 0.4 });
    return null;
  }

  // ---------- сапёр ----------
  flagAt(x, y) {
    const m = this.mf.at(x, y);
    if (!m || m.cell.pop < 1 || this.mf.done) return;
    const s = this.mf.toggleFlag(m.c, m.r);
    if (s === FLAG) {
      Sound.flag();
      const p = this.mf.center(m.c, m.r);
      FX.burst(this, p.x, p.y - 10, 5, { colors: ['#e01b1b', '#fff'], size: 4, speed: 120, up: 60, life: 0.4 });
    } else if (s === HIDDEN) Sound.unflag();
  }

  openCell(c, r) {
    const res = this.mf.open(c, r);
    if (res.mine) this.mineBlast(res.mine.c, res.mine.r, true);
    this.rewardTiles(res.opened);
    this.checkCleared();
  }

  chordCell(c, r) {
    const res = this.mf.chord(c, r);
    if (!res.opened.length && !res.mines.length) {
      Sound.click();
      return;
    }
    for (const m of res.mines) this.mineBlast(m.c, m.r, true);
    this.rewardTiles(res.opened);
    this.checkCleared();
  }

  rewardTiles(list) {
    if (!list.length) return;
    const n = list.length;
    this.tilesOpened += n;
    this.player.money += 10 * n;
    this.player.earned += 10 * n;
    const ak = this.arsenal.ak;
    const ammo = Math.min(WEAPONS.ak.reserveMax - ak.reserve, CFG.ammoPerTile * n);
    ak.reserve += Math.max(0, ammo);
    this.addXp(n * 0.5);
    Sound.reveal(n);
    let drops = 0;
    for (const { c, r } of list) {
      const p = this.mf.center(c, r);
      if (n < 25) FX.burst(this, p.x, p.y, 3, { colors: ['#c3c3c3', '#fff', '#7b7b7b'], size: 6, speed: 150, up: 100, life: 0.45 });
      if (drops < 2 && Math.random() < 0.07) {
        drops++;
        const key = weighted(TILE_LOOT);
        if (key === 'sun') this.items.push(new Loot('sun', null, p.x, p.y - 30, p.y, 120));
        else this.items.push(new Loot('item', key, p.x, p.y - 30, p.y, 120));
      }
    }
    const p0 = this.mf.center(list[0].c, list[0].r);
    FX.text(this, p0.x, p0.y - 30, `+$${10 * n}` + (ammo > 0 ? `  +${ammo} пт.` : ''), { color: '#a5f07a', font: `bold 17px ${FONT.ui}` });
  }

  checkCleared() {
    if (this.mf.done || !this.mf.isCleared()) return;
    this.mf.done = true;
    const live = this.mf.liveMines();
    this.fieldsCleared++;
    this.totalFields++;
    Ach.unlock('sapper');
    if (this.fieldBlasts === 0) Ach.unlock('sapperPro');
    this.addMoney(1000, 640, 330);
    this.smiley = 'cool';
    this.smileyT = 3.5;
    this.banner('САПЁР ПРОЙДЕН!', live.length ? `${live.length} мин летят в башню короля!` : 'Все мины уже взорваны ловушками', '#7ee03c');
    live.forEach((m, i) => {
      const cell = this.mf.cell(m.c, m.r);
      cell.s = FLAG;
      const p = this.mf.center(m.c, m.r);
      const bc = this.tower.center;
      this.missiles.push({ c: m.c, r: m.r, x0: p.x, y0: p.y, x1: bc.x, y1: bc.y, toBoss: true, ox: rand(-60, 60), oy: rand(-25, 25), t: -0.6 - i * 0.18, dur: 0.85, dmg: CFG.mineMissileDamage, launched: false, x: p.x, y: p.y });
    });
    this.rebuildT = 2.4 + live.length * 0.18;
  }

  mineBlast(c, r, byPlayer) {
    this.mf.detonate(c, r);
    const p = this.mf.center(c, r);
    this.explode(p.x, p.y, T * 1.45, CFG.trapDamage, 'mine');
    if (byPlayer) {
      this.smiley = 'dead';
      this.smileyT = 1.5;
      this.fieldBlasts++;
      this.say('Ты подцепил мину удочкой. Бабах!', '#ff8a80');
      this.takeDamage(CFG.mineDamageToPlayer, 'мина');
    }
  }

  // Флажок, поставленный на настоящую мину, превращается в ловушку.
  checkTrapAt(x, y, enemy) {
    if (enemy && enemy.type === 'freddy') return;
    const m = this.mf.at(x, y);
    if (!m || m.cell.s !== FLAG || !m.cell.mine || m.cell.pop < 1 || this.mf.done) return;
    this.mf.detonate(m.c, m.r);
    const p = this.mf.center(m.c, m.r);
    this.explode(p.x, p.y, T * 1.45, CFG.trapDamage, 'trap');
    FX.text(this, p.x, p.y - 50, 'ЛОВУШКА!', { color: '#ffd54a', font: `24px ${FONT.title}` });
    this.trapKills++;
    if (this.trapKills >= 5) Ach.unlock('traps');
    this.addMoney(50);
  }

  explode(x, y, radius, dmg, src) {
    this.explosions.push({ x, y, r: radius, t: 0 });
    FX.burst(this, x, y, 26, { colors: ['#ffef8a', '#ffb300', '#ff6d00', '#5d4037'], size: 10, speed: 380, grav: 200, life: 0.7 });
    FX.burst(this, x, y, 10, { colors: ['rgba(60,60,60,0.6)', 'rgba(90,90,90,0.5)'], size: 26, speed: 90, grav: -40, life: 1.4, shape: 'circle' });
    Sound.explosion(radius > 120);
    this.shake = Math.max(this.shake, 9);
    for (const e of this.enemies) if (e.alive && e.distTo(x, y) <= radius) e.damage(dmg, this, src);
  }

  // ---------- предметы ----------
  giveItem(key, n = 1, fx, fy) {
    let tx, ty;
    if (key === 'vest') {
      this.player.armor = Math.min(100, this.player.armor + 50);
      tx = 320;
      ty = 690;
    } else {
      this.inv[key] = (this.inv[key] || 0) + n;
      const i = HOTBAR.indexOf(key);
      const r = hotbarSlotRect(i);
      tx = r.x + r.w / 2;
      ty = r.y + r.h / 2;
      this.slotFlash[i] = 0.6;
    }
    Sound.pickup();
    if (fx !== undefined) this.flyers.push({ key, x0: fx, y0: fy, x1: tx, y1: ty, t: 0 });
    FX.text(this, tx, ty - 40, `+${n} ${ITEM_INFO[key].name}`, { color: '#fff', font: `bold 15px ${FONT.ui}`, life: 1.4, vy: -30 });
  }

  useItem(i) {
    if (this.state !== 'play') return;
    this.sel = i;
    const key = HOTBAR[i];
    const p = this.player;
    if (!this.inv[key]) {
      Sound.empty();
      FX.text(this, hotbarSlotRect(i).x + 23, 655, 'пусто', { color: '#bbb', font: `bold 14px ${FONT.ui}`, life: 0.8 });
      return;
    }
    let used = true;
    switch (key) {
      case 'steak':
        if (p.hunger >= 20) {
          FX.text(this, 640, 640, 'Ты не голоден', { color: '#ffe0b2', font: `bold 15px ${FONT.ui}` });
          used = false;
          break;
        }
        p.hunger = Math.min(20, p.hunger + 8);
        this.heal(1);
        Sound.eat();
        break;
      case 'gapple':
        this.heal(6);
        p.hunger = Math.min(20, p.hunger + 4);
        p.armor = Math.min(100, p.armor + 20);
        Sound.eat();
        FX.burst(this, 640, 600, 20, { colors: ['#ffd54a', '#fff6a8'], size: 5, speed: 200, grav: -50, life: 0.9 });
        break;
      case 'potion':
        if (p.hp >= p.maxHp) {
          FX.text(this, 640, 640, 'Здоровье и так полное', { color: '#f8bbd0', font: `bold 15px ${FONT.ui}` });
          used = false;
          break;
        }
        this.heal(10);
        Sound.drink();
        break;
      case 'tnt':
        if (Input.touch) {
          this.armThrow('tnt');
          used = false;
          break;
        }
        this.tnts.push({ x0: 640, y0: 760, x1: Input.x, y1: Input.y, t: 0, dur: 0.45, fuse: 0.7, state: 'fly', gone: false });
        Sound.whoosh();
        break;
      case 'dice':
        if (this.dice) {
          used = false;
          break;
        }
        this.rollDice();
        break;
      case 'ammo':
        if (this.arsenal.ak.reserve >= WEAPONS.ak.reserveMax) {
          FX.text(this, 640, 640, 'Патронов к АК и так полно', { color: '#ffe0b2', font: `bold 15px ${FONT.ui}` });
          used = false;
          break;
        }
        this.arsenal.ak.reserve = Math.min(WEAPONS.ak.reserveMax, this.arsenal.ak.reserve + 90);
        Sound.reload();
        break;
      case 'ice':
        this.freezeAll(5);
        break;
      case 'pellet':
        used = this.pacPower();
        break;
      case 'totem':
        this.say('Тотем сработает сам, когда тебя попытаются убить.', '#f2c230');
        used = false;
        break;
    }
    if (used) {
      this.inv[key]--;
      this.slotFlash[i] = 0.4;
    }
  }

  heal(n) {
    const p = this.player;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + n);
    if (p.hp > before) FX.text(this, 540, 640, `+${Math.round(p.hp - before)} HP`, { color: '#ff8a80', font: `bold 16px ${FONT.ui}` });
  }

  freezeAll(sec) {
    for (const e of this.enemies) if (e.alive) e.frozen = sec;
    this.frostFx = 1;
    Sound.freeze();
    this.say(`Все враги заморожены на ${sec} сек.`, '#9fd4ff');
  }

  pacPower() {
    const counts = new Array(ROWS).fill(0);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e instanceof Snake) for (const s of e.segs) counts[clamp(s.r, 0, ROWS - 1)]++;
      else counts[clamp(toRow(e.y), 0, ROWS - 1)]++;
    }
    let row = PAWN_ROW, best = -1;
    for (let r = MF.r0; r <= PAWN_ROW; r++) if (counts[r] > best) {
      best = counts[r];
      row = r;
    }
    if (!this.pac.launch(row, true)) {
      this.say('Пак-Ман уже бежит!', '#ffe600');
      return false;
    }
    this.banner('ПАК-МАН НА ОХОТЕ!', `Съедает всё в ряду ${ROWS - row}`, '#ffe600');
    return true;
  }

  rollDice() {
    this.dice = { t: 0, dur: 1.1, face: randi(1, 6), shown: 1, swapT: 0, applied: false };
    Sound.dice();
  }

  updateDice(dt) {
    const d = this.dice;
    d.t += dt;
    if (d.t < d.dur) {
      d.swapT -= dt;
      if (d.swapT <= 0) {
        d.swapT = 0.07;
        d.shown = randi(1, 6);
      }
      return;
    }
    d.shown = d.face;
    if (!d.applied) {
      d.applied = true;
      this.applyDice(d.face);
    }
    if (d.t > d.dur + 1.3) this.dice = null;
  }

  applyDice(face) {
    switch (face) {
      case 1:
        this.bonusStars++;
        this.spawnEnemy(choice(['pawn', 'zombie']));
        this.spawnEnemy(choice(['cone', 'knight']));
        this.banner('1 — НЕУДАЧА!', 'Розыск повышен, враги прибыли', '#ff5252');
        break;
      case 2:
        this.arsenal.ak.reserve = Math.min(WEAPONS.ak.reserveMax, this.arsenal.ak.reserve + 90);
        this.banner('2 — ПАТРОНЫ', '+90 патронов к АК-47', '#ffd54a');
        break;
      case 3:
        this.heal(8);
        this.banner('3 — ЛЕЧЕНИЕ', '+8 HP', '#ff8a80');
        break;
      case 4:
        if (!this.pacPower()) {
          this.addMoney(500);
          this.banner('4 — БОНУС', 'Пак-Ман занят, держи $500', '#ffe600');
        }
        break;
      case 5:
        for (let i = 0; i < 3; i++) {
          const sx = rand(300, 980);
          this.missiles.push({ x0: sx, y0: -40, x1: 640, y1: 100, toBoss: true, ox: rand(-60, 60), oy: rand(-20, 20), t: -i * 0.25, dur: 0.8, dmg: 40, launched: false, bomb: true, x: sx, y: -40 });
        }
        this.banner('5 — АВИАУДАР!', 'Три бомбы летят в башню', '#40c4ff');
        break;
      case 6:
        this.freezeAll(6);
        this.addMoney(1000, 640, 360);
        this.banner('6 — ДЖЕКПОТ!', 'Заморозка + $1000', '#7ee03c');
        break;
    }
  }

  updateTNT(dt) {
    for (const tn of this.tnts) {
      if (tn.state === 'fly') {
        tn.t += dt / tn.dur;
        if (tn.t >= 1) {
          tn.t = 1;
          tn.state = 'fuse';
          Sound.thud();
        }
      } else {
        tn.fuse -= dt;
        if (tn.fuse <= 0) {
          tn.gone = true;
          if (tn.kind === 'he') this.explode(tn.x1, tn.y1, T * 1.9, 20, 'he');
          else this.explodeTNT(tn.x1, tn.y1);
        }
      }
    }
  }

  explodeTNT(x, y) {
    this.explode(x, y, T * 1.6, 15, 'tnt');
    this.blastField(x, y);
  }

  // Взрыв вскрывает клетки 3×3: мины сгорают, безопасные клетки открываются.
  blastField(x, y) {
    if (this.mf.done) return;
    const cc = toCol(x) - MF.c0, cr = toRow(y) - MF.r0;
    if (!this.mf.inside(cc, cr)) return;
    if (!this.mf.generated) this.mf.generate(cc, cr);
    const opened = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const c = cc + dc, r = cr + dr;
        const cell = this.mf.cell(c, r);
        if (!cell || cell.pop < 1 || (cell.s !== HIDDEN && cell.s !== FLAG)) continue;
        if (cell.mine) this.mf.detonate(c, r);
        else {
          cell.s = HIDDEN;
          opened.push(...this.mf.open(c, r).opened);
        }
      }
    }
    this.rewardTiles(opened);
    this.checkCleared();
  }

  updateMissiles(dt) {
    for (const m of this.missiles) {
      m.t += dt;
      if (m.t < 0) continue;
      if (!m.launched) {
        m.launched = true;
        Sound.missile();
        if (m.c !== undefined) this.mf.detonate(m.c, m.r);
      }
      if (m.toBoss) {
        const bc = this.tower.center;
        m.x1 = bc.x + m.ox;
        m.y1 = bc.y + m.oy;
      }
      const k = Math.min(1, m.t / m.dur);
      const px = m.x, py = m.y;
      m.x = lerp(m.x0, m.x1, k);
      m.y = lerp(m.y0, m.y1, k) - Math.sin(k * Math.PI) * (m.bomb ? 0 : 160);
      m.ang = Math.atan2(m.y - py, m.x - px);
      FX.burst(this, m.x, m.y, 1, { colors: ['rgba(200,200,200,0.6)'], size: 12, speed: 20, grav: -30, life: 0.5, shape: 'circle' });
      if (k >= 1) {
        m.gone = true;
        this.explosions.push({ x: m.x1, y: m.y1, r: 60, t: 0 });
        FX.burst(this, m.x1, m.y1, 14, { colors: ['#ffef8a', '#ff6d00', '#9a9dab'], size: 8, speed: 300, life: 0.6 });
        Sound.explosion(false);
        this.damageTower(m.dmg, true);
      }
    }
  }

  openAirdrop(a) {
    a.gone = true;
    const got = [];
    for (let i = 0; i < 3; i++) {
      let k = weighted(DROP_LOOT);
      if (k === 'totem' && this.inv.totem >= 2) k = 'gapple';
      got.push(k);
      this.giveItem(k, 1, a.x + (i - 1) * 30, a.y);
    }
    this.say('Аирдроп: ' + got.map((k) => ITEM_INFO[k].name).join(', '), '#9ccc65');
    FX.burst(this, a.x, a.y, 20, { colors: ['#b3261e', '#e8e8e8', '#2f62c9'], size: 8, speed: 260, up: 150 });
  }

  // ---------- игрок ----------
  updateBoost(realDt) {
    const p = this.player;
    const want = Input.keys.has('ShiftLeft') || Input.keys.has('ShiftRight');
    if (want && !this.boostLock && p.boost > 0 && !this.jumpscare) {
      if (!this.slowmo) Sound.whoosh();
      this.slowmo = true;
      p.boost = Math.max(0, p.boost - 28 * realDt);
      if (p.boost <= 0) this.boostLock = true;
      this.boostIdle = 0;
    } else {
      this.slowmo = false;
      this.boostIdle += realDt;
      if (this.boostIdle > 1) p.boost = Math.min(100, p.boost + 6 * realDt);
      if (!want) this.boostLock = false;
    }
    this.timeScale = lerp(this.timeScale, this.slowmo ? 0.35 : 1, Math.min(1, realDt * 10));
  }

  updatePlayer(dt) {
    const p = this.player;
    p.hungerT += dt;
    if (p.hungerT >= CFG.hungerTick) {
      p.hungerT = 0;
      p.hunger = Math.max(0, p.hunger - 1);
      if (p.hunger === 6) this.say('Ты проголодался. Съешь стейк (1).', '#ffcc80');
    }
    if (p.hunger >= 16 && p.hp < p.maxHp) {
      p.regenT += dt;
      if (p.regenT >= 4) {
        p.regenT = 0;
        p.hp = Math.min(p.maxHp, p.hp + 1);
        p.hunger = Math.max(0, p.hunger - 0.5);
      }
    } else p.regenT = 0;
    if (p.hunger <= 0) {
      p.starveT += dt;
      if (p.starveT >= 4) {
        p.starveT = 0;
        if (p.hp > 1) {
          p.hp -= 1;
          this.hurtFlash = 0.3;
          Sound.hurt();
        }
      }
    } else p.starveT = 0;
  }

  takeDamage(d, src) {
    if (this.state !== 'play') return;
    if (this.starT > 0) {
      FX.text(this, 640, 600, 'НЕУЯЗВИМ!', { color: '#ffd23f', font: `22px ${FONT.gta}` });
      return;
    }
    const p = this.player;
    const absorb = Math.min(d * 0.5, p.armor / 5);
    p.armor -= absorb * 5;
    p.hp -= d - absorb;
    this.hurtFlash = 0.5;
    this.heartShake = 0.5;
    this.shake = Math.max(this.shake, 10);
    Sound.hurt();
    if (Math.random() < 0.4) this.bossEmote(choice(this.tower.emotes));
    if (p.hp <= 0) {
      if (this.inv.totem > 0) {
        this.inv.totem--;
        p.hp = 10;
        this.totemFx = 1.8;
        Sound.totem();
        this.banner('ТОТЕМ БЕССМЕРТИЯ!', 'Ты спасён. Враги у ворот сметены', '#f2c230');
        for (const e of this.enemies) if (e.alive && e.y > 5 * T) e.damage(999, this, 'totem');
        FX.burst(this, 640, 400, 60, { colors: ['#f2c230', '#2fa84f', '#fff6a8'], size: 7, speed: 420, grav: 100, life: 1.4 });
      } else {
        this.die(src);
      }
    }
  }

  die(src) {
    this.state = 'dead';
    this.deadT = 0;
    this.deathCause = src;
    this.smiley = 'dead';
    Input.lmb = false;
    Sound.wasted();
    Ach.unlock('wasted');
    this.saveBest();
  }

  win() {
    this.state = 'win';
    this.winT = 0;
    this.player.money += 10000;
    this.player.earned += 10000;
    Input.lmb = false;
    Sound.win();
    Ach.unlock('boss_' + this.tower.kind);
    if (this.levelIdx >= LEVELS.length - 1) Ach.unlock('campaign');
    if (this.levelIdx + 1 > this.unlocked && this.levelIdx + 1 < LEVELS.length) {
      this.unlocked = this.levelIdx + 1;
      Store.set('kd_unlocked', this.unlocked);
    }
    this.saveBest();
  }

  addMoney(n, x, y, color = '#7ee05a') {
    this.player.money += n;
    this.player.earned += n;
    if (x !== undefined) FX.text(this, x, y, `+$${n}`, { color, font: `22px ${FONT.gta}` });
    Sound.coin();
  }

  xpNeed() {
    return 10 + this.player.level * 6;
  }

  addXp(n) {
    const p = this.player;
    p.xp += n;
    while (p.xp >= this.xpNeed()) {
      p.xp -= this.xpNeed();
      p.level++;
      Sound.levelUp();
      this.heal(2);
      this.say(`Новый уровень: ${p.level}! Скорострельность +3%`, '#80ff20');
    }
  }

  onKill(e, src) {
    this.kills++;
    Ach.unlock('first');
    if (src === 'shell' && ++this.shellKills >= 3) Ach.unlock('shell');
    if (src !== 'pac') this.addMoney(e.def.bounty * (this.bloodMoon ? 2 : 1), e.x, e.y - 50);
    if (e.type === 'koopa') {
      let left = 0, right = 0;
      for (const o of this.enemies) if (o.alive && Math.abs(o.y - e.y) < 50) o.x < e.x ? left++ : right++;
      this.shells.push(new Shell(e.x, e.y, left > right ? -1 : 1));
      Sound.kick();
    }
    this.addXp(e.def.xp);
    Sound.xp();
    FX.burst(this, e.x, e.y, 5, { colors: ['#b6ff3c', '#7ee03c'], size: 5, speed: 160, grav: -200, life: 0.8, shape: 'circle' });
    if (e instanceof Snake) {
      for (const s of e.segs) FX.burst(this, colX(s.c), rowY(s.r), 8, { colors: ['#4a7cf0', '#27479f', '#9bb8ff'], size: 9, speed: 240 });
    } else if (e.type === 'freddy') {
      this.staticFx = 0.3;
      Sound.staticNoise();
      this.say('Золотой Фредди растворился в помехах...', '#ffd54a');
    } else {
      const colors = {
        zombie: ['#7fa35c', '#6d4c2f', '#b9c9a5'],
        cone: ['#7fa35c', '#6d4c2f', '#f08a24'],
        creeper: ['#5cb84a', '#86d672', '#0b0b0b'],
        skibidi: ['#f2f2f2', '#9fd4ff', '#f0c49a'],
        mega: ['#3b3f4a', '#7b4fb0', '#c0c4cf'],
        goomba: ['#8d4b1a', '#f2c79a'],
        koopa: ['#2e7d32', '#ffd54f', '#fff'],
        enderman: ['#111', '#e040fb', '#7b1fa2'],
        cop: ['#1e3a8a', '#e0ac69', '#111'],
        sonic: ['#2a5ff0', '#f5cfa0', '#e53935'],
      }[e.type] || ['#222', '#444', '#777'];
      FX.burst(this, e.x, e.y, e.type === 'mega' ? 40 : 12, { colors, size: 7, speed: 240, up: 100 });
    }
    if (e.type === 'mega') this.banner('МЕГАРЫЦАРЬ ПОВЕРЖЕН!', `+$${e.def.bounty}`, '#b388ff');
    if (e.type === 'creeper' && Math.random() < 0.35) this.items.push(new Loot('item', 'tnt', e.x, e.y - 30, e.y, 120));
    if (e.type === 'cop' && Math.random() < 0.3) this.items.push(new Loot('item', 'ammo', e.x, e.y - 30, e.y, 120));
    if (e.type === 'sonic') this.dropRings(e.x, e.y, 10);
    if ((e.type === 'zombie' || e.type === 'cone') && Math.random() < 0.3) this.items.push(new Loot('sun', null, e.x, e.y - 30, e.y, 120));
    else if (Math.random() < 0.06) this.items.push(new Loot('item', weighted(TILE_LOOT.filter(([k]) => k !== 'sun')), e.x, e.y - 30, e.y, 120));
  }

  // ---------- защитники ----------
  plant(c) {
    const type = this.packet, cost = DEF_STATS[type].cost;
    if (this.sun < cost) {
      FX.text(this, colX(c), rowY(PAWN_ROW) - 46, `Нужно ${cost} ☀`, { color: '#ffd54a', font: `bold 16px ${FONT.ui}` });
      Sound.empty();
      return;
    }
    this.sun -= cost;
    this.def[c] = makeDefender(type);
    if (DEF_STATS[type].plant && ++this.plantsPlanted >= 10) Ach.unlock('garden');
    Sound.plant();
    FX.burst(this, colX(c), rowY(PAWN_ROW) + 30, 10, { colors: ['#8d6e63', '#5d4037', '#a5d6a7'], size: 5, speed: 160, up: 120, life: 0.5 });
  }

  killDefender(c, by) {
    const d = this.def[c];
    if (!d) return;
    this.def[c] = null;
    FX.burst(this, colX(c), rowY(PAWN_ROW), 14, { colors: ['#fff', '#ddd', '#999'], size: 7, speed: 240, up: 120 });
    Sound.capture();
    if (Math.random() < 0.35) this.say(`Потеряна фигура «${DEF_STATS[d.type].name}». ПКМ по пустой клетке — посадить новую.`, '#e0e0e0');
  }

  updateDefenders(dt) {
    for (let c = 1; c < COLS; c++) {
      const d = this.def[c];
      if (!d) continue;
      d.pop = Math.min(1, d.pop + dt * 3);
      d.lunge = Math.max(0, d.lunge - dt * 4);
      if (d.hurt > 0) d.hurt -= dt;
      if (d.glow > 0) d.glow -= dt;
      if (d.shoot > 0) d.shoot = Math.max(0, d.shoot - dt * 5);
      if (d.type === 'rook') continue;
      d.cd -= dt;
      if (d.cd > 0) continue;
      if (d.type === 'pawn') {
        const target = this.enemies.find((e) => e.alive && Math.abs(e.col - c) === 1 && e.y > 6 * T + 10 && e.y < 8 * T + 10);
        if (target) {
          d.cd = DEF_STATS.pawn.cd;
          d.lunge = 1;
          d.lungeDir = Math.sign(target.x - colX(c));
          target.damage(2, this, 'pawn');
          Sound.tok();
        } else d.cd = 0.15;
      } else if (d.type === 'bishop') {
        let best = null, bdy = 99;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const dy = (rowY(PAWN_ROW) - e.y) / T;
          if (dy < 0.3 || dy > 5.5) continue;
          const dx = Math.abs(e.x - colX(c)) / T;
          if (Math.abs(dx - dy) < 0.5 && dy < bdy) {
            best = e;
            bdy = dy;
          }
        }
        if (best) {
          d.cd = DEF_STATS.bishop.cd;
          best.damage(2, this, 'bishop');
          this.beams.push({ x1: colX(c), y1: rowY(PAWN_ROW) - 30, x2: best.x, y2: best.y, t: 0 });
          Sound.zap();
        } else d.cd = 0.15;
      } else if (d.type === 'sunflower') {
        d.cd = DEF_STATS.sunflower.cd;
        d.glow = 1;
        this.items.push(new Loot('sun', null, colX(c) + rand(-24, 24), rowY(PAWN_ROW) - 74, rowY(PAWN_ROW) - 36, 90));
      } else if (d.type === 'peashooter') {
        const inCol = this.enemies.some((e) => e.alive && Math.abs(e.x - colX(c)) < 34 && e.y < rowY(PAWN_ROW) - 10 && e.y > 0);
        if (inCol) {
          d.cd = DEF_STATS.peashooter.cd;
          d.shoot = 1;
          this.peas.push({ x: colX(c), y: rowY(PAWN_ROW) - 52, gone: false });
          Sound.pea();
        } else d.cd = 0.2;
      }
    }
  }

  enemyReached(e) {
    if (!e.alive) return;
    e.remove = true;
    const dmg = e.def.dmg + (e.type === 'pawn' ? 1 : 0);
    FX.text(this, clamp(e.x, 60, W - 60), 610, `−${dmg} HP`, { color: '#ff5252', font: `bold 24px ${FONT.gta}` });
    this.say(`${e.def.name} прорвался и ударил тебя!`, '#ff8a80');
    this.takeDamage(dmg, e.def.name);
  }

  startJumpscare(f) {
    f.remove = true;
    if (this.jumpscare || this.state !== 'play') return;
    this.jumpscare = { t: 0 };
    Sound.jumpscare();
    Ach.unlock('scare');
  }

  // ---------- волны врагов ----------
  updateDirector(dt) {
    const target = clamp(1 + Math.floor((this.t - this.starOffset) / CFG.starEvery) + this.bonusStars, 1, 6);
    if (target > this.stars) {
      this.stars = target;
      this.starFlash = 2.5;
      Sound.star();
      this.say(`Уровень розыска: ${'★'.repeat(this.stars)}`, '#ffd23f');
    }
    const alive = this.enemies.filter((e) => e.alive).length;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      const interval = Math.max(1.9, 4.6 - 0.5 * (this.stars - 1)) * (this.tower.hp < this.tower.max * 0.5 ? 0.9 : 1) * (this.bloodMoon ? 0.65 : 1);
      this.spawnT = interval * rand(0.75, 1.25);
      if (alive < 4 + this.stars * 2 && !this.tower.dead) this.spawnEnemy(this.pickEnemy());
    }
    if (this.isFnafTime) {
      this.freddyT -= dt;
      if (this.freddyT <= 0) {
        this.freddyT = rand(9, 15);
        const n = this.enemies.filter((e) => e.alive && e.type === 'freddy').length;
        if (n < (this.stars >= 5 ? 2 : 1)) this.spawnEnemy('freddy');
      }
    }
    if (!this.isNight) {
      this.sunT -= dt;
      if (this.sunT <= 0) {
        this.sunT = rand(7, 11);
        this.items.push(new Loot('sun', null, rand(140, 1140), -30, rand(220, 540), 60));
      }
    }
    this.dropT -= dt;
    if (this.dropT <= 0) {
      this.dropT = rand(CFG.dropEvery[0], CFG.dropEvery[1]);
      this.airdrops.push(new Airdrop());
      Sound.plane();
      this.say('Сброс груза! Подцепи ящик удочкой (ПКМ).', '#9ccc65');
    }
    this.qT -= dt;
    if (this.qT <= 0) {
      this.qT = rand(30, 45);
      this.spawnQBlock();
    }
    this.duckT -= dt;
    if (this.duckT <= 0) {
      this.duckT = rand(35, 55);
      this.ducks.push(new Duck());
      this.say('Утка! Подстрели её, пока не улетела.', '#a5d6a7');
    }
    this.meetingT -= dt;
    if (this.meetingT <= 0) {
      this.meetingT = rand(130, 190);
      if (this.enemies.filter((e) => e.alive && e.type !== 'mega').length >= 3) this.startMeeting();
    }
  }

  pickEnemy() {
    const s = this.stars;
    const snakeAlive = this.enemies.some((e) => e.alive && e.type === 'snake');
    const list = this.level.pool.filter(([t, , m]) => s >= m && !(t === 'snake' && snakeAlive)).map(([t, w]) => [t, w]);
    return weighted(list);
  }

  spawnEnemy(type) {
    const c = randi(0, COLS - 1);
    let e;
    switch (type) {
      case 'pawn':
      case 'knight':
      case 'rook':
      case 'bishop':
        e = new ChessEnemy(type, c, MF.r0);
        break;
      case 'zombie':
      case 'cone':
        e = new Zombie(type, c);
        break;
      case 'freddy':
        e = new Freddy(randi(1, COLS - 2), randi(MF.r0, MF.r0 + 1));
        break;
      case 'creeper':
        e = new Creeper(c);
        break;
      case 'skibidi':
        e = new Skibidi(c);
        break;
      case 'goomba':
        e = new Goomba(c);
        break;
      case 'koopa':
        e = new Koopa(c);
        break;
      case 'enderman':
        e = new Enderman(c);
        break;
      case 'cop':
        e = new Cop(c);
        break;
      case 'sonic':
        e = new Sonic(c);
        this.say('Соник! Стреляй — из него сыплются кольца, собирай их прицелом.', '#64b5f6');
        break;
      case 'mega':
        e = new MegaKnight();
        Sound.megaLand();
        break;
      case 'snake':
        e = new Snake(Math.random() < 0.5);
        this.say('Змейка выползла на доску! Она ест предметы и растёт.', '#9bb8ff');
        break;
      default:
        return null;
    }
    this.enemies.push(e);
    if (type !== 'snake') FX.burst(this, e.x, e.y + 20, 8, { colors: ['rgba(60,60,60,0.55)'], size: 18, speed: 60, grav: -20, life: 0.8, shape: 'circle' });
    return e;
  }

  // ---------- босс уровня ----------
  updateTower(dt) {
    const tw = this.tower;
    if (tw.dead) {
      tw.deadT += dt;
      tw.boomT -= dt;
      const b = tw.box;
      if (tw.boomT <= 0 && tw.deadT < 2) {
        tw.boomT = 0.16;
        const x = b.x + rand(0, b.w), y = b.y + rand(0, b.h);
        this.explosions.push({ x, y, r: 70, t: 0 });
        FX.burst(this, x, y, 12, { colors: ['#ffef8a', '#ff6d00', '#9a9dab', '#555'], size: 9, speed: 320, life: 0.8 });
        Sound.explosion(false);
        this.shake = Math.max(this.shake, 8);
      }
      if (tw.deadT > 2.4) this.win();
      return;
    }
    if (tw.hit > 0) tw.hit -= dt;
    tw.update(dt, this);
  }

  damageTower(n, big) {
    const tw = this.tower;
    if (tw.dead) return;
    tw.hp = Math.max(0, tw.hp - n);
    tw.hit = big ? 0.3 : 0.06;
    const c = tw.center;
    if (big) FX.text(this, c.x + rand(-60, 60), c.y, `−${Math.round(n)}`, { color: '#ff5252', font: `30px ${FONT.gta}` });
    const ratio = tw.hp / tw.max;
    if (tw.phase === 0 && ratio <= 0.66) {
      tw.phase = 1;
      this.towerRage();
    } else if (tw.phase === 1 && ratio <= 0.33) {
      tw.phase = 2;
      this.towerRage();
    }
    if (tw.hp <= 0) {
      tw.dead = true;
      tw.deadT = 0;
      this.banner('ПОБЕДА!', tw.deathText, '#ffd54a');
      Sound.explosion(true);
      for (const cb of this.cannonballs) cb.gone = true;
      for (const h of this.hazards) h.cancel = true;
      for (const e of this.enemies) if (e.alive) e.damage(999, this, 'tower');
    }
  }

  towerRage() {
    const tw = this.tower;
    this.banner(`${tw.speaker.toUpperCase()} В ЯРОСТИ!`, tw.rageText, '#ff5252');
    this.bossEmote(choice(tw.emotes));
    this.bonusStars++;
    Sound.roar();
    tw.onRage(this);
  }

  bossEmote(str) {
    const tw = this.tower;
    if (tw.dead) return;
    tw.emote = str;
    tw.emoteT = 2.2;
    tw.laugh = 1.2;
    this.say(`<${tw.speaker}> ${str}`, '#ff8a65');
  }

  // ---------- опасные зоны боссов ----------
  // Столбец (огонь Боузера, дыхание дракона, очередь вертолёта) или ряд фигур (лазер Титана).
  addHazard(kind, idx, warn = 1.4) {
    const h = { kind, idx, t: 0, warn, dur: 0.7, done: false, cancel: false, gone: false };
    this.hazards.push(h);
    Sound.warn();
    return h;
  }

  updateHazards(dt) {
    for (const h of this.hazards) {
      h.t += dt;
      if (!h.done && !h.cancel && h.t >= h.warn) {
        h.done = true;
        this.applyHazard(h);
      }
      if (h.cancel || h.t >= h.warn + h.dur) h.gone = true;
    }
    this.hazards = this.hazards.filter((h) => !h.gone);
  }

  applyHazard(h) {
    if (h.kind === 'laser') {
      Sound.laser();
      this.shake = Math.max(this.shake, 14);
      for (let c = 1; c < COLS; c++) {
        const d = this.def[c];
        if (!d) continue;
        d.hp -= 3;
        d.hurt = 0.3;
        if (d.hp <= 0) this.killDefender(c, null);
      }
      for (const e of this.enemies) if (e.alive && Math.abs(e.y - rowY(PAWN_ROW)) < 60) e.damage(10, this, 'laser');
      this.takeDamage(2, 'лазер Скибиди-Титана');
      return;
    }
    const x = colX(h.idx);
    if (h.kind === 'fire') Sound.fireBreath();
    else if (h.kind === 'strafe') Sound.strafe();
    else Sound.dragonBreath();
    if (this.def[h.idx]) this.killDefender(h.idx, null);
    for (const e of this.enemies) if (e.alive && Math.abs(e.x - x) < 42) e.damage(6, this, 'hazard');
    const colors = { fire: ['#ffeb3b', '#ff9800', '#f4511e'], breath: ['#e040fb', '#7b1fa2', '#ce93d8'], strafe: ['#ffd54f', '#9e9e9e', '#fff'] }[h.kind];
    for (let y = 2 * T; y < 8 * T; y += 60) FX.burst(this, x, y, 4, { colors, size: 8, speed: 160, grav: -40, life: 0.6 });
  }

  // ---------- кольца Соника ----------
  dropRings(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = rand(120, 260);
      this.rings.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 7, t: rand(0, 3) });
    }
    Sound.ringLoss();
  }

  updateRings(dt) {
    for (const r of this.rings) {
      r.t += dt;
      r.life -= dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      const damp = Math.pow(0.15, dt);
      r.vx *= damp;
      r.vy *= damp;
      if (r.x < 20 || r.x > W - 20) r.vx *= -1;
      if (r.y < 2 * T || r.y > 8 * T) r.vy *= -1;
      r.x = clamp(r.x, 20, W - 20);
      r.y = clamp(r.y, 2 * T, 8 * T);
      if (dist2(r.x, r.y, Input.x, Input.y) < 36 * 36) {
        r.life = 0;
        this.ringsGot++;
        this.player.money += 25;
        this.player.earned += 25;
        Sound.ring();
        FX.text(this, r.x, r.y - 20, '+$25', { color: '#ffd54a', font: `bold 15px ${FONT.ui}`, life: 0.7 });
        if (this.ringsGot >= 20) Ach.unlock('rings');
      }
    }
    this.rings = this.rings.filter((r) => r.life > 0);
  }

  updateCannonballs(dt) {
    for (const cb of this.cannonballs) {
      if (cb.gone) continue;
      cb.t += dt;
      if (cb.t >= cb.dur) {
        cb.gone = true;
        this.cracks.push(makeCrack(cb.tx, cb.ty));
        this.shake = 16;
        Sound.explosion(false);
        FX.burst(this, cb.tx, cb.ty, 18, { colors: ['#e0f7fa', '#b2ebf2', '#fff'], size: 6, speed: 360, grav: 600, life: 0.6 });
        this.takeDamage(CFG.cannonDamage, `снаряд: ${this.tower.name}`);
      }
    }
  }

  // ---------- время суток ----------
  get hours() {
    return (this.clock / 60) % 24;
  }
  get isNight() {
    const h = this.hours;
    return h >= 21 || h < 6;
  }
  get isFnafTime() {
    return this.hours < 6;
  }
  get darkness() {
    const h = this.hours;
    if (h >= 21) return ((h - 21) / 3) * 0.78;
    if (h < 5) return 0.78;
    if (h < 6) return (6 - h) * 0.78;
    return 0;
  }

  updateClock(dt) {
    const prev = this.hours;
    this.clock += dt * CFG.dayMinutesPerSec;
    const h = this.hours;
    if (prev > 23 && h < 1) {
      this.nights++;
      this.banner('12 AM', `Ночь ${this.nights}. Золотой Фредди проснулся...`, '#ffffff');
      Sound.midnight();
      this.staticFx = 0.6;
      this.freddyT = 3;
      if (Math.random() < (this.levelIdx >= 2 ? 0.5 : 0.3)) {
        this.bloodMoon = true;
        this.banner('КРОВАВАЯ ЛУНА', 'Враги быстрее и злее, награды ×2', '#ff1744');
      }
    }
    if (prev < 6 && h >= 6) {
      this.banner('6 AM', 'Ты пережил ночь! +$2000', '#7ee03c');
      Sound.chime6am();
      this.addMoney(2000);
      Ach.unlock('night');
      if (this.bloodMoon) Ach.unlock('blood');
      this.bloodMoon = false;
      for (const e of this.enemies) if (e.alive && e.type === 'freddy') e.remove = true;
    }
    if (prev < 21 && h >= 21) this.say('Темнеет. В полночь просыпается кое-кто золотой...', '#b39ddb');
  }

  // ---------- чит-коды GTA ----------
  // Буквы копятся в буфер. Пока набирается чит, игровые действия этих клавиш не срабатывают.
  handleCheatKey(code) {
    const m = /^Key([A-Z])$/.exec(code);
    if (!m) {
      if (!/^Shift/.test(code)) this.typed = '';
      return false;
    }
    this.typed = (this.typed + m[1]).slice(-12);
    for (const name in CHEATS) {
      if (this.typed.endsWith(name)) {
        this.typed = '';
        this.activateCheat(name);
        return true;
      }
    }
    for (const name in CHEATS) {
      for (let k = Math.min(name.length - 1, this.typed.length); k >= 2; k--) {
        if (this.typed.endsWith(name.slice(0, k))) return true;
      }
    }
    return false;
  }

  activateCheat(name) {
    const p = this.player;
    this.cheated = true;
    switch (name) {
      case 'HESOYAM':
        p.hp = p.maxHp;
        p.armor = 100;
        p.hunger = 20;
        p.money += 250000;
        break;
      case 'AEZAKMI':
        this.starOffset = this.t;
        this.bonusStars = 0;
        this.stars = 1;
        break;
      case 'FULLCLIP':
        this.infAmmo = true;
        this.gun.reload = 0;
        break;
      case 'LXGIWYL':
        for (const k of WEAPON_ORDER) {
          const a = this.arsenal[k];
          a.owned = true;
          a.mag = WEAPONS[k].mag;
          a.reserve = WEAPONS[k].reserveMax;
        }
        this.grenades = Math.min(5, this.grenades + 3);
        break;
      case 'OSRBLHH':
        this.bonusStars += 2;
        break;
      case 'SKIBIDI':
        for (let i = 0; i < 3; i++) this.spawnEnemy('skibidi');
        break;
    }
    Sound.cheat();
    Ach.unlock('cheat');
    this.cheatMsg = { name, text: CHEATS[name], t: 0 };
    this.say(`Чит ${name}: ${CHEATS[name]}. Рекорд в этой игре не засчитается.`, '#ffffff');
  }

  // ---------- Крипер ----------
  creeperBoom(e) {
    this.explode(e.x, e.y, T * 1.7, 14, 'creeper');
    this.blastField(e.x, e.y);
    for (let c = 1; c < COLS; c++) {
      if (this.def[c] && Math.abs(colX(c) - e.x) <= T * 1.3 && Math.abs(rowY(PAWN_ROW) - e.y) <= T * 1.7) this.killDefender(c, e);
    }
    this.say('Крипер взорвался. Ссссс... БУМ.', '#86d672');
    this.takeDamage(2, 'Крипер');
  }

  // ---------- Марио ----------
  spawnQBlock() {
    const c = randi(MF.c0, MF.c0 + MF.cols - 1), r = randi(MF.r0, MF.r0 + MF.rows - 2);
    this.qblocks.push(new QBlock(colX(c), rowY(r) - 6));
    Sound.bump();
    this.say('Появился «?»-блок. Стрельни по нему!', '#ffd23f');
  }

  hitQBlock(q) {
    q.state = 'empty';
    q.bumpT = 0.25;
    q.life = 1.4;
    Sound.bump();
    const kind = weighted([['coins', 40], ['mushroom', 25], ['star', 20], ['oneup', 12]]);
    const x = q.x, y = q.y - 44;
    if (kind === 'coins') {
      for (let i = 0; i < 5; i++) this.popups.push({ kind: 'coin', x: x + (i - 2) * 16, y, t: -i * 0.08 });
      this.addMoney(500, x, y - 40, '#ffd23f');
      Sound.marioCoin();
    } else if (kind === 'mushroom') {
      this.popups.push({ kind: 'mushroom', x, y, t: 0 });
      this.player.hp = this.player.maxHp;
      this.player.armor = Math.min(100, this.player.armor + 25);
      Sound.powerUp();
      FX.text(this, x, y - 40, 'СУПЕРГРИБ! Здоровье полное', { color: '#ff8a80', font: `bold 18px ${FONT.ui}` });
    } else if (kind === 'star') {
      this.popups.push({ kind: 'star', x, y, t: 0 });
      this.starT = 9;
      Ach.unlock('star');
      Sound.starMusic(9);
      this.banner('ЗВЕЗДА!', 'Неуязвимость и двойной урон на 9 секунд', '#ffd23f');
    } else {
      this.popups.push({ kind: 'oneup', x, y, t: 0 });
      this.inv.totem++;
      Sound.oneUp();
      FX.text(this, x, y - 40, '1-UP! +1 тотем', { color: '#7ee03c', font: `bold 20px ${FONT.ui}` });
    }
  }

  // ---------- Duck Hunt ----------
  shootDuck(d) {
    d.state = 'hit';
    d.hitT = 0;
    this.ducksShot++;
    if (this.ducksShot >= 5) Ach.unlock('ducks');
    this.addMoney(500, d.x, d.y - 36, '#a5d6a7');
    Sound.quack();
    FX.burst(this, d.x, d.y, 10, { colors: ['#8d5a2b', '#1b6b2a', '#fff'], size: 5, speed: 160, life: 0.6 });
  }

  dogLaugh() {
    this.dogT = 2.4;
    Sound.dogLaugh();
  }

  // ---------- PvZ: горох ----------
  updatePeas(dt) {
    for (const p of this.peas) {
      p.y -= 540 * dt;
      for (const e of this.enemies) {
        if (e.alive && e.hit(p.x, p.y)) {
          e.damage(this.starT > 0 ? 2 : 1, this, 'pea');
          p.gone = true;
          break;
        }
      }
      // горох разбивается о каменную кладку башни, не нанося урона
      if (!p.gone && p.y < 170) p.gone = true;
      if (p.gone) {
        FX.burst(this, p.x, p.y, 5, { colors: ['#7ee03c', '#2e7d32'], size: 4, speed: 120, life: 0.3 });
        Sound.splat();
      } else if (p.y < -20) p.gone = true;
    }
    this.peas = this.peas.filter((p) => !p.gone);
  }

  // ---------- Among Us ----------
  startMeeting() {
    const alive = this.enemies.filter((e) => e.alive && e.type !== 'mega');
    if (!alive.length || this.jumpscare) return;
    const target = alive.reduce((a, b) => (b.hp > a.hp ? b : a));
    const colors = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#fb8c00', '#ec407a', '#00acc1'];
    this.meeting = { t: 0, target, name: target.def.name, color: choice(colors), ejected: false };
    Input.lmb = false;
    Sound.meeting();
  }

  updateMeeting(dt) {
    const m = this.meeting;
    m.t += dt;
    if (!m.ejected && m.t >= 2.2) {
      m.ejected = true;
      Sound.eject();
      if (m.target.alive) {
        m.target.damage(9999, this, 'meeting');
        m.target.remove = true;
      }
    }
    if (m.t >= 5.2) {
      this.meeting = null;
      this.suppressFire = true;
      this.say(`${m.name} был предателем. Голосование окончено.`, '#ff8a80');
      Ach.unlock('meeting');
    }
  }

  // ---------- сообщения ----------
  say(str, color = '#fff') {
    this.chat.push({ text: str, color, t: 0 });
    if (this.chat.length > 5) this.chat.shift();
  }
  banner(title, sub, color = '#ffd54a') {
    this.bannerObj = { title, sub, color, t: 0, dur: 2.8 };
  }
}

function makeCrack(x, y) {
  const lines = [];
  const n = randi(7, 11);
  for (let i = 0; i < n; i++) {
    let a = (i / n) * TAU + rand(-0.2, 0.2);
    let px = x, py = y;
    const pts = [[px, py]];
    const segs = randi(3, 5);
    for (let s = 0; s < segs; s++) {
      a += rand(-0.4, 0.4);
      const len = rand(25, 70);
      px += Math.cos(a) * len;
      py += Math.sin(a) * len;
      pts.push([px, py]);
    }
    lines.push(pts);
  }
  return { x, y, lines, t: 0 };
}
