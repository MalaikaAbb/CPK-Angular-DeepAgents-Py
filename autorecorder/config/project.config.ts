/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ADAPT THIS FILE — 1 of 3
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Who this project is: which CopilotKit integration it tests, where its docs
 * live, and how its three services are reached and started.
 *
 * Everything else derives from this. Doc and demo URLs are built from
 * `docBaseUrl` and `frontendUrl`, so a page never repeats them and no page can
 * point at a different framework's docs by accident.
 *
 * `npm run doctor` rejects any field still set to REPLACE_ME, so a half-done
 * adaptation cannot pass as finished.
 *
 * ── Three services, not two ────────────────────────────────────────────────
 * Angular has no server route to host the Copilot Runtime the way a Next app
 * does, so the runtime is its own Node process (`frontend/server.ts`) sitting
 * between `ng serve` and the DeepAgents graph. That is why `runtimeWarmPath`
 * below is an absolute URL rather than a path under `frontendUrl`: the browser
 * posts across origins to reach it.
 */

/** Sentinel for values an adaptation must supply. Doctor fails while any remain. */
export const REPLACE_ME = 'REPLACE_ME' as const;

export interface ProjectConfig {
  /**
   * Doc slug, exactly as it appears in the URL:
   * `https://docs.copilotkit.ai/<framework>/...`
   * e.g. 'ms-agent-python', 'ms-agent-dotnet', 'agno', 'deepagents'.
   */
  framework: string;

  /** Human name for logs and the README, e.g. 'Microsoft Agent Framework (Python)'. */
  frameworkLabel: string;

  /**
   * Filename prefix for exported videos. Files are named
   * `<videoPrefix>-<NN>-<videoName>.webm`, the index coming from page order.
   *
   * **Name it for BOTH sides of the integration — `<AGENT>-<frontend>`:**
   * 'DAPY-angular', 'DAPY-react', 'MSPY-angular'. These files end up in one
   * folder together, so a prefix carrying only the agent leaves an Angular clip
   * indistinguishable from the React one.
   */
  videoPrefix: string;

  /** Doc root this repo tracks. Every page's docPath is appended to it. */
  docBaseUrl: string;

  /** Where the app runs. Every page's route is appended to it. */
  frontendUrl: string;

  /** Where the agent runs. Used only for the pre-flight health check. */
  backendUrl: string;

  /** Health path on the backend. The check falls back to `/docs` then `/`. */
  backendHealthPath: string;

  /** Printed verbatim when the pre-flight check fails, so the fix is copy-pasteable. */
  frontendStartCmd: string;
  backendStartCmd: string;

  /**
   * Appended to each page's route to reach the chrome-free demo.
   * Set to '' if this project's demos live directly on the route.
   */
  demoSuffix: string;

  /**
   * Project-wide overrides of the recorder's fixed waits. Optional; the
   * defaults in `core/timeouts.ts` suit a warm dev server. Raise `demoNavMs`
   * for a stack whose first request compiles the route.
   */
  timeouts?: Partial<import('../core/types').RecorderTimeouts>;

  /**
   * Frontend path the browser calls to reach the agent, relative to
   * `frontendUrl` — or an absolute URL when the runtime is a separate origin,
   * which it is here.
   *
   * Hit once before the first prompt of every recording. `actions/page-ready.ts`
   * is what requests it: a page can be fully painted while the path behind it
   * has never been exercised, and the first POST then pays for the runtime's
   * connection to the agent instead of answering. The run reports that as "the
   * agent never replied", on a page that is fine.
   *
   * Set to '' to skip.
   */
  runtimeWarmPath: string;
}

export const PROJECT: ProjectConfig = {
  // The Angular doc tree is nested one level deeper than the React variants:
  // https://docs.copilotkit.ai/angular/deepagents/... . The slug stays
  // 'deepagents' -- it is what identifies the integration -- and the Angular
  // prefix lives in docBaseUrl, which is what doc URLs are actually built from.
  // This matches DOCS_ROOT in frontend/src/app/lib/nav-config.ts, the app's own
  // source of truth for which doc page each route tests.
  framework: 'deepagents',
  frameworkLabel: 'DeepAgents (Python) + Angular',
  videoPrefix: 'DAPY-angular',

  docBaseUrl: 'https://docs.copilotkit.ai/angular/deepagents',

  // ── Ports ────────────────────────────────────────────────────────────────
  // This repo's defaults collided with its neighbours: `ng serve` on 4200 and
  // the runtime on 8200 are both already taken by Agno-angular, and 8200 is
  // additionally MsPy-angular's backend. Angular and the runtime therefore
  // moved to 4203 / 8203 so all four stacks can run at once. The langgraph dev
  // server keeps 8123, which nothing else uses.
  //
  // Moving the runtime means moving it in two places -- `PORT` for
  // frontend/server.ts, and `runtimeUrl` in frontend/src/app/app.config.ts,
  // which hardcodes the URL the browser posts to.
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4203',

  // Not a FastAPI app. `backend/main.py` exports a graph and
  // `backend/langgraph.json` publishes it as `sample_agent`; serving it is the
  // langgraph dev server's job. That server answers `/ok`, not `/health` or
  // `/openapi.json`, and it is what frontend/src/app/components/backend-health.ts
  // probes too -- so both halves of the repo agree on what "the backend is up"
  // means.
  backendUrl: process.env.BACKEND_URL || 'http://localhost:8123',
  backendHealthPath: '/ok',

  // One command starts both frontend processes: `npm run dev` runs the Copilot
  // Runtime (frontend/server.ts) and `ng serve` together under concurrently.
  frontendStartCmd: 'cd frontend && npm run dev',
  // `--no-reload` is not optional here, and it cost a run to learn. `langgraph
  // dev` hot-reloads on any change under the repo, and the recorder writes into
  // the repo while it works -- frontend/VERSIONS.md before every doctor run,
  // clips and RECORD_RESULTS.json into autorecorder/videos/. The watcher sees
  // those, reloads, and eventually exits mid-suite, which surfaces as pages
  // failing with "the agent never replied" for no visible reason.
  backendStartCmd:
    'cd backend && uv run --with "langgraph-cli[inmem]" langgraph dev --port 8123 --no-browser --no-reload',

  // Demo routes are `<route>/demo`, per frontend/src/app/app.routes.ts.
  demoSuffix: '/demo',

  // Absolute, because the runtime is its own origin (see the note above).
  // `new URL(absolute, base)` returns the absolute, so this needs no engine
  // change. /info is a real GET endpoint that goes through to the DeepAgents
  // graph, so a run that would have failed on a dead backend fails here rather
  // than inside a recording.
  runtimeWarmPath:
    process.env.RUNTIME_URL || 'http://localhost:8203/api/copilotkit/info',
};

/** Absolute doc URL for a page's `docPath`. */
export function docUrlFor(docPath: string): string {
  return `${PROJECT.docBaseUrl.replace(/\/$/, '')}/${docPath.replace(/^\//, '')}`;
}

/** Absolute demo URL for a page's `route`. */
export function demoUrlFor(route: string): string {
  return `${PROJECT.frontendUrl.replace(/\/$/, '')}/${route.replace(/^\//, '')}${PROJECT.demoSuffix}`;
}
