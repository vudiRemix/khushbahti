'use strict';
/* Футболист №7 — с новой версии мема: иногда выбегает на доску, ведёт мяч, пробивает через
   врагов прямо в ворота — башню босса — и празднует гол прыжком с разворотом: «СИУУУ!».
   От крика все враги на доске на пару секунд оглушены. Чит-код SIUUU зовёт его сразу. */

const SIU = {
  first: [60, 110], // через сколько секунд уровня он выбежит в первый раз
  every: [140, 220], // и потом
  ballDmg: 4,
  ballTime: 2.2, // сколько мяч мечется по доске, прежде чем полететь в ворота
  ballSpeed: 760,
  goal: 120, // урон башне от гола
  stun: 2.5,
  money: 700,
};

// «СИУУУ!»: шипение «С», голос из пилы через две форманты — «И» плавно переходит в «У», — и рёв трибун.
function playSiu() {
  const a = Sound.audio();
  if (!a || Sound.muted) return;
  const { ctx, master, noiseBuf } = a;
  const t = ctx.currentTime + 0.02;
  const out = ctx.createGain();
  out.gain.value = 0.9;
  out.connect(master);
  const noise = (type, f, q, at, peak, rise, end) => {
    const src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    src.loop = true;
    fl.type = type;
    fl.frequency.value = f;
    fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + rise);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    src.connect(fl);
    fl.connect(g);
    g.connect(out);
    src.start(at);
    src.stop(end + 0.05);
  };
  noise('highpass', 4200, 0.7, t, 0.22, 0.03, t + 0.17);
  const v = t + 0.13, end = v + 1.5;
  const src = ctx.createOscillator();
  src.type = 'sawtooth';
  src.frequency.setValueAtTime(185, v);
  src.frequency.linearRampToValueAtTime(265, v + 0.25);
  src.frequency.linearRampToValueAtTime(245, v + 1.1);
  src.frequency.linearRampToValueAtTime(205, end);
  const vib = ctx.createOscillator(), vg = ctx.createGain();
  vib.frequency.value = 6;
  vg.gain.value = 7;
  vib.connect(vg);
  vg.connect(src.frequency);
  const voice = ctx.createGain();
  voice.gain.setValueAtTime(0.0001, v);
  voice.gain.exponentialRampToValueAtTime(0.55, v + 0.08);
  voice.gain.setValueAtTime(0.55, end - 0.35);
  voice.gain.exponentialRampToValueAtTime(0.0001, end);
  voice.connect(out);
  const formant = (f0, f1, q, gain) => {
    const fl = ctx.createBiquadFilter(), g = ctx.createGain();
    fl.type = 'bandpass';
    fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, v);
    fl.frequency.setValueAtTime(f0, v + 0.3);
    fl.frequency.exponentialRampToValueAtTime(f1, v + 0.55);
    g.gain.value = gain;
    src.connect(fl);
    fl.connect(g);
    g.connect(voice);
  };
  formant(290, 330, 5, 1.6); // первая форманта: у «И» и «У» низкая
  formant(2250, 820, 7, 1.2); // вторая: высоко у «И», низко у «У»
  formant(3000, 2400, 9, 0.35);
  src.start(v);
  vib.start(v);
  src.stop(end + 0.05);
  vib.stop(end + 0.05);
  noise('bandpass', 900, 0.6, v + 0.2, 0.16, 0.6, v + 2.6); // трибуны
}

function drawSoccerBall(ctx, x, y, r, spin) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  circ(ctx, 0, 0, r, '#fafafa');
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#333';
  ctx.stroke();
  const pent = (cx, cy, s) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 5;
      ctx.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s);
    }
    ctx.closePath();
    ctx.fillStyle = '#222';
    ctx.fill();
  };
  pent(0, 0, r * 0.38);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 5;
    pent(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, r * 0.22);
  }
  ctx.restore();
}

