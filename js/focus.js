'use strict';
/* Национальный фокус — как Hearts of Iron IV. Перед каждым уровнем кампании выбираешь один
   из трёх фокусов, он действует весь уровень. */

const FOCUSES = {
  industry: { name: 'Индустриализация', desc: '+50% денег за врагов', color: '#8d6e63' },
  mobilize: { name: 'Всеобщая мобилизация', desc: 'каждые 20 с встаёт новая пешка', color: '#7cb342' },
  blitz: { name: 'Блицкриг', desc: '+30% скорострельности', color: '#e53935' },
  air: { name: 'Военная авиация', desc: 'каждые 25 с авианалёт на врагов', color: '#42a5f5' },
  maginot: { name: 'Линия Мажино', desc: 'твои фигуры вдвое прочнее', color: '#90a4ae' },
};
const FOCUS_CFG = { mobilize: 20, air: 25, bombs: 3, bombDmg: 4 };

// Значок фокуса: шестиугольник с символом, как в дереве фокусов.
function drawFocusIcon(ctx, id, x, y, r) {
  const f = FOCUSES[id];
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) ctx.lineTo(Math.cos((i * TAU) / 6) * r, Math.sin((i * TAU) / 6) * r);
  ctx.closePath();
  ctx.fillStyle = f.color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#d4af37';
  ctx.stroke();
  const s = r / 24;
  ctx.scale(s, s);
  if (id === 'industry') {
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(-14, -2, 28, 14);
    ctx.fillRect(-10, -16, 6, 14);
    ctx.fillRect(2, -12, 6, 10);
    circ(ctx, -7, -20, 4, 'rgba(255,255,255,0.6)');
  } else if (id === 'mobilize') {
    drawPiece(ctx, 'p', true, 0, -2, 30, { shadow: false });
  } else if (id === 'blitz') {
    poly(ctx, [4, -16, -8, 2, 0, 2, -4, 16, 10, -4, 2, -4], '#ffeb3b', '#5d4037', 1.5);
  } else if (id === 'air') {
    poly(ctx, [-16, 0, 16, 0, 18, 3, -14, 3], '#eceff1');
    poly(ctx, [-2, -12, 4, -12, 6, 14, -4, 14], '#eceff1');
    poly(ctx, [-16, -6, -12, -6, -10, 3, -16, 3], '#eceff1');
  } else if (id === 'maginot') {
    ctx.fillStyle = '#455a64';
    ctx.fillRect(-16, -4, 32, 14);
    for (let i = 0; i < 4; i++) ctx.fillRect(-16 + i * 9, -10, 5, 6);
  }
  ctx.restore();
}

function drawWarPlane(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ell(ctx, 0, 0, 46, 9, '#5d6b4a');
  poly(ctx, [-10, -2, 10, -2, 4, -40, -4, -40], '#4e5b3d');
  poly(ctx, [-10, 2, 10, 2, 4, 40, -4, 40], '#4e5b3d');
  poly(ctx, [-40, -2, -32, -2, -30, -16, -36, -16], '#4e5b3d');
  circ(ctx, 46, 0, 5, '#263238');
  circ(ctx, 10, -18, 4, '#c62828');
  circ(ctx, 10, 18, 4, '#c62828');
  ctx.restore();
}

