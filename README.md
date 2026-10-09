# navigart-calendar

The calendar of **Ocean Sailing SE** (https://oceansailing.meder.hu/), built live from the club's public Google Calendar. It looks like the club site, colour-codes the trainings and sends visitors to the right club page.

- Published at https://calendar.navigart.net/ (GitHub Pages, from `docs/`; live after the first push, see TODO).
- No framework, no runtime dependencies, no backend.
- Why and how decisions were made: [`SPEC.md`](SPEC.md). How to work on the code: [`AGENTS.md`](AGENTS.md).

## What it does

- **Two views.** "Lista" (list grouped by month) and "Hónap" (month grid with multi-day bars; on phones, tap a day to see its events).
- **Colour-coded categories** from the event title: `1. szint` ... `5. szint` (cool to hot), `SRC`, `Egyéb` (everything else).
- **Filters** per category. Multi-select, all selected by default (the first click selects only that category). Each view has its own filter.
- **Right link for every event.** The first link in the event description, otherwise the matching club page. Club links leave the iframe when embedded.
- **Month paging on demand.** Paging in month view loads one month at a time ("Betöltés…"). Loaded months also appear in the list view, so going back in time in month view reveals older events in the list.
- **Event popover** in month view (Esc, outside click or × closes it). A day with several events opens a day popover. Past events say "Lezárult" and offer no add-to-calendar.
- **Empty month.** Cells turn grey with a short neutral note; not an error.
- **Add to calendar.** Each upcoming event has two small links: a `.ics` download (any calendar app) and Google Calendar's add-event page. A single event is a one-time copy.
- **Subscribe.** The small feed icon next to Lista/Hónap offers the whole club calendar to Google Calendar, Apple Calendar or Outlook, with automatic updates.
- **Print.** Both views print cleanly: controls hidden, black on white, colour kept as borders, nothing split across pages.
- **Keyboard.** The month is an accessible date grid: Tab once, then arrows, Home/End, PageUp/PageDown; Enter opens the day's event(s).
- **Always current.** Edit the Google Calendar; nothing else to update.
- **Safe.** No HTML from the calendar is inserted; descriptions are reduced to text, line breaks and http(s) links.
- **Hungarian UI**, club fonts and rounded corners.

## Embed it

Three ways, same code. Pick one:

| | Web component | iframe | Standalone page |
|---|---|---|---|
| How | one element + one script | one iframe + a small listener | link to https://calendar.navigart.net/ |
| Look | fixed club look (fonts loaded by the component), can be restyled | own page, same look | same as iframe |
| Works on | only domains allowed on the API key (see below) | any page, any domain | - |
| Height | automatic | automatic with the listener, otherwise fixed | - |
| Pick it when | the site is on `oceansailing.meder.hu` and the look must match exactly | the host is unknown, or the page must not be able to affect the calendar's CSS | you just need a link |

### Web component

```html
<oceansailing-calendar></oceansailing-calendar>
<script src="https://calendar.navigart.net/oceansailing-calendar.js"></script>
```

- The script can go anywhere in the page, before or after the element. Several elements on one page work.
- The calendar is as wide as its container, up to 900 px, and left-aligned.
- **Fonts and text colour are fixed** so the calendar looks the same on every page: the component loads Inter and Onest from Google Fonts itself and sets its own font (16 px Inter) and text colour (`#444`). It does not inherit the host page's typography. Change them with the variables below.
- **The page's domain must be an allowed referrer of the Google API key.** Currently allowed: `oceansailing.meder.hu`, `navigart.net`, `*.navigart.net`, `gaboom.github.io`, `localhost`, `127.0.0.1`. Any other domain gets "A naptár most nem érhető el." (HTTP 403 in the browser console) until it is added in the Google Cloud console (APIs & Services > Credentials > the key > Websites). The iframe below does not have this limit.
- A host that sends `Referrer-Policy: no-referrer` also gets a 403; use the iframe there.
- To restyle, override the variables or the width with a selector that is more specific than the component's own (note the added class):
```css
oceansailing-calendar.osse-cal { --ink: #0b2545; --blue: #0a6ebd; --r: 8px; max-width: none; }
```
Variables: `--ink` (text and active buttons), `--blue`, `--blue-dark` (links), `--line` (borders), `--r` (corner radius), `--head` (heading font), `--body` (text font), `--text` (text colour). Category colours are set in `TYPES` in the source, not in CSS.

### iframe with automatic height

The page inside the frame reports its height; the parent needs this listener. It deliberately contains no `&` character: WordPress rewrites `&` in page content and breaks scripts.
```html
<iframe id="oceansailing-calendar-frame" src="https://calendar.navigart.net/" title="Naptár" style="border:0;width:100%;height:700px"></iframe>
<script>
window.addEventListener('message', function (e) {
  var frame = document.getElementById('oceansailing-calendar-frame');
  if (e.origin !== 'https://calendar.navigart.net') { return; }
  if (e.source !== frame.contentWindow) { return; }
  var d = e.data;
  if (d) {
    if (d.type === 'oceansailing-calendar:height') {
      if (typeof d.height === 'number') { frame.style.height = d.height + 'px'; }
    }
  }
});
</script>
```
- Without the listener the iframe keeps its fixed `height` (700px above) and scrolls inside.
- One calendar per frame id; with two iframes, give each its own `id` and listener.
- Club-site links inside the frame replace the whole browser window; other links open in a new tab.

### In WordPress

Add a **Custom HTML** block (not the classic or visual editor, which mangles scripts) and paste one of the snippets above. Check the page preview before publishing. The live calendar page still uses the older inline snippet from `osse-wip`; this repo does not touch it.

### Check that the embedding works

- Open the browser console (F12): no red errors; the calendar shows events.
- `https://calendar.navigart.net/test.html?test` shows both embedding modes side by side with test data, to compare against.
- To try the component on a real page with test data, add `<script src="https://calendar.navigart.net/oceansailing-calendar-test.js"></script>` **before** the component script (a red "TESZT ADATOK" badge shows).

| Symptom | Cause |
|---|---|
| "A naptár most nem érhető el." and a 403 in the console | the page's domain is not an allowed referrer of the key, or `Referrer-Policy: no-referrer`; use the iframe or add the domain |
| iframe has a scrollbar, wrong height | listener missing, `id` differs from `getElementById`, or the origin check fails (check the `calendar.navigart.net` spelling) |
| script text or `&#038;` visible in the page | pasted outside a Custom HTML block |
| Calendar ignores new styles | selector not specific enough; use `oceansailing-calendar.osse-cal` |

## Event titles (for calendar editors)

The category comes from the event title:

| Title contains | Category |
|---|---|
| `1. szint` ... `5. szint` | level 1-5 |
| `SRC` | SRC |
| anything else | Egyéb |

To link an event to a specific page, put the link in the event description.

## Test mode

Add `?test` to any calendar URL to use built-in test events instead of Google (a red "TESZT ADATOK" badge is shown):

| URL | Shows |
|---|---|
| `/?test` | calendar with test data |
| `/?test&delay=3000` | slow responses (loading indicator) |
| `/?test&fail` | failing responses (error and "Újra" retry) |
| `/test.html?test` | component in a page and in an iframe with auto-height, side by side |

Works on the published site too, e.g. https://calendar.navigart.net/?test.

## Hosting notes

- **Caching.** GitHub Pages caches files for about 10 minutes, so a change goes live with that delay. Do not pin the script with an SRI `integrity` attribute: every update would break the embed. For a breaking change publish a new file name (for example `oceansailing-calendar-v2.js`) and keep the old one.
- **Content-Security-Policy on the host page** must allow: `script-src https://calendar.navigart.net`, `style-src 'unsafe-inline'` (the component injects its stylesheet), `connect-src https://www.googleapis.com`. The "add to calendar" `.ics` download is created in the browser (a `blob:` URL), so a strict CSP must not block downloads from `blob:`; the subscribe and Google links are plain links. The iframe needs `frame-src https://calendar.navigart.net` instead and nothing else.
- **Fonts.** The component loads Inter and Onest from Google Fonts (a `<link>` added once to `<head>`), which makes the visitor's browser contact Google. If that is a privacy concern, self-host the two font files and change the URL in `connectedCallback`. A strict CSP must allow `fonts.googleapis.com` (style) and `fonts.gstatic.com` (font). If the fonts are blocked or slow, the text uses an installed Inter or Onest if there is one, then the system UI font (Segoe UI, San Francisco, Roboto), then Arial.
- **Google API key.** It is restricted to the calendar API and to the allowed websites (see above). Keep a quota cap and a usage alert on it in the Google Cloud console.

## Status and TODO

- **TODO:** bundle the iframe height listener with the web component, so embedding needs a single snippet.
- **TODO:** after the first push, verify HTTPS for `calendar.navigart.net` in the GitHub Pages settings (DNS points to `gaboom.github.io`).
- **TODO:** refresh the test events (`dev/fixtures`) when their dates are old.
- **TODO (manual checks):** `.ics` download and subscribe links on a phone, a real print preview, a screen-reader pass; the arrow-key navigation was reported as not working in a manual try, see SPEC section 9.
- No automated tests; see the testing section in `SPEC.md`.
- The previous version (inline snippet pasted into a WordPress page) lives in the `osse-wip` repo under `calendar/`. It is what the WordPress page uses today and is not touched by this repo.

## License

MIT, see `LICENSE`.
