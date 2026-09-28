/**
 * Harness wrapper mounting both thread surfaces from the guide: the hand-built
 * list on `injectThreads`, and the drop-in drawer beside a chat.
 *
 * Layout only. Both surfaces are published components used exactly as the guide
 * shows them — `thread-list.component.ts` and `conversations.component.ts` are
 * untouched, and nothing here changes their markup or behaviour. The two panes
 * sit side by side inside the viewport so the list and the chat are visible at
 * once; stacked, the chat fell below the fold and the demo had to be scrolled
 * in two directions to be read.
 *
 * The `::ng-deep` rules reach into `app-conversations` to give the drawer and
 * the chat a height to fill. They live here, in harness code, rather than in
 * the verbatim snippet component.
 */
import { Component } from '@angular/core';

import { ConversationsComponent } from './conversations.component';
import { ThreadListComponent } from './thread-list.component';

@Component({
  selector: 'app-threads-demo',
  imports: [ThreadListComponent, ConversationsComponent],
  template: `
    <div class="flex h-full min-h-0 flex-col gap-4 p-4 lg:flex-row">
      <section
        class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white p-4 lg:w-72 lg:shrink-0"
      >
        <h2 class="mb-2 shrink-0 text-sm font-semibold text-slate-900">
          Headless list — injectThreads
        </h2>
        <div class="min-h-0 flex-1 overflow-y-auto">
          <app-thread-list />
        </div>
      </section>

      <section
        class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white p-4"
      >
        <h2 class="mb-2 shrink-0 text-sm font-semibold text-slate-900">
          CopilotThreadsDrawer + chat
        </h2>
        <div class="min-h-0 flex-1">
          <app-conversations />
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        min-height: 0;
      }

      app-conversations {
        display: flex;
        gap: 1rem;
        height: 100%;
        min-height: 0;
      }

      /* The drawer keeps its own width; the chat takes the rest. */
      ::ng-deep app-conversations > copilot-threads-drawer {
        flex: 0 0 auto;
        min-height: 0;
        overflow-y: auto;
      }

      ::ng-deep app-conversations > copilot-chat {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
      }
    `,
  ],
})
export class ThreadsDemoComponent {}
