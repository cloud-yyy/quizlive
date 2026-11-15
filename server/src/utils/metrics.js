const os = require('os');

const startedAt = Date.now();
const counters = { total: 0, byStatus: {}, byMethod: {} };

/** Express middleware counting handled requests (total, by status class and method). */
function requestCounter(req, res, next) {
  res.on('finish', () => {
    counters.total += 1;
    const cls = `${Math.floor(res.statusCode / 100)}xx`;
    counters.byStatus[cls] = (counters.byStatus[cls] || 0) + 1;
    counters.byMethod[req.method] = (counters.byMethod[req.method] || 0) + 1;
  });
  next();
}

function snapshot(extra = {}) {
  const mem = process.memoryUsage();
  const mb = (n) => Math.round((n / 1024 / 1024) * 10) / 10;
  return {
    status: 'ok',
    uptimeSec: Math.round(process.uptime()),
    startedAt: new Date(startedAt).toISOString(),
    memory: { rssMb: mb(mem.rss), heapUsedMb: mb(mem.heapUsed), heapTotalMb: mb(mem.heapTotal) },
    system: { loadAvg1m: Number(os.loadavg()[0].toFixed(2)), cpus: os.cpus().length, freeMemMb: mb(os.freemem()) },
    requests: { total: counters.total, byStatus: counters.byStatus, byMethod: counters.byMethod },
    node: process.version,
    ...extra,
  };
}

module.exports = { requestCounter, snapshot };
