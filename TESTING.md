# Testing practices

How to test this calendar in a real browser. *What* to check is the checklist in [`SPEC.md`](SPEC.md) section 7; test data and URLs are in the README ("Test mode"). This file holds the practices that came out of real UI testing, mostly with Playwright driving a real Chromium.

## Principles

1. **Test the real thing, then the test page.** `src/test.html` is for development; the final proof is the real page the visitor sees (for the club: `/naptar/`), with the production script and real data. After every release-relevant change check both.
2. **Do what a user does.** Use real clicks and real key presses (`page.keyboard.press('Escape')`, `Tab`, arrows), not only `element.click()` or dispatched events. Esc in particular must be a real key press. For content inside an iframe, a `page.evaluate` click is more reliable than a coordinate click.
3. **Measure, do not eyeball.** Turn each "looks wrong" into a number:
   - One-row header: the `getBoundingClientRect().top` of the chips, the subscribe button and Lista/Hónap are equal (within 2 px), at every width from 900 down to 680 px.
   - No scrollbar in the iframe: inside the frame `documentElement.scrollHeight <= documentElement.clientHeight`, and the reported height equals the content height.
   - No horizontal scroll at 390 px: `documentElement.scrollWidth <= clientWidth`.
   - Colour and font: `getComputedStyle` on the element (the font really is Inter, 16 px).
   - A screenshot is evidence for the human; the numbers are the pass/fail.
4. **Reproduce first, then fix, then repeat the same measurement.** Keep the probe snippet; run it before and after.
5. **Imitate the host theme.** The WordPress theme uppercases and letter-spaces every `button` and adds an 8 px bottom margin somewhere; both bugs only showed on the real page. `test.html` carries the theme's button rule. When the real page shows something `test.html` does not, copy the theme rule into `test.html` so it stays reproducible.
6. **Assert there are no errors.** Check the console (`error` level) and failed network requests at the end of every scenario. The only accepted noise is the WordPress editor's own "Permissions policy violation: unload" (TinyMCE) in the admin, never on a visitor page.
7. **Check that the right thing is on the page, not just that something is.** Count components (exactly one), event cards (a number you can explain), iframes (0 or 1), and look for stray `<br>`/`<p>` or script text that WordPress inserted.

## Playwright quirks that cost time

- **Visible, foreground tab.** A hidden tab (`document.visibilityState === 'hidden'`) throttles timers and never fires `ResizeObserver` or `IntersectionObserver`. The loading indicator and retry look broken, the iframe never reports its height, and Smush's lazy-load never loads the iframe. In a hidden tab simulate the event (post the height message, set the `src` from `data-src`) and say so; confirm on a real browser.
- **Wait for lazy months.** Month view loads each month on demand; wait about 1.5 s after paging before inspecting, or wait for `.osse-cal__live` to change.
- **Resizing.** A `setViewportSize` in the middle of a page can hang `page.screenshot`. Go to `about:blank`, resize, then `goto`. Test widths: 900, 860, 760, 680, 640 (tools row), 600 and 390 (phone layout).
- **Print.** `emulateMedia({media:'print'})` stays on until reset to `screen`. Use about 718 px width (A4). `page.pdf()` is possible, a real print preview is a manual check.
- **`require` is not available** inside `browser_run_code_unsafe`; to write a file use `evaluate` with `filename`. Keep screenshots and backups outside the repo (`.playwright-mcp/` is ignored, and Playwright's output may land one directory above the repo, which is outside git anyway).
- **Never put the API key in a log** (see [`KEY.md`](KEY.md)). `browser_network_requests` prints full request URLs including `key=...`. Filter with a regex that excludes the key and read only the status, or run `performance.getEntriesByType('resource')` and strip `key=` before printing (`url.replace(/key=[^&]+/, 'key=***')`). The key is allowed in the browser's own traffic, not in our notes, docs, chats or commits.
- **Poll, do not sleep.** Wait for a condition (`waitForFunction`, `waitForSelector`, the text "Betöltés…" gone), not for a fixed time, except for the lazy-month 1.5 s above.
- **Isolate state.** Test mode and the filters are per page load; reload between scenarios. The calendar keeps nothing in `localStorage`.

## Scenarios worth keeping

| Scenario | How | Pass when |
|---|---|---|
| Real page, real data | open `/naptar/` logged in, no `?test` | one calendar, real event cards, no badge, no console errors, `googleapis.com/calendar` requests are 200 |
| Test mode on a real page | add `?test` to the script URL on the page | red "TESZT ADATOK" badge, test events; remove it again afterwards |
| Header on one row | measure tops at each width | equal tops at 900 to 680 px, even with the theme's uppercase buttons |
| Iframe height | list view then month view | no scrollbar, height follows the view |
| Referrer failure | fetch the API from a page with a different referrer (for example `<meta name="referrer" content="no-referrer">` injected on a local page) | the component shows "A naptár most nem érhető el." and the console shows 403 |
| Slow and failing API | `/?test&delay=3000`, `/?test&fail` | "Betöltés…", then the error with "Újra"; retry recovers |
| Keyboard | Tab into the grid, arrows, Home/End, PageUp/PageDown, Enter, real Esc | focus stays on a day cell; Esc returns focus there |
| Analytics consent | standalone `playwright-core` with a fresh context per case; mock the page and the API with `route` (page URL on `oceansailing.meder.hu` for the web component, on `calendar.navigart.net` for the own page), set the cookie `cookie_notice_accepted=true` (or body class `cookies-accepted`, or dispatch `document` event `setCookieNotice` with `detail.value` `true`) and **block** `googletagmanager.com` / `google-analytics.com` | club page without consent: no GTM script, request or `dataLayer`; with consent: one `gtm.js?id=` request, no event replayed from before consent, `calendar_*` events in `dataLayer`; `calendar.navigart.net` (top and framed): loaded without any consent; none in `?test`. The real banner appears only in a headed Chromium with a normal user agent |
| Editor round trip (WordPress) | open the page in the classic editor | the placeholder survives; always edit in the Text tab |

## After publishing (GitHub Pages)

1. Push, then poll `gh run list --json status,conclusion` from inside the repo (it fails outside a git repo) until the Pages run is `completed` / `success`. The deploy takes 1 to 15 minutes.
2. Check the live file: `curl.exe -s "https://calendar.navigart.net/oceansailing-calendar.js?x=1"` and look for the new code, and `https://calendar.navigart.net/version.txt`.
3. The script has `Cache-Control: max-age=600`, so visitors and a normal reload can still get the old file for about ten minutes. Test with a hard reload or a cache-busting query on the script URL.
4. Repeat the real-page scenario above.

## WordPress safety while testing

- The page `/naptar/` is private; anonymous requests (curl) get 404. Only a logged-in browser session sees it, so use the Playwright browser after signing in by hand.
- Before any change: back up the content (the raw `#content` textarea in the Text tab). A backup taken while the Visual tab is active is TinyMCE's rewritten view, not the saved content; the true history is under Revisions.
- Edit only in the Text tab. `switchEditors.go('content','html')` and `setUserSetting('editor','html')` switch it; the preference tends to revert to Visual.
- Click **Update** with `evaluate(() => document.querySelector('#publish').click())`. After saving, WordPress sometimes redirects to a "400 Bad Request" page although the save worked; reload the edit page and check.
- No `&` in anything pasted (WordPress rewrites it to `&#038;`).
- Never change other pages or settings; follow `AGENTS.md` rule 1.
