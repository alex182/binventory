# TICKETS.md — Binventory

Execute one ticket per session. Read `CLAUDE.md` first. Each ticket lists what it depends on, which files to touch, the API contract it introduces, and a runnable Accept check. Do exactly what's in scope and stop.

Accept checks assume the app runs at `http://localhost:8000` **inside the dev container** (T0.0). Run every command in the container, never on the host. For API tickets, run the app (`cd app && DATA_DIR=/tmp/binv uvicorn main:app` or `docker compose up`) in one shell and curl in another. UI-only checks are marked **[manual]** — verify in a browser and describe the result.

---

## Phase 0 — Scaffold & Docker

### T0.0 — Dev container
- **Depends on:** none
- **Files:** `.devcontainer/devcontainer.json`, `.devcontainer/Dockerfile`, `.gitignore`, `README.md` (dev-setup section)
- **Do:** Define a dev container so all tooling lives in the container, not the host. Dev image: Python 3.12 + Node 20 + `git`, `curl`, `file`, `pytest`, `ruff`. Mount the workspace; forward port `8000`. `devcontainer.json` sets `workspaceFolder`, installs `app/requirements.txt` and `web` deps via a `postCreateCommand` (tolerate their absence on first build). Do **not** run app services here — this ticket only provisions the environment. Nothing is installed on the host.
- **Accept:**
  ```
  # host: only docker is needed
  docker build -t binv-dev .devcontainer && echo DEVIMG_OK
  docker run --rm binv-dev bash -lc 'python --version && node --version && pytest --version && ruff --version'
  # expect: Python 3.12.x, v20.x, pytest, ruff all print — proving tools exist in-container, not on host
  ```
- **Note:** every later ticket's Accept commands are run **inside** this container (e.g. `docker exec` or the editor's "reopen in container"), never on the host.

### T0.1 — Repo scaffold
- **Depends on:** none
- **Files:** `app/main.py`, `app/config.py`, `app/requirements.txt`, `web/package.json`, `web/vite.config.ts`, `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`, `.gitignore`, `README.md`
- **Do:** Minimal FastAPI app exposing `GET /api/health` → `{"status":"ok"}`. Minimal Vite+React+TS app rendering a placeholder page. `config.py` reads `DATA_DIR` and `BASE_URL` per CLAUDE.md defaults.
- **Accept:**
  ```
  cd app && DATA_DIR=/tmp/binv uvicorn main:app --port 8000 &
  sleep 2 && curl -s localhost:8000/api/health
  # expect: {"status":"ok"}
  cd web && npm install && npm run build   # exits 0, emits dist/
  ```

### T0.2 — Single-container build
- **Depends on:** T0.1
- **Files:** `Dockerfile`, `docker-compose.yml`, `app/main.py` (add static mount), `.gitignore` (ignore `app/static/`)
- **Do:** Multi-stage Dockerfile: stage 1 builds `web/` and copies `dist/` into `app/static/`; stage 2 python runtime runs uvicorn. FastAPI serves `app/static/` at `/` with SPA fallback (non-`/api` unknown routes → `index.html`). Compose: one service, port `8000`, named volume at `DATA_DIR=/data`.
- **Accept:**
  ```
  docker compose up -d --build && sleep 5
  curl -s localhost:8000/api/health          # {"status":"ok"}
  curl -s localhost:8000/ | grep -qi "<div id=\"root\"" && echo SPA_OK
  docker compose down
  ```

### T0.3 — nginx-ready config
- **Depends on:** T0.2
- **Files:** `app/main.py` (forwarded headers, BASE_URL usage), `README.md` (nginx block)
- **Do:** Trust `X-Forwarded-*`. Ensure any absolute URL the app emits uses `BASE_URL`. Add a sample nginx `location` block to README with `proxy_pass` and an ACL placeholder comment. No app auth.
- **Accept:**
  ```
  cd app && DATA_DIR=/tmp/binv BASE_URL=https://bins.example.com uvicorn main:app --port 8000 &
  sleep 2 && grep -q "proxy_pass" ../README.md && echo NGINX_DOC_OK
  # BASE_URL is consumed later by T2.1; here just confirm it loads without error
  ```

---

## Phase 1 — Core data & CRUD

