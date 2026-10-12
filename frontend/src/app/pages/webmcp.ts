import { Component } from '@angular/core';

import { RouteHeader } from '../components/route-header';
import { Callout, DocSample, Panel, SourceCode, TryIt } from '../components/ui';

@Component({
  selector: 'app-webmcp-page',
  imports: [RouteHeader, Panel, Callout, TryIt, SourceCode, DocSample],
  template: `
    <app-route-header path="/webmcp" />

    <div class="space-y-6">
      <ui-try-it>
        <p class="mt-1 text-slate-700">
          <strong>CopilotKit agent path:</strong> open the demo and ask
          <em>Which of my orders are open?</em>
        </p>
        <p class="mt-2 text-slate-700">
          <strong>Pass:</strong> the agent calls <code>searchOrders</code> and
          reports <code>ORD-1001</code> and <code>ORD-1004</code>.
          <strong>Fail:</strong> the agent says it has no way to look up
          orders.
        </p>
        <p class="mt-3 text-slate-700">
          <strong>WebMCP path:</strong> in Chrome 149 or newer with the WebMCP
          origin trial or <code>chrome://flags/#enable-webmcp-testing</code>,
          open the demo. It should show
          <code>document.modelContext: available</code>. In the Model Context
          Tool Inspector, find <code>searchOrders</code>, call it with
          <code>status: "shipped"</code>.
        </p>
        <p class="mt-2 text-slate-700">
          <strong>Pass:</strong> the tool is listed with its description and
          <code>status</code> enum, and returns <code>ORD-1002</code>.
          <strong>Fail:</strong> the tool does not appear while
          <code>document.modelContext</code> is available.
        </p>
      </ui-try-it>

      <ui-callout tone="warn" title="WebMCP is experimental">
        WebMCP is a draft Community Group report, not a W3C Standard. Without
        Chrome 149+ and the origin trial or testing flag,
        <code>document.modelContext</code> is unavailable and CopilotKit does
        nothing on the WebMCP side — the tool still reaches the CopilotKit
        agent.
      </ui-callout>

      <ui-panel heading="Angular frontend tool with webmcp">
        <p class="mb-3 text-sm text-slate-700">
          The guide's component, verbatim, with one added import:
          <code>searchOrders</code> is never defined by the guide.
        </p>
        <ui-source path="src/app/features/webmcp/order-search.component.ts" />
      </ui-panel>

      <ui-panel heading="searchOrders — harness stand-in">
        <p class="mb-3 text-sm text-slate-700">
          Not doc code. A fixed in-memory list so the handler has something to
          return.
        </p>
        <ui-source path="src/app/features/webmcp/orders.ts" />
      </ui-panel>

      <ui-panel heading="Mounted against one chat">
        <ui-source path="src/app/features/webmcp/webmcp-chat.component.ts" />
      </ui-panel>

      <ui-panel heading="WebMCP only, with no agent">
        <p class="mb-3 text-sm text-slate-700">
          Shown, not run. It imports <code>@copilotkit/core</code>, which this
          repo has only as a transitive dependency, calls the same undefined
          <code>searchOrders</code>, and registers the same tool name — on one
          page CopilotKit would expose only the first and log a warning.
        </p>
        <ui-doc-sample
          caption="WebMCP guide — webmcp.ts"
          [code]="coreOnlySample"
        />
      </ui-panel>

      <ui-callout title="Agent scope does not scope WebMCP">
        <code>agentId</code> limits which CopilotKit agent receives a frontend
        tool. WebMCP tools are page-level, so <code>agentId</code> does not
        restrict browser-agent access.
      </ui-callout>
    </div>
  `,
})
export default class WebmcpPage {
  protected readonly coreOnlySample = `import { CopilotKitCore } from "@copilotkit/core";
import { z } from "zod";

export const copilotkit = new CopilotKitCore({
  tools: [
    {
      name: "searchOrders",
      description: "Search the signed-in user's orders by status",
      parameters: z.object({
        status: z.enum(["open", "shipped", "delivered"]),
      }),
      handler: async ({ status }) => {
        const orders = await searchOrders(status);
        return JSON.stringify(orders);
      },
      webmcp: {
        annotations: {
          readOnlyHint: true,
        },
      },
    },
  ],
});`;
}
