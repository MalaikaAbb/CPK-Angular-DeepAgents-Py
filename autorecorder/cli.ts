/**
 * Automated Screen Recording & Demonstration Pipeline
 * Entrypoint & CLI runner
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { PAGES } from './config/pages.config';
import { PROJECT } from './config/project.config';
import { checkServicesHealth } from './core/diagnostics';
import { RecordingEngine, type RecordOutcome } from './core/engine';
import { runDoctor } from './core/doctor';
import { parseShard, selectPages } from './core/select';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const VIDEOS_DIR = join(__dirname, 'videos');

export interface PageResult {
  id: string;
  name: string;
  filename: string;
  success: boolean;
  outcome: RecordOutcome;
  durationSec: number;
  error?: string;
  warnings: string[];
  consoleErrors?: string[];
}

/**
 * Both services must be up before any browser launches. Recording against a
 * dead backend produces a full-length video of a broken page, so this aborts
 * by default; `--force` records anyway when that is deliberately what you want.
 */
async function assertServicesUp(force: boolean): Promise<void> {
  const health = await checkServicesHealth();
  if (health.frontendOk && health.backendOk) return;

  console.error(`\n🔍 [Pre-flight Service Diagnostics]`);
  if (!health.backendOk) {
    console.error(
      `   [x] Agent backend ${PROJECT.backendUrl} unreachable: ${health.backendError}`,
    );
    console.error(`       Fix: ${PROJECT.backendStartCmd}`);
  }
  if (!health.frontendOk) {
    console.error(
      `   [x] Frontend ${PROJECT.frontendUrl} unreachable: ${health.frontendError}`,
    );
    console.error(`       Fix: ${PROJECT.frontendStartCmd}`);
  }

  if (force) {
    console.warn(`\n   ⚠️ --force given; recording anyway. Expect unusable video.\n`);
    return;
  }

  console.error(`\n❌ Aborting before launching a browser. Pass --force to override.\n`);
  process.exit(1);
}

/**
 * Per-page outcomes, on disk, for anything downstream that has to say what this
 * run found.
 *
 * The console summary is for a person watching the run; this is for
 * `ci/build-report.mjs`, which turns it into the daily QA report. It is written
 * here rather than reconstructed later because the recorder is the only thing
 * that knows *why* a page passed -- a .webm on disk cannot tell you whether it
 * shows a feature working or a defect reproducing.
 *
 * Sharded runs each write their own file. The name carries the shard so three
 * workers' artifacts unpack into one folder without overwriting each other,
 * which is exactly what the consolidate job does.
 *
 * ── Why this merges instead of overwriting ─────────────────────────────────
 * Re-recording one page after fixing it is the single most common thing anyone
 * does here. Written as a plain overwrite, that dropped the other fourteen
 * pages from the file, and the next `ci/build-report.mjs` produced a QA report
 * claiming one page had been tested -- a document that is wrong in the one
 * direction that matters, and wrong silently.
 *
 * So results merge by page id, newest wins, and every entry carries its own
 * `recordedAt`. Nothing is ever lost by re-recording, and the report can say
 * which rows are from today and which are older.
 */
