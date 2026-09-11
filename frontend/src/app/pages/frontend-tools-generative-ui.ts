import { Component } from '@angular/core';

import { RouteHeader } from '../components/route-header';
import { Callout, Panel, SourceCode, TryIt } from '../components/ui';

@Component({
  selector: 'app-tools-page',
  imports: [RouteHeader, Panel, Callout, TryIt, SourceCode],
  template: `
    <app-route-header path="/frontend-tools-generative-ui" />

    <div class="space-y-6">
      <ui-try-it>
        <p class="mt-1 text-[var(--ink-soft)]">
          Open the demo. Send <em>What's the weather in Tokyo?</em>, then
          <em>Change the background to violet</em> — one tool per path.
        </p>
        <p class="mt-2 text-[var(--ink-soft)]">
          <strong>Pass (server-side tool):</strong> the call renders through
          <code>WeatherCardComponent</code> — "Loading weather for Tokyo" for
          about a second and a half, then the city in bold with the result
          beneath.
          <strong>Fail:</strong> a plain-text answer with no card, which means
          the renderer name and the agent's tool name have drifted apart.
        </p>
        <p class="mt-2 text-[var(--ink-soft)]">
          <strong>Pass (browser-executed tool):</strong> the demo panel repaints
          to a violet gradient the moment the call completes, and
          <em>nothing</em> renders in the chat for it — that tool has a handler
          and no component. Try <em>sunset</em>, <em>forest</em>,
          <em>#0ea5e9</em>, or a full <code>linear-gradient(...)</code> too.
          <strong>Fail:</strong> the agent claims it changed the background but
          the panel stays grey — the handler never ran.
        </p>
        <p class="mt-2 text-[var(--ink-soft)]">
          <strong>Pass (display-only component):</strong> send
          <em>Show me incident INC-4711 at sev1</em> — an
          <code>IncidentCardComponent</code> renders the id in bold with the
          severity beside it, and the agent writes no tool result of its own.
          <strong>Fail:</strong> the incident comes back described in prose,
          which means <code>show_incident</code> was never called.
        </p>

        <p class="mt-2 text-[var(--ink-soft)]">
          <strong>If nothing renders at all,</strong> check the AG-UI stream for
          a <code>TOOL_CALL_START</code>. On a long thread the model often
          answers from conversation history instead of calling the tool, and no
          tool call means nothing for the renderer to draw. Start a fresh thread
          before concluding the registration is broken.
        </p>
      </ui-try-it>

      <ui-panel heading="Render a tool result">
        <p class="mb-3 text-sm text-[var(--ink-soft)]">
          A renderer is a standalone component with a required
          <code>toolCall</code> signal input. Its status moves through
          <code>"in-progress"</code>, <code>"executing"</code>, and
          <code>"complete"</code>.
        </p>
        <ui-source path="src/app/features/tools/weather-card.component.ts" />
      </ui-panel>

      <ui-panel heading="registerRenderToolCall — server-side tool, browser renders">
        <p class="text-sm text-[var(--ink-soft)]">
          The DeepAgents agent owns the <code>getWeather</code> tool; the browser only
          renders its call. The registration is in
          <code>tools-chat.component.ts</code>, shown in full below alongside
          the browser-executed tool.
        </p>
      </ui-panel>

      <ui-callout tone="warn" title="The renderer name must equal the tool name">
        <code>registerRenderToolCall({{ '{' }} name {{ '}' }})</code> matches the
        agent's tool by exact string. The DeepAgents agent in
        <code>backend/main.py</code> has to declare its tool as
        <code>getWeather(city)</code> for that reason — the guide's snippet is
        written against that name and that argument. A
        <code>get_weather</code>/<code>getWeather</code> mismatch fails silently:
        the tool still runs and the agent still answers, you just get plain text
        where the card should be.
      </ui-callout>
      
      <ui-panel
        heading="registerComponent — display only, nothing on the agent side"
      >
        <p class="mb-3 text-sm text-[var(--ink-soft)]">
          The simplest generative UI there is, and the only kind that needs
          nothing on the agent side. <code>show_incident</code> has no handler
          and no matching tool in <code>backend/main.py</code>: the frontend
          declares it, CopilotKit forwards it to the agent over AG-UI, and the
          agent calls it purely to put the component on screen. Core inserts an
          empty tool result, so the turn completes without an invented result
          being written into the thread.
        </p>
        <ui-source
          path="src/app/features/tools/incident-card.component.ts"
          note="standalone: true dropped — the default on v20+"
        />
        <p class="mt-4 text-sm text-[var(--ink-soft)]">
          Contrast <code>registerRenderToolCall</code> above, which draws a tool
          the agent already owns and so requires that tool to exist on the
          agent side. The registration is in
          <code>tools-chat.component.ts</code>, shown in full below.
        </p>
      </ui-panel>

      <ui-callout
        tone="warn"
        title="A well-formed component is not a correct one"
      >
        The model fills these props from what it knows. A card rendered over
        records this application does not hold looks the same in the browser, in
        a screenshot, and in a video as a correct one. Share the page's data
        with the agent through <code>CopilotKitAgentContext</code> — the
        Shared state route does exactly that — then read the rendered fields
        back against the records you hold.
      </ui-callout>

      <ui-panel heading="Open Generative UI — sandboxed host functions">
        <p class="mb-3 text-sm text-[var(--ink-soft)]">
          The guide's <code>setDashboardFilter</code> sandbox function is
          registered at the application root. Generated code runs in a sandboxed
          iframe with no same-origin access and can call only the host functions
          listed in <code>sandboxFunctions</code>.
        </p>
        <ui-source path="src/app/app.config.ts" />
      </ui-panel>

      <ui-panel heading="registerFrontendTool — the tool runs in the browser">
        <p class="mb-3 text-sm text-[var(--ink-soft)]">
          <code>change_background</code> has a handler and no component, so it
          renders nothing in the chat — its result is the page itself changing.
          The registration is removed when the owning injector is destroyed.
        </p>
        <ui-source
          path="src/app/features/tools/tool-feature-model.ts"
          note="createBackgroundTool is the guide's; the rest is ours"
        />

        <p class="mt-4 mb-3 text-sm text-[var(--ink-soft)]">
          The guide quotes <code>createBackgroundTool</code> from the live
          Showcase without its <code>BackgroundToolArgs</code> type, its
          <code>resolveGradient</code> helper, or its imports, so the snippet
          cannot compile as published. Those three are defined here to make it
          runnable — <code>createBackgroundTool</code> itself is unchanged.
          <code>resolveGradient</code> accepts a preset name, a bare CSS color,
          or a full gradient, so the agent can ask for a look without having to
          write valid CSS.
        </p>
      </ui-panel>

      <ui-panel heading="All three registrations, one chat">
        <ui-source path="src/app/features/tools/tools-chat.component.ts" />
      </ui-panel>
    </div>
  `,
})
export default class FrontendToolsPage {
  protected readonly frontendToolSample = `registerFrontendTool({
  name: "getWeather",
  description: "Get the current weather for a city",
  parameters: z.object({ city: z.string() }),
  component: WeatherCardComponent,
  handler: async ({ city }, { signal }) => {
    const response = await fetch(\`/api/weather?city=\${encodeURIComponent(city)}\`, {
      signal,
    });
    return response.text();
  },
});`;

}
