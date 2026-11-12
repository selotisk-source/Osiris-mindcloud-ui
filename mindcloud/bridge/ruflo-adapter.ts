import type { ExecutionResult, MindCloudTask } from "./task-contract";

export interface RufloExecutionRequest {
  task: MindCloudTask;
  topology?: "mesh" | "hierarchical" | "hierarchical-mesh" | "adaptive";
  maxAgents?: number;
  strategy?: "specialized" | "balanced" | "parallel";
}

export interface RufloTransport {
  execute(request: RufloExecutionRequest): Promise<ExecutionResult>;
}

/**
 * Transport boundary between MindCloud and RuFlo.
 *
 * MindCore/Dirigentverket own policy, contracts and promotion gates.
 * RuFlo owns agent execution and swarm coordination behind this interface.
 */
export class RufloAdapter {
  constructor(private readonly transport: RufloTransport) {}

  execute(task: MindCloudTask): Promise<ExecutionResult> {
    return this.transport.execute({
      task,
      topology: "hierarchical-mesh",
      maxAgents: 8,
      strategy: "specialized",
    });
  }
}
