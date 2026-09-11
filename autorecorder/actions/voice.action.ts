/**
 * Voice and multimodal input — the attachments half works, the transcription
 * half does not, and the clip shows both in that order.
 *
 * https://docs.copilotkit.ai/angular/deepagents/guides/voice-multimodal
 *
 * The guide's own walkthrough is: open the demo, attach a PNG or a PDF, then
 * press the microphone. So the recording does exactly that, and the two halves
 * land differently on purpose:
 *
 * - **Attachments pass.** The same `image/*,application/pdf` config the guide
 *   prints is bound to this composer, the file goes up as a content part, and
 *   the prompt asks for values that exist only inside the image — so the reply
 *   is evidence the file reached the model rather than something to squint at.
 *   The picking sequence is shared with the attachments page; see
 *   `attach-file.ts` for what is genuine there and what is a drawn prop.
 *
 * - **Voice records, then fails.** Three things had to be arranged for that to
 *   film as it behaves:
 *
 *   1. **The permission prompt.** Chrome's real one is browser chrome, outside
 *      the page, and Playwright suppresses it — a context grants or denies up
 *      front, so nothing was ever on screen and the mic click looked like it
 *      did nothing. The bubble here is drawn into the page, the same way this
 *      suite already draws the taskbar and VS Code. It is a prop, and the
 *      recording is honest about the sequence because the stream genuinely
 *      waits for the Allow click.
 *
 *   2. **A device.** The recording machine may have no microphone, and Chrome
 *      then rejects `getUserMedia` instantly — so the composer never entered
 *      its recording state and there was nothing to see. `getUserMedia` is
 *      wrapped to fall back to a synthesized stream, so the *UI* path is
 *      exercised for real even where the hardware is absent.
 *
 *   3. **The failure that is the actual finding.** Stopping the recording is
 *      what posts the audio for transcription, and this runtime configures no
 *      transcription service — so that request fails by design. A visible
 *      microphone does not make an unconfigured service succeed, which is the
 *      guide's own point. The scratch note says so while the failure is still
 *      on screen, and the clip ends there — the agent reply it ends *on* is the
 *      one earned by the attachment, at the top.
 *
 * Two deviations from the shared version of this handler, both this repo's:
 * the microphone control mounts slowly here and an 8s wait produced takes that
 * never clicked it, so it waits 15s; and the finding is written as an informal
 * scratch note rather than a formal one, because this page carries a
 * `knownIssue` and `scratch-note.ts` explains why the two are decoupled.
 */
import { type Page } from 'playwright';

import { sendPrompt, waitForAgentResponseCompletion } from '../core/actions';
import { humanClick, humanGlide, sleep } from '../core/overlays/cursor';
import { type PageActionHandler, type PageRecordConfig } from '../core/types';

import { attachFixtureOnCamera, renderRevenueFixture } from './attach-file';
import { writeScratchNote } from './scratch-note';

/**
 * Holds `getUserMedia` until the Allow click, then satisfies it — from the real
 * device if there is one, from an oscillator if there is not.
 */
async function armMicrophone(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __allowMic?: () => void;
      __micGate?: Promise<void>;
      __micArmed?: boolean;
      __micSynthetic?: boolean;
    };
    if (w.__micArmed) return;
    w.__micArmed = true;

    w.__micGate = new Promise<void>((resolve) => {
      w.__allowMic = resolve;
    });

    const md = navigator.mediaDevices;
    const original = md.getUserMedia.bind(md);
    md.getUserMedia = async (constraints: MediaStreamConstraints) => {
      await w.__micGate;
      try {
        return await original(constraints);
      } catch {
        // No input device on this machine. Synthesize one so the composer's
        // recording state is still exercised and still filmable.
        w.__micSynthetic = true;
        const ctx = new AudioContext();
        const dest = ctx.createMediaStreamDestination();
        const osc = ctx.createOscillator();
        osc.frequency.value = 220;
        osc.connect(dest);
        osc.start();
        return dest.stream;
      }
    };
  });
}

/** Chrome's microphone permission bubble, drawn into the page. */
async function showPermissionBubble(page: Page, origin: string): Promise<void> {
  await page.evaluate((host) => {
    const el = document.createElement('div');
    el.id = 'sim-permission-bubble';
    el.style.cssText =
      'position:fixed!important;top:12px!important;left:96px!important;width:400px!important;' +
      'background:#ffffff!important;color:#202124!important;border-radius:8px!important;' +
      'box-shadow:0 4px 24px rgba(0,0,0,0.35),0 0 0 1px rgba(0,0,0,0.08)!important;' +
      'z-index:2147483642!important;font-family:"Segoe UI",system-ui,sans-serif!important;' +
      'padding:16px 18px!important;opacity:0!important;transform:translateY(-8px)!important;' +
      'transition:opacity .18s ease,transform .18s ease!important;';
    el.innerHTML = [
      '<div style="display:flex;gap:12px;align-items:flex-start;">',
      '  <svg width="20" height="20" viewBox="0 0 24 24" fill="#5f6368" style="margin-top:2px"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>',
      '  <div style="font-size:14px;line-height:1.45;">',
      '    <div style="font-weight:600;margin-bottom:2px;">' + host + ' wants to</div>',
      '    <div style="color:#3c4043;">Use your microphone</div>',
      '  </div>',
      '</div>',
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">',
      '  <button id="sim-permission-block" style="border:1px solid #dadce0;background:#fff;color:#1a73e8;border-radius:4px;padding:7px 14px;font-size:13px;font-weight:500;">Block</button>',
      '  <button id="sim-permission-allow" style="border:none;background:#1a73e8;color:#fff;border-radius:4px;padding:7px 16px;font-size:13px;font-weight:500;">Allow</button>',
      '</div>',
    ].join('');
    document.documentElement.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, 30);
  }, origin);
  await sleep(500);
}

