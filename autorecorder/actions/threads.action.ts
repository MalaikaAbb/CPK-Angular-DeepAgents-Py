/**
 * Threads — the data is there, and the drop-in component renders none of it.
 *
 * https://docs.copilotkit.ai/angular/deepagents/guides/threads-memory-attachments-headless
 *
 * This take was rewritten after watching the network, because the obvious
 * assumption was wrong. `GET /api/copilotkit/threads?agentId=support&limit=20`
 * answers **200 with a real thread**, and the hand-built `injectThreads` list
 * beside it displays that thread quite happily. What is broken is
 * `copilot-threads-drawer`, which renders completely empty — no list, no
 * launcher, no locked state, no error.
 *
 * That makes the contrast the whole point of the clip, and it has to be filmed
 * in the right order: the working list FIRST, so that when the camera moves to
 * the blank drawer the viewer already knows the data exists. Filmed the other
 * way round, an empty drawer just looks like an empty account.
 *
 * The chat underneath answers normally too, which is the third leg — it
 * separates "one broken component" from "dead stack" for whoever triages this.
 */
import { type Page } from 'playwright';

import { AgentSilentError, sendPrompt, waitForAgentResponseCompletion } from '../core/actions';
import { writeScratchNote } from './scratch-note';
import { humanClick, humanGlide, sleep } from '../core/overlays/cursor';
import { type PageActionHandler, type PageRecordConfig } from '../core/types';

/** Clicks a control if it is there, and says so if it is not. */
async function clickIfPresent(page: Page, selector: string, label: string): Promise<boolean> {
  const el = page.locator(selector).first();
  const box = await el
    .waitFor({ state: 'visible', timeout: 4000 })
    .then(() => el.boundingBox())
    .catch(() => null);

  if (!box) {
    console.log(`   · ${label} not present.`);
    return false;
  }

  await humanGlide(page, box.x + box.width / 2, box.y + box.height / 2, 22);
  await sleep(250);
  await humanClick(page);
  await sleep(1200);
  return true;
}

export const runThreadsAction: PageActionHandler = async (
  page: Page,
  config: PageRecordConfig,
) => {
  await page
    .locator('app-thread-list')
    .first()
    .waitFor({ state: 'visible', timeout: 15000 })
    .catch(() => {});
  await sleep(600);

  // ── The headless list, which WORKS ───────────────────────────────────────

  // Rest on the list first. A thread rendered here is the evidence that the
  // endpoint returns data, and it has to be legible before the camera moves to
  // the drawer that shows none of it.
  const list = page.locator('app-thread-list').first();
  const listBox = await list.boundingBox().catch(() => null);
  if (listBox) {
    await humanGlide(page, listBox.x + Math.min(listBox.width / 2, 220), listBox.y + 40, 22);
    await sleep(2600);
  }

  // Report what the list actually rendered, so the run log carries the same
  // evidence the video does.
  const listed = ((await list.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  console.log(`   🧵 injectThreads list renders: "${listed.slice(0, 120)}"`);

  console.log(`   🧵 Creating a conversation — mutations are reported unavailable...`);
  await clickIfPresent(
    page,
    'app-thread-list button:has-text("New conversation")',
    'New conversation',
  );
  // A Retry button only exists once listing has errored, so its presence is
  // itself a result worth filming.
  const retried = await clickIfPresent(
    page,
    'app-thread-list button:has-text("Retry")',
    'Retry',
  );
  if (retried) {
    await sleep(2200);
  }

  // ── The drop-in drawer, which renders nothing ────────────────────────────
  const drawer = page.locator('copilot-threads-drawer').first();
  const drawerText = ((await drawer.innerText().catch(() => '')) || '').trim();
  console.log(
    drawerText
      ? `   🧵 Drawer renders: "${drawerText.replace(/\s+/g, ' ').slice(0, 120)}"`
      : `   🐞 Drawer rendered NOTHING — no list, no launcher, no locked state.`,
  );

  const drawerBox = await drawer.boundingBox().catch(() => null);
  if (drawerBox) {
    // Trace the drawer's empty area rather than clicking through it: the
    // finding is that there is nothing there, so the cursor has to show the
    // space where the thread list should have been.
    console.log(`   🧵 Tracing the empty CopilotThreadsDrawer...`);
    await humanGlide(page, drawerBox.x + 30, drawerBox.y + 30, 22);
    await sleep(900);
    await humanClick(page);
    await sleep(1200);
    await humanGlide(
      page,
      drawerBox.x + Math.min(drawerBox.width - 20, 260),
      drawerBox.y + Math.min(drawerBox.height - 20, 220),
      26,
    );
    await sleep(2600);
  } else {
    console.log(`   🐞 copilot-threads-drawer occupies no space on the page at all.`);
  }

  // ── The chat beside it is unaffected ──────────────────────────────────────
  console.log(`   💬 The chat beside the drawer is unaffected by the licence...`);

  const msgCount = await sendPrompt(page, config.prompt, {
    inputSelector: 'app-conversations textarea',
    submitSelector: 'app-conversations copilot-chat-send-button button',
  });
  try {
    await waitForAgentResponseCompletion(page, config.waitAfterPromptMs ?? 4000, msgCount);
  } catch (e) {
    if (!(e instanceof AgentSilentError)) throw e;
    console.warn(`   ⚠️ The chat beside the drawer did not answer either.`);
  }

  // ── The finding, with both halves still on screen ────────────────────────
  if (config.knownIssue) {
    await writeScratchNote(page, 'threads.txt', [
      'threads',
      '',
      'hand built list works - it shows a thread',
      'name comes back null so it says untitled conversation',
      '',
      'the drawer next to it renders nothing at all',
      'no list no launcher no locked state no error',
      '',
      'new conversation doesnt stick either',
      'runtime says threadEndpoints mutations false',
    ]);
  }
};
