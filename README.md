# Binventory

Self-hosted storage-bin tracker. See `CLAUDE.md` for architecture and conventions, `TICKETS.md` for the work plan.

## Dev setup

All development happens inside the dev container defined in `.devcontainer/` — never install or run things on the host. The only host-level tools you need are Docker and your editor.

Build the dev image:

```
docker build -t binv-dev .devcontainer
```

Sanity-check the toolchain (Python 3.12, Node 20, pytest, ruff):

```
docker run --rm binv-dev bash -lc 'python --version && node --version && pytest --version && ruff --version'
```

**VS Code:** install the "Dev Containers" extension, open this folder, and choose "Reopen in Container". `devcontainer.json` mounts the workspace at `/workspace`, forwards port `8000`, and (once `app/requirements.txt` / `web/package.json` exist) installs dependencies via `postCreateCommand`.

**CLI only:** run the container manually and `docker exec` into it, e.g.:

```
docker run -it --rm -v "$PWD":/workspace -p 8000:8000 -w /workspace binv-dev bash
```

Every ticket's Accept commands run **inside** this container, never on the host.

## Reverse proxy (nginx)

The app has no auth of its own — TLS termination and access control live in an external nginx sitting in front of the container. Point it at the container's port `8000` and forward the usual proxy headers so the app sees the real scheme/host:

```nginx
location / {
    # ACL: restrict access here (e.g. allow/deny, auth_basic, or an upstream auth check).

    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Set `BASE_URL` on the container to the public URL the browser sees (e.g. `https://bins.example.com`) — the app uses it, not the forwarded headers, to build any absolute link (QR codes, etc.).

## Local HTTPS for LAN testing (camera/QR scan)

Camera access (`getUserMedia`, used by the QR scanner) requires a secure
context — HTTPS, or `http://localhost`. Neither applies when testing from a
phone at `http://<lan-ip>:8000`, so there's an opt-in `tls-proxy` service
(self-signed cert, not started by a plain `docker compose up`):

```
scripts/gen-dev-cert.sh              # auto-detects your LAN IP
# or: scripts/gen-dev-cert.sh 192.168.1.42
docker compose --profile tls up -d --build
```

Then visit `https://<your-lan-ip>` from your phone (default HTTPS port,
no `:8000`). You'll get a certificate warning since it's self-signed —
accept it once ("Advanced" → "Accept the Risk and Continue" in Firefox).
The cert/key land in `tls/` and are gitignored; only `tls/nginx.conf` and
the generator script are tracked. This is dev-only scaffolding — production
TLS is the external nginx described above, not this proxy.

## Deploying to a remote machine

The repo lives in a **private** GitHub repo, so the target host needs read
access to clone/pull it — either an SSH deploy key added to the repo, or a
personal access token (PAT, `repo` scope) used over HTTPS. The container's
data (`db.sqlite`, `photos/`) lives in the named Docker volume, not in the
repo, so pulling new code never touches it.

**First deploy:**

```
ssh user@target-host
git clone git@github.com:alex182/binventory.git ~/docker/binventory
# or, with a PAT instead of an SSH key:
#   git clone https://<token>@github.com/alex182/binventory.git ~/docker/binventory
cd ~/docker/binventory
docker compose up -d --build
```

**Redeploying after pushing changes:**

```
ssh user@target-host
cd ~/docker/binventory
git pull
docker compose up -d --build
```

Set `BASE_URL` on the target (e.g. via a `.env` file or the shell before
`docker compose up`) to the public URL your external nginx exposes — see
"Reverse proxy (nginx)" above. The `tls-proxy` profile is dev-only and
shouldn't be started on the target; production TLS is handled by the
external nginx in front of the container.

**Without git on the target:** ship a tarball instead —

```
# on this machine
tar czf binventory.tar.gz \
  --exclude .git \
  --exclude node_modules \
  --exclude dist \
  --exclude app/static \
  --exclude __pycache__ \
  --exclude .pytest_cache \
  --exclude .ruff_cache \
  --exclude docker-compose.override.yml \
  -C ~ binventory
scp binventory.tar.gz user@target-host:~/docker/

# on the target machine
cd ~/docker
tar xzf binventory.tar.gz
cd binventory
docker compose up -d --build
```
