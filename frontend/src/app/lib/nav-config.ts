/**
 * The nav, every route header, the demo links, and the README status table all
 * read from here, so a doc page and its implementation status are described
 * exactly once.
 *
 * Groups mirror the sidebar at https://docs.copilotkit.ai/angular/deepagents as of
 * DOC_SYNC_DATE. The last doc page covers four topics at once; it is split into
 * four routes here, which all point back at the same `docPath`.
 */

/**
 * There is exactly one doc-sync date in this repo, and it is not here: it is
 * `syncedAt` in `doc-snapshot/manifest.json`, written every time the sync
 * button runs. A hand-maintained date alongside it only ever drifted out of
 * agreement with the machine one, so it was removed — `/doc-sync` is the
 * single place that answers "how current are these docs".
 */
export const DOCS_ROOT = 'https://docs.copilotkit.ai/angular/deepagents';

/**
 * working   — implemented and exercisable against the local stack.
 * partial   — implemented, but something outside this repo limits it
 *             (a premium license, a runtime capability this repo does not run).
 * reference — intentionally not a live feature; notes surface only.
 * broken    — implemented but currently failing.
 */
export type RouteStatus =
  | 'working'
  | 'partial'
  | 'reference'
  | 'broken'
  | 'not-started';

export interface RouteMeta {
  /** App route path. */
  path: string;
  /** Nav label. */
  title: string;
  /** Doc page this route tests, relative to docs.copilotkit.ai. */
  docPath: string;
  /** One-line description in our own words. */
  summary: string;
  status: RouteStatus;
  /** Shown in the route header when the status is not plain "working". */
  statusNote?: string;
  /** Feature requires a CopilotKit Intelligence license. */
  premium?: boolean;
  /**
   * This route owns a live interactive surface, which lives at `<path>/demo`
   * rather than on the page itself. The doc route keeps the explanation and the
   * source; the demo route is chrome-free so it can be screen-recorded alone.
   */
  hasDemo?: boolean;
}

/** Where a route's interactive demo lives, if it has one. */
export function demoPath(route: RouteMeta): string | undefined {
  if (!route.hasDemo) return undefined;
  return route.path === '/' ? '/demo' : `${route.path}/demo`;
}

export interface NavGroup {
  title: string;
  routes: RouteMeta[];
}

