# Deployment

Vitae deploys to a single VPS behind Pangolin/Traefik. Every push to `main` triggers a GitHub Actions workflow that builds two images, pushes them to GHCR, and SSHes into the VPS to restart the stack. This document covers the **one-time bootstrap** (manual) and the **steady-state operations** (everyday tasks once bootstrap is done).

## Architecture (one-page summary)

- **Containers** live under `/opt/vitae/` on the VPS.
- **Network:** all routable services attach to the existing `pangolin` Docker network. Pangolin's admin UI handles hostname → container routing. No host ports exposed.
- **Hostnames:**
  - `app.vitae.2524.cloud` — admin UI (`/`) + API (`/api/*`), both via `vitae-ui` and `vitae-api`
  - `vitae.2524.cloud` — public portfolio + targeted sites, served by `vitae-public-sites`
- **Images:** `ghcr.io/joemc3/vitae-api:latest` (used by both `vitae-api` and `vitae-worker`) and `ghcr.io/joemc3/vitae-ui:latest`. Public sites is stock `nginx:alpine`.
- **Secrets:** `/opt/vitae/.env` on the VPS, never in git.
- **Deploy trigger:** push to `main` → `.github/workflows/deploy.yml`.

See `docs/superpowers/specs/2026-05-12-phase3e-b-deployment-design.md` for the full design.

## One-time bootstrap

Run these steps once, when you're ready for the first real deploy.

### 1. DNS

Point the two hostnames at the VPS / Pangolin edge:

- `vitae.2524.cloud` → VPS IP
- `app.vitae.2524.cloud` → VPS IP

Use whichever DNS provider hosts `2524.cloud`.

### 2. Create a `deploy` user on the VPS

SSH in as your normal user, then:

```bash
sudo useradd -m -s /bin/bash deploy
sudo mkdir -p /home/deploy/.ssh
sudo chown -R deploy:deploy /home/deploy
sudo usermod -aG docker deploy
```

Add a sudoers entry restricting `deploy` to exactly the operations the GHA workflow needs. As root:

```bash
sudo visudo -f /etc/sudoers.d/vitae-deploy
```

Contents:

```
deploy ALL=(root) NOPASSWD: /usr/bin/docker compose -f /opt/vitae/docker-compose.prod.yml *, /usr/bin/docker image prune -f
```

### 3. Generate and install an SSH key for GitHub Actions

On your local machine:

```bash
ssh-keygen -t ed25519 -C "vitae-gha-deploy" -f ~/.ssh/vitae-deploy -N ""
```

Append the **public** key to the VPS:

```bash
ssh-copy-id -i ~/.ssh/vitae-deploy.pub deploy@2524.cloud
```

You'll add the **private** key (`~/.ssh/vitae-deploy`) to GitHub Actions secrets in step 8.

### 4. Create `/opt/vitae/`

On the VPS:

```bash
sudo mkdir -p /opt/vitae
sudo chown deploy:deploy /opt/vitae
```

Then, from your local machine, scp the initial files (the deploy workflow will keep them in sync from here on):

```bash
scp docker-compose.prod.yml deploy@2524.cloud:/opt/vitae/docker-compose.prod.yml
scp nginx/sites.conf deploy@2524.cloud:/opt/vitae/public-sites.conf
```

### 5. Generate `/opt/vitae/.env`

On the VPS, as the `deploy` user:

```bash
cd /opt/vitae
umask 077
cat > .env <<EOF
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
JWT_SECRET=$(openssl rand -base64 32)
SECRET_KEY=$(openssl rand -base64 32)
SITE_URL=https://vitae.2524.cloud
ADMIN_URL=https://app.vitae.2524.cloud
EOF
chmod 600 .env
```

