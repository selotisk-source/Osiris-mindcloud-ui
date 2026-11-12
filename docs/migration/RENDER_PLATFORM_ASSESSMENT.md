# Destination assessment: Render (2026-11-01)

## Decision status
Render is a viable candidate for a staged migration, but it is not yet selected as the final production destination. No Render workspace, service, disk, or domain has been provisioned.

## Platform capabilities confirmed from current Render documentation
- Blueprints (`render.yaml`) can define web services, private services (`pserv`), workers, Docker runtimes, environment references, and persistent disks.
- Services in the same Render region/workspace can communicate over Render's private network. Free web services can send private-network requests but cannot receive them.
- Persistent disks preserve only data written beneath their configured mount path. Disks are available on paid web/private/worker services; ephemeral filesystems lose changes on deploy/restart.
- Render Blueprint supports Dockerfile paths and Docker contexts for monorepos.

## Cost and sizing implications
- Render lists persistent disks at USD $0.25 per GB-month.
- Render's published compute table lists 1 CPU / 2 GB at USD $40 per month and 2 CPU / 4 GB at USD $75 per month.
- The existing Railway Cognee service has a 2 CPU / 1 GB override. A Render 2 CPU / 4 GB instance is a conservative starting candidate, not a direct price-equivalent sizing claim.
- Three Railway volumes are each 500 MB. Render disk sizing and mount paths must be mapped per service; actual data usage must be measured before choosing sizes.
- The media bucket `domedagsprofeten-media` needs a separate object-storage destination and a byte-count/export inventory. A Render service disk is not a substitute for an object-storage bucket.

## Architectural mapping candidate
| Existing component | Render candidate | Key condition |
|---|---|---|
| MindCore / OSIRIS API | Private Docker or Node web service | Bind to Render-provided `PORT`; health endpoint `/health`; persistent runtime data under explicit disk mount |
| Frontend | Public Node web service | Start `node frontend-server.js`; configure `MINDCLOUD_BACKEND_URL` to private backend URL; `/ready` must pass |
| Cognee Memory | Private Docker web service | Use `deploy/cognee/Dockerfile.platform`; confirm upstream Cognee port and readiness behavior; mount disk at `/data` |
| Browser Chromium | Private Docker web service | Confirm Browserless port, CDP endpoint, authentication, and memory requirements |
| Browser runner | Private Docker/web service or replace with a maintained Playwright worker | Existing Railway `function-bun` runtime is platform-specific; inspect source/command and CDP contract before choosing replacement |

## Blocking unknowns before a complete Blueprint is safe
1. Actual bytes used by each Railway volume and media bucket.
2. Full source/command/configuration of `browser-use-runner` and `browser-chromium`, including ports, CDP path, auth, and session lifecycle.
3. Cognee upstream container's actual listening port and health endpoint behavior.
4. Exact environment-variable mapping and secret names, without copying secret values into Git.
5. Whether all services can be co-located in one Render region and whether private networking is sufficient.
6. Actual runtime memory/CPU utilization, especially Cognee embeddings and Chromium.

## Current worktree branch changes
- `docs/migration/RAILWAY_EXIT_INVENTORY.md`: service/deployment/volume inventory and known failure evidence.
- `scripts/run-verify.js`: emits START/PASS/FAIL for each verification command to expose the exact pre-deploy failure.
- `deploy/cognee/platform-entrypoint.sh` and `deploy/cognee/Dockerfile.platform`: separate platform-neutral startup path; existing Railway Dockerfile and entrypoint remain unchanged.
- `.github/workflows/migration-checks.yml`: runs the verification suite and shell syntax checks on the migration branch / relevant pull requests.

## Current CI state
Draft PR #148 has been opened. At the time of this record, Migration branch checks run #3 (41319885094) is in progress; the existing Runtime Verification and RuFlo/Brave workflows were also triggered by the branch update. No test result is claimed until the jobs finish.

## Sources
- Render Blueprint specification: https://render.com/docs/blueprint-spec
- Render persistent disks: https://render.com/docs/disks
- Render private networking: https://render.com/docs/private-network
- Render pricing: https://render.com/pricing

## Safety
No Railway production configuration or traffic has been changed. No data has been exported, copied, or deleted. No Render resources have been provisioned. This assessment is not a cutover authorization.
