import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BackendHealth } from '../components/backend-health';
import { DocDriftPanel } from '../components/doc-drift-panel';
import { RouteHeader } from '../components/route-header';
import { Callout, Panel, SourceCode } from '../components/ui';
import { NAV } from '../lib/nav-config';

@Component({
  selector: 'app-introduction-page',
  imports: [
    RouterLink,
    RouteHeader,
    BackendHealth,
    DocDriftPanel,
    Panel,
    Callout,
    SourceCode,
  ],
  template: `
    <app-route-header path="/" />

    <div class="space-y-6">
      <app-backend-health />

      <doc-drift-panel />

      <ui-panel heading="What this is">
        <p class="text-sm text-slate-700">
          A navigable test harness for the Angular + DeepAgents section of the
          CopilotKit docs. Every guide listed in the sidebar is a route, and
          each route runs the thing its doc page teaches rather than restating
          it.
        </p>
        <p class="mt-3 text-sm text-slate-700">
          Routes with a live feature are split in two: the route itself holds
          the notes, pass/fail criteria, and the exact source that runs, and
          <code class="rounded bg-slate-100 px-1">&lt;route&gt;/demo</code>
          holds just the running feature with no page chrome.
        </p>
      </ui-panel>

      <ui-panel heading="Architecture">
        <pre
          class="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100"
        ><code>Browser (Angular 22, zoneless)
  &#124;  &#64;copilotkit/angular — provideCopilotKit, copilot-chat, signal APIs
  &#124;  POST http://localhost:8230/api/copilotkit
  v
Copilot Runtime  ·  localhost:8230        &#8592; Node, frontend/server.ts
  &#124;  agents: &#123; default, support &#125; &#8594; new LangGraphAgent(&#123; deploymentUrl, graphId &#125;)
  &#124;  http://localhost:8231 · graph "sample_agent"
  v
DeepAgents agent  ·  localhost:8231       &#8592; Python, langgraph dev
  &#124;  create_deep_agent(middleware=[CopilotKitMiddleware()])
  v
Model  (gpt-5.4-mini)</code></pre>

        <p class="mt-3 text-sm text-slate-700">
          Three processes, not two. Unlike the React quickstart — where the
          runtime lives inside the Next app — Angular has no server route, so
          the runtime is its own Node process. The model key only ever reaches
          the DeepAgents process.
        </p>
      </ui-panel>

      <ui-callout title="Both backends must be running">
        The chat will not stream if either process is down. Start the DeepAgents
        agent with
        <code>uv run --with "langgraph-cli[inmem]" langgraph dev --port 8231 --no-browser</code>
        from <code>backend/</code>, and the runtime with
        <code>npm run runtime</code> from <code>frontend/</code>.
      </ui-callout>

      <ui-panel heading="Routes">
        <ul class="space-y-4 text-sm">
          @for (group of nav; track group.title) {
            <li>
              <p class="font-semibold text-slate-900">{{ group.title }}</p>
              <ul class="mt-1 space-y-1">
                @for (route of group.routes; track route.path) {
                  <li>
                    <a
                      [routerLink]="route.path"
                      class="text-blue-700 underline decoration-dotted"
                      >{{ route.title }}</a
                    >
                    <span class="text-slate-600"> — {{ route.summary }}</span>
                  </li>
                }
              </ul>
            </li>
          }
        </ul>
      </ui-panel>

      <ui-panel heading="The runtime binding">
        <p class="mb-3 text-sm text-slate-700">
          This is the one file that ties CopilotKit to DeepAgents. It is read off disk
          at build time, so what you see is what runs.
        </p>
        <ui-source path="server.ts" />
      </ui-panel>
    </div>
  `,
})
export default class IntroductionPage {
  protected readonly nav = NAV;
}
