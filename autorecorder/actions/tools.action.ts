/**
 * Frontend tools and generative UI — three paths, one turn each.
 *
 * https://docs.copilotkit.ai/angular/deepagents/guides/frontend-tools-generative-ui
 *
 * Turn 1 calls `getWeather`, which runs in the DeepAgents graph
 * (backend/main.py); the browser only renders it, through `app-weather-card`.
 * Turn 2 calls `change_background`, which runs in the browser and renders
 * nothing in chat — its result is the page itself repainting, so the cursor
 * has to go and look at the page.
 *
 * Turn 3 is the guide's new first section, `registerComponent`, and it is why
 * this page now carries a `knownIssue`. The card renders correctly and the
 * model is then handed a second turn nobody asked for. Four defects sit in
 * that one turn, all in the snippet as published against 0.5.1: the spurious
 * follow-up (no `handler` means core writes an empty tool result), a loading
 * guard that never fires (it gates on "in-progress"; the real status is
 * "executing"), a status that never reaches "complete" at all, and a "card"
 * that ships no CSS and renders as the run-together string INC-4711sev1.
 *
 * ── One difference from the sibling repos ──────────────────────────────────
 * This demo mounts `<copilot-sidebar />`, not an inline `<copilot-chat />`
 * (features/tools/tools-chat.component.ts). A sidebar starts closed behind a
 * launcher, so there is no composer in the DOM until it is opened — typing
 * straight away lands nowhere and the take fails as "the agent never replied"
 * on a page that works. Opening it is the first thing this handler does.
 *
 * ── Watch the weather card ─────────────────────────────────────────────────
 * The graph declares `getWeather(location: str)` while the renderer binds
 * `call.args.city`, so the card can mount with an empty heading even when the
 * agent answers correctly. The QA report scores this page as passing and
 * records no symptom, so there is no `knownIssue` here — but if the card looks
 * wrong on the clip, that mismatch is why.
 */
import { type Page } from 'playwright';

import { promptsFor, sendPrompt, waitForAgentResponseCompletion } from '../core/actions';
import { humanClick, humanGlide, sleep } from '../core/overlays/cursor';
import { type PageActionHandler, type PageRecordConfig } from '../core/types';

import { waitForDomSettled } from './page-ready';
import { writeScratchNote } from './scratch-note';

/**
 * Opens the sidebar if it is closed.
 *
 * Returns quietly when a composer is already on screen: some builds render the
 * sidebar open, and clicking a launcher that is not there would throw.
 */
async function ensureSidebarOpen(page: Page): Promise<void> {
  const composer = page.locator('copilot-sidebar textarea, copilot-chat textarea').first();
  if (await composer.isVisible({ timeout: 2500 }).catch(() => false)) {
    console.log(`   · Sidebar already open.`);
    return;
  }

  const launcher = page
    .locator(
      'copilot-sidebar button[aria-label*="open" i], copilot-sidebar button[aria-label*="chat" i], ' +
        'button[aria-label*="Open Copilot" i], copilot-sidebar button',
    )
    .first();

  const box = await launcher
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => launcher.boundingBox())
    .catch(() => null);

  if (!box) {
    console.warn(`   ⚠️ No sidebar launcher found — continuing and hoping for a composer.`);
    return;
  }

  console.log(`   🗂️ Opening the sidebar...`);
  await humanGlide(page, box.x + box.width / 2, box.y + box.height / 2, 22);
  await sleep(350);
  await humanClick(page);

  // Opening the sidebar constructs the chat. That is first load all over again:
  // the markup lands before the composer is wired up.
  await waitForDomSettled(page);
  await sleep(600);
}

/**
 * The incident card's two fields. Read separately from "is it in the DOM",
 * because the finding is a card that mounts with both of them empty.
 */
async function readIncidentCard(
  page: Page,
): Promise<{ id: string; severity: string } | null> {
  return page
    .evaluate(() => {
      const card = document.querySelector('app-incident-card');
      if (!card) return null;
      return {
        id: (card.querySelector('strong')?.textContent ?? '').trim(),
        severity: (card.querySelector('span')?.textContent ?? '').trim(),
      };
    })
    .catch(() => null);
}

