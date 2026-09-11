/**
 * "Handle an interrupt from the store", verbatim. Added by @copilotkit/angular
 * 0.4.0: the agent store already carries this conversation's messages and
 * state, so it carries its pending interrupt too, and a component that holds a
 * store needs nothing else to read one.
 * https://docs.copilotkit.ai/angular/deepagents/guides/human-in-the-loop
 *
 * The guide warns against rendering this and an `injectInterrupt` controller
 * for the same decision, because both observe the agent independently and two
 * UI actions could try to resume the same run. The demo therefore mounts this
 * panel or `app-interrupt-panel`, never both at once — see hitl-chat.
 *
 * ── The one deviation from the published snippet ───────────────────────────
 * The guide writes `injectAgentStore("ticketing")`. There is no `ticketing`
 * agent: the guide never defines one, never says the string is a placeholder,
 * and never states what happens when the id does not resolve. This harness
 * runs a single agent registered as `default`, so `default` is what is passed
 * here.
 *
 * That substitution is itself the finding, and it is on the QA report rather
 * than silently smoothed over — under the project rule that an unstated
 * prerequisite is a defect even when inference makes the page work. Everything
 * else below, including the missing null-guard on `interrupt()?.message` and
 * the un-awaited `resolve`/`cancel` promises in the template, is exactly as
 * published.
 */
import { Component } from '@angular/core';
import { injectAgentStore } from '@copilotkit/angular';

@Component({
  selector: 'app-store-interrupt-panel',
  template: `
    @let interrupts = store().interruptController;

    @if (interrupts.hasInterrupt()) {
      <section>
        <p>{{ interrupts.interrupt()?.message }}</p>
        <button type="button" (click)="interrupts.resolve({ approved: true })">
          Approve
        </button>
        <button type="button" (click)="interrupts.cancel()">Reject</button>
      </section>
    }
  `,
})
export class StoreInterruptPanelComponent {
  protected readonly store = injectAgentStore('default');
}
