import { type Page } from 'playwright';

import { SELECTORS } from '../config/selectors.config';

/**
 * The text of the newest assistant message that has any, flattened.
 *
 * For handlers that have to say whether a reply *answered* the question, not
 * just whether one arrived -- "any text over 2 chars" passes an apology, a
 * refusal and an error message alike.
 */
export async function latestReplyText(page: Page, scope = ''): Promise<string> {
  const sel = SELECTORS.assistantMessage
    .split(',')
    .map((s) => `${scope} ${s.trim()}`.trim())
    .join(', ');
  return page
    .evaluate((s) => {
      const msgs = document.querySelectorAll(s);
      for (let i = msgs.length - 1; i >= 0; i--) {
        const t = (msgs[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (t) return t;
      }
      return '';
    }, sel)
    .catch(() => '');
}

/** A reply, shortened for a log line or report cell. */
export function excerpt(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text || '(empty)';
}
