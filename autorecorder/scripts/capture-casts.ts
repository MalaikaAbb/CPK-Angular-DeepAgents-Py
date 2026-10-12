/**
 * Runs the real `ng serve` commands behind the compile-error clips and saves
 * their output, with timings, as asciinema casts in assets/casts/.
 *
 *   npm run capture:casts                 all of them
 *   npm run capture:casts -- a2uiDoc      one, by key in actions/compile-casts.ts
 *
 * Re-run after changing any doc-verbatim file or angular.json; the clip warns
 * when its cast is older than the files it compiled.
 */
import { CASTS, type CastSpec } from '../actions/compile-casts';
import { captureCast, castText, writeCast } from '../actions/terminal';

const wanted = process.argv.slice(2);
const entries = Object.entries(CASTS as Record<string, CastSpec>).filter(
  ([key]) => wanted.length === 0 || wanted.includes(key),
);

let failed = false;
for (const [key, spec] of entries) {
  console.log(`\n▶ ${key}: ${spec.command}`);
  const cast = await captureCast({
    command: spec.command,
    cwd: spec.cwd,
    title: 'Windows PowerShell',
    stopWhen: spec.stopWhen,
    graceMs: 1500,
    timeoutMs: 300_000,
  });
  const text = castText(cast);
  if (!spec.expect.test(text)) {
    failed = true;
    console.error(`  ✗ output does not match ${spec.expect} -- not saved. Output:\n${text}`);
    continue;
  }
  writeCast(spec.file, cast);
  console.log(`  ✓ ${cast.events.length} events, ${cast.header.duration}s -> ${spec.file}`);
}
process.exit(failed ? 1 : 0);
