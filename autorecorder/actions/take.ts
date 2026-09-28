/**
 * A scripted take: a list of human steps, played in order, after the engine
 * has done its standard intro (doc skim -> IDE -> demo route).
 *
 * For clips that follow a written script rather
 * than "send a prompt and watch": go back to a specific doc snippet, open a
 * given file at a given line, run a command in a terminal, write what was
 * seen in Notepad. Every step switches apps the way a person does -- a click
 * on the taskbar icon -- and every note is typed on camera, held long enough
 * to read, then closed.
 *
 *   doc       the doc page, scrolled to each code block containing a snippet,
 *             each drag-selected
 *   ide       the simulated VS Code (core/ide/generator), one tab per file,
 *             each scrolled to and drag-selected over its range
 *   browser   any URL, rested on an element
 *   terminal  a REAL captured command replayed (actions/terminal.ts)
 *   note      Notepad over whatever is on screen: open, type, hold, close
 *
 * Why the engine's own intro still runs first: `recordPage` always shows the
 * doc, then the IDE, then waits for `chatReady` on the page's route before a
 * handler gets control, and core/ is frozen. So a take's page entry points its
 * route at a WORKING demo page and uses the intro for the working code; the
 * take then does the script's beats.
 *
 * Framework-agnostic; would sit in core/ beside the engine if core/ were open.
 */
import { basename } from 'node:path';
import { type Page } from 'playwright';

import { generateIdeHtml, type IdeTabConfig } from '../core/ide/generator';
import { beat, humanClick, humanGlide, sleep } from '../core/overlays/cursor';
import { between, jitter, pause } from '../core/overlays/human';
import { clickTaskbarApp, ensureOverlays, waitForHydration } from '../core/overlays/taskbar';
import { SELECTORS } from '../config/selectors.config';
import { closeNotepadNote, openNotepadWindow, typeInNotepad } from './notepad';
import { playCastInTerminal, readCast, type PlayOptions } from './terminal';

export type TakeStep =
  | {
      kind: 'doc';
      url: string;
      /** A substring of each code block to visit, in order. */
      snippets: string[];
      dwellMs?: number;
    }
  | { kind: 'ide'; tabs: IdeTabConfig[]; dwellMs?: number }
  | { kind: 'browser'; url: string; waitFor?: string; restOn?: string; dwellMs?: number }
  | {
      kind: 'terminal';
      /** Path to an asciinema v2 cast produced by captureCast. */
      cast: string;
      title?: string;
      focus?: PlayOptions['focus'];
      holdMs?: number;
    }
  | {
      kind: 'note';
      /** Notepad title, e.g. 'clip3.txt'. */
      title: string;
      /** One spoken line per beat; each entry is typed as its own line. */
      lines: string[];
      /** Hold after typing. Default scales with the text: time to read it back. */
      holdMs?: number;
      /** Where the window sits; pick the half the evidence is NOT in. Default bottom. */
      at?: 'top' | 'bottom';
    };

export interface TakeOptions {
  /** Origin the simulated windows are served from (the frontend's). */
  origin: string;
  rootDir: string;
}

type App = 'chrome' | 'vscode' | 'terminal';

/** Glide to a taskbar tile and click it. */
async function clickTaskbarTile(page: Page, id: string): Promise<void> {
  const box = await page.locator(`#${id}`).boundingBox().catch(() => null);
  if (box) await humanGlide(page, box.x + box.width / 2, box.y + box.height / 2, 22);
  await humanClick(page);
  await sleep(150);
}

async function switchTo(page: Page, app: App): Promise<void> {
  if (app === 'terminal') await clickTaskbarTile(page, 'win11-taskbar-terminal');
  else await clickTaskbarApp(page, app);
}

// ── doc ────────────────────────────────────────────────────────────────────

/** Scrolls the doc's scroller (or window) so `pre` sits ~150px from the top, in wheel-like bursts. */
async function scrollBlockIntoView(page: Page, snippet: string): Promise<boolean> {
  for (let burst = 0; burst < 30; burst++) {
    const remaining = (await page
      .evaluate(
        ({ sel, snippet }) => {
          // The tightest element holding the snippet: the code block itself,
          // not a wrapper that happens to contain every block on the page.
          const pre = (Array.from(document.querySelectorAll(sel)) as HTMLElement[])
            .filter((el) => el.innerText?.includes(snippet) && el.getBoundingClientRect().height > 30)
            .sort((a, b) => a.innerText.length - b.innerText.length)[0];
          if (!pre) return null;
          const inner = pre.closest('pre') ?? (pre.querySelector('pre') as HTMLElement | null) ?? pre;
          (window as any).__takeBlock = inner;
          let sc: HTMLElement | null = inner.parentElement;
          // The page's scroller, not a code block's own max-height overflow.
          while (
            sc &&
            !(
              sc.scrollHeight > sc.clientHeight + 40 &&
              sc.clientHeight > window.innerHeight * 0.5 &&
              /(auto|scroll)/.test(getComputedStyle(sc).overflowY)
            )
          ) {
            sc = sc.parentElement;
          }
          (window as any).__takeScroller = sc;
          const delta = inner.getBoundingClientRect().top - 150;
          const step = Math.abs(delta) < 500 ? delta : Math.sign(delta) * (620 + Math.random() * 220);
          if (sc) sc.scrollBy({ top: step, behavior: 'smooth' });
          else window.scrollBy({ top: step, behavior: 'smooth' });
          return delta;
        },
        { sel: SELECTORS.docCodeBlock, snippet },
      )
      .catch(() => null)) as number | null;
    if (remaining === null) return false;
    await sleep(jitter(Math.abs(remaining) < 500 ? 650 : 330, 0.3));
    if (Math.abs(remaining) < 500) return true;
  }
  return false;
}

