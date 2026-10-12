# Doc drift changelog

What the CopilotKit docs changed under this repo, written by the sync on
`/doc-sync`. Only pages that actually moved are recorded — a sync that finds
everything unchanged writes nothing here at all.

Holds the 3 most recent dated entries. When a change lands on a fourth
date, the oldest entry is dropped. Entries are counted, not aged, so a gap of
weeks between changes does not expire anything.

## 2026-10-12

### 10:59 UTC — 8 pages, highest severity high

**High — A2UI schemas, styling, and recovery**

`/angular/deepagents/guides/a2ui` · route `/a2ui` · under “Choose a schema strategy” · in a `typescript` block

24 code lines, 1 heading, 19 prose lines changed. The number of fenced code blocks changed.

````diff
- // features/a2ui/a2ui-catalogs.ts
- const fixedDefinitions = {
+ // features/a2ui/a2ui-definitions.ts
+ export const fixedDefinitions = {
- };
+ } satisfies A2UICatalogDefinitions;
+ A catalog is required: without one, A2UI stays off even when the runtime
+ enables it, and CopilotKit logs a warning.
````

**High — Frontend tools and generative UI**

`/angular/deepagents/guides/frontend-tools-generative-ui` · route `/frontend-tools-generative-ui` · under “Let the agent display one of your components”

36 code lines, 1 heading, 23 prose lines changed. The number of fenced code blocks changed.

````diff
+ ## Let the agent display one of your components
+ 
+ The simplest generative UI there is, and the only kind that needs nothing on the
+ agent side. `registerComponent` registers a standalone component as a tool the
+ agent can call to show it. The agent decides when, and fills the props.
+ 
+ ```ts title="src/app/incident-card.component.ts"
+ import { Component, input } from "@angular/core";
````

**High — Human-in-the-loop and interrupts**

`/angular/deepagents/guides/human-in-the-loop` · route `/human-in-the-loop` · under “Human-in-the-loop and interrupts”

26 code lines, 3 headings, 26 prose lines changed. The number of fenced code blocks changed.

````diff
- | Interrupt | The backend agent emits an AG-UI interrupt | `injectInterrupt` |
+ | Interrupt | The backend agent emits an AG-UI interrupt | `AgentStore.interruptController`, `injectInterrupt` |
- ## Handle an interrupt
+ ## Handle an interrupt from the store
+ An interrupt is a state of one conversation: this agent, this thread, this run
+ is waiting for a decision. The store that already exposes that conversation's
+ messages and state exposes its pending interrupt too, so a component that holds
+ a store needs nothing else:
````

**High — Voice and multimodal input**

`/angular/deepagents/guides/voice-multimodal` · route `/voice-multimodal` · under “Accept voice input”

5 code lines, 1 heading, 15 prose lines changed. The number of fenced code blocks changed.

````diff
- access. Your Runtime must also have transcription configured; a visible
- microphone does not make an unavailable transcription service succeed.
+ access.
+ 
+ ### Configure Runtime transcription
+ 
+ Follow the [Voice backend setup](/angular/deepagents/guides/voice-multimodal#backend) to add a dedicated Runtime
+ route and transcription service. Keep speech-provider credentials separate
````

**Medium — Introduction**

`/angular/deepagents` · routes `/`, `/doc-sync` · under “Angular”

2 headings, 24 prose lines changed.

````diff
- body="Add durable threads, inspection, and managed or self-hosted Enterprise Intelligence without changing the Angular frontend APIs in this guide."
+ body="Add threads, inspection, and cloud-hosted or self-hosted CopilotKit Intelligence without changing the Angular frontend APIs in this guide."
+ ## Start with your coding agent
+ 
+ Use this prompt to connect your Angular app to Copilot Runtime with the selected agent backend, then verify a working conversation. You can also follow the manual steps below.
+ 
+ Ask your coding agent to follow the setup steps on this page for your selected framework and frontend.
+ 
````

**Medium — Quickstart**

`/angular/deepagents/quickstart` · route `/quickstart` · under “Angular”

2 headings, 24 prose lines changed.

````diff
- body="Add durable threads, inspection, and managed or self-hosted Enterprise Intelligence without changing the Angular frontend APIs in this guide."
+ body="Add threads, inspection, and cloud-hosted or self-hosted CopilotKit Intelligence without changing the Angular frontend APIs in this guide."
+ ## Start with your coding agent
+ 
+ Use this prompt to connect your Angular app to Copilot Runtime with the selected agent backend, then verify a working conversation. You can also follow the manual steps below.
+ 
+ Ask your coding agent to follow the setup steps on this page for your selected framework and frontend.
+ 
````

**Info — Workflow execution**

`/angular/deepagents/shared-state/workflow-execution` · route `/workflow-execution`

Now tracked for the first time.

**Info — WebMCP**

`/angular/deepagents/webmcp` · route `/webmcp`

Now tracked for the first time.

---

## 2026-08-18

### 06:47 UTC — 2 pages, highest severity high

**High — Human-in-the-loop and interrupts** · _local snapshot edit, not an upstream change_

`/angular/deepagents/guides/human-in-the-loop` · route `/human-in-the-loop` · under “Register a decision tool”

4 code lines, 3 prose lines changed.

````diff
+ The renderer receives a `toolCall` signal. Call `respond(result)` once the user
+ has made a choice.
+ 
+ type ApprovalArgs = {
+ action: string;
+ reason: string;
+ };
````

**High — Voice and multimodal input** · _local snapshot edit, not an upstream change_

`/angular/deepagents/guides/voice-multimodal` · route `/voice-multimodal` · under “Accept voice input” · in a `typescript` block

2 code lines changed.

````diff
- 
+ component:
````
