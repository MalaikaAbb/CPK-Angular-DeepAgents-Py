import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { type Page } from 'playwright';
import { closeNotepad, openNotepad, typeInNotepad } from './overlays/notepad';
import { sleep } from './overlays/cursor';
import { readCopilotKitVersions } from './versions';
import { type KnownIssue } from './types';

/**
 * The defect report, written on screen at the end of a take.
 *
 * Every issue clip ends the same way: the tester opens Notepad over the still
 * visible failure and writes down what just happened. It is the shape the QA
 * report is filed in, and it is the reason these videos can be sent to someone
 * without a covering email.
 *
 * The point of doing it here rather than in each action is that the same
 * `KnownIssue` object also feeds `ci/build-report.mjs`. The sentence typed on
 * video and the row in the daily report are one string, written once -- which
 * is the only arrangement where they cannot drift apart.
 */

/** `npm -v`, or null. Cached: it costs a process spawn and never changes mid-run. */
let npmVersion: string | null | undefined;

function readNpmVersion(): string | null {
  if (npmVersion !== undefined) return npmVersion;
  try {
    npmVersion = execFileSync('npm', ['-v'], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    npmVersion = null;
  }
  return npmVersion;
}

/**
 * The "Tested context" block, read from the machine doing the recording.
 *
 * Hand-typed version numbers in a bug report go stale within a release and
 * nobody notices, because the number still looks like a number. Everything here
 * is read at record time from the tree that actually ran.
 */
function testedContext(): string[] {
  const lines: string[] = ['Tested context:'];

  lines.push(`- OS: ${os.type()} ${os.release()}`);

  const npm = readNpmVersion();
  if (npm) lines.push(`- Package manager: npm ${npm}`);
  lines.push(`- Node: ${process.version}`);

  for (const { pkg, version } of readCopilotKitVersions()) {
    lines.push(`- @copilotkit/${pkg}: ${version}`);
  }

  return lines;
}

/** Renders a KnownIssue as the plain text that goes into Notepad. */
export function formatIssueNote(issue: KnownIssue): string {
  return [
    `Area/Surface: ${issue.area}`,
    '',
    `Problem: ${issue.problem}`,
    '',
    `Expected impact: ${issue.impact}`,
    '',
    `Likely cause: ${issue.likelyCause}`,
    '',
    ...testedContext(),
  ].join('\n');
}

export interface IssueNoteOptions {
  /** Filename on the Notepad tab. Defaults to `<page-id>-issue.txt`. */
  fileName?: string;
  /** Beat before Notepad opens, so the failure is on screen a moment first. */
  leadInMs?: number;
  /**
   * Per-character delay. Faster than Notepad's default: these notes run four or
   * five lines longer than the ones that default was tuned for, and a clip
   * should not spend forty seconds watching text appear.
   */
  charDelayMs?: number;
}

/**
 * Opens Notepad from the taskbar, types the issue report, and closes it.
 *
 * The failure stays on screen behind the window on purpose -- the note and the
 * thing it describes are in the same frame, so the clip does not depend on the
 * viewer remembering what happened thirty seconds ago.
 */
export async function writeIssueNote(
  page: Page,
  pageId: string,
  issue: KnownIssue,
  opts: IssueNoteOptions = {},
): Promise<void> {
  const { fileName = `${pageId}-issue.txt`, leadInMs = 1200, charDelayMs = 26 } = opts;

  console.log(`   📝 [${pageId}] Writing the issue note in Notepad...`);
  await sleep(leadInMs);
  await openNotepad(page, fileName);
  await typeInNotepad(page, formatIssueNote(issue), { charDelayMs, thinkChance: 0.03 });
  await closeNotepad(page);
}