**Keep a copy of `.env` somewhere safe** (password manager). If you ever lose it, the encrypted API keys in the database become unrecoverable (they're encrypted with `SECRET_KEY`).

### 6. Authenticate the VPS with GHCR

So the `deploy` user can `docker compose pull` the private images:

1. On GitHub, go to your account settings → Developer settings → Personal access tokens → Tokens (classic). Create a token with **`read:packages`** scope only. Copy it.
2. On the VPS, as `deploy`:

```bash
echo "<your-PAT>" | docker login ghcr.io -u joemc3 --password-stdin
```

This writes credentials to `~deploy/.docker/config.json`.

### 7. First boot

You need the images in GHCR before this works. Push a commit to `main` (any commit — even a no-op) and let the `build-and-push` job complete. The `deploy` job will fail (no secrets yet, expected). Then on the VPS:

```bash
cd /opt/vitae
sudo docker compose -f docker-compose.prod.yml pull
sudo docker compose -f docker-compose.prod.yml up -d
sudo docker compose -f docker-compose.prod.yml logs -f vitae-api vitae-worker
```

Alembic runs migrations during API startup. Wait for `Application startup complete.` in the api logs. Ctrl-C to detach.

### 8. Register Pangolin resources

In Pangolin's admin UI, create three resources:

| Resource name        | Hostname                       | Path        | Target container     | Port |
|----------------------|--------------------------------|-------------|----------------------|------|
| `vitae-admin`        | `app.vitae.2524.cloud`         | `/`         | `vitae-ui`           | 80   |
| `vitae-api`          | `app.vitae.2524.cloud`         | `/api/*`    | `vitae-api`          | 8000 |
| `vitae-public-sites` | `vitae.2524.cloud`             | `/`         | `vitae-public-sites` | 80   |

Pangolin handles TLS via your existing cert setup. (If your Pangolin version doesn't support multi-target routes on a single resource, create the api route as a sibling resource on the same hostname with a higher priority.)

### 9. Smoke checks

```bash
curl -fsS https://app.vitae.2524.cloud/api/health
# {"status":"healthy",...}
```

Open `https://app.vitae.2524.cloud` in a browser — the admin UI loads.

`https://vitae.2524.cloud` may return 404 until the first portfolio site is generated — that's expected.

### 10. Create your account

On the VPS, as `deploy` (or any user with docker access):

```bash
cd /opt/vitae
make create-user EMAIL=joemc3@gmail.com
# When prompted, type and confirm your password.
```

Log in via the admin UI.

### 11. Add GitHub Actions secrets

In the GitHub repo → Settings → Secrets and variables → Actions, add:

| Name           | Value                                                                |
|----------------|----------------------------------------------------------------------|
| `VPS_HOST`     | `2524.cloud` (or the SSH endpoint of the VPS)                        |
| `VPS_USER`     | `deploy`                                                             |
| `VPS_SSH_KEY`  | contents of `~/.ssh/vitae-deploy` (the private key, full file)       |

Push any commit to `main` — the deploy job should succeed end-to-end. From here on, push-to-main is the deploy mechanism.

## Steady-state operations

All commands run on the VPS unless noted.

### Read logs

```bash
make logs                   # tail all services
sudo docker compose -f /opt/vitae/docker-compose.prod.yml logs -f vitae-api
```

### Shell into a container

```bash
make shell                  # shells into vitae-api
sudo docker compose -f /opt/vitae/docker-compose.prod.yml exec vitae-worker /bin/bash
```

### Manually run migrations

Migrations run on API startup, but you can re-run idempotently:

```bash
make migrate
```

### Create a new user

```bash
make create-user EMAIL=newperson@example.com
```

### Manual backup

```bash
make backup
# Writes ./backups/vitae-<timestamp>.sql.gz and ./backups/vitae-<timestamp>.uploads.tar.gz
```

Copy the resulting files off the VPS to wherever you keep backups. Automated remote backups are tracked in `docs/future-work.md`.

### Restart the stack

```bash
sudo docker compose -f /opt/vitae/docker-compose.prod.yml restart
# or specific service:
sudo docker compose -f /opt/vitae/docker-compose.prod.yml restart vitae-api
```

### Rolling back

Each push tags two images: `:latest` (moving) and `:sha-<short>` (immutable). To roll back to a previous commit's images:

1. Find the SHA of the working commit (look at `git log` or the GHA run page).
2. On the VPS:

```bash
SHA=abc1234   # short SHA of the target commit
for img in vitae-api vitae-ui; do
    sudo docker pull ghcr.io/joemc3/$img:sha-$SHA
    sudo docker tag ghcr.io/joemc3/$img:sha-$SHA ghcr.io/joemc3/$img:latest
done
sudo docker compose -f /opt/vitae/docker-compose.prod.yml up -d
```

The next push to `main` will overwrite `:latest` again — so do `git revert` if you want the rollback to persist past the next deploy.

### Updating the compose file

Edit `docker-compose.prod.yml` in the repo, commit, push to `main`. The deploy job `scp`s the new file to `/opt/vitae/` before pulling images and restarting.

For an out-of-band tweak: edit `/opt/vitae/docker-compose.prod.yml` directly on the VPS and run `sudo docker compose -f docker-compose.prod.yml up -d`. The next deploy will overwrite your edit — sync it back to the repo first if you want it to stick.

### Updating the `.env` file

`.env` is **not** synced from the repo. Edit it on the VPS directly, then:

```bash
cd /opt/vitae
sudo docker compose -f docker-compose.prod.yml up -d
# Compose detects the env change and recreates the affected containers.
```

## Troubleshooting

**`/api/health` returns 502** — Pangolin can't reach `vitae-api`. Check that the container is healthy (`docker ps`), and that it's on the `pangolin` network (`docker inspect vitae-api | grep -A5 Networks`).

**Alembic migration fails on startup** — read the api logs. Most common cause: a hand-edited migration file that doesn't apply cleanly. Roll back to the previous image while you fix forward.

**GHA deploy job hangs on smoke check** — the deploy succeeded but the health check is failing. Either the API is still warming up (it takes ~20s on a cold cache) or Pangolin needs reconfiguring. Check logs.

**`/api/auth/register` returns 403** — that's correct. `REGISTRATION_ENABLED=false` is the production default. Create accounts with `make create-user`.

**Worker not picking up jobs** — ARQ consumes from the same Redis the API enqueues to; if the API was started without redis being healthy, jobs queue but the worker might be in a broken state. `docker compose restart vitae-worker` usually fixes it.