const Focus = {
  // Три случайных фокуса на выбор перед уровнем.
  offer(g) {
    g.focusOffer = shuffle(Object.keys(FOCUSES)).slice(0, 3);
    g.focus = '';
  },

  pick(g, id) {
    g.focus = id;
    g.focusT = id === 'mobilize' ? FOCUS_CFG.mobilize : id === 'air' ? FOCUS_CFG.air : 0;
    if (id === 'maginot') for (const d of g.def) this.fortify(g, d);
    g.say(`[Национальный фокус] ${FOCUSES[id].name}: ${FOCUSES[id].desc}`, '#d4af37');
    Ach.unlock('focus');
  },

  // Мажино: новая фигура тоже вдвое прочнее.
  fortify(g, d) {
    if (!d || g.focus !== 'maginot' || d.fortified) return;
    d.fortified = true;
    d.hp *= 2;
    d.maxHp *= 2;
  },

  update(dt, g) {
    if (!g.focus || g.duel) return;
    if (g.airRaid) {
      const R = g.airRaid;
      R.x += dt * 900;
      for (const b of R.bombs) {
        if (!b.done && R.x >= b.x) {
          b.done = true;
          g.explode(b.x, b.y, 70, FOCUS_CFG.bombDmg, 'air');
        }
      }
      if (R.x > W + 120) g.airRaid = null;
    }
    if (g.focus !== 'mobilize' && g.focus !== 'air') return;
    g.focusT -= dt;
    if (g.focusT > 0) return;
    if (g.focus === 'mobilize') {
      g.focusT = FOCUS_CFG.mobilize;
      const empty = [];
      for (let c = 1; c < COLS; c++) if (!g.def[c]) empty.push(c);
      if (empty.length) {
        const c = choice(empty);
        g.def[c] = makeDefender('pawn');
        this.fortify(g, g.def[c]);
        FX.text(g, colX(c), rowY(PAWN_ROW) - 50, 'мобилизация!', { color: '#c5e1a5', font: `bold 15px ${FONT.ui}` });
        Sound.plant();
      }
    } else {
      g.focusT = FOCUS_CFG.air;
      const targets = g.enemies.filter((e) => e.alive && !e.air).sort((a, b) => b.y - a.y).slice(0, FOCUS_CFG.bombs);
      if (targets.length) {
        g.airRaid = { x: -120, y: 200, bombs: targets.map((e) => ({ x: e.x, y: e.y, done: false })) };
        Sound.plane();
        g.say('[Авиация] Авианалёт по врагам!', '#90caf9');
      }
    }
  },

  draw(ctx, g) {
    if (g.airRaid) drawWarPlane(ctx, g.airRaid.x, g.airRaid.y, 1);
  },

  drawHud(ctx, g) {
    if (!g.focus) return;
    const f = FOCUSES[g.focus];
    rr(ctx, 10, 170, 236, 36, 8);
    ctx.fillStyle = 'rgba(32,30,20,0.82)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#d4af37';
    ctx.stroke();
    drawFocusIcon(ctx, g.focus, 30, 188, 13);
    text(ctx, f.name, 50, 186, { font: `bold 13px ${FONT.ui}`, color: '#f5e6b3' });
    const extra = g.focus === 'mobilize' || g.focus === 'air' ? ` · через ${Math.max(0, Math.ceil(g.focusT))} с` : '';
    text(ctx, f.desc + extra, 50, 200, { font: `11px ${FONT.ui}`, color: '#cfc29a' });
  },

  // Карточки выбора на заставке уровня.
  drawOffer(ctx, g, now) {
    if (!g.focusOffer || g.duel) return;
    text(ctx, 'НАЦИОНАЛЬНЫЙ ФОКУС — выбери один на этот уровень', 80, 548, { font: `bold 16px ${FONT.ui}`, color: '#d4af37' });
    g.focusOffer.forEach((id, i) => {
      const f = FOCUSES[id], x = 80 + i * 186, y = 560, w = 176, h = 86;
      const hov = inRect(Input.x, Input.y, { x, y, w, h });
      rr(ctx, x, y, w, h, 10);
      ctx.fillStyle = hov ? 'rgba(80,70,30,0.95)' : 'rgba(32,30,20,0.9)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = hov ? '#ffe082' : '#d4af37';
      ctx.stroke();
      drawFocusIcon(ctx, id, x + 28, y + 30, 18);
      wrapText(ctx, f.name, x + 54, y + 26, 118, 17, { font: `bold 14px ${FONT.ui}`, color: '#f5e6b3' });
      wrapText(ctx, f.desc, x + 10, y + 64, 160, 15, { font: `12px ${FONT.ui}`, color: '#cfc29a' });
      g.buttons.push({ x, y, w, h, action: () => {
        this.pick(g, id);
        g.beginLevel();
      } });
    });
  },
};
