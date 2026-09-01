import os
import time
from unittest.mock import patch, MagicMock
import pytest
import numpy as np
import requests
from fastapi.testclient import TestClient

from app.main import app
from app.services.calibration_service import SRTMCalibrator

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
    assert samples[0]["is_verified_location"] is False


def test_upload_invalid_file_type():
    # Attempt to upload a text file masquerading as image
    fake_content = b"Not a real image file content"
    files = {"file": ("malicious.txt", fake_content, "text/plain")}
    response = client.post("/api/upload", files=files)
    assert response.status_code == 400


def test_srtm_calibrator_sparse_grid_interpolation(tmp_path):
    calibrator = SRTMCalibrator(grid_size=4, cache_dir=str(tmp_path))

    # Mock sparse grid fetching to return a 4x4 array of elevation values (100 to 400m)
    mock_sparse = np.linspace(100, 400, 16, dtype=np.float32).reshape((4, 4))
    with patch.object(calibrator, "_fetch_sparse_reference_grid", return_value=mock_sparse):
        # Create a 20x20 relative elevation array (range 0 to 100)
        rel_depth = np.linspace(0, 100, 400, dtype=np.float32).reshape((20, 20))

        res = calibrator.calibrate(rel_depth, origin_lat=46.55, origin_lon=8.56, pixel_scale=0.0001)

        assert res["calibrated"] is True
        assert res["calibrated_data"].shape == (20, 20)
        assert res["alpha"] is not None
        assert res["beta"] is not None
        assert res["rmse"] is not None
        assert res["error"] is None


def test_srtm_cache_hash_keying(tmp_path):
    calibrator = SRTMCalibrator(grid_size=4, cache_dir=str(tmp_path))

    key1 = calibrator._generate_cache_key(46.55, 8.56, 0.0001, 640, 480)
    key2 = calibrator._generate_cache_key(46.55, 8.56, 0.0002, 640, 480)
    key3 = calibrator._generate_cache_key(46.55, 8.56, 0.0001, 640, 480)

    # Different pixel scale should produce distinct MD5 hash keys to prevent stale collisions
    assert key1 != key2
    assert key1 == key3

    # Test cache saving and loading
    mock_grid = np.ones((4, 4), dtype=np.float32) * 250.0
    calibrator._save_to_cache(key1, mock_grid, 46.55, 8.56, 0.0001, 640, 480)

    loaded_grid = calibrator._load_from_cache(key1)
    assert loaded_grid is not None
    assert loaded_grid.shape == (4, 4)
    assert np.allclose(loaded_grid, mock_grid)


def test_srtm_calibrator_timeout_fallback(tmp_path):
    calibrator = SRTMCalibrator(grid_size=4, cache_dir=str(tmp_path), timeout_seconds=0.1)

    with patch("requests.post", side_effect=requests.exceptions.Timeout("API timeout test")):
        rel_depth = np.zeros((10, 10), dtype=np.float32)
        res = calibrator.calibrate(rel_depth, origin_lat=46.55, origin_lon=8.56)

        # Timeout should trigger graceful fallback without crashing
        assert res["calibrated"] is False
        assert np.array_equal(res["calibrated_data"], rel_depth)
        assert res["alpha"] is None
        assert "timeout" in res["error"].lower()


def test_full_pipeline_process_sample():
    # Trigger sample processing with mocked calibration to ensure deterministic test
    mock_calib_return = {
        "calibrated_data": np.ones((640, 640), dtype=np.float32) * 500.0,
        "calibrated": True,
        "alpha": 4.5,
        "beta": 150.0,
        "rmse": 1.25,
        "mae": 0.95,
        "provider": "open-elevation",
        "error": None,
    }

    with patch.object(SRTMCalibrator, "calibrate", return_value=mock_calib_return):
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
        assert result["elevation_mode"] == "calibrated"
        assert result["rmse_meters"] == 1.25
        assert result["is_verified_location"] is False
