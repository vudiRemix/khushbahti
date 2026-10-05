'use strict';
/* Фоновая музыка — свои треки, сочинены для этой игры (чужих мелодий нет).
   neon — меню, drive — кампания, hunt — арена и босс-рейд: синтвейв в духе саундтреков
   Hotline Miami — бас пульсирует шестнадцатыми, бочка бьёт каждую долю и «качает» весь звук,
   пилообразный лид с эхом, арпеджио с фильтром, который то открывается, то закрывается.
   battle — чиптюн для боя «как в Undertale».
   Ноты планируются чуть вперёд по часам AudioContext прямо из игрового цикла:
   вкладка скрыта — кадры не идут, музыка сама замолкает. */

const NOTE_IDX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

function noteFreq(n) {
  const m = /^([A-G][#b]?)(\d)$/.exec(n);
  if (!m) return 0;
  const midi = (Number(m[2]) + 1) * 12 + NOTE_IDX[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const CHORDS = {
  C: ['C', 'E', 'G'],
  Cm: ['C', 'Eb', 'G'],
  D: ['D', 'F#', 'A'],
  Dm: ['D', 'F', 'A'],
  Db: ['Db', 'F', 'Ab'],
  Eb: ['Eb', 'G', 'Bb'],
  Em: ['E', 'G', 'B'],
  F: ['F', 'A', 'C'],
  Fm: ['F', 'Ab', 'C'],
  G: ['G', 'B', 'D'],
  Gm: ['G', 'Bb', 'D'],
  Ab: ['Ab', 'C', 'Eb'],
  A: ['A', 'C#', 'E'],
  Am: ['A', 'C', 'E'],
  Bb: ['Bb', 'D', 'F'],
  B: ['B', 'D#', 'F#'],
};

// Аккорд снизу вверх от октавы oct: Ab → Ab4 C5 Eb5.
function voicing(name, oct) {
  const out = [];
  let prev = -1;
  for (const n of CHORDS[name]) {
    if (NOTE_IDX[n] <= prev) oct++;
    prev = NOTE_IDX[n];
    out.push(n + oct);
  }
  return out;
}

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
      cur = { step: i, tok: tk, len: 1 };
      out.push(cur);
    }
  });
  out.steps = toks.length;
  return out;
}

