/**
 * The A2UI guide's own code, compiled (FINDINGS.md minor note #1).
 *
 * The clip does not edit the working app. The doc-verbatim code lives in
 * frontend/src/doc-verbatim/, and frontend/angular.json has a build
 * configuration that swaps it in with `fileReplacements`:
 *
 *   doc-a2ui   a2ui.stub.ts -> the A2UI guide's 3 blocks   (TS2304 x22)
 *
 * The failing dev server never opens its port, so there is no browser overlay
 * to film; the error is shown as the REAL `ng serve` output, captured by
 * `npm run capture:casts` and replayed in a terminal window (actions/terminal.ts).
 *
 * Flow: the engine's intro shows the doc and the working code, then lands on
 * the page's working demo route (that is what `chatReady` waits for). The take
 * below then plays the beats, one typed Notepad note per line.
 */
import { PROJECT } from '../config/project.config';
import { type ActionContext, type PageActionHandler } from '../core/types';
import { CASTS, type CastSpec } from './compile-casts';
import { runTake, type TakeStep } from './take';
import { castIsFresh, castText, readCast } from './terminal';
import { existsSync } from 'node:fs';

/** A cast that is missing, stale, or no longer shows the finding. */
function checkCast(spec: CastSpec, ctx: ActionContext): boolean {
  if (!existsSync(spec.file)) {
    ctx.fail(`no captured output at ${spec.file} -- run \`npm run capture:casts\` first`);
    return false;
  }
  if (!spec.expect.test(castText(readCast(spec.file)))) {
    ctx.fail(`${spec.file} does not contain ${spec.expect} -- the finding did not reproduce`);
    return false;
  }
  const fresh = castIsFresh(spec.file, spec.sources);
  if (!fresh.fresh) ctx.warn(`captured output may be stale (${fresh.reason}); re-run \`npm run capture:casts\``);
  // Evidence from a capture, not from this run's build: the stale warning
  // above is what says how much to trust it.
  ctx.reproduced(`captured build output ${spec.file} matches ${spec.expect}`);
  return true;
}

function reportMissing(missing: string[], ctx: ActionContext): void {
  if (missing.length) ctx.warn(`doc snippet(s) not found on the live page: ${missing.join(' | ')}`);
}

const origin = new URL(PROJECT.frontendUrl).origin;

// ── A2UI. Undefined names (#1) ──────────────────────────────────────────────

export const runA2uiCompileAction: PageActionHandler = async (page, config, rootPath, ctx) => {
  if (!checkCast(CASTS.a2uiDoc, ctx)) return;
  const title = 'a2ui-compile.txt';
  const steps: TakeStep[] = [
    {
      kind: 'doc',
      url: config.docUrl,
      snippets: ['const fixedDefinitions', 'a2uiConfigForFeature', 'catalog: productCatalog'],
      dwellMs: 2200,
    },
    {
      kind: 'note',
      title,
      lines: [
        'The Deep Agents A2UI page uses `dynamicString` and passes `productCatalog`',
        'as the catalog.',
        'It has no imports and defines neither.',
      ],
    },
    {
      kind: 'ide',
      tabs: [{ filePath: 'frontend/src/doc-verbatim/a2ui.ts', startLine: 7, endLine: 49 }],
      dwellMs: 3000,
    },
    {
      kind: 'terminal',
      cast: CASTS.a2uiDoc.file,
      focus: [
        { text: "Cannot find name 'dynamicString'", holdMs: 3800 },
        { text: "Cannot find name 'A2UIConfig'", holdMs: 3200 },
        { text: "Cannot find name 'productCatalog'", holdMs: 3200 },
      ],
    },
    {
      kind: 'note',
      title,
      lines: [
        '`dynamicString` doesn\'t exist in any CopilotKit package,',
        'and the catalogs are never built.',
      ],
    },
    {
      kind: 'ide',
      tabs: [{ filePath: 'frontend/src/app/app.config.ts', startLine: 54, endLine: 56 }],
    },
    {
      kind: 'note',
      title,
      lines: [
        'A2UI only turns on with a real `Catalog`,',
        'and the page never shows how to make one.',
      ],
    },
    {
      kind: 'note',
      title: 'fix.txt',
      lines: [
        'FIX: the page has to show the imports, where `dynamicString` comes from,',
        'and how to build the catalog. Without those, it can\'t be implemented.',
        ' 1. imports: z (zod), provideCopilotKit, A2UIConfig',
        ' 2. dynamicString: closest export is DynamicStringSchema (@a2ui/web_core)',
        ' 3. productCatalog = new Catalog(...) from',
        '    @copilotkit/a2ui-renderer/web-components (not re-exported by angular)',
      ],
    },
  ];
  const report = await runTake(page, steps, { origin, rootDir: rootPath });
  reportMissing(report.missingSnippets, ctx);
};
