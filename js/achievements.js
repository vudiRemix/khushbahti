'use strict';
/* Достижения: всплывают как в Xbox и сохраняются в браузере. */

const ACHIEVEMENTS = [
  { id: 'first', name: 'Первая кровь', desc: 'Убей первого врага' },
  { id: 'sapper', name: 'Сапёр', desc: 'Пройди поле сапёра' },
  { id: 'sapperPro', name: 'Сапёр ошибается один раз', desc: 'Пройди поле, ни разу не подорвавшись' },
  { id: 'traps', name: 'Ловушка захлопнулась', desc: '5 врагов подорвались на флажках за игру' },
  { id: 'ducks', name: 'Утиная охота', desc: 'Подстрели 5 уток за игру' },
  { id: 'night', name: 'Пять ночей с Фредди', desc: 'Доживи до 6 AM' },
  { id: 'scare', name: "It's me", desc: 'Получи скример Золотого Фредди' },
  { id: 'cheat', name: 'HESOYAM', desc: 'Введи любой чит-код' },
  { id: 'sniper', name: 'Коллатерал', desc: 'Убей 2 врагов одним выстрелом AWP' },
  { id: 'waka', name: 'Вака-вака', desc: 'Пак-Ман съел 5 врагов за один забег' },
  { id: 'star', name: 'Неуязвимый', desc: 'Поймай звезду из «?»-блока' },
  { id: 'shopper', name: 'Шопоголик', desc: 'Потрать $10 000 в меню закупки' },
  { id: 'garden', name: 'Садовник', desc: 'Посади 10 растений' },
  { id: 'meeting', name: 'Был предателем', desc: 'Переживи экстренное собрание' },
  { id: 'rings', name: 'Gotta go fast', desc: 'Собери 20 колец Соника' },
  { id: 'shell', name: 'Зелёный панцирь', desc: 'Панцирь Купы сбил 3 врагов' },
  { id: 'blood', name: 'Кровавая луна', desc: 'Переживи кровавую луну' },
  { id: 'wasted', name: 'WASTED', desc: 'Погибни в первый раз' },
  { id: 'boss_tower', name: 'Король повержен', desc: 'Разрушь королевскую башню' },
  { id: 'boss_bowser', name: 'Принцесса спасена', desc: 'Сбрось Боузера в лаву' },
  { id: 'boss_dragon', name: 'Конец', desc: 'Победи Эндер-дракона' },
  { id: 'boss_heli', name: 'Пять звёзд', desc: 'Сбей полицейский вертолёт' },
  { id: 'boss_titan', name: 'Смыто', desc: 'Победи Скибиди-Титана' },
  { id: 'campaign', name: 'Мастер хаоса', desc: 'Пройди всю кампанию' },
  { id: 'duel', name: 'Дуэлянт', desc: 'Выиграй дуэль у живого соперника' },
  { id: 'flawless', name: 'Всухую', desc: 'Выиграй арену, ни разу не погибнув' },
  { id: 'raid', name: 'Наступление', desc: 'Победи босса пешком в босс-рейде' },
  { id: 'freeman', name: 'Монтировка решает', desc: 'Забей соперника монтировкой Фримена' },
  { id: 'reaction', name: 'Стихийный резонанс', desc: 'Устрой сопернику реакцию стихий' },
  { id: 'ut_spare', name: 'Пацифист', desc: 'Пощади Санса в бою «как в Undertale»' },
  { id: 'ut_kill', name: 'Плохое время', desc: 'Одолей Санса' },
  { id: 'siu', name: 'СИУУУ!', desc: 'Увидь гол футболиста №7' },
  { id: 'dovah', name: 'Довакин', desc: 'Убей драугра, пока он кричит «ФУС РО ДА!»' },
  { id: 'durak', name: 'Не дурак', desc: 'Выиграй партию в дурака' },
  { id: 'cardko', name: 'Карты, деньги, два ствола', desc: 'Добей босса на испытании' },
  { id: 'royal', name: 'Королевский матч', desc: 'Собери все короны в «три в ряд» босса' },
  { id: 'hotline', name: 'Тебе нравится причинять боль?', desc: 'Комбо ×8 в маске Ричарда' },
  { id: 'boy', name: 'BOY!', desc: 'Задень Левиафаном троих врагов за один бросок' },
  { id: 'focus', name: 'Генштаб', desc: 'Выбери национальный фокус' },
  { id: 'duo', name: 'Ударный режим', desc: 'Ответь Дуо правильно 5 раз подряд' },
  { id: 'mita', name: 'Навсегда вместе', desc: 'Останься с Митой' },
  { id: 'granny', name: 'Тише мыши', desc: 'Пережди Гренни и не попадись' },
  { id: 'plague', name: 'Нулевой пациент', desc: 'Чума убила 10 врагов за уровень' },
  { id: 'blast', name: 'BLAST!', desc: 'Собери 3 линии одной фигурой в блок-бласте' },
];

const Ach = {
  got: new Set(),
  queue: [],
  load() {
    try {
      const list = JSON.parse(Store.get('kd_ach') || '[]');
      if (Array.isArray(list)) this.got = new Set(list);
    } catch (e) {
      this.got = new Set();
    }
  },
  unlock(id) {
    if (this.got.has(id)) return;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    this.got.add(id);
    Store.set('kd_ach', JSON.stringify([...this.got]));
    this.queue.push({ a, t: 0 });
    Sound.achievement();
  },
  update(dt) {
    if (!this.queue.length) return;
    this.queue[0].t += dt;
    if (this.queue[0].t > 3.6) this.queue.shift();
  },
  draw(ctx) {
    const q = this.queue[0];
    if (!q) return;
    const k = Math.min(1, q.t * 4, (3.6 - q.t) * 4);
    const w = 420 * easeOutCubic(Math.max(0, k)), x = 640 - w / 2, y = 178;
    if (w < 60) return;
    rr(ctx, x, y, w, 58, 29);
    ctx.fillStyle = 'rgba(28,28,30,0.94)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#7ee03c';
    ctx.stroke();
    circ(ctx, x + 29, y + 29, 22, '#107c10');
    drawStar(ctx, x + 29, y + 29, 12, '#fff', '#0b5e0b');
    if (k < 1) return;
    text(ctx, 'Достижение получено', x + 62, y + 23, { font: `13px ${FONT.ui}`, color: '#a5d6a7' });
    text(ctx, q.a.name, x + 62, y + 45, { font: `bold 18px ${FONT.ui}`, color: '#fff' });
  },
};
Ach.load();