const MUSIC_TRACKS = {
  // Меню: мечтательный синтвейв в фа миноре, медленно, с эхом.
  neon: {
    bpm: 96,
    bass: 'r - - - - - - - r - - - o - - -',
    arp: '0 - 2 - 3 - 4 - 3 - 2 - 1 - 2 -',
    drums: { k: 'x.......x.......', s: '........x.......', h: '..x...x...x...x.' },
    parts: [
      { chords: ['Fm', 'Db', 'Ab', 'Eb'], drums: 'off', pad: true, sweep: [500, 1300] },
      {
        chords: ['Fm', 'Db', 'Ab', 'Eb', 'Fm', 'Db', 'Ab', 'Eb'],
        pad: true,
        sweep: [1300, 2200],
        lead: `
          C6 - - - - - - - Ab5 - - - G5 - Ab5 -
          F5 - - - - - - - - - - - . . . .
          Eb6 - - - - - - - C6 - - - Bb5 - C6 -
          G5 - - - - - - - - - - - . . . .
          C6 - - - - - - - Ab5 - - - G5 - Ab5 -
          F6 - - - - - Eb6 - Db6 - - - C6 - - -
          C6 - - - - - - - Eb6 - - - Ab5 - - -
          Bb5 - - - - - - - G5 - - - - - - -`,
      },
      {
        chords: ['Db', 'Eb', 'Fm', 'Fm', 'Db', 'Eb', 'C', 'C'],
        pad: true,
        sweep: [2200, 900],
        lead: `
          Ab5 - - - - - - - F5 - - - Ab5 - Db6 -
          Bb5 - - - - - - - G5 - - - Eb5 - - -
          C6 - - - - - - - - - - - Ab5 - - -
          F5 - - - - - - - . . . . . . . .
          F6 - - - - - - - Db6 - - - Ab5 - - -
          G5 - - - Bb5 - - - Eb6 - - - - - - -
          E6 - - - - - - - C6 - - - G5 - - -
          Bb5 - - - - - - - G5 - - - E5 - - -`,
      },
    ],
    sound: {
      gain: 0.33, // общая громкость трека: подобрана по замеру LUFS, чтобы не глушить звуки игры
      lead: { wave: 'saw2', vol: 0.1, cutoff: 2200, q: 1, vib: true, delay: 0.5, verb: 0.35 },
      bass: { wave: 'soft', vol: 0.11 },
      arp: { wave: 'square', vol: 0.05, q: 4, delay: 0.45 },
      pad: { vol: 0.035, cutoff: 1100 },
      drums: { k: 0.55, s: 0.56, h: 0.3 },
      duck: 0.45,
      fb: 0.42,
      dlyWet: 0.5,
      verbWet: 0.7,
    },
  },

  // Кампания: напористый синтвейв в до миноре — бас катится шестнадцатыми, бочка качает.
  drive: {
    bpm: 124,
    bass: 'r r o r r o r o r r o r r o r o',
    arp: '0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1',
    drums: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '..x...x...x...x.' },
    parts: [
      { chords: ['Cm', 'Ab', 'Eb', 'Bb'], drums: 'hats', sweep: [450, 1400] },
      {
        chords: ['Cm', 'Ab', 'Eb', 'Bb', 'Cm', 'Ab', 'Eb', 'Bb'],
        sweep: [1400, 2600],
        lead: `
          G5 - - - Eb5 - - - C5 - D5 - Eb5 - G5 -
          Ab5 - - - - - G5 - Eb5 - - - C5 - - -
          Bb5 - - - G5 - - - Eb5 - G5 - Bb5 - C6 -
          D6 - - - C6 - Bb5 - F5 - - - - - - -
          G5 - - - Eb5 - - - C5 - D5 - Eb5 - G5 -
          Ab5 - - - - - Bb5 - C6 - - - Eb6 - - -
          D6 - - - C6 - Bb5 - G5 - - - Eb5 - F5 -
          D5 - - - - - - - . . . . . . . .`,
      },
      {
        chords: ['Ab', 'Bb', 'Gm', 'Cm', 'Ab', 'Bb', 'G', 'G'],
        pad: true,
        sweep: [2600, 3200],
        lead: `
          C6 - - - - - - - Bb5 - - - Ab5 - - -
          D6 - - - - - - - F6 - - - D6 - - -
          Bb5 - - - D6 - - - G5 - - - Bb5 - - -
          C6 - - - - - - - - - - - . . . .
          Eb6 - - - C6 - - - Ab5 - C6 - Eb6 - - -
          F6 - - - D6 - - - Bb5 - D6 - F6 - - -
          G5 - B5 - D6 - B5 - G5 - B5 - D6 - F6 -
          Eb6 - - - D6 - - - B5 - - - G5 - - -`,
      },
      {
        chords: ['Cm', 'Ab', 'Eb', 'Bb', 'Cm', 'Ab', 'Eb', 'Bb'],
        pad: true,
        sweep: [2000, 3200],
        lead: 'same:1',
      },
      { chords: ['Ab', 'Bb', 'Cm', 'Cm'], bass: false, drums: 'off', pad: true, sweep: [3000, 600] },
    ],
    sound: {
      gain: 0.27, // общая громкость трека: подобрана по замеру LUFS, чтобы не глушить звуки игры
      lead: { wave: 'saw2', vol: 0.12, cutoff: 3600, q: 1.2, vib: true, delay: 0.35, verb: 0.2 },
      bass: { wave: 'pluck', vol: 0.09, cutoff: 1600, drive: 3 },
      arp: { wave: 'square', vol: 0.07, q: 6, delay: 0.25 },
      pad: { vol: 0.028, cutoff: 1300 },
      drums: { k: 0.75, s: 1.4, h: 0.16, o: 0.18 },
      duck: 0.6,
      fb: 0.35,
      dlyWet: 0.45,
      verbWet: 0.6,
    },
  },

  // Арена и босс-рейд: тёмный и быстрый, ми минор, бас с перегрузом.
  hunt: {
    bpm: 132,
    bass: 'r . r o r . r o r . r o r r o r',
    arp: '3 2 0 2 3 2 0 2 4 2 0 2 3 2 0 2',
    drums: { k: 'x...x...x...x...', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', o: '..x...x...x...x.' },
    parts: [
      { chords: ['Em', 'C', 'D', 'B'], drums: 'hats', sweep: [400, 1200] },
      {
        chords: ['Em', 'C', 'D', 'B', 'Em', 'C', 'D', 'B'],
        sweep: [1200, 2400],
        lead: `
          E5 - - - B5 - - - - - - - G5 - A5 -
          B5 - - - - - G5 - E5 - - - - - - -
          F#5 - - - A5 - - - D6 - - - C6 - - -
          B5 - - - - - - - A5 - - - F#5 - D#5 -
          E5 - - - B5 - - - - - - - G5 - A5 -
          B5 - - - C6 - - - E6 - - - D6 - C6 -
          A5 - - - - - - - F#5 - - - A5 - C6 -
          B5 - - - - - - - - - - - . . . .`,
      },
      {
        chords: ['Am', 'Em', 'C', 'B', 'Am', 'Em', 'C', 'B'],
        pad: true,
        sweep: [2400, 3000],
        lead: `
          A5 - - - C6 - - - E6 - - - - - - -
          D6 - - - B5 - - - G5 - - - - - - -
          E6 - - - - - D6 - C6 - - - G5 - - -
          F#5 - - - - - - - D#5 - - - F#5 - A5 -
          C6 - - - B5 - A5 - E5 - - - A5 - B5 -
          G5 - - - - - - - B5 - - - E6 - - -
          E6 - - - D6 - C6 - B5 - - - G5 - - -
          F#5 - - - A5 - - - B5 - - - D#6 - - -`,
      },
      {
        chords: ['Em', 'C', 'D', 'B', 'Em', 'C', 'D', 'B'],
        pad: true,
        sweep: [1800, 3000],
        lead: 'same:1',
      },
      { chords: ['C', 'D', 'B', 'B'], bass: false, drums: 'hats', pad: true, sweep: [2800, 500] },
    ],
    sound: {
      gain: 0.25, // общая громкость трека: подобрана по замеру LUFS, чтобы не глушить звуки игры
      lead: { wave: 'saw2', vol: 0.13, cutoff: 3000, q: 2, vib: true, delay: 0.3, verb: 0.18 },
      bass: { wave: 'pluck', vol: 0.09, cutoff: 2000, drive: 6 },
      arp: { wave: 'sawtooth', vol: 0.09, q: 8, delay: 0.2 },
      pad: { vol: 0.03, cutoff: 1200 },
      drums: { k: 0.8, s: 1.4, h: 0.14, o: 0.16 },
      duck: 0.65,
      fb: 0.3,
      dlyWet: 0.4,
      verbWet: 0.55,
    },
  },

  // Бой «как в Undertale»: чиптюн в ре миноре, быстро и с напором.
  battle: {
    bpm: 150,
    bass: 'r . o . r . o . r . o . r . o .',
    arp: '0 1 2 1 0 1 2 1 0 1 2 1 0 1 2 1',
    drums: { k: 'x..x..x.x..x..x.', s: '....x.......x..x', h: 'xxxxxxxxxxxxxxxx' },
    parts: [
      {
        chords: ['Dm', 'Dm', 'C', 'C', 'Bb', 'Bb', 'C', 'A'],
        sweep: [1600, 1600],
        lead: `
          A4 - D5 - F5 - A5 - G5 F5 E5 D5 E5 - F5 -
          A5 - - - C6 - A5 - G5 - F5 - E5 - D5 -
          E5 - G5 - C6 - G5 - E5 - C5 - E5 - G5 -
          F5 - E5 - D5 - C5 - E5 - - - . . . .
          D5 - F5 - Bb5 - F5 - D5 - F5 - A5 - Bb5 -
          C6 - - - Bb5 - A5 - G5 - F5 - D5 - F5 -
          G5 - - - E5 - C5 - G5 - A5 - Bb5 - C6 -
          C#6 - - - A5 - - - E5 - - - C#5 - E5 -`,
      },
    ],
    sound: {
      lead: { wave: 'square', vol: 0.042 },
      bass: { wave: 'triangle', vol: 0.1, oct: 2 },
      arp: { wave: 'sawtooth', vol: 0.012, q: 0.7 },
      drums: { k: 0.28, s: 0.09, h: 0.025, chip: true },
      duck: 0,
      verbWet: 0,
    },
  },
};

