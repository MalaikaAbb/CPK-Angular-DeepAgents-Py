# ADAPT.md — porting this recorder to another CopilotKit integration

**Read this file before changing anything. Follow it in order.**

You are adapting a working screen-recording suite from one CopilotKit
integration to another. It currently records **Deep Agents (Python) +
Angular**. The target might be `ms-agent-dotnet`, `agno`, `langgraph`,
an Angular frontend, or anything else CopilotKit documents.

The suite arrives **working**. You are editing a reference implementation, not
filling in blanks. If you find yourself writing a file from scratch, stop and
re-read this.

---

## Definition of done

```bash
npm run doctor          # static: config, files, line ranges, handlers
npm run doctor:online   # also: every demo route, every doc URL, the selectors
npm run record -- --<first-page-id>
```

`doctor` must exit **0**. Then one real recording must report `[PASS]` and the
video must be watchable.

Nothing else counts as finished. Not "the config looks right" — the doctor
exiting zero. If you cannot make it pass, say so and say which check fails;
do not describe the port as complete.

---

## What you may edit

| Path | Edit? | What it is |
|---|---|---|
| `config/project.config.ts` | **Yes** | Framework slug, doc root, URLs, start commands |
| `config/pages.config.ts` | **Yes** | One entry per doc page |
| `config/selectors.config.ts` | **Yes** | How to find the chat surface in this frontend |
| `actions/*.action.ts` | **Yes** | What to do on a page that needs more than "send a prompt" |
| `actions/index.ts` | **Yes** | Which handler serves which page id |
| `core/**` | **No** | Engine, IDE simulator, overlays, cursor, doctor, defect helpers |
| `cli.ts` | **No** | Argument parsing and the run summary |

**Do not edit `core/`.** It contains no framework-specific knowledge — every
such value already comes from `config/`. If you believe a change to `core/` is
required, that is a finding to report, not a change to make quietly: it means
something framework-specific leaked into shared code, and every other repo using
this folder has the same problem.

---

## Step 1 — Identity

Edit `config/project.config.ts`. Every field has a comment saying what it is.

The one to get right is `framework`: the slug exactly as it appears in
`https://docs.copilotkit.ai/<framework>/...`. Doc URLs are built from it, so a
wrong slug silently records the wrong framework's documentation.

`videoPrefix` should identify both sides of the integration — `MSPY-react`,
`MSNET-react`, `AGNO-angular` — because these files end up in one folder
together.

If the backend is not Python, `backendStartCmd` and `backendHealthPath` change.
They are only ever printed or fetched; nothing parses them.

## Step 2 — Fetch the real doc nav

Do not copy the page list from another repo, and do not work from memory. Fetch
`https://docs.copilotkit.ai/<framework>` and read its sidebar.

Frameworks share most pages — quickstart, prebuilt components, slots, headless
UI, generative UI, shared state — but not all. Some lack pages the reference has;
some have pages it does not. A page that 404s is a finding worth reporting, not
something to quietly keep.

## Step 3 — The page registry

Edit `config/pages.config.ts`: delete pages this framework does not document,
add the ones it does, and put them in doc-nav order — order determines the number
in each video filename.

Entries are short because URLs and filenames are derived. Set `docPath` and
`route`; never write a full URL.

`startLine`/`endLine` are what the simulated IDE highlights, and they are the
thing most likely to be wrong after a port. Open each `ideFile` and read the
range. If the frontend marks its interesting lines with `[!code highlight]` or
`#region`, keep those markers — the doctor uses them to detect drift later.

## Step 4 — The selector contract

Edit `config/selectors.config.ts`.

If the target frontend is React using CopilotKit's prebuilt components, the
defaults likely work unchanged. **If it is Angular, or the app renders its own
chat, they will not.** Open a demo page, inspect the real chat input, submit
control and assistant message, and write selectors that match those and nothing
else.

`assistantMessage` is the one to be careful with. It drives both "has the reply
started" and "has it finished". If it matches a container rather than individual
messages, every reply looks complete the instant it begins, and the videos show
prompts with no answers.

`npm run doctor:online` reports which selectors match nothing on a live page.

## Step 5 — The actions

Most pages need nothing: with no entry in `ACTION_MAP` they get
`runStandardAction`, which types the prompt, submits, and waits for the reply.

Write a handler only for pages that need more — switching tabs, clicking an
approval button, opening a panel. Copy the closest existing handler and build on
the helpers in `core/actions.ts` rather than re-implementing them:

```ts
const msgCount = await sendPrompt(page, config.prompt);
await waitForAgentResponseCompletion(page, config.waitAfterPromptMs ?? 4000, msgCount);
```

Pass that count through on multi-turn pages, or the previous turn's reply is
mistaken for this one's.

A handler's fourth argument, `ctx`, is how it reports what it saw. Use it
instead of `console.warn`, which reaches nobody:

