# navigart-calendar

The calendar of **Ocean Sailing SE** (https://oceansailing.meder.hu/), built live from the club's public Google Calendar. It looks like the club site, colour-codes the trainings and sends visitors to the right club page.

- Published at https://calendar.navigart.net/ (GitHub Pages, from `docs/`).
- No framework, no runtime dependencies, no backend.
- Why and how decisions were made: [`SPEC.md`](SPEC.md). How to work on the code: [`AGENTS.md`](AGENTS.md). How to test in a real browser: [`TESTING.md`](TESTING.md). The API key (masking, rotation, security model): [`KEY.md`](KEY.md).

## What it does

- **Two views.** "Lista" (list grouped by month) and "Hónap" (month grid with multi-day bars; on phones, tap a day to see its events).
- **Colour-coded categories** from the event title: `1. szint` ... `5. szint` (green, amber, orange, crimson, burgundy), `SRC`, `Karibi` (any title containing "karibi"), `Skipper` (everything else).
- **Filters** per category. Multi-select, all selected by default (the first click selects only that category). Each view has its own filter. Categories without a loaded event show no chip.
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

**Recommended for the club site: the web component through the placeholder div** (two lines, below). Use the iframe only where the requirements of the web component are not met (see "Requirements and the referrer policy").

Three ways, same code:

| | Web component (recommended) | iframe (alternative) | Standalone page |
|---|---|---|---|
| How | one placeholder div (or tag) + one script | one iframe + a small listener | link to https://calendar.navigart.net/ |
| Look | fixed club look (fonts loaded by the component), can be restyled | own page, same look | same as iframe |
| Works on | only pages that send a referrer from an allowed domain (see below) | any page, any domain, any referrer policy | - |
| Height | automatic | automatic with the listener, otherwise fixed | - |
| Pick it when | the site is on `oceansailing.meder.hu` and the look must match exactly | the host is unknown, sends no referrer, or must not be able to affect the calendar's CSS | you just need a link |

### Requirements and the referrer policy

The calendar reads Google Calendar straight from the visitor's browser with a Google API key. The key only works for the websites allowed on it, and Google decides by the HTTP `Referer` the browser sends with that request. So the **web component** needs all of this on the host page:

1. **The page is served over HTTPS** from an allowed domain. Allowed now: `oceansailing.meder.hu`, `navigart.net`, `*.navigart.net`, `gaboom.github.io`, `localhost`, `127.0.0.1`. Another domain, or a `www.` or other sub-domain that is not listed, gets "A naptár most nem érhető el." (HTTP 403 in the console) until it is added in Google Cloud (APIs & Services > Credentials > the key > Websites). The list is also in [`AGENTS.md`](AGENTS.md) and `SPEC.md` section 7.
2. **The page's referrer policy lets the origin through to Google.** The browser default (`strict-origin-when-cross-origin`, used when the page sets nothing) is fine, and so are `origin`, `strict-origin`, `origin-when-cross-origin` and `unsafe-url`. These **break** it: `no-referrer` and `same-origin` (the request goes to another origin, Google, so no referrer is sent). The policy can come from a `Referrer-Policy` HTTP header (server, security plugin, CDN), from `<meta name="referrer">`, or from a `referrerpolicy` attribute on the element that loads the script (the script's attribute does not affect the calendar's own requests; the page's policy does).
3. **The host's Content-Security-Policy**, if it has one, allows the script, the styles, the fonts and the API (see "Hosting notes").
4. **A browser or privacy extension that removes the referrer** (rare) also gives a 403. The calendar then shows the error message with a retry button and a link to the Google Calendar.

Current state of the club site (checked on `/naptar/`, November 2026): no `Referrer-Policy` header, no `<meta name="referrer">`, no Content-Security-Policy header, HTTPS, so the browser default applies and the component works. **If someone adds a security plugin or server header later, re-check** (see below).