/** Drag-selects the block found by scrollBlockIntoView, from its first line down. */
async function dragSelectBlock(page: Page): Promise<void> {
  const box = (await page
    .evaluate(() => {
      const el = (window as any).__takeBlock as HTMLElement | null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    })
    .catch(() => null)) as { x: number; y: number; width: number; height: number } | null;
  if (!box) return;
  const x0 = box.x + 16;
  const y0 = box.y + 14;
  const y1 = Math.min(box.y + box.height - 14, 1000);
  const x1 = box.x + Math.min(box.width - 16, 520);
  await humanGlide(page, x0, y0, 18);
  await sleep(between(60, 140));
  const steps = 18;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t + between(-3, 3);
    const y = y0 + (y1 - y0) * t;
    await page
      .evaluate(
        ({ sx, sy, x, y }) => {
          const c = document.getElementById('playwright-virtual-mouse');
          if (c) {
            c.style.left = x.toFixed(1) + 'px';
            c.style.top = y.toFixed(1) + 'px';
          }
          const block = (window as any).__takeBlock as HTMLElement | null;
          const sel = window.getSelection();
          const from = (document as any).caretRangeFromPoint?.(sx, sy) as Range | null;
          const to = (document as any).caretRangeFromPoint?.(x, y) as Range | null;
          if (!block || !sel || !from || !to || !block.contains(to.startContainer)) return;
          const range = document.createRange();
          range.setStart(from.startContainer, from.startOffset);
          range.setEnd(to.startContainer, to.startOffset);
          sel.removeAllRanges();
          sel.addRange(range);
        },
        { sx: x0, sy: y0, x, y },
      )
      .catch(() => {});
    await sleep(jitter(55, 0.35));
  }
}

async function docStep(page: Page, step: Extract<TakeStep, { kind: 'doc' }>): Promise<string[]> {
  const missing: string[] = [];
  console.log(`   📖 Doc: ${step.url}`);
  await page.goto(step.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector(SELECTORS.docContentReady, { state: 'visible', timeout: 8000 }).catch(() => {});
  await ensureOverlays(page, 'chrome');
  await waitForHydration(page, 15000);
  await sleep(600);
  for (const snippet of step.snippets) {
    await page.evaluate(() => window.getSelection()?.removeAllRanges()).catch(() => {});
    const found = await scrollBlockIntoView(page, snippet);
    if (!found) {
      missing.push(snippet);
      continue;
    }
    await dragSelectBlock(page);
    await pause(step.dwellMs ?? 2600);
  }
  return missing;
}

// ── ide ────────────────────────────────────────────────────────────────────

let ideSeq = 0;

async function ideStep(page: Page, step: Extract<TakeStep, { kind: 'ide' }>, opts: TakeOptions): Promise<void> {
  const [first, ...extra] = step.tabs;
  console.log(`   💻 IDE: ${step.tabs.map((t) => `${basename(t.filePath)}:${t.startLine}-${t.endLine}`).join(', ')}`);
  const html = await generateIdeHtml(opts.rootDir, first.filePath, first.startLine, first.endLine, extra, 0);
  const url = new URL(`/__autorecord_take_ide_${++ideSeq}__`, opts.origin).toString();
  await page.route(url, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: html.replace(
        '</head>',
        '<style>@keyframes __arWinIn{from{opacity:0;transform:scale(.992)}to{opacity:1;transform:none}}body{animation:__arWinIn .18s ease-out both}</style></head>',
      ),
    }),
  );
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await ensureOverlays(page, 'vscode');
  await sleep(300);

  for (let idx = 0; idx < step.tabs.length; idx++) {
    const tab = step.tabs[idx];
    if (idx > 0) {
      const tBox = await page.locator(`#ide-tab-${idx}`).boundingBox().catch(() => null);
      if (tBox) {
        await humanGlide(page, tBox.x + tBox.width / 2, tBox.y + tBox.height / 2, 18);
        await humanClick(page);
      }
      await page.evaluate(`window.switchIdeTab && window.switchIdeTab(${idx})`).catch(() => {});
      await sleep(350);
    }
    // Scroll the range into the upper part of the pane (22px per line).
    if (tab.startLine > 12) {
      await page
        .evaluate(
          ({ idx, top }) => {
            const vp = document.querySelector(`#ide-view-${idx} .code-viewport`) as HTMLElement | null;
            if (vp) vp.scrollTo({ top, behavior: 'smooth' });
          },
          { idx, top: Math.max(0, (tab.startLine - 6) * 22) },
        )
        .catch(() => {});
      await sleep(700);
    }
    // Press at the first line, drag down to the last.
    const row = (n: number) => page.locator(`#ide-view-${idx} .code-line[data-line="${n}"] .line-content`);
    const firstBox = await row(tab.startLine).boundingBox().catch(() => null);
    const lastBox = await row(tab.endLine).boundingBox().catch(() => null);
    if (firstBox) {
      await humanGlide(page, firstBox.x + 6, firstBox.y + firstBox.height / 2, 18);
      await sleep(between(60, 140));
    }
    for (let n = tab.startLine; n <= tab.endLine; n++) {
      await page.evaluate(`window.selectIdeLines && window.selectIdeLines(${idx}, ${tab.startLine}, ${n})`).catch(() => {});
      if (firstBox && lastBox && tab.endLine > tab.startLine) {
        const t = (n - tab.startLine) / (tab.endLine - tab.startLine);
        const y = firstBox.y + firstBox.height / 2 + (lastBox.y - firstBox.y) * t;
        const x = firstBox.x + 6 + Math.min(260, (n - tab.startLine) * 9);
        await page
          .evaluate(`(function(){var c=document.getElementById('playwright-virtual-mouse');if(c){c.style.left='${x.toFixed(1)}px';c.style.top='${y.toFixed(1)}px';}})()`)
          .catch(() => {});
      }
      await sleep(jitter(Math.min(45, Math.max(14, 1100 / Math.max(1, tab.endLine - tab.startLine))), 0.35));
    }
    await pause(step.dwellMs ?? 2600);
  }
  await Promise.race([page.unroute(url).catch(() => {}), sleep(3000)]);
}

