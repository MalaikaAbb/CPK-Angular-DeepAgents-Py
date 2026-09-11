# Autorecorder

Automated screen-recording suite for CopilotKit framework integrations. It
produces one narrated-looking demo video per documentation page: read the doc,
switch to VS Code and show the code that implements it, switch to the browser and
drive the live feature.

Configured for **Deep Agents (Python) + Angular** — the 11 routes of this repo
that have a chrome-free `/demo` page. The two doc routes without one (the
Introduction landing page and `/doc-sync`) are deliberately unregistered; see
*Scope*.

This copy does one thing most of its siblings do not. Four of the eleven pages
here are on the QA report as broken, and their clips exist to **show the
defect**, not to work around it. That changes what a run means and what it
produces — see [Known issues](#known-issues) below.

> **Porting this to another framework?** Read **[ADAPT.md](ADAPT.md)** first. It
> is written for the person or agent doing the port, and it is the contract the
> `doctor` command enforces.
>
> **[PORT-NOTES.md](PORT-NOTES.md)** is what this port owes back to `core/` —
> the framework-specific strings still in shared code, the two modules sitting in
> `actions/` that belong in `core/`, and the fact that two different generations
> of this suite are now in circulation. Nothing in `core/` was edited; that file
> is the report `ADAPT.md` asks for instead.

---

## Run it

All three services must be up first — the recorder refuses to start otherwise,
because a video of a dead page is worse than no video.

Angular has no server route to host the Copilot Runtime, so it runs as its own
Node process (`frontend/server.ts`). `npm run dev` starts **two** processes: that
runtime on :8203 and `ng serve` on :4203. The browser posts across origins to the
runtime, which is why `runtimeWarmPath` in `project.config.ts` is an absolute URL
rather than a path.

```bash
# :8123 — the DeepAgents graph, served by the LangGraph dev server
cd backend && uv run --with "langgraph-cli[inmem]"   langgraph dev --port 8123 --no-browser --no-reload

# :8203 runtime + :4203 ng serve, together under concurrently
cd frontend && npm run dev
```

**`--no-reload` is not optional**, and it cost a run to learn. `langgraph dev`
hot-reloads on any change under the repo, and the pipeline writes into the repo
while it runs — `frontend/VERSIONS.md` before recording, then clips, logs and
`RECORD_RESULTS.json` into `videos/`. The watcher sees those, reloads
repeatedly, and eventually exits mid-suite, which surfaces as later pages failing
with "the agent never replied" and no other clue.

The backend is a **graph, not an HTTP server**: `backend/main.py` exports
`agent`, `backend/langgraph.json` publishes it as `sample_agent`, and serving it
is the dev server's job. That server answers `/ok` — not `/health`, and not
`/openapi.json` — which is what `backendHealthPath` is set to and what
`frontend/src/app/components/backend-health.ts` probes, so both halves of the
repo agree on what "the backend is up" means.

Then:

```bash
cd autorecorder
npm install
npx playwright install chromium

npm run doctor            # is the configuration sane?
npm run record -- --list  # what will be recorded
npm run record -- --quickstart
npm run record -- --pages=issues   # just the pages with known defects
npm run record            # all pages, in order
```

Or drive the whole thing — servers, installs, drift check, report — from the
repo root with `npm run automate`. See [`ci/README.md`](../ci/README.md).

| Flag | Effect |
|---|---|
| `--list`, `--help` | Print every registered route and exit |
| `--doctor` | Validate the configuration; exits 1 on error |
| `--doctor --online` | Also probe every doc/demo URL and the selectors |
| `--<page-id>` | Record one page — `--quickstart`, `--in-app-agent-write` |
| `--page=<id>` | Same thing, explicit form |
| `--pages=a,b,c` | Record several |
| `--pages=issues` | Record every page carrying a `knownIssue` |
| `--filter=<query>` | Record every page whose id or name contains the query |
| `--force` | Record even if the pre-flight health check fails |

Videos land in `videos/` as `<videoPrefix>-<NN>-<name>.webm`, 1920×1080, ~25fps
(Playwright's capture rate; it is not configurable). Per-page outcomes land
beside them in `RECORD_RESULTS.json`, which is what `ci/build-report.mjs` turns
into the QA report.

**`videos/` is gitignored on purpose.** Recordings are build output — reproducible
from this folder plus `npm run record` — and committing them is expensive: 17 clips
at ~5MB, rewritten on every re-record, took one repo's `.git` to 348MB before its
history had to be rewritten. Publish them as release assets or to a bucket.

---

## Reading the summary

```
   ✅ [PASS]  (24.1s) Quickstart -> DAPY-react-01-Quickstart.webm
   ⚠️  [PASS*] (31.7s) A2UI · Advanced -> DAPY-react-08-A2uiAdvanced.webm
        · Doc page (…/advanced): Timeout 25000ms exceeded
   🐞 [ISSUE] (61.3s) Writing agent state -> DAPY-react-11-SharedStateWrite.webm
   ❌ [FAIL]  (19.4s) A2UI · Styling -> DAPY-react-07-A2uiStyling.webm
        · Demo step failed: Demo route returned HTTP 500
```

- **PASS** — every step completed.
- **PASS\*** — recorded, with a note. Either the external doc page misbehaved
  (intro footage degraded, feature not implicated), or the page's handler
  reported something it did not see (`ctx.warn`), or the browser console
  logged errors during the demo step. The notes are on the summary line and
  in `RECORD_RESULTS.json`.
- **ISSUE** — recorded a page that carries a `knownIssue`. Not a failure: the
  clip is doing its job. **It does not mean the defect was confirmed today** —
  the recorder cannot judge that. Watch the clip.
- **FAIL** — the demo route 404'd, never rendered a chat surface, the agent never
  answered where an answer was expected, the IDE view could not be built, or the
  handler reported that the feature did not work (`ctx.fail`). The clip is still
  saved as evidence.

Only **FAIL** sets a non-zero exit code, so CI can be gated on it while five
documented defects record every night without turning the pipeline red.

---

## Known issues

A page that reproduces a defect declares it in `config/pages.config.ts`:

```ts
knownIssue: {
  area:        'Deep Agents - App control - Shared state - Writing agent state',
  problem:     'The toggle button does not change the language the agent answers in…',
  impact:      'UI elements cannot drive the agent…',
  likelyCause: 'The written state never reaches the model…',
}
```

That one object does three jobs, which is the whole point of it existing:

1. it flips the take's outcome to `[ISSUE]`,
2. it is typed into a simulated Notepad window at the end of the clip, over the
   still-visible failure, so the video carries its own report, and
3. `ci/build-report.mjs` renders it into `DOCUMENTED_REPORT.md`.

The sentence on screen and the row that reaches a manager are the same string.
There is no second place to update, so there is no second place to forget.

**Delete a `knownIssue` in the same change that confirms the fix.** A stale one
is worse than none: the clip keeps asserting a bug that is gone, and the doctor
cannot tell.

### Making a defect visible

Every defect here is an *absence* — a surface that never draws, a list that
renders nothing, a composer that stays empty — and absence is genuinely hard to
film. An empty panel beside a working chat looks like a page nobody has asked
anything yet. Four helpers exist for that:

| Helper | For |
|---|---|
| `showCaption()` — `core/overlays/caption.ts` | These clips have no voice track. A claim the screen cannot make on its own has nowhere else to go. |
| `openDevTools()` — `core/overlays/devtools-console.ts` | Failures that exist only in the console. |
| `showWorkingVariant()` — `core/compare.ts` | The same page against code that works — for repos that carry paired routes. Unused here; see below. |
| `writeIssueNote()` — `core/issue-note.ts` | The Notepad report, with a tested-context block read from the tree that actually ran. |

**Contrast comes from inside the page here, not from a paired route.** The React
sibling carries `/…/fixed` variants because its defects have known fixes. None of
these four do, and a "fixed" route that quietly did something else would be worse
evidence than no second route at all. Each of these pages happens to contain its
own control, which is better evidence anyway because it is the same page, the
same session and the same agent:

| Page | The contrast filmed |
|---|---|
| `threads` | The hand-built `injectThreads` list renders a real thread from a 200 response; `copilot-threads-drawer` beside it renders nothing. Filmed in that order deliberately — the other way round, an empty drawer just looks like an empty account. |
| `voice-multimodal` | An image attached to the composer is read correctly, then the microphone on the *same* composer transcribes nothing. |
| `memory` | The panel renders nothing at all — not even the guide's own "not available" fallback, whose absence is the finding. The take asks the agent to remember something and then shows nothing was stored. |
| `a2ui` | The agent answers in prose where a component should be, and the console is opened to show that nothing was even logged. |

**Do not hardcode which way a page fails.** `a2ui.action.ts` captures the console
first and then films whichever failure actually occurred — a catalog error in
DevTools if one was logged, a silent-inert note if not. That branch is not
defensive padding: the QA report described this page as a `Catalog not found`
error (true of the React build) and on Angular no error is logged at all. A
handler written to the report rather than to the observed behaviour would have
filmed an empty DevTools pane and asserted a bug that does not exist here.

Each handler also tolerates agent silence rather than aborting on it. Whether the
agent additionally failed to answer is not the finding, and losing the evidence
to an exception would throw away the point of the clip.

---

## Layout

The split between what you edit and what you don't is the point of this folder.

```
autorecorder/
├── ADAPT.md                    ← how to port this; read before editing
├── cli.ts                      ← entrypoint, arg parsing, summary
│
├── config/                     ← ★ THE ADAPTATION SURFACE
│   ├── project.config.ts         framework slug, doc root, URLs, start commands
│   ├── pages.config.ts           one entry per doc page, plus its knownIssue
│   └── selectors.config.ts       how to find the chat surface
│
├── actions/                    ← ★ what to DO on each page
│   ├── index.ts                  page id → handler registry
│   └── *.action.ts               per-page interaction scripts
│
├── core/                       ← ✖ DO NOT EDIT — no framework knowledge here
│   ├── CORE_MANIFEST.json        hash per core file; `npm run core:check` enforces it
│   ├── engine.ts                 browser lifecycle, the 3-step sequence, outcomes
│   ├── actions.ts                sendPrompt, response detection, standard action
│   ├── select.ts                 which pages a `record` invocation means
│   ├── timeouts.ts               every fixed wait, with project/page overrides
│   ├── compare.ts                the same page on code that works
│   ├── issue-note.ts             the defect report, typed on screen
│   ├── doctor.ts                 the adaptation contract, as a command
│   ├── diagnostics.ts            pre-flight health check
│   ├── types.ts                  PageDefinition → PageRecordConfig, KnownIssue
│   ├── ide/generator.ts          VS Code simulator, Shiki-highlighted from disk
│   └── overlays/                 taskbar, cursor, Notepad, alert, DevTools, caption
│
├── scripts/core-manifest.mjs   ← core/ drift check (--check / --write / --diff)
├── test/                       ← unit tests for the pure modules (`npm test`)
│
└── videos/                     ← output, plus RECORD_RESULTS.json per run
```

---

## What a recording actually does

1. **Doc page** — opens the real documentation URL, waits for hydration, then
   scrolls at reading pace and rests the cursor on a code block. Clicks VS Code
   on the simulated taskbar.
2. **IDE** — renders the project's own source, read from disk and highlighted
   with Shiki, with the page's line range selected. Multi-tab pages switch tabs.
   Served from the frontend's origin via an intercepted route, so the doc page is
   fully unloaded rather than painted over. Clicks Chrome on the taskbar.
3. **Demo** — opens the chrome-free demo route, drives the feature, and pauses
   for reading. On an issue page this is also where the defect is provoked,
   labelled, compared against working code, and written down.

### What makes it read as a person

Every pace in a take comes from `core/overlays/human.ts`, seeded from the
page id. So two clips do not type, pause and scroll in the same rhythm — but
tonight's take of a page is identical to last night's, which keeps two
recordings of the same defect comparable.

- **Typing** has a person's rhythm: jittered keystrokes, a beat after
  punctuation, the odd mid-sentence pause — in the chat composer and in the
  Notepad note alike. A retry after a swallowed submit is typed quickly
  instead; that is the recorder recovering, not a performance.
- **Scrolling** is in bursts: a few wheel notches, a reading pause, a few more,
  sometimes a nudge back up.
- **Pauses** vary by about a quarter around their nominal length.
- **The cursor** overshoots slightly on long travel and settles, hovers a
  variable moment before a click, drifts while a reply streams instead of
  freezing, and starts each take somewhere plausible rather than dead centre.
- **Windows** fade in over 180ms (IDE, Notepad) instead of cutting.

Two details worth knowing, because both were bugs once:

- Overlays are injected as children of `<html>`, which React owns on any App
  Router page. `ensureOverlays` installs a MutationObserver that re-attaches them
  if a render pass deletes them, and step 1 waits for hydration before scrolling
  so a remount cannot snap the page back to the top. **A handler that navigates
  mid-take must call `ensureOverlays` again** — the new document replaces
  `<html>` wholesale, taskbar and all. `showWorkingVariant` does this for you.
- Native `window.alert` dialogs are browser chrome, so video capture never sees
  them (and Playwright auto-dismisses them). The Frontend Tools page needs its
  alert visible to prove the handler ran in the browser, so its action installs
  a DOM replica of Chrome's dialog via `core/overlays/alert-dialog.ts`. The same
  reasoning produced the simulated taskbar, Notepad, and the DevTools console.

---

## Troubleshooting

**`Aborting before launching a browser`** — a service is down. The message names
which one and the command to start it. `--force` overrides. Note this backend is
`langgraph dev` on **:8123** answering `/ok`, not a FastAPI app on :8000.

**A page fails with "Agent never produced a response within 30s"** — either the
demo is genuinely broken, or `selectors.config.ts → assistantMessage` does not
match this app's messages. Run `npm run doctor --online` to tell the two apart.
If silence *is* the finding, set `knownIssue.expectsNoResponse` and the run
reports `[ISSUE]` instead.

**Every demo shows an error banner while the backend looks healthy** — the
frontend is forwarding runs to the wrong port. `LANGGRAPH_DEPLOYMENT_URL` in
`frontend/.env.local` has to match the port `langgraph dev` bound.

**The IDE highlights the wrong lines** — the line range drifted. `npm run doctor`
names the file and where its markers actually are now.

**A recording passes but the video is wrong** — the doctor cannot see cursor
placement, highlight correctness, or whether an issue clip actually showed its
issue. Watch it.