export const runToolsAction: PageActionHandler = async (
  page: Page,
  config: PageRecordConfig,
) => {
  const [weatherPrompt, backgroundPrompt, incidentPrompt] = promptsFor(config);
  const wait = config.waitAfterPromptMs ?? 4000;

  await ensureSidebarOpen(page);

  // ── Server-side tool, rendered by an Angular component ────────────────────
  console.log(`   🌤️ Server tool: ${weatherPrompt}`);
  const firstCount = await sendPrompt(page, weatherPrompt);

  // The card appears while the reply is still streaming; waiting for it here
  // separates "the tool renderer mounted" from "the turn finished", so a broken
  // renderer is visible as its own failure instead of a silent absence.
  const weatherCard = page.locator('app-weather-card').first();
  await weatherCard.waitFor({ state: 'visible', timeout: 25000 }).catch(() => {
    console.warn(`   ⚠️ app-weather-card never rendered — tool call may not have fired.`);
  });

  await waitForAgentResponseCompletion(page, wait, firstCount);

  const cardBox = await weatherCard.boundingBox().catch(() => null);
  if (cardBox) {
    await humanGlide(page, cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2, 22);
    await sleep(2200);
  }

  // ── Browser-side tool, whose only output is the page repainting ───────────
  if (!backgroundPrompt) return;
  console.log(`   🎨 Frontend tool: ${backgroundPrompt}`);
  const secondCount = await sendPrompt(page, backgroundPrompt);
  await waitForAgentResponseCompletion(page, 3000, secondCount);

  console.log(`   ✨ Showing the repainted background.`);
  await humanGlide(page, 500, 350, 25);
  await sleep(1000);
  await humanGlide(page, 700, 520, 25);
  await sleep(2000);

  // ── Display-only registration: the guide's new section, and the finding ───
  if (!incidentPrompt) return;
  console.log(`   🪪 Display-only tool: ${incidentPrompt}`);
  const thirdCount = await sendPrompt(page, incidentPrompt);

  const incidentCard = page.locator('app-incident-card').first();
  await incidentCard.waitFor({ state: 'visible', timeout: 25000 }).catch(() => {
    console.warn(`   ⚠️ app-incident-card never rendered — registerComponent did not fire.`);
  });

  // Sampled the instant it mounts. The guide's in-progress guard does not fire,
  // so this is where the empty-card frame is caught if it is catchable.
  const atMount = await readIncidentCard(page);
  console.log(
    `   🔎 At mount: id="${atMount?.id ?? '(no card)'}" severity="${atMount?.severity ?? ''}"`,
  );

  await waitForAgentResponseCompletion(page, wait, thirdCount);

  const settled = await readIncidentCard(page);
  if (settled && settled.id) {
    console.log(`   ✅ Card settled correct: ${settled.id} / ${settled.severity}.`);
  } else {
    console.warn(`   ⚠️ Card never filled in.`);
  }

  // Rest on the card, then travel down to the turn underneath it. The two being
  // on screen together is the whole point of the shot.
  const incidentBox = await incidentCard.boundingBox().catch(() => null);
  if (incidentBox) {
    await humanGlide(page, incidentBox.x + 60, incidentBox.y + 18, 22);
    await sleep(2400);
    console.log(`   👇 Travelling to the follow-up turn beneath it.`);
    await humanGlide(page, incidentBox.x + 80, incidentBox.y + incidentBox.height + 70, 20);
    await sleep(2600);
  }

  await writeScratchNote(page, 'registercomponent.txt', [
    'card is right',
    'the message under it is a turn nobody asked for',
    'no handler means core writes an empty tool result',
    'so the model always gets another turn',
    'followUp: false removes it - guide never says so',
    '',
    'it guards on status in-progress',
    'real status is executing so the guard never fires',
    'card paints empty first',
    '',
    'and it never reaches complete at all',
    'the other renderer on this page says gate on complete',
    'do that here and it loads forever',
    '',
    'no css either and angular strips the gap',
    'renders INC-4711sev1 - not a card',
  ]);
};