How to check a page: open the browser console (F12), Network tab, filter `googleapis.com/calendar`. The request must be `200`; open it and the request header `Referer` must read `https://oceansailing.meder.hu/` (origin only is enough: the key restriction is on the domain). A `403` with an empty or missing `Referer`, or with a `Referer` of another domain, is the problem described above. The page's own policy is in the response headers of the page request (`Referrer-Policy`) or in `<meta name="referrer">`.

**The iframe has none of these requirements.** The calendar then runs on `calendar.navigart.net`, whose referrer is allowed by itself; the host page's referrer policy only affects how the iframe page is requested, not how the calendar talks to Google. It does not matter on which domain the iframe sits. The costs: the height listener on the host page (WordPress needs the `&`-free snippet below), a fixed 700 px height until the first report, and plugins such as Smush that delay iframes until they scroll into view.

### Web component

```html
<div data-oceansailing-calendar></div>
<script src="https://calendar.navigart.net/oceansailing-calendar.js"></script>
```

This is exactly what the club's calendar page contains. The placeholder div is used instead of the custom tag because the WordPress classic editor's Visual tab deletes unknown tags such as `<oceansailing-calendar>`, but keeps a div with a data attribute (it writes it back as `data-oceansailing-calendar=""`, which still works). Where nothing strips tags, the custom tag does the same:

```html
<oceansailing-calendar></oceansailing-calendar>
```

- The script can go anywhere in the page, before or after the element. Several calendars on one page work. A div that already holds a calendar is skipped. A div added to the page after the script has run is not picked up (add the `<oceansailing-calendar>` element yourself then).
- The calendar is as wide as its container, up to 900 px, and left-aligned. The div itself is not styled; style `oceansailing-calendar.osse-cal` (below).
- The tools row (filter chips, subscribe, Lista/Hónap) stays on one line down to a 680 px wide calendar and shrinks its buttons for it; narrower than that, the chips wrap.
- **Fonts and text colour are fixed** so the calendar looks the same on every page: the component loads Inter and Onest from Google Fonts itself and sets its own font (16 px Inter) and text colour (`#444`). It does not inherit the host page's typography. Buttons reset the theme's `text-transform` and `letter-spacing`. Change fonts and colours with the variables below.
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

Add a **Custom HTML** block (not the classic or visual editor, which mangles scripts) and paste the two lines of the web component (or the iframe snippet). Check the page preview before publishing.

On the classic editor, work in the **Text** tab only: the Visual tab (TinyMCE) rewrites the whole page, mangles scripts and drops unknown tags such as `<oceansailing-calendar>`. That is why the placeholder `<div data-oceansailing-calendar></div>` is the recommended form: it survives the Visual tab. Smush's lazy-load plugin delays iframes until they scroll into view; that is expected.

The club's calendar page `https://oceansailing.meder.hu/naptar/` (page ID 6306, title "Naptár", currently private) was rebuilt as the sole embed: its whole content is the two lines of the "Web component" section above, nothing else, no `?test`. The earlier comparison sections (Google iframe, the older inline script, this calendar as iframe and as component, the proof-of-concept remark) were removed on the maintainer's explicit instruction; the previous content is in the WordPress page revisions. To switch to the iframe, replace the two lines with the iframe snippet.

### Switching to the iframe

Use the iframe when the web component's requirements are not met: another domain that is not on the key, a host or plugin that sends `Referrer-Policy: no-referrer`/`same-origin`, or a site where the calendar's CSS must not interact with the page. Replace the two component lines with the iframe snippet above; nothing else changes, and the iframe needs `frame-src https://calendar.navigart.net` if the host has a CSP.

### Check that the embedding works

- Open the browser console (F12): no red errors; the calendar shows events.
- `https://calendar.navigart.net/test.html?test` shows both embedding modes side by side with test data, to compare against.
- To try the component on a real page with test data, add `?test` to the component script URL (see "Test mode" below). A red "TESZT ADATOK" badge shows. Remove `?test` again when done.
- How to test in a real browser (measurements, Playwright quirks, WordPress safety): [`TESTING.md`](TESTING.md).

