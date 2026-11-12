# Phi-4 Heretic provider

MindCore exposes `phi4heretic` as an optional OpenAI-compatible model provider. It is intended for self-hosted vLLM (or another compatible inference server); the application does not download or run the 14B weights inside the web process.

## Runtime configuration

Set these server-side environment variables on the MindCore backend:

- `PHI4_HERETIC_BASE_URL`: base URL of the OpenAI-compatible API, including `/v1` (for example, `http://model-host:8000/v1`).
- `PHI4_HERETIC_MODEL`: optional model identifier; defaults to `p-e-w/phi-4-heretic`.
- `PHI4_HERETIC_API_KEY`: optional bearer token if the inference endpoint requires one.

The provider calls `POST {PHI4_HERETIC_BASE_URL}/chat/completions`, sends a bounded token request, uses the shared provider timeout, and never places credentials in the URL. The provider appears as configured only when the base URL exists.

## Deployment and safety

A configured endpoint is not proof that model weights are loaded or inference works. Run the provider-network test with a stub, then issue a live health/inference probe against the configured model endpoint before marking it available. Model outputs remain unverified evidence; they do not authorize tool execution or capability promotion. Use the model for a second opinion, critique, hypothesis generation and Red Team analysis under MindCore's existing approval and Metanoia gates.

## Model source

- Hugging Face: https://huggingface.co/p-e-w/phi-4-heretic
- License shown by the model repository: MIT.
- The model is a 14B-parameter Phi-4 derivative with a 16K context window. Check the upstream model card and deployment hardware requirements before provisioning inference.
