/**
 * Shared state — the browser writes agent state, then the agent reads it back.
 *
 * https://docs.copilotkit.ai/angular/deepagents/guides/shared-state
 *
 * Multi-turn demonstration:
 * 1. Click "Mark high priority" -> Ask "what is priority set as?"
 * 2. Click "Mark low priority"  -> Ask "what is priority set as?"
 * 3. Click "Use London time"    -> Ask "what is my timezone?"
 */
import { type Page } from 'playwright';

import { promptsFor, sendPrompt, waitForAgentResponseCompletion } from '../core/actions';
import { beat, humanClick, humanGlide, sleep } from '../core/overlays/cursor';
import { type PageActionHandler, type PageRecordConfig } from '../core/types';

import { excerpt, latestReplyText } from './reply-text';

/**
 * Did the agent see what the UI set? A reply that does not name the value is
 * the knownIssue ("the agent is blind to them"); one that does means state or
 * context reached the model this turn. Matching is loose on purpose -- it is
 * the value's presence that matters, not the phrasing.
 */
const EXPECTED = {
  high: /\bhigh\b/i,
  low: /\blow\b/i,
  london: /london|europe\/london|\bgmt\b|\bbst\b|greenwich|british summer/i,
};

export const runSharedStateAction: PageActionHandler = async (
  page: Page,
  config: PageRecordConfig,
  _rootPath,
  ctx,
) => {
  const [
    highPrompt = 'what is priority set as?',
    lowPrompt = 'what is priority set as?',
    tzPrompt = 'what is my timezone?',
  ] = promptsFor(config);
  const wait = config.waitAfterPromptMs ?? 4000;

  // ── Turn 1: Mark High Priority ─────────────────────────────────────────────
  console.log(`   🔄 Step 1: Clicking "Mark high priority"...`);
  const highBtn = page
    .locator('app-workspace button:has-text("Mark high priority")')
    .first();

  const highBox = await highBtn.boundingBox().catch(() => null);
  if (highBox) {
    await humanGlide(page, highBox.x + highBox.width / 2, highBox.y + highBox.height / 2, 20);
    await sleep(400);
    await humanClick(page);
    await beat(1000);
  } else {
    ctx.warn('"Mark high priority" button not found -- turn 1 asked about state nothing had set.');
  }

  // Each turn's verdict, reported once the take is over.
  const blind: string[] = [];
  const check = async (label: string, set: boolean, expected: RegExp) => {
    if (!set) return; // nothing was set, so the reply proves nothing either way
    const reply = await latestReplyText(page);
    if (!expected.test(reply)) blind.push(`${label}: "${excerpt(reply, 90)}"`);
    else console.log(`   ✅ ${label} reached the agent.`);
  };

  console.log(`   💬 Turn 1: ${highPrompt}`);
  const count1 = await sendPrompt(page, highPrompt);
  await waitForAgentResponseCompletion(page, wait, count1);
  await check('state priority=high', Boolean(highBox), EXPECTED.high);
  await beat(1000);

  // ── Turn 2: Mark Low Priority ──────────────────────────────────────────────
  console.log(`   🔄 Step 2: Clicking "Mark low priority"...`);
  const lowBtn = page
    .locator('app-workspace button:has-text("Mark low priority")')
    .first();

  const lowBox = await lowBtn.boundingBox().catch(() => null);
  if (lowBox) {
    await humanGlide(page, lowBox.x + lowBox.width / 2, lowBox.y + lowBox.height / 2, 20);
    await sleep(400);
    await humanClick(page);
    await beat(1000);
  } else {
    ctx.warn('"Mark low priority" button not found -- turn 2 asked about state nothing had changed.');
  }

  console.log(`   💬 Turn 2: ${lowPrompt}`);
  const count2 = await sendPrompt(page, lowPrompt);
  await waitForAgentResponseCompletion(page, wait, count2);
  await check('state priority=low', Boolean(lowBox), EXPECTED.low);
  await beat(1000);

  // ── Turn 3: Timezone Context ───────────────────────────────────────────────
  const timezoneBtn = page
    .locator('app-account-context button:has-text("Use London time")')
    .first();
  const tzBox = await timezoneBtn.boundingBox().catch(() => null);
  if (tzBox) {
    console.log(`   🌍 Step 3: Clicking "Use London time"...`);
    await humanGlide(page, tzBox.x + tzBox.width / 2, tzBox.y + tzBox.height / 2, 20);
    await sleep(400);
    await humanClick(page);
    await beat(1000);
  } else {
    ctx.warn('"Use London time" button not found -- turn 3 asked about context nothing had set.');
  }

  console.log(`   💬 Turn 3: ${tzPrompt}`);
  const count3 = await sendPrompt(page, tzPrompt);
  await waitForAgentResponseCompletion(page, wait, count3);
  await check('context timezone=London', Boolean(tzBox), EXPECTED.london);

  if (blind.length > 0) {
    ctx.reproduced(`agent did not reflect what the UI set -- ${blind.join('; ')}`);
  }

  // Rest on the context & state panel
  const accountContext = page.locator('app-account-context').first();
  const ctxBox = await accountContext.boundingBox().catch(() => null);
  if (ctxBox) {
    console.log(`   🎯 Resting on the read-only context component.`);
    await humanGlide(page, ctxBox.x + ctxBox.width / 2, ctxBox.y + ctxBox.height / 2, 22);
    await beat(1500);
  }
};

