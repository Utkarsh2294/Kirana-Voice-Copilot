"""Process health, readiness and an API-key protected version endpoint."""

import hmac
import json
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException, Request

logger = logging.getLogger("kirana.reco")
logging.basicConfig(level=logging.INFO, format="%(message)s")


def create_app(api_key: str | None = None) -> FastAPI:
    """Create an isolated app for ASGI and tests; never log request payloads."""
    key = api_key if api_key is not None else os.environ.get("RECO_API_KEY", "")

    @asynccontextmanager
    async def lifespan(_app):
        if len(key) < 32:
            raise RuntimeError("RECO_API_KEY must contain at least 32 characters")
        yield

    app = FastAPI(title="Kirana recommendation service", version="0.2.0", lifespan=lifespan)

    @app.middleware("http")
    async def request_log(request: Request, call_next):
        request_id = str(uuid.uuid4())
        start = time.monotonic()
        response = await call_next(request)
        response.headers["x-request-id"] = request_id
        logger.info(
            json.dumps(
                {
                    "event": "request",
                    "requestId": request_id,
                    "method": request.method,
                    "status": response.status_code,
                    "durationMs": round((time.monotonic() - start) * 1000),
                }
            )
        )
        return response

    async def require_key(x_api_key: str = Header(default="")):
        if not key or not hmac.compare_digest(x_api_key.encode(), key.encode()):
            raise HTTPException(status_code=401, detail="Invalid API key")

    @app.get("/healthz")
    async def health():
        return {"status": "ok", "service": "reco"}

    @app.get("/readyz")
    async def ready():
        # No Mongo dependency until Phase 11: readiness checks only configured dependencies.
        return {"status": "ready", "checks": {"apiKeyConfigured": len(key) >= 32}}

    @app.get("/v1", dependencies=[Depends(require_key)])
    async def version():
        return {"version": "0.2.0", "phase": 2, "recommendationsAvailable": False}

    return app


app = create_app()
