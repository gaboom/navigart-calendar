# SPEC: Ocean Sailing SE calendar

Why this exists, what it must do, which decisions were made and why, and how it is meant to be tested.
For *what it is and how to use it* see `README.md`; for *how to work on it* see `AGENTS.md`.

## 1. Intention

The sailing club Ocean Sailing SE (https://oceansailing.meder.hu/, WordPress) keeps its courses and trips in a public Google Calendar. The club wants that calendar **on its own site**, looking like the site, instead of the stock Google embed.

The Google embed cannot do three things the club wants:

1. Take over the look of the site (fonts, colours, shapes).
2. Colour-code the different trainings (levels 1-5, SRC, other).
3. Send a visitor from an event to the right page of the club site.

The author is a volunteer (yacht-captain trainee, IT background) who will not always be around. The result must therefore be **small, readable, easy to hand over, and cheap to run** (no servers, no subscriptions).

## 2. Goals and non-goals

Goals
- A calendar that looks native on the club site and works on phones.
- Always current: the club edits Google Calendar only; nothing else to maintain.
- Embeddable by pasting a few lines into any page, with no admin or FTP access to the hosting.
- Maintainable by one person with plain HTML/CSS/JS knowledge.

Non-goals
- No event editing, sign-up, payment or notifications. The calendar is read-only.
- No backend, database or WordPress plugin.
- No framework, bundler, transpiler or runtime dependency.
- No full replacement of Google Calendar features (invites, reminders). Only the two read-only conveniences "add to calendar" (F22) and "subscribe" (F23) are offered, and both hand over to the visitor's own calendar app.
- No persistence of user choices (filters reset on reload).

## 3. Users

- **Visitor** (prospective or current student): checks when the next course or trip is, and follows it to the club page. Mostly on a phone.
- **Club editor**: maintains events in Google Calendar, following the title convention below. Never touches this project.
- **Maintainer** (volunteer developer): changes categories, look or behaviour, rebuilds and publishes.

## 4. Functional requirements

Data
- F1. Events come live from the club's public Google Calendar through the Google Calendar API v3 (`events.list`, recurring events expanded). No copies of the data are kept in the project.
- F2. First load covers the whole previous month up to the end of the 12th month ahead (built from month numbers, so the 29th to 31st never overflow). It uses the club time zone for day boundaries; a finished all-day event turns "Lezárult" at Budapest midnight.
- F3. All events live in **one shared list** in memory. Both views read from it.

Categories
- F4. Category is derived from the event title: `N. szint` (N = 1-5), `SRC`, otherwise `Egyéb`. First match wins, `Egyéb` is the catch-all.
- F5. Each category has a fixed colour (cool to hot with the level) and a fallback club page.

Views
- F6. **List view** ("Lista"): events grouped by month, with date block, title, time or date range, place and category tag. The place links to Google Maps (new tab). The title link is stretched over the whole card, so a click anywhere on the card opens it; links inside the card (place, description) stay clickable above it.
- F7. **Month view** ("Hónap"): calendar grid, multi-day events as continuous bars across days and weeks. On narrow screens (up to 600 px) days are tapped and the events of that day are listed below the grid. Designed for 2 to 3 events in parallel: overlapping bars stack in lanes and the week row grows, there is deliberately no "+N more" overflow. A loaded month with no bar anywhere in its grid (neighbouring-month days included) or without events of the selected category is greyed with a note over the grid.
- F8. Paging in month view loads **one month at a time on demand**, with a small "Betöltés…" indicator. A loaded month is merged into the shared list, so the list view then also shows those events (for example going back in month view makes older past events appear in the list view).
- F9. A failed month load shows an error with an "Újra" (retry) button. A failed first load shows a message with an "Újra" retry button and a link to the Google Calendar (opens in a new tab, so it also works inside an iframe); a successful retry is announced like any change.
- F10. "Ma" jumps to today. Past events stay visible, marked "Lezárult" and visually muted.

Filters
- F11. Category filter chips are multi-select and **all selected by default**. Clicking a chip while all are selected selects only that one. Otherwise a click adds or removes a chip. Removing the last chip, or selecting all, returns to the all-selected state. Chips are in a `role=group` labelled "Kategóriák"; selected state is `aria-pressed`.
- F12. **Each view has its own filter state.** Both start with all categories shown. Changing the filter in one view never changes the other. Not persisted.

Linking
- F13. The event title links to the first link found in the event description; if there is none, to the fallback page of its category.
- F14. Club-site links replace the whole browser window when the calendar is inside an iframe (`target=_top`). External links open in a new tab.
- F15. In month view, clicking an event bar opens a compact popover: title first, the category and the close button together in one coloured block in the top right corner, date and place on one line, then the description, then one footer row with the "Részletek" button and the add-to-calendar links. Esc, a click outside or the close button closes it, and focus returns to the opener (the bar's first in-month day cell). Whenever the view re-renders (filter, view toggle, month paging, retry), keyboard focus stays on the equivalent control, and focus held outside the component is never taken. Screen readers get one short summary per change from a hidden `role=status` region (e.g. "SRC: Lista, 3 esemény", "2026. november, 5 esemény"), debounced so paging quickly speaks only the settled month, and silent on page load; the rebuilt content itself is not a live region. Crossing the 600 px breakpoint re-renders. The month is an ARIA date grid (see F25): bars are decorative (`aria-hidden`, mouse/touch only) and the day cells carry the semantics.
- F25. Month grid keyboard. The month is `role=grid` (named by the month title) with `role=row` weeks and `role=gridcell` days. Exactly one in-month day is a tab stop (roving `tabindex`: the last focused day, else today, else the 1st), so Tab enters and leaves the grid in one stop. Keys: arrows ±1 day / ±1 week, Home / End = start / end of the week (clamped to the month), PageUp / PageDown = previous / next month with the day clamped (31 → 30), moving across months pages the month and keeps focus on the day. Same-month moves only move tabindex and focus (no re-render). Enter / Space: wide screens open the event popover for a day with one event, a day popover (`--day`, title = date, tag = "N esemény", cards inside) for a day with two or more, nothing for an empty day; at ≤600 px the day is selected and its cards fill the day list below the grid. Ctrl/Alt/Meta combos are ignored. Day cells are named "november 11., szerda, 1 esemény: 18:00 Cím" (all titles), with `aria-current="date"` for today and `aria-selected` only at ≤600 px. Out-of-month cells are `aria-hidden` and not focusable (a tap still selects them at ≤600 px). A re-render (filter, async month load) keeps focus on the same day cell.

Embedding
- F16. One custom element `<oceansailing-calendar>`, usable in any page with a single `<script src>`.
- F17. The same code is also available as a standalone page and as iframe content (`index.html`). Inside an iframe it reports its height to the parent (`postMessage`), so the parent can size the frame without scrollbars.
- F18. Several instances on one page, and removing/re-adding the element, must work without leaks or errors.

Look
- F19. Fonts follow the club site (Inter for text, Onest for headings) and links, buttons and shapes follow the site's style, with rounded corners. One design everywhere: the component loads both fonts itself (one `<link>` in `<head>`, id `oceansailing-calendar-fonts`) and sets its own font and text colour via `--body` / `--head` / `--text`; host typography is not inherited. Every element in the component gets `--body` explicitly, so theme rules on `h2`, `button` etc. cannot change it.
- F20. UI language is Hungarian.
- F22. Add to calendar. Every upcoming event (not past ones) has two small links: a `.ics` download built in the browser, and Google Calendar's add-event page. In the list they are icons only (with `title` and an accessible name that includes the event title); in the month popover they carry text. The `.ics` holds title, time (UTC, or date-only for all-day events), place, description as text plus the details link, `SEQUENCE` and `DTSTAMP` from Google, and the same `UID` Google uses in its feed (`<id>@google.com`), so re-importing updates an event instead of duplicating it. A single event is a one-time copy; only subscribing keeps a calendar in sync.
- F23. Subscribe. A small feed icon next to the Lista/Hónap switch (both views) opens a panel with two links to the whole public calendar, kept in sync by the visitor's calendar app: Google Calendar (`render?cid=`) and the public iCal feed as `webcal://` (Apple, Outlook). It cannot be filtered by category (Google's feed is the whole calendar). Esc and outside click close it.
- F24. Print (`@media print`, both views). Prints what is on screen (current view, month and filter). Hidden: filters, view switch, subscribe, paging buttons, add-to-calendar links, popover, day list. Black on white with no reliance on background graphics: category colour only as borders (card/bar stripe, outlined tag), today as a bold outlined number. Cards, month heading and week rows never split across pages; month bars wrap their title instead of truncating. Link URLs are not appended. Page margins are the host page's choice (`index.html` sets none).

Test mode
- F21. Test mode: `?test` on the calendar page URL (iframe, standalone) or on the component's script URL (`oceansailing-calendar.js?test`) serves events from `test-events.json` (next to the script) instead of calling Google (see section 7). The component file contains the small mock, but no test data; there is no separate test script. Ships in production on purpose.

## 5. Non-functional requirements

- **Security / privacy:** no HTML from the calendar is ever inserted into the page. Descriptions are rebuilt from a whitelist (text, line breaks, http/https links). The page contains no personal data and sets no cookies.
- **Accessibility:** buttons are real `<button>`s with `aria-pressed` state and labels, the month is an ARIA date grid with arrow-key navigation (F25), a hidden `role=status` region gives short announcements (F15), the popover is keyboard-closable.
- **Performance:** one API call on load, one per newly visited month. No dependencies to download except the optional fonts.
- **Compatibility:** current evergreen browsers (needs custom elements, `Intl`, CSS grid).
- **Debuggability:** the published JS is **not minified**; it can be read in the browser's dev tools.
- **Time zone:** calendar days are computed in Europe/Budapest regardless of the visitor's time zone, so an event never moves to another day.

## 6. Decisions and rationale

| # | Decision | Alternatives considered | Why |
|---|---|---|---|
| D1 | Read Google Calendar API directly from the browser with a restricted API key | Parse the public ICS feed; a server-side relay (PHP plugin); scrape the Google embed | The calendar is public, so a key is enough. ICS is blocked by CORS in the browser. A relay needs hosting access we do not have and a backend we want to avoid. |
| D2 | No backend at all | WP plugin / proxy | Keep it simple (KISS), no admin or FTP access, nothing to keep running. |
| D3 | The API key is visible in the shipped JS | Hide it behind a proxy | A browser key can never be secret. Protection = key restrictions in Google Cloud: Calendar API only plus allowed HTTP referrers. |
| D4 | The key is committed in the source, XOR-masked + base64, and decoded at run time | Plain key; `.env` / env var injected at build time | The repo is public and secret scanners flag plain keys. The published file contains the masked key anyway, so injecting it at build time added moving parts (env files, lookups) for no gain: the key is now simply part of the codebase, masked. Masking is camouflage, **not security**, and is documented as such. `npm run mask` produces a masked value; the build checks the shipped value decodes to a Google-key-shaped string, fails if the plain key reaches any output file, and prints the decoded key shortened (`AIza…abcd`) so it can be compared without leaking it. `npm run build:show-key` prints it in full for the owner's own use (never in CI). |
| D5 | One web component, light DOM (no shadow DOM) | iframe only; shadow DOM | Light DOM lets the host restyle it with CSS variables; typography is fixed by the component for a single look. CSS is scoped under `.osse-cal` to avoid leaking. |
| D6 | Hybrid distribution: component script **and** iframe/standalone page from one source | Paste a big inline snippet into each page; WordPress-native reusable block | The inline snippet is cumbersome and must be copied to every page on every change. WP-native reuse needs admin access. Hosted files update everywhere at once. |
| D7 | Hosting on GitHub Pages from `/docs` with custom domain `calendar.navigart.net` | WordPress media upload; other host | Free, no admin access needed, versioned with the code. |
| D8 | The iframe height is reported via `postMessage`, the parent needs a small listener | Fixed height; same-origin tricks | Cross-origin frames cannot be measured from outside. TODO: bundle the listener so the parent needs nothing extra. |
| D9 | The listener snippet contains no `&` | Normal `&&` | WordPress rewrites every `&` to `&#038;` in page content, even inside `<script>`, which breaks the script. This was found on the live page. |
| D10 | Plain ES5-style classic script, no module, no framework, no bundler | React, lit, ES modules + bundler | A plain `<script src>` must work anywhere, with zero tooling to maintain. The build is one small Node script. |
| D11 | Build output (`docs/`) is committed, deterministic and unminified | Build in CI; minify | GitHub Pages serves the branch as is. No timestamps means rebuilding without changes gives no diff. Readable output keeps it debuggable. |
| D12 | Categories derived from the event title | Separate calendars per category; extended properties | Zero extra work for the editors, one calendar, one convention (`N. szint`, `SRC`). The convention is the contract with the club editors. |
| D13 | Colours cool to hot with the course level; rounded corners; Inter/Onest fonts | Google's colours; custom brand | Chosen after comparing with the club site; the colour coding was explicitly liked. |
| D14 | One shared event list for both views, month view loads month by month | Separate data per view; load everything up front | Month view stays fast and light, and what was loaded is not thrown away: list view shows everything loaded so far. |
| D15 | Filters are multi-select, all selected by default, and **per view** | One shared filter; single-select with "none selected" = all | Users think of the two views as separate tools. A single-select where nothing looks pressed was confusing; all-pressed shows the real state. No persistence: always a predictable start. |
| D16 | Event description is rebuilt from a whitelist, never inserted as HTML | Sanitiser library; `innerHTML` | Descriptions come from a Google account anyone with edit rights controls. DOM nodes only means no XSS class of bugs, and no dependency is needed. |
| D17 | Test mode (`?test`) is shipped in production, switched by the query of the component's own script URL (and of the iframe URL); the data is a separate JSON file | Dev-only mock; a separate `-test.js` distributable; switching by the host page's URL | The same switch is used by the maintainer, by automated checks and by anyone verifying the published site, including when the key or Google is unavailable. Only the script URL (not the host page URL) switches it, so a visitor's link cannot turn a club page into test data. One script to embed, no second file to remember, and the production script carries no test data. Zero cost, clearly badged. |
| D18 | WordPress is never touched by the project tooling | Automated deployment to WP | Production site must not be at risk. The only integration is a paste of two small snippets by a person. The older inline version still running on WordPress lives in the `osse-wip` repo. |
| D19 | The month is an ARIA date grid with one roving tab stop; event bars are decorative (mouse/touch only) | Every bar and every day a tab stop; light semantics without `role=grid` | Tabbing through ~30 cells and every bar is slow. The grid pattern gives one tab stop and arrow keys, and the day cell can name all its events. Bars cannot carry the semantics because a bar spans several days. |
| D20 | Bars are drawn on neighbouring-month days of the grid; a month counts as empty only if the whole visible grid has no bar; the empty note is a neutral overlay on greyed cells | Clip bars to the month; show the note under the grid in a dashed box; reuse the error status | Spill-over bars are useful and were decided early. A note beside a visible bar would contradict itself. Empty is not a failure, so it must not look like the red error status. |
| D21 | No deep link (URL state for view, month or filters) | Query parameters or hash | The maintainer decided against it. Not to be proposed again without a new reason. |

## 7. Testing intentions

There is **no automated test suite** (decision: the project is small and has no dependencies; a test framework would be the heaviest part). Testing is a repeatable manual checklist against **test mode**, which makes the data deterministic and independent of Google, the key and the network.

Why test mode: the real calendar changes over time, the real API only answers to allowed referrers, and error and slow states cannot be triggered on demand. The test data is a snapshot of real club events plus synthetic edge cases (every level, SRC, other, past events, all-day and multi-day events, a day with two events, events outside the first data window, events crossing a year boundary, an event ending at midnight, links in descriptions that are good, unsafe or very long, plain text).

Test URLs (locally `http://localhost:8765/`, in production `https://calendar.navigart.net/`):
- `/?test` standalone page with test data.
- `/?test&delay=3000` slow responses ("Betöltés…").
- `/?test&fail` failing responses (error, "Újra").
- In the browser console the same knobs work at run time: `window.__delay = 3000`, `window.__fail = true`, and `window.__fetchLog` lists the requested URLs (use it to check the data window and on-demand loads).
- `/test.html?test` component used directly in a page **and** inside the iframe with auto-height; checks footer overlap.
- Embedded from another origin (client-side only, e.g. injecting the element and `<script src=".../oceansailing-calendar.js?test">` into any page in the browser console): test data loads (CORS from GitHub Pages), badge shows; without `?test` the real API is used.
- `/` without `?test` uses the real API (needs an allowed referrer, e.g. `localhost`).

What a check must cover
- **Data and categories:** each level, SRC and Egyéb get the right colour, tag and fallback link; description links are used, unsafe links (`javascript:`) are dropped, tags and scripts in descriptions are inert.
- **List view:** month grouping, past events muted, empty state per filter.
- **Month view:** bars span days and weeks correctly, year boundary, event ending at midnight, "Ma", paging back and forward, on-demand load indicator, loaded months appear in the list view afterwards.
- **Failure handling:** first-load failure message, month-load failure and retry, recovery.
- **Detach/re-attach:** remove the element while the first fetch is in flight and re-append it (and remove it for good): the late response must not render, no console error, one live region, no leftover content in a removed element.
- **Filters:** all chips pressed in both views at start; first click selects only that chip; add/remove several; removing the last or selecting all returns to all; change in one view does not affect the other.
- **Popover:** opens on bar click, or Enter/Space on a day cell (day popover for 2+ events; test data has two on 28 Nov), closes with Esc (focus back to the day cell), outside click and the close button. Esc must be checked by hand with a real key press.
- **Focus:** Tab to a chip, view toggle, ‹ › and "Ma", press Enter: focus must stay on that control after the re-render.
- **Month grid keyboard:** one `tabindex=0` cell; Tab enters and leaves in one stop; arrows, Home/End, PageUp/PageDown (cross-month, 31 → 30 clamp) keep focus on a day; Enter/Space opens the event or day popover; at 390 px Enter selects the day and fills the day list; a filter change keeps focus on the cell. Bars are not tab stops; no `role=dialog` exists at 390 px; resizing across 600 px re-renders correctly.
- **Past and empty states:** never by opacity alone. Past events say "Lezárult" in the list card (grey card with grey stripe, date and text, so it reads as done even at a glance; text stays ≥4.5:1), in the month popover (bold "Lezárult" before the date, grey "Részletek" button, no add-to-calendar links) and in the day cell's accessible name ("… (lezárult)"); a type with no events has a dashed chip border and the tooltip "Nincs esemény". An empty month (loaded, no events, or none in the selected categories) is not an error: cells turn grey with a neutral centred note over the grid ("Ebben a hónapban nincs esemény." / "…nincs ilyen esemény."), no dashed box, no red; the red "Nem sikerült betölteni" status is only for failed loads.
- **Contrast:** white text on every category colour must stay ≥4.5:1, also on hover/focus (hover darkens with `brightness(.85)`, never brightens). Check new colours before adding them.
- **Month labels:** day cells read "november 11., szerda, 1 esemény: Cím" with current (today) and selected (narrow only) states; bars, weekday letters and day numbers are not read.
- **Announcements:** with a screen reader (or a MutationObserver on `.osse-cal__live`) every interaction gives one short message, page load gives none, and clicking › many times quickly gives only the last month.
- **Add to calendar / subscribe:** list cards of upcoming events show two icon links (none on past events); the popover shows both with text; the `.ics` content is right for timed, all-day, multi-day and long-description events (lines folded at 75 bytes, `\n` escaped, link not duplicated); the Google link has the right dates; the feed icon opens the panel, Esc returns focus to the icon, outside click closes it, and at 390 px the panel stays inside the screen. The actual file download and the opening of both subscribe links in a calendar app need a manual check on a phone (not possible in the headless test browser).
- **Narrow screen (390 px):** no horizontal scroll, tapping a day lists its events.
- **Print:** with `emulateMedia({media:'print'})` at about 718 px (A4 width), list and month view show no controls, no trailing " · ", bars wrap, colour only in borders; `page.pdf()` works. A real print preview on paper/PDF in a normal browser is a manual check.
- **Embedding:** direct component and iframe both render; in the iframe club links use `_top`; the iframe height follows list ↔ month view; no overlap with content below; several instances and remove/re-add work; no console errors.
- **Real data smoke test:** `/` with the real key from an allowed referrer shows real events; the build prints the shortened key (`AIza…abcd`, or in full with `npm run build:show-key`) and it matches the key in Google Cloud.
- **Build:** `npm run build` succeeds, the plain key is not in `docs/`, rebuilding without changes gives no diff.
- **Production:** after publishing, repeat `/?test` and `/` on the real domain, then a page that embeds it.

Known limits of the approach
- Browser timers are throttled in hidden/background tabs, which makes timing-based checks (loading indicator, retries) look broken. Test in a visible foreground window.
- The fixtures have absolute dates (autumn 2026 to the end of 2028; Feb 2027, Feb 2028 and Aug 2028 are deliberately empty) and must be refreshed when they become old.

Possible future automation (only if the project grows): a headless-browser script that runs this checklist against `?test`. Nothing in the design prevents it, because test mode and stable class names already exist.

## 8. Operating constraints

- The club's website runs on shared hosting with WordPress; the author has **no FTP and no admin access**, and must not touch the site beyond pasting embed snippets when asked.
- The Google Cloud key is restricted to the Calendar API and to HTTP referrers (`*.navigart.net/*`, `navigart.net/*`, `oceansailing.meder.hu/*`, `localhost/*`, `127.0.0.1/*`, `gaboom.github.io/*`).
- The calendar must stay public, otherwise the key-only access stops working.

## 9. Open items and ideas

Do before or right after publishing
- Verify GitHub Pages HTTPS for `calendar.navigart.net` after the first push (DNS was corrected to `gaboom.github.io`; the domain returns 404 until then), then repeat the production check in section 7.
- Manual checks that the headless test browser cannot do: the real `.ics` download and both subscribe links in a calendar app (phone), a real print preview, a screen-reader pass, the Custom HTML block in WordPress (only ever by adding sections, see D18).
- Arrow-key navigation was reported as "not working" by the maintainer in a manual try (how it was tried is unknown). It works in scripted tests: click or Tab into the grid, then arrows. Known gaps: clicking an event bar does not move focus into the grid, a mouse click on a day shows no focus ring (`:focus-visible`), and arrows do nothing in list view. Reproduce on a real browser before changing anything.
- Google Cloud: set a quota cap and a usage alert on the key (owner action).

Backlog (low priority, none decided)
- Bundle the iframe height listener with the component so embedding needs one snippet only.
- Touch targets of 21-36 px (chips, icons) are below the 44 px guideline.
- `prefers-reduced-motion`: the loading pulse and transitions do not respect it yet.
- Cards are hard-coded white; they would clash on a dark host page.
- Self-host the two fonts to avoid contacting Google (GDPR). Advised to skip while the club site itself uses Google Fonts.
- A `scripts/check.mjs` (build, key scan, syntax) plus a CI workflow; extra fixtures (DST change, paged response, a 12-event day, a 3-lane week); headless browser tests.
- Refresh the test fixtures when their dates are old.
