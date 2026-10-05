'use strict';
/* Звук без файлов: всё синтезируется через WebAudio.
   Браузер разрешает звук только после клика/нажатия клавиши — поэтому init()
   вызывается из обработчиков ввода. */

const Sound = (() => {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let muted = Store.get('kd_muted') === '1';
  const last = {};

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
    } catch (e) {
      ctx = null;
      return;
    }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(comp);
    comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.5), ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  // Не даём одному и тому же звуку играть слишком часто.
  function ok(name, gap = 0) {
    if (!ctx || muted) return false;
    const t = ctx.currentTime;
    if (gap && last[name] !== undefined && t - last[name] < gap) return false;
    last[name] = t;
    return true;
  }

  function env(g, t, vol, attack, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  function tone(o) {
    const t = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
    const g = ctx.createGain();
    env(g, t, o.vol || 0.2, o.attack || 0.005, o.dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
    return osc;
  }

  function noise(o) {
    const t = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f0 || 1000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
    const g = ctx.createGain();
    env(g, t, o.vol || 0.2, o.attack || 0.002, o.dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t, Math.random());
    src.stop(t + o.dur + 0.05);
  }

  const S = {
    init,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      Store.set('kd_muted', muted ? '1' : '0');
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },

    shot() {
      if (!ok('shot')) return;
      const p = rand(0.92, 1.08);
      noise({ dur: 0.11, vol: 0.5, filter: 'bandpass', f0: 1500 * p, f1: 500, q: 0.7 });
      noise({ dur: 0.05, vol: 0.35, filter: 'highpass', f0: 3000 });
      tone({ type: 'triangle', f0: 150 * p, f1: 45, dur: 0.1, vol: 0.45 });
    },
    empty() {
      if (!ok('empty', 0.12)) return;
      tone({ type: 'square', f0: 1800, dur: 0.025, vol: 0.12 });
    },
    reload() {
      if (!ok('reload')) return;
      tone({ type: 'square', f0: 900, dur: 0.03, vol: 0.12, delay: 0.05 });
      noise({ dur: 0.06, vol: 0.2, filter: 'bandpass', f0: 2500, delay: 0.5 });
      tone({ type: 'square', f0: 700, dur: 0.04, vol: 0.14, delay: 1.1 });
      noise({ dur: 0.08, vol: 0.25, filter: 'bandpass', f0: 1800, delay: 1.6 });
      tone({ type: 'square', f0: 1200, dur: 0.03, vol: 0.12, delay: 1.75 });
    },
    hit() {
      if (!ok('hit', 0.04)) return;
      tone({ type: 'square', f0: rand(600, 800), f1: 300, dur: 0.04, vol: 0.06 });
    },
    stone() {
      if (!ok('stone', 0.06)) return;
      noise({ dur: 0.07, vol: 0.18, filter: 'bandpass', f0: 1200, q: 2 });
    },
    explosion(big) {
      if (!ok('boom', 0.05)) return;
      noise({ dur: big ? 1.4 : 0.8, vol: big ? 0.9 : 0.7, filter: 'lowpass', f0: 1400, f1: 60 });
      tone({ type: 'sine', f0: 110, f1: 28, dur: big ? 0.9 : 0.5, vol: 0.7 });
    },
    reveal(n) {
      if (!ok('reveal', 0.03)) return;
      if (n > 6) {
        [660, 880, 1320].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.08, vol: 0.12, delay: i * 0.05 }));
      } else {
        tone({ type: 'triangle', f0: 880, f1: 1200, dur: 0.06, vol: 0.14 });
      }
    },
    flag() {
      if (!ok('flag')) return;
      tone({ type: 'square', f0: 520, f1: 900, dur: 0.07, vol: 0.08 });
    },
    unflag() {
      if (!ok('flag')) return;
      tone({ type: 'square', f0: 900, f1: 500, dur: 0.07, vol: 0.08 });
    },
    hurt() {
      if (!ok('hurt', 0.15)) return;
      // «ой» из кубического мира
      tone({ type: 'sawtooth', f0: 330, f1: 170, dur: 0.18, vol: 0.18 });
      tone({ type: 'square', f0: 220, f1: 120, dur: 0.16, vol: 0.08 });
    },
    coin() {
      if (!ok('coin', 0.05)) return;
      tone({ type: 'square', f0: 1320, dur: 0.06, vol: 0.06 });
      tone({ type: 'square', f0: 1760, dur: 0.12, vol: 0.06, delay: 0.06 });
    },
    sun() {
      if (!ok('sun', 0.05)) return;
      [1046, 1318, 1568, 2093].forEach((f, i) => tone({ f0: f, dur: 0.12, vol: 0.1, delay: i * 0.04 }));
    },
    pickup() {
      if (!ok('pickup', 0.05)) return;
      tone({ type: 'triangle', f0: 600, f1: 1400, dur: 0.1, vol: 0.14 });
    },
    xp() {
      if (!ok('xp', 0.05)) return;
      tone({ f0: rand(1500, 2100), dur: 0.12, vol: 0.06 });
    },
    levelUp() {
      if (!ok('lvl')) return;
      [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.25, vol: 0.14, delay: i * 0.08 }));
    },
    waka() {
      if (!ok('waka', 0.13)) return;
      tone({ type: 'triangle', f0: 260, f1: 520, dur: 0.06, vol: 0.18 });
      tone({ type: 'triangle', f0: 520, f1: 260, dur: 0.06, vol: 0.18, delay: 0.065 });
    },
    pacEat() {
      if (!ok('paceat', 0.05)) return;
      tone({ type: 'square', f0: 200, f1: 1600, dur: 0.18, vol: 0.12 });
    },
    jumpscare() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(900, t);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 38;
      const lg = ctx.createGain();
      lg.gain.value = 260;
      lfo.connect(lg);
      lg.connect(osc.frequency);
      const g = ctx.createGain();
      env(g, t, 0.55, 0.01, 1.0);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      lfo.start(t);
      osc.stop(t + 1.05);
      lfo.stop(t + 1.05);
      noise({ dur: 1.0, vol: 0.6, filter: 'highpass', f0: 800 });
    },
    staticNoise() {
      if (!ok('static', 0.2)) return;
      noise({ dur: 0.3, vol: 0.18, filter: 'highpass', f0: 2500 });
    },
    chime6am() {
      if (!ok('chime')) return;
      [784, 659, 523, 392, 523, 659, 784, 1046].forEach((f, i) => {
        tone({ f0: f, dur: 0.6, vol: 0.12, delay: i * 0.22 });
        tone({ f0: f * 2.01, dur: 0.3, vol: 0.04, delay: i * 0.22 });
      });
    },
    midnight() {
      if (!ok('midnight')) return;
      [196, 185, 174].forEach((f, i) => tone({ type: 'sawtooth', f0: f, dur: 0.8, vol: 0.06, delay: i * 0.5 }));
      noise({ dur: 0.5, vol: 0.15, filter: 'highpass', f0: 2000 });
    },
    wasted() {
      if (!ok('wasted')) return;
      noise({ dur: 1.6, vol: 0.4, filter: 'lowpass', f0: 2000, f1: 80 });
      tone({ type: 'sine', f0: 90, f1: 30, dur: 1.4, vol: 0.5 });
      tone({ type: 'sawtooth', f0: 110, f1: 55, dur: 1.2, vol: 0.08, delay: 0.6 });
    },
    win() {
      if (!ok('win')) return;
      [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => {
        tone({ type: 'square', f0: f, dur: 0.22, vol: 0.08, delay: i * 0.13 });
        tone({ type: 'triangle', f0: f / 2, dur: 0.22, vol: 0.1, delay: i * 0.13 });
      });
    },
    cannon() {
      if (!ok('cannon', 0.1)) return;
      noise({ dur: 0.5, vol: 0.45, filter: 'lowpass', f0: 600, f1: 80 });
      tone({ type: 'sine', f0: 80, f1: 35, dur: 0.4, vol: 0.5 });
    },
    whoosh() {
      if (!ok('whoosh', 0.2)) return;
      noise({ dur: 0.5, vol: 0.2, filter: 'bandpass', f0: 300, f1: 2500, q: 3 });
    },
    chomp() {
      if (!ok('chomp', 0.12)) return;
      noise({ dur: 0.09, vol: 0.25, filter: 'lowpass', f0: 900 });
      noise({ dur: 0.07, vol: 0.2, filter: 'lowpass', f0: 700, delay: 0.12 });
    },
    groan() {
      if (!ok('groan', 1.2)) return;
      const o = tone({ type: 'sawtooth', f0: 95, f1: 70, dur: 0.9, vol: 0.07, attack: 0.15 });
      if (o) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 6;
        const lg = ctx.createGain();
        lg.gain.value = 8;
        lfo.connect(lg);
        lg.connect(o.frequency);
        lfo.start();
        lfo.stop(ctx.currentTime + 1);
      }
    },
    tok() {
      if (!ok('tok', 0.05)) return;
      tone({ f0: 240, f1: 160, dur: 0.07, vol: 0.2 });
      noise({ dur: 0.02, vol: 0.12, filter: 'bandpass', f0: 3000 });
    },
    capture() {
      if (!ok('capture', 0.08)) return;
      tone({ f0: 300, f1: 120, dur: 0.12, vol: 0.25 });
      noise({ dur: 0.08, vol: 0.2, filter: 'bandpass', f0: 1800 });
    },
    plant() {
      if (!ok('plant')) return;
      tone({ type: 'triangle', f0: 180, f1: 90, dur: 0.12, vol: 0.3 });
      noise({ dur: 0.1, vol: 0.15, filter: 'lowpass', f0: 500 });
    },
    plane() {
      if (!ok('plane')) return;
      const o = tone({ type: 'sawtooth', f0: 70, f1: 60, dur: 3.5, vol: 0.06, attack: 1.2 });
      if (o) noise({ dur: 3.5, vol: 0.06, filter: 'lowpass', f0: 300, attack: 1.2 });
    },
    thud() {
      if (!ok('thud', 0.1)) return;
      tone({ f0: 120, f1: 50, dur: 0.2, vol: 0.4 });
    },
    dice() {
      if (!ok('dice', 0.05)) return;
      for (let i = 0; i < 6; i++) noise({ dur: 0.03, vol: 0.18, filter: 'bandpass', f0: rand(2000, 4000), q: 4, delay: i * 0.12 });
    },
    eat() {
      if (!ok('eat', 0.2)) return;
      for (let i = 0; i < 3; i++) noise({ dur: 0.08, vol: 0.2, filter: 'bandpass', f0: rand(700, 1200), q: 1.5, delay: i * 0.16 });
    },
    drink() {
      if (!ok('drink', 0.2)) return;
      for (let i = 0; i < 4; i++) tone({ f0: rand(300, 500), f1: 200, dur: 0.07, vol: 0.12, delay: i * 0.1 });
    },
    freeze() {
      if (!ok('freeze')) return;
      [2093, 1760, 2637, 2349].forEach((f, i) => tone({ f0: f, dur: 0.3, vol: 0.06, delay: i * 0.05 }));
      noise({ dur: 0.5, vol: 0.12, filter: 'highpass', f0: 5000 });
    },
    zap() {
      if (!ok('zap', 0.08)) return;
      tone({ type: 'sine', f0: 1800, f1: 600, dur: 0.12, vol: 0.08 });
    },
    punch() {
      if (!ok('punch', 0.1)) return;
      noise({ dur: 0.08, vol: 0.35, filter: 'lowpass', f0: 500 });
      tone({ f0: 160, f1: 70, dur: 0.08, vol: 0.3 });
    },
    star() {
      if (!ok('star')) return;
      tone({ type: 'square', f0: 988, dur: 0.12, vol: 0.07 });
      tone({ type: 'square', f0: 1319, dur: 0.2, vol: 0.07, delay: 0.13 });
    },
    totem() {
      if (!ok('totem')) return;
      [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.4, vol: 0.12, delay: i * 0.06 }));
    },
    missile() {
      if (!ok('missile', 0.08)) return;
      noise({ dur: 0.4, vol: 0.12, filter: 'bandpass', f0: 800, f1: 3000, q: 2 });
    },
    hiss() {
      if (!ok('hiss', 0.8)) return;
      noise({ dur: 0.45, vol: 0.1, filter: 'highpass', f0: 4000, attack: 0.05 });
    },
    cast() {
      if (!ok('cast', 0.05)) return;
      noise({ dur: 0.12, vol: 0.12, filter: 'bandpass', f0: 1500, f1: 4000, q: 2 });
    },
    splash() {
      if (!ok('splash', 0.08)) return;
      noise({ dur: 0.2, vol: 0.1, filter: 'bandpass', f0: 900, q: 1 });
    },
    click() {
      if (!ok('click', 0.04)) return;
      tone({ type: 'square', f0: 1000, dur: 0.03, vol: 0.08 });
    },

    // --- новые механики ---
    awp() {
      if (!ok('awp')) return;
      noise({ dur: 0.5, vol: 0.8, filter: 'lowpass', f0: 3000, f1: 120 });
      noise({ dur: 0.08, vol: 0.5, filter: 'highpass', f0: 2500 });
      tone({ type: 'sine', f0: 140, f1: 35, dur: 0.45, vol: 0.7 });
      tone({ type: 'square', f0: 900, dur: 0.03, vol: 0.06, delay: 0.7 });
      noise({ dur: 0.1, vol: 0.15, filter: 'bandpass', f0: 2000, delay: 0.8 });
    },
    shotgun() {
      if (!ok('shotgun')) return;
      noise({ dur: 0.35, vol: 0.75, filter: 'lowpass', f0: 2200, f1: 150 });
      tone({ type: 'sine', f0: 110, f1: 40, dur: 0.3, vol: 0.6 });
      noise({ dur: 0.06, vol: 0.2, filter: 'bandpass', f0: 1500, delay: 0.45 });
      noise({ dur: 0.06, vol: 0.2, filter: 'bandpass', f0: 1200, delay: 0.6 });
    },
    weapon() {
      if (!ok('weapon', 0.1)) return;
      noise({ dur: 0.06, vol: 0.18, filter: 'bandpass', f0: 2500, q: 2 });
      tone({ type: 'square', f0: 600, dur: 0.03, vol: 0.06, delay: 0.08 });
    },
    buy() {
      if (!ok('buy', 0.05)) return;
      noise({ dur: 0.05, vol: 0.2, filter: 'bandpass', f0: 3000, q: 3 });
      tone({ type: 'square', f0: 1400, dur: 0.05, vol: 0.06, delay: 0.05 });
    },
    creeperHiss() {
      if (!ok('creeper', 0.3)) return;
      noise({ dur: 1.4, vol: 0.28, filter: 'highpass', f0: 3500, attack: 0.3 });
    },
    skibidi() {
      if (!ok('skibidi', 0.5)) return;
      // «скибиди доп-доп-доп, ес-ес» — чиптюн-версия
      const notes = [[659, 0.0], [659, 0.12], [784, 0.24], [659, 0.36], [523, 0.6], [523, 0.72], [523, 0.84], [587, 1.08], [659, 1.22]];
      for (const [f, d] of notes) tone({ type: 'square', f0: f, dur: 0.1, vol: 0.07, delay: d });
      for (const d of [0.6, 0.72, 0.84]) noise({ dur: 0.05, vol: 0.12, filter: 'lowpass', f0: 400, delay: d });
    },
    flush() {
      if (!ok('flush', 0.2)) return;
      noise({ dur: 0.9, vol: 0.3, filter: 'bandpass', f0: 600, f1: 200, q: 0.8, attack: 0.05 });
    },
    megaLand() {
      if (!ok('mega', 0.1)) return;
      noise({ dur: 0.7, vol: 0.7, filter: 'lowpass', f0: 500, f1: 50 });
      tone({ type: 'sine', f0: 70, f1: 25, dur: 0.6, vol: 0.8 });
    },
    marioCoin() {
      if (!ok('mcoin', 0.05)) return;
      tone({ type: 'square', f0: 988, dur: 0.08, vol: 0.08 });
      tone({ type: 'square', f0: 1319, dur: 0.35, vol: 0.08, delay: 0.08 });
    },
    bump() {
      if (!ok('bump', 0.05)) return;
      tone({ type: 'triangle', f0: 180, f1: 120, dur: 0.1, vol: 0.3 });
    },
    powerUp() {
      if (!ok('powerup')) return;
      [392, 494, 587, 784, 523, 659, 784, 1046].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.07, vol: 0.07, delay: i * 0.06 }));
    },
    oneUp() {
      if (!ok('oneup')) return;
      [1319, 1568, 2637, 2093, 2349, 3136].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.11, vol: 0.06, delay: i * 0.11 }));
    },
    starMusic(dur) {
      if (!ok('starmusic', 1)) return;
      // узнаваемый ритм «звезды»: та-та-та, та-та-та...
      const bar = [[523, 0], [523, 0.15], [523, 0.3], [440, 0.52], [523, 0.67], [523, 0.82], [587, 0.97], [523, 1.12]];
      for (let b = 0; b * 1.3 < dur; b++) {
        for (const [f, d] of bar) {
          tone({ type: 'square', f0: f * (b % 2 ? 1.122 : 1), dur: 0.1, vol: 0.05, delay: b * 1.3 + d });
          tone({ type: 'triangle', f0: f / 2, dur: 0.1, vol: 0.06, delay: b * 1.3 + d });
        }
      }
    },
    quack() {
      if (!ok('quack', 0.4)) return;
      tone({ type: 'sawtooth', f0: 520, f1: 380, dur: 0.12, vol: 0.06 });
      tone({ type: 'sawtooth', f0: 500, f1: 360, dur: 0.12, vol: 0.06, delay: 0.16 });
    },
    dogLaugh() {
      if (!ok('dog', 1)) return;
      for (let i = 0; i < 6; i++) {
        tone({ type: 'square', f0: i % 2 ? 620 : 700, dur: 0.09, vol: 0.07, delay: i * 0.16 });
        noise({ dur: 0.06, vol: 0.08, filter: 'bandpass', f0: 1200, delay: i * 0.16 });
      }
    },
    meeting() {
      if (!ok('meeting', 1)) return;
      for (let i = 0; i < 4; i++) {
        tone({ type: 'sawtooth', f0: 520, f1: 780, dur: 0.25, vol: 0.08, delay: i * 0.5 });
        tone({ type: 'sawtooth', f0: 780, f1: 520, dur: 0.25, vol: 0.08, delay: i * 0.5 + 0.25 });
      }
      tone({ type: 'sine', f0: 90, f1: 60, dur: 0.6, vol: 0.4 });
    },
    eject() {
      if (!ok('eject', 0.5)) return;
      noise({ dur: 1.2, vol: 0.2, filter: 'bandpass', f0: 2500, f1: 300, q: 2 });
    },
    cheat() {
      if (!ok('cheat', 0.2)) return;
      tone({ type: 'sine', f0: 1046, dur: 0.15, vol: 0.12 });
      tone({ type: 'sine', f0: 1568, dur: 0.3, vol: 0.12, delay: 0.12 });
    },
    pea() {
      if (!ok('pea', 0.05)) return;
      tone({ type: 'sine', f0: 420, f1: 220, dur: 0.07, vol: 0.12 });
    },
    splat() {
      if (!ok('splat', 0.04)) return;
      noise({ dur: 0.05, vol: 0.12, filter: 'lowpass', f0: 1200 });
    },
  };
  return S;
})();
