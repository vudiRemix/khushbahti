'use strict';
/* Отрисовка кадра: мир → ночь → руки → эффекты → интерфейс → экраны. */

const nightCanvas = document.createElement('canvas');
let nightCtx = null;

function render(ctx, g) {
  const now = performance.now() / 1000;
  const menu = g.state === 'title' || g.state === 'levels' || g.state === 'achievements' || g.state === 'intro' || g.state === 'duel' || g.state === 'top';
  const wt = menu ? g.titleT + g.introT : g.t;
  ctx.setTransform(View.k, 0, 0, View.k, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.fillStyle = '#0d1208';
  ctx.fillRect(0, 0, W, H);
  if (g.state === 'arena' || (g.state === 'duelover' && Arena.on)) return renderArena(ctx, g, now);
  if (g.state === 'durak') {
    // партия с боссом идёт прямо на его доске — она просвечивает за столом
    if (Durak.mode === 'boss') {
      ctx.save();
      drawWorld(ctx, g, g.t, now);
      ctx.restore();
    }
    renderDurak(ctx, g, now);
    Ach.draw(ctx);
    if (!Input.touch) drawPointer(ctx);
    return;
  }
  if (g.state === 'ut') {
    renderBattle(ctx, g, now);
    Ach.draw(ctx);
    if (!Input.touch && Battle.phase !== 'attack') drawPointer(ctx);
    return;
  }

  ctx.save();
  if (g.shake > 0 && !menu) ctx.translate(rand(-1, 1) * g.shake, rand(-1, 1) * g.shake);
  drawWorld(ctx, g, wt, now);
  drawNight(ctx, g);
  if (!menu) drawHands(ctx, g, now);
  ctx.restore();

  if (!menu) {
    drawScreenFx(ctx, g, now);
    drawHUD(ctx, g, now);
  }
  g.buttons = [];
  if (g.state === 'title') drawTitle(ctx, g, now);
  else if (g.state === 'levels') drawLevels(ctx, g, now);
  else if (g.state === 'achievements') drawAchievements(ctx, g, now);
  else if (g.state === 'top') drawTopScreen(ctx, g, now);
  else if (g.state === 'intro') drawIntro(ctx, g, now);
  else if (g.state === 'duel') drawDuelLobby(ctx, g, now);
  else if (g.state === 'duelover') drawDuelOver(ctx, g, now);
  else if (g.state === 'pause') drawPause(ctx, g, now);
  else if (g.state === 'cheats') drawCheats(ctx, g, now);
  else if (g.state === 'buy') drawBuy(ctx, g, now);
  else if (g.state === 'dead') drawDead(ctx, g, now);
  else if (g.state === 'win') drawWin(ctx, g, now);
  if (g.meeting) drawMeeting(ctx, g, now);
  if (g.jumpscare) drawJumpscare(ctx, g, now);
  Ach.draw(ctx);
  if (g.state === 'play' && !g.jumpscare && !g.meeting) drawCrosshair(ctx, g, now);
  else if (!g.jumpscare && !g.meeting && !Input.touch) drawPointer(ctx);
}

// ---------- мир ----------
function drawWorld(ctx, g, t, now) {
  ctx.drawImage(Board.get(View, g.state === 'title' ? 'classic' : g.level.theme), 0, 0, W, H);
  const hover = g.state === 'play' ? g.mf.at(Input.x, Input.y) : null;
  g.mf.draw(ctx, hover, t);

  for (const d of g.decals) {
    ctx.globalAlpha = Math.min(1, d.life);
    circ(ctx, d.x, d.y, 4.5, 'rgba(60,50,40,0.5)');
    circ(ctx, d.x, d.y, 2.5, 'rgba(10,10,10,0.85)');
  }
  ctx.globalAlpha = 1;

  if (g.state === 'title') drawTitleCast(ctx, t);

  for (const it of g.items) if (!it.falling) it.draw(ctx);
  for (const r of g.rings) {
    if (r.life < 2 && Math.floor(r.t * 10) % 2 === 0) continue;
    drawRing(ctx, r.x, r.y, r.t);
  }
  for (let c = 1; c < COLS; c++) if (g.def[c]) drawDefender(ctx, g.def[c], c, t);
  for (const sh of g.shells) sh.draw(ctx);
  for (const p of g.peas) {
    circ(ctx, p.x, p.y, 7, '#7ee03c');
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#2e7d32';
    ctx.stroke();
  }
  g.pac.draw(ctx, t);
  for (const a of g.airdrops) if (a.state === 'land') a.draw(ctx);

  const es = g.enemies.slice().sort((a, b) => a.y - b.y);
  for (const e of es) e.draw(ctx, t);
  if (g.footballer) g.footballer.draw(ctx, t);

  for (const q of g.qblocks) q.draw(ctx);
  for (const p of g.popups) {
    if (p.t < 0) continue;
    ctx.globalAlpha = Math.min(1, (1.2 - p.t) * 3);
    drawMarioItem(ctx, p.kind, p.x, p.y - Math.min(p.t, 0.5) * 90, 1.2, now);
  }
  ctx.globalAlpha = 1;

  drawHazards(ctx, g, t);
  drawTowerState(ctx, g, t);

  for (const b of g.beams) {
    const a = 1 - b.t / 0.22;
    line(ctx, b.x1, b.y1, b.x2, b.y2, `rgba(255,248,200,${a * 0.5})`, 12);
    line(ctx, b.x1, b.y1, b.x2, b.y2, `rgba(255,255,255,${a})`, 4);
  }
  for (const it of g.items) if (it.falling) it.draw(ctx);
  for (const a of g.airdrops) if (a.state === 'fall') a.draw(ctx);
  for (const d of g.ducks) d.draw(ctx);

  for (const tn of g.tnts) {
    const k = tn.state === 'fly' ? tn.t : 1;
    const x = lerp(tn.x0, tn.x1, k), y = lerp(tn.y0, tn.y1, k) - Math.sin(k * Math.PI) * 220;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tn.state === 'fly' ? k * 9 : 0);
    if (tn.kind === 'he') drawGrenade(ctx, 0, 0, 1.3);
    else drawTNT(ctx, 0, 0, 36);
    if (tn.state === 'fuse' && Math.floor(tn.fuse * 12) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(-18, -18, 36, 36);
    }
    ctx.restore();
  }

  for (const m of g.missiles) {
    if (m.t < 0) continue;
    if (m.bomb) {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate((m.ang || 0) - Math.PI / 2);
      ell(ctx, 0, 0, 9, 16, '#263238');
      poly(ctx, [-9, -12, 9, -12, 0, -22], '#455a64');
      ctx.restore();
    } else {
      circ(ctx, m.x, m.y, 18, 'rgba(255,140,40,0.35)');
      drawMine(ctx, m.x, m.y, 12);
    }
  }

  for (const ex of g.explosions) {
    const k = ex.t / 0.55;
    const r = ex.r * (0.35 + k * 0.75);
    const gr = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, r);
    gr.addColorStop(0, `rgba(255,250,210,${1 - k})`);
    gr.addColorStop(0.4, `rgba(255,170,30,${0.9 * (1 - k)})`);
    gr.addColorStop(1, 'rgba(200,60,0,0)');
    circ(ctx, ex.x, ex.y, r, gr);
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, ex.r * k * 1.25, 0, TAU);
    ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - k)})`;
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  for (const p of g.particles) {
    ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.6);
    ctx.fillStyle = p.color;
    if (p.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.4 - (p.life / p.max) * 0.4), 0, TAU);
      ctx.fill();
    } else {
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;

  for (const cb of g.cannonballs) cb.draw(ctx);

  for (const tx of g.texts) {
    ctx.globalAlpha = Math.min(1, (tx.life / tx.max) * 2);
    text(ctx, tx.str, tx.x, tx.y, { font: tx.font, color: tx.color, stroke: tx.stroke, lw: 4, align: 'center' });
  }
  ctx.globalAlpha = 1;
}

function drawTowerState(ctx, g, t) {
  const tw = g.tower;
  if (!tw.dead || tw.deadT < 1.6) {
    ctx.save();
    if (tw.dead) {
      ctx.globalAlpha = Math.max(0, 1 - tw.deadT / 1.6);
      ctx.translate(0, tw.deadT * 30);
    }
    tw.draw(ctx, t, g);
    ctx.restore();
  }
  if (tw.dead && tw.kind === 'tower') {
    // руины
    const k = Math.min(1, tw.deadT / 1.2);
    ctx.globalAlpha = k;
    for (let i = 0; i < 14; i++) {
      const x = 640 - 120 + ((i * 53) % 240), y = 120 + ((i * 37) % 40);
      ell(ctx, x, y, 22 + (i % 3) * 6, 14 + (i % 2) * 5, i % 2 ? '#8e919f' : '#6f7282');
    }
    drawCrown(ctx, 700, 140, 1.6);
    ctx.globalAlpha = 1;
  }
  if (!tw.dead && tw.kind !== 'tower' && g.state !== 'title') drawBossBar(ctx, tw);
  if (tw.emoteT > 0 && !tw.dead && g.state !== 'title') {
    const b = tw.box;
    const bx = clamp(b.x + b.w - 10, 320, 940 - 200), by = Math.max(26, b.y + 10);
    const a = Math.min(1, tw.emoteT * 3);
    ctx.globalAlpha = a;
    ctx.font = `bold 17px ${FONT.ui}`;
    const w = ctx.measureText(tw.emote).width + 24;
    const x = Math.min(bx, 944 - w);
    rr(ctx, x, by, w, 36, 12);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1b2b5a';
    ctx.stroke();
    poly(ctx, [x + 4, by + 24, x - 16, by + 40, x + 18, by + 30], '#fff');
    text(ctx, tw.emote, x + w / 2, by + 24, { font: `bold 17px ${FONT.ui}`, color: '#1b2b5a', align: 'center' });
    ctx.globalAlpha = 1;
  }
}

function drawBossBar(ctx, tw) {
  const w = 400, x = 640 - w / 2, y = 3;
  rr(ctx, x, y, w, 20, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fill();
  const ratio = clamp(tw.hp / tw.max, 0, 1);
  if (ratio > 0) {
    rr(ctx, x + 2, y + 2, (w - 4) * ratio, 16, 5);
    const g = ctx.createLinearGradient(0, y, 0, y + 20);
    g.addColorStop(0, '#ff6f60');
    g.addColorStop(1, '#b71c1c');
    ctx.fillStyle = g;
    ctx.fill();
  }
  text(ctx, `${tw.name} · ${Math.ceil(tw.hp)}`, 640, y + 15, { font: `bold 13px ${FONT.ui}`, color: '#fff', align: 'center', stroke: '#000', lw: 3 });
}

// Предупреждение и удар: столбец (огонь, дыхание, очередь) или ряд фигур (лазер).
function drawHazards(ctx, g, t) {
  for (const h of g.hazards) {
    const warn = h.t < h.warn;
    if (h.kind === 'laser') {
      const y = rowY(h.idx);
      if (warn) {
        const k = h.t / h.warn;
        ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(t * (6 + k * 20)));
        line(ctx, 0, y, W, y, '#ff1744', 2 + k * 4);
        ctx.globalAlpha = 1;
      } else {
        const a = 1 - (h.t - h.warn) / h.dur;
        line(ctx, 0, y, W, y, `rgba(255,23,68,${a * 0.6})`, 50);
        line(ctx, 0, y, W, y, `rgba(255,255,255,${a})`, 14);
      }
      continue;
    }
    const x = colX(h.idx) - T / 2;
    if (warn) {
      ctx.fillStyle = `rgba(255,30,30,${0.12 + 0.18 * Math.abs(Math.sin(t * 10))})`;
      ctx.fillRect(x, 2 * T, T, 6 * T);
      ctx.strokeStyle = 'rgba(255,60,60,0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, 2 * T, T - 2, 6 * T);
      text(ctx, '!', x + T / 2, 2 * T + 40, { font: `bold 34px ${FONT.title}`, color: '#ff1744', align: 'center', stroke: '#fff', lw: 4 });
      continue;
    }
    const a = 1 - (h.t - h.warn) / h.dur;
    const cols = { fire: ['255,152,0', '255,235,59'], breath: ['171,71,188', '234,128,252'], strafe: ['255,213,79', '255,255,255'] }[h.kind];
    const gr = ctx.createLinearGradient(x, 0, x + T, 0);
    gr.addColorStop(0, `rgba(${cols[0]},0)`);
    gr.addColorStop(0.5, `rgba(${cols[1]},${a})`);
    gr.addColorStop(1, `rgba(${cols[0]},0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(x - 10, 160, T + 20, 6 * T);
    if (h.kind === 'strafe') {
      for (let i = 0; i < 8; i++) circ(ctx, x + rand(10, T - 10), rand(2 * T, 8 * T), 4, `rgba(60,60,60,${a})`);
    }
  }
}

