'use strict';
/* Сеть для дуэли. Два способа связи с одним интерфейсом:
   1) внутри claude.ai — возможность room: живой канал между всеми,
      у кого сейчас открыта эта игра;
   2) на обычном сайте (GitHub Pages и т.п.) — публичный MQTT-сервер через WebSocket.
   Канал — это «присутствие»: каждый держит одно своё состояние, все видят состояния друг друга.
   channel = { set(state), peers() → [{ id, me, state }], leave() } */

const NET_PREFIX = 'khaos-doska/v1';
const MQTT_LIB = 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js';
const MQTT_BROKERS = window.KD_MQTT_BROKERS || ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'];

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
    try {
      if (!window.mqtt) await loadScript(MQTT_LIB);
    } catch (e) {
      this.error = 'Нет интернета: не загрузилась библиотека связи.';
      return false;
    }
    for (const url of MQTT_BROKERS) {
      const client = await connectMqtt(url, 'kd_' + this.myId);
      if (client) {
        this.client = client;
        this.kind = 'mqtt';
        return true;
      }
    }
    this.error = 'Не удалось подключиться к серверу дуэлей. Проверь интернет.';
    return false;
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
