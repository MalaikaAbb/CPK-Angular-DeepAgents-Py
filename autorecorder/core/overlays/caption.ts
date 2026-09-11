import { type Page } from 'playwright';
import { sleep } from './cursor';

/**
 * A caption strip across the top of the frame.
 *
 * These recordings have no voice track, so anything the viewer has to be told
 * rather than shown has nowhere to go. That is fine for a take of a feature
 * working -- the screen is the argument. It is not fine for a take that shows
 * the same page twice, once on the code the docs print and once with the fix:
 * without a label those two halves are indistinguishable, and the clip proves
 * nothing at all.
 *
 * Deliberately plain, and deliberately not a "watermark": it appears when a
 * claim is being made, stays long enough to read, and goes away.
 */

const CAPTION_ID = '__autorecord_caption';

export type CaptionTone = 'neutral' | 'bad' | 'good';

const TONES: Record<CaptionTone, { bg: string; fg: string; dot: string }> = {
  neutral: { bg: 'rgba(30,41,59,.94)', fg: '#e2e8f0', dot: '#94a3b8' },
  bad: { bg: 'rgba(69,10,10,.94)', fg: '#fecaca', dot: '#f87171' },
  good: { bg: 'rgba(5,46,22,.94)', fg: '#bbf7d0', dot: '#4ade80' },
};

/**
 * Shows a caption, replacing any caption already on screen.
 *
 * Left up until `hideCaption` or the next `showCaption`, so a handler can label
 * a whole phase of a take rather than one moment of it.
 */
export async function showCaption(
  page: Page,
  text: string,
  tone: CaptionTone = 'neutral',
): Promise<void> {
  await page.evaluate(
    (a: { id: string; text: string; bg: string; fg: string; dot: string }) => {
      document.getElementById(a.id)?.remove();

      const el = document.createElement('div');
      el.id = a.id;
      el.style.cssText = [
        'position:fixed',
        'top:18px',
        'left:50%',
        'transform:translateX(-50%) translateY(-8px)',
        'max-width:min(1100px,86vw)',
        'padding:11px 20px',
        `background:${a.bg}`,
        `color:${a.fg}`,
        'border-radius:999px',
        'box-shadow:0 10px 30px rgba(0,0,0,.38)',
        'z-index:2147483642',
        'display:flex',
        'align-items:center',
        'gap:11px',
        'font-family:"Segoe UI",system-ui,sans-serif',
        'font-size:17px',
        'font-weight:600',
        'letter-spacing:.1px',
        'white-space:nowrap',
        'overflow:hidden',
        'text-overflow:ellipsis',
        'opacity:0',
        'transition:opacity .2s ease-out,transform .2s cubic-bezier(.2,0,0,1)',
        'pointer-events:none',
      ].join(';');

      const dot = document.createElement('span');
      dot.style.cssText = `width:9px;height:9px;border-radius:50%;background:${a.dot};flex:none;`;
      const label = document.createElement('span');
      // textContent: captions carry error text, which can contain angle brackets.
      label.textContent = a.text;

      el.appendChild(dot);
      el.appendChild(label);
      document.documentElement.appendChild(el);

      requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateX(-50%) translateY(0)';
      });
    },
    { id: CAPTION_ID, text, ...TONES[tone] },
  );

  await sleep(420);
}

export async function hideCaption(page: Page): Promise<void> {
  await page.evaluate(
    (id: string) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(-8px)';
      setTimeout(() => el.remove(), 240);
    },
    CAPTION_ID,
  );
  await sleep(300);
}
