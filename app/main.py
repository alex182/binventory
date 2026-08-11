from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from db import init_db
from routers import locations

app = FastAPI()
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

init_db()


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(locations.router)


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
