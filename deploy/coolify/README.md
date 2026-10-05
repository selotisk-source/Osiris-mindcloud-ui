# OSIRIS self-hosted deployment

This deployment target is designed for Coolify. Coolify can deploy a Dockerfile directly from this repository.

## Flow
GitHub -> Coolify -> OSIRIS Web -> future MindCore/API workers.

## Current scope
This is the first web control surface. It contains no credentials and no external execution authority.

## Production prerequisites
- Linux VPS with SSH access
- Coolify installed on the VPS
- A domain pointed at the VPS
- HTTPS configured by Coolify
- Future backend/API secrets stored as Coolify environment secrets, never committed to Git

## Deployment
Create an application in Coolify from this GitHub repository, select this branch, choose a Dockerfile build, set the build context to the repository root, and expose port 80. After validation, point the production deployment at `main`.

## Next backend step
Attach a Supabase-compatible/self-hosted PostgreSQL + Auth layer and expose MindCore through an authenticated API/worker service.