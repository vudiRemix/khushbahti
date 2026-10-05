'use strict';
/* Запуск: холст, масштабирование под окно, мышь, клавиатура, касания и игровой цикл. */

(function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const game = new Game();
  window.__game = game; // для отладки из консоли

  // Телефон или планшет: показываем сенсорные кнопки по краям экрана.
  const mq = (q) => !!(window.matchMedia && matchMedia(q).matches);
  const isTouch = mq('(pointer: coarse)') || (navigator.maxTouchPoints > 0 && !mq('(pointer: fine)'));
  if (isTouch) {
    document.body.classList.add('touch');
    Input.touch = true;
  }

  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const side = isTouch ? Math.round(clamp(vw * 0.085, 58, 96)) : 0;
    document.documentElement.style.setProperty('--side', side + 'px');
    const dpr = Math.min(window.devicePixelRatio || 1, isTouch ? 1.75 : 2);
    const scale = Math.max(0.1, Math.min((vw - side * 2) / W, vh / H));
    canvas.style.width = Math.floor(W * scale) + 'px';
    canvas.style.height = Math.floor(H * scale) + 'px';
    canvas.width = Math.max(1, Math.round(W * scale * dpr));
    canvas.height = Math.max(1, Math.round(H * scale * dpr));
    View.k = scale * dpr;
    View.pw = canvas.width;
    View.ph = canvas.height;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();

  function toLogical(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
  }

  // ---------- мышь и клавиатура ----------
  window.addEventListener('mousemove', (e) => {
    if (Input.touch && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
    const p = toLogical(e.clientX, e.clientY);
    Input.x = clamp(p.x, 0, W);
    Input.y = clamp(p.y, 0, H);
  });
  canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    Sound.init();
    const p = toLogical(e.clientX, e.clientY);
    Input.x = p.x;
    Input.y = p.y;
    if (e.button === 0) Input.lmb = true;
    if (e.button === 2) Input.rmb = true;
    Input.queue.push({ type: 'down', button: e.button, x: p.x, y: p.y });
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) Input.lmb = false;
    if (e.button === 2) Input.rmb = false;
    Input.queue.push({ type: 'up', button: e.button });
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('auxclick', (e) => e.preventDefault());
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      if (e.deltaY) Input.queue.push({ type: 'wheel', dy: Math.sign(e.deltaY) });
    },
    { passive: false }
  );
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof Element && e.target.closest('#nick')) return; // печатают ник
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    Sound.init();
    Input.keys.add(e.code);
    if (!e.repeat) Input.queue.push({ type: 'key', code: e.code });
  });
  window.addEventListener('keyup', (e) => Input.keys.delete(e.code));
  window.addEventListener('blur', () => {
    Input.keys.clear();
    game.onBlur();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.onBlur();
  });

  // ---------- касания по доске ----------
  // Один палец целится: в режиме «огонь» касание стреляет (держи — очередь),
  // в режимах «удочка» и «флажок» касание делает это действие в точке.
  // На арене левая часть экрана — джойстик бега, правая — прицел и огонь.
  let aimTouch = null;
  function arenaTouchStart(e) {
    for (const t of e.changedTouches) {
      const p = toLogical(t.clientX, t.clientY);
      if (Arena.menu) {
        Input.x = p.x;
        Input.y = p.y;
        Input.queue.push({ type: 'down', button: 0, x: p.x, y: p.y });
      } else if (p.x < W * 0.42 && Input.stick.id === null) {
        Object.assign(Input.stick, { id: t.identifier, ox: p.x, oy: p.y, x: p.x, y: p.y });
      } else if (aimTouch === null) {
        aimTouch = t.identifier;
        Input.x = p.x;
        Input.y = p.y;
        Input.lmb = true;
      }
    }
  }
  canvas.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      Sound.init();
      Input.touch = true;
      if (game.state === 'arena') return arenaTouchStart(e);
      if (game.state === 'ut') {
        // бой «как в Undertale»: касание — это и «ок», и джойстик для души
        for (const t of e.changedTouches) {
          const p = toLogical(t.clientX, t.clientY);
          Input.x = p.x;
          Input.y = p.y;
          Input.queue.push({ type: 'down', button: 0, x: p.x, y: p.y });
          if (Input.stick.id === null) Object.assign(Input.stick, { id: t.identifier, ox: p.x, oy: p.y, x: p.x, y: p.y });
        }
        return;
      }
      if (aimTouch !== null) return;
      const t = e.changedTouches[0];
      aimTouch = t.identifier;
      const p = toLogical(t.clientX, t.clientY);
      Input.x = p.x;
      Input.y = p.y;
      if (game.state !== 'play' || game.pendingThrow || game.isUiPoint(p.x, p.y)) {
        Input.queue.push({ type: 'down', button: 0, x: p.x, y: p.y });
        return;
      }
      if (Input.mode === 'rod') Input.queue.push({ type: 'down', button: 2, x: p.x, y: p.y });
      else if (Input.mode === 'flag') Input.queue.push({ type: 'down', button: 1, x: p.x, y: p.y });
      else {
        Input.lmb = true;
        Input.queue.push({ type: 'down', button: 0, x: p.x, y: p.y });
      }
    },
    { passive: false }
  );
  canvas.addEventListener(
    'touchmove',
    (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === Input.stick.id) {
          const p = toLogical(t.clientX, t.clientY);
          Input.stick.x = p.x;
          Input.stick.y = p.y;
          continue;
        }
        if (t.identifier !== aimTouch) continue;
        const p = toLogical(t.clientX, t.clientY);
        Input.x = clamp(p.x, 0, W);
        Input.y = clamp(p.y, 0, H);
      }
    },
    { passive: false }
  );
  function endTouch(e) {
    e.preventDefault();
    Sound.init();
    for (const t of e.changedTouches) {
      if (t.identifier === Input.stick.id) Input.stick.id = null;
      if (t.identifier !== aimTouch) continue;
      aimTouch = null;
      Input.lmb = false;
      Input.queue.push({ type: 'up', button: 0 });
    }
  }
  canvas.addEventListener('touchend', endTouch, { passive: false });
  canvas.addEventListener('touchcancel', endTouch, { passive: false });

  // ---------- сенсорные кнопки ----------
  const modeButtons = [...document.querySelectorAll('[data-mode]')];
  function setMode(mode) {
    Input.mode = mode;
    for (const b of modeButtons) b.classList.toggle('on', b.dataset.mode === mode);
  }
  setMode('shoot');
  const actions = {
    pause: () => Input.queue.push({ type: 'key', code: 'Escape' }),
    buy: () => Input.queue.push({ type: 'key', code: 'KeyB' }),
    reload: () => Input.queue.push({ type: 'key', code: 'KeyR' }),
    weapon: () => Input.queue.push({ type: 'key', code: 'KeyX' }),
    grenade: () => (game.state === 'arena' ? Input.queue.push({ type: 'key', code: 'KeyG' }) : game.armThrow('he')),
    super: () => Input.queue.push({ type: 'key', code: 'KeyE' }),
    fullscreen: () => goFullscreen(),
  };
  for (const b of document.querySelectorAll('.tbar button')) {
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      Sound.init();
      if (b.dataset.mode) setMode(b.dataset.mode);
      else if (b.dataset.act) actions[b.dataset.act]();
      else if (b.dataset.hold) {
        Input.keys.add('ShiftLeft');
        b.classList.add('held');
      }
    });
    const release = () => {
      if (!b.dataset.hold) return;
      Input.keys.delete('ShiftLeft');
      b.classList.remove('held');
    };
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('pointerleave', release);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Полный экран и альбомная ориентация (работает на Android; на iPhone — через «На экран Домой»).
  function goFullscreen() {
    try {
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!document.fullscreenElement && req) {
        const p = req.call(el);
        const lock = () => {
          if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
        };
        if (p && p.then) p.then(lock).catch(() => {});
        else lock();
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    } catch (err) {
      /* полноэкранный режим недоступен */
    }
  }
  window.goFullscreen = goFullscreen;

  // Офлайн-режим и установка на главный экран (только когда игра открыта с сайта).
  // Вышла новая версия — перезагружаемся в неё сами, но только в меню, не посреди боя.
  let updateReady = false;
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && document.querySelector('link[rel="manifest"]')) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // новый sw.js к этому моменту уже сложил файлы в свой кэш: кэш новее нашей версии — страница устарела
      caches.keys().then((keys) => {
        if (keys.some((k) => Number(k.split('-v')[1]) > GAME_VERSION)) updateReady = true;
      }).catch(() => {});
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
        // ярлык на телефоне сам не перезагружается — проверяем обновление, когда игру снова открыли
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) reg.update().catch(() => {});
        });
      }).catch(() => {});
    });
  }

  // какая музыка нужна сейчас
  function musicTrack(g) {
    const s = g.state;
    if (s === 'ut') return 'battle';
    if (s === 'arena') return Arena.kind === 'raid' ? 'battle' : 'action';
    if (s === 'dead' || g.jumpscare) return '';
    if (s === 'play' || s === 'pause' || s === 'buy' || s === 'cheats' || s === 'intro') return 'action';
    return 'calm';
  }

  // заряд «супера» на кнопке
  const superBtn = document.querySelector('[data-act=super]');
  let superShown = -1;
  function updateSuperButton() {
    const k = Arena.me ? Math.floor(Arena.me.su * 10) : 0;
    if (!superBtn || k === superShown) return;
    superShown = k;
    superBtn.classList.toggle('on', k >= 10);
    superBtn.querySelector('small').textContent = k >= 10 ? 'СУПЕР!' : `супер ${k * 10}%`;
  }

  let last = performance.now();
  let uiState = '';
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    try {
      game.update(dt);
      render(ctx, game);
      const playing = ['play', 'buy', 'pause', 'cheats'].includes(game.state);
      const arena = game.state === 'arena';
      const st = arena ? 'arena' : playing ? 'play' : 'menu';
      if (st !== uiState) {
        uiState = st;
        document.body.classList.toggle('ui-play', playing || arena);
        document.body.classList.toggle('ui-arena', arena);
        if (!playing) Input.keys.delete('ShiftLeft');
        if (!arena && game.state !== 'ut') Input.stick.id = null;
      }
      if (arena) updateSuperButton();
      Music.update(musicTrack(game));
      if (updateReady && ['title', 'levels', 'achievements'].includes(game.state)) {
        updateReady = false;
        location.reload();
      }
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