// Персонажи на заставке, как на той самой картинке.
function drawTitleCast(ctx, t) {
  drawFreddy(ctx, 870, 285, t, { glow: true });
  drawZombie(ctx, 1020, 330, t, { cone: true, walking: true });
  drawSnake(ctx, [{ x: 1180, y: 440 }, { x: 1180, y: 520 }, { x: 1100, y: 520 }, { x: 1020, y: 520 }], 0, -1, t);
  drawAirdrop(ctx, 190, 300 + Math.sin(t) * 10, t, false);
  drawSun(ctx, 470, 470, 22, t);
  drawDice(ctx, 260, 470, 42, 5, -0.3);
  drawCreeper(ctx, 90, 450, t, { walking: true });
  drawSkibidi(ctx, 1170, 250, t, { singing: true });
}

function lightAt(n, x, y, r, a) {
  const g = n.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(0,0,0,${a})`);
  g.addColorStop(0.6, `rgba(0,0,0,${a * 0.6})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  n.fillStyle = g;
  n.fillRect(x - r, y - r, r * 2, r * 2);
}

// Ночь: темнота с «фонариком» вокруг прицела.
function drawNight(ctx, g) {
  const dark = g.state === 'title' ? 0 : g.darkness;
  if (dark <= 0.01) return;
  if (nightCanvas.width !== View.pw || nightCanvas.height !== View.ph || !nightCtx) {
    nightCanvas.width = View.pw;
    nightCanvas.height = View.ph;
    nightCtx = nightCanvas.getContext('2d');
  }
  const n = nightCtx;
  n.setTransform(View.k, 0, 0, View.k, 0, 0);
  n.globalCompositeOperation = 'source-over';
  n.clearRect(0, 0, W, H);
  const a = Math.max(0, dark - (g.gun.flash > 0 ? 0.2 : 0));
  n.fillStyle = g.bloodMoon ? `rgba(40,0,6,${a})` : `rgba(6,8,26,${a})`;
  n.fillRect(0, 0, W, H);
  n.globalCompositeOperation = 'destination-out';
  lightAt(n, Input.x, Input.y, 190, 1);
  const bc = g.tower.center;
  lightAt(n, bc.x, bc.y, 150, 0.6);
  for (const ex of g.explosions) lightAt(n, ex.x, ex.y, ex.r * 2.2, 1 - ex.t / 0.55);
  for (const it of g.items) if (it.kind === 'sun') lightAt(n, it.x, it.y, 70, 0.9);
  for (const cb of g.cannonballs) {
    const p = cb.pos;
    lightAt(n, p.x, p.y, 40 + p.s * 30, 0.8);
  }
  n.globalCompositeOperation = 'source-over';
  if (g.bloodMoon) {
    const mg = n.createRadialGradient(150, 250, 10, 150, 250, 90);
    mg.addColorStop(0, 'rgba(255,40,40,0.95)');
    mg.addColorStop(0.45, 'rgba(200,0,0,0.85)');
    mg.addColorStop(1, 'rgba(120,0,0,0)');
    n.fillStyle = mg;
    n.fillRect(60, 160, 180, 180);
  }
  ctx.drawImage(nightCanvas, 0, 0, W, H);
}

// ---------- руки: удочка и АК ----------
function drawHands(ctx, g, now) {
  const rod = g.rod;
  const tip = g.rodTip();
  let bx, by, sag = 0;
  if (rod.state === 'idle') {
    bx = tip.x + Math.sin(now * 1.7) * 5;
    by = tip.y + 110 + Math.sin(now * 2.3) * 4;
  } else if (rod.state === 'out') {
    const k = rod.t;
    bx = lerp(tip.x, rod.tx, k);
    by = lerp(tip.y, rod.ty, k) - Math.sin(k * Math.PI) * 80;
  } else {
    const k = easeInOut(rod.t);
    bx = lerp(rod.tx, tip.x, k);
    by = lerp(rod.ty, tip.y + 110, k);
    sag = 25;
  }
  drawRod(ctx, { tipX: tip.x, tipY: tip.y, bx, by, sag });
  if (rod.carry && rod.state === 'back') {
    if (rod.carry === 'crate') {
      ctx.save();
      ctx.translate(bx, by + 18);
      ctx.scale(0.5, 0.5);
      drawAirdrop(ctx, 0, 0, 0, true);
      ctx.restore();
    } else drawItemIcon(ctx, rod.carry, bx, by + 16, 30, now);
  }

  for (const tr of g.tracers) {
    line(ctx, tr.x1, tr.y1, tr.x2, tr.y2, `rgba(255,230,150,${0.8 * (1 - tr.t / 0.07)})`, tr.w || 2);
  }
  const pose = g.gunPose();
  ctx.save();
  ctx.globalAlpha = g.gunAlpha;
  ctx.translate(pose.px, pose.py);
  ctx.rotate(pose.rot);
  ctx.scale(pose.s, pose.s);
  drawWeapon(ctx, g.weapon, g.gun.flash);
  ctx.restore();
  if (g.gun.punch > 0) {
    const k = g.gun.punch / 0.4;
    drawFist(ctx, Input.x + 10, Input.y + 20 + k * 50, 2.2 - k * 0.8, '#1f1f22');
  }
}

// ---------- экранные эффекты ----------
function vignette(ctx, color, alpha, inner = 260) {
  const g = ctx.createRadialGradient(W / 2, H / 2, inner, W / 2, H / 2, 780);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, color.replace('A', alpha));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawScreenFx(ctx, g, now) {
  if (g.timeScale < 0.95) {
    const k = (1 - g.timeScale) / 0.65;
    ctx.fillStyle = `rgba(70,130,255,${0.1 * k})`;
    ctx.fillRect(0, 0, W, H);
    vignette(ctx, 'rgba(10,20,70,A)', 0.55 * k);
  }
  if (g.frostFx > 0) vignette(ctx, 'rgba(200,240,255,A)', 0.8 * g.frostFx, 200);
  if (g.starT > 0) {
    const hue = (now * 600) % 360;
    const a = Math.min(1, g.starT) * 0.5;
    const gr = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 760);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, `hsla(${hue},100%,60%,${a})`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
  }
  if (g.dogT > 0) {
    const k = g.dogT > 2 ? (2.4 - g.dogT) / 0.4 : g.dogT < 0.4 ? g.dogT / 0.4 : 1;
    drawDog(ctx, 640, 720 - easeOutCubic(clamp(k, 0, 1)) * 150, now);
  }
  if (g.hurtFlash > 0) vignette(ctx, 'rgba(220,0,0,A)', Math.min(0.8, g.hurtFlash * 1.6), 160);
  for (const c of g.cracks) {
    const a = Math.min(1, (2.6 - c.t) / 0.8);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.lineJoin = 'round';
    for (const pts of c.lines) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    circ(ctx, c.x, c.y, 14, 'rgba(255,255,255,0.25)');
    ctx.restore();
  }
  if (g.staticFx > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.6, g.staticFx * 2);
    for (let i = 0; i < 70; i++) {
      const v = Math.floor(rand(60, 255));
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, rand(0, H), W, rand(1, 4));
    }
    ctx.restore();
  }
  if (g.totemFx > 0) {
    const k = 1 - g.totemFx / 1.8;
    ctx.save();
    ctx.globalAlpha = Math.min(1, g.totemFx);
    const s = 8 + k * 10;
    drawPixel(ctx, PIX.totem, 640 - 6 * s, 340 - 6 * s - k * 80, s);
    ctx.restore();
  }
}