// Партии собираются в один цикл: по шестнадцатым — список нот.
function compileTrack(tr) {
  const bars = tr.parts.reduce((n, p) => n + p.chords.length, 0);
  const steps = bars * 16;
  const byStep = Array.from({ length: steps }, () => []);
  const add = (step, ev) => byStep[step % steps].push(ev);
  const bassPat = parseLine(tr.bass), arpPat = parseLine(tr.arp);
  const leads = [];
  let bar0 = 0;
  tr.parts.forEach((part, pi) => {
    const n = part.chords.length;
    const s0 = bar0 * 16;
    let lead = part.lead || '';
    if (lead.startsWith('same:')) lead = tr.parts[Number(lead.slice(5))].lead;
    leads.push(lead);
    if (lead) {
      const evs = parseLine(lead);
      if (evs.steps !== n * 16) console.warn(`music: партия ${pi} — ${evs.steps} шестнадцатых вместо ${n * 16}`);
      for (const ev of evs) add(s0 + ev.step, { inst: 'lead', freqs: ev.tok.split('+').map(noteFreq).filter(Boolean), len: ev.len });
    }
    part.chords.forEach((name, b) => {
      const st = s0 + b * 16;
      const ch = CHORDS[name];
      const root = ch[0];
      if (part.bass !== false) {
        const oct = tr.sound.bass.oct || (NOTE_IDX[root] >= 9 ? 1 : 2);
        for (const ev of bassPat) {
          const note = ev.tok === 'o' ? root + (oct + 1) : ev.tok === 'f' ? ch[2] + (NOTE_IDX[ch[2]] > NOTE_IDX[root] ? oct : oct + 1) : root + oct;
          add(st + ev.step, { inst: 'bass', freqs: [noteFreq(note)], len: ev.len });
        }
      }
      if (part.arp !== false) {
        const v = voicing(name, 4);
        const tones = [v[0], v[1], v[2], root + 5, ch[1] + (Number(v[1].slice(-1)) + 1)];
        const sw = part.sweep || [1600, 1600];
        for (const ev of arpPat) {
          const k = (b * 16 + ev.step) / (n * 16);
          add(st + ev.step, { inst: 'arp', freqs: [noteFreq(tones[Number(ev.tok)])], len: ev.len, cut: sw[0] + (sw[1] - sw[0]) * k });
        }
      }
      if (part.pad) add(st, { inst: 'pad', freqs: voicing(name, 3).map(noteFreq), len: 16 });
      const dm = part.drums || 'full';
      for (const [inst, pat] of Object.entries(tr.drums)) {
        if (dm === 'off' || (dm === 'hats' && inst !== 'h' && inst !== 'o')) continue;
        for (let i = 0; i < 16; i++) if (pat[i] === 'x') byStep[st + i].push({ inst, freqs: [], len: 1 });
      }
    });
    bar0 += n;
  });
  return { bpm: tr.bpm, stepDur: 60 / tr.bpm / 4, steps, byStep, sound: tr.sound };
}

