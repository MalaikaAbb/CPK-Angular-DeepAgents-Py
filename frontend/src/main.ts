// Empty in normal builds; the doc-a2ui build configuration swaps in the A2UI
// guide's code verbatim. See src/doc-verbatim/a2ui.stub.ts.
import './doc-verbatim/a2ui.stub';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