function writeResultsFile(results: PageResult[], shard: string | null): string {
  mkdirSync(VIDEOS_DIR, { recursive: true });

  const name = shard ? `RECORD_RESULTS.shard-${shard}.json` : 'RECORD_RESULTS.json';
  const target = join(VIDEOS_DIR, name);
  const recordedAt = new Date().toISOString();

  const fresh = results.map((r) => {
    const page = PAGES.find((pg) => pg.id === r.id);
    return {
      id: r.id,
      name: r.name,
      order: page?.order ?? null,
      filename: r.filename,
      outcome: r.outcome,
      success: r.success,
      durationSec: r.durationSec,
      recordedAt,
      docUrl: page?.docUrl ?? null,
      route: page?.route ?? null,
      error: r.error ?? null,
      warnings: r.warnings,
      consoleErrors: r.consoleErrors ?? [],
      knownIssue: page?.knownIssue ?? null,
    };
  });

  // Anything this run did not touch is carried forward as it was. A page that
  // has since been deleted from the registry is dropped rather than kept
  // forever -- the report should not carry rows for routes that no longer exist.
  const byId = new Map<string, (typeof fresh)[number]>();
  if (existsSync(target)) {
    try {
      const previous = JSON.parse(readFileSync(target, 'utf8'));
      for (const r of previous.results ?? []) {
        if (r?.id && PAGES.some((p) => p.id === r.id)) byId.set(r.id, r);
      }
    } catch {
      // Unreadable or hand-edited: this run's results stand on their own.
      console.warn(`   ⚠️ ${name} could not be read; writing this run's results only.`);
    }
  }
  for (const r of fresh) byId.set(r.id, r);

  const merged = [...byId.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const carried = merged.length - fresh.length;
  if (carried > 0) {
    console.log(`   ↻ Carried forward ${carried} page(s) from earlier runs.`);
  }

  const payload = {
    generatedAt: recordedAt,
    project: PROJECT.videoPrefix,
    framework: PROJECT.framework,
    frameworkLabel: PROJECT.frameworkLabel,
    shard,
    results: merged,
  };

  writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
  return target;
}

function printUsage(): void {
  console.log(`
🎬 npm run record -- [selection] [options]

Selection (default: every page, in nav order)
  --<page-id>, <page-id>     one page, e.g. --quickstart
  --page=<id>                same thing, explicit form
  --pages=<id,id>            exactly these pages (--only= is an alias)
  --pages=issues             every page that carries a knownIssue
  --filter=<text>            pages whose id or name contains the text
  <word> [<word> ...]        same as --filter, for each word
  --limit=<n>                first n of the selection (--first=, --count=)
  --shard=<k>/<n>            slice k of n, for matrix workers

Options
  --list, -l                 print every registered page and exit
  --doctor                   validate the configuration; exits 1 on error
  --doctor --online          also probe every doc/demo URL and the selectors
  --force                    record even if the pre-flight health check fails
  --help, -h                 this text

Results merge into videos/RECORD_RESULTS.json (per shard when sharded); the
process exits 1 only if a page FAILED -- a documented [ISSUE] exits 0.
`);
}

function printList(): void {
  console.log(`\n📋 REGISTERED RECORDING ROUTES (${PAGES.length} total):\n`);
  for (let i = 0; i < PAGES.length; i++) {
    const p = PAGES[i];
    console.log(`  ${String(i + 1).padStart(2, ' ')}. [${p.id}] ${p.name}`);
    console.log(`      Command: npm run record -- --${p.id}`);
    console.log(`      Doc:     ${p.docUrl}`);
    console.log(`      Demo:    ${p.demoUrl}`);
    console.log(`      File:    ${p.ideFile} (lines ${p.startLine}-${p.endLine})`);
    if (p.knownIssue) {
      console.log(`      Issue:   ${p.knownIssue.area}`);
    }
  }
  console.log('');
}

/** The switches this command knows. Anything else is a page id or a search word. */
const OPTIONS = {
  force: { type: 'boolean', default: false },
  list: { type: 'boolean', short: 'l', default: false },
  help: { type: 'boolean', short: 'h', default: false },
  doctor: { type: 'boolean', default: false },
  'verify-config': { type: 'boolean', default: false },
  online: { type: 'boolean', default: false },
  page: { type: 'string' },
  pages: { type: 'string' },
  only: { type: 'string' },
  filter: { type: 'string' },
  limit: { type: 'string' },
  first: { type: 'string' },
  count: { type: 'string' },
  shard: { type: 'string' },
} as const;

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);

  // `strict: false` so `--quickstart` is accepted without being declared: it
  // arrives as an unknown boolean, and unknown booleans are page ids or search
  // words. Everything the command actually acts on is declared above, so a
  // typo in a real switch cannot fall through and become a page search.
  const { values, positionals } = parseArgs({
    args: rawArgs,
    options: OPTIONS,
    strict: false,
    allowPositionals: true,
  });

  if (values.help) {
    printUsage();
    return;
  }

  // Adaptation check. Static by default; --online also probes live URLs.
  if (values.doctor || values['verify-config']) {
    process.exit(await runDoctor(ROOT, { online: Boolean(values.online) }));
  }

  if (values.list || positionals.includes('list')) {
    printList();
    return;
  }

  const known = new Set(Object.keys(OPTIONS));
  const words = [
    ...Object.entries(values)
      .filter(([k, v]) => !known.has(k) && v === true)
      .map(([k]) => k),
    ...positionals.filter((p) => p !== 'list'),
  ].map((w) => w.replace(/^-+/, ''));

  const byId = (w: string): boolean => PAGES.some((p) => p.id.toLowerCase() === w.toLowerCase());
  const pageWord = words.find(byId);
  const queries = words.filter((w) => !byId(w));

  const limitRaw = values.limit ?? values.first ?? values.count;
  const limit = limitRaw ? Number.parseInt(String(limitRaw), 10) : undefined;
  const shard = parseShard(values.shard ? String(values.shard) : undefined);
  if (values.shard && !shard) {
    console.error(`❌ --shard expects K/N, got "${values.shard}"`);
    process.exit(1);
  }

  // `--pages=issues` means every page carrying a knownIssue. It is resolved
  // from the registry rather than written out anywhere, because "re-record
  // the broken ones" is the daily selection here and a hand-maintained copy
  // of that list would be wrong the first time a defect was fixed.
  const idList = values.pages ?? values.only;
  let ids = idList ? String(idList).split(',').map((s) => s.trim()).filter(Boolean) : undefined;
  if (ids?.some((id) => id.toLowerCase() === 'issues')) {
    const issueIds = PAGES.filter((p) => p.knownIssue).map((p) => p.id);
    ids = [...ids.filter((id) => id.toLowerCase() !== 'issues'), ...issueIds];
    console.log(`\n🐞 [--pages=issues] ${issueIds.length} page(s) with a known issue.`);
  }

  const { pages: targetPages, shard: applied } = selectPages(PAGES, {
    ids,
    page: values.page ? String(values.page) : pageWord,
    filter: values.filter ? String(values.filter) : undefined,
    queries,
    limit: limit && Number.isFinite(limit) ? limit : undefined,
    shard,
  });

  if (applied) {
    console.log(
      `\n🧩 [Matrix Sharding]: Worker Shard ${applied.index}/${applied.total} -> Recording ${targetPages.length} pages (index ${applied.from + 1} to ${applied.to})`,
    );
  }

  if (targetPages.length === 0) {
    // A shard with nothing to do is normal when there are fewer pages than
    // workers; failing it would fail the matrix for no reason.
    if (applied) {
      console.log(`\nℹ️ [Matrix Sharding]: No pages assigned to this worker shard. Exiting cleanly.`);
      process.exit(0);
    }
    console.error(`❌ No matching page found for: ${rawArgs.join(' ') || '(nothing)'}`);
    console.log(`Available page IDs: ${PAGES.map((p) => p.id).join(', ')}`);
    console.log(`Tip: run \`npm run record -- --list\` to view all routes.`);
    process.exit(1);
  }

  await assertServicesUp(Boolean(values.force));

  console.log(`\n======================================================`);
  console.log(
    `🎬 STARTING AUTOMATED RECORDING FOR ${targetPages.length} PAGE(S)`,
  );
  console.log(`======================================================\n`);

  const engine = new RecordingEngine(ROOT);
  const results: PageResult[] = [];
  const suiteStartTime = Date.now();

  for (const pageConfig of targetPages) {
    const pageStartTime = Date.now();
    const res = await engine.recordPage(pageConfig);
    const durationSec = Number(((Date.now() - pageStartTime) / 1000).toFixed(1));

    results.push({
      id: pageConfig.id,
      name: pageConfig.name,
      filename: res.filename,
      success: res.success,
      outcome: res.outcome,
      durationSec,
      error: res.error,
      warnings: res.warnings,
      consoleErrors: res.consoleErrors,
    });
  }

  const shardId = shard ? `${shard.index}-${shard.total}` : null;
  const resultsPath = writeResultsFile(results, shardId);

  const totalDuration = ((Date.now() - suiteStartTime) / 1000).toFixed(1);
  const failedCount = results.filter((r) => r.outcome === 'fail').length;
  const issueCount = results.filter((r) => r.outcome === 'issue').length;
  const passedCount = results.filter((r) => r.outcome === 'pass').length;
  const warnedCount = results.filter((r) => r.success && r.warnings.length > 0).length;

  console.log(`\n======================================================`);
  console.log(`📊 RECORDING SUITE SUMMARY (Total: ${totalDuration}s)`);
  console.log(`======================================================`);
  for (const r of results) {
    if (r.outcome === 'fail') {
      console.log(
        `   ❌ [FAIL]  (${r.durationSec}s) ${r.name} -> ${r.filename || '(no video)'}`,
      );
      console.log(`        · ${r.error || 'Error captured'}`);
      for (const w of r.warnings) console.log(`        · ${w}`);
      continue;
    }

    // ISSUE is not a lesser PASS. The take is good; the feature it documents is
    // not, and someone reading this summary has to be able to tell those apart
    // at a glance -- a green tick beside a broken page is how a defect quietly
    // stops being news.
    const badge =
      r.outcome === 'issue'
        ? '🐞 [ISSUE]'
        : r.warnings.length > 0
          ? '⚠️  [PASS*]'
          : '✅ [PASS] ';
    console.log(`   ${badge} (${r.durationSec}s) ${r.name} -> ${r.filename}`);
    for (const w of r.warnings) console.log(`        · ${w}`);
  }
  console.log(`======================================================`);
  console.log(
    `   ${passedCount} passed` +
      (warnedCount > 0 ? ` (${warnedCount} with notes)` : '') +
      (issueCount > 0 ? `, ${issueCount} documenting known issues` : '') +
      `, ${failedCount} failed`,
  );
  console.log(`📁 Video files saved to: ${VIDEOS_DIR}`);
  console.log(`📄 Per-page outcomes: ${resultsPath}\n`);

  // Known issues deliberately do not gate: seven documented defects would make
  // this pipeline red every night, and a pipeline that is always red is one
  // nobody reads. What gates is a break in this repo -- or a page that stopped
  // reproducing its issue, which shows up as an unexpected [PASS] to be chased.
  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal recording error:', err);
  process.exit(1);
});