// ── browser ────────────────────────────────────────────────────────────────

async function browserStep(page: Page, step: Extract<TakeStep, { kind: 'browser' }>): Promise<void> {
  console.log(`   🌐 Browser: ${step.url}`);
  await page.goto(step.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await ensureOverlays(page, 'chrome');
  if (step.waitFor) await page.waitForSelector(step.waitFor, { state: 'visible', timeout: 20000 }).catch(() => {});
  if (step.restOn) {
    const box = await page.locator(step.restOn).first().boundingBox().catch(() => null);
    if (box) await humanGlide(page, box.x + Math.min(box.width / 2, 200), box.y + Math.min(box.height / 2, 40), 20);
  }
  await pause(step.dwellMs ?? 2500);
}

// ── note ───────────────────────────────────────────────────────────────────

async function noteStep(page: Page, step: Extract<TakeStep, { kind: 'note' }>): Promise<void> {
  console.log(`   📝 Note: ${step.lines.join(' ')}`);
  // Anchored to the bottom of the screen, above the taskbar: the evidence the
  // note is about (a selected snippet, an error line scrolled to the top of
  // the terminal) stays visible above it.
  const height = 120 + step.lines.length * 40;
  const top = step.at === 'top' ? 90 : 1080 - 48 - 28 - height;
  await openNotepadWindow(page, step.title, {
    top: `${top}px`,
    width: '1180px',
    height: `${height}px`,
    fontSize: '22px',
  });
  await typeInNotepad(page, step.lines, 960, top + 110);
  // Enough to read it back once it is all on screen: a floor, plus ~35ms a character.
  const chars = step.lines.join(' ').length;
  await beat(step.holdMs ?? Math.min(9000, 2200 + chars * 35));
  await closeNotepadNote(page);
  await pause(600);
}

// ── runner ─────────────────────────────────────────────────────────────────

export interface TakeReport {
  /** Doc snippets that were not found on the live page (the doc changed). */
  missingSnippets: string[];
}

export async function runTake(page: Page, steps: TakeStep[], opts: TakeOptions): Promise<TakeReport> {
  const report: TakeReport = { missingSnippets: [] };
  let current: App = 'chrome';
  for (const step of steps) {
    const target: App | null =
      step.kind === 'doc' || step.kind === 'browser' ? 'chrome' : step.kind === 'ide' ? 'vscode' : step.kind === 'terminal' ? 'terminal' : null;
    // Opening an app is a taskbar click; a note opens over whatever is showing.
    if (target && target !== current) {
      await switchTo(page, target);
      current = target;
    }
    switch (step.kind) {
      case 'doc':
        report.missingSnippets.push(...(await docStep(page, step)));
        break;
      case 'ide':
        await ideStep(page, step, opts);
        break;
      case 'browser':
        await browserStep(page, step);
        break;
      case 'terminal':
        console.log(`   ⌨️  Terminal: replaying ${basename(step.cast)}`);
        await playCastInTerminal(page, {
          cast: readCast(step.cast),
          title: step.title,
          origin: opts.origin,
          focus: step.focus,
          holdMs: step.holdMs,
        });
        break;
      case 'note':
        await noteStep(page, step);
        break;
    }
  }
  return report;
}