// ---------- интерфейс ----------
function drawHUD(ctx, g, now) {
  drawGtaHud(ctx, g, now);
  // проиграл боссу в дурака — колпак поверх значка оружия
  if (g.foolCapT > 0) {
    drawFoolCap(ctx, 48, 30 + Math.sin(now * 4) * 2, 0.55);
    text(ctx, `ДУРАК ${Math.ceil(g.foolCapT)}`, 48, 104, { font: `bold 13px ${FONT.ui}`, color: '#ffd54a', stroke: '#000', lw: 4, align: 'center' });
  }
  drawPvzBank(ctx, g, now);
  drawMinesPanel(ctx, g);
  drawMinecraftHud(ctx, g, now);
  drawPubgBars(ctx, g);
  drawCsAmmo(ctx, g);
  if (g.duel) drawOpponentPanel(ctx, g);
  drawChat(ctx, g);
  drawBanner(ctx, g);
  if (g.cheatMsg) {
    const a = Math.min(1, (4 - g.cheatMsg.t) * 2);
    ctx.globalAlpha = a;
    rr(ctx, 10, 166, 300, 46, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fill();
    text(ctx, 'Чит-код активирован', 22, 186, { font: `bold 15px ${FONT.ui}`, color: '#fff' });
    text(ctx, `${g.cheatMsg.name}: ${g.cheatMsg.text}`, 22, 204, { font: `13px ${FONT.ui}`, color: '#cfd8dc' });
    ctx.globalAlpha = 1;
  }
  if (g.weaponNameT > 0 && g.arsenal[g.weapon]) {
    ctx.globalAlpha = Math.min(1, g.weaponNameT * 2);
    text(ctx, WEAPONS[g.weapon].name, 1270, 630, { font: `30px ${FONT.gta}`, color: '#ffd54a', align: 'right', stroke: '#000', lw: 5 });
    ctx.globalAlpha = 1;
  }
  if (g.pendingThrow) {
    const name = g.pendingThrow === 'he' ? 'гранату' : 'динамит';
    rr(ctx, 440, 176, 400, 40, 20);
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fill();
    text(ctx, `Коснись доски — бросить ${name}`, 640, 202, { font: `bold 18px ${FONT.ui}`, color: '#ffd54a', align: 'center' });
  }
  if (g.starT > 0) text(ctx, `★ ЗВЕЗДА ${Math.ceil(g.starT)}`, 640, 640, { font: `bold 16px ${FONT.ui}`, color: `hsl(${(now * 600) % 360},100%,70%)`, align: 'center', stroke: '#000', lw: 4 });
  if (g.dice) {
    const d = g.dice;
    const rot = d.t < d.dur ? d.t * 14 : 0;
    const sc = d.t < d.dur ? 1 : 1 + Math.sin(Math.min(1, (d.t - d.dur) * 4) * Math.PI) * 0.25;
    ell(ctx, 640, 455, 50, 10, 'rgba(0,0,0,0.3)');
    drawDice(ctx, 640, 400, 90 * sc, d.shown, rot);
  }
  for (const f of g.flyers) {
    const k = easeInOut(Math.min(1, f.t));
    drawItemIcon(ctx, f.key, lerp(f.x0, f.x1, k), lerp(f.y0, f.y1, k) - Math.sin(k * Math.PI) * 90, 30, now);
  }
}

function drawGtaHud(ctx, g, now) {
  const p = g.player;
  rr(ctx, 10, 10, 76, 76, 12);
  const wg = ctx.createRadialGradient(48, 44, 5, 48, 48, 50);
  wg.addColorStop(0, '#ffffff');
  wg.addColorStop(1, '#cfcfcf');
  ctx.fillStyle = wg;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#111';
  ctx.stroke();
  const a = g.cur;
  if (a.mag + a.reserve === 0 && !g.infAmmo) drawFist(ctx, 48, 46, 1.2, '#1a1a1a');
  else {
    drawWeaponIcon(ctx, g.weapon, 48, 42);
    text(ctx, g.infAmmo ? '∞' : `${a.mag}-${a.reserve}`, 48, 78, { font: `bold 12px ${FONT.ui}`, color: '#111', align: 'center' });
  }
  const hh = Math.floor(g.hours), mm = Math.floor(g.clock % 60);
  text(ctx, `${pad(hh, 2)}:${pad(mm, 2)}`, 98, 40, { font: `32px ${FONT.gta}`, color: '#e8e8e8', stroke: '#000', lw: 6 });
  const ratio = clamp(p.hp / p.maxHp, 0, 1);
  ctx.fillStyle = '#000';
  ctx.fillRect(96, 48, 196, 16);
  ctx.fillStyle = '#4d0a0a';
  ctx.fillRect(98, 50, 192, 12);
  if (!(ratio < 0.3 && Math.floor(now * 4) % 2)) {
    ctx.fillStyle = '#d6201f';
    ctx.fillRect(98, 50, 192 * ratio, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(98, 50, 192 * ratio, 4);
  }
  text(ctx, `$${pad(p.money, 8)}`, 12, 124, { font: `40px ${FONT.gta}`, color: '#2f8a3a', stroke: '#000', lw: 7 });
  for (let i = 0; i < 6; i++) {
    const on = i < g.stars;
    const blink = g.starFlash > 0 && i === g.stars - 1 && Math.floor(now * 8) % 2 === 0;
    drawStar(ctx, 24 + i * 28, 148, 12, on ? (blink ? '#ffffff' : '#ffd23f') : 'rgba(40,40,40,0.35)', on ? '#4a3500' : 'rgba(0,0,0,0.45)');
  }
}

function drawPvzBank(ctx, g, now) {
  const b = LAYOUT.bank;
  rr(ctx, b.x, b.y, b.w, b.h, 9);
  ctx.fillStyle = '#6d4518';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#3e2508';
  ctx.stroke();
  rr(ctx, b.x + 5, b.y + 5, 60, b.h - 10, 6);
  ctx.fillStyle = '#8a5a26';
  ctx.fill();
  drawSun(ctx, b.x + 35, b.y + 29, 16, now);
  rr(ctx, b.x + 9, b.y + 54, 52, 20, 5);
  ctx.fillStyle = '#f1e6c0';
  ctx.fill();
  text(ctx, String(g.sun), b.x + 35, b.y + 69, { font: `bold 15px ${FONT.ui}`, color: '#111', align: 'center' });
  PACKETS.forEach((type, i) => {
    const r = packetRect(i);
    const st = DEF_STATS[type];
    const sel = g.packet === type;
    rr(ctx, r.x, r.y, r.w, r.h, 6);
    ctx.fillStyle = '#e8dca8';
    ctx.fill();
    ctx.lineWidth = sel ? 4 : 2;
    ctx.strokeStyle = sel ? '#ffeb3b' : '#7a6230';
    ctx.stroke();
    rr(ctx, r.x + 4, r.y + 4, r.w - 8, 44, 4);
    ctx.fillStyle = '#9ccc65';
    ctx.fill();
    if (st.plant) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x + 4, r.y + 4, r.w - 8, 44);
      ctx.clip();
      ctx.translate(r.x + r.w / 2, r.y + 30);
      ctx.scale(0.55, 0.55);
      drawPlant(ctx, type, 0, 0, now);
      ctx.restore();
    } else drawPiece(ctx, st.piece, true, r.x + r.w / 2, r.y + 27, 34, { shadow: false });
    text(ctx, String(st.cost), r.x + r.w / 2, r.y + r.h - 6, { font: `bold 15px ${FONT.ui}`, color: '#111', align: 'center' });
    if (g.sun < st.cost) {
      rr(ctx, r.x, r.y, r.w, r.h, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();
    }
  });
}

function drawMinesPanel(ctx, g) {
  const l = LAYOUT.led;
  bevel(ctx, l.x, l.y, l.w, l.h, true, 3);
  drawLed(ctx, g.mf.minesLeft, l.x + 8, l.y + 6);
  bevel(ctx, l.x + l.w / 2 - 19, l.y + 6, 38, 36, true, 3);
  drawSmiley(ctx, l.x + l.w / 2, l.y + 24, 13, g.smiley);
  drawLed(ctx, Math.floor(g.mf.time), l.x + l.w - 74, l.y + 6);
}

function drawMinecraftHud(ctx, g, now) {
  const p = g.player;
  const hb = LAYOUT.hotbar;
  const S = hb.slot;
  const x0 = hb.x;
  const ps = 2.5;
  const low = p.hp <= 4;
  for (let i = 0; i < 10; i++) {
    let hx = x0 + i * 19, hy = 649;
    if (g.heartShake > 0 || low) hy += Math.round(rand(-1.5, 1.5));
    drawPixel(ctx, PIX.heartEmpty, hx, hy, ps);
    if (p.hp >= (i + 1) * 2) drawPixel(ctx, PIX.heart, hx, hy, ps);
    else if (p.hp >= i * 2 + 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(hx, hy, 3.5 * ps, 8 * ps);
      ctx.clip();
      drawPixel(ctx, PIX.heart, hx, hy, ps);
      ctx.restore();
    }
  }
  for (let i = 0; i < 10; i++) {
    const fx = x0 + 9 * S - (i + 1) * 19 + 1, fy = 649;
    drawPixel(ctx, PIX.foodEmpty, fx, fy, ps);
    if (p.hunger >= (i + 1) * 2) drawPixel(ctx, PIX.food, fx, fy, ps);
    else if (p.hunger >= i * 2 + 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(fx + 3.5 * ps, fy, 4 * ps, 8 * ps);
      ctx.clip();
      drawPixel(ctx, PIX.food, fx, fy, ps);
      ctx.restore();
    }
  }
  ctx.fillStyle = '#111';
  ctx.fillRect(x0, 668, 9 * S, 5);
  ctx.fillStyle = '#7ee03c';
  ctx.fillRect(x0, 668, 9 * S * clamp(p.xp / g.xpNeed(), 0, 1), 5);
  if (p.level > 0) text(ctx, String(p.level), 640, 668, { font: `11px ${FONT.pixel}`, color: '#80ff20', stroke: '#000', lw: 4, align: 'center' });
  ctx.fillStyle = 'rgba(15,15,15,0.65)';
  ctx.fillRect(x0 - 3, hb.y - 3, 9 * S + 6, S + 6);
  HOTBAR.forEach((key, i) => {
    const r = hotbarSlotRect(i);
    ctx.fillStyle = 'rgba(139,139,139,0.35)';
    ctx.fillRect(r.x + 2, r.y + 2, S - 4, S - 4);
    ctx.strokeStyle = '#5a5a5a';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x + 1, r.y + 1, S - 2, S - 2);
    const n = g.inv[key] || 0;
    ctx.save();
    if (!n) ctx.globalAlpha = 0.25;
    drawItemIcon(ctx, key, r.x + S / 2, r.y + S / 2, 32, now);
    ctx.restore();
    if (n > 1) text(ctx, String(n), r.x + S - 3, r.y + S - 3, { font: `11px ${FONT.pixel}`, color: '#fff', align: 'right', shadow: '#3f3f3f', sx: 2, sy: 2 });
    text(ctx, String(i + 1), r.x + 4, r.y + 12, { font: `bold 10px ${FONT.ui}`, color: 'rgba(255,255,255,0.75)' });
    if (g.slotFlash[i] > 0) {
      ctx.fillStyle = `rgba(255,255,255,${g.slotFlash[i]})`;
      ctx.fillRect(r.x + 2, r.y + 2, S - 4, S - 4);
    }
  });
  const sr = hotbarSlotRect(g.sel);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#000';
  ctx.strokeRect(sr.x - 2, sr.y - 2, S + 4, S + 4);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(sr.x - 2, sr.y - 2, S + 4, S + 4);
  // название предмета под курсором мыши
  for (let i = 0; i < 9; i++) {
    if (inRect(Input.x, Input.y, hotbarSlotRect(i))) {
      const info = ITEM_INFO[HOTBAR[i]];
      const str = `${info.name} — ${info.desc}`;
      ctx.font = `bold 14px ${FONT.ui}`;
      const w = ctx.measureText(str).width + 16;
      const tx = clamp(Input.x - w / 2, 4, W - w - 4);
      rr(ctx, tx, 620, w, 24, 4);
      ctx.fillStyle = 'rgba(16,0,16,0.92)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#2b0b5c';
      ctx.stroke();
      text(ctx, str, tx + 8, 637, { font: `bold 14px ${FONT.ui}`, color: '#fff' });
    }
  }
}