| Symptom | Cause |
|---|---|
| "A naptár most nem érhető el." and a 403 in the console | the page's domain is not an allowed referrer of the key, or `Referrer-Policy: no-referrer`; use the iframe or add the domain |
| iframe has a scrollbar, wrong height | listener missing, `id` differs from `getElementById`, or the origin check fails (check the `calendar.navigart.net` spelling) |
| script text or `&#038;` visible in the page | pasted outside a Custom HTML block |
| Calendar ignores new styles | selector not specific enough; use `oceansailing-calendar.osse-cal` |
| `<oceansailing-calendar>` tag disappears after saving in WordPress | the Visual tab removed it; use the Text tab or the `<div data-oceansailing-calendar></div>` placeholder |

## Event titles (for calendar editors)

The category comes from the event title:

| Title contains | Category | Colour |
|---|---|---|
| `karibi` (any case, anywhere) | Karibi (wins over everything else, also over a level in the same title) | teal |
| `1. szint` | 1. szint | green |
| `2. szint` | 2. szint | amber |
| `3. szint` | 3. szint | orange |
| `4. szint` | 4. szint | crimson |
| `5. szint` | 5. szint | deep burgundy |
| `SRC` | SRC | purple |
| anything else (Horvát C, katamarán and manőver tréning, ...) | Skipper | blue |

To link an event to a specific page, put the link in the event description. Colours are in `TYPES` at the top of the component; the reasoning is in `SPEC.md` D13.

## Test mode

Test mode shows fixed, fake-but-realistic events instead of the live Google Calendar. Use it to try the look, a new embed place or a change without depending on the real calendar, the key, the referrer rules or the network. It is shipped in the production script on purpose and is harmless: it is always clearly marked with a red "TESZT ADATOK" badge.

**How to switch it on** (the query must be on the URL of the thing that runs the calendar):

| Where | How |
|---|---|
| Web component on any page (WordPress too) | add `?test` to the **script** URL: `<script src="https://calendar.navigart.net/oceansailing-calendar.js?test"></script>` |
| iframe | add it to the iframe `src`: `https://calendar.navigart.net/?test` |
| Standalone page | https://calendar.navigart.net/?test |

**How to switch it off:** remove `?test` again. Nothing is stored in the browser, so a reload without it is the real calendar. The real club page must never keep `?test`.

**What it does.** The component loads the events from `test-events.json` next to the script (the script itself contains no test data) and never calls Google, so it also works from a domain that is not an allowed referrer. The data are a snapshot of real club events plus edge cases: every level, SRC, Karibi, Skipper, past, all-day, multi-day, two events on one day, year boundary, an event ending at midnight, good/unsafe/long links in descriptions, and deliberately empty months (Feb 2027, Feb 2028, Aug 2028). The dates run from autumn 2026 to the end of 2028 and must be refreshed when they get old (see `AGENTS.md`).

**What it does not do.** Only the URL of the script (or of the iframe/standalone page) switches it. The host page's own URL has no effect, so a visitor cannot turn a club page into test data by adding `?test` to the page link. Add-to-calendar and subscribe links in test mode still point at the real calendar feed.

**Extra knobs** for the dev and standalone pages (not for WordPress, where `&` is rewritten to `&#038;`; there use only `?test`):

| URL | Shows |
|---|---|
| `/?test` | calendar with test data |
| `/?test&delay=3000` | slow responses (loading indicator) |
| `/?test&fail` | failing responses (error and "Újra" retry) |
| `/test.html?test` | component in a page and in an iframe with auto-height, side by side (the query is passed on to both) |

In the browser console the same knobs work at run time: `window.__delay = 3000`, `window.__fail = true`, and `window.__fetchLog` lists the requested URLs.

