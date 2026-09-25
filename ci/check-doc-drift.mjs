import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { checkPageCoverage, formatCoverageTable } from './check-page-coverage.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'doc-snapshot', 'manifest.json');
const PAGES_DIR = path.join(ROOT_DIR, 'doc-snapshot', 'pages');

const CONCURRENCY = 6;
const TIMEOUT_MS = 10000;

function sha256(text) {
  return crypto.createHash('sha256').update(normalizeText(text), 'utf8').digest('hex');
}

function normalizeText(raw) {
  return raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

function categorizeSeverity(oldText, newText) {
  const oldCodeFences = (oldText.match(/```/g) || []).length;
  const newCodeFences = (newText.match(/```/g) || []).length;
  if (oldCodeFences !== newCodeFences) return 'HIGH (Code fence count changed)';

  const oldCodeLines = oldText.split('\n').filter((l) => l.startsWith('    ') || l.startsWith('```'));
  const newCodeLines = newText.split('\n').filter((l) => l.startsWith('    ') || l.startsWith('```'));
  if (oldCodeLines.join('\n') !== newCodeLines.join('\n')) {
    return 'HIGH (Code block content changed)';
  }

  const oldHeadings = oldText.split('\n').filter((l) => l.startsWith('#')).join('\n');
  const newHeadings = newText.split('\n').filter((l) => l.startsWith('#')).join('\n');
  if (oldHeadings !== newHeadings) {
    return 'MEDIUM (Headings / Structure changed)';
  }

  return 'LOW (Prose / text phrasing updated)';
}

async function checkPage(docPath, pageMeta) {
  const url = `https://docs.copilotkit.ai${docPath}.md`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': 'CopilotKit-DocDrift-Detector/1.0',
        Accept: 'text/markdown, text/plain, */*',
      },
    });

    if (res.status === 404) {
      return {
        docPath,
        file: pageMeta.file,
        status: '404',
        drifted: true,
        severity: 'HIGH (Page 404 / Removed)',
      };
    }

    if (!res.ok) {
      return {
        docPath,
        file: pageMeta.file,
        status: String(res.status),
        error: `HTTP ${res.status} ${res.statusText}`,
        drifted: false,
      };
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/markdown') && !contentType.includes('text/plain')) {
      // HTML fallback response (soft 404 or SPA redirect)
      return {
        docPath,
        file: pageMeta.file,
        status: 'invalid-content-type',
        error: `Expected markdown, received ${contentType}`,
        drifted: false,
      };
    }

    const fetchedText = await res.text();
    const fetchedHash = sha256(fetchedText);

    if (fetchedHash === pageMeta.sha256) {
      return { docPath, file: pageMeta.file, drifted: false, status: 'ok' };
    }

    // Hash differs - determine severity
    let oldContent = '';
    try {
      oldContent = await fs.readFile(path.join(PAGES_DIR, pageMeta.file), 'utf8');
    } catch {
      // no previous file
    }

    const severity = categorizeSeverity(oldContent, fetchedText);
    return {
      docPath,
      file: pageMeta.file,
      drifted: true,
      severity,
      oldHash: pageMeta.sha256.slice(0, 8),
      newHash: fetchedHash.slice(0, 8),
      fullHash: fetchedHash,
      fetchedText,
      bytes: Buffer.byteLength(fetchedText, 'utf8'),
      lines: fetchedText.split('\n').length,
      status: 'drifted',
    };
  } catch (err) {
    return {
      docPath,
      file: pageMeta.file,
      drifted: false,
      status: 'fetch-error',
      error: err.message,
    };
  }
}

export async function applyDocUpdates(driftedPages) {
  const manifestRaw = await fs.readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(manifestRaw);
  let updatedCount = 0;

  for (const p of driftedPages) {
    if (p.fetchedText && p.file) {
      const filePath = path.join(PAGES_DIR, p.file);
      await fs.writeFile(filePath, p.fetchedText, 'utf8');

      if (manifest.pages[p.docPath]) {
        manifest.pages[p.docPath].sha256 = p.fullHash;
        manifest.pages[p.docPath].bytes = p.bytes;
        manifest.pages[p.docPath].lines = p.lines;
        manifest.pages[p.docPath].date = new Date().toUTCString();
      }
      updatedCount++;
      console.log(` ✅ Updated ${p.file} (${p.docPath})`);
    }
  }

  manifest.syncedAt = new Date().toISOString();
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`\n💾 Successfully updated ${updatedCount} markdown file(s) and saved doc-snapshot/manifest.json.`);
  return updatedCount;
}

/**
 * The gap the hash check cannot see: pages that appeared upstream.
 *
 * Every URL the sitemap lists under this repo's docs root is either tracked
 * (a manifest page), already acknowledged (`sitemap.knownUnmapped`, seeded by
 * /doc-sync), or new. New is drift -- a page nobody has read, with no route,
 * no recorder entry and no diff. Ten of them were missed on 2026-09-04 because
 * only the in-app /doc-sync action made this comparison and nothing in CI ran
 * it. The same logic as `buildSitemapFinding` in
 * frontend/src/lib/doc-sync/actions.ts, without the Next.js import chain.
 *
 * `lastmod` is ignored on purpose: it is the site's build stamp, not a
 * per-page modification time.
 */