```ts
export const runSharedStateReadAction: PageActionHandler = async (page, config, _rootPath, ctx) => {
  ...
  if (!toggleVisible) ctx.fail('"Toggle Language" button never rendered'); // [FAIL], clip still saved
  if (followed) ctx.warn('the panel followed the agent -- the documented defect did not reproduce'); // note on the result
};
```

`ctx.timeouts` carries the resolved waits for the page (see `core/timeouts.ts`;
override per project in `project.config.ts` or per page with `timeouts`).

Delete handlers for pages that no longer exist. The doctor warns about orphans.


## Step 5b — Pages that are *supposed* to be broken

Skip this unless the repo you are porting into tracks defects as well as
features. This one does: five of its pages are on a QA report as broken, and
their clips exist to show that.

A page declares its defect in `pages.config.ts`:

```ts
knownIssue: { area, problem, impact, likelyCause, expectsNoResponse? }
```

Three consequences, and it is worth knowing all three before adding one:

1. The run reports `[ISSUE]` rather than `[PASS]`, and does **not** set a
   non-zero exit code. Documented defects must not turn a nightly pipeline red;
   a pipeline that is red every night is one nobody reads.
2. `writeIssueNote()` types the four fields into a simulated Notepad at the end
   of the take, over the still-visible failure.
3. Anything downstream — here, `ci/build-report.mjs` — renders the same object
   into the report that gets sent on.

`[ISSUE]` means "this page is on the known-issues list and recorded cleanly". It
does **not** mean the defect was confirmed today: the recorder cannot judge
that, and the summary says so. Watch the clip.

The doctor enforces two things. Every field must be non-empty, because each one
lands verbatim in a document someone sends to their manager. And the page must
have an action handler — a `knownIssue` page falling through to
`runStandardAction` would be labelled `[ISSUE]` and show no issue, which is the
one outcome worse than not recording it.

**Delete a `knownIssue` in the same change that confirms the fix.** A stale one
keeps asserting a bug that is gone, and nothing can detect that for you.

### Filming an absence

Most defects are an absence — a label that does not update, a list that stays
empty, a surface that never draws. On video an empty panel beside a working chat
is indistinguishable from a page nobody has asked anything yet. Four helpers
exist for this, all in `core/`:

| Helper | What it is for |
|---|---|
| `showCaption()` | These clips have no voice track. A claim the screen cannot make on its own has nowhere else to go. |
| `showWorkingVariant()` | The same page against code that works — the only thing that answers "was the demo just wired up wrong?" |
| `openDevTools()` | Failures that exist only in the console, which renders no error state on the page at all. |
| `writeIssueNote()` | The report itself, with a tested-context block read from the tree that ran. |

`showWorkingVariant` needs something to compare against. Where the fix is known,
carry **paired routes**: the doc's code verbatim, and a sibling differing by
exactly the omitted line. Only pair where the fix is genuinely known — a "fixed"
route that quietly does something else is worse evidence than no pair. Where
there is no known fix, contrast against a sibling that already works.

---

## Step 6 — Prove it

```bash
npm run doctor:online
npm run record -- --<first-page-id>
```

Then **watch the video**. The doctor cannot tell you the cursor rested somewhere
useless or the IDE highlighted the wrong function. Check: the doc page scrolls
and the taskbar is visible; the IDE shows the code the page is about; the demo
gets a real answer.

Then record the rest.

---

## Things that will bite you

**A page that never answers now fails the run.** That is deliberate — it used to
report `[PASS]`. If a page fails this way, the demo is broken or
`assistantMessage` does not match; both are real findings.

**Pages that replace the message view.** A page that swaps in a custom message
component renders none of CopilotKit's classes, so detection finds nothing and
reports "agent never responded" on a page that works. Pass a per-page selector
instead of widening the global one:

```ts
await sendPrompt(page, prompt, { messageSelector: '.my-custom-bubble' });
await waitForAgentResponseCompletion(page, wait, msgCount, '.my-custom-bubble');
```

`actions/slots.action.ts` does exactly this for its level-3 tab.

**Controls underneath the taskbar overlay.** The simulated taskbar occupies the
bottom 48px and swallows clicks. A send button sitting there never receives the
click; the submit lands via the Enter fallback instead. Harmless, but do not
spend an afternoon on why a click "did nothing".

**Line ranges drift silently.** Nothing errors when a range points at the wrong
code — the video just shows the wrong thing. Re-run `npm run doctor` after
touching the frontend.

**Not every page can use the shared helper.** One page in the reference
(`headless-ui`) is deliberately left on its own implementation because routing it
through `sendPrompt` broke it. If a page misbehaves only after you "tidied" it,
put it back and leave a comment saying why.

---

## Reporting back

When you finish, state:

- which pages you added, removed, or renumbered, and why
- any doc page that 404s or is missing from the nav for this framework
- which selectors you had to change
- any page whose recording fails, and the doctor output for it
- anything that made you want to edit `core/`

A port that silently drops pages to make the doctor pass is worse than one that
reports three failures honestly.
