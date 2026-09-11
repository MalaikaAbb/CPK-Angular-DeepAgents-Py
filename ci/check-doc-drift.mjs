import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

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
  const errors = results.filter((r) => r.error);

  return {
    total: entries.length,
    checked: results.length,
    drifted: driftedPages.length > 0,
    driftedPages,
    errors,
  };
}

// Standalone execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const autoUpdate = args.includes('--update') || args.includes('--sync') || args.includes('-u');

  const result = await checkAllDocDrift();
  if (result.drifted) {
    console.log('🚨 [DOC DRIFT DETECTED] The following live documentation pages have changed:');
    console.log('───────────────────────────────────────────────────────────────────────────');
    for (const p of result.driftedPages) {
      console.log(` • [${p.severity}] ${p.docPath}`);
      if (p.oldHash && p.newHash) {
        console.log(`   Hash: ${p.oldHash} ➔ ${p.newHash} (${p.file})`);
      }
    }
    console.log('───────────────────────────────────────────────────────────────────────────');

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

      console.log('\n👉 Local markdown files NOT modified. Pass `--update` or visit http://localhost:4203/doc-sync to sync.');
      process.exit(2);
    }
  } else {
    console.log(`✅ [NO DOC DRIFT] All ${result.total} documentation pages match the local snapshot.`);
    if (result.errors.length > 0) {
      console.log(`ℹ️  Note: ${result.errors.length} page(s) could not be fetched due to network timeout.`);
    }
    process.exit(0);
  }
}
