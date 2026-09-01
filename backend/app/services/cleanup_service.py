import os
import time
import shutil
import logging

logger = logging.getLogger(__name__)


def purge_old_artifacts(
    uploads_dir: str,
    outputs_dir: str,
    max_age_seconds: int = 7200,  # 2 hours
    max_jobs_retained: int = 100,
):
    """
    Periodically clean up temporary upload/output artifacts older than max_age_seconds
    or ensure storage does not exceed max_jobs_retained.
    """
    logger.info("Running storage cleanup (retention: 2h, max_jobs: 100)...")
    now = time.time()
    total_cleaned = 0

    for base_dir in [uploads_dir, outputs_dir]:
        if not os.path.exists(base_dir):
            continue

        entries = []
        for item in os.listdir(base_dir):
            item_path = os.path.join(base_dir, item)
            if os.path.isdir(item_path):
                mtime = os.path.getmtime(item_path)
                entries.append((item_path, mtime))

        # Sort newest to oldest
        entries.sort(key=lambda x: x[1], reverse=True)

        for idx, (dir_path, mtime) in enumerate(entries):
            age = now - mtime
            if age > max_age_seconds or idx >= max_jobs_retained:
                try:
                    shutil.rmtree(dir_path, ignore_errors=True)
                    total_cleaned += 1
                except Exception as e:
                    logger.warning(f"Could not remove {dir_path}: {e}")

    logger.info(f"Cleanup finished. Total items removed: {total_cleaned}")
