/* eslint-disable no-console */
// First-time Uptime Kuma setup: admin user, monitors for the API and the web app,
// public status page. Runs inside the uptime-kuma container (uses its socket.io-client):
//   docker compose -f docker-compose.prod.yml exec -T -e KUMA_USER -e KUMA_PASS uptime-kuma node - < deploy/uptime-kuma-setup.js
// The Telegram notification is added afterwards in the web UI (it needs the bot token).
const { io } = require('/app/node_modules/socket.io-client');

const APP = process.env.APP_URL || 'https://quizlive.cloudyyy.tech';
const socket = io('http://127.0.0.1:3001', { transports: ['websocket'] });
let monitorList = null;
socket.on('monitorList', (list) => { monitorList = list; });
setTimeout(() => { console.error('timeout'); process.exit(1); }, 60000);
socket.on('connect_error', (e) => console.error('connect_error', e.message));
const call = (event, ...args) => new Promise((resolve, reject) => {
  socket.emit(event, ...args, (res) => (res && res.ok === false ? reject(new Error(`${event}: ${res.msg}`)) : resolve(res)));
});

const monitor = (name, url) => ({
  type: 'http', name, url, method: 'GET', active: true,
  interval: 60, retryInterval: 30, maxretries: 1, timeout: 30,
  accepted_statuscodes: ['200-299'], maxredirects: 10, ignoreTls: false, expiryNotification: true,
  notificationIDList: {}, conditions: [], kafkaProducerBrokers: [], kafkaProducerSaslOptions: {}, rabbitmqNodes: [],
});

socket.once('connect', async () => {
  console.log('connected');
  try {
    if (await new Promise((r) => socket.emit('needSetup', r))) {
      await call('setup', process.env.KUMA_USER, process.env.KUMA_PASS);
      console.log('admin created');
    }
    await call('login', { username: process.env.KUMA_USER, password: process.env.KUMA_PASS, token: '' });
    for (let i = 0; i < 50 && !monitorList; i += 1) await new Promise((r) => setTimeout(r, 100));
    const existing = Object.values(monitorList || {});
    const ids = [];
    for (const [name, url] of [['QuizLive API (/health)', `${APP}/api/health`], ['QuizLive Web (frontend)', `${APP}/`]]) {
      const found = existing.find((m) => m.name === name);
      ids.push(found ? found.id : (await call('add', monitor(name, url))).monitorID);
    }
    console.log('monitors', ids);
    await call('addStatusPage', 'QuizLive', 'quizlive').catch(() => {});
    await call('saveStatusPage', 'quizlive', {
      slug: 'quizlive', title: 'QuizLive — статус сервисов', description: 'Доступность API и веб-приложения QuizLive',
      autoRefreshInterval: 60, theme: 'auto', showTags: false, showPoweredBy: false, showCertificateExpiry: true,
      footerText: '', customCSS: '', analyticsType: null, analyticsId: null, analyticsScriptUrl: null, domainNameList: [],
    }, '/icon.svg', [{ name: 'QuizLive', monitorList: ids.map((id) => ({ id })) }]);
    console.log('status page: /status/quizlive');
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
});
