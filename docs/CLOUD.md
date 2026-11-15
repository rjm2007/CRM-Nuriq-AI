# Cloud & infra practices

Verify every item against Plane's self-hosting docs and official AWS docs before applying. The cloud-reviewer agent checks changes against this file.

## 1. Local (MVP)
- Run with Plane's `docker-compose-local.yml` + `pnpm dev` (see AGENTS.md).
- `.env` files never committed; `.env.example` kept up to date with every new variable.
- Same images locally and in cloud — only env vars change.

## 2. Principles (12-factor)
- Config in env vars. Secrets in a secret manager in cloud (AWS Secrets Manager), never in images or git.
- Stateless containers: files go to S3-compatible storage (MinIO local → S3 cloud), sessions/cache in Redis.
- Logs to stdout as structured JSON; no tokens or personal data in logs.
- Pin versions: base images, uv.lock, pnpm-lock.
- Backward-compatible DB migrations (expand → migrate → contract) for zero-downtime deploys.
- Health checks on every service; graceful shutdown for workers.

## 3. AWS target (when we move)
| Plane service | AWS |
|---|---|
| web, space, admin, live, api | ECS Fargate services behind an Application Load Balancer (HTTPS via ACM) |
| worker, beat-worker | ECS Fargate services (beat: exactly 1 task) |
| migrator | One-off ECS task run by CI before deploy |
| plane-db (Postgres) | RDS PostgreSQL, Multi-AZ, automated backups + PITR, encrypted |
| plane-redis | ElastiCache Redis |
| plane-mq (RabbitMQ) | Amazon MQ for RabbitMQ |
| plane-minio | S3 (private bucket, encryption on, versioning on, lifecycle rules) |
| proxy | ALB + CloudFront (static assets) |
Alternative: Plane ships Kubernetes configs in `deployments/kubernetes` → EKS. Decide later; Fargate is simpler for <10 users.

## 4. Network & security
- VPC with public subnets (ALB only) and private subnets (apps, RDS, Redis, MQ). No public DB/Redis/MQ.
- Security groups allow only the traffic each service needs.
- IAM: one role per service, least privilege. GitHub Actions deploys via OIDC (no long-lived AWS keys).
- WAF on the ALB; rate limiting on public share-link routes.
- AI provider keys encrypted at rest; never sent to the browser.

## 5. Infrastructure as code & CI/CD
- Terraform for all AWS resources (state in S3 with locking). No click-ops.
- Environments: local → staging → production, same Terraform with different variables.
- GitHub Actions: lint + type-check + tests → build images → push to ECR → run migrator → deploy → smoke test.
- Image scanning in ECR; dependency scanning in CI.

## 6. Operations
- CloudWatch logs + alarms (5xx rate, latency, queue depth, DB CPU/storage).
- Daily RDS snapshots + S3 versioning; test restores monthly.
- Budget alarms in AWS Billing.
