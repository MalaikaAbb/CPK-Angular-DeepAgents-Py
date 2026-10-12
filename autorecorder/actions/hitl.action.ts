/**
 * Human-in-the-loop — the decision tool, where the model chooses to ask.
 *
 * https://docs.copilotkit.ai/angular/deepagents/guides/human-in-the-loop
 *
 * The take is only worth anything if the card actually appears and the run
 * visibly resumes after the click. Getting there is not a given: the guide
 * registers `requestApproval` with the description "Ask the user before a
 * consequential action" and stops there. Whether the run pauses is the model's
 * call, and it is not a reliable one: the same prompt sometimes renders the
 * card on turn 1, and sometimes gets a prose "please confirm" first and only
 * renders the card once the user confirms in chat.
 *
 * So the page is driven in up to `prompts.length` turns. Every turn ends in
 * exactly one observed outcome, read from the DOM:
 *
 *   card   -- the number of `app-approval-card` elements went up. Counted, not
 *             `.last()`-ed, because an earlier card stays on screen. The element
 *             only exists when CopilotKit rendered a requestApproval call.
 *   asked  -- a new assistant message arrived and settled, and no card did. The
 *             agent answered in prose (usually asking to confirm); the next
 *             prompt answers it. The DOM cannot say *what* the prose says --
 *             "please confirm" and a refusal look the same; the clip shows it.
 *   silent -- neither, within the reply window. The run died or never answered;
 *             the error the run left behind is carried into the verdict.
 *
 * Verdict:
 *   card on turn 1           -> PASS
 *   card on a later turn     -> PASS*, with every earlier turn's outcome named
 *   no card after all turns  -> FAIL, with every turn's outcome named
 *
 * After a card, Approve is clicked and the resume is checked, not assumed: the
 * card's buttons must go (the template hides them once the call's status is
 * `complete`, i.e. the decision reached the agent), and a reply must follow.
 * Either one missing fails the take.
 */
import { type Page } from 'playwright';

import {
  AgentSilentError,
  getAssistantMessageCount,
  promptsFor,
  sendPrompt,
  waitForAgentResponseCompletion,
} from '../core/actions';
import { beat, humanClick, humanGlide, sleep } from '../core/overlays/cursor';
import { type ActionContext, type PageActionHandler, type PageRecordConfig } from '../core/types';

/** The renderer the guide registers; the only thing that proves a pause. */
const APPROVAL_CARD = 'app-approval-card';

type TurnOutcome =
  | { kind: 'card' }
  | { kind: 'asked' }
  | { kind: 'silent'; reason: string };

const cardCount = (page: Page) => page.locator(APPROVAL_CARD).count().catch(() => 0);

/** Resolves once the card count rises above `base`, or `false` when `isDone()` stops it. */
async function waitForNewCard(
  page: Page,
  base: number,
  isDone: () => boolean,
): Promise<boolean> {
  while (!isDone()) {
    if ((await cardCount(page)) > base) return true;
    await sleep(250);
  }
  return (await cardCount(page)) > base;
}

/**
 * Sends one prompt and reports what it produced.
 *
 * The card and the prose reply race: whichever lands first decides the turn.
 * A reply that settles still gets a short grace window, because a run can
 * stream a sentence and then emit the tool call.
 */
async function runTurn(
  page: Page,
  config: PageRecordConfig,
  prompt: string,
): Promise<TurnOutcome> {
  const cardsBefore = await cardCount(page);
  const msgCount = await sendPrompt(page, prompt);

  let replyDone = false;
  let silentReason: string | undefined;
  const reply = waitForAgentResponseCompletion(page, config.waitAfterPromptMs ?? 4000, msgCount)
    .catch((e) => {
      if (!(e instanceof AgentSilentError)) throw e;
      silentReason = e.message;
    })
    .finally(() => {
      replyDone = true;
    });

  const sawCard = await waitForNewCard(page, cardsBefore, () => replyDone);
  if (sawCard) {
    // Let whatever prose came with the call finish on camera before clicking.
    await reply;
    return { kind: 'card' };
  }

  await reply;
  const graceEnd = Date.now() + 3000;
  if (await waitForNewCard(page, cardsBefore, () => Date.now() > graceEnd)) {
    return { kind: 'card' };
  }
  if (silentReason) return { kind: 'silent', reason: silentReason };
  return { kind: 'asked' };
}

function describe(outcome: TurnOutcome): string {
  switch (outcome.kind) {
    case 'card':
      return 'card rendered';
    case 'asked':
      return 'answered in chat without calling requestApproval';
    case 'silent':
      return `no reply (${outcome.reason})`;
  }
}

const history = (prompts: string[], outcomes: TurnOutcome[]) =>
  outcomes.map((o, i) => `turn ${i + 1} "${prompts[i]}": ${describe(o)}`).join('; ');

/** Clicks Approve on the newest card and checks that the run really resumed. */
async function approveAndConfirmResume(
  page: Page,
  config: PageRecordConfig,
  ctx: ActionContext,
): Promise<void> {
  const card = page.locator(APPROVAL_CARD).last();
  const approveBtn = card.locator('button:has-text("Approve")');

  await beat(1500);
  const msgsBefore = await getAssistantMessageCount(page);
  const box = await approveBtn.boundingBox().catch(() => null);
  if (!box) {
    ctx.fail('Approval card rendered but it has no Approve button.');
    return;
  }
  console.log(`   👉 Approving.`);
  await humanGlide(page, box.x + box.width / 2, box.y + box.height / 2, 22);
  await sleep(600);
  await humanClick(page);

  const completed = await card
    .locator('button')
    .first()
    .waitFor({ state: 'detached', timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  if (!completed) {
    ctx.fail(
      'Approve was clicked but the card never completed: its buttons stayed, so ' +
        'the decision did not reach the agent.',
    );
    return;
  }

  try {
    await waitForAgentResponseCompletion(page, config.waitAfterPromptMs ?? 4000, msgsBefore);
  } catch (e) {
    if (!(e instanceof AgentSilentError)) throw e;
    ctx.fail(`Approve was accepted but the run never resumed: ${e.message}`);
  }
}

export const runHitlAction: PageActionHandler = async (
  page: Page,
  config: PageRecordConfig,
  _rootPath,
  ctx,
) => {
  const prompts = promptsFor(config);
  const outcomes: TurnOutcome[] = [];

  for (let turn = 1; turn <= prompts.length; turn++) {
    console.log(
      turn === 1
        ? `   🛡️ Asking for something consequential enough to need approval...`
        : `   💬 No card yet -- turn ${turn}: "${prompts[turn - 1]}"`,
    );
    const outcome = await runTurn(page, config, prompts[turn - 1]);
    outcomes.push(outcome);
    console.log(`   · Turn ${turn}: ${describe(outcome)}`);
    if (outcome.kind === 'card') break;
    await beat(1200);
  }

  const pausedOnTurn = outcomes.findIndex((o) => o.kind === 'card') + 1;

  if (pausedOnTurn === 0) {
    ctx.fail(
      `app-approval-card never appeared after ${outcomes.length} turn(s), so nothing ` +
        `was paused. ${history(prompts, outcomes)}.`,
    );
  } else {
    if (pausedOnTurn > 1) {
      ctx.warn(
        `requestApproval was only called on turn ${pausedOnTurn}. ` +
          `${history(prompts, outcomes.slice(0, pausedOnTurn - 1))}. As published, ` +
          'whether a consequential action pauses is left to the model.',
      );
    }
    await approveAndConfirmResume(page, config, ctx);
  }

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
    await beat(3000);
  }
};
