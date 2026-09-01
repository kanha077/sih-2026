import pytest
from fastapi.testclient import TestClient
from PIL import Image
from io import BytesIO
import time

from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "DepthWizard" in data["service"]


def test_samples_endpoint():
    response = client.get("/api/samples")
    assert response.status_code == 200
    samples = response.json()
    assert len(samples) >= 4
    sample_ids = [s["id"] for s in samples]
    assert "alpine-ridge" in sample_ids
    assert "coastal-valley" in sample_ids


def test_upload_invalid_file_type():
    # Attempt to upload a text file masquerading as image
    fake_content = b"Not a real image file content"
    files = {"file": ("malicious.txt", fake_content, "text/plain")}
    response = client.post("/api/upload", files=files)
    assert response.status_code == 400


def test_full_pipeline_process_sample():
    # Trigger sample processing
    response = client.post("/api/process-sample/alpine-ridge")
    assert response.status_code == 200
    data = response.json()
    assert "job_id" in data
    job_id = data["job_id"]

    # Poll status until completed or timeout (max 30s)
    max_wait = 30
    start = time.time()
    result = None

    while time.time() - start < max_wait:
        status_res = client.get(f"/api/status/{job_id}")
        assert status_res.status_code == 200
        st = status_res.json()
        if st["status"] == "completed":
            result = st["result"]
            break
        elif st["status"] == "error":
            pytest.fail(f"Job failed with error: {st.get('error')}")
        time.sleep(0.5)

    assert result is not None, "Job did not complete in time"
    assert "geotiff_url" in result
    assert "mesh_obj_url" in result
    assert "colored_png_urls" in result
    assert "stats" in result
    assert result["stats"]["width"] > 0
    assert result["stats"]["height"] > 0
    assert result["stats"]["min_elevation"] >= 0
    assert result["stats"]["max_elevation"] <= 100
