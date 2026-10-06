import type {AgentCapability, RunEvent, TaskContext} from "./contracts";
import {CapabilityRegistry} from "./capability-registry";
import {MindOrchestrator} from "./orchestrator";
import {EvidenceGraph} from "./evidence-graph";
import {requireApproval} from "./approval-gate";

export interface KernelPolicy {
  timeoutMs: number;
  allowPlannedAdapters: boolean;
}

export interface KernelRunResult {
  taskId: string;
  capabilityId: string;
  result: unknown;
  events: RunEvent[];
}

const DEFAULT_POLICY: KernelPolicy = { timeoutMs: 120000, allowPlannedAdapters: false };

export class MindCoreKernel {
  readonly evidence = new EvidenceGraph();
  private readonly events: RunEvent[] = [];
  private readonly orchestrator: MindOrchestrator;
  private readonly policy: KernelPolicy;

  constructor(private readonly registry: CapabilityRegistry, policy?: Partial<KernelPolicy>) {
    this.policy = {...DEFAULT_POLICY, ...policy};
    this.orchestrator = new MindOrchestrator(registry, (event) => {
      this.events.push(event);
      this.evidence.record(event);
    });
  }

  listCapabilities() { return this.registry.list(); }
  eventsFor(taskId: string) { return this.events.filter((event) => event.taskId === taskId); }

  async run(capabilityId: string, input: unknown, context: TaskContext): Promise<KernelRunResult> {
    if (!context.taskId || !context.actor) throw new Error("Invalid task context");
    const capability: AgentCapability = this.registry.get(capabilityId);

    if (capability.status === "disabled") throw new Error("Capability disabled: " + capabilityId);
    if (capability.status === "planned-adapter" && !this.policy.allowPlannedAdapters) {
      throw new Error("Capability is not connected: " + capabilityId);
    }
    requireApproval(context, capability.approval);

    const execution = this.orchestrator.run(capabilityId, input, context);
    const result = await Promise.race([
      execution,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Kernel timeout: " + this.policy.timeoutMs + "ms")), this.policy.timeoutMs)
      )
    ]);

    return {taskId: context.taskId, capabilityId, result, events: this.eventsFor(context.taskId)};
  }
}