// Футболист: красная футболка с семёркой, тёмно-зелёные шорты, причёска с коком.
// (x, y) — точка между ступнями; pose: run | kick | jump | siu.
function drawFootballer(ctx, x, y, t, o = {}) {
  const skin = '#d9a074', red = '#c8102e', shorts = '#14532d', sock = '#c8102e';
  ctx.save();
  ctx.translate(x, y);
  ell(ctx, 0, 2, 24, 6, 'rgba(0,0,0,0.3)');
  ctx.translate(0, -(o.jump || 0));
  if (o.spin !== undefined) ctx.scale(Math.cos(o.spin) || 0.02, 1);
  if (o.dir < 0) ctx.scale(-1, 1);
  const pose = o.pose || 'run';
  const sw = Math.sin(t * 14);
  // углы ног и рук от вертикали
  let legL = 0, legR = 0, armL = 0.3, armR = -0.3, bendL = 0, bendR = 0;
  if (pose === 'run') {
    legL = sw * 0.6;
    legR = -sw * 0.6;
    armL = -sw * 0.7 + 0.2;
    armR = sw * 0.7 - 0.2;
  } else if (pose === 'kick') {
    legL = -0.15;
    legR = -1.25;
    armL = 0.9;
    armR = -1.1;
  } else if (pose === 'jump') {
    legL = 0.5;
    legR = -0.5;
    bendL = bendR = 1.3;
    armL = 2.6;
    armR = -2.6;
  } else if (pose === 'siu') {
    legL = 0.42;
    legR = -0.42;
    armL = 1.15;
    armR = -1.15;
  }
  const leg = (hx, ang, bend) => {
    const kx = hx - Math.sin(ang) * 20, ky = -40 + Math.cos(ang) * 20;
    const fa = ang - bend;
    const fx = kx - Math.sin(fa) * 20, fy = ky + Math.cos(fa) * 20;
    line(ctx, hx, -42, kx, ky, skin, 9);
    line(ctx, kx, ky, fx, fy, sock, 9);
    ell(ctx, fx + 4, fy + 2, 8, 4, '#111');
    line(ctx, fx - 2, fy + 1, fx + 8, fy + 1, '#f5f5f5', 1.5);
  };
  leg(-7, legL, bendL);
  leg(7, legR, bendR);
  rr(ctx, -14, -50, 28, 14, 3);
  ctx.fillStyle = shorts;
  ctx.fill();
  // руки (за туловищем — ближняя рисуется после)
  const arm = (sx, ang) => {
    const ex = sx + Math.sin(ang) * 30, ey = -76 + Math.cos(ang) * 30;
    line(ctx, sx, -76, sx + Math.sin(ang) * 10, -76 + Math.cos(ang) * 10, red, 9);
    line(ctx, sx + Math.sin(ang) * 9, -76 + Math.cos(ang) * 9, ex, ey, skin, 7);
    circ(ctx, ex, ey, 4, skin);
  };
  arm(-15, -armL);
  rr(ctx, -16, -82, 32, 36, 7);
  ctx.fillStyle = red;
  ctx.fill();
  line(ctx, -16, -64, 16, -64, 'rgba(0,0,0,0.12)', 2);
  poly(ctx, [-6, -82, 6, -82, 0, -75], '#14532d');
  ctx.save();
  ctx.translate(6, -55);
  if (o.dir < 0) ctx.scale(-1, 1); // цифра не должна отражаться
  text(ctx, '7', 0, 0, { font: `bold 15px ${FONT.ui}`, color: '#ffd54a', align: 'center' });
  ctx.restore();
  arm(15, -armR);
  // голова
  line(ctx, 0, -84, 0, -88, skin, 6);
  const tilt = pose === 'siu' ? -0.25 : 0;
  ctx.save();
  ctx.translate(0, -96);
  ctx.rotate(tilt);
  ell(ctx, 0, 0, 11, 13, skin);
  // кок
  ctx.beginPath();
  ctx.moveTo(-11, -2);
  ctx.quadraticCurveTo(-12, -16, -2, -17);
  ctx.quadraticCurveTo(10, -20, 12, -8);
  ctx.quadraticCurveTo(11, -2, 10, 0);
  ctx.quadraticCurveTo(4, -9, -11, -2);
  ctx.fillStyle = '#21160f';
  ctx.fill();
  line(ctx, -7, -3, -2, -4, '#21160f', 2);
  line(ctx, 3, -4, 8, -3, '#21160f', 2);
  circ(ctx, -4, 0, 1.6, '#111');
  circ(ctx, 5, 0, 1.6, '#111');
  if (pose === 'siu' || pose === 'jump') {
    ell(ctx, 1, 7, 4.5, 4, '#5a1010');
  } else line(ctx, -3, 7, 4, 7, '#7a3b2a', 1.5);
  ctx.restore();
  ctx.restore();
}

