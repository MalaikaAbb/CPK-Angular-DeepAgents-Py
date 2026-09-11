# Port notes — what this adaptation owes `core/`

`ADAPT.md` says that if a port appears to need a `core/` change, that is a
**finding to report rather than a change to make quietly**: it means something
framework-specific leaked into shared code, and every other repo using this
folder has the same problem. This file is that report for the
Deep Agents (Python) + Angular port.

Nothing in `core/` was edited. Everything below is a note for whoever owns the
shared suite.

---

## 1. `core/` contains Next.js and React strings

Four places in supposedly framework-agnostic code name a framework this repo
does not use:

| File | Line | What it says |
|---|---|---|
| `core/engine.ts` | ~62 | "…it never reaches Next.js." |
| `core/engine.ts` | ~462 | Logs **"Waiting for Next.js compilation & React hydration to settle…"** on every page |
| `core/overlays/taskbar.ts` | ~76 | "Next.js App Router renders `<html>` itself, so React owns…" |
| `core/overlays/taskbar.ts` | ~124 | "Ensure Next.js dev indicator sits cleanly above the…taskbar" |

The second one is user-visible: every Angular recording prints a line claiming to
wait for Next and React. The behaviour is correct — it is a generic settle wait —
but the message is wrong in three of the repos using this suite, and it is the
line someone reads while debugging a stuck run.

**Suggested fix:** make the label generic ("Waiting for compilation and hydration
to settle"), or take it from `PROJECT.frameworkLabel`.

The taskbar comments are only comments, but the `<html>`-ownership behaviour they
describe is real and not React-specific: Angular hydration reclaims the element
the same way, which is why `ensureOverlays` needs its MutationObserver here too.
The comment should say "the app framework", not "React".

## 2. Two framework-agnostic modules still live in `actions/`

Both arrived from the Angular sibling repos and belong in `core/`:

- **`actions/page-ready.ts`** — the readiness gate. It waits for
  `document.readyState`, a DOM-stability window, an input that is genuinely
  enabled, and `runtimeWarmPath`. It knows nothing about Angular, CopilotKit or
  DeepAgents, and every repo using this suite has the cold-dev-server problem it
  solves. Without it, a prompt typed into an unhydrated input goes nowhere and
  the page fails as "the agent never replied" while looking perfectly fine on
  video.
- **`actions/file-dialog.ts`** — the drawn Windows "Open" dialog. The real one is
  an OS window Playwright suppresses, so any repo filming an upload needs this.

They sit in `actions/` only because `core/` is frozen. `core/issue-note.ts` was
promoted from `actions/notepad.ts` in exactly this way already, so the precedent
exists.

## 3. `ProjectConfig` has no `runtimeWarmPath` in this generation of `core/`

The React generation of `core/` predates it; the Angular generation has it. It is
declared in `config/project.config.ts` here and consumed by
`actions/page-ready.ts`, which works — but it means the field is part of the
adaptation surface in some copies and part of the shared contract in others.

**Suggested fix:** land `runtimeWarmPath` in the shared `ProjectConfig` when
`page-ready.ts` is promoted, since the two go together.

## 4. There is no way to declare "this page has no demo"

`demoUrl` is always `route + demoSuffix`, and the doctor errors on any that is
not 200. A doc route with nothing to drive therefore cannot be registered at all.

This repo is unaffected — all 11 of its recordable routes have a `/demo`, and the
two that do not (`/` and `/doc-sync`) are simply absent from `pages.config.ts`.
But the Angular siblings work around it with `reserve()` placeholder entries
purely to keep clip numbering aligned, which is a workaround for a missing
feature rather than a design.

**Suggested fix:** an optional `demoPath: false` (or `docOnly: true`) on
`PageDefinition`, so a doc-only page can be registered, numbered and recorded as
a doc-plus-IDE clip without a demo step.

## 5. `core/overlays/cursor.ts` has five unguarded `page.evaluate` calls

**This one causes real, intermittent run failures**, and it is the most valuable
finding in this file.

Every virtual-cursor movement drives an unguarded `page.evaluate`:

```
$ grep -c "page.evaluate" core/overlays/cursor.ts   # 5
$ grep -A2 "page.evaluate" core/overlays/cursor.ts | grep -c catch   # 0
```

If the page re-renders or the SPA router navigates while the cursor is gliding —
which is precisely what a tab switch, a launcher opening, or a mis-aimed click on
the demo frame's `← Notes & source` link does — the evaluate throws:

```
Demo step failed: page.evaluate: Execution context was destroyed,
most likely because of a navigation
```

Observed here on the full-suite run of 28 Aug 2026: `chat-ui` reported `[FAIL]`
with exactly that message, then passed unchanged when recorded on its own
(109.3s, all four surfaces). The page is not broken; the cursor overlay is
fragile. A recording is still written either way, so the clip looks fine and only
the summary says otherwise — which is the worst failure mode available, because
it is the one that gets ignored.

Note that `actions/page-ready.ts`, which came from the Angular generation, already
guards its own sampling evaluate with `.catch(() => '')`. Whoever wrote it hit
this class of bug and fixed it in the file they owned. `core/` never was.

**Suggested fix:** `.catch(() => undefined)` on each of the five, or a small
`safeEvaluate` wrapper in `cursor.ts`. A cursor that fails to move for one frame
is cosmetic; a take that dies because of it is not. Pages most exposed are any
whose handler switches tabs or opens a launcher — `chat-ui` and
`frontend-tools-generative-ui` here.

---

## Two generations of this suite are now in circulation

Worth stating plainly, because this port had to merge them:

| | Angular siblings (MsPy/Agno/Mastra) | React siblings (DeepAgents) |
|---|---|---|
| `knownIssue`, `[ISSUE]` outcome | ✗ | ✓ |
| `issue-note.ts`, `caption.ts`, `devtools-console.ts`, `compare.ts` | ✗ | ✓ |
| `ci/build-report.mjs` → `DOCUMENTED_REPORT.md` | ✗ | ✓ |
| `--pages=issues` | ✗ | ✓ |
| `page-ready.ts` readiness gate | ✓ | ✗ |
| `file-dialog.ts` | ✓ | ✗ |
| `manifest.ts` clip freshness tracking | ✓ | ✗ |
| `runtimeWarmPath` in `ProjectConfig` | ✓ | ✗ |

This repo runs the union: the React generation's `core/` plus the Angular
generation's readiness gate, file dialog, manifest and warm path. Neither
generation alone was sufficient — the React one cannot drive a cold Angular dev
server, and the Angular one cannot express a defect as anything but a failure.

Merging the two upstream is the single highest-value change available to this
suite, and this repo is a worked example of what that merge looks like.
