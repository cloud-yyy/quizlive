const router = require('express').Router();
const { sequelize } = require('../models');
const { snapshot } = require('../utils/metrics');
const { authenticate, roleGuard } = require('../middleware/auth');
const { isEnabled } = require('../utils/monitoring');

/** Liveness + DB readiness. Uptime Kuma and the deploy script check it. */
router.get('/health', async (req, res) => {
  try {
    await sequelize.query('SELECT 1');
    res.json({ status: 'ok', db: 'up', uptimeSec: Math.round(process.uptime()) });
  } catch (e) {
    res.status(503).json({ status: 'error', db: 'down' });
  }
});

/** Basic runtime metrics: uptime, memory, request counters. */
router.get('/metrics', (req, res) => {
  res.json(snapshot({ sentry: isEnabled() }));
});

/** A tiny self-refreshing dashboard page that renders /metrics. */
router.get('/status', (req, res) => {
  res.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'",
  );
  res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>QuizLive status</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:2rem auto;padding:0 1rem;color:#1f2937}
h1{font-size:1.4rem}table{width:100%;border-collapse:collapse}td{padding:.4rem .6rem;border-bottom:1px solid #e5e7eb}
td:first-child{color:#6b7280;width:45%}.ok{color:#059669;font-weight:600}.bad{color:#dc2626;font-weight:600}</style></head>
<body><h1>QuizLive — service status</h1><p id="state">loading…</p><table id="t"></table>
<script>
async function load(){
  const el=document.getElementById('state'),t=document.getElementById('t');
  try{
    const [h,m]=await Promise.all([fetch('health').then(r=>r.json()),fetch('metrics').then(r=>r.json())]);
    el.innerHTML='API: <span class="'+(h.status==='ok'?'ok':'bad')+'">'+h.status+'</span>, database: <span class="'+(h.db==='up'?'ok':'bad')+'">'+h.db+'</span>';
    const rows=[['Uptime (s)',m.uptimeSec],['Memory RSS (MB)',m.memory.rssMb],['Heap used (MB)',m.memory.heapUsedMb],
      ['Load avg (1m)',m.system.loadAvg1m],['Requests handled',m.requests.total],['By status',JSON.stringify(m.requests.byStatus)],
      ['Node',m.node],['Error tracking (GlitchTip)',m.sentry]];
    t.innerHTML=rows.map(r=>'<tr><td>'+r[0]+'</td><td>'+r[1]+'</td></tr>').join('');
  }catch(e){el.innerHTML='<span class="bad">unreachable</span>'}
}
load();setInterval(load,5000);
</script></body></html>`);
});

/** Admin-only helper to verify error tracking (GlitchTip, Sentry SDK) end to end. */
router.get('/debug/error', authenticate, roleGuard('admin'), () => {
  throw new Error('GlitchTip test error (intentional)');
});

module.exports = router;
