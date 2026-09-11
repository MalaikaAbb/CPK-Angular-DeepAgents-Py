/**
 * Mounts both halves of the guide's frontend-tools section against one chat.
 *
 * `registerRenderToolCall` — the tool runs on the server (the Agent Framework
 * agent's weather tool) and the browser only renders its call, through
 * WeatherCardComponent.
 *
 * `registerFrontendTool` — the tool runs in the browser. `change_background`
 * has a handler and no component, so it renders nothing in chat; its result is
 * the page itself changing. The registration is removed when this injector is
 * destroyed.
 *
 * `registerComponent` — the guide's new first section: a component the agent
 * displays, with no handler and nothing on the agent side. `show_incident` is
 * declared here by the frontend and forwarded to the deepagents graph over
 * AG-UI, so the Python process never learns about it. Needs
 * @copilotkit/angular 0.5.0 or newer; this repo runs 0.5.1.
 *
 * The guide's other `registerFrontendTool` sample is a second `getWeather`
 * that runs in the browser. It is not mounted: it would collide with the
 * server-side tool of the same name, and it calls an `/api/weather` endpoint
 * this repo does not serve.
 *
 * https://docs.copilotkit.ai/angular/deepagents/guides/frontend-tools-generative-ui
 */
import { Component, signal } from '@angular/core';
import {
  CopilotSidebar,
  registerComponent,
  registerFrontendTool,
  registerRenderToolCall,
} from '@copilotkit/angular';
import { z } from 'zod';

import {
  DEFAULT_BACKGROUND,
  createBackgroundTool,
} from './tool-feature-model';
import { IncidentCardComponent } from './incident-card.component';
import { WeatherCardComponent } from './weather-card.component';

@Component({
  selector: 'app-tools-chat',
  imports: [CopilotSidebar],
  template: `
    <div
      style="height: 100%; display: flex; flex-direction: column; gap: 0.75rem; padding: 0.75rem; transition: background 400ms ease"
      [style.background]="background()"
    >
        <copilot-sidebar />

    </div>
  `,
})
export class ToolsChatComponent {
  /** Written by the agent through the change_background handler. */
  protected readonly background = signal(DEFAULT_BACKGROUND);

  constructor() {
    registerRenderToolCall({
      name: 'getWeather',
      args: z.object({ city: z.string() }),
      component: WeatherCardComponent,
    });

    registerFrontendTool(createBackgroundTool(this.background));

    registerComponent({
      name: "show_incident",
      description: "Show one incident from the incident table.",
      parameters: z.object({
        id: z.string().describe("The incident id, such as INC-4711"),
        severity: z.string().describe("One of sev1, sev2, sev3"),
      }),
      component: IncidentCardComponent,
    });
  }
}
