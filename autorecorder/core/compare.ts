import { type Page } from 'playwright';
import { demoUrlFor } from '../config/project.config';
import { SELECTORS } from '../config/selectors.config';
import { sendPrompt, waitForAgentResponseCompletion } from './actions';
import { showCaption } from './overlays/caption';
import { humanGlide, sleep } from './overlays/cursor';
import { ensureOverlays } from './overlays/taskbar';

/**
 * The second half of a defect take: the same page, on code that works.
 *
 * A clip of something failing is weak evidence on its own. The reader's first
 * question is always whether the demo was wired up wrong, and a video cannot
 * answer that by insisting. It can answer it by doing the same thing twice --
 * once on the code the documentation prints, once with the one line the
 * documentation omits -- and letting the difference be the whole argument.
 *
 * That is why this repo carries paired routes. `/shared-state/in-app-agent-write`
 * is the doc's code verbatim; `/shared-state/in-app-agent-write/fixed` is the
 * same page against a graph built with `CopilotKitMiddleware(expose_state=[...])`.
 * Nothing else differs, which is exactly what makes the pair worth recording.
 *
 * Only build a pair where the fix is actually known. Two of the defects here
 * have no established fix, and a "fixed" route that quietly does something else
 * would be worse evidence than no second route at all.
 */
export interface WorkingVariantOptions {
  /** Route of the working variant, without a leading slash. `demoSuffix` is appended. */
  route: string;

  /** What to ask it. Usually the same prompt the failing half was given. */
  prompt: string;

  /** Caption shown while this half plays. Say what changed, not that it works. */
  caption: string;

  /** Reading pause once the reply has finished streaming. */
  waitAfterPromptMs?: number;

  /**
   * Selector for the element that proves the difference -- the state panel, the
   * steps list. The cursor rests on it before the prompt goes in, so the viewer
   * is looking at the right half of the screen when the answer arrives.
   */
  proofSelector?: string;

  /**
   * Anything the page needs done before the prompt, on this route.
   *
   * The writing-state pair needs it: the fixed graph seeds `language` to
   * english, so a prompt sent straight after loading gets an English answer and
   * demonstrates nothing. The toggle has to be clicked here, exactly as it was
   * on the failing half, or the two halves are not the same experiment.
   */
  beforePrompt?: (page: Page) => Promise<void>;
}

/**
 * Navigates to the working variant and drives it with the same prompt.
 *
 * Overlays are re-installed after the navigation: they are children of `<html>`,
 * which the new document replaces wholesale, so without this the taskbar
 * disappears halfway through the take.
 */
export async function showWorkingVariant(
  page: Page,
  opts: WorkingVariantOptions,
): Promise<void> {
  const url = demoUrlFor(opts.route);
  console.log(`   [Compare] Opening the working variant at ${url}...`);

  await sleep(900);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await ensureOverlays(page, 'chrome');
  await page.waitForSelector(SELECTORS.chatReady, { state: 'visible', timeout: 20000 });
  await sleep(1200);

  await showCaption(page, opts.caption, 'good');
  await sleep(900);

  if (opts.proofSelector) {
    const proof = page.locator(opts.proofSelector).first();
    if (await proof.isVisible({ timeout: 4000 }).catch(() => false)) {
      const box = await proof.boundingBox();
      if (box) {
        await humanGlide(page, box.x + Math.min(box.width / 2, 200), box.y + 20, 22);
        await sleep(800);
      }
    }
  }

  if (opts.beforePrompt) {
    await opts.beforePrompt(page);
    await sleep(700);
  }

  const msgCount = await sendPrompt(page, opts.prompt, { timeoutMs: 12000 });
  await waitForAgentResponseCompletion(page, opts.waitAfterPromptMs ?? 3500, msgCount);
}
