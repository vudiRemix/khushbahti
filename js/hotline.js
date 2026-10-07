'use strict';
/* Маска Ричарда — как Hotline Miami. Выпадает из «?»-блоков и аирдропов, надевается сразу:
   на HOTLINE.time секунд экран в неоне, любой враг падает с одного удара, а убийства
   подряд складываются в комбо с очками. Чит-код RICHARD. */

const HOTLINE = { time: 12, comboTime: 2.6, pts: 100 };

function drawRoosterMask(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // гребешок
  for (const [cx, cy, r] of [[-10, -30, 9], [2, -34, 10], [14, -29, 8]]) circ(ctx, cx, cy, r, '#e53935');
  // голова
  ell(ctx, 0, 0, 26, 30, '#fafafa');
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#bdbdbd';
  ctx.stroke();
  // клюв и бородка
  poly(ctx, [20, -4, 40, 2, 20, 10], '#ffb300', '#b26a00', 1.5);
  ell(ctx, 18, 22, 6, 10, '#e53935');
  // прорези для глаз
  ell(ctx, 6, -8, 6, 4, '#111');
  ell(ctx, -12, -8, 5, 4, '#111');
  ctx.restore();
}

const Hotline = {
  start(g) {
    if (g.hotline) {
      g.hotline.t = HOTLINE.time;
      return;
    }
    g.hotline = { t: HOTLINE.time, combo: 0, comboT: 0, best: 0, pts: 0 };
    g.banner('ТЕБЕ НРАВИТСЯ ПРИЧИНЯТЬ БОЛЬ?', `Маска Ричарда: ${HOTLINE.time} секунд любой враг падает с одного удара`, '#ff2a8a');
    g.say('☎ «Это Ричард. Ты ведь знаешь, что делать.»', '#ff80c0');
    Sound.siren();
  },

  update(dt, g) {
    const h = g.hotline;
    if (!h) return;
    h.t -= dt;
    if (h.comboT > 0) {
      h.comboT -= dt;
      if (h.comboT <= 0) h.combo = 0;
    }
    if (h.t <= 0) {
      g.say(`Маска снята. Лучшее комбо ×${h.best}, очков: ${h.pts}`, '#ff80c0');
      g.hotline = null;
    }
  },

  onKill(g, e) {
    const h = g.hotline;
    if (!h) return;
    h.combo++;
    h.comboT = HOTLINE.comboTime;
    h.best = Math.max(h.best, h.combo);
    const p = HOTLINE.pts * h.combo;
    h.pts += p;
    FX.text(g, e.x, e.y - 50, `+${p}pts`, { color: h.combo % 2 ? '#ff2a8a' : '#33e6ff', font: `28px ${FONT.gta}`, life: 1, vy: -70 });
    if (h.combo >= 8) Ach.unlock('hotline');
  },

  // Неон, полосы VHS и комбо поверх кадра.
  drawOverlay(ctx, g, now) {
    const h = g.hotline;
    if (!h) return;
    const k = Math.min(1, h.t, (HOTLINE.time - h.t) * 3);
    ctx.save();
    ctx.globalAlpha = 0.2 * k;
    const gr = ctx.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#ff2a8a');
    gr.addColorStop(0.5 + Math.sin(now * 2) * 0.2, '#7b1fa2');
    gr.addColorStop(1, '#33e6ff');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.12 * k;
    ctx.fillStyle = '#000';
    for (let y = (now * 40) % 4; y < H; y += 4) ctx.fillRect(0, y, W, 1.5);
    ctx.restore();
    // таймер маски
    drawRoosterMask(ctx, 48, 30, 0.75);
    text(ctx, `${Math.ceil(h.t)}`, 48, 104, { font: `bold 14px ${FONT.ui}`, color: '#ff80c0', stroke: '#000', lw: 4, align: 'center' });
    if (h.combo > 1) {
      ctx.save();
      ctx.translate(1040, 270);
      ctx.rotate(-0.12 + Math.sin(now * 8) * 0.04);
      const s = 1 + Math.min(1, h.comboT) * 0.15;
      ctx.scale(s, s);
      text(ctx, `${h.combo}x COMBO`, 4, 4, { font: `56px ${FONT.gta}`, color: '#33e6ff', align: 'center' });
      text(ctx, `${h.combo}x COMBO`, 0, 0, { font: `56px ${FONT.gta}`, color: '#ff2a8a', stroke: '#fff', lw: 3, align: 'center' });
      ctx.restore();
    }
  },
};
