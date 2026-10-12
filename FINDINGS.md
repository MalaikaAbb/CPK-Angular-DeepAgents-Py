# Findings — DeepAgentspy-angular
Open doc defects only. An entry is added only after the user approves it. Numbers are stable IDs (code cites `FINDINGS.md #N`).
Stack: `@copilotkit/angular` 0.5.2, `@copilotkit/runtime` 1.73.3, `@copilotkit/web-inspector` 1.70.2 (via angular), `@ag-ui/langgraph` 0.0.42, `deepagents` 0.7.5. `ng serve` type-checks, so TS errors show up in dev.

## Dev blockers (seen with `ng serve` and normal use of the page)
None confirmed. #1–#4 below were seen in recordings but not reproduced in the last check. Promote any of them once a dev run confirms it.

## Minor notes
- #1 [A2UI](https://docs.copilotkit.ai/angular/deepagents/a2ui): `productCatalog`/`beautifulCatalog` are undefined. With `a2ui: {}` the surface request returns plain text and nothing is logged.
- #2 [Voice & multimodal](https://docs.copilotkit.ai/angular/deepagents/voice-multimodal): the page says transcription must be configured on the runtime but never says how. The mic records, but nothing gets transcribed.
- #3 [Threads](https://docs.copilotkit.ai/angular/deepagents/threads): `<copilot-threads-drawer>` rendered empty (possibly license or Intelligence gating). Unnamed threads show as "Untitled conversation".
- #4 [Memory](https://docs.copilotkit.ai/angular/deepagents/memory): `isAvailable()` is true, but no memory request is made, so the list and its fallback both stay blank.
- #5 [Frontend tools](https://docs.copilotkit.ai/angular/deepagents/frontend-tools-generative-ui): the `registerComponent` snippet has no imports, and `followUp` is undocumented. Status moves from `"in-progress"` to `"executing"` to `"complete"` as documented. With no handler it stops at `"executing"`, but the `@else` branch still renders.
- #7 Quickstart (and landing): says "Rich Threads", but the web-inspector 1.70.2 tab is "Threads".

## Build-only
None.
