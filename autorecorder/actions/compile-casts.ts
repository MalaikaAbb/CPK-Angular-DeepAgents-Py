/**
 * The real command whose output the A2UI compile-error clip replays.
 *
 * Captured by `npm run capture:casts` (scripts/capture-casts.ts) into
 * assets/casts/. It runs `ng serve` on the doc-verbatim `doc-a2ui` build
 * configuration in frontend/angular.json, on port 4232 -- clear of the dev
 * stack (frontend 4230, runtime 8230, backend 8231) so a capture never collides
 * with running servers -- and is killed once the dev server has said what it
 * has to say.
 */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RECORDER = fileURLToPath(new URL('..', import.meta.url));
const REPO = join(RECORDER, '..');
const FRONTEND = join(REPO, 'frontend');

export interface CastSpec {
  file: string;
  command: string;
  cwd: string;
  stopWhen: RegExp;
  /** A capture that lacks this did not reproduce the finding. */
  expect: RegExp;
  /** Files the command compiled; a newer one makes the cast stale. */
  sources: string[];
}

const cast = (name: string) => join(RECORDER, 'assets', 'casts', `${name}.cast`);
const src = (p: string) => join(FRONTEND, ...p.split('/'));

export const CASTS = {
  a2uiDoc: {
    file: cast('a2ui-doc'),
    command: 'npx ng serve --configuration doc-a2ui --port 4232',
    cwd: FRONTEND,
    stopWhen: /Watch mode enabled/,
    expect: /TS2304: Cannot find name 'dynamicString'/,
    sources: [src('src/doc-verbatim/a2ui.ts'), src('angular.json')],
  },
} satisfies Record<string, CastSpec>;
