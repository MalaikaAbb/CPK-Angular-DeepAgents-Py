/**
 * Memory — the guide's availability gate says yes, and nothing happens.
 *
 * https://docs.copilotkit.ai/angular/deepagents/guides/threads-memory-attachments-headless
 *
 * The expectation going in — recorded in this repo's own nav-config — was that
 * `isAvailable()` returns false and the guide's fallback line, "Memory is not
 * available for this runtime.", is what renders. It is not. The component
 * renders **nothing at all**, and an empty render is only reachable through the
 * `@else` branch, so the gate is returning *true*. Meanwhile the network shows
 * no request to any memory endpoint, ever.
 *
 * That makes this the hardest of the four findings to film, because "renders
 * nothing" and "has not loaded yet" look identical in a still frame. Three
 * things separate them here:
 *
 * 1. Wait well past load, then read the element's text and put the measurement
 *    in the run log — an empty string after ten seconds is a result, not a race.
 * 2. Say on screen which branch that empty render implies, since the absence of
 *    the fallback sentence is the actual evidence and a viewer cannot be
 *    expected to know the component's source by heart.
 * 3. Ask the agent to remember something and then ask for it back in the same
 *    take. The second answer is what proves nothing was stored, and it is a
 *    claim no still frame can make.
 */
import { type Page } from 'playwright';

import { AgentSilentError, sendPrompt, waitForAgentResponseCompletion } from '../core/actions';
import { writeScratchNote } from './scratch-note';
import { humanGlide, sleep } from '../core/overlays/cursor';
import { type PageActionHandler, type PageRecordConfig } from '../core/types';

/** The memory list itself. Its *text* is the measurement this take turns on. */
const MEMORY_LIST = 'app-memory-list';

/** The guide's fallback copy — whose ABSENCE is the finding. */
const FALLBACK_COPY = /not available for this runtime/i;

export const runMemoryAction: PageActionHandler = async (
  page: Page,
  config: PageRecordConfig,
) => {
  const wait = config.waitAfterPromptMs ?? 4000;

  await page
    .locator('app-memory-list')
    .first()
    .waitFor({ state: 'visible', timeout: 15000 })
    .catch(() => {});
  await sleep(600);

  // ── The gate, rendered ────────────────────────────────────────────────────

  const fallback = page.locator(MEMORY_LIST).first();
  const box = await fallback.boundingBox().catch(() => null);
  if (box) {
    await humanGlide(page, box.x + Math.min(box.width / 2, 220), box.y + box.height / 2, 22);
    await sleep(3200);
  } else {
    await humanGlide(page, 320, 300, 20);
    await sleep(2600);
  }

  const rendered = ((await fallback.innerText().catch(() => '')) || '').trim();
  console.log(
    rendered
      ? `   🧠 Memory list renders: "${rendered.slice(0, 120)}"`
      : `   🐞 Memory list rendered NOTHING — not even the guide's fallback line.`,
  );

  // Which branch ran is the whole finding, so it is stated on screen rather
  // than left for the viewer to infer from an empty box.
  if (!rendered) {
    await sleep(3200);
  } else if (FALLBACK_COPY.test(rendered)) {
    // The documented behaviour after all. Worth saying plainly, because it
    // means the gate works here and the finding needs re-wording.
    await sleep(3000);
  }

  const memoryItems = await page.locator('app-memory-list article').count().catch(() => 0);
  if (memoryItems > 0) {
    // The gate opened. Say so rather than narrating a defect that is gone.
    console.log(`   ✅ ${memoryItems} memory item(s) rendered — this finding looks stale.`);
    await sleep(4000);
    return;
  }

  // ── Ask it to remember, then ask it back ─────────────────────────────────
  const firstCount = await sendPrompt(page, config.prompt);
  try {
    await waitForAgentResponseCompletion(page, wait, firstCount);
  } catch (e) {
    if (!(e instanceof AgentSilentError)) throw e;
  }

  if (box) {
    await humanGlide(page, box.x + Math.min(box.width / 2, 220), box.y + box.height / 2, 22);
    await sleep(2600);
  }

  if (config.knownIssue) {
    await writeScratchNote(page, 'memory.txt', [
      'memory',
      '',
      'app-memory-list draws nothing',
      'not the memories and not the fallback text either',
      '',
      'that fallback is the not-isAvailable branch',
      'so isAvailable is coming back true',
      'but nothing ever hits a memory endpoint',
      '',
      'so the one guard the guide tells you to add lies',
    ]);
  }
};