async function dismissPermissionBubble(page: Page): Promise<void> {
  await page.evaluate(() => {
    const el = document.getElementById('sim-permission-bubble');
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(-8px)';
    setTimeout(() => el.remove(), 220);
  });
  await sleep(300);
}

export const runVoiceAction: PageActionHandler = async (
  page: Page,
  config: PageRecordConfig,
  rootPath: string,
) => {
  // ── Half one: the attachment, which passes ────────────────────────────────
  const buffer = await renderRevenueFixture(page, rootPath);
  await attachFixtureOnCamera(page, buffer);

  const msgCount = await sendPrompt(page, config.prompt);
  await waitForAgentResponseCompletion(page, config.waitAfterPromptMs ?? 4000, msgCount);
  await sleep(1200);

  // ── Half two: the microphone, which records and then cannot transcribe ────
  const origin = new URL(page.url()).host;

  await armMicrophone(page);
  // Playwright contexts deny by default, which would reject the call before the
  // prop bubble had any meaning. The gate above is what actually holds it.
  await page
    .context()
    .grantPermissions(['microphone'], { origin: new URL(page.url()).origin })
    .catch(() => console.warn(`   ⚠️ could not grant microphone permission.`));

  const micBtn = page
    .locator(
      'copilot-chat-start-transcribe-button button, button[aria-label*="Transcribe" i]',
    )
    .first();

  const micBox = await micBtn
    .waitFor({ state: 'visible', timeout: 15000 })
    .then(() => micBtn.boundingBox())
    .catch(() => null);

  if (!micBox) {
    console.warn(`   ⚠️ transcribe control not found — skipping the voice path.`);
  } else {
    console.log(`   🎙️ Clicking the microphone control...`);
    await humanGlide(page, micBox.x + micBox.width / 2, micBox.y + micBox.height / 2, 22);
    await sleep(400);
    await humanClick(page);

    // The prompt Chrome would show, and the click that releases the stream.
    await showPermissionBubble(page, origin);
    const allowBtn = page.locator('#sim-permission-allow');
    const allowBox = await allowBtn.boundingBox().catch(() => null);
    if (allowBox) {
      await humanGlide(page, allowBox.x + allowBox.width / 2, allowBox.y + allowBox.height / 2, 22);
      await sleep(500);
      await humanClick(page);
    }
    await page.evaluate(() => {
      (window as unknown as { __allowMic?: () => void }).__allowMic?.();
    });
    await dismissPermissionBubble(page);

    // Recording is now live: rest on the composer so the recording state, the
    // elapsed timer and the stop control are all on screen for long enough to
    // read.
    // The composer shows two controls while recording: a cross that cancels and
    // a tick that finishes. Only the tick posts the audio for transcription, so
    // only the tick reaches the failure this page is about — and the cross sits
    // first in the DOM, so a combined selector with `.first()` aimed at the
    // wrong one. Finish is matched on its own; cancel is a fallback used only
    // to leave the recording state if no finish control exists.
    const finishBtn = page
      .locator('copilot-chat-finish-transcribe-button button, button[aria-label*="Finish" i]')
      .first();
    const cancelBtn = page
      .locator('copilot-chat-cancel-transcribe-button button, button[aria-label*="Cancel" i]')
      .first();

    const finishes = await finishBtn
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    const stopBtn = finishes ? finishBtn : cancelBtn;

    const recording =
      finishes ||
      (await cancelBtn
        .waitFor({ state: 'visible', timeout: 2000 })
        .then(() => true)
        .catch(() => false));

    if (recording && !finishes) {
      console.warn(`   ⚠️ no finish (tick) control — falling back to cancel, which sends no audio.`);
    }

    const synthetic = await page
      .evaluate(() => (window as unknown as { __micSynthetic?: boolean }).__micSynthetic === true)
      .catch(() => false);

    console.log(
      recording
        ? `   🔴 Recording — stream is ${synthetic ? 'synthesized (no input device)' : 'from the real device'}.`
        : `   ⚠️ The composer never entered its recording state.`,
    );

    await humanGlide(page, micBox.x - 120, micBox.y + micBox.height / 2, 20);
    await sleep(4000);

    // Stopping is what posts the audio for transcription -- i.e. what fails.
    if (recording) {
      const stopBox = await stopBtn.boundingBox().catch(() => null);
      if (stopBox) {
        console.log(`   ✔️ Finishing — this is the request that has no service behind it.`);
        await humanGlide(page, stopBox.x + stopBox.width / 2, stopBox.y + stopBox.height / 2, 20);
        await sleep(400);
        await humanClick(page);
        await sleep(3000);
      }
    }
  }

  // The finding, while the failure is still on screen. Informal on purpose --
  // see scratch-note.ts; the formal wording lives in this page's knownIssue.
  if (config.knownIssue) {
    await writeScratchNote(page, 'voice.txt', [
      'attachment half works',
      'agent read the chart it was sent',
      '',
      'mic renders asks permission and records fine',
      'stop posts the audio and nothing comes back',
      'composer stays empty',
      '',
      'runtime has no transcription service configured',
      'so only the voice half is broken',
      '',
      'permission bubble and open dialog are drawn by the recorder',
      'the file and the reply are real',
    ]);
  }
  await sleep(800);
};
