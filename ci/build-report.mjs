/**
 * DOCUMENTED_REPORT.md — the QA report that gets sent on, built from the run.
 *
 * This is the deliverable. Everything else in `ci/` exists to produce a folder
 * of videos; this turns that folder into the document those videos are evidence
 * for, in the format the report has always been filed in.
 *
 * The reason it is generated rather than written is that the alternative has a
 * specific, predictable failure: a status table maintained by hand drifts away
 * from the recordings beside it, and the drift is invisible because both halves
 * still look right on their own. Here a page's status comes from what the
 * recorder actually observed, and its issue text comes from the same
 * `knownIssue` object the recorder typed into Notepad on video. The report and
 * the footage cannot disagree, because they are the same source.
 *
 * `[ISSUE]` means the recorder observed the page's declared defect this run
 * (`ctx.reproduced`), and the row says what it saw. A declared defect that did
 * not show up is a PASS with a warning, never a canned failure row.
 *
 *   node ci/build-report.mjs [--out <path>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT_DIR, VIDEOS_DIR } from './lib/config.mjs';
import { getPackageVersions } from './lib/report.mjs';
import { PAGE_GROUPS, readPageIds } from './lib/pages.mjs';

/** Section headings, in doc-nav order. Keys are the groups in `lib/pages.mjs`. */
const GROUP_TITLES = {
  getting_started: 'Getting Started',
  generative_ui: 'Guides · Generative UI and A2UI',
  interaction: 'Guides · Voice, Multimodal and Human-in-the-Loop',
  shared_state: 'Guides · Shared State',
  threads: 'Threads, Memory, Attachments, Headless',
};

const STATUS = {
  pass: '✅ Passed',
  issue: '❌ Failed',
  fail: '❌ Broke during the take',
};

/**
 * `issue` renders as "Failed": a declared defect, observed this run.
 *
 * `fail` is NOT "not recorded". The clip is saved either way, and a take fails
 * when the feature did not work (`ctx.fail`), the app threw, or the harness
 * broke. It used to render as "Not recorded, not assessed", which filed real
 * feature failures as if nothing had been tested. The row carries the error so
 * a reader can tell a doc defect from a harness break.
 */
function readResults() {
  const byId = new Map();
  let meta = null;

  let files = [];
  try {
    files = fs
      .readdirSync(VIDEOS_DIR)
      .filter((f) => f.startsWith('RECORD_RESULTS') && f.endsWith('.json'));
  } catch {
    return { results: [], meta: null };
  }

  for (const f of files) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(path.join(VIDEOS_DIR, f), 'utf8'));
    } catch {
      console.warn(`⚠️  Skipping unreadable results file: ${f}`);
      continue;
    }
    meta ??= parsed;
    for (const r of parsed.results ?? []) byId.set(r.id, r);
  }

  // Registry order, so the report reads in doc-nav order however the shards
  // happened to be split.
  const results = [...byId.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return { results, meta };
}

/** The "Tested context" block, from the tree the run installed. */
function testedContext() {
  const { frontend, backend } = getPackageVersions();
  const lines = [];
  for (const [k, v] of Object.entries(frontend ?? {})) lines.push(`- \`${k}\`: ${v}`);
  for (const [k, v] of Object.entries(backend ?? {})) lines.push(`- \`${k}\`: ${v}`);
  return lines;
}

/** A markdown table cell cannot contain newlines, and a pipe inside one ends it early. */
function cell(lines) {
  return lines.join('<br>').replaceAll('|', '\\|');
}

/** What the take itself saw, printed on every row that has any. */
function observedLines(r) {
  const out = [];
  if (r.reproduced?.length) out.push(`**Observed this run:** ${r.reproduced.join('; ')}`);
  if (r.warnings?.length) out.push(`**Notes:** ${r.warnings.join(' ')}`);
  if (r.consoleErrors?.length) {
    out.push(`**Browser errors (${r.consoleErrors.length}):** ${r.consoleErrors.slice(0, 3).join('; ')}`);
  }
  return out;
}

/** The detail cell: what happened, plus the declared defect when it was observed. */
function detailCell(r, contextLines) {
  if (r.outcome === 'fail') {
    return cell([
      `**Take failed:** ${r.error ?? 'no error captured'}`,
      ...observedLines(r),
      `**Recording:** \`${r.filename || '(none)'}\` — check whether this is the app or the harness.`,
    ]);
  }
  // Only a reproduced defect gets the declared write-up. A page whose
  // knownIssue did not show up gets its warnings, like any other page.
  if (r.outcome !== 'issue' || !r.knownIssue) {
    const seen = observedLines(r);
    return seen.length ? cell(seen) : 'Working as expected.';
  }

  const i = r.knownIssue;
  return cell([
    `**Area/Surface:** ${i.area}`,
    '',
    `**Problem:** ${i.problem}`,
    '',
    `**Expected impact:** ${i.impact}`,
    '',
    `**Likely Cause:** ${i.likelyCause}`,
    '',
    ...observedLines(r),
    '',
    '**Tested context:**',
    ...contextLines,
    '',
    `**Recording:** \`${r.filename}\``,
  ]);
}