### T1.1 — DB + tables + seed
- **Depends on:** T0.1
- **Files:** `app/db.py`, `app/models.py`, `app/main.py` (startup hook), `app/tests/test_seed.py`
- **Do:** Define all models from CLAUDE.md schema. On startup, create tables against `$DATA_DIR/db.sqlite`. Seed three sites if none exist: Garage, Basement, Storage Unit (`kind="site"`).
- **Accept:**
  ```
  cd app && rm -f /tmp/binv/db.sqlite; DATA_DIR=/tmp/binv python -c "import main"  # triggers create+seed
  python -c "import sqlite3;print(sorted(r[0] for r in sqlite3.connect('/tmp/binv/db.sqlite').execute('select name from location where kind=\"site\"')))"
  # expect: ['Basement', 'Garage', 'Storage Unit']
  pytest tests/test_seed.py -q
  ```

### T1.2 — Location API + tree
- **Depends on:** T1.1
- **Files:** `app/routers/locations.py`, `app/main.py` (include router), `app/tests/test_locations.py`
- **API:**
  - `GET /api/locations` → array of Location
  - `GET /api/locations/tree` → nested `{...location, children:[...]}` roots
  - `POST /api/locations` `{name, kind, parent_id?, grid_row?, grid_col?}` → Location (409 if kind/parent level invalid)
  - `PATCH /api/locations/{id}` / `DELETE /api/locations/{id}`
- **Do:** Enforce site→zone→stack→slot parent rule. `grid_row`/`grid_col` allowed only when `kind="stack"`; reject (409) otherwise.
- **Accept:**
  ```
  # with app running on :8000
  G=$(curl -s localhost:8000/api/locations | python -c "import sys,json;print([l['id'] for l in json.load(sys.stdin) if l['name']=='Garage'][0])")
  curl -s -XPOST localhost:8000/api/locations -H 'content-type: application/json' -d "{\"name\":\"Shelf A\",\"kind\":\"zone\",\"parent_id\":$G}" | grep -q '"id"' && echo ZONE_OK
  curl -s -o /dev/null -w "%{http_code}" -XPOST localhost:8000/api/locations -H 'content-type: application/json' -d "{\"name\":\"bad\",\"kind\":\"slot\",\"parent_id\":$G}"  # expect 409
  pytest tests/test_locations.py -q
  ```

### T1.3 — Bin API
- **Depends on:** T1.2
- **Files:** `app/routers/bins.py`, `app/main.py`, `app/tests/test_bins.py`
- **API:**
  - `GET /api/bins?location_id=&include_blank=false` → array of Bin (optional location filter; blank bins excluded unless `include_blank=true`)
  - `GET /api/bins/{id}` → Bin
  - `POST /api/bins` `{label, location_id?, stack_position?, fullness?, location_note?, notes?}` → Bin with generated unique `code`
  - `PATCH /api/bins/{id}` / `DELETE /api/bins/{id}`
- **Do:** Generate URL-safe unique `code` on create (fix the scheme here per CLAUDE.md). `fullness` defaults to `"room"`.
- **Accept:**
  ```
  B=$(curl -s -XPOST localhost:8000/api/bins -H 'content-type: application/json' -d '{"label":"Winter clothes"}')
  echo "$B" | grep -q '"code"' && echo CODE_OK
  ID=$(echo "$B" | python -c "import sys,json;print(json.load(sys.stdin)['id'])")
  curl -s localhost:8000/api/bins/$ID | grep -q '"fullness": "room"' && echo FULLNESS_DEFAULT_OK
  pytest tests/test_bins.py -q
  ```

### T1.4 — Bin + location UI (with fullness)
- **Depends on:** T1.3
- **Files:** `web/src/api.ts`, `web/src/pages/Locations.tsx`, `web/src/pages/BinForm.tsx`, `web/src/App.tsx`
- **Do:** Location tree view; per-location bin list; create/edit bin form. The form lets you assign a location at **any** precision (pick a site, or drill to a stack — both allowed) and includes a free-text `location_note` field plus a fullness selector (empty / has room / full) rendered as a badge in lists. Bin detail shows the combined address (tree path + note).
- **Accept:** **[manual]** Create bin A assigned only to Basement with note "behind the water heater"; create bin B in a precise grid stack. Reload: A shows "Basement · behind the water heater", B shows its full grid path. Both valid.

