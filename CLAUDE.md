# CLAUDE.md — Binventory

Read this file in full before touching any ticket. It is the single source of truth for stack, structure, conventions, and workflow. `TICKETS.md` holds the work items.

## What this is

A self-hosted storage-bin tracker. QR-labelled totes, spatial/stack tracking, fuzzy contents search, photos, loan tracking. One Docker container behind an external nginx that handles TLS and access control. The app itself has **no auth** — never add login, sessions, or user accounts.

## Workflow rules (follow exactly)

0. **All development happens inside the dev container** (`.devcontainer/`, built in T0.0). Never run `pip install`, `npm install`, builds, or the app on the host. If a command would install or modify anything, it runs in the container. The only host-level tools are Docker and your editor.
1. Implement **one ticket per session**, then stop. Do not start the next ticket.
2. Before coding: read this file, then read the ticket and every ticket listed in its `Depends on`.
3. Only touch files listed in the ticket's `Files`. If you must touch others, note why in the commit body.
4. Run the ticket's `Accept` check and paste the output. A ticket is not done until Accept passes.
5. Finish by committing: `git commit -m "T<id>: <title>"`. One commit per ticket.
6. Do not invent scope. If a ticket is ambiguous, implement the smallest thing that satisfies Accept and note the assumption.

## Stack (pinned — do not substitute)

- **Backend:** Python 3.12, FastAPI, SQLModel, Uvicorn. Deps in `app/requirements.txt`.
- **DB:** SQLite at `$DATA_DIR/db.sqlite`. Uses FTS5 + trigram tokenizer (requires SQLite ≥ 3.34, standard in Python 3.12's bundled `sqlite3`). If trigram is unavailable at runtime, fail loudly at startup with a clear message.
- **Frontend:** Node 20, Vite, React 18, TypeScript. QR scan via `html5-qrcode`.
- **Serving:** frontend is built to static files and copied into `app/static/`; FastAPI serves them with an SPA fallback (unknown non-`/api` routes return `index.html`).
- **Container:** one multi-stage `Dockerfile` (node build stage → python runtime), one service in `docker-compose.yml`, one named volume mounted at `$DATA_DIR`.

## Config (env vars only)

| Var | Default | Meaning |
|-----|---------|---------|
| `DATA_DIR` | `/data` | Holds `db.sqlite` and `photos/`. Mounted volume. |
| `BASE_URL` | `http://localhost:8000` | Public base URL as seen by the browser; used to build QR link targets. No trailing slash. |

App trusts `X-Forwarded-Proto`/`X-Forwarded-Host` (behind nginx). Never read secrets or auth headers.

## Repo structure (create as needed, keep stable)

```
binventory/
  CLAUDE.md
  TICKETS.md
  Dockerfile
  docker-compose.yml
  .gitignore
  README.md
  .devcontainer/
    devcontainer.json     # VS Code / CLI dev container definition
    Dockerfile            # dev image: python 3.12 + node 20 + tooling
  app/
    requirements.txt
    main.py            # FastAPI app, mounts routers + static SPA
    config.py          # env var loading
    db.py              # engine, session, init/create tables, FTS setup
    models.py          # SQLModel models
    routers/
      health.py
      locations.py
      bins.py
      items.py
      photos.py
      search.py
      loans.py
      export.py
    tests/
      test_*.py        # pytest
    static/            # built frontend lands here (gitignored)
  web/
    package.json
    vite.config.ts
    index.html
    src/
      main.tsx
      App.tsx
      api.ts           # typed fetch wrappers, one per endpoint
      pages/
      components/
```

## API conventions

- All endpoints under `/api`. JSON in/out. Field names `snake_case`. Timestamps ISO-8601 UTC strings.
- Errors: HTTP status + `{"detail": "..."}`. Use 404 for missing, 422 for validation (FastAPI default), 409 for conflicts.
- List endpoints return a JSON array (not wrapped). Create returns the created object with its `id`.
- Never break an endpoint shape defined in an earlier ticket. If a ticket needs a new field, add it, don't rename.

## Data model (authoritative schema)

```python
Location:  id int pk
           name str
           kind str  # "site" | "zone" | "stack" | "slot"
           parent_id int fk Location.id nullable
           grid_row int nullable   # set on stacks inside a grid site (front→back)
           grid_col int nullable   # set on stacks inside a grid site (left→right)

Bin:       id int pk
           code str unique        # short slug, permanent, encoded in QR
           label str
           status str default "active"    # "blank" (pre-printed, unclaimed) | "active"
           location_id int fk Location.id nullable
           stack_position int nullable   # height in the stack, 1 = BOTTOM, increasing upward
           fullness str default "room"   # "empty" | "room" | "full"
           location_note str default ""  # free-text location description, any precision
           notes str default ""
           created_at datetime
           # is_buried is DERIVED, not stored: a bin is buried if any bin in the
           # same stack has a HIGHER stack_position (i.e. sits on top of it).
           # bins_on_top = count of same-stack bins with higher position.
           # The top tote (highest position) is the most accessible.

Item:      id int pk
           bin_id int fk Bin.id
           name str
           qty int default 1
           notes str default ""
           loaned_to str nullable
           loaned_at datetime nullable

Photo:     id int pk
           bin_id int fk Bin.id
           filename str        # stored under $DATA_DIR/photos/
           created_at datetime

MoveLog:   id int pk
           bin_id int fk Bin.id
           from_location_id int nullable
           to_location_id int nullable
           from_position int nullable
           to_position int nullable
           moved_at datetime
```

Location hierarchy rule: `site` → `zone` → `stack` → `slot`. A child's `kind` must be exactly one level below its parent's. Sites have `parent_id = null`.

**Location precision is flexible.** A bin's `location_id` may point at any tree level — a whole site (Basement), a zone, or a precise grid stack — and `stack_position` is optional. Alongside that, `location_note` holds free text ("behind the water heater", "top bin, blue lid"). Use whatever combination fits: site + note is valid, precise stack alone is valid, both together is valid, note-only (no `location_id`) is valid. The displayed address chains the tree path (if any) and appends the note (if any).

**Two layout styles** (both use the same tree):
- **Linear** (Garage, Basement): a `stack` is just an ordered vertical pile of totes. `grid_row`/`grid_col` are null. Address reads like "Basement · Shelf A · Stack 2 · tote 3".
- **Grid** (Storage Unit): the site holds a rectangular grid of `stack`s, each tagged with `grid_row` (front→back) and `grid_col` (left→right); a tote's `stack_position` is its height (1 = bottom). Address reads like "Storage Unit · R1C1 · tote 1" (Row 1, Column 1, bottom tote). Cells may be empty.

`code` generation: 8-char lowercase base32 (e.g. `bin-4a2f` style is fine too — pick one in T1.3 and keep it). Must be URL-safe and unique.

**Two ways to create a tote:**
- **Print-on-create:** make a bin with a label, then print its sticker.
- **Pre-printed blank codes:** batch-generate blank bins (code only, `status="blank"`, empty label), print a roll/sheet, stick them on totes, then **claim** each by scanning — the claim form fills in label/location/contents and flips `status` to `"active"`. Blank bins are hidden from normal bin lists until claimed.

## Definition of done (every ticket)

- Accept check passes and output is pasted.
- Backend changes have at least one pytest covering the happy path.
- No stray files outside the ticket's `Files` (or explained in commit).
- `docker compose up` still starts cleanly if the ticket touched runtime.
