'use strict';
/* ХАОС-ДОСКА — общие константы, настройки баланса и утилиты.
   Все скрипты подключаются обычными <script> (без модулей), поэтому
   игра работает даже при открытии index.html двойным кликом. */

// Логическое разрешение: доска 16×9 клеток по 80px.
const W = 1280, H = 720, T = 80, COLS = 16, ROWS = 9;
const TAU = Math.PI * 2;

// Номер выпуска: виден в главном меню. Меняй вместе с CACHE в sw.js.
const GAME_VERSION = 13;

// Поле сапёра: столбцы 2..13, строки 2..6.
const MF = { c0: 2, r0: 2, cols: 12, rows: 5 };
// Ряд белых фигур-защитников.
const PAWN_ROW = 7;

const FONT = {
  gta: "Anton, Impact, 'Arial Black', sans-serif",
  title: "'Russo One', 'Arial Black', Impact, sans-serif",
  pixel: "'Press Start 2P', 'Courier New', monospace",
  ui: "'Segoe UI', Roboto, 'Trebuchet MS', Arial, sans-serif",
};

// Баланс. Меняй здесь, если хочешь сделать игру легче или сложнее.
const CFG = {
  towerHp: 1000,
  playerHp: 20,
  startArmor: 50,
  startSun: 75,
  magSize: 30,
  startReserve: 150,
  maxReserve: 300,
  fireInterval: 0.1, // 600 выстрелов в минуту, как у АК
  reloadTime: 2.0,
  mineDamageToPlayer: 5,
  cannonDamage: 2,
  starEvery: 80, // сек на звезду розыска
  trapDamage: 12,
  mineMissileDamage: 35,
  baseMines: 10,
  maxMines: 16,
  ammoPerTile: 2,
  hungerTick: 9, // сек на одно деление голода
  dayMinutesPerSec: 4, // игровых минут за секунду (час = 15 с)
  sunValue: 25,
  dropEvery: [55, 75],
};

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const easeOutCubic = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const colX = (c) => c * T + T / 2;
const rowY = (r) => r * T + T / 2;
const toCol = (x) => Math.floor(x / T);
const toRow = (y) => Math.floor(y / T);
const pad = (n, len) => String(Math.max(0, Math.floor(n))).padStart(len, '0');
const inRect = (px, py, r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

function weighted(list) {
  let total = 0;
  for (const [, w] of list) total += w;
  let r = Math.random() * total;
  for (const [item, w] of list) {
    r -= w;
    if (r < 0) return item;
  }
  return list[list.length - 1][0];
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// localStorage может быть недоступен (приватный режим, песочница) — не падаем.
const Store = {
  get(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  },
  set(key, val) {
    try { window.localStorage.setItem(key, String(val)); } catch (e) { /* без сохранения */ }
  },
};

// Состояние ввода. События кладутся в очередь и разбираются в Game.update.
const Input = {
  x: W / 2,
  y: H / 2,
  lmb: false,
  rmb: false,
  keys: new Set(),
  queue: [],
  touch: false,
  mode: 'shoot', // режим касания на телефоне: shoot | rod | flag
  stick: { id: null, ox: 0, oy: 0, x: 0, y: 0 }, // джойстик на арене (левый палец)
};

// Параметры вывода (заполняются в main.js при изменении размера окна).
const View = { k: 1, pw: W, ph: H };
