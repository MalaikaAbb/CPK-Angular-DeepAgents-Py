/**
 * Human-in-the-loop — the decision tool, where the model chooses to ask.
 *
 * https://docs.copilotkit.ai/angular/deepagents/guides/human-in-the-loop
 *
 * The prompt is phrased to make the agent reach for `requestApproval` rather
 * than answer directly; the recording is only worth anything if the card
 * actually appears and the run visibly resumes after the click.
 *
 * The page's other half — the interrupt controller — is on the same route,
 * mounted above the chat. It cannot be made to fire: this backend emits no
 * AG-UI interrupt, so the panel stays blank for the whole take. The route
 * states that itself, which is what the pass over it at the end is for; a
 * headless panel that is idle looks exactly like one that has failed.
 */
import { type Page } from 'playwright';

import { sendPrompt, waitForAgentResponseCompletion } from '../core/actions';
import { humanClick, humanGlide, sleep } from '../core/overlays/cursor';
import { type PageActionHandler, type PageRecordConfig } from '../core/types';

export const runHitlAction: PageActionHandler = async (
  page: Page,
  config: PageRecordConfig,
  _rootPath,
  ctx,
) => {
  console.log(`   🛡️ Asking for something consequential enough to need approval...`);
  const msgCount = await sendPrompt(page, config.prompt);

  const approvalCard = page.locator('app-approval-card').first();
  const cardAppeared = await approvalCard
    .waitFor({ state: 'visible', timeout: 25000 })
    .then(() => true)
    .catch(() => false);

  if (!cardAppeared) {
    // Not fatal here: the reply still has to arrive, and the completion wait
    // below is what decides whether this page passed. But the whole point of
    // the page is the pause, so say plainly that it did not happen.
    ctx.fail(
      'app-approval-card never appeared -- the agent answered without calling ' +
        'requestApproval, so nothing was paused.',
    );
  } else {
    await sleep(1500);
    const approveBtn = page
      .locator('app-approval-card button:has-text("Approve")')
      .first();

    const box = await approveBtn.boundingBox().catch(() => null);
    if (box) {
      console.log(`   👉 Approving.`);
      await humanGlide(page, box.x + box.width / 2, box.y + box.height / 2, 22);
      await sleep(600);
      await humanClick(page);
    } else {
      await approveBtn.click().catch(() => {});
    }
  }

  // The decision returns to the agent and the run continues, so the reply that
  // matters is the one after the click.
  await waitForAgentResponseCompletion(page, config.waitAfterPromptMs ?? 4000, msgCount);

  // The interrupt half. Nothing to drive -- just make it legible that the
  // blank panel is mounted and listening rather than broken.
  const idle = page.locator('[data-testid="interrupt-idle"]').first();
  if (await idle.isVisible().catch(() => false)) {
    const box = await idle.boundingBox().catch(() => null);
    if (box) {
      await humanGlide(page, box.x + box.width / 2, box.y + box.height / 2, 20);
    }
    console.log(
      `   · Interrupt controller is mounted and listening; this backend raises ` +
        `none, so it never renders.`,
    );
    await sleep(3000);
  }
};