function pubgBar(ctx, x, y, w, h, ratio, color, label, value) {
  rr(ctx, x, y, w, h, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();
  if (ratio > 0) {
    rr(ctx, x + 1, y + 1, (w - 2) * clamp(ratio, 0, 1), h - 2, 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  text(ctx, label, x + 5, y + h - 2.5, { font: `bold 9px ${FONT.ui}`, color: '#fff' });
  text(ctx, value, x + w - 5, y + h - 2.5, { font: `bold 9px ${FONT.ui}`, color: '#fff', align: 'right' });
}

function drawPubgBars(ctx, g) {
  const p = g.player;
  pubgBar(ctx, 236, 681, 186, 12, p.armor / 100, '#3a8ee6', 'БРОНЯ', `${Math.round(p.armor)} | 100`);
  pubgBar(ctx, 236, 700, 186, 12, p.boost / 100, g.slowmo ? '#b6ff9a' : '#43c94b', 'БУСТ · Shift', `${Math.round(p.boost)} | 100`);
}

function drawCsAmmo(ctx, g) {
  const gun = g.gun, a = g.cur;
  const col = a.mag <= Math.ceil(g.wdef.mag / 6) && !g.infAmmo ? 'rgba(255,80,60,0.95)' : 'rgba(255,184,40,0.95)';
  text(ctx, g.infAmmo ? '∞' : String(a.mag), 1194, 708, { font: `42px ${FONT.gta}`, color: col, align: 'right', stroke: 'rgba(0,0,0,0.65)', lw: 5 });
  text(ctx, g.infAmmo ? '| ∞' : `| ${a.reserve}`, 1270, 708, { font: `26px ${FONT.gta}`, color: col, align: 'right', stroke: 'rgba(0,0,0,0.65)', lw: 5 });
  ctx.fillStyle = col;
  rr(ctx, 1124, 678, 8, 26, 3);
  ctx.fill();
  drawGrenade(ctx, 1076, 694, 1);
  text(ctx, `×${g.grenades}`, 1090, 704, { font: `bold 16px ${FONT.ui}`, color: g.grenades ? '#fff' : '#888', stroke: '#000', lw: 3 });
  if (gun.reload > 0) text(ctx, 'ПЕРЕЗАРЯДКА', 1270, 664, { font: `bold 14px ${FONT.ui}`, color: '#ffd54a', align: 'right', stroke: '#000', lw: 4 });
  else if (a.mag === 0 && a.reserve === 0 && !g.infAmmo) text(ctx, Input.touch ? 'НЕТ ПАТРОНОВ — 🛒' : 'НЕТ ПАТРОНОВ — B', 1270, 664, { font: `bold 14px ${FONT.ui}`, color: '#ff5252', align: 'right', stroke: '#000', lw: 4 });
}

function drawChat(ctx, g) {
  let y = 548;
  ctx.font = `15px ${FONT.ui}`;
  for (let i = g.chat.length - 1; i >= 0; i--) {
    const m = g.chat[i];
    const a = m.t > 6.5 ? Math.max(0, (8 - m.t) / 1.5) : 1;
    ctx.font = `15px ${FONT.ui}`;
    const w = ctx.measureText(m.text).width + 14;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(8, y - 17, w, 23);
    text(ctx, m.text, 15, y, { font: `15px ${FONT.ui}`, color: m.color, shadow: 'rgba(0,0,0,0.7)', sx: 1, sy: 1 });
    y -= 25;
  }
  ctx.globalAlpha = 1;
}

function drawBanner(ctx, g) {
  const b = g.bannerObj;
  if (!b) return;
  const a = Math.min(1, b.t * 5, (b.dur - b.t) * 3);
  const sc = 1 + Math.max(0, 0.25 - b.t) * 1.6;
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.translate(640, 288);
  ctx.scale(sc, sc);
  text(ctx, b.title, 0, 0, { font: `60px ${FONT.title}`, color: b.color, stroke: '#000', lw: 10, align: 'center' });
  if (b.sub) text(ctx, b.sub, 0, 38, { font: `bold 22px ${FONT.ui}`, color: '#fff', stroke: '#000', lw: 5, align: 'center' });
  ctx.restore();
}

function drawCrosshair(ctx, g) {
  const gun = g.gun;
  const x = Input.x, y = Input.y;
  if (Input.touch && (Input.mode !== 'shoot' || g.pendingThrow)) {
    // на телефоне вместо прицела — значок режима касания
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, TAU);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    const icon = g.pendingThrow ? (g.pendingThrow === 'he' ? '💣' : '🧨') : Input.mode === 'rod' ? '🎣' : '🚩';
    text(ctx, icon, x, y + 8, { font: `22px ${FONT.ui}`, align: 'center' });
    return;
  }
  if (g.weapon === 'awp') {
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, TAU);
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 3;
    ctx.stroke();
    line(ctx, x - 44, y, x - 6, y, '#000', 2);
    line(ctx, x + 6, y, x + 44, y, '#000', 2);
    line(ctx, x, y - 44, x, y - 6, '#000', 2);
    line(ctx, x, y + 6, x, y + 44, '#000', 2);
    circ(ctx, x, y, 2.5, '#ff1744');
  } else if (g.weapon === 'nova') {
    ctx.beginPath();
    ctx.arc(x, y, WEAPONS.nova.spread, 0, TAU);
    ctx.strokeStyle = 'rgba(57,255,20,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    circ(ctx, x, y, 3, '#39ff14');
  }
  if (g.weapon !== 'ak') {
    if (gun.reload > 0) {
      const p = 1 - gun.reload / g.wdef.reload;
      ctx.beginPath();
      ctx.arc(x, y, 24, -Math.PI / 2, -Math.PI / 2 + p * TAU);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (gun.cd > 0) {
      ctx.beginPath();
      ctx.arc(x, y, 36, -Math.PI / 2, -Math.PI / 2 + (1 - gun.cd / g.wdef.interval) * TAU);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    return;
  }
  const gap = 5 + gun.heat * 22, len = 9;
  const segs = [[x - gap - len, y, x - gap, y], [x + gap, y, x + gap + len, y], [x, y - gap - len, x, y - gap], [x, y + gap, x, y + gap + len]];
  for (const s of segs) line(ctx, s[0], s[1], s[2], s[3], 'rgba(0,0,0,0.7)', 4);
  for (const s of segs) line(ctx, s[0], s[1], s[2], s[3], '#39ff14', 2);
  if (gun.reload > 0) {
    const p = 1 - gun.reload / g.wdef.reload;
    ctx.beginPath();
    ctx.arc(x, y, 24, -Math.PI / 2, -Math.PI / 2 + p * TAU);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function drawPointer(ctx) {
  const x = Input.x, y = Input.y;
  poly(ctx, [x, y, x, y + 20, x + 5, y + 15, x + 9, y + 24, x + 12, y + 22, x + 8, y + 14, x + 15, y + 14], '#fff', '#000', 3);
  poly(ctx, [x, y, x, y + 20, x + 5, y + 15, x + 9, y + 24, x + 12, y + 22, x + 8, y + 14, x + 15, y + 14], '#fff');
}

// ---------- экраны ----------
function mcButton(ctx, g, label, x, y, w, h, action, o = {}) {
  const hov = inRect(Input.x, Input.y, { x, y, w, h });
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = hov ? '#8592c9' : o.fill || '#7a7a7a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = hov ? '#b9c4f0' : '#a8a8a8';
  ctx.fillRect(x, y, w, 3);
  ctx.fillRect(x, y, 3, h);
  ctx.fillStyle = hov ? '#4f5d99' : '#4a4a4a';
  ctx.fillRect(x, y + h - 4, w, 4);
  ctx.fillRect(x + w - 3, y, 3, h);
  const fs = o.size || 14;
  text(ctx, label, x + w / 2, y + h / 2 + fs * 0.45, { font: `${fs}px ${FONT.pixel}`, color: hov ? '#ffffa0' : '#fff', align: 'center', shadow: '#3f3f3f', sx: 2, sy: 2 });
  g.buttons.push({ x, y, w, h, action });
}

function toggleFullscreen() {
  if (Input.touch && window.goFullscreen) return window.goFullscreen();
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      const p = el.requestFullscreen && el.requestFullscreen();
      if (p && p.catch) p.catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  } catch (e) {
    /* полноэкранный режим недоступен */
  }
}

const CONTROLS = [
  ['ЛКМ', 'стрелять'],
  ['ПКМ', 'удочка: открыть клетку, подобрать, посадить'],
  ['F / Пробел', 'поставить или снять флажок'],
  ['R', 'перезарядка'],
  ['Колесо / X', 'сменить оружие'],
  ['B', 'меню закупки CS'],
  ['G', 'бросить HE-гранату'],
  ['1–9, E', 'предметы хотбара'],
  ['Q', 'выбрать растение или фигуру для посадки'],
  ['Shift', 'замедление времени (буст)'],
  ['Esc', 'пауза · M — звук · N — музыка'],
];

const TOUCH_CONTROLS = [
  ['Касание', 'стрелять в точку, держи — очередь'],
  ['🎣 удочка', 'открыть клетку, подобрать, посадить'],
  ['🚩 флажок', 'ставить и снимать флажки'],
  ['💣 граната', 'нажми, потом коснись цели'],
  ['⏳ держи', 'замедление времени'],
  ['🛒 🔄 🔁', 'закупка, перезарядка, оружие'],
  ['Хотбар', 'коснись предмета — использовать'],
  ['Растения', 'выбери карточку справа вверху'],
];

function drawControls(ctx, x, y) {
  (Input.touch ? TOUCH_CONTROLS : CONTROLS).forEach(([k, v], i) => {
    const yy = y + i * 22;
    ctx.font = `bold 14px ${FONT.ui}`;
    const w = ctx.measureText(k).width + 14;
    rr(ctx, x, yy - 15, w, 20, 5);
    ctx.fillStyle = '#e8e8e8';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#555';
    ctx.stroke();
    text(ctx, k, x + 7, yy, { font: `bold 14px ${FONT.ui}`, color: '#111' });
    text(ctx, v, x + w + 9, yy, { font: `14px ${FONT.ui}`, color: '#eef3e6' });
  });
}

// Жёлтая надпись у логотипа — как в Minecraft, при каждом запуске своя.
const TITLE_SPLASH = choice(['Козыри — черви!', 'СИУУУ!', 'ФУС РО ДА!', 'Теперь с Сансом!', 'Впиши ник в зал славы!', 'Музыка как в Hotline Miami!', 'Хочешь дуэль?', 'HESOYAM!']);

function drawTitle(ctx, g, now) {
  ctx.fillStyle = 'rgba(8,12,6,0.66)';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(640, 130);
  ctx.rotate(-0.035 + Math.sin(now * 1.5) * 0.012);
  const tg = ctx.createLinearGradient(0, -60, 0, 20);
  tg.addColorStop(0, '#fff59d');
  tg.addColorStop(0.5, '#ffca28');
  tg.addColorStop(1, '#ff6f00');
  text(ctx, 'ХАОС-ДОСКА', 6, 8, { font: `104px ${FONT.title}`, color: '#7a1010', align: 'center' });
  text(ctx, 'ХАОС-ДОСКА', 0, 0, { font: `104px ${FONT.title}`, color: tg, stroke: '#1a0b00', lw: 14, align: 'center' });
  ctx.restore();
  // жёлтая надпись-сплэш, как в Minecraft; длинная — мельче, чтобы не наезжала на логотип
  ctx.save();
  ctx.translate(985, 150);
  ctx.rotate(-0.33);
  ctx.font = `bold 26px ${FONT.ui}`;
  const sk = Math.min(1, 230 / ctx.measureText(TITLE_SPLASH).width) * (1 + Math.sin(now * 6) * 0.06);
  ctx.scale(sk, sk);
  text(ctx, TITLE_SPLASH, 0, 0, { font: `bold 26px ${FONT.ui}`, color: '#ffff3c', stroke: '#3a3a00', lw: 5, align: 'center' });
  ctx.restore();
  text(ctx, 'шахматы × сапёр × CS × Minecraft × GTA × PvZ × FNAF × Clash Royale × Pac-Man × PUBG × змейка × Mario × Duck Hunt × Among Us × скибиди', 640, 198, { font: `bold 15px ${FONT.ui}`, color: '#d7e8c4', align: 'center', stroke: 'rgba(0,0,0,0.6)', lw: 4 });
  // «ИГРАТЬ» — посередине, мультиплеер — сразу справа, как раньше
  mcButton(ctx, g, 'УРОВНИ', 215, 226, 150, 56, () => (g.state = 'levels'), { size: 12 });
  mcButton(ctx, g, 'ДУРАК', 375, 226, 140, 56, () => Durak.start(g, 'bot'), { size: 14, fill: '#2e7d32' });
  mcButton(ctx, g, 'ИГРАТЬ', 525, 226, 230, 56, () => g.start(), { size: 22 });
  mcButton(ctx, g, 'МУЛЬТИПЛЕЕР', 765, 226, 190, 56, () => Duel.open(g), { size: 12, fill: '#8a4a3a' });
  text(ctx, 'с другом по сети', 860, 298, { font: `bold 13px ${FONT.ui}`, color: '#ffccbc', align: 'center', stroke: 'rgba(0,0,0,0.6)', lw: 3 });
  mcButton(ctx, g, `ДОСТИЖЕНИЯ ${Ach.got.size}/${ACHIEVEMENTS.length}`, 965, 226, 150, 56, () => (g.state = 'achievements'), { size: 7 });
  mcButton(ctx, g, `НИК: ${Duel.name}`, 20, 16, 250, 44, () => Top.editNick(), { size: 9, fill: '#8a4a3a' });
  mcButton(ctx, g, 'ЗАЛ СЛАВЫ', 1030, 16, 230, 44, () => Top.open(g), { size: 12, fill: '#c2185b' });

  rr(ctx, 210, 306, 860, 296, 14);
  ctx.fillStyle = 'rgba(10,16,8,0.78)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(200,230,170,0.35)';
  ctx.stroke();
  text(ctx, 'УПРАВЛЕНИЕ', 240, 338, { font: `13px ${FONT.pixel}`, color: '#ffd54a' });
  drawControls(ctx, 240, 370);
  text(ctx, 'КАК ПОБЕДИТЬ', 690, 338, { font: `13px ${FONT.pixel}`, color: '#ffd54a' });
  const goals = [
    '5 уровней — 5 боссов, босс сверху доски.',
    'Открывай клетки сапёра удочкой — за них',
    'дают деньги, патроны и предметы.',
    'Флажок на мине = ловушка для врагов.',
    'Очистишь поле — мины полетят в босса.',
    'Не пускай врагов к белым фигурам.',
    'Сбивай снаряды босса, пока не прилетели.',
    'В полночь приходит Золотой Фредди...',
    'Деньги тратятся в меню закупки (B).',
    'Говорят, тут работают читы из GTA SA...',
  ];
  goals.forEach((s, i) => text(ctx, s, 690, 370 + i * 22, { font: `14px ${FONT.ui}`, color: '#eef3e6' }));

  text(ctx, `Рекорд: $${pad(g.best, 8)}`, 640, 636, { font: `30px ${FONT.gta}`, color: '#3fbf4a', stroke: '#000', lw: 6, align: 'center' });
  mcButton(ctx, g, 'ПОЛНЫЙ ЭКРАН', 1020, 662, 240, 40, toggleFullscreen, { size: 11 });
  text(ctx, `версия ${GAME_VERSION} · новое: дурак с боссом (чит DURAK), футболист №7 (SIUUU), драугр, музыка (${Input.touch ? 'в паузе' : 'N'})`, 1260, 648, { font: `bold 14px ${FONT.ui}`, color: 'rgba(255,255,255,0.7)', align: 'right', stroke: 'rgba(0,0,0,0.5)', lw: 3 });
  mcButton(ctx, g, Sound.muted ? 'ЗВУК: ВЫКЛ' : 'ЗВУК: ВКЛ', 20, 662, 200, 40, () => Sound.toggleMute(), { size: 11 });
  text(ctx, Input.touch ? 'Нажми «Играть»' : 'Нажми «Играть» или Enter', 640, 684, { font: `bold 15px ${FONT.ui}`, color: 'rgba(255,255,255,0.75)', align: 'center' });
  if (Input.touch) text(ctx, 'На телефоне: режимы и действия — кнопками по краям экрана', 640, 706, { font: `bold 14px ${FONT.ui}`, color: '#ffe082', align: 'center' });
}

function drawPause(ctx, g) {
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, 'ПАУЗА', 640, 118, { font: `64px ${FONT.title}`, color: '#fff', stroke: '#000', lw: 10, align: 'center' });
  const bx = 640 - 160;
  mcButton(ctx, g, 'ПРОДОЛЖИТЬ', bx, 150, 320, 42, () => g.resume());
  if (g.duel) text(ctx, 'Дуэль идёт — соперник не на паузе!', 640, 228, { font: `bold 18px ${FONT.ui}`, color: '#ffab91', align: 'center', stroke: '#000', lw: 4 });
  else mcButton(ctx, g, 'ЗАНОВО ЭТОТ УРОВЕНЬ', bx, 200, 320, 42, () => g.retry());
  mcButton(ctx, g, Sound.muted ? 'ЗВУК: ВЫКЛ' : 'ЗВУК: ВКЛ', bx, 250, 156, 42, () => Sound.toggleMute(), { size: 10 });
  mcButton(ctx, g, Music.on ? 'МУЗЫКА: ВКЛ' : 'МУЗЫКА: ВЫКЛ', bx + 164, 250, 156, 42, () => Music.toggle(), { size: 10 });
  mcButton(ctx, g, 'ПОЛНЫЙ ЭКРАН', bx, 300, 320, 42, toggleFullscreen);
  mcButton(ctx, g, 'В ГЛАВНОЕ МЕНЮ', bx, 350, 320, 42, () => g.toTitle());
  if (Input.touch && !g.duel) mcButton(ctx, g, 'ЧИТ-КОДЫ', bx, 400, 320, 42, () => (g.state = 'cheats'));
  const py = Input.touch ? 456 : 410;
  rr(ctx, 380, py, 520, 712 - py, 12);
  ctx.fillStyle = 'rgba(10,16,8,0.8)';
  ctx.fill();
  drawControls(ctx, 404, py + 30);
  if (!Input.touch) text(ctx, 'Псс... попробуй набрать HESOYAM', 640, 684, { font: `13px ${FONT.ui}`, color: 'rgba(255,255,255,0.45)', align: 'center' });
}

function statsLines(g) {
  const p = g.player;
  const mins = Math.floor(g.runT / 60), secs = Math.floor(g.runT % 60);
  return [
    ['Заработано', `$${p.earned}`],
    ['Врагов повержено', String(g.kills)],
    ['Клеток открыто', String(g.tilesOpened)],
    ['Полей сапёра пройдено', String(g.totalFields)],
    ['Уровень игрока', String(p.level)],
    ['Утки / Время', `${g.ducksShot} / ${mins}:${pad(secs, 2)}`],
  ];
}

function drawStats(ctx, g, y) {
  rr(ctx, 440, y, 400, 190, 12);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fill();
  statsLines(g).forEach(([k, v], i) => {
    text(ctx, k, 464, y + 32 + i * 27, { font: `16px ${FONT.ui}`, color: '#ddd' });
    text(ctx, v, 816, y + 32 + i * 27, { font: `bold 17px ${FONT.ui}`, color: '#fff', align: 'right' });
  });
  if (g.cheated) text(ctx, 'ЧИТЕР! Рекорд не засчитан', 640, y + 222, { font: `22px ${FONT.title}`, color: '#ff8a80', stroke: '#000', lw: 6, align: 'center' });
  else if (g.newRecord) text(ctx, 'НОВЫЙ РЕКОРД!', 640, y + 222, { font: `24px ${FONT.title}`, color: '#ffd54a', stroke: '#000', lw: 6, align: 'center' });
}

function drawDead(ctx, g, now) {
  const k = Math.min(1, g.deadT / 1.2);
  ctx.save();
  ctx.globalCompositeOperation = 'saturation';
  ctx.globalAlpha = k;
  ctx.fillStyle = 'hsl(0,0%,50%)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  ctx.fillStyle = `rgba(0,0,0,${0.35 * k})`;
  ctx.fillRect(0, 0, W, H);
  if (g.deadT > 0.7) {
    const a = Math.min(1, (g.deadT - 0.7) * 3);
    const sc = 1 + Math.max(0, 1 - (g.deadT - 0.7) * 4) * 0.6;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 150, W, 120);
    ctx.translate(640, 245);
    ctx.scale(sc, sc);
    text(ctx, 'WASTED', 0, 0, { font: `112px ${FONT.gta}`, color: '#c62828', stroke: '#000', lw: 8, align: 'center' });
    ctx.restore();
  }
  if (g.deadT > 1.5) {
    text(ctx, `Причина: ${g.deathCause}`, 640, 300, { font: `bold 18px ${FONT.ui}`, color: '#ffcdd2', stroke: '#000', lw: 4, align: 'center' });
    drawStats(ctx, g, 318);
    if (g.duel) drawDuelButtons(ctx, g, 560 + (g.newRecord || g.cheated ? 20 : 0));
    else {
      drawTopPanel(ctx, g, now);
      mcButton(ctx, g, 'ЕЩЁ РАЗ', 640 - 250, 560 + (g.newRecord || g.cheated ? 20 : 0), 240, 46, () => g.retry());
      mcButton(ctx, g, 'В МЕНЮ', 640 + 10, 560 + (g.newRecord || g.cheated ? 20 : 0), 240, 46, () => g.toTitle());
    }
  }
}

function drawWin(ctx, g, now) {
  ctx.fillStyle = `rgba(0,0,0,${Math.min(0.55, g.winT * 0.6)})`;
  ctx.fillRect(0, 0, W, H);
  const a = Math.min(1, g.winT * 2);
  ctx.globalAlpha = a;
  const final = g.levelIdx >= LEVELS.length - 1;
  text(ctx, final ? 'ХАОС ПОБЕЖДЁН!' : 'MISSION PASSED!', 640, 130, { font: `${final ? 76 : 88}px ${final ? FONT.title : FONT.gta}`, color: '#f2c230', stroke: '#000', lw: 9, align: 'center' });
  text(ctx, 'RESPECT +', 640, 182, { font: `40px ${FONT.gta}`, color: '#fff', stroke: '#000', lw: 6, align: 'center' });
  for (let i = 0; i < 3; i++) {
    const k = clamp((g.winT - 0.5 - i * 0.35) * 3, 0, 1);
    if (k <= 0) continue;
    const s = 3.2 * (k < 1 ? easeOutCubic(k) * 1.25 : 1) + Math.sin(now * 3 + i) * 0.1;
    drawCrown(ctx, 540 + i * 100, 238, s);
  }
  ctx.globalAlpha = 1;
  if (g.winT > 1.5) {
    const line1 = final ? 'Все 5 боссов повержены. Ты прошёл Хаос-Доску! · #1 VICTORY ROYALE' : `${g.tower.deathText}. +$10000 · уровень ${g.levelIdx + 2} открыт`;
    text(ctx, line1, 640, 300, { font: `bold 18px ${FONT.ui}`, color: '#c8f7a0', stroke: '#000', lw: 4, align: 'center' });
    drawStats(ctx, g, 318);
    const by = 560 + (g.newRecord || g.cheated ? 20 : 0);
    if (g.duel) drawDuelButtons(ctx, g, by);
    else {
      drawTopPanel(ctx, g, now);
      if (final) mcButton(ctx, g, 'С НАЧАЛА', 640 - 250, by, 240, 46, () => g.startCampaign(0));
      else mcButton(ctx, g, 'ДАЛЬШЕ ▶', 640 - 250, by, 240, 46, () => g.nextLevel());
      mcButton(ctx, g, 'В МЕНЮ', 640 + 10, by, 240, 46, () => g.toTitle());
    }
  }
}

function drawJumpscare(ctx, g, now) {
  const k = g.jumpscare.t;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const sc = 10 + k * 4;
  ctx.save();
  ctx.translate(640 + rand(-18, 18), 380 + 32 * sc + rand(-18, 18));
  drawFreddy(ctx, 0, 0, now, { face: true, scale: sc, scream: true, glow: true });
  ctx.restore();
  if (Math.random() < 0.5) {
    ctx.fillStyle = 'rgba(180,0,0,0.25)';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 40; i++) {
    const v = Math.floor(rand(80, 255));
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, rand(0, H), W, rand(1, 3));
  }
  ctx.globalAlpha = 1;
}

// ---------- меню закупки в стиле CS 1.6 ----------
function drawBuyIcon(ctx, key, x, y) {
  if (key === 'awp' || key === 'nova') drawWeaponIcon(ctx, key, x, y);
  else if (key === 'he') drawGrenade(ctx, x, y, 1.3);
  else if (key === 'kevlar') drawVest(ctx, x, y, 34);
  else if (key === 'ammo') drawAmmoBox(ctx, x, y, 36);
  else if (key === 'detector') {
    drawMine(ctx, x - 6, y + 4, 9);
    drawFlag(ctx, x + 8, y - 2, 0.9);
  }
}

function drawBuy(ctx, g) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, W, H);
  rr(ctx, 40, 90, 580, 566, 8);
  ctx.fillStyle = 'rgba(22,20,10,0.9)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,176,32,0.6)';
  ctx.stroke();
  text(ctx, 'МЕНЮ ЗАКУПКИ', 70, 136, { font: `30px ${FONT.gta}`, color: '#ffb020' });
  text(ctx, `$${g.player.money}`, 590, 136, { font: `28px ${FONT.gta}`, color: '#7ee05a', align: 'right' });
  BUY_ITEMS.forEach((it, i) => {
    const r = buyRect(i);
    const hov = inRect(Input.x, Input.y, r);
    const owned = (it.key === 'awp' || it.key === 'nova') && g.arsenal[it.key].owned;
    const can = g.player.money >= it.price && !owned;
    rr(ctx, r.x, r.y, r.w, r.h, 5);
    ctx.fillStyle = hov ? 'rgba(255,176,32,0.22)' : 'rgba(255,255,255,0.05)';
    ctx.fill();
    drawBuyIcon(ctx, it.key, r.x + 44, r.y + r.h / 2);
    text(ctx, `${i + 1}. ${it.name}`, r.x + 92, r.y + 24, { font: `bold 19px ${FONT.ui}`, color: can ? '#ffb020' : '#7a6a4a' });
    text(ctx, it.desc, r.x + 92, r.y + 44, { font: `14px ${FONT.ui}`, color: can ? '#d9cfae' : '#7d7562' });
    text(ctx, owned ? 'есть' : `$${it.price}`, r.x + r.w - 14, r.y + 36, { font: `24px ${FONT.gta}`, color: can ? '#ffd54a' : '#8a6a3a', align: 'right' });
    g.buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, action: () => g.buy(i) });
  });
  if (g.buyMsg) text(ctx, g.buyMsg.text, 330, 562, { font: `bold 17px ${FONT.ui}`, color: g.buyMsg.bad ? '#ff8a80' : '#a5f07a', align: 'center' });
  mcButton(ctx, g, 'ЗАКРЫТЬ (B)', 240, 584, 180, 36, () => g.closeBuy(), { size: 11 });
  text(ctx, '1–6 или клик — купить. Пока меню открыто, игра на паузе.', 330, 642, { font: `13px ${FONT.ui}`, color: '#a8a08a', align: 'center' });
}

