# `ci/` — the recording pipeline

Everything that builds, starts, checks, records and reports on this repo lives
here. The only pieces outside this folder are the workflows under
`.github/workflows/`, because GitHub requires that path.

## Layout

```
ci/
├── automate.mjs          entry point — one process, start to finish
├── build-report.mjs      DOCUMENTED_REPORT.md — the QA report that gets sent on
├── check-doc-drift.mjs   compares doc-snapshot/ against the live docs
├── list-pages.mjs        prints the recorder's page ids
├── validate-pages.mjs    rejects unknown ids before a run starts
├── resolve-selection.mjs expands dispatch checkboxes + ids into a page list
├── run-name.mjs          names the run's artifacts (DeepAgentspy-react-28Aug2026-0527UTC)
├── write-versions.mjs    frontend/VERSIONS.md — what this run actually installed
└── lib/
    ├── config.mjs        paths, ports, URLs
    ├── env.mjs           loads the .env files the services read
    ├── pages.mjs         page ids and dispatch groups, read from the recorder
    ├── preflight.mjs     port, credential and warmup checks
    ├── mux.mjs           voiceover muxing (the only implementation)
    └── report.mjs        RUN_REPORT.md / .json
```

## Commands

| Command | What it does |
|---|---|
| `npm run automate` | Full pipeline: drift → preflight → deps → servers → record → report |
| `npm run automate:issues` | Same, but only the pages with a known defect |
| `npm run automate:pull` | Same, after `git pull` |
| `npm run automate:locked` | Same, but installing the committed lockfiles |
| `npm run report` | Rebuild the QA report from the last run's results |
| `npm run drift` | Doc drift check on its own |
| `npm run drift:sync` | Update `doc-snapshot/` to match live docs |
| `npm run ci:pages` | List valid page ids |

Anything not consumed by `automate.mjs` is forwarded to the recorder:

```bash
node ci/automate.mjs --pages=quickstart,in-app-agent-write
node ci/automate.mjs --pages=issues
node ci/automate.mjs --shard=1/3
node ci/automate.mjs --limit=3 --ignore-doc-drift
```

## Flags

| Flag | Effect |
|---|---|
| `--pull` | `git pull` first |
| `--use-lockfile` | Install the committed lockfiles instead of re-resolving |
| `--skip-install` | Skip dependency installation |
| `--ignore-doc-drift` / `--force` | Record even if the live docs moved |
| `--allow-port-reuse` | Record against servers that are already running |
| `--skip-credential-check` | Skip the model-credential preflight |

## What runs, in order

1. **Doc drift** — compares each `doc-snapshot/pages/*.md` hash against the live
   page. Drift halts the run with exit code 2 unless `--ignore-doc-drift`.
2. **Preflight** — loads the `.env` files, then refuses to continue if a port is
   already held or the model credential is missing/rejected. Both checks are
   cheap and both have cost a full run before.
3. **Dependencies** — `uv sync` for the backend, `npm install` for the frontend
   and recorder.
4. **Servers** — `langgraph dev` and `npm run dev` (runtime + `ng serve`),
   spawned from this process, logging to
   `autorecorder/videos/logs/`.
5. **Health + warmup** — poll until both answer, then compile the heaviest
   routes so the recorder is not racing a cold Turbopack build.
6. **Record** — hand off to the recorder with the forwarded flags.
7. **Mux + report** — always runs, success or failure. Writes `RUN_REPORT.*` and
   `DOCUMENTED_REPORT.md`.

## The three services

Angular has no server route to host the Copilot Runtime the way a Next app does,
so this stack is one process longer than its React twin:

```
browser ──▶ ng serve :4203 ──▶ Copilot Runtime :8203 ──▶ langgraph dev :8123
            (frontend)         (frontend/server.ts)      (backend/main.py)
```

| | Port | Started with | Health |
|---|---|---|---|
| Agent | 8123 | `uv run --with "langgraph-cli[inmem]" langgraph dev --port 8123 --no-browser --no-reload` | `/ok` |
| Copilot Runtime | 8203 | `npm run dev` (with `ng serve`) | `/api/copilotkit/info` |
| Frontend | 4203 | `npm run dev` (with the runtime) | `/` |