class Footballer {
  constructor() {
    this.phase = 'run'; // run | kick | ball | goal | jump | siu | leave
    this.t = 0;
    this.time = 0;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.x = this.dir > 0 ? -60 : W + 60;
    this.y = rowY(6) + 38;
    this.kickX = 640 + rand(-220, 220);
    this.ball = { x: this.x, y: this.y - 8, vx: 0, vy: 0, spin: 0 };
    this.hitAt = new Map(); // враг → когда его последний раз задело мячом
    this.goalText = 0;
    this.gone = false;
  }

  setPhase(p) {
    this.phase = p;
    this.t = 0;
  }

  update(dt, g) {
    this.t += dt;
    this.time += dt;
    const b = this.ball;
    if (this.goalText > 0) this.goalText -= dt;
    if (this.phase === 'run') {
      this.x += this.dir * 330 * dt;
      b.x = this.x + this.dir * 24;
      b.y = this.y - 8 - Math.abs(Math.sin(this.time * 11)) * 10;
      b.spin += dt * 14 * this.dir;
      if ((this.x - this.kickX) * this.dir >= 0) this.setPhase('kick');
    } else if (this.phase === 'kick') {
      b.x = this.x + this.dir * 24;
      if (this.t > 0.22) {
        const ang = -Math.PI / 2 + rand(-0.55, 0.55);
        b.vx = Math.cos(ang) * SIU.ballSpeed;
        b.vy = Math.sin(ang) * SIU.ballSpeed;
        Sound.kick();
        this.setPhase('ball');
      }
    } else if (this.phase === 'ball') {
      this.moveBall(dt, g);
      if (this.t > SIU.ballTime) {
        if (g.tower.dead) this.setPhase('jump');
        else {
          this.setPhase('goal');
          Sound.kick();
        }
      }
    } else if (this.phase === 'goal') {
      // мяч летит в ворота — в башню босса
      const c = g.tower.center;
      const dx = c.x - b.x, dy = c.y - b.y, d = Math.hypot(dx, dy) || 1;
      b.vx = (dx / d) * 1000;
      b.vy = (dy / d) * 1000;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.spin += dt * 30;
      if (d < 40 || this.t > 1.5) {
        if (!g.tower.dead) g.damageTower(SIU.goal, true);
        FX.burst(g, c.x, c.y, 30, { colors: ['#fff', '#ffd54a', '#c8102e', '#14532d'], size: 8, speed: 420, grav: 300, life: 1 });
        Sound.explosion(false);
        this.goalText = 1.6;
        this.goalAt = { x: c.x, y: c.y };
        this.setPhase('jump');
      }
    } else if (this.phase === 'jump') {
      if (this.t >= 0.75) {
        this.setPhase('siu');
        this.siu(g);
      }
    } else if (this.phase === 'siu') {
      if (this.t >= 1.8) this.setPhase('leave');
    } else if (this.phase === 'leave') {
      this.x += this.dir * 360 * dt;
      if (this.x < -80 || this.x > W + 80) this.gone = true;
    }
  }

