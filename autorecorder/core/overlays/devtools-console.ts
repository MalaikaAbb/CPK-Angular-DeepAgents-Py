import { type Page } from 'playwright';
import { sleep } from './cursor';

/**
 * Chrome's DevTools console, drawn inside the page.
 *
 * Same premise as the taskbar and Notepad: video capture only ever sees page
 * content, so anything that lives in browser chrome has to be rebuilt as DOM or
 * it is simply not in the recording.
 *
 * This one exists because a whole class of defect here is invisible without it.
 * The A2UI surface fails with `Catalog not found: .../basic_catalog.json`, and
 * that error goes to the console and nowhere else -- the page renders no error
 * state, so a straight recording of the failure shows a chat that just sits
 * there. A viewer cannot tell that apart from a slow model. Opening the console
 * and putting the actual error on screen is the difference between a clip that
 * documents a bug and a clip that documents nothing.
 *
 * Capture is Node-side (`page.on('console')`) rather than a hook injected into
 * the page, because an injected hook is wiped by the next navigation and these
 * errors arrive after one.
 */

const PANEL_ID = '__autorecord_devtools';
const ROWS_ID = '__autorecord_devtools_rows';

/** Height of the docked panel, in px. Sits above the simulated taskbar. */
const PANEL_HEIGHT = 320;

export interface ConsoleEntry {
  level: 'error' | 'warning' | 'info';
  text: string;
  /** Right-hand source link, as DevTools shows it. */
  source?: string;
}

export interface ConsoleCapture {
  /** Everything captured so far, in arrival order. */
  entries: ConsoleEntry[];
  /** Detach the listeners. Safe to call more than once. */
  stop: () => void;
}

/** Noise every CopilotKit page produces, which would bury the real error. */
const IGNORED =
  /favicon\.ico|reo\.dev|analytics|webpack-hmr|\.map\b|Hydration failed|server rendered text|Download the React DevTools/i;

function shorten(text: string, max = 260): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * Starts recording console errors and failed requests for later display.
 *
 * Call this before the action that provokes the error -- typically the first
 * line of the handler, before `sendPrompt`.
 */
export function captureConsole(page: Page): ConsoleCapture {
  const entries: ConsoleEntry[] = [];

  const onConsole = (msg: { type: () => string; text: () => string; location: () => { url?: string; lineNumber?: number } }) => {
    const type = msg.type();
    if (type !== 'error' && type !== 'warning') return;
    const text = msg.text();
    if (IGNORED.test(text)) return;

    const loc = msg.location?.() ?? {};
    const file = loc.url ? loc.url.split('/').pop() : undefined;
    entries.push({
      level: type === 'error' ? 'error' : 'warning',
      text: shorten(text),
      source: file && loc.lineNumber != null ? `${file}:${loc.lineNumber}` : file,
    });
  };

  const onPageError = (err: Error) => {
    if (IGNORED.test(err.message)) return;
    entries.push({ level: 'error', text: shorten(err.message), source: 'Uncaught' });
  };

  const onRequestFailed = (req: { url: () => string; method: () => string; failure: () => { errorText: string } | null }) => {
    const url = req.url();
    if (IGNORED.test(url)) return;
    entries.push({
      level: 'error',
      text: `${req.method()} ${shorten(url, 120)} ${req.failure()?.errorText ?? 'net::ERR_FAILED'}`,
      source: 'network',
    });
  };

  page.on('console', onConsole as never);
  page.on('pageerror', onPageError as never);
  page.on('requestfailed', onRequestFailed as never);

  let stopped = false;
  return {
    entries,
    stop: () => {
      if (stopped) return;
      stopped = true;
      page.off('console', onConsole as never);
      page.off('pageerror', onPageError as never);
      page.off('requestfailed', onRequestFailed as never);
    },
  };
}

/**
 * Anything captured whose text matches `pattern`, newest first, deduplicated.
 *
 * A React error boundary can log the same failure a dozen times over; a console
 * pane replaying all twelve reads as noise rather than as the finding, so the
 * caller gets one row per distinct message.
 */