// ---------- экстренное собрание (Among Us) ----------
function drawMeeting(ctx, g, now) {
  const m = g.meeting;
  if (m.t < 2.2) {
    const k = Math.min(1, m.t * 4);
    ctx.fillStyle = `rgba(70,0,0,${0.8 * k})`;
    ctx.fillRect(0, 0, W, H);
    ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#f5f5f5'].forEach((c, i) => {
      drawCrewmate(ctx, 340 + i * 150, 480 + Math.sin(now * 4 + i) * 5, 1.3, c);
    });
    const sc = 1 + Math.max(0, 0.3 - m.t) * 2;
    ctx.save();
    ctx.translate(640, 230);
    ctx.scale(sc, sc);
    text(ctx, 'ЭКСТРЕННОЕ', 0, -40, { font: `78px ${FONT.title}`, color: '#ff1744', stroke: '#fff', lw: 10, align: 'center' });
    text(ctx, 'СОБРАНИЕ', 0, 46, { font: `78px ${FONT.title}`, color: '#ff1744', stroke: '#fff', lw: 10, align: 'center' });
    ctx.restore();
    text(ctx, 'Среди врагов кто-то очень подозрительный...', 640, 352, { font: `bold 22px ${FONT.ui}`, color: '#fff', stroke: '#000', lw: 5, align: 'center' });
    return;
  }
  ctx.fillStyle = '#05050f';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 140; i++) {
    const sx = (((i * 137.5) % W) - (m.t - 2.2) * (20 + (i % 5) * 15) + W) % W;
    const sy = (i * 71.3) % H;
    ctx.fillStyle = `rgba(255,255,255,${0.3 + (i % 4) * 0.18})`;
    ctx.fillRect(sx, sy, 2, 2);
  }
  const k = (m.t - 2.2) / 3;
  ctx.save();
  ctx.translate(lerp(-90, W + 90, k), 320 + Math.sin(k * 6) * 30);
  ctx.rotate(k * 12);
  drawCrewmate(ctx, 0, 0, 1.2, m.color);
  ctx.restore();
  const full = `${m.name} был предателем.`;
  const n = Math.floor(clamp((m.t - 2.6) * 22, 0, full.length));
  text(ctx, full.slice(0, n), 640, 470, { font: `bold 34px ${FONT.ui}`, color: '#fff', align: 'center' });
  if (m.t > 4) text(ctx, 'Осталось предателей: 0', 640, 515, { font: `22px ${FONT.ui}`, color: '#bdbdbd', align: 'center' });
}

