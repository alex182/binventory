import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from db import init_db
from routers import bins, items, loans, locations, photos, search


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


STATIC_DIR = Path(__file__).parent / "static"

if STATIC_DIR.is_dir():

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404)
        candidate = STATIC_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")
