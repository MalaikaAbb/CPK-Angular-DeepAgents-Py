/**
 * Shared paths, ports and URLs for the CI/CD pipeline.
 *
 * Everything under ci/ imports from here rather than rebuilding paths, so a
 * moved folder or a changed port is a one-line edit.
 *
 * Three services, not two. Angular has no server route to host the Copilot
 * Runtime the way a Next app does, so the runtime is its own Node process
 * (frontend/server.ts) sitting between `ng serve` and the DeepAgents graph.
 * `npm run dev` in frontend/ starts the first two together via concurrently;
 * the backend is started separately.
 *
 *   browser -> ng serve :4203 -> Copilot Runtime :8203 -> langgraph dev :8123
 *              (frontend)        (frontend/server.ts)     (backend/main.py)
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(__dirname, '..', '..');
export const CI_DIR = path.join(ROOT_DIR, 'ci');
export const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
export const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
export const RECORDER_DIR = path.join(ROOT_DIR, 'autorecorder');
export const VIDEOS_DIR = path.join(RECORDER_DIR, 'videos');
export const AUDIO_DIR = path.join(RECORDER_DIR, 'audio');
export const LOGS_DIR = path.join(VIDEOS_DIR, 'logs');

export const isWindows = process.platform === 'win32';

/**
 * Prefix for CI artifact names. Matches the recorded video filenames
 * (`DAPY-angular-01-Quickstart.webm`, from `videoPrefix` in
 * `autorecorder/config/project.config.ts`) so a downloaded folder and the clips
 * inside it read as the same thing. Both halves of the integration are in the
 * name on purpose: an Angular clip and its React twin land in the same folder.
 */
export const PROJECT_SLUG = 'DeepAgentspy-angular';

/**
 * ── Ports ──────────────────────────────────────────────────────────────────
 * This repo shipped defaulting to 4200/8200, which are both already taken:
 * 4200 and 8200 by Agno-angular, and 8200 again by MsPy-angular's backend.
 * Angular and the runtime moved to 4203/8203 so all the stacks on this machine
 * can run at once. The langgraph dev server keeps 8123, which nothing else uses.
 *
 * Moving the runtime is a TWO-place edit: `PORT` (read by frontend/server.ts)
 * and `runtimeUrl` in frontend/src/app/app.config.ts, which hardcodes the URL
 * the browser posts to.
 */
export const BACKEND_PORT = Number(process.env.BACKEND_PORT || 8123);
export const RUNTIME_PORT = Number(process.env.PORT || 8203);
export const FRONTEND_PORT = Number(process.env.FRONTEND_PORT || 4203);

/**
 * The backend is the LangGraph dev server, not a FastAPI app: it serves every
 * graph in `backend/langgraph.json` and answers `/ok`. That is also what
 * frontend/src/app/components/backend-health.ts probes, so both halves of the
 * repo agree on what "the backend is up" means.
 */
export const BACKEND_HEALTH_URL = `http://127.0.0.1:${BACKEND_PORT}/ok`;

/**
 * The runtime's own health path, and the one endpoint that proves the runtime
 * reached the graph -- which is why it doubles as the warm target below.
 */
export const RUNTIME_HEALTH_URL = `http://127.0.0.1:${RUNTIME_PORT}/api/copilotkit/info`;

// `localhost`, not 127.0.0.1, and not interchangeably. Angular 22 serves
// through Vite, which binds the name `localhost` -- on a CI runner that
// resolves to ::1, so a poll at 127.0.0.1 is refused for the full timeout while
// the dev server sits there having already printed its URL. The recorder's
// frontendUrl uses the same name, so both reach the same server.
export const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;

/**
 * Routes hit before recording starts.
 *
 * `ng serve` builds the whole app up front rather than per route, so this is
 * cheaper than the Next equivalent -- but the first request still pays for the
 * initial bundle transfer and the route's lazy chunk, which is enough to blow
 * the recorder's preflight timeout on a cold machine. Demo routes are
 * `<route>/demo` (frontend/src/app/app.routes.ts).
 */
export const WARMUP_ROUTES = ['/', '/quickstart/demo'];

/**
 * Hit once before the first prompt of a run.
 *
 * The browser posts across origins to the runtime, and the first request there
 * pays for the runtime's connection to the DeepAgents graph. /info is a real
 * GET endpoint that exercises exactly that path, so a run that would have
 * failed on a dead backend fails here instead of inside a recording.
 */
export const RUNTIME_WARM_URL = RUNTIME_HEALTH_URL;
