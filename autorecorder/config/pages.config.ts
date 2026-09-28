/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ADAPT THIS FILE — 3 of 3
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * One entry per doc page, in the order the doc nav lists them.
 *
 * Entries are deliberately short. `docUrl`, `demoUrl` and the output filename
 * are derived from `project.config.ts` plus the fields below, so no entry can
 * point at the wrong framework's docs and filenames stay in nav order without
 * anyone numbering them by hand.
 *
 * Everything here mirrors `frontend/src/app/lib/nav-config.ts`, the app's own
 * source of truth for route -> doc-page mapping. `docPath` is that file's
 * `docPath` minus its leading `/angular/deepagents`. Four routes (threads,
 * memory, attachments, headless) repeat one `docPath` because the Angular docs
 * cover all four topics on a single page — that is the doc's shape, not a
 * copy/paste slip.
 *
 * ── Scope ──────────────────────────────────────────────────────────────────
 * `route` + `demoSuffix` is the only demo URL a page can have, and the doctor
 * errors on any that is not 200. The app's nav lists 13 routes; `/` (the
 * landing page) and `/doc-sync` have no `hasDemo`, and `/status` is app
 * furniture rather than a doc page. The other 11 are all here.
 *
 * The numbering that results — a2ui at 04, memory at 09 — is the same
 * numbering the Angular sibling repos reserve empty slots for, so a
 * DAPY-angular clip and its MSPY-angular counterpart carry the same index for
 * the same guide. Do not reorder without checking those.
 *
 * `inspector` is the one entry deliberately out of nav order. The doc nav puts
 * it in Getting Started, right after the quickstart step that links to it, and
 * `frontend/src/app/lib/nav-config.ts` places it there. Here it is last,
 * because slotting it in at position 3 would renumber every clip after it and
 * break that cross-repo index agreement for a page the siblings have no
 * counterpart for. Order in this file only decides a filename index.
 *
 * ── The line ranges ────────────────────────────────────────────────────────
 * `startLine`/`endLine` are what the simulated IDE highlights. Unlike the
 * sibling Angular repos, this frontend brackets nothing: there are no
 * `[!code highlight]`, `#region`, or `// <topic> : <snippet> start|end`
 * markers anywhere under `src/app/features/`. Every range below was therefore
 * read off the file by hand, and `npm run doctor` can only prove a range is
 * in-bounds — not that it still frames the code the page is about.
 *
 * **Re-read them after editing any feature component.** Teaching the doctor a
 * marker syntax would restore the guard, but this repo would have to grow the
 * markers first.
 *
 * ── `knownIssue` ───────────────────────────────────────────────────────────
 * This repo is not only documenting an integration that works. Four of the
 * pages below are on the QA report as broken, and their clips exist to show
 * that. `knownIssue` is what makes the run say `[ISSUE]` rather than `[PASS]`,
 * and it is the same object that lands in RECORD_RESULTS.json and the QA
 * report — so the sentence typed on screen and the row that goes to the
 * manager are one string, written here, once.
 *
 * A page whose defect gets fixed upstream should have its `knownIssue` deleted
 * in the same change that confirms the fix. Leaving a stale one behind is
 * worse than having none: the clip keeps asserting a bug that is gone.
 */

import { definePages } from '../core/types';

