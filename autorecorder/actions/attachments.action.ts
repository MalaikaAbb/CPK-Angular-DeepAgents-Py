/**
 * Attachments — pick a real file, send it, and make the agent prove it read it.
 *
 * Three things this had to get right, because the earlier version got all three
 * wrong and the video showed it:
 *
 * 1. **The composer has no `input[type=file]` in the DOM.** It creates one on
 *    demand when the menu item is clicked, so writing a DataTransfer onto
 *    "the file input" silently attached nothing at all — which is why the agent
 *    had no idea what it was being asked about. The file now arrives through
 *    Playwright's `filechooser` interception: the same event the native dialog
 *    raises, so the upload path is the real one.
 *
 * 2. **The Windows dialog cannot be filmed.** It is an OS window outside the
 *    viewport and Playwright suppresses it, so a file appeared out of nowhere.
 *    `file-dialog.ts` draws one and the cursor picks the file in it; the dialog
 *    is a prop, the bytes are not.
 *
 * 3. **A 1x1 PNG proves nothing.** The fixture is now a legible chart rendered
 *    on a canvas, and the prompt asks for values only readable from the image —
 *    so a correct answer is evidence the file reached the model, and a wrong one
 *    is a real failure rather than something to squint at.
 *
 * All three now live in `attach-file.ts`, because the voice/multimodal page
 * shares this composer and this config and needs exactly the same sequence.
 *
 * https://docs.copilotkit.ai/angular/deepagents/guides/threads-memory-attachments-headless
 */
import { type Page } from 'playwright';

import { sendPrompt, waitForAgentResponseCompletion } from '../core/actions';
import { type PageActionHandler, type PageRecordConfig } from '../core/types';

import { attachFixtureOnCamera, renderRevenueFixture } from './attach-file';

export const runAttachmentsAction: PageActionHandler = async (
  page: Page,
  config: PageRecordConfig,
  rootPath: string,
) => {
  const buffer = await renderRevenueFixture(page, rootPath);
  await attachFixtureOnCamera(page, buffer);

  // The composer moves down once the queue appears, so the prompt is typed
  // after the attachment, never before.
  const msgCount = await sendPrompt(page, config.prompt);
  await waitForAgentResponseCompletion(page, config.waitAfterPromptMs ?? 4000, msgCount);
};
