/**
 * "Angular frontend tool", verbatim, plus the one import for the harness-only
 * `searchOrders` the guide leaves undefined. `webmcp` mirrors the tool onto
 * `document.modelContext`; CopilotKit does nothing when that is unavailable.
 * https://docs.copilotkit.ai/angular/deepagents/webmcp
 */
import { Component } from "@angular/core";
import { registerFrontendTool } from "@copilotkit/angular";
import { z } from "zod";

import { searchOrders } from "./orders";

@Component({
  selector: "app-order-search",
  standalone: true,
  template: "",
})
export class OrderSearchComponent {
  constructor() {
    registerFrontendTool({
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
    });
  }
}