### T1.5 — Reverse location view
- **Depends on:** T1.3 (T4.1 improves ordering later)
- **Files:** `app/routers/locations.py` (add endpoint), `web/src/pages/LocationDetail.tsx`, `web/src/api.ts`, `app/tests/test_locations.py`
- **API:** `GET /api/locations/{id}/bins` → array of Bin ordered by `stack_position` (nulls last), each including derived `is_buried`.
- **Do:** Location detail page listing every bin at that spot top→bottom with fullness + buried badges.
- **Accept:**
  ```
  curl -s "localhost:8000/api/locations/$G/bins" | python -c "import sys,json;d=json.load(sys.stdin);print('is_buried' in (d[0] if d else {}))"
  # expect: True (once at least one bin is placed there)
  pytest tests/test_locations.py -q
  ```

### T1.6 — Grid layout (generate + view)
- **Depends on:** T1.2
- **Files:** `app/routers/locations.py` (grid endpoints), `web/src/pages/GridView.tsx`, `web/src/api.ts`, `app/tests/test_grid.py`
- **API:**
  - `POST /api/locations/{site_id}/grid` `{rows, cols}` → creates `rows×cols` stack locations under the site, each named `R{r}C{c}` with `grid_row=r, grid_col=c` (1-based; skips cells that already exist).
  - `GET /api/locations/{site_id}/grid` → `{rows, cols, cells:[{stack_id, grid_row, grid_col, bin_count, top_bin?}]}`.
- **Do:** Grid view page renders the site as a Row×Column matrix; each cell shows tote count and links to that stack's detail (T1.5). Intended for the Storage Unit; works for any site with grid stacks.
- **Accept:**
  ```
  U=$(curl -s localhost:8000/api/locations | python -c "import sys,json;print([l['id'] for l in json.load(sys.stdin) if l['name']=='Storage Unit'][0])")
  curl -s -XPOST localhost:8000/api/locations/$U/grid -H 'content-type: application/json' -d '{"rows":3,"cols":3}' | grep -q '"grid_row"' && echo GRID_OK
  curl -s localhost:8000/api/locations/$U/grid | python -c "import sys,json;d=json.load(sys.stdin);print(d['rows']==3 and d['cols']==3 and len(d['cells'])==9)"
  # expect: True
  pytest tests/test_grid.py -q
  ```

---

## Phase 2 — QR codes

### T2.1 — QR generation
- **Depends on:** T1.3, T0.3
- **Files:** `app/routers/bins.py` (add routes), `app/requirements.txt` (add `qrcode[pil]`), `app/tests/test_qr.py`
- **API:** `GET /api/bins/{id}/qr.png` and `.svg` → image whose content is `${BASE_URL}/b/{code}`.
- **Accept:**
  ```
  curl -s "localhost:8000/api/bins/$ID/qr.svg" | grep -qi "<svg" && echo SVG_OK
  curl -s -o /tmp/q.png "localhost:8000/api/bins/$ID/qr.png"; file /tmp/q.png | grep -qi png && echo PNG_OK
  pytest tests/test_qr.py -q
  ```

### T2.2 — Scan-to-open
- **Depends on:** T2.1
- **Files:** `web/src/pages/BinDetail.tsx`, `web/src/pages/Scan.tsx`, `web/src/api.ts`, `app/routers/bins.py` (add `GET /api/bins/by-code/{code}`), `web/package.json` (add `html5-qrcode`)
- **API:** `GET /api/bins/by-code/{code}` → Bin (404 if unknown). Frontend route `/b/{code}` resolves and shows bin detail.
- **Do:** In-app camera scanner navigates to the scanned `/b/{code}`. Resolution rules: **active** code → bin detail; **blank** code (pre-printed, unclaimed) → claim form (see T2.4); genuinely unknown code → "not found + create".
- **Accept:**
  ```
  CODE=$(curl -s localhost:8000/api/bins/$ID | python -c "import sys,json;print(json.load(sys.stdin)['code'])")
  curl -s localhost:8000/api/bins/by-code/$CODE | grep -q '"status": "active"' && echo BYCODE_OK
  curl -s -o /dev/null -w "%{http_code}" localhost:8000/api/bins/by-code/zzzznope  # expect 404
  ```
  **[manual]** Scanning an active code opens the bin; scanning a blank code opens the claim form.

