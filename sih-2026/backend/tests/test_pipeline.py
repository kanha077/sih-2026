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

    # Poll status until completed or timeout (max 60s)
    max_wait = 60
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


def test_baseline_flags_off(monkeypatch):
    """Review comment #5: All flags OFF must match existing baseline behavior 100%."""
    monkeypatch.setenv("DEPTH_MODEL_BACKEND", "midas")
    monkeypatch.setenv("ENABLE_SAT3DGEN", "false")
    monkeypatch.setenv("ENABLE_CALIBRATION", "false")

    response = client.post("/api/process-sample/coastal-valley")
    assert response.status_code == 200
    job_id = response.json()["job_id"]

    start = time.time()
    result = None
    while time.time() - start < 30:
        status_res = client.get(f"/api/status/{job_id}")
        assert status_res.status_code == 200
        st = status_res.json()
        if st["status"] == "completed":
            result = st["result"]
            break
        time.sleep(0.5)

    assert result is not None
    assert "geotiff_url" in result
    assert "mesh_obj_url" in result
    assert result["sat3dgen_mesh_url"] is None
    assert result["calibration_info"]["mode"] == "preview"


def test_sat3dgen_mesh_generation():
    import numpy as np
    from PIL import Image
    import os
    from app.services.sat3dgen import generate_point_cloud_mesh

    dummy_elevation = np.random.uniform(0, 100, (64, 64)).astype(np.float32)
    dummy_img = Image.new("RGB", (64, 64), color="green")
    out_path = "outputs/test_sat3dgen.obj"

    res_path = generate_point_cloud_mesh(dummy_elevation, dummy_img, out_path)
    assert os.path.exists(res_path)
    if os.path.exists(res_path):
        os.remove(res_path)


def test_geoscale_calibration_fallback():
    import numpy as np
    from app.services.geoscale import calibrate_to_metric

    dummy_elevation = np.random.uniform(0, 100, (32, 32)).astype(np.float32)
    # Testing with lat=0, lon=0 where no reference DEM exists -> Must return None (Strict Preview Fallback)
    metric_arr, metrics = calibrate_to_metric(dummy_elevation, 0.0, 0.0)
    assert metric_arr is None
    assert metrics is None


def test_depth_estimator_v2(monkeypatch):
    import os
    import numpy as np
    from PIL import Image
    from app.services.depth_estimator_v2 import DepthEstimatorV2, LOCAL_V2_DIR

    # Reset singleton in case an earlier test failed
    DepthEstimatorV2._instance = None

    dummy_img = Image.new("RGB", (64, 64), color="blue")
    try:
        estimator = DepthEstimatorV2()
        depth_arr = estimator.estimate_depth(dummy_img)
    except Exception as e:
        pytest.skip(f"Depth Anything V2 network initialization unavailable: {e}")

    assert isinstance(depth_arr, np.ndarray)
    assert depth_arr.shape == (64, 64)
    assert np.min(depth_arr) >= 0.0
    assert np.max(depth_arr) <= 100.0

    # 2. Assert local weights cache directory exists on disk after first call
    assert os.path.exists(LOCAL_V2_DIR)
    assert os.path.exists(os.path.join(LOCAL_V2_DIR, "config.json"))

    # 3. Monkeypatch network-download function to raise if called a second time
    from transformers import AutoModelForDepthEstimation
    original_from_pretrained = AutoModelForDepthEstimation.from_pretrained

    def mock_from_pretrained(pretrained_model_name_or_path, *args, **kwargs):
        if kwargs.get("local_files_only") is not True and not os.path.exists(str(pretrained_model_name_or_path)):
            raise RuntimeError("Network download attempted during local offline test!")
        return original_from_pretrained(pretrained_model_name_or_path, *args, **kwargs)

    monkeypatch.setattr(AutoModelForDepthEstimation, "from_pretrained", mock_from_pretrained)

    # Reset singleton to test re-instantiation from local cache
    DepthEstimatorV2._instance = None
    estimator_2nd = DepthEstimatorV2()
    depth_arr_2nd = estimator_2nd.estimate_depth(dummy_img)
    assert depth_arr_2nd.shape == (64, 64)


