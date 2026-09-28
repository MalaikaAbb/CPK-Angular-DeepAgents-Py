/**
 * A Windows Terminal window that replays REAL captured command output.
 *
 * Why replay instead of filming a live process: `ng serve` on a config that
 * does not compile never opens its port (verified: the dev server prints the
 * TS error and sits in watch mode with nothing listening), so there is no
 * browser error overlay to film -- the terminal IS where a person sees the
 * failure. Running the build live inside a take would put 10-20s of compile
 * and process management in the middle of the recording; capturing once and
 * replaying keeps the take deterministic, and the cast file is the evidence.
 *
 * Nothing on screen is invented: `captureCast` spawns the real command and
 * records every stdout/stderr chunk with its timestamp (asciinema v2), and
 * `playCastInTerminal` types the command that was run and replays those bytes.
 * The only liberties are the prompt string in front of the command and idle
 * gaps longer than `maxGapMs` being shortened (a 11s compile shows as ~4s).
 *
 * Port of the React recorders' core/cli (cast.ts + terminal.ts +
 * engine.playCastInTerminal), minus xterm.js: this repo's captures contain
 * only SGR colour codes (checked), so a small ANSI-to-HTML renderer is enough
 * and no dependency is added. Framework-agnostic, so it belongs in `core/`
 * next to the IDE simulator; it lives in `actions/` because `core/` is frozen.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { type Page } from 'playwright';

import { ensureOverlays } from '../core/overlays/taskbar';
import { humanGlide, sleep } from '../core/overlays/cursor';
import { pause } from '../core/overlays/human';

// ── Cast format (asciinema v2) ─────────────────────────────────────────────

export type CastEvent = [number, 'o' | 'i', string];

export interface CastHeader {
  version: 2;
  width: number;
  height: number;
  /** Unix seconds when the capture started. */
  timestamp: number;
  duration?: number;
  title?: string;
  /** Not in the asciinema spec: the exact command line that produced the output. */
  command?: string;
  /** Not in the spec: the directory it ran in (shown as the prompt). */
  cwd?: string;
  env?: Record<string, string>;
}

export interface Cast {
  header: CastHeader;
  events: CastEvent[];
}

export function readCast(file: string): Cast {
  const [head, ...rest] = readFileSync(file, 'utf8').split('\n').filter((l) => l.trim());
  return {
    header: JSON.parse(head) as CastHeader,
    events: rest.map((l) => JSON.parse(l) as CastEvent),
  };
}

export function writeCast(file: string, cast: Cast): void {
  mkdirSync(dirname(file), { recursive: true });
  const body = [JSON.stringify(cast.header), ...cast.events.map((e) => JSON.stringify(e))].join('\n');
  writeFileSync(file, body + '\n', 'utf8');
}

/** The cast's output with escape sequences stripped: what a person reads. */
export function castText(cast: Cast): string {
  return cast.events
    .filter(([, code]) => code === 'o')
    .map(([, , data]) => data)
    .join('')
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
}

/**
 * Credentials never reach a cast file or a video. Compiler output has none,
 * but a command that prints its environment would.
 */
