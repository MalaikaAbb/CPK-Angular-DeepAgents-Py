/**
 * Copilot Runtime for this harness.
 *
 * Shape comes from the Angular quickstart's Node runtime server
 * (https://docs.copilotkit.ai/angular/deepagents/quickstart), with the agent
 * bound to the DeepAgents backend in `../backend` — the Angular/DeepAgents
 * quickstart defers the backend step to "register this backend as the
 * `default` agent".
 *
 * That backend is a graph, not an HTTP server: `create_deep_agent(...)` in
 * backend/main.py is exported as `agent`, and backend/langgraph.json publishes
 * it under the graph id `sample_agent`. Serving it is the dev server's job, so
 * the binding here is `LangGraphAgent` from `@ag-ui/langgraph` — the DeepAgents
 * adapter, which speaks the graph protocol (state, tool calls, interrupts) and
 * translates it to AG-UI events for the runtime.
 *
 * `default` and `support` resolve to the same DeepAgents graph. `support`
 * exists so the doc snippets that use `agentId="support"` (Chat UI, Threads)
 * run verbatim.
 *
 * `a2ui: {}` enables A2UIMiddleware for every registered agent, per
 * https://docs.copilotkit.ai/angular/deepagents/guides/a2ui
 */
import { createServer } from "node:http";
import { CopilotRuntime, CopilotKitIntelligence } from "@copilotkit/runtime/v2";
import { createCopilotNodeListener } from "@copilotkit/runtime/v2/node";
import { LangGraphAgent } from "@ag-ui/langgraph";

// The DeepAgents dev server binds port 8231. Start it from backend/ with:
//   uv run --with "langgraph-cli[inmem]" langgraph dev --port 8231 --no-browser
// `uv run --with` keeps the project venv, which is where `deepagents` lives;
// `uvx` would build an isolated env holding only the CLI and fail to import it.
const deploymentUrl =
  process.env["DEEPAGENTS_DEPLOYMENT_URL"] ?? "http://localhost:8231";

// Graph id from backend/langgraph.json — `"sample_agent": "./main.py:agent"`.
const graphId = process.env["DEEPAGENTS_GRAPH_ID"] ?? "sample_agent";

/**
 * Intelligence client, verbatim from
 * https://docs.copilotkit.ai/angular/deepagents/intelligence/connect-your-runtime
 * ("Wire the runtime"). Thread endpoints are served by Intelligence, so the
 * Threads guide's `injectThreads` list and `CopilotThreadsDrawer` resolve to
 * nothing until this is passed — which that guide never says.
 *
 * `apiUrl`/`wsUrl` default to the managed platform, so both stay unset.
 */
const intelligence = new CopilotKitIntelligence({
  apiKey: process.env["CPK_INTELLIGENCE_API_KEY"]!,
});

const runtime = new CopilotRuntime({
  agents: {
    default: new LangGraphAgent({ deploymentUrl, graphId }),
    support: new LangGraphAgent({ deploymentUrl, graphId }),
  },
  a2ui: {},
  intelligence,
  // Threads are per-user. Without this every visitor shares one history.
  identifyUser: (request) => ({
    id: request.headers.get("x-user-id") ?? "anonymous",
    name: request.headers.get("x-user-name") ?? "Anonymous",
  }),
});

const port = Number(process.env["PORT"] ?? 8230);

createServer(
  createCopilotNodeListener({
    runtime,
    basePath: "/api/copilotkit",
    cors: true,
  }),
).listen(port, () => {
  console.log(
    `Copilot Runtime listening at http://localhost:${port}/api/copilotkit`,
  );
  console.log(`DeepAgents agent: ${deploymentUrl} (graph: ${graphId})`);
});
