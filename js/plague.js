'use strict';
/* Чума — как Plague Inc. Раз за уровень один из врагов становится «нулевым пациентом»:
   зараза переходит на соседей и медленно их убивает. Из погибших от чумы вылетают пузыри ДНК —
   собирай прицелом. За каждые PLAGUE.evolve ДНК вирус эволюционирует: заразнее и смертельнее.
   Чит-код PLAGUE заражает сразу. */

const PLAGUE = {
  start: [40, 90], // когда появится нулевой пациент
  tick: 1.6, // раз во столько секунд болезнь бьёт заражённого
  spread: 95, // радиус заражения
  chance: 0.55, // шанс в секунду заразить соседа
  evolve: 4, // ДНК на одну эволюцию
  money: 60, // за пузырь ДНК
  symptoms: ['Кашель', 'Чихание', 'Лихорадка', 'Некроз', 'Тотальный отказ органов'],
};

function drawBiohazard(ctx, x, y, r, color = '#ff5a36') {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = r * 0.22;
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 3;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.5, a + 0.9, a - 0.9 + TAU);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.2, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.62, 0, TAU);
  ctx.lineWidth = r * 0.1;
  ctx.stroke();
  ctx.restore();
}

// Пузырь ДНК, как в Plague Inc: красно-оранжевый кружок со знаком биоопасности.
function drawDnaBubble(ctx, x, y, t) {
  const r = 17 + Math.sin(t * 6) * 1.5;
  ctx.save();
  ctx.shadowColor = '#ff3d00';
  ctx.shadowBlur = 12;
  const gr = ctx.createRadialGradient(x - 5, y - 6, 2, x, y, r);
  gr.addColorStop(0, '#ffab91');
  gr.addColorStop(1, '#d84315');
  circ(ctx, x, y, r, gr);
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff3e0';
  ctx.stroke();
  drawBiohazard(ctx, x, y, r * 0.75, '#fff3e0');
}

const Plague = {
  reset(g) {
    g.plague = { on: false, startT: rand(...PLAGUE.start), lvl: 0, dna: 0, next: PLAGUE.evolve, kills: 0, bubbles: [], flash: 0 };
  },

  // Нулевой пациент: враг, у которого больше всего соседей (так чуме есть куда идти).
  start(g) {
    const P = g.plague;
    const alive = g.enemies.filter((e) => e.alive && !e.air && e.type !== 'mega' && e.type !== 'snake');
    if (!alive.length) {
      P.startT = 5;
      return;
    }
    const near = (e) => alive.filter((o) => o !== e && Math.hypot(o.x - e.x, o.y - e.y) < PLAGUE.spread * 1.5).length;
    alive.sort((a, b) => near(b) - near(a) || Math.abs(a.x - 640) - Math.abs(b.x - 640));
    P.on = true;
    P.startT = 0;
    this.infect(g, alive[0]);
    g.banner('НУЛЕВОЙ ПАЦИЕНТ', `${alive[0].def.name} заражён — чума пошла по врагам`, '#ff5a36');
    g.say('[Чума] Зараза перекидывается на соседей. Пузыри ДНК собирай прицелом.', '#ff8a65');
    Sound.hiss();
  },

  infect(g, e) {
    if (e.infected || !e.alive) return;
    e.infected = true;
    e.plagueT = PLAGUE.tick;
    FX.burst(g, e.x, e.y - 20, 6, { colors: ['#76ff03', '#c6ff00'], size: 5, speed: 90, grav: -40, life: 0.8 });
  },

  update(dt, g) {
    const P = g.plague;
    if (!P) return;
    if (!P.on) {
      if (g.duel) return;
      P.startT -= dt;
      if (P.startT <= 0) this.start(g);
      return;
    }
    if (P.flash > 0) P.flash -= dt;
    const lvl = P.lvl;
    const sick = g.enemies.filter((e) => e.alive && e.infected);
    for (const e of sick) {
      // болезнь бьёт заражённого
      e.plagueT -= dt;
      if (e.plagueT <= 0) {
        e.plagueT = Math.max(0.6, PLAGUE.tick - lvl * 0.2);
        e.damage(1 + (lvl >= 3 ? 1 : 0), g, 'plague');
        if (Math.random() < 0.5) FX.burst(g, e.x, e.y - 30, 3, { colors: ['#76ff03', '#33691e'], size: 4, speed: 60, grav: -30, life: 0.7 });
      }
      // и перекидывается на соседей
      const R = PLAGUE.spread + lvl * 20;
      for (const o of g.enemies) {
        if (!o.alive || o.infected || o.air || o.type === 'mega' || o.type === 'snake') continue;
        if (Math.hypot(o.x - e.x, o.y - e.y) < R && Math.random() < (PLAGUE.chance + lvl * 0.12) * dt) this.infect(g, o);
      }
    }
    // пузыри ДНК: плывут вверх, собираются прицелом
    for (const b of P.bubbles) {
      b.t += dt;
      b.y -= dt * 14;
      if (Math.hypot(Input.x - b.x, Input.y - b.y) < 34) this.collect(g, b);
    }
    P.bubbles = P.bubbles.filter((b) => !b.got && b.t < 7);
  },

  onKill(g, e) {
    const P = g.plague;
    P.kills++;
    if (P.kills >= 10) Ach.unlock('plague');
    P.bubbles.push({ x: e.x + rand(-10, 10), y: e.y - 40, t: 0, got: false });
  },

  collect(g, b) {
    const P = g.plague;
    b.got = true;
    P.dna++;
    g.addMoney(PLAGUE.money, b.x, b.y);
    FX.burst(g, b.x, b.y, 10, { colors: ['#ff7043', '#ffccbc'], size: 5, speed: 160, grav: 100, life: 0.5 });
    if (P.dna >= P.next && P.lvl < PLAGUE.symptoms.length) {
      P.next += PLAGUE.evolve;
      const s = PLAGUE.symptoms[P.lvl];
      P.lvl++;
      P.flash = 1;
      g.banner('ВИРУС ЭВОЛЮЦИОНИРОВАЛ', `Симптом: ${s} — заразнее и смертельнее`, '#ff5a36');
      Sound.levelUp();
    }
  },

  draw(ctx, g, t) {
    const P = g.plague;
    if (!P) return;
    for (const b of P.bubbles) {
      ctx.globalAlpha = Math.min(1, (7 - b.t) * 2);
      drawDnaBubble(ctx, b.x, b.y, t + b.x);
    }
    ctx.globalAlpha = 1;
  },

  // Плашка как в Plague Inc: знак, заражённые, ДНК, симптом.
  drawHud(ctx, g) {
    const P = g.plague;
    if (!P || !P.on) return;
    const sick = g.enemies.filter((e) => e.alive && e.infected).length;
    const x = 10, y = 212;
    rr(ctx, x, y, 236, 42, 10);
    ctx.fillStyle = P.flash > 0 ? `rgba(216,67,21,${0.5 + P.flash * 0.4})` : 'rgba(30,8,4,0.78)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ff5a36';
    ctx.stroke();
    drawBiohazard(ctx, x + 22, y + 21, 14);
    text(ctx, `Заражено: ${sick}`, x + 44, y + 18, { font: `bold 14px ${FONT.ui}`, color: '#ffccbc' });
    text(ctx, `ДНК ${P.dna} · ${P.lvl ? PLAGUE.symptoms[P.lvl - 1] : 'без симптомов'}`, x + 44, y + 35, { font: `bold 12px ${FONT.ui}`, color: '#ff8a65' });
  },
};