// ---------- синтезатор ----------
const musicNoise = new WeakMap();
function noiseFor(ctx) {
  let b = musicNoise.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    musicNoise.set(ctx, b);
  }
  return b;
}

// «Комната» для реверба: затухающий шум.
function impulse(ctx, sec) {
  const len = Math.floor(ctx.sampleRate * sec);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return b;
}

function softClip(amount) {
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return c;
}

// Шина трека: громкость, «качание» от бочки, эхо и реверб.
function makeMusicBus(ctx, dest, track) {
  const s = track.sound, nodes = [];
  const node = (n) => (nodes.push(n), n);
  const gain = (v, to) => {
    const g = node(ctx.createGain());
    g.gain.value = v;
    if (to) g.connect(to);
    return g;
  };
  const out = gain(s.gain || 0.55, dest);
  const duck = gain(1, out);
  const bus = { ctx, out, duck, nodes, noise: noiseFor(ctx), s, beat: 60 / track.bpm };
  let dly = null, verb = null;
  if (s.fb) {
    dly = node(ctx.createDelay(2));
    dly.delayTime.value = bus.beat * 0.75;
    const lp = node(ctx.createBiquadFilter());
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    dly.connect(lp);
    lp.connect(gain(s.fb, dly));
    lp.connect(gain(s.dlyWet, out));
  }
  if (s.verbWet) {
    verb = node(ctx.createConvolver());
    verb.buffer = impulse(ctx, 1.6);
    verb.connect(gain(s.verbWet, out));
  }
  const send = (src, to, v) => {
    if (to && v) src.connect(gain(v, to));
  };
  bus.lead = gain(1, out);
  send(bus.lead, dly, s.lead.delay);
  send(bus.lead, verb, s.lead.verb);
  bus.arp = gain(1, duck);
  send(bus.arp, dly, s.arp.delay);
  bus.pad = gain(1, duck);
  send(bus.pad, verb, 0.4);
  if (s.bass.drive) {
    bus.bass = node(ctx.createWaveShaper());
    bus.bass.curve = softClip(s.bass.drive);
    bus.bass.connect(gain(1 / Math.sqrt(s.bass.drive), duck));
  } else bus.bass = gain(1, duck);
  bus.drums = gain(1, out);
  bus.snare = gain(1, out);
  send(bus.snare, verb, 0.35);
  return bus;
}

