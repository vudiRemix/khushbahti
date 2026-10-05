'use strict';
/* Фоновая музыка — свой чиптюн в духе Undertale, сочинён для этой игры (чужих мелодий нет).
   Квадратная волна — мелодия, треугольник — бас, пила с фильтром — арпеджио, шум — барабаны.
   Ноты планируются чуть вперёд по часам AudioContext прямо из игрового цикла:
   когда вкладка скрыта, кадры не идут — музыка сама замолкает.
   Треки: calm — меню, action — кампания и арена, battle — боссы и бой «как в Undertale». */

const NOTE_IDX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

function noteFreq(n) {
  const m = /^([A-G][#b]?)(\d)$/.exec(n);
  if (!m) return 0;
  const midi = (Number(m[2]) + 1) * 12 + NOTE_IDX[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const CHORDS = {
  C: ['C', 'E', 'G'],
  Am: ['A', 'C', 'E'],
  F: ['F', 'A', 'C'],
  G: ['G', 'B', 'D'],
  Em: ['E', 'G', 'B'],
  Dm: ['D', 'F', 'A'],
  Bb: ['Bb', 'D', 'F'],
  A: ['A', 'C#', 'E'],
};

// Строка нот: по шестнадцатой на токен; «-» тянет предыдущую ноту, «.» — пауза.
function parseLine(str) {
  const toks = str.trim().split(/\s+/);
  const out = [];
  let cur = null;
  toks.forEach((tk, i) => {
    if (tk === '-') {
      if (cur) cur.len++;
    } else if (tk === '.') cur = null;
    else {
      cur = { step: i, notes: tk.split('+'), len: 1 };
      out.push(cur);
    }
  });
  return out;
}

const MUSIC_TRACKS = {
  // Тихая тема меню: до мажор, мягкое арпеджио и простая мелодия.
  calm: {
    bpm: 84,
    chords: ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G'],
    lead: `
      E5 - - - D5 - C5 - D5 - - - E5 - G5 -
      E5 - - - - - - - . . C5 - D5 - E5 -
      F5 - - - E5 - D5 - C5 - - - A4 - C5 -
      D5 - - - - - - - . . . . G4 - B4 -
      C5 - E5 - G5 - - - A5 - G5 - E5 - C5 -
      B4 - - - - - - - . . B4 - C5 - D5 -
      A5 - - - G5 - F5 - E5 - - - D5 - C5 -
      D5 - - - - - - - - - - - . . . .`,
    bass: 'half',
    arp: 'eighths',
    drums: { h: '..x...x...x...x.' },
    vol: { lead: 0.035, bass: 0.09, arp: 0.022 },
  },
  // Бодрая тема для кампании и арены: ля минор, бас восьмыми.
  action: {
    bpm: 132,
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'],
    lead: `
      A4 - C5 - E5 - A5 - G5 - E5 - . . C5 -
      F5 - - - E5 - C5 - A4 - - - C5 - D5 -
      E5 - - - G5 - E5 - C5 - - - D5 - E5 -
      D5 - - - B4 - G4 - . . G4 - A4 - B4 -
      C6 - - - B5 - A5 - E5 - - - A5 - B5 -
      C6 - - - A5 - F5 - C5 - - - F5 - G5 -
      E5 - G5 - C6 - - - B5 - G5 - E5 - G5 -
      D5 - - - - - - - B4 - D5 - G5 - B5 -`,
    bass: 'drive',
    arp: 'sixteenths',
    drums: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    vol: { lead: 0.04, bass: 0.1, arp: 0.014 },
  },
  // Боевая тема: ре минор, быстро и с напором.
  battle: {
    bpm: 150,
    chords: ['Dm', 'Dm', 'C', 'C', 'Bb', 'Bb', 'C', 'A'],
    lead: `
      A4 - D5 - F5 - A5 - G5 F5 E5 D5 E5 - F5 -
      A5 - - - C6 - A5 - G5 - F5 - E5 - D5 -
      E5 - G5 - C6 - G5 - E5 - C5 - E5 - G5 -
      F5 - E5 - D5 - C5 - E5 - - - . . . .
      D5 - F5 - Bb5 - F5 - D5 - F5 - A5 - Bb5 -
      C6 - - - Bb5 - A5 - G5 - F5 - D5 - F5 -
      G5 - - - E5 - C5 - G5 - A5 - Bb5 - C6 -
      C#6 - - - A5 - - - E5 - - - C#5 - E5 -`,
    bass: 'pump',
    arp: 'sixteenths',
    drums: { k: 'x..x..x.x..x..x.', s: '....x.......x..x', h: 'xxxxxxxxxxxxxxxx' },
    vol: { lead: 0.042, bass: 0.1, arp: 0.012 },
  },
};

// Бас и арпеджио строятся из аккордов, мелодия и барабаны — из строк.
function compileTrack(tr) {
  const bars = tr.chords.length, steps = bars * 16;
  const byStep = Array.from({ length: steps }, () => []);
  const add = (step, inst, notes, len) => byStep[step % steps].push({ inst, freqs: notes.map(noteFreq).filter(Boolean), len });
  for (const ev of parseLine(tr.lead)) add(ev.step, 'lead', ev.notes, ev.len);
  tr.chords.forEach((name, bar) => {
    const ch = CHORDS[name], root = ch[0], s0 = bar * 16;
    if (tr.bass === 'half') {
      add(s0, 'bass', [root + '2'], 8);
      add(s0 + 8, 'bass', [ch[2] + '2'], 8);
    } else if (tr.bass === 'drive') {
      for (let i = 0; i < 8; i++) add(s0 + i * 2, 'bass', [root + (i % 4 === 2 ? '3' : '2')], 2);
    } else {
      for (let i = 0; i < 8; i++) add(s0 + i * 2, 'bass', [root + (i % 2 ? '3' : '2')], 1);
    }
    const tones = [ch[0] + '4', ch[1] + '4', ch[2] + '4', ch[1] + '4'];
    if (tr.arp === 'eighths') for (let i = 0; i < 8; i++) add(s0 + i * 2, 'arp', [tones[i % 4]], 2);
    else for (let i = 0; i < 16; i++) add(s0 + i, 'arp', [tones[i % 4]], 1);
    for (const [inst, pat] of Object.entries(tr.drums)) {
      for (let i = 0; i < 16; i++) if (pat[i] === 'x') byStep[s0 + i].push({ inst, freqs: [], len: 1 });
    }
  });
  return { stepDur: 60 / tr.bpm / 4, steps, byStep, vol: tr.vol };
}

const Music = {
  on: Store.get('kd_music') !== '0',
  name: '',
  cur: null,
  step: 0,
  nextT: 0,
  out: null, // свой регулятор громкости у каждого трека — чтобы старый трек мягко затухал
  cache: {},

  toggle() {
    this.on = !this.on;
    Store.set('kd_music', this.on ? '1' : '0');
    if (!this.on) this.fadeOut();
    else this.name = '';
  },

  fadeOut() {
    const a = Sound.audio();
    if (a && this.out) {
      const t = a.ctx.currentTime;
      this.out.gain.cancelScheduledValues(t);
      this.out.gain.setValueAtTime(this.out.gain.value, t);
      this.out.gain.linearRampToValueAtTime(0, t + 0.6);
      const old = this.out;
      setTimeout(() => old.disconnect(), 900);
    }
    this.out = null;
    this.cur = null;
  },

  // Каждый кадр: какой трек нужен сейчас — тот и играет.
  update(want) {
    const a = Sound.audio();
    if (!a) return;
    if (!this.on || Sound.muted) want = '';
    if (want !== this.name) {
      this.name = want;
      this.fadeOut();
      if (want) {
        this.cur = this.cache[want] || (this.cache[want] = compileTrack(MUSIC_TRACKS[want]));
        this.out = a.ctx.createGain();
        this.out.gain.value = 0.55;
        this.out.connect(a.master);
        this.step = 0;
        this.nextT = a.ctx.currentTime + 0.1;
      }
    }
    if (!this.cur) return;
    const now = a.ctx.currentTime;
    if (this.nextT < now - 0.2) this.nextT = now + 0.05; // вкладка спала — не играем пропущенное пачкой
    while (this.nextT < now + 0.25) {
      for (const ev of this.cur.byStep[this.step]) this.play(a, ev, this.nextT);
      this.nextT += this.cur.stepDur;
      this.step = (this.step + 1) % this.cur.steps;
    }
  },

  play(a, ev, t) {
    const ctx = a.ctx, out = this.out, v = this.cur.vol;
    const dur = ev.len * this.cur.stepDur;
    const voice = (type, f, vol, d, filter) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(vol * 0.55, t + Math.max(0.03, d * 0.5));
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      if (filter) {
        const f2 = ctx.createBiquadFilter();
        f2.type = 'lowpass';
        f2.frequency.value = filter;
        o.connect(f2);
        f2.connect(g);
      } else o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + d + 0.02);
    };
    const hit = (filter, f0, vol, d) => {
      const src = ctx.createBufferSource();
      src.buffer = a.noiseBuf;
      const fl = ctx.createBiquadFilter();
      fl.type = filter;
      fl.frequency.value = f0;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(fl);
      fl.connect(g);
      g.connect(out);
      src.start(t, Math.random());
      src.stop(t + d + 0.02);
    };
    if (ev.inst === 'lead') for (const f of ev.freqs) voice('square', f, v.lead, dur * 0.95, 0);
    else if (ev.inst === 'bass') for (const f of ev.freqs) voice('triangle', f, v.bass, dur * 0.9, 0);
    else if (ev.inst === 'arp') for (const f of ev.freqs) voice('sawtooth', f, v.arp, dur * 0.9, 1600);
    else if (ev.inst === 'k') {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + 0.16);
    } else if (ev.inst === 's') hit('bandpass', 1800, 0.09, 0.11);
    else if (ev.inst === 'h') hit('highpass', 7000, 0.025, 0.035);
  },
};
