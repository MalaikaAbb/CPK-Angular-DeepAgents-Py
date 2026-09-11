# CopilotKit + DeepAgents — Angular

A navigable test harness for the Angular section of the CopilotKit DeepAgents documentation. Each guide in the sidebar is a route that runs the thing its doc page teaches, rather than restating it.

Tracks **<https://docs.copilotkit.ai/angular/deepagents>**.

| | |
|---|---|
| **Frontend** | Angular 22.1.1 · TypeScript 6.0 · Tailwind 4 · zoneless |
| **CopilotKit** | `@copilotkit/angular` 0.3.1 · `@copilotkit/runtime` 1.67.1 |
| **AG-UI** | `@ag-ui/langgraph` 0.0.42 |
| **Backend** | Python 3.13 · `deepagents` 0.7.5 · `copilotkit` 0.1.94 |
| **Model** | `openai:gpt-4o` |

---

## Architecture

Three processes, not two. Angular has no server route to host the Copilot Runtime, so the runtime is its own Node process sitting between the browser and the agent.

```
Browser (Angular 22, zoneless)  ·  localhost:4203
  │  @copilotkit/angular — provideCopilotKit, <copilot-chat>, signal APIs
  │  POST http://localhost:8203/api/copilotkit
  ▼
Copilot Runtime  ·  localhost:8203          ← Node, frontend/server.ts
  │  agents: { default, support } → new LangGraphAgent({ deploymentUrl, graphId })
  │  a2ui: {}  → A2UIMiddleware
  │  http://localhost:8123 · graph "sample_agent"
  ▼
DeepAgents agent  ·  localhost:8123         ← Python, backend/main.py
  │  create_deep_agent(middleware=[CopilotKitMiddleware()])
  ▼
OpenAI  (gpt-4o)
```

The backend is a **graph, not an HTTP server**. `backend/main.py` exports `agent = create_deep_agent(...)`, and `backend/langgraph.json` publishes it under the graph id `sample_agent`. Serving it is the dev server's job — which is why the runtime binds it with `LangGraphAgent` by `deploymentUrl` + `graphId` rather than by a plain URL.

**Why two agent ids.** `default` and `support` both resolve to the same graph. `default` is what CopilotKit's prebuilt components use with no configuration; `support` exists so the Chat UI and Threads guide snippets — written as `agentId="support"` — run exactly as published.

**The model key never reaches the browser**, and never reaches the runtime either. Only the Python process holds it.

---

## Prerequisites