let _manifestCache;
function manifestRoutes(docPath) {
  return (_manifestCache?.pages?.[docPath]?.routes ?? []).join(', ') || '-';
}

/**
 * Since 2026-09-23 the sitemap lists the guides every Angular framework shares
 * once, framework-less, as `/angular/X`; only framework-specific pages stay
 * under `/angular/<framework>/`. The framework-scoped copies still serve and
 * still sit in the sidebar, so map each shared `/angular/X` onto this section
 * as `/angular/<framework>/X`. Otherwise every shared page reads as "no longer
 * listed" and every new shared page goes unseen.
 *
 * A framework section is an `/angular/<slug>` listed bare AND with its own
 * `/quickstart`; those belong to other frameworks and are skipped. Both are
 * needed: `/angular/intelligence/quickstart` exists, but `intelligence` is a
 * shared section, not a framework, and has no bare root.
 */
function sharedAngularPages(locs, root, prefix) {
  const angular = `${root.origin}/angular/`;
  if (!prefix.startsWith(angular)) return [];
  const bare = new Set(locs.map((u) => u.match(/^https?:\/\/[^/]+\/angular\/([^/]+)$/)?.[1]));
  const frameworks = new Set(
    locs
      .map((u) => u.match(/^https?:\/\/[^/]+\/angular\/([^/]+)\/quickstart$/)?.[1])
      .filter((slug) => slug && bare.has(slug)),
  );
  return locs
    .filter((u) => u.startsWith(angular))
    .map((u) => u.slice(angular.length))
    .filter((rest) => rest && !frameworks.has(rest.split('/')[0]))
    .map((rest) => `${prefix}${rest}`);
}

export async function checkSitemapGaps(manifest) {
  _manifestCache = manifest;
  const root = new URL(manifest.docsRoot);
  const prefix = `${root.origin}${root.pathname.replace(/\/+$/, '')}/`;

  let xml;
  try {
    const res = await fetch(`${root.origin}/sitemap.xml`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'CopilotKit-DocDrift-Detector/1.0' },
    });
    if (!res.ok) return { error: `sitemap HTTP ${res.status}`, newUnmapped: [], missingFromSitemap: [] };
    xml = await res.text();
  } catch (err) {
    return { error: err.message, newUnmapped: [], missingFromSitemap: [] };
  }

  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const upstream = [...new Set([
    // The section root itself is listed without the trailing slash.
    ...locs.filter((u) => u.startsWith(prefix) || u === prefix.slice(0, -1)),
    ...sharedAngularPages(locs, root, prefix),
  ])];

  const covered = new Set(Object.keys(manifest.pages).map((docPath) => `${root.origin}${docPath}`));
  const known = new Set(manifest.sitemap?.knownUnmapped ?? []);
  const upstreamSet = new Set(upstream);

  return {
    urlsUnderRoot: upstream.length,
    newUnmapped: upstream.filter((u) => !covered.has(u) && !known.has(u)),
    // Tracked but no longer listed. Alone this is a hint, not a removal --
    // the per-page 404 check above is the other half of that verdict.
    missingFromSitemap: [...covered].filter((u) => !upstreamSet.has(u)),
  };
}

export async function checkAllDocDrift() {
  const manifestRaw = await fs.readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(manifestRaw);
  const entries = Object.entries(manifest.pages);

  console.log(`\n🔍 Checking doc drift across ${entries.length} tracked pages against live docs...`);

  const results = [];
  const queue = [...entries];

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      const [docPath, pageMeta] = item;
      const res = await checkPage(docPath, pageMeta);
      results.push(res);
      process.stdout.write(res.drifted ? '!' : res.error ? '?' : '.');
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);
  process.stdout.write('\n\n');

  const driftedPages = results.filter((r) => r.drifted);
  // A page that could not be read (5xx, an HTML soft-404, a timeout) has not
  // been compared, so it is not "unchanged". These make the verdict `unknown`.
  const errors = results.filter((r) => r.error);

  const sitemap = await checkSitemapGaps(manifest);
  if (sitemap.error) {
    console.log(`ℹ️  Sitemap unreachable (${sitemap.error}); new upstream pages NOT checked this run.`);
  } else {
    console.log(
      `🗺️  Sitemap: ${sitemap.urlsUnderRoot} URLs under ${manifest.docsRoot}, ` +
        `${sitemap.newUnmapped.length} new, ${sitemap.missingFromSitemap.length} tracked page(s) no longer listed.`,
    );
    for (const u of sitemap.missingFromSitemap) console.log(`   · not in sitemap: ${u}`);
  }

  const drifted = driftedPages.length > 0 || sitemap.newUnmapped.length > 0;
  return {
    total: entries.length,
    checked: results.length,
    drifted,
    // Not drifted, but not verified either: some page or the sitemap could not
    // be read. Callers must not report this as "all pages match".
    unknown: !drifted && (errors.length > 0 || Boolean(sitemap.error)),
    driftedPages,
    sitemap,
    errors,
  };
}