function freeMusicBus(bus) {
  for (const n of bus.nodes) n.disconnect();
}

// Одна нота или удар барабана в момент t.
function playMusicEvent(bus, ev, t, stepDur) {
  const ctx = bus.ctx, s = bus.s;
  const dur = ev.len * stepDur;
  const osc = (type, f, det, dest) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (det) o.detune.setValueAtTime(det, t);
    o.connect(dest);
    o.start(t);
    return o;
  };
  const lowpass = (f, q, dest) => {
    const fl = ctx.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.setValueAtTime(f, t);
    fl.Q.value = q || 0.7;
    fl.connect(dest);
    return fl;
  };
  // огибающая: быстрая атака, спад до sus, затухание к концу ноты
  const env = (vol, d, dest, atk = 0.012, sus = 0.55) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + atk);
    g.gain.exponentialRampToValueAtTime(vol * sus, t + Math.max(atk + 0.02, d * 0.5));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    g.connect(dest);
    return g;
  };
  const noise = (type, f0, vol, d, dest, q, at = t) => {
    const src = ctx.createBufferSource();
    src.buffer = bus.noise;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = f0;
    if (q) fl.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + d);
    src.connect(fl);
    fl.connect(g);
    g.connect(dest);
    src.start(at, Math.random() * 0.5);
    src.stop(at + d + 0.02);
  };
  const stopAll = (list, end) => list.forEach((o) => o.stop(end));

  if (ev.inst === 'lead') {
    const L = s.lead;
    for (const f of ev.freqs) {
      const d = dur * 0.95;
      const g = env(L.vol, d + 0.06, bus.lead, 0.01, L.wave === 'square' ? 0.55 : 0.75);
      const dest = L.cutoff ? lowpass(L.cutoff, L.q, g) : g;
      const list = L.wave === 'saw2' ? [osc('sawtooth', f, -9, dest), osc('sawtooth', f, 9, dest)] : [osc(L.wave, f, 0, dest)];
      if (L.vib && d > 0.3) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5.5;
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(0, t);
        depth.gain.linearRampToValueAtTime(14, t + 0.3);
        lfo.connect(depth);
        for (const o of list) depth.connect(o.detune);
        lfo.start(t);
        list.push(lfo);
      }
      stopAll(list, t + d + 0.1);
    }
  } else if (ev.inst === 'bass') {
    const B = s.bass;
    for (const f of ev.freqs) {
      if (B.wave === 'pluck') {
        // пила + квадрат через фильтр, который захлопывается — «щелчок» как у синтвейв-баса
        const d = Math.max(0.09, dur * 0.85);
        const g = env(B.vol, d, bus.bass, 0.004, 0.6);
        const fl = lowpass(B.cutoff, 5, g);
        fl.frequency.exponentialRampToValueAtTime(170, t + 0.14);
        stopAll([osc('sawtooth', f, 0, fl), osc('square', f, -6, fl)], t + d + 0.02);
      } else if (B.wave === 'soft') {
        const d = dur * 0.95;
        const g = env(B.vol, d, bus.bass, 0.03, 0.8);
        stopAll([osc('triangle', f, 0, g), osc('sine', f / 2, 0, g)], t + d + 0.02);
      } else {
        const d = dur * 0.9;
        stopAll([osc(B.wave, f, 0, env(B.vol, d, bus.bass))], t + d + 0.02);
      }
    }
  } else if (ev.inst === 'arp') {
    const A = s.arp;
    for (const f of ev.freqs) {
      const d = dur * 0.9;
      const g = env(A.vol, d, bus.arp, 0.005, 0.4);
      stopAll([osc(A.wave, f, 0, lowpass(ev.cut, A.q, g))], t + d + 0.02);
    }
  } else if (ev.inst === 'pad') {
    const P = s.pad;
    const d = dur;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(P.vol, t + 0.35);
    g.gain.setValueAtTime(P.vol, t + d - 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.4);
    g.connect(bus.pad);
    const fl = lowpass(P.cutoff, 0.7, g);
    const list = [];
    for (const f of ev.freqs) list.push(osc('sawtooth', f, -11, fl), osc('sawtooth', f, 11, fl));
    stopAll(list, t + d + 0.45);
  } else if (ev.inst === 'k') {
    const D = s.drums;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const tail = D.chip ? 0.14 : 0.32;
    o.frequency.setValueAtTime(D.chip ? 150 : 165, t);
    o.frequency.exponentialRampToValueAtTime(D.chip ? 45 : 42, t + (D.chip ? 0.12 : 0.11));
    g.gain.setValueAtTime(D.k, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + tail);
    o.connect(g);
    g.connect(bus.drums);
    o.start(t);
    o.stop(t + tail + 0.02);
    if (!D.chip) noise('highpass', 2500, D.k * 0.12, 0.012, bus.drums);
    // бочка «приглушает» бас, арпеджио и подклад — весь трек дышит в такт
    if (s.duck) {
      bus.duck.gain.setValueAtTime(1 - s.duck, t);
      bus.duck.gain.linearRampToValueAtTime(1, t + bus.beat * 0.6);
    }
  } else if (ev.inst === 's') {
    const D = s.drums;
    if (D.chip) noise('bandpass', 1800, D.s, 0.11, bus.snare);
    else {
      // хлопок: три быстрых всплеска шума и хвост в реверб
      for (const dt of [0, 0.011, 0.022]) noise('bandpass', 1300, D.s, 0.03, bus.snare, 1.2, t + dt);
      noise('bandpass', 1500, D.s * 0.8, 0.24, bus.snare, 0.9, t + 0.03);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(200, t);
      o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
      g.gain.setValueAtTime(D.s * 0.6, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g);
      g.connect(bus.snare);
      o.start(t);
      o.stop(t + 0.1);
    }
  } else if (ev.inst === 'h') noise('highpass', s.drums.chip ? 7000 : 8000, s.drums.h, s.drums.chip ? 0.035 : 0.03, bus.drums);
  else if (ev.inst === 'o') noise('highpass', 6500, s.drums.o, 0.2, bus.drums);
}

