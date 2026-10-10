# Speech Figure → MindCloud interaction and integration plan

Status: research-registered / not yet runtime-integrated
Source: https://github.com/snagiba-commits/speech-figure
Reviewed: 2026-10-10

## Decision

Treat Speech Figure as a candidate reference implementation for a speech-visualization capability. Do not import its code into MindCloud or distribute a derivative until the noncommercial license has been reviewed and any required commercial permission has been obtained. The repository declares PolyForm Noncommercial 1.0.0 and Node.js >=18; its README describes Chrome/WebGPU/WebCodecs and local Whisper inference. Repository documentation has been inspected, but the application has not yet been executed or end-to-end tested in the MindCloud environment.

## Architecture boundary

Microphone / optional camera
→ Speech recognition provider
→ MindCloud Speech Visualization Adapter
→ typed, normalized transcript events
→ optional UI renderer and/or explicitly authorized MindCore task input

The adapter is a capability boundary, not a new MindCore dependency. MindCore remains authoritative for routing, policy, audit, evidence, approvals, and consequential decisions. The renderer must work independently of agent execution.

## Proposed capability contract

- capability_id: speech-visualization
- layer: VoiceAndVisualization
- execution_mode: local-browser; no server-side audio processing by default
- operations: inspect, start_session, stop_session, get_transcript, export_transcript, render_preview
- initial status: research-registered (no executable adapter claimed)
- permissions: microphone required; camera optional; explicit user start; visible active-state indicator; explicit stop
- input schema: locale (optional BCP-47 string), model_profile (allowlisted enum), camera_enabled (boolean), session_id (opaque ID where applicable)
- event schema: session_id, sequence, event_type (partial_transcript | final_transcript | status | error), text (transcript events only), locale (when known), start_ms/end_ms (when available), provider, timestamp
- provenance: provider/revision, model profile, local-vs-remote engine, session timestamp, export format, user consent state
- safety: do not treat partial transcripts as final evidence; do not send transcripts to MindCore or external services without explicit configured routing; redact secrets only as a separate downstream policy, never silently rewrite source transcript
- failure states: permission_denied, model_unavailable, unsupported_browser, provider_error, export_error, stopped
- rollback: disable capability registration; no MindCore core changes required

## Interaction flow

1. User opens the voice-visualization panel.
2. UI explains microphone/camera use and whether processing is local or remote.
3. User explicitly starts a session and grants permissions.
4. UI shows listening, partial transcript, final transcript, and model status distinctly.
5. If enabled, the renderer uses final and partial words for the visual figure; visual output remains a separate presentation layer.
6. Transcript forwarding to MindCore is off by default and requires a separate user action or a pre-approved task policy.
7. User stops the session; media tracks and audio contexts are released.
8. Export is explicit, with format and destination shown; evidence metadata records provider and processing mode.

## Verification gates

### Gate A — source and license
- Confirm license terms for intended use; request written permission before any commercial use or derivative integration if required.
- Inventory direct/transitive dependencies and their licenses.
- Review microphone/camera lifecycle, outbound network calls, export endpoint, and model downloads.

### Gate B — isolated prototype
- Run in an isolated development environment, not production.
- Verify install/start steps and browser support.
- Test microphone denial, camera denial, stopping, worker failure, model-load failure, and export.
- Capture network traffic to confirm local inference behavior for the selected engine.
- Measure transcription latency, CPU/GPU and memory usage.

### Gate C — adapter contract
- Implement strict input validation and allowlisted operations.
- Add unit tests for valid/invalid payloads, event normalization, permission-denied handling, stop cleanup, and no-forwarding-by-default.
- Use synthetic fixtures for tests; never store raw audio in test logs.
- Route resulting transcript/evidence through existing MindCloud audit and Evidence Passport mechanisms only when explicitly requested.

### Gate D — language and runtime
- Test Swedish, English, and Bulgarian separately; the current source README explicitly describes automatic per-phrase handling for Russian/English and manual selection for Portuguese/Ukrainian, so Swedish/Bulgarian support must not be assumed.
- Verify target browser/device performance.
- Keep unsupported language/runtime combinations visibly marked.

### Gate E — promotion
- Metanoia revalidation reviews evidence, license clearance, tests, privacy, and rollback.
- Register as adapter-ready only after required checks pass and a human-approved promotion.
- No automatic production deployment or registry promotion from this plan.

## Acceptance criteria

- Start/stop and permission states behave correctly.
- No unexpected audio/video egress under local-engine mode.
- Partial/final transcript events are typed and ordered.
- UI remains responsive and resource cleanup is verified.
- Language limitations are explicit.
- License is cleared for the intended use.
- Adapter tests pass and evidence/provenance is available.
- Capability remains independently disableable without affecting MindCore.

## Immediate next action

Complete source/dependency and license review, then run an isolated prototype in a controlled development environment. Until the runtime is actually executed and tested, report status as source-reviewed—not runtime-verified.
