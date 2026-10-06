# MindCloud ↔ RuFlo Bridge

RuFlo is the execution layer behind MindCloud contracts. MindCore owns typed state, task graphs, policy and verification; Dirigentverket owns orchestration policy and gates; RuFlo owns agent execution; Evidence remains first-class; Metanoia evaluates contradictions before promotion.

Flow: Task → Dirigentverket → Bridge → RuFlo → Agents/Tools → Evidence → Metanoia → Gate → MindCore.

The first validation task is a read-only OSIRIS endpoint verification flow. Production mutation requires an explicit human gate.
