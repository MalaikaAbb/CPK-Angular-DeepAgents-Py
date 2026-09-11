/**
 * A short, informal note in Notepad — what a tester actually jots down.
 *
 * `core/issue-note.ts` types the full KnownIssue: Area, Problem, Expected
 * impact, Likely Cause, four paragraphs of finished prose. That object has to
 * stay formal because `ci/build-report.mjs` renders it straight into the report
 * a manager reads. But typing it on screen made the recordings look wrong —
 * nobody mid-test writes a structured defect report in complete sentences, and
 * watching one appear character by character reads as a machine narrating
 * itself rather than a person noticing something.
 *
 * So the two are deliberately decoupled here. The report keeps the formal
 * KnownIssue; the clip gets these — lowercase, unpunctuated, a few lines,
 * typed fast. Same finding, written the way someone writes it for themselves.
 *
 * Keep them that way when editing: no capitals at the start of lines, no full
 * stops, no commas. Fragments over sentences. If a note needs a paragraph it
 * belongs in the KnownIssue, not here.
 *
 * Lives in `actions/` rather than `core/` only because `core/` is frozen; it is
 * framework-agnostic and every repo in this suite would want it.
 */
import { type Page } from 'playwright';

import { closeNotepad, openNotepad, typeInNotepad } from '../core/overlays/notepad';
import { sleep } from '../core/overlays/cursor';

export interface ScratchNoteOptions {
  /** Beat before Notepad opens, so the thing being noted is on screen first. */
  leadInMs?: number;
  /**
   * Faster than the formal note's 62ms. These are short and someone jotting
   * mid-test types quickly, with fewer pauses for thought.
   */
  charDelayMs?: number;
}

/**
 * Opens Notepad from the taskbar, types a few informal lines, and closes it.
 *
 * @param lines written lowercase and unpunctuated — see the note above.
 */
export async function writeScratchNote(
  page: Page,
  fileName: string,
  lines: string[],
  opts: ScratchNoteOptions = {},
): Promise<void> {
  const { leadInMs = 1000, charDelayMs = 34 } = opts;

  console.log(`   📝 Jotting a note in Notepad...`);
  await sleep(leadInMs);
  await openNotepad(page, fileName);
  await typeInNotepad(page, lines.join('\n'), { charDelayMs, thinkChance: 0.02 });
  await closeNotepad(page);
}