/** One line per page the check could not read, for every caller to print. */
export function formatUnreadable(result) {
  const lines = result.errors.map((e) => ` • ${e.docPath}: ${e.error}`);
  if (result.sitemap?.error) lines.push(` • sitemap.xml: ${result.sitemap.error}`);
  return lines.join('\n');
}

// Standalone execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const autoUpdate = args.includes('--update') || args.includes('--sync') || args.includes('-u');

  // Scope, said out loud on every run. Tracked pages are hashed; the sitemap
  // is compared for pages that appeared upstream (new = drift, exit 2).
  // Renames and removals are only hinted -- a tracked page that 404s AND has
  // left the sitemap is reported, but nothing here decides it was renamed.
  process.on('exit', () => {
    console.log(
      '\nℹ️  Scope: tracked pages hashed + sitemap compared for new pages.\n' +
        '   A page that 404s and has left the sitemap is listed; whether it was\n' +
        '   renamed is a judgement for /doc-sync and the reader.',
    );
  });

  const result = await checkAllDocDrift();

  // Manifest -> route -> recorder coverage, printed in the same prepare-job
  // output. Reported only: the drift exit code below is decided by drift
  // alone, so a coverage gap never masks (or fakes) a doc change.
  try {
    console.log(formatCoverageTable(checkPageCoverage()));
  } catch (err) {
    console.log(`ℹ️  Page coverage not checked (${err.message}).`);
  }
  console.log('');

  if (result.sitemap.newUnmapped.length > 0) {
    console.log('🆕 [NEW UPSTREAM PAGES] Listed in the sitemap, tracked nowhere in this repo:');
    for (const u of result.sitemap.newUnmapped) console.log(` • ${u}`);
    console.log('   Snapshot them from http://localhost:4230/doc-sync, or add them to\n' +
      '   sitemap.knownUnmapped in doc-snapshot/manifest.json to acknowledge them.\n');
  }
  const gone = result.driftedPages.filter((p) => p.status === '404' &&
    result.sitemap.missingFromSitemap?.includes(`https://docs.copilotkit.ai${p.docPath}`));
  if (gone.length > 0) {
    console.log('🗑️  [REMOVED OR RENAMED] 404 on the markdown endpoint AND gone from the sitemap:');
    for (const p of gone) console.log(` • ${p.docPath}  (route(s): ${manifestRoutes(p.docPath)})`);
    console.log('   The route(s) still serve and the recorder still passes them. Decide, then delete.\n');
  }

  if (result.driftedPages.length > 0) {
    console.log('🚨 [DOC DRIFT DETECTED] The following live documentation pages have changed:');
    console.log('───────────────────────────────────────────────────────────────────────────');
    for (const p of result.driftedPages) {
      console.log(` • [${p.severity}] ${p.docPath}`);
      if (p.oldHash && p.newHash) {
        console.log(`   Hash: ${p.oldHash} ➔ ${p.newHash} (${p.file})`);
      }
    }
    console.log('───────────────────────────────────────────────────────────────────────────');
    if (result.errors.length > 0 || result.sitemap.error) {
      console.log('❓ Also NOT compared (could not be read):');
      console.log(formatUnreadable(result));
    }

    if (autoUpdate) {
      console.log('\n🔄 Applying changes to local markdown snapshot files (--update flag)...');
      await applyDocUpdates(result.driftedPages);
      console.log('✨ Local markdown files are now in sync with live docs.');
      process.exit(0);
    } else {
      if (process.stdin.isTTY) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await rl.question('\n❓ Would you like to update and overwrite the local markdown files now? (y/N): ');
        rl.close();

        if (answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes') {
          console.log('\n🔄 Applying changes to local markdown files...');
          await applyDocUpdates(result.driftedPages);
          console.log('✨ Local markdown files are now in sync with live docs.');
          process.exit(0);
        }
      }

      console.log('\n👉 Local markdown files NOT modified. Pass `--update` or visit http://localhost:4230/doc-sync to sync.');
      process.exit(2);
    }
  }
  if (result.driftedPages.length === 0) {
    if (result.sitemap.newUnmapped.length > 0) process.exit(2);
    // Exit 3, not 0: the workflow reads anything but 0/2 as `unknown`, which
    // halts a scheduled run instead of recording against an unverified snapshot.
    if (result.unknown) {
      console.log(
        `❓ [DRIFT UNKNOWN] ${result.checked - result.errors.length} of ${result.total} page(s) match; ` +
          `these could not be read, so they were NOT compared:`,
      );
      console.log(formatUnreadable(result));
      process.exit(3);
    }
    console.log(`✅ [NO DOC DRIFT] All ${result.total} documentation pages match the local snapshot.`);
    process.exit(0);
  }
}
