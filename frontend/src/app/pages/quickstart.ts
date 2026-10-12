import { Component } from '@angular/core';

import { RouteHeader } from '../components/route-header';
import { Callout, Panel, SourceCode, TryIt } from '../components/ui';

@Component({
  selector: 'app-quickstart-page',
  imports: [RouteHeader, Panel, Callout, TryIt, SourceCode],
  template: `
    <app-route-header path="/quickstart" />

    <div class="space-y-6">
      <ui-try-it>
        <p class="mt-1 text-slate-700">
          Open the demo and send <em>Can you tell me a joke?</em>
        </p>
        <p class="mt-2 text-slate-700">
          <strong>Pass:</strong> tokens stream in one at a time and render as
          markdown.
          <strong>Fail:</strong> nothing streams — check the connection panel on
          the Introduction route; one of the two backends is down.
        </p>
      </ui-try-it>

      <ui-panel heading="1 · The runtime, bound to the DeepAgents agent">
        <p class="mb-3 text-sm text-slate-700">
          The Angular quickstart's backend step defers to the selected
          integration: "Configure Copilot Runtime to register this backend as
          the <code>default</code> agent at <code>/api/copilotkit</code>." So
          the Node server below is the quickstart's, with
          <code>BuiltInAgent</code> replaced by the
          <code>LangGraphAgent</code> binding the DeepAgents quickstart uses to
          reach a <code>create_deep_agent</code> backend by
          <code>deploymentUrl</code> and <code>graphId</code>.
        </p>
        <ui-source path="server.ts" />
      </ui-panel>

      <ui-panel heading="2 · Import the styles">
        <p class="mb-3 text-sm text-slate-700">
          The package stylesheet is self-contained — the chat renders without
          any other CSS. It is the first import in the global stylesheet, ahead
          of this harness's own chrome.
        </p>
        <ui-source path="src/styles.css" note="first ~10 lines are the doc step" />
      </ui-panel>

      <ui-panel heading="3 · Connect to Copilot Runtime">
        <p class="mb-3 text-sm text-slate-700">
          One provider at the application root. The extra
          <code>a2ui</code> and <code>openGenerativeUI</code> options belong to
          later guides; the quickstart needs only <code>runtimeUrl</code>.
        </p>
        <ui-source path="src/app/app.config.ts" />
      </ui-panel>

      <ui-panel heading="4 · Add the chat UI">
        <ui-source path="src/app/features/quickstart/quickstart-chat.ts" />
      </ui-panel>

      <ui-callout title="Verify the runtime before blaming the frontend">
        The quickstart's troubleshooting box prescribes one check:
        <code>http://localhost:8230/api/copilotkit/info</code> should report the
        registered agents. The Introduction route probes exactly that.
      </ui-callout>

  
    </div>
  `,
})
export default class QuickstartPage {
  protected readonly builtInAgentSample = `const runtime = new CopilotRuntime({
  agents: {
    default: new BuiltInAgent({
      model: "openai:gpt-5.4-mini",
      prompt: "You are a helpful assistant for an Angular app.",
    }),
  },
});`;
}
