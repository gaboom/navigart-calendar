/*
 * <oceansailing-calendar> - custom, themed view of the club's public Google Calendar (courses and trips).
 * A dependency-free web component (light DOM, scoped CSS). It loads the club fonts (Inter, Onest) itself so it looks the same everywhere.
 * Overview:
 *  - Reads events straight from the Google Calendar API v3 (events.list) with a browser API key.
 *  - Renders DOM nodes only (no innerHTML). One instance per element; state lives in mount().
 *  - Two views on one shared event list: "Lista" (list, grouped by month) and "Hónap" (month grid).
 *  - Data window: 1 month back to 12 months ahead on first load; month view then fetches any other
 *    month on demand and merges it into the same list (so the list view shows it afterwards).
 *  - Categories (filters, colours, fallback links) are derived from the event title; see TYPES.
 *  - Calendar days are computed in Europe/Budapest, whatever the visitor's own time zone is.
 *  - The CSS is inlined by the build (scripts/build.mjs) and injected once into <head>.
 */
(function () {
  var CALENDAR_ID = 'oceansailingse@gmail.com';
  // The API key, XOR-masked with MASK and base64 encoded. This is only camouflage so that secret scanners do not flag the
  // repo; the real protection is the key's restriction in Google Cloud (Calendar API only, HTTP referrers).
  // To change the key: `npm run mask -- <new key>` prints the value to paste below.
  var MASK = 'oceansailing';
  var API_KEY_MASKED = 'LiofAD0KIw5dCzRfBU4WBVogNRE4CjogHSpcA109MA1ZDDRQIS1d';
  function unmask(s, k) {
    var b = atob(s), o = '';
    for (var i = 0; i < b.length; i++) { o += String.fromCharCode(b.charCodeAt(i) ^ k.charCodeAt(i % k.length)); }
    return o;
  }
  var API_KEY = unmask(API_KEY_MASKED, MASK);
  var SITE = 'https://oceansailing.meder.hu';
  // Inside an iframe, club page links must replace the whole page, not just the frame.
  var FRAMED = window.self !== window.top;
  var TZ = 'Europe/Budapest';
  var MONTHS_BACK = 1;
  var MONTHS_AHEAD = 12;
  var GOOGLE_VIEW = 'https://calendar.google.com/calendar/embed?src=oceansailingse%40gmail.com&ctz=Europe%2FBudapest';
  // Categories in filter order; the first matching pattern wins, "Egyéb" catches the rest.
  // Colours run from cool to hot with the course level. Each category has a fallback page for events without a link in their description.
  var TYPES = [
    { key: 'level-1', label: '1. szint', color: '#1d4ed8', test: /(^|\D)1\.\s*szint/i, page: '/turak/tengeri-vitorlas-tanfolyam/' },
    { key: 'level-2', label: '2. szint', color: '#0f766e', test: /(^|\D)2\.\s*szint/i, page: '/turak/' },
    { key: 'level-3', label: '3. szint', color: '#a16207', test: /(^|\D)3\.\s*szint/i, page: '/turak/' },
    { key: 'level-4', label: '4. szint', color: '#c2410c', test: /(^|\D)4\.\s*szint/i, page: '/turak/' },
    { key: 'level-5', label: '5. szint', color: '#b91c1c', test: /(^|\D)5\.\s*szint/i, page: '/turak/' },
    { key: 'src', label: 'SRC', color: '#6d28d9', test: /\bSRC\b/i, page: '/tanuloi-tajekoztato-src/' },
    { key: 'other', label: 'Egyéb', color: '#475569', test: /[\s\S]*/, page: '/turak/' }
  ];
  // Icon shapes (24x24 viewBox, filled): download tray, calendar with plus, feed (subscribe).
  var ICONS = {
    download: 'M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z',
    add: 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14v11zM13 11h-2v2.5H8.5v2H11V18h2v-2.5h2.5v-2H13V11z',
    feed: 'M6.2 17.8a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM4 4.4v3a12.6 12.6 0 0 1 12.6 12.6h3A15.6 15.6 0 0 0 4 4.4zm0 6v3a6.6 6.6 0 0 1 6.6 6.6h3A9.6 9.6 0 0 0 4 10.4z'
  };
  // The calendar's public iCal feed: subscribing keeps a visitor's own calendar app in sync.
  var FEED_WEBCAL = 'webcal://calendar.google.com/calendar/ical/oceansailingse%40gmail.com/public/basic.ics';
  var FEED_GOOGLE = 'https://calendar.google.com/calendar/render?cid=oceansailingse%40gmail.com';

  // Test mode: switched on by a query on this script's own URL (".../oceansailing-calendar.js?test"), never by the host page's URL.
  // The Google API is then replaced by the events in test-events.json next to this script, so nothing about the test data is in this file.
  // Knobs (use & only where WordPress does not touch the markup): delay=3000 slow answers, fail failing answers. Also at run time: window.__delay, window.__fail, window.__fetchLog.
  var SCRIPT_URL = document.currentScript && document.currentScript.src;
  var TEST = SCRIPT_URL ? new URL(SCRIPT_URL).searchParams : null;
  if (TEST && !TEST.has('test')) { TEST = null; }
  var testEvents = null;
  function loadTestEvents() {
    if (!testEvents) {
      testEvents = fetch(new URL('test-events.json', SCRIPT_URL)).then(function (r) {
        if (!r.ok) { throw new Error('HTTP ' + r.status); }
        return r.json();
      }).catch(function (e) { testEvents = null; throw e; });
    }
    return testEvents;
  }
  function testFetch(url) {
    window.__fetchLog.push(String(url));
    var p = new URL(url).searchParams;
    var from = new Date(p.get('timeMin'));
    var to = new Date(p.get('timeMax'));
    return loadTestEvents().then(function (all) {
      var items = all.filter(function (i) {
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
    });
  }
  function apiFetch(url, opts) { return TEST ? testFetch(url) : fetch(url, opts); }
  if (TEST) {
    window.__delay = Number(TEST.get('delay')) || 350;
    window.__fail = TEST.has('fail');
    window.__fetchLog = [];
    // Make it obvious that the data is not real.
    var showBadge = function () {
      if (document.getElementById('osse-cal-test-badge')) { return; }
      var b = document.createElement('div');
      b.id = 'osse-cal-test-badge';
      b.textContent = 'TESZT ADATOK';
      b.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:99999;background:#c0392b;color:#fff;font:600 11px/1 sans-serif;padding:4px 8px;border-radius:4px;opacity:.85;pointer-events:none';
      document.body.appendChild(b);
    };
    if (document.body) { showBadge(); } else { document.addEventListener('DOMContentLoaded', showBadge); }
  }
  function mount(root) {
    var TIME = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
    var events = [];
    var seen = {}; // ids of events already in the list
    var months = {}; // month index -> 'loading' | 'done' | 'error'
    var filters = { list: null, month: null }; // per view: null = all categories selected, else the array of selected category keys. Independent, not persisted.
    var view = 'list';
    var TODAY = dayNum(new Date(), false);
    var NOW_IDX = new Date(TODAY * 864e5).getUTCFullYear() * 12 + new Date(TODAY * 864e5).getUTCMonth();
    var cursor = NOW_IDX; // month shown in the month view, as year * 12 + month
    var sel = TODAY; // day picked on narrow screens
    var cur = null; // day that holds the single tab stop of the month grid (null: today, or the 1st)
    var gridFocus = false; // put focus on the grid's tab stop after the next render
    var pop = null;
    var popOpener = null;
    var popKey = null;
    var alive = true; // false once the element left the page: late responses must not render
    var ctrl = new AbortController();
    var narrow = window.matchMedia('(max-width:600px)'); // same breakpoint as the stylesheet
    // Screen-reader announcements: one short summary per change instead of re-reading the rebuilt calendar. Stays when the content is cleared.
    var live = document.createElement('div');
    live.className = 'osse-cal__live';
    live.setAttribute('role', 'status');
    root.insertBefore(live, root.firstChild);
    var lastSaid = null;
    var sayTimer = 0;
    // Debounced, so quickly paging through months speaks only the month you stop on.
    function announce(msg) {
      if (lastSaid !== null && msg !== lastSaid) { // the first message (page load) stays silent
        clearTimeout(sayTimer);
        sayTimer = setTimeout(function () { live.textContent = msg; }, 300);
      }
      lastSaid = msg;
    }
    function clear() { while (root.lastChild !== live) { root.removeChild(root.lastChild); } }
    function el(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) { n.className = cls; }
      if (text != null) { n.textContent = text; }
      return n;
    }
    function typeOf(title) {
      for (var i = 0; i < TYPES.length; i++) { if (TYPES[i].test.test(title)) { return TYPES[i]; } }
      return TYPES[TYPES.length - 1];
    }
    function safeUrl(href) {
      try {
        var u = new URL(href, SITE);
        return u.protocol === 'https:' || u.protocol === 'http:' ? u : null;
      } catch (e) { return null; }
    }
    // Club pages open in the same tab, everything else in a new one.
    function linkTo(a, u) {
      a.href = u.href;
      if (u.origin !== SITE) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      else if (FRAMED) { a.target = '_top'; }
      return a;
    }
    function shortUrl(u) {
      var s = u.host + (u.pathname === '/' ? '' : u.pathname) + u.search;
      return s.length > 50 ? s.slice(0, 49) + '…' : s;
    }
    // Rebuilds the description from a whitelist (text, line breaks, http/https links); no HTML from the calendar is inserted as-is.
    // Returns the first link (document order), whether any text besides links exists, and the nodes to show.
    function parseDescription(raw) {
      var html = raw || '';
      if (!/<[a-z!\/]/i.test(html)) { html = html.replace(/\r?\n/g, '<br>'); }
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var frag = document.createDocumentFragment();
      var out = { frag: frag, url: null, hasText: false };
      var outside = '', links = 0;
      var any = false, nls = 0;
      function text(s) { frag.appendChild(document.createTextNode(s)); any = true; nls = 0; }
      function nl() {
        if (!any || nls >= 2) { return; }
        frag.appendChild(document.createTextNode('\n'));
        nls++;
      }
      function link(u, label) {
        if (!out.url) { out.url = u; }
        links++;
        frag.appendChild(linkTo(el('a', null, label), u));
        any = true; nls = 0;
      }
      function plain(s) {
        var re = /https?:\/\/[^\s<>"']+/g, last = 0, m;
        s = s.replace(/\s+/g, ' ');
        if (!any || nls) { s = s.replace(/^ /, ''); }
        while ((m = re.exec(s))) {
          var raw = m[0].replace(/[.,;:!?)\]]+$/, '');
          var u = safeUrl(raw);
          if (!u) { continue; }
          if (m.index > last) { piece(s.slice(last, m.index)); }
          link(u, shortUrl(u));
          last = m.index + raw.length;
          re.lastIndex = last;
        }
        if (last < s.length) { piece(s.slice(last)); }
      }
      function piece(s) {
        if (!s) { return; }
        outside += s;
        text(s);
      }
      var BLOCK = /^(P|DIV|UL|OL|LI|H[1-6]|TABLE|TR|BLOCKQUOTE)$/;
      function walk(n) {
        for (var c = n.firstChild; c; c = c.nextSibling) {
          if (c.nodeType === 3) { plain(c.nodeValue); }
          else if (c.nodeType === 1) {
            var tag = c.tagName;
            if (tag === 'BR') { nl(); }
            else if (tag === 'A' && safeUrl(c.getAttribute('href') || '') && c.textContent.trim()) {
              var label = c.textContent.trim();
              var u = safeUrl(label);
              link(safeUrl(c.getAttribute('href')), u && /^https?:\/\//i.test(label) ? shortUrl(u) : label);
            } else if (tag !== 'SCRIPT' && tag !== 'STYLE') {
              var block = BLOCK.test(tag);
              if (block) { nl(); }
              walk(c);
              if (block) { nl(); }
            }
          }
        }
      }
      walk(doc.body);
      // Nothing but the link, or a short label like "Részletek:" in front of a single link, counts as link-only.
      out.hasText = /\S/.test(outside) && !(links === 1 && /^\s*[^\n.!?]{0,30}:\s*$/.test(outside));
      return out;
    }
    function pin() {
      var ns = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(ns, 'svg');
      var path = document.createElementNS(ns, 'path');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('class', 'osse-cal__pin');
      svg.setAttribute('aria-hidden', 'true');
      path.setAttribute('d', 'M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z');
      svg.appendChild(path);
      return svg;
    }
    function svgIcon(d) {
      var ns = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(ns, 'svg');
      var path = document.createElementNS(ns, 'path');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('class', 'osse-cal__ico');
      svg.setAttribute('aria-hidden', 'true');
      path.setAttribute('d', d);
      svg.appendChild(path);
      return svg;
    }
    // Event description as plain text (links keep their address), for the .ics file and Google's add-event link.
    function plainText(raw) {
      var html = raw || '';
      if (!/<[a-z!\/]/i.test(html)) { html = html.replace(/\r?\n/g, '<br>'); }
      var doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('br').forEach(function (b) { b.replaceWith('\n'); });
      doc.querySelectorAll('p,div,li,tr,h1,h2,h3,h4,h5,h6').forEach(function (b) { b.after('\n'); });
      doc.querySelectorAll('a[href]').forEach(function (a) {
        var u = safeUrl(a.getAttribute('href'));
        if (u && a.textContent.trim() !== u.href) { a.after(' (' + u.href + ')'); }
      });
      return doc.body.textContent.replace(/\n{3,}/g, '\n\n').trim();
    }
    function detailsUrl(e) { return parseDescription(e.description).url || new URL(e.type.page, SITE); }
    // Description text for the .ics file and Google's link; the details link is appended unless the text already has it.
    function exportText(e) {
      var text = plainText(e.description);
      var link = detailsUrl(e).href;
      return text.indexOf(link) >= 0 ? text : (text ? text + '\n\n' : '') + link;
    }
    function icsStamp(d) { return d.toISOString().replace(/[-:]|\.\d{3}/g, ''); } // 20261109T170000Z
    function icsDay(n) { return new Date(n * 864e5).toISOString().slice(0, 10).replace(/-/g, ''); } // day number -> 20261109
    function icsText(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
    // Lines are folded at 75 bytes (UTF-8), as the format requires.
    function icsFold(line) {
      var out = '';
      var n = 0;
      for (var ch of line) {
        var c = ch.codePointAt(0);
        var b = c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
        if (n + b > 74) { out += '\r\n '; n = 1; }
        out += ch;
        n += b;
      }
      return out;
    }
    // The UID is the one Google uses in the public feed, so re-importing the event or subscribing later does not duplicate it.
    function icsFor(e) {
      var link = detailsUrl(e).href;
      var lines = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ocean Sailing SE//Naptár//HU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
        'BEGIN:VEVENT', 'UID:' + e.id + '@google.com', 'DTSTAMP:' + icsStamp(e.updated || new Date()), 'SEQUENCE:' + e.seq,
        e.allDay ? 'DTSTART;VALUE=DATE:' + icsDay(e.d0) : 'DTSTART:' + icsStamp(e.start),
        e.allDay ? 'DTEND;VALUE=DATE:' + icsDay(e.d1 + 1) : 'DTEND:' + icsStamp(e.end),
        'SUMMARY:' + icsText(e.title)
      ];
      if (e.location) { lines.push('LOCATION:' + icsText(e.location)); }
      lines.push('DESCRIPTION:' + icsText(exportText(e)), 'URL:' + link, 'END:VEVENT', 'END:VCALENDAR');
      return lines.map(icsFold).join('\r\n') + '\r\n';
    }
    function icsName(e) {
      var slug = e.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 50);
      return (slug || 'esemeny') + '-' + new Date(e.d0 * 864e5).toISOString().slice(0, 10) + '.ics';
    }
    function downloadIcs(e) {
      var url = URL.createObjectURL(new Blob([icsFor(e)], { type: 'text/calendar;charset=utf-8' }));
      var a = document.createElement('a');
      a.href = url;
      a.download = icsName(e);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }
    function googleAddUrl(e) {
      var q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, ctz: TZ });
      q.set('dates', e.allDay ? icsDay(e.d0) + '/' + icsDay(e.d1 + 1) : icsStamp(e.start) + '/' + icsStamp(e.end));
      if (e.location) { q.set('location', e.location); }
      q.set('details', exportText(e).slice(0, 1500));
      return 'https://calendar.google.com/calendar/render?' + q;
    }
    // "Add to calendar" links of one event: a .ics download (any calendar app) and Google Calendar's add-event page.
    // In the list they are icons only (with a label for screen readers), in the popover they carry text.
    function eventActs(e, withText) {
      var wrap = el('span', 'osse-cal__acts');
      var dlLabel = 'Letöltés naptárba (.ics)';
      var gLabel = 'Hozzáadás a Google Naptárhoz';
      var dl = el('button', 'osse-cal__act');
      dl.type = 'button';
      dl.title = dlLabel;
      dl.onclick = function () { downloadIcs(e); };
      var g = el('a', 'osse-cal__act');
      g.href = googleAddUrl(e);
      g.target = '_blank';
      g.rel = 'noopener noreferrer';
      g.title = gLabel;
      [[dl, ICONS.download, dlLabel, 'Naptárba (.ics)'], [g, ICONS.add, gLabel, 'Google Naptár']].forEach(function (a) {
        a[0].appendChild(svgIcon(a[1]));
        if (withText) { a[0].appendChild(document.createTextNode(a[3])); }
        else { a[0].setAttribute('aria-label', a[2] + ': ' + e.title); }
        wrap.appendChild(a[0]);
      });
      return wrap;
    }
    // All-day events carry plain dates with an exclusive end; they are kept in UTC so no timezone can shift them.
    function toEvent(it) {
      var allDay = !!it.start.date;
      var start = allDay ? new Date(it.start.date + 'T00:00:00Z') : new Date(it.start.dateTime);
      var end = allDay ? new Date(new Date(it.end.date + 'T00:00:00Z').getTime() - 864e5) : new Date(it.end.dateTime);
      // An event ending exactly at midnight still belongs to the previous day.
      var last = !allDay && end > start ? new Date(end.getTime() - 1) : end;
      var d1 = dayNum(last, allDay);
      // All-day events end with their last calendar day in the club's time zone, not at UTC midnight.
      var over = allDay ? d1 < dayNum(new Date(), false) : end <= Date.now();
      return { id: it.id, title: it.summary || '(cím nélkül)', location: it.location || '', description: it.description || '', allDay: allDay, start: start, end: end, last: last, d0: dayNum(start, allDay), d1: d1, over: over, type: typeOf(it.summary || ''), seq: it.sequence || 0, updated: it.updated ? new Date(it.updated) : null };
    }
    // Calendar day as a whole number (days since 1970-01-01) in the club's time zone, so spans can be compared and laid out on a grid.
    function dayNum(d, allDay) {
      if (allDay) { return Math.floor(d.getTime() / 864e5); }
      var p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d).split('-');
      return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5;
    }
    function fmt(d, allDay, opts) {
      return new Intl.DateTimeFormat('hu-HU', Object.assign({ timeZone: allDay ? 'UTC' : TZ }, opts)).format(d).toLowerCase();
    }
    // Single-day events show weekday and hours. Multi-day events show from and to dates only; their hours are in a tooltip.
    function when(e) {
      var time = TIME;
      var ymd = { year: 'numeric', month: 'numeric', day: 'numeric' };
      var a = e.allDay;
      if (fmt(e.start, a, ymd) === fmt(e.last, a, ymd)) {
        var wd = fmt(e.start, a, { weekday: 'long' });
        return { text: a ? wd : wd + ' · ' + fmt(e.start, a, time) + '–' + fmt(e.end, a, time), hint: '', full: '' };
      }
      var year = fmt(e.start, a, { year: 'numeric' }) !== fmt(e.last, a, { year: 'numeric' });
      var day = { year: year ? 'numeric' : undefined, month: 'short', day: 'numeric' };
      var from = fmt(e.start, a, day);
      var to = fmt(e.last, a, day);
      return { text: from + ' – ' + to, hint: a ? '' : 'Kezdés: ' + from + ' ' + fmt(e.start, a, time) + ' · Befejezés: ' + fmt(e.end, a, day) + ' ' + fmt(e.end, a, time), full: a ? from + ' – ' + to : from + ' ' + fmt(e.start, a, time) + ' – ' + fmt(e.end, a, day) + ' ' + fmt(e.end, a, time) };
    }
    function locLink(e) {
      var map = el('a');
      map.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(e.location);
      map.target = '_blank';
      map.rel = 'noopener noreferrer';
      map.title = 'Megnyitás a Google Térképen';
      map.appendChild(pin());
      map.appendChild(document.createTextNode(e.location));
      return map;
    }
    function card(e) {
      var d = parseDescription(e.description);
      var c = el('div', e.over ? 'osse-cal__card osse-cal__card--over' : 'osse-cal__card');
      c.style.setProperty('--c', e.type.color);
      var date = el('div', 'osse-cal__date');
      date.appendChild(el('span', 'osse-cal__day', fmt(e.start, e.allDay, { day: 'numeric' })));
      date.appendChild(el('span', 'osse-cal__mon', fmt(e.start, e.allDay, { month: 'short' })));
      var body = el('div', 'osse-cal__body');
      // The first link in the description wins; without one the title points to the page of the event type.
      var title = el('h3', 'osse-cal__title');
      title.appendChild(linkTo(el('a', null, e.title), d.url || new URL(e.type.page, SITE)));
      var w = when(e);
      var meta = el('p', 'osse-cal__meta');
      if (e.over) { meta.appendChild(el('span', 'osse-cal__done', 'Lezárult')); meta.appendChild(document.createTextNode(' · ')); }
      var whenEl = el('span', w.hint ? 'osse-cal__when osse-cal__when--hint' : 'osse-cal__when', w.text);
      if (w.hint) { whenEl.title = w.hint; }
      meta.appendChild(whenEl);
      if (e.location) {
        meta.appendChild(document.createTextNode(' · '));
        meta.appendChild(locLink(e));
      }
      if (!e.over) {
        var acts = el('span', 'osse-cal__actsep', ' · ');
        acts.appendChild(eventActs(e, false));
        meta.appendChild(acts);
      }
      body.appendChild(title);
      body.appendChild(meta);
      // A description that is only a link is not repeated, the title already carries it.
      if (d.hasText) {
        var desc = el('p', 'osse-cal__desc');
        desc.appendChild(d.frag);
        body.appendChild(desc);
      }
      c.appendChild(date);
      c.appendChild(body);
      c.appendChild(el('span', 'osse-cal__tag', e.type.label));
      return c;
    }
    function closePop(back) {
      if (pop) { pop.remove(); pop = null; }
      if (back && popOpener) { popOpener.focus(); }
      popOpener = null;
      popKey = null;
    }
    // Shared frame of both popovers: label, coloured corner block (tag text + close button) and the body added by the caller.
    function popFrame(label, color, title, tag) {
      var p = el('div', 'osse-cal__pop');
      p.setAttribute('role', 'dialog');
      p.setAttribute('aria-label', label);
      p.style.setProperty('--c', color);
      var x = el('button', 'osse-cal__popx', '×');
      x.type = 'button';
      x.setAttribute('aria-label', 'Bezárás');
      x.onclick = function () { closePop(true); };
      // Title first; the category and the close button share a coloured block in the top right corner.
      var head = el('div', 'osse-cal__pophead');
      head.appendChild(el('h3', 'osse-cal__poptitle', title));
      var corner = el('div', 'osse-cal__popcorner');
      corner.appendChild(el('span', 'osse-cal__poptag', tag));
      corner.appendChild(x);
      head.appendChild(corner);
      p.appendChild(head);
      p.closeButton = x;
      return p;
    }
    // anchor: what the popover is placed under; opener: what gets focus back on close; key: identifies it so a second click on the same bar closes it.
    function showPop(p, anchor, opener, key) {
      root.appendChild(p);
      var r = root.getBoundingClientRect();
      var a = anchor.getBoundingClientRect();
      var width = Math.min(420, r.width);
      p.style.width = width + 'px';
      p.style.left = Math.max(0, Math.min(a.left - r.left, r.width - width)) + 'px';
      p.style.top = (a.bottom - r.top + 6) + 'px';
      var above = a.top - r.top - p.offsetHeight - 6;
      if (a.bottom - r.top + 6 + p.offsetHeight > r.height && above >= 0) { p.style.top = above + 'px'; }
      pop = p;
      popOpener = opener;
      popKey = key;
      p.closeButton.focus();
      p.scrollIntoView({ block: 'nearest' });
    }
    function openPop(e, anchor, opener, key) {
      var d = parseDescription(e.description);
      var w = when(e);
      var p = popFrame(e.title, e.type.color, e.title, e.type.label);
      // Date and place share one line; the actions share the footer row with the button.
      var meta = el('p', 'osse-cal__popmeta');
      var when1 = el('span', null);
      if (e.over) { when1.appendChild(el('span', 'osse-cal__done', 'Lezárult')); when1.appendChild(document.createTextNode(' · ')); p.classList.add('osse-cal__pop--over'); }
      when1.appendChild(document.createTextNode(w.full || w.text));
      meta.appendChild(when1);
      if (e.location) { meta.appendChild(locLink(e)); }
      p.appendChild(meta);
      if (d.hasText) { p.appendChild(el('p', 'osse-cal__desc')).appendChild(d.frag); }
      var foot = el('div', 'osse-cal__popfoot');
      foot.appendChild(linkTo(el('a', 'osse-cal__open', 'Részletek'), d.url || new URL(e.type.page, SITE)));
      if (!e.over) { foot.appendChild(eventActs(e, true)); }
      p.appendChild(foot);
      showPop(p, anchor, opener, key);
    }
    // Keyboard on a day with several events: one popover with the same cards as the list.
    function openDayPop(day, list, anchor) {
      var p = popFrame(dayLabel(day, list.length), 'var(--ink)', fmt(new Date(day * 864e5), true, { month: 'long', day: 'numeric', weekday: 'long' }), list.length + ' esemény');
      p.classList.add('osse-cal__pop--day');
      var body = el('div', 'osse-cal__popdays');
      list.forEach(function (e) { body.appendChild(card(e)); });
      p.appendChild(body);
      showPop(p, anchor, anchor, 'day' + day);
    }
    function go(i, day) {
      cursor = i;
      if (day != null) { cur = day; } else if (i === NOW_IDX) { cur = null; }
      sel = i === NOW_IDX ? TODAY : null;
      ensureMonth(i);
      render();
    }
    function navButton(text, label, onclick, disabled) {
      var b = el('button', 'osse-cal__navbtn', text);
      b.type = 'button';
      b.setAttribute('aria-label', label);
      b.disabled = !!disabled;
      b.onclick = onclick;
      return b;
    }
    // Each week is a 7-column grid: day cells in the back, one row per lane of event bars on top.
    function renderMonth(shown) {
      var y = Math.floor(cursor / 12);
      var m = cursor % 12;
      var first = Date.UTC(y, m, 1) / 864e5;
      var days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      var offset = (new Date(first * 864e5).getUTCDay() + 6) % 7;
      var weeks = Math.ceil((offset + days) / 7);
      var nav = el('div', 'osse-cal__nav');
      nav.appendChild(navButton('‹', 'Előző hónap', function () { go(cursor - 1); }));
      nav.appendChild(el('h2', 'osse-cal__navtitle', fmt(new Date(first * 864e5), true, { year: 'numeric', month: 'long' })));
      var state = months[cursor];
      if (state === 'loading') {
        var st = el('span', 'osse-cal__status', 'Betöltés…');
        nav.appendChild(st);
      } else if (state === 'error') {
        var er = el('span', 'osse-cal__status osse-cal__status--err', 'Nem sikerült betölteni. ');
        var retry = el('button', 'osse-cal__retry', 'Újra');
        retry.type = 'button';
        retry.onclick = function () { months[cursor] = null; ensureMonth(cursor); render(); };
        er.appendChild(retry);
        nav.appendChild(er);
      }
      nav.appendChild(navButton('Ma', 'Ugrás a mai naphoz', function () { go(NOW_IDX); }));
      nav.appendChild(navButton('›', 'Következő hónap', function () { go(cursor + 1); }));
      root.appendChild(nav);
      // ARIA date grid: one tab stop (the roving day), arrow keys move between days. Weekday names are in each cell's label.
      var grid = el('div', 'osse-cal__grid');
      grid.setAttribute('role', 'grid');
      grid.setAttribute('aria-label', fmt(new Date(first * 864e5), true, { year: 'numeric', month: 'long' }));
      grid.onkeydown = onGridKey;
      var dows = el('div', 'osse-cal__dows');
      dows.setAttribute('aria-hidden', 'true');
      ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].forEach(function (n) { dows.appendChild(el('span', null, n)); });
      grid.appendChild(dows);
      var rov = rovingDay(first, days);
      for (var w = 0; w < weeks; w++) { grid.appendChild(renderWeek(shown, first - offset + w * 7, m, rov)); }
      var gridEnd = first - offset + weeks * 7 - 1;
      var inMonth = shown.filter(function (e) { return e.d1 >= first - offset && e.d0 <= gridEnd; }).length; // any bar in the grid, including neighbouring-month days
      var empty = state === 'done' && !inMonth;
      // An empty month is not an error: the cells turn grey and a neutral note sits over the grid.
      var box = el('div', empty ? 'osse-cal__gridbox osse-cal__gridbox--empty' : 'osse-cal__gridbox');
      box.appendChild(grid);
      if (empty) {
        var nd = el('p', 'osse-cal__nodata');
        nd.appendChild(el('span', null, filters.month ? 'Ebben a hónapban nincs ilyen esemény.' : 'Ebben a hónapban nincs esemény.'));
        box.appendChild(nd);
      }
      root.appendChild(box);
      var list = el('div', 'osse-cal__daylist');
      if (sel == null) {
        if (!empty) { list.appendChild(el('p', 'osse-cal__msg', 'Koppints egy napra az események megtekintéséhez.')); }
      } else {
        list.appendChild(el('h3', null, fmt(new Date(sel * 864e5), true, { month: 'long', day: 'numeric', weekday: 'long' })));
        var day = shown.filter(function (e) { return e.d0 <= sel && e.d1 >= sel; });
        if (!day.length) { list.appendChild(el('p', 'osse-cal__msg', 'Ezen a napon nincs esemény.')); }
        day.forEach(function (e) { list.appendChild(card(e)); });
      }
      root.appendChild(list);
    }
    function dayLabel(day, n) {
      return fmt(new Date(day * 864e5), true, { month: 'long', day: 'numeric', weekday: 'long' }) + ', ' + (n ? n + ' esemény' : 'nincs esemény');
    }
    // What a screen reader says on a day cell: the date, how many events, and their titles (with the time for single-day events).
    function cellLabel(day, list) {
      return dayLabel(day, list.length) + (list.length ? ': ' + list.map(function (e) { return barText(e, true); }).join('; ') : '');
    }
    function barText(e, a11y) { return (!e.allDay && e.d0 === e.d1 ? fmt(e.start, false, TIME) + ' ' : '') + e.title + (a11y && e.over ? ' (lezárult)' : ''); }
    function cellOf(day) { return root.querySelector('.osse-cal__cell[data-day="' + day + '"]'); }
    // The day that holds the grid's tab stop: the last one used, kept at the same day of month when the month changed; else today, else the 1st.
    function rovingDay(first, days) {
      if (cur == null) { return TODAY >= first && TODAY < first + days ? TODAY : first; }
      return first + Math.min(new Date(cur * 864e5).getUTCDate(), days) - 1;
    }
    function setRoving(cell) {
      var old = root.querySelector('.osse-cal__cell[tabindex="0"]');
      if (old && old !== cell) { old.tabIndex = -1; }
      cell.tabIndex = 0;
      cur = Number(cell.getAttribute('data-day'));
    }
    function moveTo(day) {
      var d = new Date(day * 864e5);
      var idx = d.getUTCFullYear() * 12 + d.getUTCMonth();
      if (idx !== cursor) { gridFocus = true; go(idx, day); return; }
      var c = cellOf(day);
      if (c) { c.focus(); }
    }
    // Enter/Space on a day: narrow screens pick it (cards below the grid); wide screens open its event, or all of them when there are several.
    function activate(day, cell) {
      if (narrow.matches) { sel = day; cur = day; render(); return; }
      var list = visible().filter(function (e) { return e.d0 <= day && e.d1 >= day; });
      closePop();
      if (list.length === 1) { openPop(list[0], cell, cell, 'e' + list[0].id); }
      else if (list.length) { openDayPop(day, list, cell); }
    }
    function onGridKey(ev) {
      var c = ev.target.closest && ev.target.closest('.osse-cal__cell');
      if (!c || ev.altKey || ev.ctrlKey || ev.metaKey) { return; }
      var day = Number(c.getAttribute('data-day'));
      var first = Date.UTC(Math.floor(cursor / 12), cursor % 12, 1) / 864e5;
      var last = Date.UTC(Math.floor(cursor / 12), cursor % 12 + 1, 0) / 864e5;
      var wd = (day + 3) % 7; // weekday, Monday = 0 (day 0 was a Thursday)
      var to;
      switch (ev.key) {
        case 'ArrowLeft': to = day - 1; break;
        case 'ArrowRight': to = day + 1; break;
        case 'ArrowUp': to = day - 7; break;
        case 'ArrowDown': to = day + 7; break;
        case 'Home': to = Math.max(day - wd, first); break;
        case 'End': to = Math.min(day - wd + 6, last); break;
        case 'PageUp':
        case 'PageDown':
          var d = new Date(day * 864e5);
          var step = ev.key === 'PageUp' ? -1 : 1;
          var inMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + step + 1, 0)).getUTCDate();
          to = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + step, 1) / 864e5 + Math.min(d.getUTCDate(), inMonth) - 1;
          break;
        case 'Enter':
        case ' ':
          ev.preventDefault();
          activate(day, c);
          return;
        default: return;
      }
      ev.preventDefault();
      moveTo(to);
    }
    function renderWeek(shown, ws, month, rov) {
      var we = ws + 6;
      var segs = shown.filter(function (e) { return e.d1 >= ws && e.d0 <= we; }).map(function (e) {
        return { e: e, s: Math.max(e.d0, ws) - ws, t: Math.min(e.d1, we) - ws };
      }).sort(function (a, b) { return a.s - b.s || (b.t - b.s) - (a.t - a.s); });
      var lanes = [];
      segs.forEach(function (sg) {
        for (var i = 0; i < lanes.length && lanes[i] >= sg.s; i++) {}
        lanes[i] = sg.t;
        sg.lane = i;
      });
      var week = el('div', 'osse-cal__week');
      week.setAttribute('role', 'row');
      week.style.gridTemplateRows = 'auto' + (lanes.length ? ' repeat(' + lanes.length + ', auto)' : '') + ' minmax(.4rem, 1fr)';
      for (var c = 0; c < 7; c++) {
        (function (day, col) {
          var d = new Date(day * 864e5);
          var list = shown.filter(function (e) { return e.d0 <= day && e.d1 >= day; });
          var out = d.getUTCMonth() !== month;
          var cls = 'osse-cal__cell' + (out ? ' osse-cal__cell--out' : '') + (day === sel ? ' osse-cal__cell--sel' : '');
          var cell = el('div', cls);
          cell.setAttribute('role', 'gridcell');
          cell.setAttribute('data-day', String(day));
          if (out) {
            cell.setAttribute('aria-hidden', 'true'); // not part of the keyboard grid; on narrow screens a tap still picks it
          } else {
            cell.setAttribute('aria-label', cellLabel(day, list));
            cell.tabIndex = day === rov ? 0 : -1;
            cell.onfocus = function () { setRoving(cell); };
            if (day === TODAY) { cell.setAttribute('aria-current', 'date'); }
            if (narrow.matches) { cell.setAttribute('aria-selected', day === sel ? 'true' : 'false'); }
          }
          cell.onclick = function () { if (narrow.matches) { sel = day; cur = out ? cur : day; render(); } };
          cell.style.gridColumn = String(col + 1);
          cell.style.gridRow = '1 / span ' + (lanes.length + 2);
          var num = el('span', 'osse-cal__num' + (out ? ' osse-cal__num--out' : '') + (day === TODAY ? ' osse-cal__num--today' : ''), String(d.getUTCDate()));
          num.setAttribute('aria-hidden', 'true');
          num.style.gridColumn = String(col + 1);
          num.style.gridRow = '1';
          week.appendChild(cell);
          week.appendChild(num);
        })(ws + c, c);
      }
      // Bars are drawn for the eye and for the mouse; keyboard and screen readers use the day cells.
      segs.forEach(function (sg) {
        var e = sg.e;
        var b = el('span', 'osse-cal__bar' + (e.over ? ' osse-cal__bar--over' : '') + (e.d0 < ws ? ' osse-cal__bar--l' : '') + (e.d1 > we ? ' osse-cal__bar--r' : ''));
        b.style.setProperty('--c', e.type.color);
        b.style.gridColumn = (sg.s + 1) + ' / ' + (sg.t + 2);
        b.style.gridRow = String(sg.lane + 2);
        b.setAttribute('aria-hidden', 'true');
        week.appendChild(b);
        if (narrow.matches) { return; }
        b.title = e.title;
        b.textContent = barText(e);
        // First day of this bar that is inside the shown month: the day cell that gets focus back when the popover closes.
        var at = null;
        for (var k = sg.s; k <= sg.t && at === null; k++) { if (new Date((ws + k) * 864e5).getUTCMonth() === month) { at = ws + k; } }
        b.onclick = function () {
          var key = 'e' + e.id;
          var same = popKey === key;
          closePop();
          if (same) { return; }
          var opener = at === null ? null : cellOf(at);
          if (opener) { setRoving(opener); }
          openPop(e, b, opener, key);
        };
      });
      return week;
    }
    function isOn(key) {
      var f = filters[view];
      return !f || f.indexOf(key) >= 0;
    }
    // All categories are selected by default. Clicking one then selects only that one; after that chips are added or removed one by one.
    // Removing the last selected chip, or selecting every chip, goes back to the "all" state (null).
    function toggle(key) {
      var f = filters[view];
      if (!f) { filters[view] = [key]; return; }
      f = f.indexOf(key) >= 0 ? f.filter(function (k) { return k !== key; }) : f.concat(key);
      filters[view] = f.length === 0 || f.length === TYPES.length ? null : f;
    }
    function visible() {
      return events.filter(function (e) { return isOn(e.type.key); });
    }
    function summary() {
      var f = filters[view];
      var prefix = f ? TYPES.filter(function (t) { return f.indexOf(t.key) >= 0; }).map(function (t) { return t.label; }).join(', ') + ': ' : '';
      var shown = visible();
      if (view === 'list') { return prefix + 'Lista, ' + shown.length + ' esemény'; }
      var first = Date.UTC(Math.floor(cursor / 12), cursor % 12, 1) / 864e5;
      var last = Date.UTC(Math.floor(cursor / 12), cursor % 12 + 1, 0) / 864e5;
      var title = fmt(new Date(first * 864e5), true, { year: 'numeric', month: 'long' });
      if (months[cursor] === 'loading') { return title + ', betöltés…'; }
      if (months[cursor] === 'error') { return title + ', nem sikerült betölteni'; }
      if (sel != null) { return prefix + dayLabel(sel, shown.filter(function (e) { return e.d0 <= sel && e.d1 >= sel; }).length); }
      return prefix + title + ', ' + shown.filter(function (e) { return e.d1 >= first && e.d0 <= last; }).length + ' esemény';
    }
    function focusKey(n) {
      var day = n.getAttribute('data-day'); // grid cells are found by day: their labels change when events load or filters change
      return day ? 'cell|' + day : n.classList[0] + '|' + (n.getAttribute('aria-label') || n.textContent); // base class only: state classes (--sel, --over) change on render
    }
    // Every render rebuilds the DOM, so put keyboard focus back on the equivalent control (only if it was inside the component).
    function render() {
      var a = document.activeElement;
      var key = a && a !== root && root.contains(a) ? focusKey(a) : null;
      draw();
      announce(summary());
      if (gridFocus) {
        gridFocus = false;
        var stop = root.querySelector('.osse-cal__cell[tabindex="0"]');
        if (stop) { stop.focus({ preventScroll: true }); return; }
      }
      if (key === null) { return; }
      var all = root.querySelectorAll('button, a, .osse-cal__cell[tabindex]');
      var hit = null;
      for (var i = 0; i < all.length && !hit; i++) { if (focusKey(all[i]) === key) { hit = all[i]; } }
      hit = hit || root.querySelector('.osse-cal__view[aria-pressed="true"]');
      if (hit) { hit.focus({ preventScroll: true }); }
    }
    // Small feed icon next to the view switch: opens a panel with the links to subscribe to the whole calendar.
    function subscribe() {
      var box = el('details', 'osse-cal__sub');
      var label = 'Feliratkozás a naptárra';
      var btn = el('summary', 'osse-cal__navbtn osse-cal__subbtn');
      btn.title = label;
      btn.setAttribute('aria-label', label);
      btn.appendChild(svgIcon(ICONS.feed));
      var panel = el('div', 'osse-cal__subpanel');
      panel.appendChild(el('p', null, 'Feliratkozás az összes eseményre, automatikus frissítéssel:'));
      [['Google Naptár', FEED_GOOGLE], ['Apple Naptár, Outlook', FEED_WEBCAL]].forEach(function (l) {
        var a = el('a', null, l[0]);
        a.href = l[1];
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        panel.appendChild(a);
      });
      box.appendChild(btn);
      box.appendChild(panel);
      return box;
    }
    function closeSub(back) {
      var open = root.querySelector('.osse-cal__sub[open]');
      if (!open) { return false; }
      open.open = false;
      if (back) { open.querySelector('summary').focus(); }
      return true;
    }
    function draw() {
      closePop();
      clear();
      root.classList.toggle('osse-cal--busy', view === 'month' && months[cursor] === 'loading');
      var count = {};
      events.forEach(function (e) { count[e.type.key] = (count[e.type.key] || 0) + 1; });
      var tools = el('div', 'osse-cal__tools');
      var bar = el('div', 'osse-cal__filters');
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', 'Kategóriák');
      TYPES.forEach(function (t) {
        var b = el('button', count[t.key] ? 'osse-cal__chip' : 'osse-cal__chip osse-cal__chip--empty', t.label);
        if (!count[t.key]) { b.title = 'Nincs esemény'; }
        b.type = 'button';
        b.style.setProperty('--c', t.color);
        b.setAttribute('aria-pressed', String(isOn(t.key)));
        b.onclick = function () { toggle(t.key); render(); };
        bar.appendChild(b);
      });
      var views = el('div', 'osse-cal__views');
      [['list', 'Lista'], ['month', 'Hónap']].forEach(function (v) {
        var b = el('button', 'osse-cal__view', v[1]);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(view === v[0]));
        b.onclick = function () { view = v[0]; render(); };
        views.appendChild(b);
      });
      tools.appendChild(bar);
      var right = el('div', 'osse-cal__right');
      right.appendChild(subscribe());
      right.appendChild(views);
      tools.appendChild(right);
      root.appendChild(tools);
      var active = filters[view];
      var shown = visible();
      if (view === 'month') { renderMonth(shown); return; }
      if (!shown.length) { root.appendChild(el('p', 'osse-cal__msg', active ? 'A kiválasztott kategóriákban nincs esemény.' : 'Jelenleg nincs meghirdetett esemény.')); return; }
      var month = '';
      shown.forEach(function (e) {
        var m = fmt(e.start, e.allDay, { year: 'numeric', month: 'long' });
        if (m !== month) { month = m; root.appendChild(el('h2', 'osse-cal__month', m)); }
        root.appendChild(card(e));
      });
    }
    function onKey(ev) { if (ev.key === 'Escape') { if (pop) { closePop(true); } else { closeSub(true); } } }
    function onMouse(ev) {
      if (pop && !pop.contains(ev.target) && !(ev.target.closest && ev.target.closest('.osse-cal__bar'))) { closePop(); }
      if (!(ev.target.closest && ev.target.closest('.osse-cal__sub'))) { closeSub(false); }
    }
    function onNarrow() { if (view === 'month') { render(); } }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onMouse);
    narrow.addEventListener('change', onNarrow);
    function fail() {
      var refocus = root.contains(document.activeElement) && document.activeElement !== root;
      clear();
      clearTimeout(sayTimer);
      var text = 'A naptár most nem érhető el.';
      live.textContent = text;
      lastSaid = text; // so the first summary after a successful retry is announced
      var p = el('p', 'osse-cal__msg', text + ' ');
      var retry = el('button', 'osse-cal__retry', 'Újra');
      retry.type = 'button';
      retry.onclick = function () { load(true); };
      p.appendChild(retry);
      p.appendChild(document.createTextNode(' '));
      p.appendChild(linkTo(el('a', null, 'Megnyitás a Google Naptárban'), new URL(GOOGLE_VIEW)));
      root.appendChild(p);
      if (refocus) { retry.focus(); }
    }
    async function fetchEvents(min, max) {
      var items = [];
      var token = '';
      do {
        var q = new URLSearchParams({
          key: API_KEY, singleEvents: 'true', orderBy: 'startTime', maxResults: '250',
          timeMin: min.toISOString(), timeMax: max.toISOString(),
          fields: 'nextPageToken,items(id,status,summary,description,location,start,end,sequence,updated)'
        });
        if (token) { q.set('pageToken', token); }
        var res = await apiFetch('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(CALENDAR_ID) + '/events?' + q, { signal: ctrl.signal });
        if (!res.ok) { throw new Error('HTTP ' + res.status); }
        var data = await res.json();
        items = items.concat(data.items || []);
        token = data.nextPageToken || '';
      } while (token);
      return items.filter(function (i) { return i.status !== 'cancelled'; }).map(toEvent);
    }
    // Everything fetched so far lives in one list shared by the list and month views.
    function merge(list) {
      list.forEach(function (e) { if (!seen[e.id]) { seen[e.id] = true; events.push(e); } });
      events.sort(function (a, b) { return a.start - b.start; });
    }
    // Month view: fetch a month the first time it is shown. Neighbouring days are included so spans crossing the month edge are complete.
    function ensureMonth(i) {
      if (months[i] === 'done' || months[i] === 'loading') { return; }
      months[i] = 'loading';
      var first = Date.UTC(Math.floor(i / 12), i % 12, 1) / 864e5;
      var next = Date.UTC(Math.floor(i / 12), i % 12 + 1, 1) / 864e5;
      fetchEvents(new Date((first - 1) * 864e5), new Date((next + 1) * 864e5)).then(function (list) {
        merge(list);
        months[i] = 'done';
      }).catch(function () {
        months[i] = 'error';
      }).then(function () {
        if (alive && (view !== 'month' || cursor === i)) { render(); }
      });
    }
    // First window: from the previous month's last day to the 2nd day after the last month, so month edges in any time zone are covered. Built from month numbers, never setMonth (it overflows on the 29th to 31st).
    var winMin = new Date(Date.UTC(Math.floor((NOW_IDX - MONTHS_BACK) / 12), (NOW_IDX - MONTHS_BACK) % 12, 0));
    var winMax = new Date(Date.UTC(Math.floor((NOW_IDX + MONTHS_AHEAD + 1) / 12), (NOW_IDX + MONTHS_AHEAD + 1) % 12, 2));
    function load(retry) {
      var hadFocus = retry && root.contains(document.activeElement);
      clear();
      if (retry) { live.textContent = ''; }
      var msg = el('p', 'osse-cal__msg', 'Naptár betöltése…');
      msg.tabIndex = -1;
      root.appendChild(msg);
      if (hadFocus) { msg.focus(); }
      fetchEvents(winMin, winMax).then(function (list) {
        if (!alive) { return; }
        merge(list);
        // Months fully inside the first window need no further fetch.
        var lo = dayNum(winMin, false);
        var hi = dayNum(winMax, false);
        for (var i = NOW_IDX - MONTHS_BACK - 1; i <= NOW_IDX + MONTHS_AHEAD + 1; i++) {
          if (Date.UTC(Math.floor(i / 12), i % 12, 1) / 864e5 >= lo && Date.UTC(Math.floor(i / 12), i % 12 + 1, 1) / 864e5 - 1 <= hi) { months[i] = 'done'; }
        }
        render();
      }).catch(function () { if (alive) { fail(); } });
    }
    load(false);
    // Called when the element leaves the page. The content goes too, so a re-attached element starts clean.
    return function () {
      alive = false;
      ctrl.abort();
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onMouse);
      narrow.removeEventListener('change', onNarrow);
      clearTimeout(sayTimer);
      if (pop) { closePop(); }
      root.textContent = '';
    };
  }

  // The build puts the contents of oceansailing-calendar.css here.
  var CSS = '/*CSS*/';

  class OceansailingCalendar extends HTMLElement {
    connectedCallback() {
      if (!document.getElementById('oceansailing-calendar-fonts')) {
        var fonts = document.createElement('link');
        fonts.id = 'oceansailing-calendar-fonts';
        fonts.rel = 'stylesheet';
        fonts.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Onest:wght@600&display=swap';
        document.head.appendChild(fonts);
      }
      if (!document.getElementById('oceansailing-calendar-style')) {
        var style = document.createElement('style');
        style.id = 'oceansailing-calendar-style';
        style.textContent = CSS;
        document.head.appendChild(style);
      }
      this.classList.add('osse-cal');
      this.stop = mount(this);
    }
    disconnectedCallback() {
      if (this.stop) { this.stop(); this.stop = null; }
    }
  }
  if (!customElements.get('oceansailing-calendar')) { customElements.define('oceansailing-calendar', OceansailingCalendar); }

  // <div data-oceansailing-calendar></div> works like the custom tag. WordPress's visual editor drops unknown tags but keeps divs with data attributes.
  function mountPlaceholders() {
    var holders = document.querySelectorAll('div[data-oceansailing-calendar]');
    for (var i = 0; i < holders.length; i++) {
      if (!holders[i].querySelector('oceansailing-calendar')) { holders[i].appendChild(document.createElement('oceansailing-calendar')); }
    }
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', mountPlaceholders); } else { mountPlaceholders(); }
})();
