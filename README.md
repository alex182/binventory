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
