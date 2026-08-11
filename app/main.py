import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from db import init_db
from routers import bins, export, items, loans, locations, photos, search


class SpacedJSONResponse(JSONResponse):
    def render(self, content) -> bytes:
        return json.dumps(content, ensure_ascii=False).encode("utf-8")


app = FastAPI(default_response_class=SpacedJSONResponse)
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

init_db()


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(locations.router)
app.include_router(bins.router)
app.include_router(bins.stack_router)
app.include_router(items.router)
app.include_router(loans.router)
app.include_router(photos.router)
app.include_router(search.router)
app.include_router(export.router)


STATIC_DIR = Path(__file__).parent / "static"

if STATIC_DIR.is_dir():

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404)

        candidate = STATIC_DIR / full_path
        if full_path and candidate.is_file():
            # Vite's build output under assets/ is content-hashed (a new
            # build gets a new filename), so it's safe — and desirable — to
            # cache forever. Everything else (index.html, manifest, icons,
            # sw.js, and this same fallback for arbitrary SPA routes) must
            # never be cached without revalidation: index.html references
            # those hashed filenames by name, so a stale cached copy points
            # at assets a new deploy has already removed, and the app fails
            # to load at all. This is what broke scanning on a phone whose
            # browser cache had latched onto an old index.html.
            if full_path.startswith("assets/"):
                headers = {"Cache-Control": "public, max-age=31536000, immutable"}
            else:
                headers = {"Cache-Control": "no-store"}
            return FileResponse(candidate, headers=headers)

        return FileResponse(STATIC_DIR / "index.html", headers={"Cache-Control": "no-store"})