const Music = {
  on: Store.get('kd_music') !== '0',
  name: '',
  cur: null,
  step: 0,
  nextT: 0,
  bus: null, // своя шина у каждого трека — чтобы старый трек мягко затухал
  cache: {},

  toggle() {
    this.on = !this.on;
    Store.set('kd_music', this.on ? '1' : '0');
    if (!this.on) this.fadeOut();
    else this.name = '';
  },

  compiled(name) {
    return this.cache[name] || (this.cache[name] = compileTrack(MUSIC_TRACKS[name]));
  },

  fadeOut() {
    const a = Sound.audio();
    if (a && this.bus) {
      const t = a.ctx.currentTime, g = this.bus.out.gain, old = this.bus;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0, t + 0.6);
      setTimeout(() => freeMusicBus(old), 2500);
    }
    this.bus = null;
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
        this.cur = this.compiled(want);
        this.bus = makeMusicBus(a.ctx, a.master, this.cur);
        this.step = 0;
        this.nextT = a.ctx.currentTime + 0.1;
      }
    }
    if (!this.cur) return;
    const now = a.ctx.currentTime;
    if (this.nextT < now - 0.2) this.nextT = now + 0.05; // вкладка спала — не играем пропущенное пачкой
    while (this.nextT < now + 0.25) {
      for (const ev of this.cur.byStep[this.step]) playMusicEvent(this.bus, ev, this.nextT, this.cur.stepDur);
      this.nextT += this.cur.stepDur;
      this.step = (this.step + 1) % this.cur.steps;
    }
  },

  // Записать кусок трека без звука (для проверки громкости и превью); only — только эти инструменты.
  render(name, seconds, only = null, rate = 44100) {
    const tr = this.compiled(name);
    const ctx = new OfflineAudioContext(2, Math.ceil(rate * seconds), rate);
    const bus = makeMusicBus(ctx, ctx.destination, tr);
    let t = 0.05;
    for (let i = 0; t < seconds; i++, t += tr.stepDur) {
      for (const ev of tr.byStep[i % tr.steps]) if (!only || only.includes(ev.inst)) playMusicEvent(bus, ev, t, tr.stepDur);
    }
    return ctx.startRendering();
  },
};