  // мяч мечется по доске, отскакивает от краёв и от врагов
  moveBall(dt, g) {
    const b = this.ball;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.spin += dt * 22;
    const top = 2 * T + 12, bottom = PAWN_ROW * T - 14;
    if (b.x < 24 || b.x > W - 24) {
      b.vx = -b.vx;
      b.x = clamp(b.x, 24, W - 24);
    }
    if (b.y < top || b.y > bottom) {
      b.vy = -b.vy;
      b.y = clamp(b.y, top, bottom);
    }
    for (const e of g.enemies) {
      if (!e.alive || e.air) continue;
      const d = e.def;
      if (Math.abs(b.x - e.x) > d.hw + 10 || b.y < e.y - d.top - 10 || b.y > e.y + d.bot + 10) continue;
      if (this.time - (this.hitAt.get(e) || -9) < 0.45) continue;
      this.hitAt.set(e, this.time);
      e.damage(SIU.ballDmg, g, 'ball');
      FX.burst(g, b.x, b.y, 8, { colors: ['#fff', '#ddd', '#ffd54a'], size: 5, speed: 240, grav: 400, life: 0.4 });
      Sound.kick();
      // отскок от врага: отражаем скорость от направления «центр врага → мяч»
      const cy = e.y - d.top / 2;
      let nx = b.x - e.x, ny = b.y - cy;
      const n = Math.hypot(nx, ny) || 1;
      nx /= n;
      ny /= n;
      const dot = b.vx * nx + b.vy * ny;
      if (dot < 0) {
        b.vx -= 2 * dot * nx;
        b.vy -= 2 * dot * ny;
      }
    }
  }

  siu(g) {
    playSiu();
    g.shake = Math.max(g.shake, 10);
    for (const e of g.enemies) if (e.alive) e.dazed = Math.max(e.dazed || 0, SIU.stun);
    g.addMoney(SIU.money, this.x, this.y - 140, '#ffd54a');
    g.say('Футболист №7: «СИУУУ!» — враги оглушены', '#ffd54a');
    Ach.unlock('siu');
  }

  draw(ctx, now) {
    const b = this.ball;
    let pose = 'run', jump = 0, spin, dir = this.dir, t = this.time;
    if (this.phase === 'kick' || (this.phase === 'ball' && this.t < 0.3)) pose = 'kick';
    else if (this.phase === 'ball' || this.phase === 'goal') t = 0; // стоит и следит за мячом
    else if (this.phase === 'jump') {
      const k = clamp(this.t / 0.75, 0, 1);
      pose = 'jump';
      jump = Math.sin(k * Math.PI) * 95;
      spin = k * TAU;
      dir = 1;
    } else if (this.phase === 'siu') {
      pose = 'siu';
      dir = 1;
    }
    drawFootballer(ctx, this.x, this.y, t, { pose, jump, spin, dir });
    if (this.phase === 'run' || this.phase === 'kick' || this.phase === 'ball' || this.phase === 'goal') {
      drawSoccerBall(ctx, b.x, b.y, 11, b.spin);
    }
    if (this.goalText > 0 && this.goalAt) {
      const k = 1.6 - this.goalText;
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.goalText * 2);
      ctx.translate(this.goalAt.x, this.goalAt.y + 30);
      ctx.scale(1 + Math.min(1, k * 4) * 0.3, 1 + Math.min(1, k * 4) * 0.3);
      text(ctx, 'ГОООЛ!', 0, 0, { font: `52px ${FONT.gta}`, color: '#ffd54a', stroke: '#000', lw: 8, align: 'center' });
      ctx.restore();
    }
    if (this.phase === 'siu') {
      const k = this.t;
      // волна крика
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k / 0.9) * 0.7;
      circ(ctx, this.x, this.y - 60, 40 + k * 1100);
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#ffd54a';
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.translate(this.x + rand(-2, 2), this.y - 150);
      const s = Math.min(1, k * 6) * (1 + Math.sin(now * 20) * 0.03);
      ctx.scale(s, s);
      ctx.rotate(-0.06);
      text(ctx, 'СИУУУ!', 0, 0, { font: `64px ${FONT.title}`, color: '#ffd54a', stroke: '#7a0010', lw: 10, align: 'center' });
      ctx.restore();
    }
  }
}
