/**
 * A2UI — enabled on the runtime, inert in the browser, and the recording says so.
 *
 * https://docs.copilotkit.ai/angular/deepagents/guides/a2ui
 *
 * `a2ui: {}` in frontend/server.ts turns the middleware on and `/info` duly
 * reports `a2uiEnabled: true`. What actually registers the `render_a2ui`
 * renderer is supplying `a2ui.catalog` to provideCopilotKit — and the guide's
 * catalog snippet is not self-contained, so none is supplied. The agent answers
 * in prose and no declarative UI appears.
 *
 * Before any of that, the take stops on the harness's own /a2ui notes route,
 * marks the reconstructed `a2uiConfigForFeature` block and writes down that the
 * guide never declares the catalogs it returns, so that code was written here.
 * See actions/catalog-code.ts.
 *
 * ── Why this take is adaptive ──────────────────────────────────────────────
 * The QA report describes this as a "catalog not found" error, and the React
 * sibling repo reproduces it as a console error naming a specific URL
 * (`Catalog not found: https://a2ui.org/specification/v0_9/basic_catalog.json`).
 * This repo's own README describes something subtly different: A2UI that is
 * silently *inert*, with no error at all.
 *
 * Those are two different failures and they need two different videos. A
 * console error must be shown in a console, or the clip is a chat that sits
 * there doing nothing — indistinguishable on video from a slow model. A silent
 * no-op has no console to open, and opening an empty one would imply the error
 * exists when it does not.
 *
 * So the handler captures the console, asks for a surface, and then films
 * whichever failure actually happened. It does not decide in advance which
 * report is right, because both were written by people looking at different
 * builds.
 */
import { type Page } from 'playwright';

import { AgentSilentError, sendPrompt, waitForAgentResponseCompletion } from '../core/actions';
import {
  CATALOG_CODE_NOTE,
  parkNoteWindowRight,
  returnToDemo,
  showReconstructedCatalogCode,
} from './catalog-code';
import { writeScratchNote } from './scratch-note';
import { closeNotepad, openNotepad, typeInNotepad } from '../core/overlays/notepad';
import { humanGlide, sleep } from '../core/overlays/cursor';
import {
  captureConsole,
  closeDevTools,
  findEntries,
  openDevTools,
  showConsoleEntries,
} from '../core/overlays/devtools-console';
import { type PageActionHandler, type PageRecordConfig } from '../core/types';

/**
 * Anything the A2UI renderer would have mounted.
 *
 * The `.a2ui-*` classes are the guide's own, styled in frontend/src/styles.css;
 * `copilot-a2ui` is the element the Angular package renders when a catalog is
 * registered. If any of these appear, the finding below is stale.
 */
const A2UI_SURFACE =
  'copilot-a2ui, [class*="a2ui"], .a2ui-row, .a2ui-column, .a2ui-flight-card, .a2ui-chart-card';

/** Console noise that names the actual failure rather than framework chatter. */
const CATALOG_PATTERN = /catalog|a2ui|render_a2ui|basic_catalog/i;

/**
 * Types the catalog-code note beside the highlighted snippet.
 *
 * Spelled out rather than reusing `writeScratchNote`: that helper opens, types
 * and closes in one call, and the window has to be moved off centre in between
 * or it covers the very code the note is about.
 */
async function writeCatalogCodeNote(page: Page): Promise<void> {
  await openNotepad(page, 'a2ui-catalogs.txt');
  await parkNoteWindowRight(page);
  await typeInNotepad(page, CATALOG_CODE_NOTE.join('\n'), {
    charDelayMs: 34,
    thinkChance: 0.02,
  });
  await closeNotepad(page, 3000);
}

export const runA2uiAction: PageActionHandler = async (
  page: Page,
  config: PageRecordConfig,
) => {
  // First, whose code the catalog snippet is. Everything below shows that no
  // catalog is registered; this shows why one could not be — and that the
  // block on the notes route was written here rather than lifted from a guide
  // that never declares it. Ahead of the console capture on purpose: the
  // navigation it does would otherwise fill the capture with reload noise.
  if (await showReconstructedCatalogCode(page, config, writeCatalogCodeNote)) {
    await returnToDemo(page, config);
  }

  // Capture starts before the prompt: the fetch that fails happens while the
  // surface is being drawn, so a capture opened afterwards misses it.
  const capture = captureConsole(page);

  try {

    console.log(`   🎨 Asking for declarative UI: ${config.prompt}`);
    const msgCount = await sendPrompt(page, config.prompt, { timeoutMs: 12000 });

    // Whether the agent also fails to answer is not the finding, and losing the
    // rest of the take to an exception would throw away the thing it exists to
    // show. The engine still reports [ISSUE] either way.
    try {
      await waitForAgentResponseCompletion(page, config.waitAfterPromptMs ?? 5000, msgCount);
    } catch (e) {
      if (!(e instanceof AgentSilentError)) throw e;
      console.log(`   · No assistant reply — continuing to the evidence.`);
    }

    const rendered = await page.locator(A2UI_SURFACE).count().catch(() => 0);
    const catalogErrors = findEntries(capture, CATALOG_PATTERN, 3);

    if (rendered > 0) {
      // The finding is stale. Say so on the video rather than narrating a bug
      // that is no longer there — a clip asserting a fixed defect is worse than
      // no clip.
      console.log(
        `   ✅ ${rendered} A2UI element(s) rendered — a catalog is registered after all.`,
      );
      await humanGlide(page, 960, 460, 20);
      await sleep(5000);
      return;
    }

    // ── Nothing was drawn. Which of the two failures is it? ────────────────

    // Rest where the surface should have been, so the absence is deliberate
    // footage rather than an idle pause.
    await humanGlide(page, 760, 420, 20);
    await sleep(2600);

    if (catalogErrors.length > 0) {
      console.log(
        `   🐞 ${catalogErrors.length} catalog error(s) in the console — opening DevTools.`,
      );
      await openDevTools(page, 'Console');
      await showConsoleEntries(page, catalogErrors);
      await closeDevTools(page, 3500);
    } else {
      // No error anywhere: the renderer simply never activated. Opening an
      // empty console here would imply an error that does not exist.
      console.log(`   · No catalog error logged — the renderer is inert, not failing.`);
      await sleep(3000);
    }

    if (config.knownIssue) {
      await writeScratchNote(page, 'a2ui.txt', [
      'a2ui',
      '',
      'asked for a rendered card and got plain prose',
      'no component no error nothing in the console',
      '',
      'react build of this same guide at least logs',
      'catalog not found - here its just silent',
      '',
      'renderer never turns on - needs a2ui catalog',
      'and the guides catalog snippet isnt self contained',
    ]);
    }
  } finally {
    capture.stop();
  }
};
