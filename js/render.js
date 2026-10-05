'use strict';
/* Отрисовка кадра: мир → ночь → руки → эффекты → интерфейс → экраны. */

const nightCanvas = document.createElement('canvas');
let nightCtx = null;

function render(ctx, g) {
  const now = performance.now() / 1000;
  const wt = g.state === 'title' ? g.titleT : g.t;
  ctx.setTransform(View.k, 0, 0, View.k, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.fillStyle = '#0d1208';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  if (g.shake > 0 && g.state !== 'title') ctx.translate(rand(-1, 1) * g.shake, rand(-1, 1) * g.shake);
  drawWorld(ctx, g, wt, now);
  drawNight(ctx, g);
  if (g.state !== 'title') drawHands(ctx, g, now);
  ctx.restore();

  if (g.state !== 'title') {
    drawScreenFx(ctx, g, now);
    drawHUD(ctx, g, now);
  }
  g.buttons = [];
  if (g.state === 'title') drawTitle(ctx, g, now);
  else if (g.state === 'pause') drawPause(ctx, g, now);
  else if (g.state === 'buy') drawBuy(ctx, g, now);
  else if (g.state === 'dead') drawDead(ctx, g, now);
  else if (g.state === 'win') drawWin(ctx, g, now);
  if (g.meeting) drawMeeting(ctx, g, now);
  if (g.jumpscare) drawJumpscare(ctx, g, now);
  if (g.state === 'play' && !g.jumpscare && !g.meeting) drawCrosshair(ctx, g, now);
  else if (!g.jumpscare && !g.meeting && !Input.touch) drawPointer(ctx);
}

// ---------- мир ----------
function drawWorld(ctx, g, t, now) {
  ctx.drawImage(Board.get(View), 0, 0, W, H);
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
  for (let c = 1; c < COLS; c++) if (g.def[c]) drawDefender(ctx, g.def[c], c, t);
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

  for (const q of g.qblocks) q.draw(ctx);
  for (const p of g.popups) {
    if (p.t < 0) continue;
    ctx.globalAlpha = Math.min(1, (1.2 - p.t) * 3);
    drawMarioItem(ctx, p.kind, p.x, p.y - Math.min(p.t, 0.5) * 90, 1.2, now);
  }
  ctx.globalAlpha = 1;

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
    drawTower(ctx, 640, t, {
      hpRatio: tw.hp / tw.max,
      hp: tw.hp,
      hit: Math.max(0, tw.hit),
      rage: tw.phase > 0 ? 1 : 0,
      fire: Math.max(0, tw.fire),
      laugh: tw.laugh,
    });
    ctx.restore();
  }
  if (tw.dead) {
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
  if (tw.emoteT > 0 && !tw.dead) {
    const a = Math.min(1, tw.emoteT * 3);
    ctx.globalAlpha = a;
    ctx.font = `bold 17px ${FONT.ui}`;
    const w = ctx.measureText(tw.emote).width + 24;
    rr(ctx, 752, 14, w, 36, 12);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1b2b5a';
    ctx.stroke();
    poly(ctx, [756, 38, 736, 54, 770, 44], '#fff');
    text(ctx, tw.emote, 752 + w / 2, 38, { font: `bold 17px ${FONT.ui}`, color: '#1b2b5a', align: 'center' });
    ctx.globalAlpha = 1;
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
  n.fillStyle = `rgba(6,8,26,${a})`;
  n.fillRect(0, 0, W, H);
  n.globalCompositeOperation = 'destination-out';
  lightAt(n, Input.x, Input.y, 190, 1);
  lightAt(n, 640, 70, 150, 0.6);
  for (const ex of g.explosions) lightAt(n, ex.x, ex.y, ex.r * 2.2, 1 - ex.t / 0.55);
  for (const it of g.items) if (it.kind === 'sun') lightAt(n, it.x, it.y, 70, 0.9);
  for (const cb of g.cannonballs) {
    const p = cb.pos;
    lightAt(n, p.x, p.y, 40 + p.s * 30, 0.8);
  }
  n.globalCompositeOperation = 'source-over';
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
  drawPvzBank(ctx, g, now);
  drawMinesPanel(ctx, g);
  drawMinecraftHud(ctx, g, now);
  drawPubgBars(ctx, g);
  drawCsAmmo(ctx, g);
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
  else if (a.mag === 0 && a.reserve === 0 && !g.infAmmo) text(ctx, 'НЕТ ПАТРОНОВ — B', 1270, 664, { font: `bold 14px ${FONT.ui}`, color: '#ff5252', align: 'right', stroke: '#000', lw: 4 });
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
  ['Esc', 'пауза,  M — звук'],
];

function drawControls(ctx, x, y) {
  CONTROLS.forEach(([k, v], i) => {
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
  text(ctx, 'шахматы × сапёр × CS × Minecraft × GTA × PvZ × FNAF × Clash Royale × Pac-Man × PUBG × змейка × Mario × Duck Hunt × Among Us × скибиди', 640, 198, { font: `bold 15px ${FONT.ui}`, color: '#d7e8c4', align: 'center', stroke: 'rgba(0,0,0,0.6)', lw: 4 });
  mcButton(ctx, g, 'ИГРАТЬ', 640 - 150, 226, 300, 56, () => g.start(), { size: 22 });

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
    'Разрушь башню короля (босс сверху).',
    'Открывай клетки сапёра удочкой — за них',
    'дают деньги, патроны и предметы.',
    'Флажок на мине = ловушка для врагов.',
    'Очистишь поле — мины полетят в башню.',
    'Не пускай врагов к белым фигурам.',
    'Сбивай ядра короля, пока не прилетели.',
    'В полночь приходит Золотой Фредди...',
    'Деньги тратятся в меню закупки (B).',
    'Говорят, тут работают читы из GTA SA...',
  ];
  goals.forEach((s, i) => text(ctx, s, 690, 370 + i * 22, { font: `14px ${FONT.ui}`, color: '#eef3e6' }));

  text(ctx, `Рекорд: $${pad(g.best, 8)}`, 640, 636, { font: `30px ${FONT.gta}`, color: '#3fbf4a', stroke: '#000', lw: 6, align: 'center' });
  mcButton(ctx, g, 'ПОЛНЫЙ ЭКРАН', 1020, 662, 240, 40, toggleFullscreen, { size: 11 });
  mcButton(ctx, g, Sound.muted ? 'ЗВУК: ВЫКЛ' : 'ЗВУК: ВКЛ', 20, 662, 200, 40, () => Sound.toggleMute(), { size: 11 });
  text(ctx, 'Нажми «Играть» или Enter', 640, 684, { font: `bold 15px ${FONT.ui}`, color: 'rgba(255,255,255,0.75)', align: 'center' });
  if (Input.touch) text(ctx, 'Игра сделана для ПК: нужны мышь и клавиатура', 640, 706, { font: `bold 14px ${FONT.ui}`, color: '#ffab91', align: 'center' });
}

function drawPause(ctx, g) {
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, 'ПАУЗА', 640, 118, { font: `64px ${FONT.title}`, color: '#fff', stroke: '#000', lw: 10, align: 'center' });
  const bx = 640 - 160;
  mcButton(ctx, g, 'ПРОДОЛЖИТЬ', bx, 150, 320, 42, () => g.resume());
  mcButton(ctx, g, 'НАЧАТЬ ЗАНОВО', bx, 200, 320, 42, () => g.start());
  mcButton(ctx, g, Sound.muted ? 'ЗВУК: ВЫКЛ' : 'ЗВУК: ВКЛ', bx, 250, 320, 42, () => Sound.toggleMute());
  mcButton(ctx, g, 'ПОЛНЫЙ ЭКРАН', bx, 300, 320, 42, toggleFullscreen);
  mcButton(ctx, g, 'В ГЛАВНОЕ МЕНЮ', bx, 350, 320, 42, () => g.toTitle());
  rr(ctx, 380, 410, 520, 282, 12);
  ctx.fillStyle = 'rgba(10,16,8,0.8)';
  ctx.fill();
  drawControls(ctx, 404, 440);
  text(ctx, 'Псс... попробуй набрать HESOYAM', 640, 684, { font: `13px ${FONT.ui}`, color: 'rgba(255,255,255,0.45)', align: 'center' });
}

function statsLines(g) {
  const p = g.player;
  const mins = Math.floor(g.t / 60), secs = Math.floor(g.t % 60);
  return [
    ['Заработано', `$${p.earned}`],
    ['Врагов повержено', String(g.kills)],
    ['Клеток открыто', String(g.tilesOpened)],
    ['Полей сапёра пройдено', String(g.fieldsCleared)],
    ['Уровень', String(p.level)],
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

function drawDead(ctx, g) {
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
    mcButton(ctx, g, 'ЕЩЁ РАЗ', 640 - 250, 560 + (g.newRecord || g.cheated ? 20 : 0), 240, 46, () => g.start());
    mcButton(ctx, g, 'В МЕНЮ', 640 + 10, 560 + (g.newRecord || g.cheated ? 20 : 0), 240, 46, () => g.toTitle());
  }
}

function drawWin(ctx, g, now) {
  ctx.fillStyle = `rgba(0,0,0,${Math.min(0.55, g.winT * 0.6)})`;
  ctx.fillRect(0, 0, W, H);
  const a = Math.min(1, g.winT * 2);
  ctx.globalAlpha = a;
  text(ctx, 'MISSION PASSED!', 640, 130, { font: `88px ${FONT.gta}`, color: '#f2c230', stroke: '#000', lw: 9, align: 'center' });
  text(ctx, 'RESPECT +', 640, 182, { font: `40px ${FONT.gta}`, color: '#fff', stroke: '#000', lw: 6, align: 'center' });
  for (let i = 0; i < 3; i++) {
    const k = clamp((g.winT - 0.5 - i * 0.35) * 3, 0, 1);
    if (k <= 0) continue;
    const s = 3.2 * (k < 1 ? easeOutCubic(k) * 1.25 : 1) + Math.sin(now * 3 + i) * 0.1;
    drawCrown(ctx, 540 + i * 100, 238, s);
  }
  ctx.globalAlpha = 1;
  if (g.winT > 1.5) {
    text(ctx, 'Башня короля разрушена. +$10000 · #1 VICTORY ROYALE', 640, 300, { font: `bold 18px ${FONT.ui}`, color: '#c8f7a0', stroke: '#000', lw: 4, align: 'center' });
    drawStats(ctx, g, 318);
    mcButton(ctx, g, 'ЕЩЁ РАЗ', 640 - 250, 560 + (g.newRecord || g.cheated ? 20 : 0), 240, 46, () => g.start());
    mcButton(ctx, g, 'В МЕНЮ', 640 + 10, 560 + (g.newRecord || g.cheated ? 20 : 0), 240, 46, () => g.toTitle());
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