### T2.3 — Printable label sheets
- **Depends on:** T2.1
- **Files:** `web/src/pages/PrintSheet.tsx`, `web/src/api.ts`
- **Do:** Print view laying out labels on an Avery 5160/8160 grid (US Letter, 30 cells, 3 cols × 10 rows, 1" × 2⅝"). Each label = QR + label text + `code` + optional location path. For **blank** bins the label text shows a placeholder (e.g. the `code` only, no name). Controls: multi-select bins; **copies per bin (default 3)**; sequential fill (bins packed continuously — at 3 copies that's **10 bins/sheet**; overflow starts a new sheet, no blank remainders). CSS `@media print` sizes cells to the 5160 template with correct margins.
- **Accept:** **[manual]** Select 12 bins at 3 copies → print preview shows 36 labels across 2 sheets (10 bins on sheet 1, remaining 2 bins start sheet 2), each bin's 3 copies consecutive, grid aligned to a real 5160 sheet.

### T2.4 — Pre-printed blank codes + claim
- **Depends on:** T2.2, T2.3
- **Files:** `app/routers/bins.py` (batch + claim endpoints), `web/src/pages/ClaimBin.tsx`, `web/src/pages/PrintSheet.tsx` (blank selection), `web/src/api.ts`, `app/tests/test_blank.py`
- **API:**
  - `POST /api/bins/batch` `{count}` → creates `count` blank bins (`status="blank"`, empty label, generated code); returns the array. For pre-printing rolls/sheets.
  - `GET /api/bins/blank` → array of unclaimed blank bins.
  - `POST /api/bins/{id}/claim` `{label, location_id?, stack_position?, fullness?, location_note?, notes?}` → fills fields and flips `status` to `"active"` (409 if already active). `code` is unchanged.
- **Do:** Print sheet can target blank bins. Scanning a blank code (via T2.2) lands on the claim form, which calls `claim`, then shows the now-active bin so contents can be added.
- **Accept:**
  ```
  curl -s -XPOST localhost:8000/api/bins/batch -H 'content-type: application/json' -d '{"count":5}' | python -c "import sys,json;d=json.load(sys.stdin);print(len(d)==5 and all(b['status']=='blank' for b in d))"
  # expect: True
  BL=$(curl -s localhost:8000/api/bins/blank | python -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")
  curl -s -XPOST localhost:8000/api/bins/$BL/claim -H 'content-type: application/json' -d '{"label":"Camping gear","location_note":"Garage, top shelf"}' | grep -q '"status": "active"' && echo CLAIM_OK
  # blank bins must not appear in the default list:
  curl -s "localhost:8000/api/bins" | python -c "import sys,json;print(all(b['status']=='active' for b in json.load(sys.stdin)))"  # True
  pytest tests/test_blank.py -q
  ```

---

## Phase 3 — Contents & search

### T3.1 — Item CRUD
- **Depends on:** T1.3
- **Files:** `app/routers/items.py`, `app/main.py`, `web/src/pages/BinDetail.tsx` (items section), `web/src/api.ts`, `app/tests/test_items.py`
- **API:**
  - `GET /api/bins/{id}/items` → array of Item
  - `POST /api/bins/{id}/items` `{name, qty?, notes?}` → Item
  - `PATCH /api/items/{id}` / `DELETE /api/items/{id}`
- **Do:** Editing items must not alter the bin's `code` (contents change never triggers a reprint).
- **Accept:**
  ```
  curl -s -XPOST localhost:8000/api/bins/$ID/items -H 'content-type: application/json' -d '{"name":"tent","qty":1}' | grep -q '"id"' && echo ITEM_OK
  curl -s localhost:8000/api/bins/$ID | python -c "import sys,json;print(json.load(sys.stdin)['code'])"  # unchanged vs T2.2 CODE
  pytest tests/test_items.py -q
  ```

### T3.2 — Global fuzzy search
- **Depends on:** T3.1
- **Files:** `app/db.py` (FTS5 trigram table + triggers), `app/routers/search.py`, `app/main.py`, `web/src/components/SearchBar.tsx`, `app/tests/test_search.py`
- **API:** `GET /api/search?q=` → array of `{bin_id, label, code, location_path, matched_field}`, ranked by relevance.
- **Do:** FTS5 with **trigram** tokenizer over bin label, bin notes, bin `location_note`, and item names, kept in sync via triggers. Substring + typo tolerant. Queries <3 chars fall back to prefix match. `location_path` chains the tree path and appends `location_note` when present — linear: "Basement · Shelf A · Stack 2 · tote 3"; grid: "Storage Unit · R1C1 · tote 1"; coarse: "Basement · behind the water heater".
- **Accept:**
  ```
  curl -s "localhost:8000/api/search?q=tnet" | python -c "import sys,json;d=json.load(sys.stdin);print(any('tent' in x['label'].lower() or x['matched_field']=='item' for x in d))"
  # expect: True  (typo 'tnet' still finds the tent's bin)
  pytest tests/test_search.py -q
  ```

### T3.3 — Loan / checkout tracking
- **Depends on:** T3.1
- **Files:** `app/routers/items.py` (loan endpoints), `app/routers/loans.py`, `app/main.py`, `web/src/pages/BinDetail.tsx`, `web/src/pages/Loans.tsx`, `web/src/api.ts`, `app/tests/test_loans.py`
- **API:**
  - `POST /api/items/{id}/loan` `{loaned_to}` → Item (sets `loaned_at` now)
  - `POST /api/items/{id}/return` → Item (clears both fields)
  - `GET /api/loans` → array of items currently out, with bin + borrower + date
- **Do:** Loaned items show a badge on the bin.
- **Accept:**
  ```
  IT=$(curl -s localhost:8000/api/bins/$ID/items | python -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")
  curl -s -XPOST localhost:8000/api/items/$IT/loan -H 'content-type: application/json' -d '{"loaned_to":"Alex"}' | grep -q '"loaned_to": "Alex"' && echo LOAN_OK
  curl -s localhost:8000/api/loans | grep -q '"Alex"' && echo LOANLIST_OK
  curl -s -XPOST localhost:8000/api/items/$IT/return | grep -q '"loaned_to": null' && echo RETURN_OK
  pytest tests/test_loans.py -q
  ```

---

## Phase 4 — Spatial / stack tracking

### T4.1 — Stack ordering
- **Depends on:** T1.3
- **Files:** `app/routers/bins.py` (reorder endpoint), `app/tests/test_stack.py`
- **API:** `POST /api/locations/{stack_id}/reorder` `{ordered_bin_ids:[...]}` where the array is **bottom→top**; assigns `stack_position` 1..n (1 = bottom).
- **Accept:**
  ```
  # create a stack, place 2 bins, reorder bottom→top, verify positions 1 and 2
  pytest tests/test_stack.py -q   # test drives the full happy path
  ```

### T4.2 — Buried indicator
- **Depends on:** T4.1
- **Files:** `app/routers/bins.py` (include `is_buried`, `bins_on_top`), `web/src/pages/BinDetail.tsx`, `web/src/pages/LocationDetail.tsx`, `app/tests/test_stack.py`
- **Do:** Derive `is_buried` = any bin with a **higher** `stack_position` in the same stack (something sits on top). Expose `bins_on_top` count. Show badge "N totes on top."
- **Accept:**
  ```
  pytest tests/test_stack.py -q   # asserts is_buried flips with order
  ```
  **[manual]** Reordering a stack updates the buried badge.

### T4.3 — Move + bulk move
- **Depends on:** T4.1
- **Files:** `app/routers/bins.py` (move endpoints), `web/src/components/MoveDialog.tsx`, `app/tests/test_move.py`
- **API:**
  - `POST /api/bins/{id}/move` `{to_location_id, to_position?}`
  - `POST /api/locations/{stack_id}/move` `{to_location_id}` → moves whole stack, preserving internal order
- **Accept:**
  ```
  pytest tests/test_move.py -q   # asserts stack relocation keeps order
  ```

---

## Phase 5 — Photos

### T5.1 — Upload + storage
- **Depends on:** T1.3
- **Files:** `app/routers/photos.py`, `app/main.py`, `app/requirements.txt` (add `pillow`), `app/tests/test_photos.py`
- **API:**
  - `POST /api/bins/{id}/photos` (multipart `file`) → Photo; stores original + thumbnail under `$DATA_DIR/photos/`
  - `GET /api/photos/{id}` and `/api/photos/{id}/thumb`
  - `DELETE /api/photos/{id}`
- **Accept:**
  ```
  printf 'x' > /tmp/p.png  # replace with a real png in test
  pytest tests/test_photos.py -q   # uploads a real png, asserts file persists under DATA_DIR/photos
  ```

### T5.2 — Photo UI
- **Depends on:** T5.1
- **Files:** `web/src/pages/BinDetail.tsx`, `web/src/components/PhotoGrid.tsx`, `web/src/api.ts`
- **Do:** Thumbnails on bin detail; capture from phone camera (`<input capture>`); delete.
- **Accept:** **[manual]** Photograph a bin's contents; thumbnail appears on the record and survives a container restart.

---

## Phase 6 — History & audit

### T6.1 — Move log
- **Depends on:** T4.3
- **Files:** `app/routers/bins.py` (write MoveLog on move), `app/tests/test_move.py`
- **Do:** Every location/position change writes a MoveLog row.
- **Accept:**
  ```
  pytest tests/test_move.py -q   # asserts a move creates exactly one MoveLog row with from/to
  ```

### T6.2 — History UI
- **Depends on:** T6.1
- **Files:** `app/routers/bins.py` (`GET /api/bins/{id}/history`), `web/src/pages/BinDetail.tsx`, `web/src/api.ts`
- **API:** `GET /api/bins/{id}/history` → array of MoveLog with resolved location names, newest first.
- **Accept:**
  ```
  curl -s localhost:8000/api/bins/$ID/history | python -c "import sys,json;print(isinstance(json.load(sys.stdin),list))"  # True
  ```
  **[manual]** Timeline shows from→to with timestamps.

---

## Phase 7 — Backup, empties, polish

### T7.1 — Export / import
- **Depends on:** T3.1
- **Files:** `app/routers/export.py`, `app/main.py`, `app/tests/test_export.py`
- **API:**
  - `GET /api/export` → JSON of all data
  - `GET /api/export.csv` → bins + contents CSV
  - `POST /api/import` (JSON body) → restores data
- **Accept:**
  ```
  curl -s localhost:8000/api/export > /tmp/dump.json
  python -c "import json;d=json.load(open('/tmp/dump.json'));print('bins' in d and 'items' in d)"  # True
  pytest tests/test_export.py -q   # export then import round-trips
  ```

### T7.2 — Empty-bin tracking
- **Depends on:** T3.1
- **Files:** `app/routers/bins.py` (`?empty=true` filter), `web/src/pages/Locations.tsx`, `app/tests/test_bins.py`
- **Do:** A bin is empty when it has zero items. Support `GET /api/bins?empty=true`; add a UI filter.
- **Accept:**
  ```
  curl -s "localhost:8000/api/bins?empty=true" | python -c "import sys,json;print(isinstance(json.load(sys.stdin),list))"  # True
  pytest tests/test_bins.py -q
  ```

### T7.3 — Polish + PWA
- **Depends on:** all prior
- **Files:** `web/src/**` (layout pass), `web/public/manifest.webmanifest`, `web/index.html`, `web/src/sw.ts`
- **Do:** Mobile layout, error/empty states, favicon, installable PWA (manifest + service worker for offline shell).
- **Accept:** **[manual]** Installable to a phone home screen; app shell loads offline.

---

## Dependency graph (quick reference)

```
T0.0 (dev container — do first; all later work runs inside it)
T0.1 → T0.2 → T0.3
T0.1 → T1.1 → T1.2 → T1.3 → T1.4
                     T1.3 → T1.5
                     T1.2 → T1.6
T1.3,T0.3 → T2.1 → T2.2
                   T2.1 → T2.3
             T2.2,T2.3 → T2.4
T1.3 → T3.1 → T3.2
              T3.1 → T3.3
T1.3 → T4.1 → T4.2
              T4.1 → T4.3 → T6.1 → T6.2
T1.3 → T5.1 → T5.2
T3.1 → T7.1
T3.1 → T7.2
all  → T7.3
```
