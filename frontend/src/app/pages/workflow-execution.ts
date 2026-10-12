import { Component } from '@angular/core';

import { RouteHeader } from '../components/route-header';
import { Callout, DocSample, Panel } from '../components/ui';

@Component({
  selector: 'app-workflow-execution-page',
  imports: [RouteHeader, Panel, Callout, DocSample],
  template: `
    <app-route-header path="/workflow-execution" />

    <div class="space-y-6">
      <ui-callout tone="warn" title="Why this route has no demo">
        The guide's pattern is LangGraph's input/output schema split, which
        needs a custom <code>StateGraph</code>. The guide itself notes that
        <code>createDeepAgent</code> uses a single state schema and does not
        expose separate input/output schemas, so this repo's DeepAgents backend
        cannot run it. The Python sample is also not self-contained: it has no
        imports for <code>List</code>, <code>RunnableConfig</code>,
        <code>ChatOpenAI</code>, <code>SystemMessage</code>,
        <code>StateGraph</code>, <code>START</code> or <code>END</code>, and
        leaves an "add the rest of the agent implementation" placeholder. The
        Angular sample targets an agent named <code>my_agent</code>, which this
        runtime does not register.
      </ui-callout>

      <ui-panel heading="Old state">
        <ui-doc-sample
          caption="Workflow Execution guide — agent.py"
          language="python"
          [code]="oldStateSample"
        />
      </ui-panel>

      <ui-panel heading="State divided into input, output, and internal">
        <p class="mb-3 text-sm text-slate-700">
          <code>question</code> is accepted from the frontend,
          <code>answer</code> is returned to it, and <code>resources</code>
          stays internal. With LangGraph 1.2.11 (installed here),
          <code>input=</code> and <code>output=</code> still work but log a
          deprecation warning in favor of <code>input_schema</code> and
          <code>output_schema</code>.
        </p>
        <ui-doc-sample
          caption="Workflow Execution guide — agent.py (not self-contained)"
          language="python"
          [code]="splitStateSample"
        />
      </ui-panel>

      <ui-panel heading="Reading the output from Angular">
        <p class="mb-3 text-sm text-slate-700">
          Expected behavior per the guide: the question is sent but not
          returned, so the UI is its source of truth; <code>answer</code>
          changes once the agent returns it; <code>resources</code> never
          reaches the UI.
        </p>
        <ui-doc-sample
          caption="Workflow Execution guide — src/app/agent-state.component.ts"
          [code]="agentStateSample"
        />
      </ui-panel>
    </div>
  `,
})
export default class WorkflowExecutionPage {
  protected readonly oldStateSample = `from copilotkit import CopilotKitState

class AgentState(CopilotKitState):
    question: str
    answer: str
    resources: list[str]`;

  protected readonly splitStateSample = `from copilotkit import CopilotKitState

# Divide the state to 3 parts

# Input schema for inputs you are willing to accept from the frontend
class InputState(CopilotKitState):
  question: str

# Output schema for output you are willing to pass to the frontend
class OutputState(CopilotKitState):
  answer: str

# The full schema, including the inputs, outputs and internal state ("resources" in our case)
class OverallState(InputState, OutputState):
  resources: List[str]

async def answer_node(state: OverallState, config: RunnableConfig):
  """
  Standard chat node, meant to answer general questions.
  """

  model = ChatOpenAI()

  # add the input question in the system prompt so it's passed to the LLM
  system_message = SystemMessage(
    content=f"You are a helpful assistant. Answer the question: {state.get('question')}"
  )

  response = await model.ainvoke([
    system_message,
    *state["messages"],
  ], config)

  # ...add the rest of the agent implementation

  # extract the answer, which will be assigned to the state soon
  answer = response.content

  return {
     "messages": response,
      # include the answer in the returned state
     "answer": answer
  }


# finally, before compiling the graph, we define the 3 state components
builder = StateGraph(OverallState, input=InputState, output=OutputState)

# add all the different nodes and edges and compile the graph
builder.add_node("answer_node", answer_node)
builder.add_edge(START, "answer_node")
builder.add_edge("answer_node", END)
graph = builder.compile()`;

  protected readonly agentStateSample = `import { Component, computed, inject, signal } from "@angular/core";
import { CopilotKit, injectAgentStore } from "@copilotkit/angular";

type AgentState = {
  question?: string;
  answer?: string;
};

@Component({
  selector: "app-agent-state",
  template: \`
    <button type="button" (click)="askQuestion(question())">
      Ask agent
    </button>
    <p>{{ answer() || "Waiting for an answer..." }}</p>
  \`,
})
export class AgentStateComponent {
  private readonly copilotKit = inject(CopilotKit);
  readonly store = injectAgentStore("my_agent");
  readonly question = signal("What's the capital of France?");
  readonly state = computed(
    () => (this.store().state() as AgentState | undefined) ?? {},
  );
  readonly answer = computed(() => this.state().answer);

  async askQuestion(question: string): Promise<void> {
    const agent = this.store().agent;
    agent.setState({ ...this.state(), question, answer: "" });
    agent.addMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    });
    await this.copilotKit.core.runAgent({ agent });
  }
}`;
}