export const PAGES = definePages([
  // ── Getting Started ──────────────────────────────────────────────────────
  {
    id: 'quickstart',
    name: 'Quickstart',
    videoName: 'Quickstart',
    docPath: 'quickstart',
    route: 'quickstart',
    // Leads with the versions, not the manifest. package.json declares RANGES,
    // so a clip of it shows a floor while the run it documents has installed
    // something newer. VERSIONS.md is generated after install
    // (autorecorder/scripts/write-versions.mjs, run by `npm run doctor`) and
    // names what actually resolved.
    ideFile: 'frontend/VERSIONS.md',
    startLine: 1,
    endLine: 16,
    // Then the path itself, in the order a request travels it: the manifest a
    // reader would copy, the chat component, the Node process hosting the
    // runtime (Angular has no server route to host it in), and the graph it
    // proxies to.
    extraTabs: [
      // The `dependencies` block: @copilotkit/angular, @copilotkit/runtime and
      // @ag-ui/langgraph legible in one frame.
      { filePath: 'frontend/package.json', startLine: 19, endLine: 37 },
      { filePath: 'frontend/src/app/features/quickstart/quickstart-chat.ts', startLine: 8, endLine: 20 },
      // The LangGraphAgent bindings and the a2ui middleware switch.
      { filePath: 'frontend/server.ts', startLine: 24, endLine: 47 },
      // The graph itself — 12 lines, so the whole file.
      { filePath: 'backend/main.py', startLine: 1, endLine: 12 },
    ],
    prompt: 'Hey, are you connected? Tell me a quick fun fact about kites.',
    waitAfterPromptMs: 4000,
  },

  // ── Guides ───────────────────────────────────────────────────────────────
  {
    id: 'chat-ui',
    name: 'Guides - Chat UI and customization',
    videoName: 'ChatUi',
    docPath: 'guides/chat-ui',
    route: 'chat-ui',
    // The surface switch: which of the four chats is mounted.
    ideFile: 'frontend/src/app/features/chat-ui/chat-ui-demo.component.ts',
    startLine: 57,
    endLine: 69,
    // The replaced assistant message is the guide's actual lesson; the wrapper
    // above only chooses which surface is mounted.
    extraTabs: [
      {
        filePath: 'frontend/src/app/features/chat-ui/custom-assistant-message.component.ts',
        startLine: 13,
        endLine: 25,
      },
    ],
    // Four surfaces, driven in order by the handler: inline, custom assistant
    // message, popup, sidebar. Only the first two take a prompt.
    prompt: 'In two sentences, what does CopilotKit do?',
    prompts: [
      'In two sentences, what does CopilotKit do?',
      'Nice layout. What is different about how you are rendered here?',
    ],
    waitAfterPromptMs: 4000,
  },
  {
    id: 'frontend-tools-generative-ui',
    name: 'Guides - Frontend tools and generative UI',
    videoName: 'FrontendToolsGenerativeUi',
    docPath: 'guides/frontend-tools-generative-ui',
    route: 'frontend-tools-generative-ui',
    // The class is the lesson, and it now holds all three of the guide's
    // generative-UI paths, all three live: `registerRenderToolCall` for the
    // server-side tool, `registerFrontendTool` for the browser-side one, and
    // `registerComponent` for the display-only path. Re-counted after that
    // third call replaced its commented-out stand-in; lines 55-77 of 78.
    ideFile: 'frontend/src/app/features/tools/tools-chat.component.ts',
    startLine: 55,
    endLine: 77,
    extraTabs: [
      // The new first section's renderer, verbatim. Its
      // `@if (call.status === "in-progress")` guard is the second finding on
      // camera: the real status is "executing", so the guard never fires and
      // the @else branch paints an empty card until the args land.
      { filePath: 'frontend/src/app/features/tools/incident-card.component.ts', startLine: 10, endLine: 27 },
      { filePath: 'frontend/src/app/features/tools/weather-card.component.ts', startLine: 10, endLine: 27 },
      // The other half of the pair: getWeather runs in the DeepAgents graph and
      // the browser only renders the call.
      //
      // Worth watching on the clip: the graph declares `getWeather(location)`
      // while the renderer above binds `call.args.city`, so the card can render
      // with an empty heading even though the agent answers correctly. The QA
      // report scores that behaviour as passing and records no symptom for it,
      // so the `knownIssue` below is not about it — but if the card looks wrong
      // on the video, this is why, and it is worth re-testing deliberately.
      { filePath: 'backend/main.py', startLine: 4, endLine: 12 },
    ],
    // Three turns: a server-side tool the browser only renders, a frontend tool
    // whose result is the page itself repainting, and the new display-only
    // registration — which draws the right card and then earns a second turn
    // nobody asked for.
    prompt: 'Check the weather in Tokyo for me.',
    prompts: [
      'Check the weather in Tokyo for me.',
      'Could you change the background to violet?',
      'Pull up incident INC-4711 for me. It is a sev1.',
    ],
    waitAfterPromptMs: 4000,
    // Confirmed 4 Sep 2026 against the installed package and on camera: the
    // third turn draws the card and then the spurious follow-up beneath it.
    knownIssue: {
      area: 'Deep Agents (Angular) - Guides - Frontend tools and generative UI',
      problem:
        'The page’s new first section, “Let the agent display one of your components”, runs — and its ' +
        'published snippet is wrong four ways. (1) It carries no `handler`, so core writes an empty tool ' +
        'result and the model is always handed a second turn nobody asked for; what lands there is ' +
        'model-dependent, a false apology contradicting the card on gpt-5.4-mini and filler on stronger ' +
        'models. (2) It guards on `status === "in-progress"`, but the status observed while arguments ' +
        'stream is `"executing"`, so the guard never fires and the `@else` branch paints an empty card ' +
        'first. (3) The status never reaches `"complete"` at all — sampled once a second for 25 seconds. ' +
        '(4) It ships no CSS and pairs an inline `<strong>` with an inline `<span>`, so Angular’s default ' +
        '`preserveWhitespaces` strips the gap and the “card” renders as `INC-4711sev1`.',
      impact:
        'Following the section exactly gives you a card that flashes blank, never completes, is not styled ' +
        'as a card, and is followed by a message the author never asked for. Finding 3 is the sharpest: the ' +
        '`registerRenderToolCall` snippet higher up this same page gates its content on `"complete"`, and ' +
        'the prose above it states the status “moves through in-progress, executing, and complete” — so ' +
        'applying the page’s own documented pattern to a display-only tool renders the loading branch ' +
        'forever. Smaller gaps compound it: the registration fence shows no imports, the section never ' +
        'states the injection-context requirement its API reference imposes, and the `description` written ' +
        'by the caller reaches the model behind a preamble core prepends.',
      likelyCause:
        'The section was written against the API and never run end to end against a model. `followUp: false` ' +
        'exists on `RegisterComponentConfig` and removes the spurious turn, but the guide never mentions it. ' +
        'The status-lifecycle prose was carried over from the handler-bearing paths, where in-progress and ' +
        'complete do occur, without rechecking it against a display-only registration that has no execution ' +
        'phase to complete. The page also contradicts itself on the same subject: the older “Render a tool ' +
        'result” snippet imports `{ type AngularToolCall, type ToolRenderer }` and sets no `standalone`, ' +
        'while the new snippet imports both as values and sets `standalone: true` — two renderers, one ' +
        'page, two conventions.',
    },
  },
  {
    id: 'voice-multimodal',
    name: 'Guides - Voice and multimodal input',
    videoName: 'VoiceMultimodal',
    docPath: 'guides/voice-multimodal',
    route: 'voice-multimodal',
    // The guide's `MULTIMODAL_ATTACHMENTS` config bound to the chat. The
    // microphone control itself needs no option — it is always present, which
    // is exactly why its failure is not a configuration mistake.
    ideFile: 'frontend/src/app/features/media/voice-chat.component.ts',
    startLine: 9,
    endLine: 25,
    // The guide's walkthrough is attach-then-microphone, so the clip does both.
    // The prompt asks for values that exist only inside the attached chart, so
    // the reply is evidence the file reached the model rather than something
    // answerable from the system prompt. The microphone then records, and this
    // runtime configures no transcription service, so transcription fails by
    // design — the handler shows that and says so.
    prompt: 'Have a look at the chart I attached. What is it titled, and what does Q4 come to?',
    waitAfterPromptMs: 4000,
    knownIssue: {
      area: 'Deep Agents (Angular) - Guides - Voice and multimodal input',
      problem:
        'The microphone control renders, requests permission and records, but the audio is never transcribed: ' +
        'stopping the recording posts a transcription request that fails, and nothing is placed in the composer. ' +
        'Image attachments on the same composer are read correctly, so the multimodal half of the guide works ' +
        'and only the voice half does not.',
      impact:
        'Voice input is unusable. The control gives every visual signal of working — permission prompt, ' +
        'recording state, elapsed timer — and then silently produces no text, so a user has no indication that ' +
        'the feature is not wired up rather than mishearing them.',
      likelyCause:
        'This Copilot Runtime configures no transcription service. `frontend/server.ts` constructs ' +
        'CopilotRuntime with agents and `a2ui` only, so the transcribe endpoint the composer posts to has ' +
        'nothing behind it.',
    },
  },
  {
    id: 'human-in-the-loop',
    name: 'Guides - Human-in-the-loop and interrupts',
    videoName: 'HumanInTheLoop',
    docPath: 'guides/human-in-the-loop',
    route: 'human-in-the-loop',
    // The registration is the lesson; the card is what the viewer clicks.
    ideFile: 'frontend/src/app/features/hitl/approval-tools.service.ts',
    startLine: 13,
    endLine: 26,
    extraTabs: [
      { filePath: 'frontend/src/app/features/hitl/approval-card.component.ts', startLine: 16, endLine: 39 },
      // The other half of the page: the store interrupt controller 0.4.0 added.
      // The range ends on `injectAgentStore('default')`, the one line that
      // departs from the published snippet -- the guide's `"ticketing"` names
      // an agent these docs never define.
      {
        filePath: 'frontend/src/app/features/hitl/store-interrupt-panel.component.ts',
        startLine: 30,
        endLine: 48,
      },
    ],
    // Whether this page pauses is the model's decision, so the prompt is the
    // whole reliability story -- see actions/hitl.action.ts.
    //
    // Turn 1 asks for something this agent could plausibly do. The previous
    // wording ("please delete my account") asked for a capability it does not
    // have, so the natural answer was a refusal, not a tool call, and the card
    // appeared only some of the time.
    //
    // Turn 2 names the tool, and is sent only when turn 1 produced no card.
    // Needing it is a finding, not a fix: the action reports it.
    prompt:
      'Email the research summary to dana@example.com, but check with me before it goes out.',
    prompts: [
      'Email the research summary to dana@example.com, but check with me before it goes out.',
      'Use your approval tool to confirm with me first, then send it.',
    ],
    waitAfterPromptMs: 4000,
  },
  {
    id: 'shared-state',
    name: 'Guides - Shared state and agent context',
    videoName: 'SharedState',
    docPath: 'guides/shared-state',
    // `injectAgentStore` read through `state()`, written through
    // `agent.setState` — both halves in one frame.
    ideFile: 'frontend/src/app/features/shared-state/workspace.component.ts',
    route: 'shared-state',
    startLine: 37,
    endLine: 48,
    extraTabs: [
      // The other way to publish context: read-only, via connectAgentContext.
      {
        filePath: 'frontend/src/app/features/shared-state/account-context.component.ts',
        startLine: 18,
        endLine: 31,
      },
    ],
    // Read the state, change it from the UI, read it again, then prove the
    // read-only context channel independently.
    prompt: 'What is the priority set to right now?',
    prompts: [
      'What is the priority set to right now?',
      'And now? What is the priority?',
      'Which timezone am I on?',
    ],
    waitAfterPromptMs: 4000,
    // Observed 31 Aug 2026 against @copilotkit/angular 0.4.0 / runtime 1.67.1,
    // by reading the POST body the browser sends to /api/copilotkit.
    knownIssue: {
      area: 'Deep Agents (Angular) - Guides - Shared state and agent context',
      problem:
        'Neither shared state nor agent context reaches the model. Setting priority through ' +
        '`agent.setState` updates the store and the UI renders "Priority: high", and the account panel ' +
        'publishes a timezone through `connectAgentContext` exactly as the guide writes it. Asking the agent ' +
        '"what is priority set as?" returns a request for clarification, and "what is my timezone?" returns ' +
        '"I do not have access to your location or timezone".',
      impact:
        'The whole page is unusable as documented: both halves of the guide -- read/write shared state and ' +
        'read-only context -- appear to work in the browser while the agent is blind to them. Nothing errors, ' +
        'so a reader gets a UI that updates correctly and an agent that silently ignores it.',
      likelyCause:
        'Not the frontend. The run input the browser POSTs to /api/copilotkit already carries both: ' +
        '`state: {"priority":"high"}` and `context: [{"description":"Current account and timezone", ' +
        '"value":"{\\"userName\\":\\"Ada\\",\\"timezone\\":\\"America/Los_Angeles\\"}"}]`. ' +
        'So `agent.setState` and `connectAgentContext` both do their job. The loss is server-side: ' +
        '`backend/main.py` builds the agent with `create_deep_agent(..., middleware=[CopilotKitMiddleware()])`, ' +
        'which is what should surface those fields to the model, and the model still never sees them. Either ' +
        'the middleware does not fold context/state into the prompt for a DeepAgents graph, or the Angular ' +
        'guide omits a step that puts them there.',
    },
  },

  // ── Threads, memory, attachments, headless ───────────────────────────────
  {
    id: 'threads',
    name: 'Threads',
    videoName: 'Threads',
    docPath: 'guides/threads-memory-attachments-headless',
    route: 'threads',
    ideFile: 'frontend/src/app/features/threads/thread-list.component.ts',
    startLine: 8,
    endLine: 39,
    extraTabs: [
      // The drop-in half of the guide: CopilotThreadsDrawer beside a chat,
      // under one provideCopilotChatConfiguration.
      { filePath: 'frontend/src/app/features/threads/conversations.component.ts', startLine: 7, endLine: 23 },
      { filePath: 'frontend/src/app/features/threads/threads-demo.component.ts', startLine: 24, endLine: 47 },
    ],
    prompt: 'In one line, what are threads for?',
    waitAfterPromptMs: 4000,
    // Re-observed 16 Sep 2026, after the runtime started passing `intelligence`.
    // The 28 Aug finding (empty drawer, `mutations: false`, null names) no longer
    // holds: frames from the recorded clip show the drawer listing named threads,
    // and the runtime reports `mode: "intelligence"` with mutations enabled. What
    // remains is that none of this works until a step the guide never mentions.
    knownIssue: {
      area: 'Deep Agents (Angular) - Threads, memory, attachments, headless - Threads',
      problem:
        'The guide presents `injectThreads` and `CopilotThreadsDrawer` as drop-ins and never states that ' +
        'both depend on CopilotKit Intelligence. Until `CopilotRuntime` is given an `intelligence` client ' +
        '(a `CopilotKitIntelligence` built from a project API key), the runtime runs in SSE mode with ' +
        '`threadEndpoints.mutations: false`, so no thread can be created, renamed or kept. The wiring is ' +
        'documented on /angular/deepagents/intelligence/connect-your-runtime, which this guide never links. ' +
        'Separately, the custom list in the guide emits bare `<button>` elements with no wrapper, so ' +
        '"New conversation" and every thread name render run together on one line.',
      impact:
        'A reader who follows this guide alone gets thread surfaces that never persist a conversation, with ' +
        'no error, licence message or pointer to the missing step. Once wired, both surfaces work. The ' +
        'published custom list is unreadable as soon as more than one thread exists.',
      likelyCause:
        'An unstated prerequisite: thread storage is an Intelligence feature, and the guide was written as if ' +
        'the runtime from the quickstart already provided it. The snippet on that page is Next.js-only ' +
        '(`app/api/copilotkit/[[...slug]]/route.ts`, exporting one handler as `GET`, `POST`, `PATCH` and ' +
        '`DELETE`), so an Angular reader must also adapt it to ' +
        '`createCopilotNodeListener`. The run-together list is the published markup, unstyled.',
    },
  },
  {
    id: 'headless',
    name: 'Headless UI',
    videoName: 'HeadlessUi',
    docPath: 'guides/threads-memory-attachments-headless',
    route: 'headless',
    // No CopilotKit chrome at all: transcript and composer hand-written over
    // injectAgentStore, run driven through CopilotKitCore.runAgent.
    ideFile: 'frontend/src/app/features/headless/headless-chat.component.ts',
    startLine: 10,
    endLine: 60,
    prompt: 'Tell me a short joke about Angular developers.',
    waitAfterPromptMs: 4000,
  },
  {
    id: 'inspector',
    name: 'Inspector',
    videoName: 'Inspector',
    docPath: 'inspector',
    route: 'inspector',
    // The subject of this page is code that is NOT here: the framework mounts
    // cpk-web-inspector itself, so the harness must contain no Inspector
    // mount at all. The probe is what makes that absence visible on camera --
    // it counts the elements in the document and names which case it found.
    ideFile: 'frontend/src/app/features/inspector/inspector-probe.component.ts',
    startLine: 116,
    endLine: 122,
    extraTabs: [
      // enableInspector is the only switch the page documents, and this
      // provider block deliberately does not set it -- the default-on
      // development behaviour is the state the guide describes.
      { filePath: 'frontend/src/app/app.config.ts', startLine: 44, endLine: 66 },
    ],
    // The quickstart's Inspector step is not satisfied by a static panel: it
    // asks the reader to send a message and watch AG-UI events move.
    prompt: 'Say hi! I want to watch the events go by in the inspector.',
    waitAfterPromptMs: 4000,
    // Observed 30 Aug 2026 against @copilotkit/angular 0.4.0.
    // Not a defect in the Inspector itself -- it works, and the framework does
    // mount it. The gap is in what the page says is sufficient to get it.
  },
  // ── Findings clips ───────────────────────────────────────────────────────
  // Not a doc-nav page: a findings clip that compiles the A2UI guide's code
  // verbatim (FINDINGS.md minor note #1). Last so no other clip renumbers.
  // The engine intro shows the doc and the WORKING code, and `route` is the
  // working demo (the engine needs `chatReady` there before the handler runs).
  // The handler (actions/compile-demos.action.ts) then plays the take: doc
  // snippets, the verbatim file in the IDE, the real `ng serve` error, and
  // typed notes. No prompt is sent; `prompt` only satisfies the registry
  // contract.
  {
    id: 'a2ui-compile',
    name: 'A2UI - Undefined names (#1)',
    videoName: 'A2uiUndefinedNames',
    docPath: 'guides/a2ui',
    route: 'a2ui',
    // `a2ui` with recovery and no catalog: what the harness can do from the guide.
    ideFile: 'frontend/src/app/app.config.ts',
    startLine: 54,
    endLine: 56,
    extraTabs: [
      { filePath: 'frontend/src/app/features/a2ui/a2ui-chat.component.ts', startLine: 1, endLine: 22 },
    ],
    prompt: 'No prompt: this take compiles the guide code (see actions/compile-demos.action.ts).',
    knownIssue: {
      area: 'Deep Agents - Guides - A2UI schemas, styling, and recovery',
      problem:
        "The guide's three TypeScript blocks do not compile: they have no imports and reference " +
        '`dynamicString`, `productCatalog`, `beautifulCatalog`, `declarativeCatalog` and `fixedCatalog`, ' +
        'none of which the page defines. `ng build --configuration doc-a2ui` reports 22 TS2304 errors.',
      impact:
        'A reader cannot build a catalog from the page, and without a catalog A2UI never renders. ' +
        '`ng serve` type-checks, so the copied code stops the dev server from starting.',
      likelyCause:
        'The snippets were lifted from the Showcase app without its imports or catalog definitions. ' +
        '`dynamicString` exists in no CopilotKit package (closest: DynamicStringSchema in @a2ui/web_core); ' +
        '`Catalog` comes from @copilotkit/a2ui-renderer/web-components and is not re-exported by @copilotkit/angular.',
    },
  },
]);