export const NAV: NavGroup[] = [
  {
    title: 'Getting Started',
    routes: [
      {
        path: '/',
        title: 'Introduction',
        docPath: '/angular/deepagents',
        summary:
          'What this harness covers and how the three processes fit together.',
        status: 'reference',
        statusNote: 'Landing page — orientation and a live connection check.',
      },
      {
        path: '/quickstart',
        hasDemo: true,
        title: 'Quickstart',
        docPath: '/angular/deepagents/quickstart',
        summary:
          'The smallest end-to-end path: a LangGraphAgent bound to the DeepAgents backend in Copilot Runtime, provideCopilotKit, and one copilot-chat.',
        status: 'working',
      },
      {
        path: '/inspector',
        hasDemo: true,
        title: 'Inspector',
        docPath: '/angular/deepagents/inspector',
        summary:
          'The Inspector the framework mounts for you, and a live check that it did.',
        status: 'working',
        statusNote:
          'Added 30 Aug 2026 with @copilotkit/angular 0.4.0, which mounts cpk-web-inspector itself. This harness has no Inspector code, which is what the page is testing. The element appears once a CopilotKit component is on the route, so the demo mounts a chat to show it arrive.',
      },
    ],
  },
  {
    title: 'Guides',
    routes: [
      {
        path: '/chat-ui',
        hasDemo: true,
        title: 'Chat UI and customization',
        docPath: '/angular/deepagents/guides/chat-ui',
        summary:
          'The four chat surfaces, a replaced assistant-message component, and scoped chat CSS.',
        status: 'working',
      },
      {
        path: '/frontend-tools-generative-ui',
        hasDemo: true,
        title: 'Frontend tools and generative UI',
        docPath: '/angular/deepagents/guides/frontend-tools-generative-ui',
        summary:
          'A server-side tool call rendered by an Angular component, plus the sandboxed Open Generative UI path.',
        status: 'partial',
        statusNote:
          'All three of the guide’s generative-UI paths run here, including registerComponent, which declares show_incident from the browser with no change to the deepagents graph. The new first section runs, and its published snippet is wrong in four ways. It carries no handler, so core writes an empty tool result and the model is always handed a second turn nobody asked for. It guards on status "in-progress" while the real status is "executing", so the guard never fires and the card paints empty first. The status never reaches "complete" at all, so the gate-on-complete pattern taught higher up the same page would load forever here. And it ships no CSS, so with Angular’s default preserveWhitespaces the card renders as the run-together string INC-4711sev1. Everything is kept verbatim. See Known gaps.',
      },
      {
        path: '/a2ui',
        hasDemo: true,
        title: 'A2UI schemas, styling, and recovery',
        docPath: '/angular/deepagents/guides/a2ui',
        summary:
          'Declarative generative UI driven by the runtime A2UI middleware, with the guide’s recovery thresholds and catalog CSS.',
        status: 'broken',
        // Confirmed 28 Aug 2026, and worth stating precisely: the React/Python
        // build of this guide fails with a visible `Catalog not found:
        // https://a2ui.org/.../basic_catalog.json`. Angular does not. Here the
        // console is clean and no catalog fetch is attempted at all.
        statusNote:
          'Inert until a catalog is supplied, and silently so. /info reports a2uiEnabled: true, but supplying a2ui.catalog is what registers the render_a2ui renderer — and the guide’s catalog snippet is not self-contained. Asking for a surface returns prose with nothing logged: no error, no catalog request. (The React build of this guide fails loudly with a “Catalog not found” error; this one does not.) See Known issues.',
      },
      {
        path: '/voice-multimodal',
        hasDemo: true,
        title: 'Voice and multimodal input',
        docPath: '/angular/deepagents/guides/voice-multimodal',
        summary:
          'The built-in microphone control, an attachments config, and a programmatically constructed multimodal message.',
        status: 'partial',
        statusNote:
          'The microphone renders and records, but this repo’s runtime has no transcription service configured, so transcription fails by design.',
      },
      {
        path: '/human-in-the-loop',
        hasDemo: true,
        title: 'Human-in-the-loop and interrupts',
        docPath: '/angular/deepagents/guides/human-in-the-loop',
        summary:
          'A decision tool that pauses the run until the user answers, plus the interrupt controller beside it.',
        status: 'working',
        statusNote:
          'The tool path is live. The store interrupt controller is mounted and listening, but this backend emits no AG-UI interrupt, so that half stays blank by design and the route says so on screen.',
      },
      {
        path: '/shared-state',
        hasDemo: true,
        title: 'Shared state and agent context',
        docPath: '/angular/deepagents/guides/shared-state',
        summary:
          'Reading and writing agent state through injectAgentStore, and publishing read-only app context two ways.',
        status: 'broken',
        statusNote:
          'The browser half works: agent.setState updates the store, the UI renders the new priority, and both context panels publish. The run input POSTed to /api/copilotkit carries state and context correctly — and the agent still answers as though neither exists. Verified 31 Aug 2026 by reading the request body.',
      },
    ],
  },
  {
    title: 'Threads, memory, attachments, headless',
    routes: [
      {
        path: '/threads',
        hasDemo: true,
        title: 'Threads',
        docPath: '/angular/deepagents/guides/threads-memory-attachments-headless',
        summary:
          'A hand-built thread list on injectThreads, and the drop-in CopilotThreadsDrawer beside a chat.',
        status: 'broken',
        premium: true,
        // Corrected 28 Aug 2026 against a live run. The previous note said the
        // list stays empty and the drawer renders a locked state; neither is
        // what happens. GET /api/copilotkit/threads answers 200 with a thread,
        // the hand-built list displays it, and the drawer renders nothing at all.
        statusNote:
          'The hand-built injectThreads list works — GET /api/copilotkit/threads returns a thread, shown as “Untitled conversation” because the API returns name: null. CopilotThreadsDrawer beside it renders completely empty: no list, no launcher, no locked state, no error. Creating a conversation does not persist either — the runtime reports threadEndpoints.mutations: false.',
      },
      {
        path: '/memory',
        hasDemo: true,
        title: 'Memory',
        docPath: '/angular/deepagents/guides/threads-memory-attachments-headless',
        summary:
          'injectMemories with the isAvailable() gate the guide requires before showing memory controls.',
        status: 'broken',
        premium: true,
        // Corrected 28 Aug 2026 against a live run. The previous note had this
        // backwards: the fallback message never renders, which means the
        // isAvailable() branch it belongs to is not the one being taken.
        statusNote:
          'app-memory-list renders nothing at all — not the memories, and not the guide’s “Memory is not available for this runtime.” fallback either. Since that fallback is the @if (!isAvailable()) branch, the gate is returning true, yet no request to any memory endpoint is ever issued. The one safeguard the guide prescribes reports the feature as available while it is not.',
      },
      {
        path: '/attachments',
        hasDemo: true,
        title: 'Attachments',
        docPath: '/angular/deepagents/guides/threads-memory-attachments-headless',
        summary:
          'An AttachmentsConfig bound to copilot-chat, with the file picker, drag-and-drop, and paste.',
        status: 'working',
      },
      {
        path: '/headless',
        hasDemo: true,
        title: 'Headless UI',
        docPath: '/angular/deepagents/guides/threads-memory-attachments-headless',
        summary:
          'A transcript and composer built from scratch on injectAgentStore and CopilotKitCore.runAgent.',
        status: 'working',
      },
    ],
  },
  {
    title: 'Doc Sync',
    routes: [
      {
        path: '/doc-sync',
        title: 'Doc drift',
        docPath: '/angular/deepagents',
        summary:
          'Re-fetches the markdown behind every tracked doc page and diffs it against the stored snapshot, flagging changes inside code blocks.',
        status: 'reference',
      },
    ],
  },
];

export const ALL_ROUTES: RouteMeta[] = NAV.flatMap((g) => g.routes);

export function findRoute(path: string): RouteMeta | undefined {
  return ALL_ROUTES.find((r) => r.path === path);
}

export function docUrl(route: RouteMeta): string {
  return `https://docs.copilotkit.ai${route.docPath}`;
}

export const STATUS_LABEL: Record<RouteStatus, string> = {
  working: 'Working',
  partial: 'Partial',
  reference: 'Reference',
  broken: 'Broken',
  'not-started': 'Not started',
};