export function findEntries(
  capture: ConsoleCapture,
  pattern: RegExp,
  limit = 4,
): ConsoleEntry[] {
  const seen = new Set<string>();
  const out: ConsoleEntry[] = [];
  for (const entry of capture.entries) {
    if (!pattern.test(entry.text)) continue;
    if (seen.has(entry.text)) continue;
    seen.add(entry.text);
    out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

/** Slides the docked DevTools panel up from the bottom of the viewport. */
export async function openDevTools(page: Page, activeTab = 'Console'): Promise<void> {
  await page.evaluate(
    (a: { panelId: string; rowsId: string; height: number; tab: string }) => {
      document.getElementById(a.panelId)?.remove();

      const tabs = ['Elements', 'Console', 'Sources', 'Network', 'Performance', 'Application'];

      const panel = document.createElement('div');
      panel.id = a.panelId;
      panel.style.cssText = [
        'position:fixed',
        'left:0',
        'right:0',
        // Clear of the simulated taskbar, which owns the bottom 48px.
        'bottom:48px',
        `height:${a.height}px`,
        'background:#282828',
        'border-top:1px solid #3c3c3c',
        'box-shadow:0 -8px 24px rgba(0,0,0,.35)',
        'z-index:2147483643',
        'display:flex',
        'flex-direction:column',
        'font-family:"Segoe UI",system-ui,sans-serif',
        `transform:translateY(${a.height}px)`,
        'transition:transform .22s cubic-bezier(.2,0,0,1)',
        'pointer-events:none',
      ].join(';');

      const tabStrip = tabs
        .map((t) => {
          const active = t === a.tab;
          return (
            '<div style="padding:0 11px;height:26px;display:flex;align-items:center;font-size:12px;' +
            (active
              ? 'color:#e8eaed;border-bottom:2px solid #8ab4f8;'
              : 'color:#9aa0a6;border-bottom:2px solid transparent;') +
            '">' +
            t +
            '</div>'
          );
        })
        .join('');

      panel.innerHTML = [
        // Tab strip
        '<div style="height:28px;background:#333333;display:flex;align-items:flex-end;padding-left:6px;border-bottom:1px solid #3c3c3c;">',
        tabStrip,
        '</div>',
        // Filter toolbar
        '<div style="height:30px;background:#282828;display:flex;align-items:center;gap:10px;padding:0 10px;border-bottom:1px solid #3c3c3c;font-size:11.5px;color:#9aa0a6;">',
        '  <span style="color:#e8eaed;">&#9673;</span>',
        '  <span style="color:#8ab4f8;">&#128683;</span>',
        '  <span>top</span>',
        '  <span style="opacity:.5;">|</span>',
        '  <span>Filter</span>',
        '  <span style="margin-left:auto;color:#f28b82;">&#10007; Errors</span>',
        '</div>',
        // Message rows
        '<div id="' +
          a.rowsId +
          '" style="flex:1;overflow:hidden;font-family:Consolas,\'Cascadia Mono\',monospace;font-size:12.5px;line-height:1.55;"></div>',
        // Prompt line
        '<div style="height:26px;display:flex;align-items:center;gap:8px;padding:0 10px;border-top:1px solid #3c3c3c;color:#8ab4f8;font-family:Consolas,monospace;font-size:12.5px;">',
        '  <span>&gt;</span>',
        '</div>',
      ].join('');

      document.documentElement.appendChild(panel);
      requestAnimationFrame(() => {
        panel.style.transform = 'translateY(0)';
      });
    },
    { panelId: PANEL_ID, rowsId: ROWS_ID, height: PANEL_HEIGHT, tab: activeTab },
  );

  await sleep(560);
}

/**
 * Reveals captured entries one at a time, the way they land in a real console.
 *
 * Paced rather than dumped: a wall of red appearing in a single frame is easy
 * to miss on video, and the point of this overlay is that the viewer reads the
 * error.
 */
export async function showConsoleEntries(
  page: Page,
  entries: ConsoleEntry[],
  perEntryMs = 900,
): Promise<void> {
  if (entries.length === 0) {
    await page.evaluate(
      (a: { rowsId: string }) => {
        const rows = document.getElementById(a.rowsId);
        if (!rows) return;
        const empty = document.createElement('div');
        empty.style.cssText = 'padding:10px 12px;color:#9aa0a6;';
        empty.textContent = 'No errors captured for this take.';
        rows.appendChild(empty);
      },
      { rowsId: ROWS_ID },
    );
    await sleep(700);
    return;
  }

  for (const entry of entries) {
    await page.evaluate(
      (a: { rowsId: string; level: string; text: string; source: string }) => {
        const rows = document.getElementById(a.rowsId);
        if (!rows) return;

        const isError = a.level === 'error';
        const row = document.createElement('div');
        row.style.cssText = [
          'display:flex',
          'align-items:flex-start',
          'gap:8px',
          'padding:5px 12px',
          isError
            ? 'background:#291616;border-bottom:1px solid #3c2020;color:#f28b82;'
            : 'background:#2a2519;border-bottom:1px solid #3a3320;color:#fdd663;',
        ].join(';');

        row.innerHTML =
          '<span style="opacity:.85;">' +
          (isError ? '&#10006;' : '&#9888;') +
          '</span>' +
          '<span style="flex:1;word-break:break-word;"></span>' +
          '<span style="color:#9aa0a6;white-space:nowrap;text-decoration:underline;"></span>';

        // textContent, not innerHTML: an error message can contain angle
        // brackets and this pane must show the message, not interpret it.
        (row.children[1] as HTMLElement).textContent = a.text;
        (row.children[2] as HTMLElement).textContent = a.source;

        rows.appendChild(row);
      },
      {
        rowsId: ROWS_ID,
        level: entry.level,
        text: entry.text,
        source: entry.source ?? '',
      },
    );
    await sleep(perEntryMs);
  }
}

/** Leaves the panel up long enough to read, then slides it away. */
export async function closeDevTools(page: Page, dwellMs = 2800): Promise<void> {
  await sleep(dwellMs);
  await page.evaluate(
    (a: { panelId: string; height: number }) => {
      const panel = document.getElementById(a.panelId);
      if (!panel) return;
      panel.style.transform = `translateY(${a.height}px)`;
      setTimeout(() => panel.remove(), 260);
    },
    { panelId: PANEL_ID, height: PANEL_HEIGHT },
  );
  await sleep(420);
}
