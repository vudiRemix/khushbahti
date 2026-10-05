'use strict';
/* Сеть для дуэли. Два способа связи с одним интерфейсом:
   1) внутри claude.ai — возможность room: живой канал между всеми,
      у кого сейчас открыта эта игра;
   2) на обычном сайте (GitHub Pages и т.п.) — публичный MQTT-сервер через WebSocket.
   Канал — это «присутствие»: каждый держит одно своё состояние, все видят состояния друг друга.
   channel = { set(state), peers() → [{ id, me, state }], leave() } */

const NET_PREFIX = 'khaos-doska/v1';
// Библиотека лежит рядом с игрой; если её нет (сборка в один файл) — берём с CDN.
const MQTT_LIBS = ['js/vendor/mqtt.min.js', 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js'];
const MQTT_BROKERS = window.KD_MQTT_BROKERS || ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'];

// Короткое имя сервера для экрана лобби.
function brokerName(url) {
  const host = String(url).replace(/^wss?:\/\//, '').split(/[:/]/)[0];
  return host.replace(/^(broker|mqtt)\./, '');
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('load failed'));
    document.head.appendChild(s);
  });
}

function connectMqtt(url, clientId) {
  return new Promise((resolve) => {
    let done = false;
    let client;
    const finish = (ok) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (!ok && client) client.end(true);
      resolve(ok ? client : null);
    };
    const timer = setTimeout(() => finish(false), 8000);
    try {
      client = window.mqtt.connect(url, { clientId, connectTimeout: 7000, reconnectPeriod: 3000, keepalive: 30, clean: true });
      client.once('connect', () => finish(true));
      client.once('error', () => finish(false));
    } catch (e) {
      finish(false);
    }
  });
}

const Net = {
  kind: null, // 'room' | 'mqtt'
  status: 'idle', // idle | connecting | ready | failed
  error: '',
  myId: Math.random().toString(36).slice(2, 10),
  room: null,
  client: null,
  initPromise: null,
  server: '', // к какому MQTT-серверу подключились
  brokerIdx: 0,

  init() {
    if (this.status === 'ready') return Promise.resolve(true);
    if (this.initPromise) return this.initPromise;
    this.status = 'connecting';
    this.error = '';
    this.initPromise = this.connect().then((ok) => {
      this.status = ok ? 'ready' : 'failed';
      if (!ok) this.initPromise = null;
      return ok;
    });
    return this.initPromise;
  },

  async connect() {
    // 1) Игра открыта на claude.ai
    if (window.claude && typeof window.claude.use === 'function') {
      try {
        const room = await window.claude.use('room');
        if (room) {
          this.room = room;
          this.kind = 'room';
          return true;
        }
      } catch (e) {
        /* нет связи */
      }
      this.error = 'В этом окне дуэль недоступна. Открой игру по своей ссылке claude.ai, войдя в аккаунт, или на сайте игры.';
      return false;
    }
    // 2) Обычный сайт
    if (!/^https?:$/.test(location.protocol) && !window.KD_MQTT_BROKERS) {
      this.error = 'Дуэль работает, когда игра открыта с сайта (GitHub Pages) или по ссылке claude.ai, а не из файла.';
      return false;
    }
    for (const src of MQTT_LIBS) {
      if (window.mqtt) break;
      try {
        await loadScript(src);
      } catch (e) {
        /* пробуем следующий источник */
      }
    }
    if (!window.mqtt) {
      this.error = 'Нет интернета: не загрузилась библиотека связи.';
      return false;
    }
    // Начинаем с сервера, который выбрали в прошлый раз; остальные — запасные.
    const n = MQTT_BROKERS.length;
    const start = clamp(Math.floor(Number(Store.get('kd_broker')) || 0), 0, n - 1);
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n;
      const client = await connectMqtt(MQTT_BROKERS[i], 'kd_' + this.myId);
      if (client) {
        this.client = client;
        this.kind = 'mqtt';
        this.brokerIdx = i;
        this.server = brokerName(MQTT_BROKERS[i]);
        return true;
      }
    }
    this.error = 'Не удалось подключиться к серверу дуэлей. Проверь интернет или включи мобильный интернет вместо Wi-Fi.';
    return false;
  },

  // Можно ли переключиться на другой MQTT-сервер.
  canSwitch() {
    return this.kind === 'mqtt' && MQTT_BROKERS.length > 1;
  },

  // Отключиться и в следующий раз начать со следующего сервера из списка.
  nextServer() {
    const next = (this.brokerIdx + 1) % MQTT_BROKERS.length;
    Store.set('kd_broker', String(next));
    if (this.client) this.client.end(true);
    this.client = null;
    this.kind = null;
    this.server = '';
    this.status = 'idle';
    this.initPromise = null;
  },

  async channel(name) {
    if (this.kind === 'room') return roomChannel(this.room, name);
    if (this.kind === 'mqtt') return mqttChannel(this.client, name);
    throw new Error('no network');
  },
};

// ---------- claude.ai: room ----------
async function roomChannel(room, name) {
  const lobby = name === 'lobby';
  const r = lobby ? room : await room.join(name);
  return {
    set(state) {
      r.presence({ kd: state }).catch(() => {});
    },
    peers() {
      return r
        .peers()
        .filter((p) => p.kind === 'viewer' && p.presence && p.presence.kd && typeof p.presence.kd === 'object')
        .map((p) => ({ id: p.peer, me: p.sameTab, state: p.presence.kd }));
    },
    async leave() {
      if (lobby) await r.presence({ kd: null }).catch(() => {});
      else await r.leave().catch(() => {});
    },
  };
}

// ---------- обычный сайт: MQTT ----------
function mqttChannel(client, name) {
  const base = `${NET_PREFIX}/${name}`;
  const mineTopic = `${base}/${Net.myId}`;
  const others = new Map(); // id → { state, seen }
  const decoder = new TextDecoder();
  let mine = null;
  let lastPub = 0;
  let pending = null;

  const onMessage = (topic, payload) => {
    if (!topic.startsWith(base + '/')) return;
    const id = topic.slice(base.length + 1);
    if (!id || id === Net.myId || id.includes('/')) return;
    let state = null;
    try {
      const textPayload = decoder.decode(payload);
      state = textPayload ? JSON.parse(textPayload) : null;
    } catch (e) {
      return;
    }
    if (state && typeof state === 'object') others.set(id, { state, seen: Date.now() });
    else others.delete(id);
  };
  const publish = () => {
    if (mine) client.publish(mineTopic, JSON.stringify(mine));
  };
  client.on('message', onMessage);
  client.subscribe(`${base}/+`);
  // сердцебиение: без него соперник через 7 секунд считается ушедшим
  const heartbeat = setInterval(() => {
    publish();
    const now = Date.now();
    for (const [id, p] of others) if (now - p.seen > 7000) others.delete(id);
  }, 1500);

  return {
    set(state) {
      mine = state;
      const now = Date.now();
      if (now - lastPub > 200) {
        lastPub = now;
        publish();
      } else if (!pending) {
        pending = setTimeout(() => {
          pending = null;
          lastPub = Date.now();
          publish();
        }, 200);
      }
    },
    peers() {
      const out = [...others].map(([id, p]) => ({ id, me: false, state: p.state }));
      if (mine) out.push({ id: Net.myId, me: true, state: mine });
      return out;
    },
    async leave() {
      clearInterval(heartbeat);
      clearTimeout(pending);
      client.publish(mineTopic, '');
      client.unsubscribe(`${base}/+`);
      client.removeListener('message', onMessage);
    },
  };
}