| Requirement | Version used here | Notes |
|---|---|---|
| Node.js | 24.16.0 | Angular 22 requires `^22.22.3 \|\| ^24.15.0 \|\| >=26` |
| npm | 12.0.1 | |
| Python | 3.13 | pinned in `backend/.python-version` |
| [uv](https://docs.astral.sh/uv/) | 0.11+ | manages the Python env and the dev server |
| OpenAI API key | — | the agent runs `openai:gpt-4o` |

---

## Setup

### 1. Backend

```bash
cd backend
uv sync
```

Create `backend/.env` with your key — `langgraph.json` declares `"env": ".env"`, so the dev server loads it automatically:

```bash
echo "OPENAI_API_KEY=sk-..." > .env
```

### 2. Frontend

```bash
cd frontend
npm install
```

---

## Run

Two terminals. Start the backend first — the runtime resolves the graph on its first request, so order is not strictly enforced, but the chat will not stream until both are up.

**Terminal 1 — the DeepAgents agent, on :8123**

```bash
cd backend
uv run --with "langgraph-cli[inmem]" langgraph dev --port 8123 --no-browser
```

Wait for `🚀 API: http://127.0.0.1:8123`. The `--with` flag pulls in the dev server without adding it to the project's dependencies.

**Terminal 2 — the Copilot Runtime (:8203) and Angular (:4203)**

```bash
cd frontend
npm run dev
```

`npm run dev` runs both under `concurrently`. To run them separately instead:

```bash
npm run runtime   # Copilot Runtime on :8203
npm start         # Angular dev server on :4203
```

Then open **<http://localhost:4203/>**. The Introduction route has a live connection check for both backend processes.

---

## Verify it works

1. **The agent is up** — `curl -i http://localhost:8123/ok` answers 200.
2. **The graph is registered** — this should return one assistant with `"graph_id":"sample_agent"`:
   ```bash
   curl -X POST http://localhost:8123/assistants/search \
     -H 'content-type: application/json' -d '{"graph_id":"sample_agent"}'
   ```
3. **The runtime sees both agents** — `curl http://localhost:8203/api/copilotkit/info` lists `default` and `support`. This is the one check the quickstart's troubleshooting box prescribes.
4. **End to end** — open `/quickstart` and send *Can you tell me a joke?* Tokens should stream in one at a time and render as markdown.

---

## Ports and environment variables

| Port | Process | Started by |
|---|---|---|
| 4203 | Angular dev server | `npm start` |
| 8203 | Copilot Runtime | `npm run runtime` |
| 8123 | DeepAgents agent | `langgraph dev --port 8123` |

| Variable | Read by | Default |
|---|---|---|
| `OPENAI_API_KEY` | `backend/.env` → the agent | — (required) |
| `DEEPAGENTS_DEPLOYMENT_URL` | `frontend/server.ts` | `http://localhost:8123` |
| `DEEPAGENTS_GRAPH_ID` | `frontend/server.ts` | `sample_agent` |
| `PORT` | `frontend/server.ts` | `8203` |

Change the agent's port in both places or the runtime will not find it.

---

## Project layout

```
backend/
  main.py           create_deep_agent(...) → `agent`, plus the getWeather tool
  langgraph.json    publishes ./main.py:agent as the graph "sample_agent"
frontend/
  server.ts         Copilot Runtime — the one file that ties CopilotKit to DeepAgents
  src/app/app.config.ts   provideCopilotKit at the application root
  src/app/features/       one folder per guide; the code the routes display and run
  src/app/pages/          the doc routes themselves
  src/app/lib/nav-config.ts   routes, doc links, and per-route status
  scripts/generate-sources.ts prestart/prebuild step that snapshots source for display
```

Routes render their own source off disk, so what a page shows is byte-identical to what runs. `npm start` and `npm run build` regenerate that snapshot automatically; run `npm run gen:sources` by hand if you edit a feature file while the dev server is up.

---

## Doc drift detection

`/doc-sync` keeps this repo honest about the docs it mirrors. Press **Sync docs now** (on the landing page or on `/doc-sync`) and it fetches the markdown source behind all 9 tracked doc pages, diffs each against the copy stored in `doc-snapshot/`, replaces that copy, and reports what moved — ranked by whether the change can actually break an implementation.

Doc pages are fetched by appending `.md` to their URL, which returns the authored MDX rather than the rendered HTML. Every response is checked for `text/markdown` before it is allowed near the snapshot: a URL that misses the markdown handler still answers `200` with the HTML app shell, and writing that in would destroy the baseline. A run commits all pages or none.

**Severity is decided by where the edit landed**, not how big it was:

| Level | Trigger |
|---|---|
| **High** | a changed line inside a fenced code block, a changed fence count, or a page that now 404s and is gone from the sitemap |
| **Medium** | a changed heading, changed frontmatter `title`/`description`, or prose in the same section as changed code |
| **Low** | other prose |

**Sections checked** lists every tracked page in nav order with a mark — `✓` unchanged, `!` changed, `+` stored, `✗` 404, `~` unstable, `·` not checked. Expanding a row shows the comparison: for a changed page the diff (`−` existing snapshot, `+` newly fetched), and for an unchanged one the two matching hashes, which is the evidence the check ran.

**`doc-snapshot/CHANGELOG.md`** is the record that survives a re-sync. Because syncing replaces the copy it just compared against, the run *after* a change reports nothing — so the changelog is written at the moment of discovery and never rewritten later. Only changed pages are recorded; a clean run does not touch the file. It keeps the three most recent dated entries, counted rather than aged.

**One sync date.** `syncedAt` in `doc-snapshot/manifest.json`, rewritten on every run. There is no hand-maintained date to keep in step with it.

### How it is wired on Angular

Angular has no server-action equivalent, so the boundary is plain HTTP. Everything that fetches docs or touches the snapshot lives in `frontend/src/app/lib/doc-sync/` and is imported **only** from `frontend/src/server.ts`, which exposes two endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /api/doc-sync` | current manifest summary + the latest report |
| `POST /api/doc-sync/run` | runs the sync, returns the result |

They sit on the SSR server rather than the Copilot Runtime because that is the Angular app's own server: `ng serve` routes through it in development (`ssr.entry` in `angular.json`) and it ships in `dist/`, so the button works in both without a second process. The browser half is `DocSyncClient`, a root-provided service holding signals — nothing in the browser bundle imports `node:fs`, which the build verifies by never resolving those modules into `dist/browser`.

**To test it**, edit any `doc-snapshot/pages/*.md` file and press the button — a line inside a code fence for High, a `##` heading for Medium, a sentence for Low. The comparison reads the stored file itself, so nothing else needs changing. Both `/doc-sync` and the changelog label the result as a local snapshot edit rather than upstream drift.

Commit `doc-snapshot/` — `pages/`, `manifest.json` and `CHANGELOG.md` are the baseline every diff is taken against. `reports/` is gitignored.

---

## Troubleshooting

**Nothing streams in the chat.** One of the two backend processes is down. The Introduction route probes both and shows which.

**`EADDRINUSE` on 8203.** Another Copilot Runtime is already listening. Stop it, or start this one on a different port with `PORT=8204 npm run runtime` — and update `runtimeUrl` in `src/app/app.config.ts` to match.

**`Failed to create thread: Invalid thread ID: must be a UUID`.** Only appears when calling the runtime directly with a hand-written thread id. The chat components generate UUIDs themselves.

**Threads and memory routes render a locked or empty state.** Expected. Those endpoints come from the CopilotKit Intelligence Platform; without a license key there is nothing to list. See the per-route status notes.

**Microphone records but transcription fails.** Expected. This runtime has no transcription service configured.

---

## Known gaps

Verified against a live run on **28 Aug 2026** (`@copilotkit/angular` 0.3.1,
`@copilotkit/runtime` 1.67.1, `deepagents` 0.7.5). The frontend moved to
`@copilotkit/angular` 0.4.0 on **30 Aug 2026**; the gaps below were not
re-verified against it, and none of them is in an area 0.4.0 touched. Each is recorded as a video by
`autorecorder/`, and the text below is generated into `DOCUMENTED_REPORT.md` from
the same `knownIssue` objects the clips put on screen — see *Recording and CI*.

- **A2UI is inert, and silently so.** `/info` reports `a2uiEnabled: true`, but
  supplying `a2ui.catalog` is what registers the `render_a2ui` renderer, and the
  guide's catalog snippet is not self-contained. Asking for a surface returns
  prose with **nothing logged** — no error, no catalog request.
  Note this differs from the React/Python build of the same guide, which fails
  loudly with `Catalog not found: https://a2ui.org/.../basic_catalog.json`.
  Tracked on `/a2ui`.
- **Voice transcription fails; image attachments do not.** The microphone
  renders, asks permission and records, but stopping posts a transcription
  request with no service behind it — `/info` reports
  `audioFileTranscriptionEnabled: false`. An image attached to the same composer
  is read correctly, so only the voice half is affected. Tracked on
  `/voice-multimodal`.
- **`CopilotThreadsDrawer` renders nothing.** Not a locked state, not an empty
  state, not an error — nothing. On the same page the hand-built `injectThreads`
  list works: `GET /api/copilotkit/threads` answers 200 with a thread, which
  renders as "Untitled conversation" because the API returns `name: null`.
  Creating a conversation also does not persist (`threadEndpoints.mutations:
  false`). Tracked on `/threads`.
- **Memory's availability gate reports the wrong answer.** `app-memory-list`
  renders nothing at all — not the memories, and not the guide's "Memory is not
  available for this runtime." fallback. Since that fallback is the
  `@if (!isAvailable())` branch, the gate is returning **true**, yet no request
  to any memory endpoint is ever issued. Tracked on `/memory`.
- **The guide's new `registerComponent` section runs, and its snippet is wrong
  four ways.** The guide's new first section, “Let the agent display one of your
  components”, teaches display-only generative UI through `registerComponent` —
  no `handler`, nothing on the agent side. The premise holds: `show_incident` is
  declared by the browser, forwarded over AG-UI, and called by the model with
  the deepagents graph untouched. Implemented verbatim at `@copilotkit/angular`
  0.5.1, the published snippet then fails four ways, all reproduced against a
  live agent:
  (1) **Every call produces a second turn nobody asked for.** With no `handler`,
  core writes an empty tool result and the model is always handed another turn.
  What lands there is model-dependent — a false apology contradicting the card
  on `gpt-4o-mini`, filler on stronger models. `followUp: false` removes it, and
  the guide never mentions `followUp`.
  (2) **The loading guard never fires.** It gates on `status === "in-progress"`;
  the observed status while arguments stream is `"executing"`, so the `@else`
  branch runs with empty args and paints a blank card first.
  (3) **The status never reaches `"complete"`.** Sampled once a second for 25
  seconds: `"executing"` throughout. The `registerRenderToolCall` snippet higher
  up the same page gates on `"complete"`, so that documented pattern applied to
  a display-only tool loads forever.
  (4) **The card is not a card.** No CSS, and an inline `<strong>` beside an
  inline `<span>`, so Angular's default `preserveWhitespaces` strips the gap and
  it renders as `INC-4711sev1`.
  Smaller gaps: the registration fence shows no imports, so `registerComponent`
  and `z` are undefined identifiers as published; the section never says it must
  run in an Angular injection context though the API reference requires one; and
  the `description` you pass reaches the model behind a prepended preamble. The
  same page also contradicts itself: the older “Render a tool result” snippet
  imports `{ type AngularToolCall, type ToolRenderer }` and sets no
  `standalone`, the new one imports both as values and sets `standalone: true` —
  which `frontend/AGENTS.md` forbids. Both are kept as published, at
  `frontend/src/app/features/tools/incident-card.component.ts`.
  *Note, not a finding:* `registerComponent` does not exist in 0.4.0, which this
  repo declared until now, and `^0.4.0` can never reach 0.5.x; the quickstart's
  unpinned install gives a new reader 0.5.1, so the frontend moved to `^0.5.1`
  (and `@copilotkit/runtime` to `^1.70.1`) to QA the section at all.
  Confirmed against the installed package on **4 Sep 2026**. Tracked on
  `/frontend-tools-generative-ui`.
- **`getWeather` argument mismatch.** The agent declares
  `getWeather(location: str)`, but the frontend renderer in
  `src/app/features/tools/` is written against `{ city }`. The tool call still
  runs and the agent still answers — the card can just render with an empty
  heading. Aligning the two names fixes it. Not on the QA report, which scores
  this page as passing.

### Two inconsistencies in this repo, not in CopilotKit

- **`backend/langgraph.json` declares `"python_version": "3.12"`** while
  `pyproject.toml` requires `>=3.13` and `.python-version` pins `3.13`. The field
  only governs containerised builds, so local runs are unaffected — but the three
  should agree. CI installs 3.13.
- **`doc-snapshot/pages/angular__deepagents.md` and
  `…__quickstart.md` are byte-identical.** Either the landing page redirects to
  the quickstart and tracking both is redundant, or one was fetched from the
  wrong URL. Drift is reported against both, so a single upstream edit shows up
  twice.

---

## Recording and CI

`autorecorder/` produces one demo video per doc page; `ci/` builds, starts,
checks and records the whole stack in one process, then turns the result into the
QA report that gets sent on.

```bash
npm run record:doctor:online   # is the configuration sane, against live URLs?
npm run record:list            # what will be recorded
npm run record -- --a2ui       # one page
npm run record:issues          # only the pages with a known defect
npm run automate               # the full pipeline: drift → preflight → deps → servers → record
npm run report                 # DOCUMENTED_REPORT.md, from the run's own results
```

The recorder refuses to start unless all three services are up. Start them with
the commands in *Run* above — and note that the backend needs **`--no-reload`**:
`langgraph dev` watches the repo, the pipeline writes into the repo while it
runs, and the resulting reload loop kills the server mid-suite.

**Known issues are not failures.** A page carrying a `knownIssue` in
`autorecorder/config/pages.config.ts` records as `[ISSUE]` and the run still
exits 0 — a pipeline that is red every night for four documented defects is a
pipeline nobody reads. What still fails the run is a route that 404s, a demo that
renders no chat surface, or an IDE view that cannot be built: those are breaks in
this repo rather than in the thing under test.

The clips are gitignored — they are build output, ~5MB each and rewritten on
every run. `npm run manifest` writes `videos/manifest.json` and `MANIFEST.md`,
which *are* committed and are the record of which clips are current.

**The report belongs to the run that produced it.** `RECORD_RESULTS.json`
describes one run and the next overwrites it, so re-recording a single page after
a full suite leaves only that page's results behind. `DOCUMENTED_REPORT.md` prints
a `⚠️ Partial run — N of M pages` banner when that happens, naming what is not
covered — but the habit to keep is: full run before a full report.