// ---------- кампания: заставка уровня, выбор уровня, достижения ----------
const PORTRAIT_SCALE = { tower: 0.7, bowser: 1.0, dragon: 0.45, heli: 0.55, titan: 0.62 };

function wrapText(ctx, str, x, y, maxW, lineH, o) {
  ctx.font = o.font;
  const words = str.split(' ');
  let lineStr = '', yy = y;
  for (const w of words) {
    const test = lineStr ? lineStr + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && lineStr) {
      text(ctx, lineStr, x, yy, o);
      lineStr = w;
      yy += lineH;
    } else lineStr = test;
  }
  if (lineStr) text(ctx, lineStr, x, yy, o);
  return yy + lineH;
}

function drawIntro(ctx, g, now) {
  const L = g.level;
  const k = easeOutCubic(Math.min(1, g.introT * 2.5));
  ctx.fillStyle = 'rgba(6,6,10,0.78)';
  ctx.fillRect(0, 0, W, H);
  // косые полосы как в файтингах
  ctx.save();
  ctx.globalAlpha = 0.5 * k;
  ctx.fillStyle = '#b71c1c';
  ctx.beginPath();
  ctx.moveTo(760, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, H);
  ctx.lineTo(600, H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  const lx = 80 - (1 - k) * 300;
  text(ctx, `УРОВЕНЬ ${g.levelIdx + 1} / ${LEVELS.length}`, lx, 170, { font: `16px ${FONT.pixel}`, color: '#ffd54a' });
  text(ctx, L.name.toUpperCase(), lx, 240, { font: `58px ${FONT.title}`, color: '#fff', stroke: '#000', lw: 8 });
  text(ctx, `по мотивам: ${L.ref}`, lx, 276, { font: `bold 18px ${FONT.ui}`, color: '#b0bec5' });
  let y = wrapText(ctx, L.tip, lx, 330, 540, 28, { font: `20px ${FONT.ui}`, color: '#eef3e6' });
  const names = [...new Set(L.pool.map(([t]) => ENEMY_DEF[t].name))];
  text(ctx, 'Враги уровня:', lx, y + 14, { font: `bold 16px ${FONT.ui}`, color: '#ff8a65' });
  wrapText(ctx, names.join(', '), lx, y + 40, 540, 24, { font: `16px ${FONT.ui}`, color: '#cfd8dc' });
  // портрет босса
  const px = 960 + (1 - k) * 400;
  const glow = ctx.createRadialGradient(px, 330, 10, px, 330, 260);
  glow.addColorStop(0, 'rgba(255,220,120,0.35)');
  glow.addColorStop(1, 'rgba(255,220,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(px - 260, 70, 520, 520);
  drawBossPortrait(ctx, L.boss, px, 330, PORTRAIT_SCALE[L.boss] * 1.7, now);
  text(ctx, g.tower.name.toUpperCase(), px, 560, { font: `30px ${FONT.title}`, color: '#ffd54a', stroke: '#000', lw: 6, align: 'center' });
  text(ctx, 'VS', 700, 360, { font: `110px ${FONT.gta}`, color: '#ff1744', stroke: '#fff', lw: 8, align: 'center' });
  if (Math.floor(now * 2) % 2 === 0) text(ctx, 'Клик или Enter — в бой!', 640, 670, { font: `bold 22px ${FONT.ui}`, color: '#fff', stroke: '#000', lw: 5, align: 'center' });
}

function drawLevels(ctx, g, now) {
  ctx.fillStyle = 'rgba(6,10,6,0.85)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, 'ВЫБОР УРОВНЯ', 640, 92, { font: `52px ${FONT.title}`, color: '#ffd54a', stroke: '#000', lw: 8, align: 'center' });
  LEVELS.forEach((L, i) => {
    const r = { x: 58 + i * 236, y: 140, w: 220, h: 420 };
    const locked = i > g.unlocked;
    const hov = !locked && inRect(Input.x, Input.y, r);
    const th = THEMES[L.theme];
    rr(ctx, r.x, r.y, r.w, r.h, 14);
    const bg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    bg.addColorStop(0, th.dark);
    bg.addColorStop(1, '#111');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = hov ? 5 : 2;
    ctx.strokeStyle = hov ? '#ffd54a' : 'rgba(255,255,255,0.3)';
    ctx.stroke();
    ctx.save();
    rr(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.clip();
    drawBossPortrait(ctx, L.boss, r.x + r.w / 2, r.y + 130, PORTRAIT_SCALE[L.boss], now);
    ctx.restore();
    text(ctx, `УРОВЕНЬ ${i + 1}`, r.x + r.w / 2, r.y + 270, { font: `13px ${FONT.pixel}`, color: '#ffd54a', align: 'center' });
    wrapText(ctx, L.name, r.x + r.w / 2, r.y + 306, r.w - 24, 28, { font: `24px ${FONT.title}`, color: '#fff', align: 'center', stroke: '#000', lw: 5 });
    text(ctx, L.ref, r.x + r.w / 2, r.y + 390, { font: `bold 15px ${FONT.ui}`, color: '#b0bec5', align: 'center' });
    if (locked) {
      rr(ctx, r.x, r.y, r.w, r.h, 14);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fill();
      rr(ctx, r.x + r.w / 2 - 24, r.y + 160, 48, 40, 6);
      ctx.fillStyle = '#9e9e9e';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(r.x + r.w / 2, r.y + 160, 16, Math.PI, 0);
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#9e9e9e';
      ctx.stroke();
      text(ctx, `Пройди уровень ${i}`, r.x + r.w / 2, r.y + 236, { font: `bold 15px ${FONT.ui}`, color: '#eee', align: 'center' });
    } else {
      g.buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, action: () => g.startCampaign(i) });
    }
  });
  text(ctx, 'С уровня 2 и дальше даём стартовые деньги на закупку. Рекорд считается за весь забег.', 640, 600, { font: `15px ${FONT.ui}`, color: '#b0bec5', align: 'center' });
  mcButton(ctx, g, 'НАЗАД', 540, 630, 200, 44, () => g.toTitle(), { size: 13 });
}

function drawAchievements(ctx, g) {
  ctx.fillStyle = 'rgba(6,10,6,0.88)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, 'ДОСТИЖЕНИЯ', 640, 70, { font: `46px ${FONT.title}`, color: '#7ee03c', stroke: '#000', lw: 7, align: 'center' });
  text(ctx, `Открыто: ${Ach.got.size} из ${ACHIEVEMENTS.length}`, 640, 100, { font: `bold 17px ${FONT.ui}`, color: '#cfd8dc', align: 'center' });
  const half = Math.ceil(ACHIEVEMENTS.length / 2);
  const rowH = Math.min(39, Math.floor(528 / half)), boxH = rowH - 4;
  ACHIEVEMENTS.forEach((a, i) => {
    const col = i < half ? 0 : 1, row = i % half;
    const x = 70 + col * 580, y = 116 + row * rowH;
    const got = Ach.got.has(a.id);
    rr(ctx, x, y, 560, boxH, 8);
    ctx.fillStyle = got ? 'rgba(16,124,16,0.35)' : 'rgba(255,255,255,0.06)';
    ctx.fill();
    circ(ctx, x + 20, y + boxH / 2, 12, got ? '#107c10' : '#424242');
    drawStar(ctx, x + 20, y + boxH / 2, 7, got ? '#fff' : '#757575', got ? '#0b5e0b' : '#333');
    text(ctx, a.name, x + 42, y + boxH * 0.46, { font: `bold 14px ${FONT.ui}`, color: got ? '#fff' : '#9e9e9e' });
    text(ctx, a.desc, x + 42, y + boxH * 0.88, { font: `12px ${FONT.ui}`, color: got ? '#c8e6c9' : '#757575' });
  });
  mcButton(ctx, g, 'НАЗАД', 540, 620 + 32, 200, 44, () => g.toTitle(), { size: 13 });
}

// ---------- чит-коды для телефона (набрать на клавиатуре нельзя) ----------
function drawCheats(ctx, g) {
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, 'ЧИТ-КОДЫ', 640, 110, { font: `56px ${FONT.title}`, color: '#fff', stroke: '#000', lw: 9, align: 'center' });
  text(ctx, 'Как в GTA San Andreas. С читами рекорд не засчитывается.', 640, 146, { font: `bold 16px ${FONT.ui}`, color: '#cfd8dc', align: 'center' });
  // больше восьми кодов — три колонки, чтобы подписи не налезали на кнопки
  const names = Object.keys(CHEATS), cols = names.length > 8 ? 3 : 2, bw = cols === 3 ? 330 : 320;
  const rowH = Math.min(110, Math.floor(330 / Math.ceil(names.length / cols)));
  names.forEach((name, i) => {
    const x = cols === 3 ? 95 + (i % 3) * 370 : i % 2 ? 660 : 300, y = 172 + Math.floor(i / cols) * rowH;
    mcButton(ctx, g, name, x, y, bw, 50, () => {
      g.activateCheat(name);
      g.state = 'play';
      g.suppressFire = true;
    }, { size: 16 });
    text(ctx, CHEATS[name], x + bw / 2, y + 70, { font: `15px ${FONT.ui}`, color: '#eef3e6', align: 'center' });
  });
  mcButton(ctx, g, 'НАЗАД', 540, 520, 200, 44, () => (g.state = 'pause'), { size: 13 });
}

