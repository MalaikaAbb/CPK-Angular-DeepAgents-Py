/**
 * The Inspector page makes one claim that can be checked from the page itself:
 * `@copilotkit/angular` mounts the Inspector for you, by having the CopilotKit
 * service create a `cpk-web-inspector` element and append it to
 * `document.body` after the first browser render.
 * https://docs.copilotkit.ai/angular/deepagents/inspector
 *
 * Nothing here mounts anything. That is the whole point: the guide is explicit
 * that a hand-written mount must be deleted, so this component only *observes*
 * whether the framework did the mounting, and reports what it found.
 *
 * Observed 30 Aug 2026 on @copilotkit/angular 0.4.0: the element appears only
 * once something *injects* the `CopilotKit` service. `provideCopilotKit` alone
 * does not produce it, because Angular constructs a root-provided service
 * lazily, on first injection — so a route that configures CopilotKit but
 * renders no CopilotKit consumer has no Inspector. Once any consumer has
 * mounted in that document the element stays, including across in-app
 * navigation to routes that have none. `absent` below is therefore a real
 * reading rather than an error state, and its wording says which case it is.
 *
 * The probe runs after a paint rather than in the constructor. The element is
 * appended after the first browser render, so reading for it any earlier
 * reports a false negative — and on the server there is no document at all.
 */
import {
  Component,
  DestroyRef,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** What the probe found, once it has actually looked. */
type ProbeResult = {
  /** How many `cpk-web-inspector` elements are in the document. */
  count: number;
  /** Whether that element is a child of `document.body`, as documented. */
  onBody: boolean;
};

@Component({
  selector: 'app-inspector-probe',
  template: `
    <section aria-labelledby="inspector-probe-title" data-testid="probe">
      <h2 id="inspector-probe-title" class="text-sm font-semibold">
        Inspector mount check
      </h2>

      @if (result(); as found) {
        <p data-testid="probe-verdict" [attr.data-state]="state()">
          {{ verdict() }}
        </p>
        <dl class="mt-2 text-sm">
          <dt>&lt;cpk-web-inspector&gt; elements in the document</dt>
          <dd data-testid="probe-count">{{ found.count }}</dd>
          <dt>Appended to document.body</dt>
          <dd data-testid="probe-on-body">{{ found.onBody ? "yes" : "no" }}</dd>
        </dl>
      } @else {
        <p data-testid="probe-verdict" data-state="pending">
          Waiting for the first browser render…
        </p>
      }
    </section>
  `,
})
export class InspectorProbeComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly result = signal<ProbeResult | null>(null);

  /**
   * `mounted` is the documented outcome. `duplicate` is the failure the guide
   * spends most of its space on: a leftover hand-written mount alongside the
   * framework's own. `absent` is the gap between the two: configured, but with
   * nothing on the route that injects the service, so no element exists yet.
   */
  protected readonly state = computed<'mounted' | 'absent' | 'duplicate' | 'pending'>(
    () => {
      const found = this.result();
      if (!found) return 'pending';
      if (found.count === 0) return 'absent';
      if (found.count > 1) return 'duplicate';
      return 'mounted';
    },
  );

  protected readonly verdict = computed(() => {
    switch (this.state()) {
      case 'mounted':
        return 'Pass — the framework mounted the Inspector. Nothing in this app creates the element.';
      case 'absent':
        return 'Absent — no cpk-web-inspector element is in the document. The guide says the framework appends one after the first browser render, but on 0.4.0 that happens only once something injects the CopilotKit service. Nothing on this route has.';
      case 'duplicate':
        return 'Fail — more than one cpk-web-inspector element is present, which is the state a leftover hand-written mount produces.';
      default:
        return 'Waiting for the first browser render…';
    }
  });

  constructor() {
    if (!this.isBrowser) return;

    afterNextRender(() => this.probe());

    // Re-probed rather than read once, for two reasons: the element appears
    // the moment a CopilotKit consumer is first mounted, which can be long
    // after this component rendered; and a route change that destroyed a
    // hand-written mount is exactly the scenario the guide warns takes the
    // Inspector away without a reload.
    const timer = setInterval(() => this.probe(), 1_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  private probe(): void {
    const elements = document.querySelectorAll('cpk-web-inspector');
    this.result.set({
      count: elements.length,
      onBody: Array.from(elements).some((el) => el.parentElement === document.body),
    });
  }
}
