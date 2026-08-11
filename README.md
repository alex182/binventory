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
