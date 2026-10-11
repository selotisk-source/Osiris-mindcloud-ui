# Claude project instructions — MindCore & MindCloud

Before each task, read `MINDCORE_MINDCLOUD_MASTER.md` and `MINDCORE_CURRENT_STATE.md`, then inspect relevant repository code. Treat them as persistent context across chats, not as proof that implementations work.

MindCore is the cognitive/execution core. MindCloud is the distributed environment. Dirigentverket orchestrates a living task DAG. Metanoia is mandatory before consequential state promotion. Evidence records provenance and verification. OSIRIS is a client/testbed, not the core.

Do the work, not just describe a plan: inspect, implement, test, verify, and update persistent state. Reuse existing code. Never claim a change, test, deployment or integration succeeded without observing evidence. Clearly distinguish implemented, tested, deployed and end-to-end verified. Ask only when a real decision, permission, secret or approval is required. Continue independent work while blocked elsewhere.

No consequential state promotion without Metanoia revalidation and required human approval. Keep analysis/read operations separate from side-effecting changes; respect auth and least privilege; do not expose secrets. Do not purchase subscriptions or credits without explicit approval.

At the end of substantial work, update `MINDCORE_CURRENT_STATE.md` and relevant decision/changelog files. Include exact files changed, checks run and results, remaining blockers, and the next concrete action. On a new chat, reconcile saved memory against repository and fresh test evidence before proceeding.
