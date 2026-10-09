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
  var EVENTS = [{"id":"68v489a37s39j4evp62obna2uc","status":"confirmed","summary":"Adriai tanfolyam (1. szint)","description":"Részletek: https://oceansailing.meder.hu/turak/tengeri-vitorlas-tanfolyam/","location":"Horvátország","start":{"dateTime":"2026-10-17T16:00:00+02:00","timeZone":"Europe/Belgrade"},"end":{"dateTime":"2026-10-24T09:00:00+02:00","timeZone":"Europe/Belgrade"}},{"id":"1424qnoqf3p6en5o5tqd38v0n3_20261109","status":"confirmed","summary":"SRC rádiós tanfolyam (013)","description":"\u003ca href=\"https://oceansailing.meder.hu/tanuloi-tajekoztato-src/\">https://oceansailing.meder.hu/tanuloi-tajekoztato-src/\u003c/a>","location":"JEANNEAU Magyarország, Budapest, Szent Korona u. 84, 1161 Magyarország","start":{"date":"2026-11-09"},"end":{"date":"2026-11-10"}},{"id":"3niuf37841um0dluoe75dad8n3","status":"confirmed","summary":"SRC vizsga","description":"SRC házi vizsga (on-line) előtte 1-2 nappal!","location":"Szent Korona u. 85, Budapest, Szent Korona u. 85, 1161 Magyarország","start":{"date":"2026-11-11"},"end":{"date":"2026-11-12"}},{"id":"x1","status":"confirmed","summary":"Adria átkelés (2. szint) / 2 hajós","location":"Pula, Horvátország","description":"\u003ca href=\"https://oceansailing.meder.hu/turak/\">Részletek\u003c/a>","start":{"dateTime":"2027-03-13T17:00:00+01:00"},"end":{"dateTime":"2027-03-20T09:30:00+01:00"}},{"id":"x2","status":"confirmed","summary":"Navigációs előadás","location":"Budapest, Klubhelyiség","description":"Külső link: https://example.com/valami/nagyon/hosszu/utvonal/amit/le/kell/roviditeni?x=1. Várunk mindenkit!","start":{"dateTime":"2026-11-18T18:00:00+01:00"},"end":{"dateTime":"2026-11-18T20:00:00+01:00"}},{"id":"x3","status":"confirmed","summary":"Három hajós egyhetes adriai tanfolyam (B vizsgával) – hosszú címmel a tördelés ellenőrzéséhez (1. szint)","location":"Biograd na Moru, Horvátország","description":"\u003cp>Jelentkezés és részletek: \u003ca href=\"https://oceansailing.meder.hu/turak/tengeri-vitorlas-tanfolyam/\">itt\u003c/a>\u003c/p>\u003cp>Hozz magaddal hajós cipőt.\u003cbr>Kérdés: \u003ca href=\"javascript:alert(1)\">rossz link\u003c/a> és \u003ca href=\"https://example.org/masik\">másik link\u003c/a>\u003c/p>\u003cscript>alert(2)\u003c/script>","start":{"dateTime":"2027-05-08T16:00:00+02:00"},"end":{"dateTime":"2027-05-15T09:00:00+02:00"}},{"id":"x4","status":"confirmed","summary":"SRC rádiós tanfolyam (014)","description":"","start":{"date":"2026-12-07"},"end":{"date":"2026-12-10"}},{"id":"x5","status":"confirmed","summary":"Kikötői nap (1. szint)","description":"Hozz magaddal hálózsákot.\nÉtkezés a helyszínen.\n\nKérdés esetén írj a klubnak.","start":{"date":"2026-12-19"},"end":{"date":"2026-12-20"}},{"id":"x6","status":"confirmed","summary":"Éjszakai navigáció (3. szint)","location":"Balatonfüred","description":"\u003ca href=\"https://oceansailing.meder.hu/turak/\">Részletek\u003c/a>","start":{"dateTime":"2026-11-27T18:00:00+01:00"},"end":{"dateTime":"2026-11-29T16:00:00+01:00"}},{"id":"x7","status":"confirmed","summary":"Hosszú távú vitorlázás (4. szint)","location":"Split, Horvátország","description":"","start":{"dateTime":"2027-06-05T16:00:00+02:00"},"end":{"dateTime":"2027-06-12T09:00:00+02:00"}},{"id":"x8","status":"confirmed","summary":"Óceáni átkelés (5. szint)","location":"Kanári-szigetek","description":"","start":{"date":"2027-08-01"},"end":{"date":"2027-08-21"}},{"id":"x9","status":"confirmed","summary":"Őszi kötélkötés (1. szint)","location":"Budapest, Klubhelyiség","description":"","start":{"dateTime":"2026-09-26T10:00:00+02:00"},"end":{"dateTime":"2026-09-26T14:00:00+02:00"}},{"id":"x10","status":"confirmed","summary":"Nyári tábor (1. szint) – túl régi","description":"","start":{"date":"2026-07-01"},"end":{"date":"2026-07-05"}},{"id":"x11","status":"confirmed","summary":"Jövő évi túra (2. szint) – túl távoli","description":"","start":{"date":"2027-12-01"},"end":{"date":"2027-12-05"}},{"id":"x12","status":"confirmed","summary":"Szilveszteri átkelés (2. szint)","location":"Pula, Horvátország","description":"","start":{"date":"2026-12-28"},"end":{"date":"2027-01-04"}},{"id":"x13","status":"confirmed","summary":"Esti előadás","location":"Budapest, Klubhelyiség","description":"","start":{"dateTime":"2026-11-24T18:00:00+01:00"},"end":{"dateTime":"2026-11-25T00:00:00+01:00"}},{"id":"x14","status":"confirmed","summary":"Csomózó gyakorlat (1. szint)","location":"Balatonfüred","description":"","start":{"dateTime":"2026-11-28T10:00:00+01:00"},"end":{"dateTime":"2026-11-28T12:00:00+01:00"}}];
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
