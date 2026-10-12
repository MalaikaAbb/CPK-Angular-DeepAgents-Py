/**
 * Mounts the guide's WebMCP-enabled frontend tool beside a chat, so the one
 * `searchOrders` handler can be reached two ways: by the CopilotKit agent
 * through the chat, and by a WebMCP browser agent through
 * `document.modelContext`. The availability line is the guide's test step 3.
 * https://docs.copilotkit.ai/angular/deepagents/webmcp
 */
import { Component } from '@angular/core';
import { CopilotChat } from '@copilotkit/angular';

import { OrderSearchComponent } from './order-search.component';

@Component({
  selector: 'app-webmcp-chat',
  imports: [CopilotChat, OrderSearchComponent],
  template: `
    <app-order-search />
    <div style="display: flex; flex-direction: column; height: 100%">
      <p style="padding: 0.5rem 1rem; font-size: 0.875rem">
        document.modelContext:
        <strong>{{ hasModelContext ? 'available' : 'unavailable' }}</strong>
      </p>
      <div style="flex: 1; min-height: 0">
        <copilot-chat />
      </div>
    </div>
  `,
})
export class WebmcpChatComponent {
  protected readonly hasModelContext =
    typeof document !== 'undefined' && 'modelContext' in document;
}
