// Test mode: replaces the Google Calendar API with built-in test events, so the calendar can be tried (and debugged) without
// the API key's referrer restrictions and without touching real data. Published next to the component and loaded by
// index.html / test.html only when the URL has ?test. It must be loaded BEFORE oceansailing-calendar.js.
//
//   https://calendar.navigart.net/?test                 the calendar with test data
//   https://calendar.navigart.net/?test&delay=3000      slow responses (shows "Betöltés…")
//   https://calendar.navigart.net/?test&fail            failing responses (shows the error and "Újra")
//   https://calendar.navigart.net/test.html?test        both embedding modes with test data (the flags are passed on to the iframe)
//
// The same knobs exist at run time in the browser console: window.__delay = 3000, window.__fail = true; window.__fetchLog lists
// the requested URLs. The test events are the build-time snapshot in dev/fixtures (real club events + synthetic edge cases).
(function () {
  'use strict';
  var EVENTS = /*EVENTS*/[];
  var query = new URLSearchParams(window.location.search);
  window.__delay = Number(query.get('delay')) || 350;
  window.__fail = query.has('fail');
  window.__fetchLog = [];

  var realFetch = window.fetch;
  window.fetch = function (url) {
    if (String(url).indexOf('googleapis.com/calendar') < 0) { return realFetch.apply(this, arguments); }
    window.__fetchLog.push(String(url));
    var p = new URL(url).searchParams;
    var from = new Date(p.get('timeMin'));
    var to = new Date(p.get('timeMax'));
    var items = EVENTS.filter(function (i) {
      var s = new Date(i.start.dateTime || i.start.date + 'T00:00:00Z');
      var e = new Date(i.end.dateTime || i.end.date + 'T00:00:00Z');
      return e > from && s < to;
    });
    return new Promise(function (resolve) {
      setTimeout(function () {
        if (window.__fail) { resolve({ ok: false, status: 500 }); return; }
        resolve({ ok: true, json: function () { return Promise.resolve({ items: items }); } });
      }, window.__delay);
    });
  };

  // Make it obvious that the data is not real.
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.createElement('div');
    b.textContent = 'TESZT ADATOK';
    b.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:99999;background:#c0392b;color:#fff;font:600 11px/1 sans-serif;padding:4px 8px;border-radius:4px;opacity:.85;pointer-events:none';
    document.body.appendChild(b);
  });
})();
