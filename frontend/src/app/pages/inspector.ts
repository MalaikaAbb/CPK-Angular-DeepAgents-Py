import { Component } from '@angular/core';

import { RouteHeader } from '../components/route-header';
import { Callout, Panel, SourceCode, TryIt } from '../components/ui';
import { InspectorProbeComponent } from '../features/inspector/inspector-probe.component';

@Component({
  selector: 'app-inspector-page',
  imports: [RouteHeader, Panel, Callout, TryIt, SourceCode, InspectorProbeComponent],
  template: `
    <app-route-header path="/inspector" />

    <div class="space-y-6">
      <ui-try-it>
        <p class="mt-1 text-slate-700">
          Read the mount check below, then open the demo and walk the
          quickstart's confirm-setup step: send a message, click the Inspector
          launcher in the corner, open <strong>Agents</strong> and pick
          <code>default</code> in the sidebar agent selector, then open
          <strong>AG-UI Events</strong>.
        </p>
        <p class="mt-2 text-slate-700">
          <strong>Pass:</strong> the check reports exactly one
          <code>cpk-web-inspector</code> element, appended to
          <code>document.body</code>, this app contains no code that put it
          there, the Agent panel shows <code>default</code> once selected, and
          AG-UI Events has the run's events in it. <strong>Fail:</strong> zero
          elements (the framework did not mount it), more than one (something is
          mounting it by hand), or a launcher that opens onto panels with
          nothing in them.
        </p>
        <p class="mt-2 text-slate-700">
          Note the extra step. The quickstart says
          <em>"Open Agents, then Agent. Your agent is listed"</em>, but the
          panel opens on <code>No agent selected</code> — the agent appears only
          after picking it from the sidebar selector, which the step does not
          mention. The recorder performs both halves and logs each state.
        </p>
      </ui-try-it>

      <ui-panel heading="The claim under test">
        <p class="text-sm text-slate-700">
          <code>&#64;copilotkit/angular</code> mounts the Inspector itself. It
          depends on <code>&#64;copilotkit/web-inspector</code> directly, so
          there is nothing to install and no version to pin — the
          <code>CopilotKit</code> service creates
          <code>cpk-web-inspector</code>, supplies the application's core, and
          appends it to <code>document.body</code> after the first browser
          render.
        </p>
        <p class="mt-3 text-sm text-slate-700">
          This is the one page in the harness whose subject is an
          <em>absence</em> of code. Every other route proves a feature by
          calling it; this one is only correct if
          <code>frontend/src/</code> never mentions the Inspector at all.
        </p>
      </ui-panel>

      <ui-panel heading="Live mount check">
        <app-inspector-probe />
        <div class="mt-4">
          <ui-source
            path="src/app/features/inspector/inspector-probe.component.ts"
          />
        </div>
      </ui-panel>

      <ui-panel heading="Controlling visibility">
        <p class="mb-3 text-sm text-slate-700">
          <code>enableInspector</code> on <code>provideCopilotKit</code> is the
          only switch. It is enabled by default in development browser builds,
          so this harness sets nothing and gets the Inspector — the state the
          guide describes for a reader who has just followed the quickstart.
          Passing <code>false</code> hides it during development.
        </p>
        <ui-source path="src/app/app.config.ts" />
      </ui-panel>

      <ui-callout title="Remove a hand-written mount before upgrading">
        <code>&#64;copilotkit/angular</code> did not mount the Inspector before
        <strong>0.4.0</strong>, and this doc page previously described a
        <code>WebInspector</code> component that created the element by hand.
        This harness never had one — it was on 0.3.1 with no Inspector code at
        all — so the upgrade needed no deletion here. An app that does have one
        must delete it, along with its <code>&lt;app-web-inspector /&gt;</code>
        usage and any direct <code>&#64;copilotkit/web-inspector</code>
        dependency. Leaving it is worse than redundant: the framework reuses an
        existing <code>cpk-web-inspector</code> rather than creating a second,
        but the hand-written component's <code>DestroyRef.onDestroy</code>
        removes that element unconditionally — so a route change that destroys
        the component tears out the Inspector the framework is now driving, and
        it does not come back without a full reload. The mount check above
        re-probes while this route is open, which is what would catch that.
      </ui-callout>

      <ui-callout title="Nothing to do for production or server rendering">
        The <code>&#64;copilotkit/web-inspector</code> import is dynamic and
        browser-only, so it neither ships in a production bundle nor runs during
        SSR. This app is server-rendered, and the probe above deliberately does
        nothing on the server rather than reporting a false negative.
      </ui-callout>
    </div>
  `,
})
export default class InspectorPage {}
