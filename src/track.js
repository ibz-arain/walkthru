// Tiny first-party telemetry: page views, a few product events, and uncaught errors, sent to /api/log.
// No cookies, no third parties. Events are skipped when the browser asks not to be tracked.
(function () {
  var dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1', sent = 0;
  function post(kind, name, detail) {
    if (sent++ > 60 || location.protocol === 'file:') return;
    var body = JSON.stringify({ kind: kind, name: name, detail: detail || null, path: location.pathname + location.hash.replace(/#c\/[\w-]+/, '#c/…').replace(/#(reset|invite)\/[\w-]+/, '#$1/…') });
    try { if (navigator.sendBeacon) navigator.sendBeacon('/api/log', new Blob([body], { type: 'application/json' })); else fetch('/api/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body, keepalive: true }); } catch (e) { }
  }
  window.wtTrack = function (name, detail) { if (!dnt) post('event', name, detail); };
  window.addEventListener('error', function (e) { post('error', String(e.message || 'Error').slice(0, 200), { src: e.filename, line: e.lineno, col: e.colno }); });
  window.addEventListener('unhandledrejection', function (e) { post('error', String((e.reason && e.reason.message) || e.reason || 'Unhandled rejection').slice(0, 200)); });
  window.wtTrack('page_view', { page: location.pathname, ref: document.referrer ? new URL(document.referrer).hostname : null });
})();
