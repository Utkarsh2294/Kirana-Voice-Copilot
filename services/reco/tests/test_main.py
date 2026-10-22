import pytest
from fastapi.testclient import TestClient

from services.reco.app.main import create_app

KEY = "test-key-" + "x" * 32


def test_health_readiness_and_key_auth():
    with TestClient(create_app(KEY)) as client:
        assert client.get("/healthz").status_code == 200
        assert client.get("/readyz").json()["status"] == "ready"
        assert client.get("/v1").status_code == 401
        assert client.get("/v1", headers={"x-api-key": "wrong"}).status_code == 401
        response = client.get("/v1", headers={"x-api-key": KEY})
        assert response.status_code == 200
        assert response.json()["recommendationsAvailable"] is False
        assert response.headers["x-request-id"]


def test_startup_rejects_missing_key():
    with pytest.raises(RuntimeError, match="RECO_API_KEY"):
        with TestClient(create_app("")):
            pass