export function buildDocumentedReport(outPath) {
  const { results, meta } = readResults();

  if (results.length === 0) {
    throw new Error(
      `No RECORD_RESULTS*.json found in ${VIDEOS_DIR}.\n` +
        'Record something first: `npm run automate`, or `npm run record` against running servers.',
    );
  }

  const contextLines = testedContext();
  const byId = new Map(results.map((r) => [r.id, r]));

  const counts = { pass: 0, issue: 0, fail: 0 };
  for (const r of results) counts[r.outcome] = (counts[r.outcome] ?? 0) + 1;

  const lines = [];
  lines.push('# Deep Agents (Angular / Python) — Status & QA Report');
  lines.push('');
  lines.push(`- **Run:** ${meta?.generatedAt ?? 'unknown'}`);
  lines.push(`- **Framework:** ${meta?.frameworkLabel ?? 'Deep Agents (Python)'}`);
  lines.push(
    `- **Pages recorded:** ${results.length} — ` +
      `${counts.pass ?? 0} passed, ${counts.issue ?? 0} failed, ` +
      `${counts.fail ?? 0} broke during the take`,
  );
  lines.push('');
  lines.push(
    '> Generated by `ci/build-report.mjs` from this run\'s recordings. "Failed" means the recorder ' +
      'observed the page\'s declared defect this run (see "Observed this run"). "Broke during the ' +
      'take" means the feature did not work, the app threw, or the harness broke — the row says ' +
      'which error. Watch the clip before sending this on.',
  );
  lines.push('');

  // Partial-coverage warning.
  //
  // `RECORD_RESULTS.json` describes ONE run and is overwritten by the next, so
  // recording a single page (or `--pages=issues`) after a full suite leaves only
  // those results behind. The report is then perfectly accurate and badly
  // misleading: it looks like a complete status table with most of the rows
  // missing, and that is the version somebody sends to a manager.
  //
  // Deliberately not fixed by accumulating results across runs — a stale row
  // asserting last week's outcome is a worse failure than a short report.
  let missing = [];
  try {
    missing = readPageIds().filter((id) => !byId.has(id));
  } catch {
    // Registry unreadable; skip the check rather than fail the report.
  }
  if (missing.length > 0) {
    lines.push(
      `> ⚠️ **Partial run — ${results.length} of ${results.length + missing.length} pages.** ` +
        `Not covered: ${missing.join(', ')}. ` +
        "This is one run's results, and a single-page re-record replaces them. " +
        'Run `npm run automate` (or `npm run record:all`) then `npm run report` for a full report.',
    );
    lines.push('');
  }

  for (const [key, ids] of Object.entries(PAGE_GROUPS)) {
    const rows = ids.map((id) => byId.get(id)).filter(Boolean);
    if (rows.length === 0) continue;

    lines.push(`## ${GROUP_TITLES[key] ?? key}`);
    lines.push('');
    lines.push('| Sub-Section | Status | Details & Issues |');
    lines.push('| :--- | :--- | :--- |');
    for (const r of rows) {
      const name = r.docUrl ? `[${r.name}](${r.docUrl})` : r.name;
      lines.push(`| **${name}** | ${STATUS[r.outcome] ?? r.outcome} | ${detailCell(r, contextLines)} |`);
    }
    lines.push('');
  }

  // A page in the registry but in no group would otherwise vanish from the
  // report while still being recorded. `assertGroupsCoverAllPages` is meant to
  // prevent that; this is the belt to its braces.
  const grouped = new Set(Object.values(PAGE_GROUPS).flat());
  const orphans = results.filter((r) => !grouped.has(r.id));
  if (orphans.length > 0) {
    lines.push('## Ungrouped');
    lines.push('');
    lines.push('| Sub-Section | Status | Details & Issues |');
    lines.push('| :--- | :--- | :--- |');
    for (const r of orphans) {
      lines.push(`| **${r.name}** | ${STATUS[r.outcome] ?? r.outcome} | ${detailCell(r, contextLines)} |`);
    }
    lines.push('');
  }

  // Repo root, not autorecorder/videos/. This file is the deliverable — the
  // thing that gets sent on — and everything else in videos/ is gitignored build
  // output, so a report living there reads as disposable and is easy to miss
  // after a run. `--out` still overrides.
  const target = outPath ?? path.join(ROOT_DIR, 'DOCUMENTED_REPORT.md');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, lines.join('\n'), 'utf8');
  return target;
}

// Guarded: this module is imported by automate.mjs, and argv[1] is undefined
// under `node -e` / `node --eval`, where an unguarded pathToFileURL throws
// during someone else's import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf('--out');
  const out = i !== -1 ? process.argv[i + 1] : undefined;
  console.log(`Wrote ${buildDocumentedReport(out)}`);
}
