'use strict';
/* Запуск: холст, масштабирование под окно, обработчики ввода, игровой цикл. */

(function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const game = new Game();
  window.__game = game; // для отладки из консоли

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = Math.floor(W * scale) + 'px';
    canvas.style.height = Math.floor(H * scale) + 'px';
    canvas.width = Math.max(1, Math.round(W * scale * dpr));
    canvas.height = Math.max(1, Math.round(H * scale * dpr));
    View.k = scale * dpr;
    View.pw = canvas.width;
    View.ph = canvas.height;
  }
  window.addEventListener('resize', resize);
  resize();

  function toLogical(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
  }

  window.addEventListener('mousemove', (e) => {
    const p = toLogical(e.clientX, e.clientY);
    Input.x = clamp(p.x, 0, W);
    Input.y = clamp(p.y, 0, H);
  });
  canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    Sound.init();
    Input.touch = false;
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

  // Простейшая поддержка касаний: тап = ЛКМ, долгое нажатие = ПКМ (удочка).
  let touchTimer = null;
  canvas.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      Sound.init();
      Input.touch = true;
      const t = e.changedTouches[0];
      const p = toLogical(t.clientX, t.clientY);
      Input.x = p.x;
      Input.y = p.y;
      if (game.state !== 'play') {
        Input.queue.push({ type: 'down', button: 0, x: p.x, y: p.y });
        return;
      }
      touchTimer = setTimeout(() => {
        touchTimer = null;
        Input.queue.push({ type: 'down', button: 2, x: Input.x, y: Input.y });
      }, 350);
    },
    { passive: false }
  );
  canvas.addEventListener(
    'touchmove',
    (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      const p = toLogical(t.clientX, t.clientY);
      Input.x = p.x;
      Input.y = p.y;
    },
    { passive: false }
  );
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (touchTimer) {
      clearTimeout(touchTimer);
      touchTimer = null;
      Input.queue.push({ type: 'down', button: 0, x: Input.x, y: Input.y });
      Input.queue.push({ type: 'up', button: 0 });
    }
  });

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    try {
      game.update(dt);
      render(ctx, game);
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