function redact(text: string): string {
  return text
    .replace(/\b(sk|pk|rk)-[A-Za-z0-9_-]{16,}/g, '[REDACTED]')
    .replace(/\b(AKIA|ASIA)[A-Z0-9]{16}\b/g, '[REDACTED]')
    .replace(/((?:api[_-]?key|secret|token|password)\s*[=:]\s*)[^\s'"]+/gi, '$1[REDACTED]');
}

/** Kills a spawned shell and everything under it (npx -> ng -> node). */
function killTree(pid: number | undefined): void {
  if (!pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {}
    }
  }
}

export interface CaptureOptions {
  /** Run through the shell, exactly as a person would type it. */
  command: string;
  cwd: string;
  title?: string;
  /**
   * Stop once the stripped output matches this -- e.g. `/Watch mode enabled/`
   * for a dev server that failed and is now waiting, or `/Local:/` for one that
   * came up. The process tree is then killed (it would otherwise run forever).
   */
  stopWhen: RegExp;
  /** Keep recording this long after `stopWhen` matches, for trailing lines. */
  graceMs?: number;
  timeoutMs?: number;
}

/** Runs a real command and records its output with timings. */
export function captureCast(opts: CaptureOptions): Promise<Cast> {
  const started = Date.now();
  const events: CastEvent[] = [];
  const header: CastHeader = {
    version: 2,
    width: 140,
    height: 42,
    timestamp: Math.floor(started / 1000),
    title: opts.title,
    command: opts.command,
    cwd: opts.cwd,
    env: { TERM: 'xterm-256color' },
  };

  return new Promise((resolve, reject) => {
    const child = spawn(opts.command, {
      cwd: opts.cwd,
      shell: true,
      detached: process.platform !== 'win32',
      env: process.env,
    });
    let text = '';
    let stopping = false;
    let settled = false;

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      killTree(child.pid);
      header.duration = Number(((Date.now() - started) / 1000).toFixed(3));
      if (err) reject(err);
      else resolve({ header, events });
    };

    const onData = (buf: Buffer) => {
      const data = redact(buf.toString('utf8'));
      events.push([Number(((Date.now() - started) / 1000).toFixed(6)), 'o', data]);
      // eslint-disable-next-line no-control-regex
      text += data.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
      if (!stopping && opts.stopWhen.test(text)) {
        stopping = true;
        setTimeout(() => finish(), opts.graceMs ?? 1500);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (e) => finish(e));
    child.on('exit', () => {
      // A command that exits on its own (ng build) is complete when it exits.
      setTimeout(() => finish(), 200);
    });
    const timer = setTimeout(
      () => finish(new Error(`capture timed out after ${opts.timeoutMs ?? 180000}ms: ${opts.command}`)),
      opts.timeoutMs ?? 180000,
    );
  });
}

// ── Replay ─────────────────────────────────────────────────────────────────

const TERMINAL_ROUTE_PATH = '/__autorecord_terminal__';

function embedJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface TerminalRenderOptions {
  cast: Cast;
  /** Title-bar text. */
  title?: string;
  /** Prompt shown before the typed command. Defaults to a PowerShell prompt in cast.header.cwd. */
  prompt?: string;
  fontSize?: number;
  /** Idle gaps longer than this are shortened to it. */
  maxGapMs?: number;
}

export function generateTerminalHtml(opts: TerminalRenderOptions): string {
  const { cast } = opts;
  const title = opts.title ?? cast.header.title ?? 'Windows PowerShell';
  const prompt = opts.prompt ?? `PS ${cast.header.cwd ?? 'C:\\'}> `;
  const fontSize = opts.fontSize ?? 15;
  const maxGapMs = opts.maxGapMs ?? 4000;
  const output = cast.events.filter(([, code]) => code === 'o');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
<style>
  html, body { margin:0; padding:0; height:100%; background:#1e1e1e; overflow:hidden; font-family:'Segoe UI',system-ui,sans-serif; }
  #desktop { height:100vh; display:flex; align-items:flex-start; justify-content:center; padding-top:38px; box-sizing:border-box;
    background:linear-gradient(135deg,#0f2027 0%,#16222a 55%,#1e1e1e 100%); }
  #window { width:1500px; max-width:94vw; height:900px; border-radius:8px; overflow:hidden; background:#0c0c0c;
    box-shadow:0 24px 64px rgba(0,0,0,.65),0 0 0 1px rgba(255,255,255,.06); display:flex; flex-direction:column; }
  #titlebar { height:36px; background:#1f1f1f; display:flex; align-items:center; justify-content:space-between; padding-left:8px;
    border-bottom:1px solid rgba(255,255,255,.06); flex:none; }
  #tab { display:flex; align-items:center; gap:8px; height:28px; padding:0 14px; border-radius:6px 6px 0 0; background:#0c0c0c; color:#e5e7eb; font-size:12.5px; }
  #controls { display:flex; } #controls span { width:46px; height:36px; display:flex; align-items:center; justify-content:center; color:#d1d5db; font-size:11px; }
  #term { flex:1; overflow:hidden; padding:12px 16px 16px; box-sizing:border-box; color:#cccccc;
    font-family:'Cascadia Mono','Cascadia Code',Consolas,'Courier New',monospace; font-size:${fontSize}px; line-height:1.4; }
  .ln { white-space:pre-wrap; word-break:break-all; min-height:1.4em; }
  .ln.focus { background:rgba(59,120,255,.16); box-shadow:inset 3px 0 0 #3b78ff; }
  #caret { display:inline-block; width:.6em; height:1.15em; background:#cccccc; vertical-align:text-bottom; animation:blink 1.05s steps(1) infinite; }
  @keyframes blink { 50% { opacity:0; } }
</style>
<style>@keyframes __arWinIn{from{opacity:0;transform:scale(.992)}to{opacity:1;transform:none}}body{animation:__arWinIn .18s ease-out both}</style>
</head><body>
<div id="desktop"><div id="window">
  <div id="titlebar"><div id="tab">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="m5 8 4 4-4 4" stroke="#34d399" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="16" x2="18" y2="16" stroke="#9ca3af" stroke-width="2.2" stroke-linecap="round"/></svg>
    <span>${escapeHtml(title)}</span></div>
    <div id="controls"><span>&#8211;</span><span>&#9723;</span><span>&#10005;</span></div></div>
  <div id="term"></div>
</div></div>
<script>
(function () {
  var EVENTS = ${embedJson(output)};
  var PROMPT = ${embedJson(prompt)};
  var COMMAND = ${embedJson(cast.header.command ?? '')};
  var MAX_GAP = ${maxGapMs};
  var term = document.getElementById('term');
  var FG = { 30:'#0c0c0c',31:'#e74856',32:'#16c60c',33:'#f9f1a5',34:'#3b78ff',35:'#b4009e',36:'#61d6d6',37:'#cccccc',
             90:'#767676',91:'#e74856',92:'#16c60c',93:'#f9f1a5',94:'#3b78ff',95:'#b4009e',96:'#61d6d6',97:'#f2f2f2' };
  var st = { fg:null, bg:null, bold:false };
  var line, caret = document.createElement('span'); caret.id = 'caret';
  function newLine() { line = document.createElement('div'); line.className = 'ln'; term.appendChild(line); line.appendChild(caret); }
  function put(text) {
    if (!text) return;
    var s = document.createElement('span'); s.textContent = text;
    if (st.fg) s.style.color = st.fg; if (st.bg) s.style.background = st.bg; if (st.bold) s.style.fontWeight = '700';
    line.insertBefore(s, caret);
  }
  function sgr(params) {
    var ps = params === '' ? [0] : params.split(';').map(Number);
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (p === 0) st = { fg:null, bg:null, bold:false };
      else if (p === 1) st.bold = true; else if (p === 22) st.bold = false;
      else if (p === 39) st.fg = null; else if (p === 49) st.bg = null;
      else if (FG[p]) st.fg = FG[p];
      else if ((p >= 40 && p <= 47) || (p >= 100 && p <= 107)) st.bg = FG[p - 10];
    }
  }
  function write(data) {
    var re = /\\x1b\\[([0-9;?]*)([A-Za-z])/g, last = 0, m;
    function plain(t) {
      t = t.replace(/\\r\\n/g, '\\n');
      var parts = t.split('\\n');
      for (var i = 0; i < parts.length; i++) {
        if (i > 0) newLine();
        var seg = parts[i];
        var cr = seg.lastIndexOf('\\r');
        if (cr >= 0) { while (line.firstChild !== caret) line.removeChild(line.firstChild); seg = seg.slice(cr + 1); }
        put(seg);
      }
    }
    while ((m = re.exec(data))) { plain(data.slice(last, m.index)); if (m[2] === 'm') sgr(m[1]); last = re.lastIndex; }
    plain(data.slice(last));
    term.scrollTop = term.scrollHeight;
  }
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  newLine(); put(PROMPT);
  window.__termDone = false;

  window.__startReplay = async function () {
    await sleep(700);
    for (var i = 0; i < COMMAND.length; i++) {
      put(COMMAND[i]);
      await sleep(COMMAND[i] === ' ' ? 70 : 38 + Math.random() * 45);
    }
    await sleep(450);
    newLine();
    var prev = 0;
    for (var j = 0; j < EVENTS.length; j++) {
      var gap = (EVENTS[j][0] - prev) * 1000; prev = EVENTS[j][0];
      if (gap > 16) await sleep(Math.min(gap, MAX_GAP));
      write(EVENTS[j][2]);
    }
    await sleep(600);
    window.__termDone = true;
  };

  /** Scrolls so the first line containing text sits near the top, marks it, returns its box. */
  window.__termFocus = async function (text, occurrence) {
    var lines = term.querySelectorAll('.ln'), hits = [];
    for (var i = 0; i < lines.length; i++) if (lines[i].textContent.indexOf(text) >= 0) hits.push(lines[i]);
    var el = hits[Math.min(occurrence || 0, hits.length - 1)];
    if (!el) return null;
    var prevFocus = term.querySelectorAll('.ln.focus');
    for (var k = 0; k < prevFocus.length; k++) prevFocus[k].classList.remove('focus');
    var target = Math.max(0, el.offsetTop - term.offsetTop - 60);
    var from = term.scrollTop, steps = 24;
    for (var s = 1; s <= steps; s++) {
      var t = s / steps, e = t < .5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;
      term.scrollTop = from + (target - from) * e; await sleep(22);
    }
    el.classList.add('focus');
    var r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  };
})();
</script></body></html>`;
}

export interface PlayOptions extends TerminalRenderOptions {
  /** Origin to serve the window from (intercepted, never hits the network). */
  origin: string;
  /**
   * After the replay, scroll back to each of these in turn and rest the cursor
   * on it -- a person scrolling up to the error that matters. Each entry is a
   * substring of an output line, optionally with which occurrence.
   */
  focus?: Array<string | { text: string; occurrence?: number; holdMs?: number }>;
  /** Hold on the final frame (or on each focus line). */
  holdMs?: number;
}

/** Navigates to the terminal window, types the command and replays its real output. */
export async function playCastInTerminal(page: Page, opts: PlayOptions): Promise<void> {
  const html = generateTerminalHtml(opts);
  const url = new URL(`${TERMINAL_ROUTE_PATH}?t=${Date.now()}`, opts.origin).toString();
  await page.route(url, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }),
  );
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await ensureOverlays(page, 'vscode');
  await markTerminalActive(page);
  await sleep(300);
  // The hand rests near the prompt while the command is typed.
  await humanGlide(page, 520, 150, 16);

  await page.evaluate('window.__startReplay()');
  const out = opts.cast.events.filter(([, c]) => c === 'o');
  const maxGap = opts.maxGapMs ?? 4000;
  let budget = 0;
  let prev = 0;
  for (const [t] of out) {
    budget += Math.min((t - prev) * 1000, maxGap);
    prev = t;
  }
  await page.waitForFunction('window.__termDone === true', undefined, {
    timeout: budget + (opts.cast.header.command?.length ?? 0) * 120 + 60_000,
    polling: 250,
  });
  await pause(opts.holdMs ?? 1500);

  for (const f of opts.focus ?? []) {
    const spec = typeof f === 'string' ? { text: f } : f;
    const box = (await page.evaluate(
      ([text, occ]) => (window as any).__termFocus(text, occ),
      [spec.text, spec.occurrence ?? 0] as const,
    )) as { x: number; y: number; width: number; height: number } | null;
    if (box) {
      await humanGlide(page, box.x + Math.min(360, box.width / 3), box.y + box.height / 2, 18);
    }
    await pause(spec.holdMs ?? opts.holdMs ?? 2600);
  }

  await Promise.race([page.unroute(url).catch(() => {}), sleep(3000)]);
}

/** The taskbar's terminal tile lit, the others dimmed. */
export async function markTerminalActive(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      for (const id of ['win11-taskbar-chrome', 'win11-taskbar-vscode']) {
        const el = document.getElementById(id);
        if (el) el.style.backgroundColor = 'transparent';
      }
      for (const id of ['win11-chrome-indicator', 'win11-vscode-indicator']) {
        const el = document.getElementById(id);
        if (el) {
          el.style.background = 'rgba(255,255,255,0.4)';
          el.style.width = '6px';
        }
      }
      const tile = document.getElementById('win11-taskbar-terminal');
      if (tile) {
        tile.style.backgroundColor = 'rgba(255,255,255,0.08)';
        tile.style.position = 'relative';
        let ind = document.getElementById('win11-terminal-indicator');
        if (!ind) {
          ind = document.createElement('div');
          ind.id = 'win11-terminal-indicator';
          tile.appendChild(ind);
        }
        ind.style.cssText =
          'position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:16px;height:3px;background:#60a5fa;border-radius:2px;';
      }
    })
    .catch(() => {});
}

/** True when the cast exists and is newer than every file it compiled. */
export function castIsFresh(castFile: string, sources: string[]): { fresh: boolean; reason?: string } {
  if (!existsSync(castFile)) return { fresh: false, reason: `missing ${castFile}` };
  const cast = readCast(castFile);
  for (const src of sources) {
    if (!existsSync(src)) continue;
    const { mtimeMs } = statSync(src);
    if (mtimeMs / 1000 > cast.header.timestamp + 1) {
      return { fresh: false, reason: `${src} changed after the capture` };
    }
  }
  return { fresh: true };
}