**Typical uses.** (1) Check that a new host page renders the calendar correctly (add `?test`, look, remove). (2) Compare the real data against the test data when something looks odd. (3) Verify the published site after a deploy when Google or the key is the suspect. (4) Automated or manual UI tests, see [`TESTING.md`](TESTING.md).

## Hosting notes

- **Caching.** GitHub Pages caches files for about 10 minutes, so a change goes live with that delay. Do not pin the script with an SRI `integrity` attribute: every update would break the embed. For a breaking change publish a new file name (for example `oceansailing-calendar-v2.js`) and keep the old one.
- **Content-Security-Policy on the host page** must allow: `script-src https://calendar.navigart.net`, `style-src 'unsafe-inline'` (the component injects its stylesheet), `connect-src https://www.googleapis.com`. The "add to calendar" `.ics` download is created in the browser (a `blob:` URL), so a strict CSP must not block downloads from `blob:`; the subscribe and Google links are plain links. The iframe needs `frame-src https://calendar.navigart.net` instead and nothing else.
- **Fonts.** The component loads Inter and Onest from Google Fonts (a `<link>` added once to `<head>`), which makes the visitor's browser contact Google. If that is a privacy concern, self-host the two font files and change the URL in `connectedCallback`. A strict CSP must allow `fonts.googleapis.com` (style) and `fonts.gstatic.com` (font). If the fonts are blocked or slow, the text uses an installed Inter or Onest if there is one, then the system UI font (Segoe UI, San Francisco, Roboto), then Arial.
- **Analytics (Google Tag Manager).** The script holds the maintainer's GTM container ID (`GTM_ID`), so embeds need no tracking code. **On `calendar.navigart.net`** (standalone page and the iframe embed, whose content is that page) it loads always, whatever the host page's cookie policy. **As a web component on another site** (the club) it loads **only after the visitor accepted that site's cookie banner** (the "Cookie Notice" plugin: cookie `cookie_notice_accepted=true`, body class `cookies-accepted`, or its `setCookieNotice` event); never when framed there. Never in test mode. Once on, it pushes `calendar_view`, `calendar_filter`, `calendar_event_open`, `calendar_detail`, `calendar_add` and `calendar_subscribe` to `dataLayer` (category and action only, no event titles); page views and GA4 events are configured in GTM. Withdrawing consent applies from the next page load. The iframe variant therefore tracks EU visitors without a banner: that is a privacy decision of the maintainer, not a technical limit. A strict CSP must allow `www.googletagmanager.com` and the Google Analytics endpoints. The club's banner is implied consent ("if you continue we assume you agree"); a real accept/reject banner would be better. To remove tracking, delete `GTM_ID` and `startAnalytics` from the script.
- **Google API key.** It is restricted to the calendar API and to the allowed websites (see above). Keep a quota cap and a usage alert on it in the Google Cloud console. The key is visible to every visitor by design and masked in the source only to keep secret scanners quiet (not security). How it works, rotation, what to do when abused, lessons learned: [`KEY.md`](KEY.md).

## Status and TODO

- **TODO:** bundle the iframe height listener with the web component, so embedding needs a single snippet.
- **TODO:** verify HTTPS for `calendar.navigart.net` in the GitHub Pages settings (the site is live; confirm "Enforce HTTPS" is on).
- **TODO:** refresh the test events (`dev/fixtures`) when their dates are old.
- **TODO (release):** set a quota cap and usage alert on the API key; decide which page becomes the public calendar page (today the private `/naptar/`).
- **TODO (manual checks):** `.ics` download and subscribe links on a phone, a real print preview, a screen-reader pass; the arrow-key navigation was reported as not working in a manual try, see SPEC section 9.
- No automated tests; see the testing section in `SPEC.md` and [`TESTING.md`](TESTING.md).
- The previous version (inline snippet pasted into a WordPress page) lives in the `osse-wip` repo under `calendar/`. It is not touched by this repo. The only WordPress change made from here is the rebuild of the private page `/naptar/` as the sole embed (see "In WordPress").

## License

MIT, see `LICENSE`.