The ports are this repo's own. Its shipped defaults — 4200 and 8200 — are both
already held by Agno-angular, and 8200 is additionally MsPy-angular's backend, so
Angular and the runtime moved to 4203/8203. The langgraph dev server keeps 8123,
which nothing else uses.

`npm run dev` inside `frontend/` starts the first two together under
`concurrently`, which is why the pipeline spawns two processes for three
services — and why cleanup kills the whole process tree. Killing only the shell
leaves the runtime and `ng serve` holding 8203 and 4203, and the next run refuses
to start on a busy port.

The backend is the **LangGraph dev server**, which serves every graph declared in
`backend/langgraph.json` — not a FastAPI app, and it has no `/health`.

**Two flags on it are load-bearing:**

- `--no-browser` — without it the CLI opens LangGraph Studio in the default
  browser and steals focus from the window Playwright is recording.
- `--no-reload` — the dev server hot-reloads on any change under the repo, and
  this pipeline writes into the repo while it runs: `frontend/VERSIONS.md` before
  recording, then clips, logs and `RECORD_RESULTS.json` into
  `autorecorder/videos/`. The watcher sees those, reloads repeatedly, and
  eventually exits mid-suite — which surfaces as later pages failing with "the
  agent never replied" and no other clue. This cost a run.

`--with "langgraph-cli[inmem]"` pulls the dev server in without adding it to the
project's dependencies, and keeps the project venv where `deepagents` lives.
`uvx` would build an isolated env holding only the CLI and fail to import the
graph.

Moving the **runtime** port is a two-place edit: `PORT` (read by
`frontend/server.ts`) and `runtimeUrl` in `frontend/src/app/app.config.ts`, which
hardcodes the URL the browser posts to. Miss the second and you get a healthy
runtime that no demo can reach.

## Why one process

Each `run:` step in a GitHub Actions job is a separate subshell. A server
started with `&` in one step is reaped before the next step begins. Spawning
both servers from inside `automate.mjs` keeps them alive for the whole run,
which is why the pipeline is a Node program and not a sequence of YAML steps.

## Page selection

`autorecorder/config/pages.config.ts` is the single source of truth for which
demos exist. `lib/pages.mjs` reads the ids from it, `list-pages.mjs` prints
them, and `validate-pages.mjs` checks a selection against them.

The workflow does **not** restate the list. It used to, in two more places, and
they drifted whenever a page was renamed.

### Choosing pages on a manual run

The dispatch form has a checkbox per **doc section** plus a free-text field for
exact ids. Tick sections, type ids, or both — the two are combined.

| Checkbox | Pages |
|---|---|
| Getting Started | quickstart, chat-ui |
| Generative UI | frontend-tools-generative-ui, a2ui |
| Interaction | voice-multimodal, human-in-the-loop |
| Shared State | shared-state |
| Threads, Memory, Attachments, Headless | threads, memory, attachments, headless |

The last group is one checkbox because those four demos share a single doc page
(`guides/threads-memory-attachments-headless`) — ticking it records that page end
to end, which is how the doc reads.

Nothing ticked and nothing typed means **all pages** — what the nightly schedule
does.

Typing **`issues`** in the free-text field selects every page carrying a
`knownIssue`, resolved from the registry rather than listed anywhere. It is a
keyword and not a seventh checkbox because the form is at GitHub's ten-input
cap — and it earns its place because "re-record the broken ones" is the
selection this repo needs most days.

**Why sections rather than one checkbox per page:** GitHub allows a
`workflow_dispatch` at most **10 inputs**. Five section checkboxes plus four
options is 9, leaving room for exactly one more; a checkbox per page would break
the form the moment the page count passed six, and an invalid form fails every
manual run before a job starts.

The section map lives in `PAGE_GROUPS` in `lib/pages.mjs`, and a run fails if any
page belongs to no section, so nothing can quietly become unreachable.

## Adding a page

1. Add it to `autorecorder/config/pages.config.ts`.
2. Add its id to a section in `PAGE_GROUPS` (`ci/lib/pages.mjs`).

Skipping step 2 fails the run with the page named, rather than silently dropping
it from the form.

## The QA report

`build-report.mjs` writes `DOCUMENTED_REPORT.md` at the **repo root** — the
document that actually gets sent on — from two sources and no third:

- `RECORD_RESULTS*.json`, written by the recorder, for what each page did
- the `knownIssue` object on each broken page, for what is wrong with it