// ---------- дуэль ----------
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

function drawDuelLobby(ctx, g, now) {
  ctx.fillStyle = 'rgba(8,8,14,0.9)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, 'ДУЭЛЬ', 640, 78, { font: `56px ${FONT.title}`, color: '#ff8a65', stroke: '#000', lw: 8, align: 'center' });
  const about = {
    arena: `Арена — PvP на одной доске: бегаете, стреляете и кидаете гранаты друг в друга. До ${ARENA.frags} фрагов или ${ARENA.time / 60} минут.`,
    raid: 'Босс-рейд — вместе пешком против босса уровня: подходите вплотную, бейте его и миньонов. Можно и одному.',
    boss: 'Классика — каждый играет свою доску против босса, а успехи прилетают сопернику «подарками».',
    durak: 'Дурак — подкидной, 36 карт, вдвоём. Кто последним остался с картами, тот и дурак. Можно и с ботом.',
  }[Duel.mode];
  wrapText(ctx, about, 640, 114, 960, 22, { font: `16px ${FONT.ui}`, color: '#cfd8dc', align: 'center' });

  const ph = Duel.phase;
  if (ph === 'connecting' || ph === 'unavailable') {
    if (ph === 'connecting') text(ctx, 'Подключение…', 640, 300, { font: `bold 26px ${FONT.ui}`, color: '#fff', align: 'center' });
    else {
      wrapText(ctx, Net.error || 'Связь недоступна.', 640, 270, 820, 30, { font: `bold 20px ${FONT.ui}`, color: '#ff8a80', align: 'center' });
      // без сети можно сходить в босс-рейд одному
      mcButton(ctx, g, '◄', 400, 400, 44, 40, () => (Duel.lvl = (Duel.lvl + LEVELS.length - 1) % LEVELS.length), { size: 12 });
      mcButton(ctx, g, '►', 836, 400, 44, 40, () => (Duel.lvl = (Duel.lvl + 1) % LEVELS.length), { size: 12 });
      text(ctx, `${Duel.lvl + 1}. ${LEVELS[Duel.lvl].name}`, 640, 428, { font: `bold 20px ${FONT.ui}`, color: '#fff', align: 'center' });
      mcButton(ctx, g, 'БОСС-РЕЙД В ОДИНОЧКУ', 440, 470, 400, 52, () => {
        Duel.mode = 'raid';
        Duel.startSolo(g);
      }, { size: 13, fill: '#8a4a3a' });
      mcButton(ctx, g, 'ДУРАК С БОТОМ', 440, 534, 400, 52, () => {
        Duel.mode = 'durak';
        Duel.startSolo(g);
      }, { size: 13, fill: '#2e7d32' });
    }
    mcButton(ctx, g, 'НАЗАД', 540, 620, 200, 44, () => Duel.close(g), { size: 13 });
    return;
  }

  // левая колонка: ты, уровень, кнопка
  rr(ctx, 90, 168, 520, 330, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fill();
  text(ctx, 'ТЫ', 116, 204, { font: `12px ${FONT.pixel}`, color: '#ffd54a' });
  let nickSize = 30;
  ctx.font = `${nickSize}px ${FONT.title}`;
  while (nickSize > 16 && ctx.measureText(Duel.name).width > 290) ctx.font = `${--nickSize}px ${FONT.title}`;
  text(ctx, Duel.name, 116, 240, { font: `${nickSize}px ${FONT.title}`, color: '#fff' });
  if (ph === 'lobby') {
    mcButton(ctx, g, 'СВОЙ НИК', 420, 194, 170, 34, () => Duel.editNick(), { size: 10, fill: '#8a4a3a' });
    mcButton(ctx, g, 'СЛУЧАЙНЫЙ', 420, 236, 170, 34, () => Duel.newNick(), { size: 10 });
  }
  text(ctx, 'РЕЖИМ', 116, 288, { font: `12px ${FONT.pixel}`, color: '#ffd54a' });
  const arena = Duel.mode === 'arena', raid = Duel.mode === 'raid', durak = Duel.mode === 'durak';
  if (ph === 'lobby') {
    ['arena', 'raid', 'boss', 'durak'].forEach((m, i) => {
      mcButton(ctx, g, DUEL_MODE_NAMES[m], 116 + i * 120, 298, 112, 36, () => Duel.setMode(m), { size: 8, fill: Duel.mode === m ? '#8a4a3a' : '#555' });
    });
  } else {
    text(ctx, DUEL_MODE_NAMES[Duel.mode], 116, 324, { font: `bold 20px ${FONT.ui}`, color: '#fff' });
  }
  if (durak) {
    text(ctx, 'ИГРА', 116, 362, { font: `12px ${FONT.pixel}`, color: '#ffd54a' });
    text(ctx, 'подкидной · 36 карт · вдвоём', 353, 397, { font: `bold 20px ${FONT.ui}`, color: '#fff', align: 'center' });
  } else {
    text(ctx, arena ? 'КАРТА' : raid ? 'БОСС' : 'УРОВЕНЬ', 116, 362, { font: `12px ${FONT.pixel}`, color: '#ffd54a' });
    const lv = LEVELS[Duel.lvl];
    if (ph === 'lobby') {
      mcButton(ctx, g, '◄', 116, 372, 44, 36, () => Duel.changeLevel(-1), { size: 12 });
      mcButton(ctx, g, '►', 546, 372, 44, 36, () => Duel.changeLevel(1), { size: 12 });
    }
    text(ctx, `${Duel.lvl + 1}. ${lv.name}`, 353, 397, { font: `bold 20px ${FONT.ui}`, color: '#fff', align: 'center' });
  }
  if (ph === 'lobby') {
    if (raid || durak) {
      mcButton(ctx, g, 'СОЗДАТЬ ДУЭЛЬ', 116, 424, 300, 50, () => Duel.host(), { size: 14, fill: '#8a4a3a' });
      mcButton(ctx, g, durak ? 'С БОТОМ' : 'ОДИН', 430, 424, 160, 50, () => Duel.startSolo(g), { size: 14 });
    } else mcButton(ctx, g, 'СОЗДАТЬ ДУЭЛЬ', 150, 424, 400, 50, () => Duel.host(), { size: 16, fill: '#8a4a3a' });
  } else if (ph === 'hosting') {
    const dots = '.'.repeat(1 + (Math.floor(now * 2) % 3));
    text(ctx, `Ждём соперника${dots}`, 280, 446, { font: `bold 20px ${FONT.ui}`, color: '#fff', align: 'center' });
    text(ctx, `комната ${Duel.code.toUpperCase()}`, 280, 470, { font: `15px ${FONT.ui}`, color: '#b0bec5', align: 'center' });
    mcButton(ctx, g, 'ОТМЕНА', 440, 432, 150, 40, () => Duel.cancel(), { size: 11 });
  } else if (ph === 'joining') {
    text(ctx, 'Подключаемся…', 280, 458, { font: `bold 20px ${FONT.ui}`, color: '#fff', align: 'center' });
    mcButton(ctx, g, 'ОТМЕНА', 440, 432, 150, 40, () => Duel.cancel(), { size: 11 });
  }
  if (Duel.note) wrapText(ctx, Duel.note, 350, 490, 480, 18, { font: `bold 14px ${FONT.ui}`, color: '#ff8a80', align: 'center' });

  // правая колонка: открытые дуэли
  rr(ctx, 650, 168, 540, 330, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fill();
  text(ctx, 'ОТКРЫТЫЕ ДУЭЛИ', 676, 204, { font: `12px ${FONT.pixel}`, color: '#ffd54a' });
  const list = Duel.openDuels();
  if (!list.length) {
    wrapText(ctx, 'Пока никого. Создай дуэль — или попроси друга создать, и она появится здесь.', 920, 300, 460, 26, { font: `17px ${FONT.ui}`, color: '#b0bec5', align: 'center' });
  }
  list.forEach((d, i) => {
    const y = 224 + i * 54;
    rr(ctx, 670, y, 500, 46, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fill();
    text(ctx, d.name, 690, y + 21, { font: `bold 18px ${FONT.ui}`, color: '#fff' });
    text(ctx, d.mode === 'durak' ? 'ДУРАК · подкидной' : `${DUEL_MODE_NAMES[d.mode]} · ${LEVELS[d.lvl].name}`, 690, y + 39, { font: `13px ${FONT.ui}`, color: d.mode === 'boss' ? '#b0bec5' : '#ffab91' });
    if (ph === 'lobby') mcButton(ctx, g, 'ВОЙТИ', 1040, y + 6, 116, 34, () => Duel.join(d.code, d.lvl, d.mode), { size: 11 });
  });

  // подарки и подсказка
  const rules = durak
    ? ['козырь — нижняя карта колоды', 'первым ходит тот, у кого младший козырь', 'подкидывать — того же достоинства', 'не можешь отбиться — бери', 'кончилась колода и карты — ты вышел']
    : arena
    ? ['АК, Nova, AWP, монтировка Фримена', 'кусты прячут, газ в конце, «супер» на E', 'Глаз Бога: стихии и реакции', 'мины спрятаны под цифрами «Сапёра»', 'зарядник HEV чинит броню']
    : raid
      ? ['вплотную к боссу урон ×1.4', 'но у логова бьёт ударная волна', 'миньоны, слаймы и хедкрабы', 'красные метки — сейчас рванёт', 'одному — 3 жизни, вдвоём — MVP по урону']
      : Object.values(DUEL_ATTACKS).map((a) => `${a.why} → ${a.name}`);
  text(ctx, durak ? 'ПРАВИЛА' : arena ? 'НА АРЕНЕ' : raid ? 'В РЕЙДЕ' : 'ПОДАРКИ СОПЕРНИКУ', 90, 530, { font: `12px ${FONT.pixel}`, color: '#ffd54a' });
  rules.forEach((str, i) => {
    text(ctx, str, 90 + (i % 2) * 380, 556 + Math.floor(i / 2) * 22, { font: `15px ${FONT.ui}`, color: '#eef3e6' });
  });
  // сервер связи
  text(ctx, 'СЕРВЕР', 900, 530, { font: `12px ${FONT.pixel}`, color: '#ffd54a' });
  text(ctx, Net.kind === 'room' ? 'claude.ai' : Net.server || '—', 900, 556, { font: `bold 17px ${FONT.ui}`, color: '#fff' });
  if (ph === 'lobby' && Net.canSwitch()) mcButton(ctx, g, 'СМЕНИТЬ', 900, 568, 170, 34, () => Duel.switchServer(g), { size: 10 });
  const how = Net.kind === 'room'
    ? 'Друг открывает эту же игру по ссылке claude.ai (поделись ей через «Поделиться») и жмёт «МУЛЬТИПЛЕЕР».'
    : 'Друг открывает эту же игру на сайте и жмёт «МУЛЬТИПЛЕЕР». Не видите дуэли друг друга — выберите одинаковый сервер. Сервер публичный: не пиши в ник ничего личного.';
  wrapText(ctx, how, 640, 640, 1080, 20, { font: `14px ${FONT.ui}`, color: '#90a4ae', align: 'center' });
  mcButton(ctx, g, 'НАЗАД', 1030, 664, 160, 40, () => Duel.close(g), { size: 11 });

  if (ph === 'countdown') {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, `${Duel.name}  VS  ${Duel.oppName}`, 640, 250, { font: `34px ${FONT.title}`, color: '#fff', stroke: '#000', lw: 6, align: 'center' });
    text(ctx, Duel.mode === 'durak' ? 'ДУРАК · подкидной' : `${DUEL_MODE_NAMES[Duel.mode]} · ${LEVELS[Duel.lvl].name}`, 640, 290, { font: `bold 20px ${FONT.ui}`, color: '#ffab91', align: 'center' });
    const n = Math.ceil(Duel.countT - 0.5);
    text(ctx, n > 0 ? String(n) : 'В БОЙ!', 640, 420, { font: `140px ${FONT.gta}`, color: n > 0 ? '#ffd54a' : '#ff5252', stroke: '#000', lw: 10, align: 'center' });
  }
}

function drawOpponentPanel(ctx, g) {
  const o = Duel.opp && Duel.opp.state;
  const x = 8, y = 166, w = 152, h = 78;
  rr(ctx, x, y, w, h, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.68)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ff8a65';
  ctx.stroke();
  text(ctx, `VS ${Duel.oppName || 'соперник'}`, x + 8, y + 18, { font: `bold 13px ${FONT.ui}`, color: '#ffab91' });
  if (!o) {
    text(ctx, 'нет связи…', x + 8, y + 44, { font: `13px ${FONT.ui}`, color: '#bbb' });
    return;
  }
  const hp = clamp(num(o.hp) / Math.max(1, num(o.mhp, 20)), 0, 1);
  const boss = clamp(num(o.boss, 100) / 100, 0, 1);
  const bar = (yy, ratio, color, label) => {
    text(ctx, label, x + 8, yy + 9, { font: `bold 11px ${FONT.ui}`, color: '#ddd' });
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x + 44, yy, w - 52, 10);
    ctx.fillStyle = color;
    ctx.fillRect(x + 44, yy, (w - 52) * ratio, 10);
  };
  bar(y + 26, hp, '#e53935', 'жизнь');
  bar(y + 42, boss, '#ff9800', 'босс');
  const st = o.st === 'dead' ? 'погиб' : o.st === 'win' ? 'победил!' : `☠ ${num(o.kills)}  $${num(o.money)}`;
  text(ctx, st, x + 8, y + 70, { font: `12px ${FONT.ui}`, color: '#eee' });
}

function drawDuelButtons(ctx, g, by) {
  mcButton(ctx, g, 'В ЛОББИ', 640 - 250, by, 240, 46, () => Duel.toLobby(g));
  mcButton(ctx, g, 'В МЕНЮ', 640 + 10, by, 240, 46, () => Duel.close(g));
  if (Duel.result) {
    const r = Duel.result;
    text(ctx, `${r.win ? 'Дуэль выиграна' : 'Дуэль проиграна'}: ${r.reason}`, 640, by + 76, { font: `bold 18px ${FONT.ui}`, color: r.win ? '#a5f07a' : '#ff8a80', align: 'center', stroke: '#000', lw: 4 });
  }
}

function drawDuelOver(ctx, g) {
  const r = Duel.result || { win: true, reason: '' };
  const k = Math.min(1, g.winT * 2);
  ctx.fillStyle = `rgba(0,0,0,${0.65 * k})`;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = k;
  const raid = Arena.on && Arena.kind === 'raid';
  const title = raid ? (r.win ? 'БОСС ПОВЕРЖЕН!' : 'БОСС ПОБЕДИЛ') : r.win === null ? 'НИЧЬЯ' : r.win ? (Arena.on ? 'ПОБЕДА!' : 'ПОБЕДА В ДУЭЛИ!') : 'ПОРАЖЕНИЕ';
  text(ctx, title, 640, 150, { font: `72px ${FONT.title}`, color: r.win === null ? '#ffd54a' : r.win ? '#7ee03c' : '#ff5252', stroke: '#000', lw: 10, align: 'center' });
  text(ctx, r.reason, 640, 200, { font: `bold 22px ${FONT.ui}`, color: '#fff', stroke: '#000', lw: 5, align: 'center' });
  const o = (Duel.opp && Duel.opp.state) || {};
  const p = g.player;
  const rows = raid
    ? [
      ['', 'Ты', Arena.solo ? '' : Duel.oppName || 'Друг'],
      ['Урон по боссу', String(Math.round(Raid.bd)), Arena.solo ? '' : String(Math.round(Raid.oppBd))],
      ['Миньонов', String(Raid.kills), Arena.solo ? '' : String(Raid.oppKills)],
      ['Смерти', String(Arena.me.dn), Arena.solo ? '' : String(Arena.opDn)],
      ['Время', `${Math.floor(Arena.t / 60)}:${String(Math.floor(Arena.t % 60)).padStart(2, '0')}`, ''],
    ]
    : Arena.on
    ? [
      ['', 'Ты', Duel.oppName || 'Соперник'],
      ['Фраги', String(Arena.opDn), String(Arena.me.dn)],
      ['Урон', String(Math.round(Arena.stats.dealt)), String(num(o.dmg))],
      ['Точность', `${Arena.accuracy()}%`, `${num(o.acc)}%`],
      ['Время', `${Math.floor(Arena.t / 60)}:${String(Math.floor(Arena.t % 60)).padStart(2, '0')}`, ''],
    ]
    : [
      ['', 'Ты', Duel.oppName || 'Соперник'],
      ['Здоровье', `${Math.max(0, Math.ceil(p.hp))}`, `${num(o.hp)}`],
      ['Босс', `${Math.round(clamp(g.tower.hp / g.tower.max, 0, 1) * 100)}%`, `${num(o.boss, 100)}%`],
      ['Убито врагов', String(g.kills), String(num(o.kills))],
      ['Деньги', `$${p.money}`, `$${num(o.money)}`],
    ];
  rr(ctx, 380, 240, 520, 200, 12);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fill();
  rows.forEach(([a, b, c], i) => {
    const y = 276 + i * 36;
    const f = i === 0 ? `bold 17px ${FONT.ui}` : `17px ${FONT.ui}`;
    text(ctx, a, 404, y, { font: f, color: '#bbb' });
    text(ctx, b, 690, y, { font: `bold 18px ${FONT.ui}`, color: '#fff', align: 'right' });
    text(ctx, c, 870, y, { font: `bold 18px ${FONT.ui}`, color: '#ffab91', align: 'right' });
  });
  ctx.globalAlpha = 1;
  if (g.winT > 0.8) {
    if (Arena.on && Arena.solo) mcButton(ctx, g, 'ЕЩЁ РАЗ', 640 - 250, 480, 240, 46, () => Duel.startSolo(g));
    else mcButton(ctx, g, 'В ЛОББИ', 640 - 250, 480, 240, 46, () => Duel.toLobby(g));
    mcButton(ctx, g, 'В МЕНЮ', 640 + 10, 480, 240, 46, () => Duel.close(g));
  }
}
