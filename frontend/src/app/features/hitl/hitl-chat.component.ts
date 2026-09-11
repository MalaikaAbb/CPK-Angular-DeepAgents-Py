/**
 * Both halves of the guide's human-in-the-loop page, on one surface.
 * https://docs.copilotkit.ai/angular/deepagents/guides/human-in-the-loop
 *
 * The decision tool: `ApprovalToolsService` registers `requestApproval`, and
 * the card renders inside the chat's tool-call flow. Injecting the service is
 * what constructs it, and construction is what performs the registration.
 *
 * The interrupt: `app-store-interrupt-panel` sits above the chat, reading
 * `store().interruptController`. Only the store controller is mounted. The
 * guide documents a typed `injectInterrupt` controller too, but warns against
 * rendering both for the same decision -- each observes the agent
 * independently, so one interrupt would surface twice and two clicks could
 * resume the same run. The typed controller is therefore shown as source on
 * the route rather than mounted beside this one.
 */
import { Component, inject } from '@angular/core';
import { CopilotChat } from '@copilotkit/angular';

import { ApprovalToolsService } from './approval-tools.service';
import { StoreInterruptPanelComponent } from './store-interrupt-panel.component';

@Component({
  selector: 'app-hitl-chat',
  imports: [CopilotChat, StoreInterruptPanelComponent],
  providers: [ApprovalToolsService],
  template: `
    <div style="display: flex; flex-direction: column; height: 100%">
      <app-store-interrupt-panel />

      <!--
        Without this the panel above is indistinguishable from a broken one:
        it is headless, so an agent that never interrupts renders exactly what
        a crashed controller renders.
      -->
      <p data-testid="interrupt-idle" style="padding: 0 0.5rem; font-size: 0.8rem">
        No pending interrupt. This backend raises none, so the panel above stays
        blank by design — it is mounted and listening.
      </p>

      <div style="flex: 1; min-height: 0">
        <copilot-chat />
      </div>
    </div>
  `,
})
export class HitlChatComponent {
  private readonly approvalTools = inject(ApprovalToolsService);
}