Nothing in it is maintained by hand. A status table kept by hand beside a folder
of videos drifts, and the drift is invisible because both halves still look
right on their own.

**It is built after the shards rejoin, never inside one.** Each shard records a
third of the pages and knows nothing about the other two thirds; a report built
in a shard would list five pages and read as though the other ten had never been
tested. Stage 4 of the workflow exists for this.

A row marked failed is a page on the known-issues list that recorded cleanly.
That is not the same as "the defect was confirmed today" — nothing automated can
establish that. Watch the clip before sending the report.

### One run's results, not an accumulating ledger

`RECORD_RESULTS.json` describes exactly one run and the next run overwrites it.
Sharded CI runs are fine — each worker writes `RECORD_RESULTS-shard-N.json` and
the consolidate job merges all of them — but **locally, re-recording one page
after a full suite leaves only that page's results behind**, and the report built
from it is a complete-looking status table with ten rows missing.

That is the version somebody sends to a manager, so the report prints a
`⚠️ Partial run — N of M pages` banner naming what is not covered whenever the
results do not span the whole registry.

This is deliberately not fixed by accumulating results across runs: a row
asserting last week's outcome beside today's is a worse failure than a short
report. The rule is simply that the report belongs to the run that produced it —
so `npm run record:issues` then `npm run report` gives an honest four-page
report, and a full report needs a full run.

## Which versions get recorded

A run re-resolves its dependencies by default: the lockfiles are dropped and
`npm install` (plus `uv sync --upgrade`) pick the newest versions the ranges in
`package.json` and `pyproject.toml` already allow. `@copilotkit/*` is a caret
range, so a release is recorded the night it ships, and a major version still
cannot arrive without someone editing the manifest.

`--use-lockfile` (dispatch checkbox **Install the committed lockfiles**) opts
back into the committed versions. Reach for it to reproduce an older run, or to
find out whether a break came from the demo or from the tree beneath it.

What no run does is rewrite the ranges. Raising a range is a reviewed edit to
`package.json`, not something a nightly recording run does to itself.

## CI shape

```
                          ┌─ Worker 1/3 ─┐
prepare ──→ versions ──→  ┼─ Worker 2/3 ─┼ ──→ consolidate + QA report
                          └─ Worker 3/3 ─┘
```

## Artifact names

Every artifact is named for the project and the moment the run started:

```
DeepAgentspy-react-28Aug2026-0527UTC             ← consolidated, all clips + report
DeepAgentspy-react-28Aug2026-0527UTC-shard-1     ← one worker's output
```

`prepare` computes the stamp once (`ci/run-name.mjs`) and passes it to the other
jobs, so all four names agree. Change the prefix via `PROJECT_SLUG` in
`lib/config.mjs`.

## Secrets and variables

| Name | Kind | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | secret | Model provider key. The only credential this repo needs. |
| `OPENAI_MODEL` | variable | Model override (default `gpt-4o`), read by `backend/src/shared.py` |

Every graph here runs on an OpenAI model through `langchain-openai`, and there
are no Rich Threads pages, so there is no license token or Intelligence pair to
configure. `LANGSMITH_API_KEY` is only needed against a LangGraph Platform
deployment — a local `langgraph dev` does not check it.

## Troubleshooting

**"Ports already in use"** — a previous run's servers survived. Stop the listed
PIDs, or pass `--allow-port-reuse` to record against them. Do not ignore this:
Windows lets a second process bind a port another is already listening on, and
requests then land on whichever accepts first, so a stale server holding old
environment variables can answer instead of the new one.

**"OPENAI_API_KEY is missing or still the placeholder"** — set a real key in
`backend/.env`. Note the precedence: `backend/.env` is read first, so an
uncommented placeholder there shadows a real key at the root.

**Server died mid-run** — read `autorecorder/videos/logs/backend.log` and
`frontend.log`. They are uploaded with the CI artifacts.

**Recorder aborts on preflight** — the frontend was still compiling. The warmup
step covers the usual routes; a page added to `WARMUP_ROUTES` in `lib/config.mjs`
gets the same treatment.

**The report says "No RECORD_RESULTS*.json found"** — nothing was recorded, or
the run failed before the recorder wrote its results. The recorder writes that
file even when pages fail, so its absence means the run did not get that far.
