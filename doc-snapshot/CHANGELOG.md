# Doc drift changelog

What the CopilotKit docs changed under this repo, written by the sync on
`/doc-sync`. Only pages that actually moved are recorded — a sync that finds
everything unchanged writes nothing here at all.

Holds the 3 most recent dated entries. When a change lands on a fourth
date, the oldest entry is dropped. Entries are counted, not aged, so a gap of
weeks between changes does not expire anything.

## 2026-08-30

### 11:06 UTC — 5 pages, highest severity high

**High — Inspector** · _new page_

`/angular/deepagents/inspector` · no route yet · newly tracked

A page the index/quickstart step now links to. It did not exist at the last
sync, so it is added to the snapshot rather than diffed.

- `@copilotkit/angular` mounts the Inspector itself; `@copilotkit/web-inspector`
  is a direct dependency, so there is nothing to install or pin.
- Visibility is controlled by `enableInspector` on `provideCopilotKit`.
- A hand-written `WebInspector` component, as this page previously described,
  must be deleted before upgrading past **0.4.0** — its
  `DestroyRef.onDestroy` unconditionally removes the `cpk-web-inspector`
  element the framework now drives, and a route change that destroys it takes
  the Inspector out until a full reload.
- Nothing to do for production or server rendering.

**High — Angular index and quickstart** · _upstream change_

`/angular/deepagents` and `/angular/deepagents/quickstart` · routes `/`, `/doc-sync` · under "Prerequisites", "Create your Angular app", "Getting started" and "Next steps"

Supported Angular range narrowed to a single major, "Enterprise Intelligence"
renamed to "CopilotKit Intelligence", and a new final setup step added.

````diff
- - Angular 20, 21, or 22
+ - Angular 22

- If you don't have one already, pin the CLI to one of the supported majors. This example uses Angular 22:
+ If you don't have one already, pin the CLI to the supported major:

- body="Add durable threads, inspection, and managed or self-hosted Enterprise Intelligence without changing the Angular frontend APIs in this guide."
+ body="Add durable threads, inspection, and managed or self-hosted CopilotKit Intelligence without changing the Angular frontend APIs in this guide."

+ <Step>
+     ### Open Inspector and confirm setup
+ On localhost, click the Inspector button in the corner of the app.
+ 1. Open **Agents**, then **Agent**. Your agent is listed.
+ 2. Send a chat message. Open **Agents**, then **AG-UI Events**. Events are moving.
+ 3. Open **Threads**. The list is unlocked (Intelligence is on), or locked with Enable Intelligence (Intelligence is off).
+ More detail: [Inspector](/angular/deepagents/inspector).
+ </Step>

- - [Enterprise Intelligence](premium/overview): add durable threads, inspection, and cloud-hosted or self-hosted operations.
+ - [CopilotKit Intelligence](premium/overview): add durable threads, inspection, and cloud-hosted or self-hosted operations.
````

**High — Human-in-the-loop and interrupts** · _upstream change_

`/angular/deepagents/guides/human-in-the-loop` · route `/human-in-the-loop` · under "Handle an interrupt"

A second, store-based way to read an interrupt was documented, and the
`injectInterrupt` signature changed from an options object to a positional
agent id.

````diff
- | Interrupt | The backend agent emits an AG-UI interrupt | `injectInterrupt` |
+ | Interrupt | The backend agent emits an AG-UI interrupt | `AgentStore.interruptController`, `injectInterrupt` |

- ## Handle an interrupt
+ ## Handle an interrupt from the store
+ @let interrupts = store().interruptController;
+ @if (interrupts.hasInterrupt()) {
+   <p>{{ interrupts.interrupt()?.message }}</p>
+   <button (click)="interrupts.resolve({ approved: true })">Approve</button>
+   <button (click)="interrupts.cancel()">Reject</button>
+ }
+ protected readonly store = injectAgentStore("ticketing");
+ ## Handle an interrupt with a typed controller

-   injectInterrupt<ReviewRequest>({ agentId: "default" });
+   injectInterrupt<ReviewRequest>("default");
````

**High — A2UI** · _upstream change_

`/angular/deepagents/guides/a2ui` · route `/a2ui` · under "Angular support boundaries"

1 prose line changed, tracking the same Angular-22-only policy.

````diff
- - **Hashbrown is unsupported.** The stable Hashbrown Angular package does not support the complete Angular 20 through 22 policy.
+ - **Hashbrown is unsupported.** The stable Hashbrown Angular package does not support the Angular 22 policy.
````

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
