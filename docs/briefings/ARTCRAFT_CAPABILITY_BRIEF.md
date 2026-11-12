# ArtCraft — MindCloud Capability Brief

**Decision:** Add ArtCraft as a research-stage creative capability candidate.  
**Repository:** https://github.com/storytold/artcraft  
**Upstream description:** “The IDE for artists.” Interactive AI image/video creation with 2D composition and 3D scene tools.  
**Assessment status:** Source README reviewed; no installation, source build, API integration, or runtime test performed.

## Intended role

Use ArtCraft to produce visual assets for MindCloud briefs and project communication: concept images, scene compositions, explanatory visuals, and—where useful—video or 3D outputs. ArtCraft should support the briefing workflow, not become a dependency of MindCore's orchestration or verification kernel.

## Candidate capabilities

- Text-to-image and prompted image editing.
- Canvas editing, masking/inpainting, and background removal.
- 2D compositing and 3D image compositing.
- Image-to-3D mesh and scene blocking with 3D assets.
- Character posing and consistent scene/location composition.
- Image-to-video generation; model catalog also lists audio/music and 3D/world generation.

Capabilities and model availability may vary by provider, account, release, or desktop build; verify each before depending on it.

## Proposed MindCloud boundary

- **Capability ID:** `creative.artcraft`
- **Layer:** supervised external creative-tool adapter.
- **Input contract:** task intent, prompt, asset references, desired output type, dimensions/format where supported, and explicit usage/licensing metadata.
- **Output contract:** artifact references, provider/model identifiers when available, generation settings, timestamps, and provenance.
- **MindCore responsibilities:** route the task, validate the request, record provenance, manage approvals, and verify that the returned artifact exists and is usable.
- **ArtCraft responsibilities:** creative editing/generation inside its supported application and provider workflows.

Do not assume a stable public API or headless automation interface without confirming it from source and documentation. Begin with a human-operated workflow or a narrow adapter only after an executable integration surface is established.

## Suggested briefing workflow

1. MindCore prepares a short, evidence-grounded brief and a visual task specification.
2. ArtCraft is used to create supporting images, scene mockups, or video.
3. The operator selects the intended output and records source/model/settings where available.
4. MindCloud attaches the artifact and provenance to the brief.
5. A reviewer checks factual accuracy, visual clarity, rights, and consistency with the underlying evidence before publication.

Generated visuals must be labelled as illustrative when they are not documentary evidence. Never present AI-generated imagery as an authentic photograph, observed camera frame, archaeological record, or verified operational state.

## Licensing and risk checks

The upstream README states that ArtCraft is dual-licensed under MIT or Apache-2.0, with separate third-party notices. Review the actual license files, NOTICE, bundled dependencies, model-provider terms, and output-use terms before redistribution or commercial use. Do not send confidential, personal, or security-sensitive material to external providers unless the data flow and authorization have been reviewed.

## Verification gates

- [ ] Inspect current source structure and developer setup.
- [ ] Confirm supported OS/runtime, dependencies, build steps, and model/provider requirements.
- [ ] Identify whether a documented API, CLI, MCP, or automation surface exists; do not infer one.
- [ ] Build or launch in an isolated test environment.
- [ ] Run one low-risk image-generation/editing task and capture actual outputs.
- [ ] Verify artifact persistence, provenance capture, error handling, and licensing notices.
- [ ] Only then propose an adapter implementation and add automated tests.

## Current evidence

- Upstream README: https://github.com/storytold/artcraft/blob/main/README.md
- Development setup: https://github.com/storytold/artcraft/blob/main/_docs/dev_setup.md
- Releases: https://github.com/storytold/artcraft/releases

**Current disposition:** suitable for a controlled creative-briefing trial; not yet approved as a production integration.
