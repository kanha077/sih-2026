"""train_geofusion.py - Trains GeoFusionNet (DepthWizard SIH26175).

Replace fake_load_fn with real Potsdam/Vaihingen/US3D patch loading.
"""

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import numpy as np

from geofusion_model import GeoFusionNet


class GeoFusionDataset(Dataset):
    def __init__(self, patch_ids, load_fn):
        self.patch_ids = patch_ids
        self.load_fn = load_fn  # patch_id -> (rel_depth, srtm_sim, gt_dsm) as HxW arrays

    def __len__(self):
        return len(self.patch_ids)

    def __getitem__(self, idx):
        rel_depth, srtm_sim, gt_dsm = self.load_fn(self.patch_ids[idx])
        rel_depth = torch.from_numpy(rel_depth).float().unsqueeze(0)
        srtm_sim = torch.from_numpy(srtm_sim).float().unsqueeze(0)
        gt_dsm = torch.from_numpy(gt_dsm).float().unsqueeze(0)
        return rel_depth, srtm_sim, gt_dsm


def simulate_srtm_from_gt(gt_dsm: np.ndarray, downsample_factor: int = 12) -> np.ndarray:
    h, w = gt_dsm.shape
    small_h, small_w = h // downsample_factor, w // downsample_factor
    if small_h == 0 or small_w == 0:
        raise ValueError(f"Patch too small ({h}x{w}) for downsample_factor={downsample_factor}.")

    trimmed = gt_dsm[: small_h * downsample_factor, : small_w * downsample_factor]
    small = trimmed.reshape(small_h, downsample_factor, small_w, downsample_factor).mean(axis=(1, 3))
    up = np.repeat(np.repeat(small, downsample_factor, axis=0), downsample_factor, axis=1)

    out = np.zeros_like(gt_dsm)
    out[: up.shape[0], : up.shape[1]] = up
    if up.shape[0] < h:
        out[up.shape[0]:, :] = out[up.shape[0] - 1, :]
    if up.shape[1] < w:
        out[:, up.shape[1]:] = out[:, up.shape[1] - 1: up.shape[1]]
    return out


def train(model, dataloader, val_dataloader=None, epochs=30, lr=1e-4,
          device="cpu", checkpoint_path="geofusion_weights.pt"):
    model.to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)
    criterion = nn.L1Loss()
    best_loss = float("inf")

    for epoch in range(epochs):
        model.train()
        running_loss = 0.0
        for rel_depth, srtm_sim, gt_dsm in dataloader:
            rel_depth, srtm_sim, gt_dsm = rel_depth.to(device), srtm_sim.to(device), gt_dsm.to(device)
            optimizer.zero_grad()
            pred_dsm = model(rel_depth, srtm_sim)
            loss = criterion(pred_dsm, gt_dsm)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * rel_depth.size(0)

        train_loss = running_loss / len(dataloader.dataset)
        log = f"Epoch {epoch+1}/{epochs} | Train MAE: {train_loss:.4f}"
        monitor_loss = train_loss

        if val_dataloader is not None:
            model.eval()
            val_loss = 0.0
            with torch.no_grad():
                for rel_depth, srtm_sim, gt_dsm in val_dataloader:
                    rel_depth, srtm_sim, gt_dsm = rel_depth.to(device), srtm_sim.to(device), gt_dsm.to(device)
                    pred_dsm = model(rel_depth, srtm_sim)
                    val_loss += criterion(pred_dsm, gt_dsm).item() * rel_depth.size(0)
            val_loss /= len(val_dataloader.dataset)
            scheduler.step(val_loss)
            log += f" | Val MAE: {val_loss:.4f}"
            monitor_loss = val_loss

        print(log)

        if monitor_loss < best_loss:
            best_loss = monitor_loss
            torch.save(model.state_dict(), checkpoint_path)

    return model


if __name__ == "__main__":
    def fake_load_fn(patch_id):
        gt = np.random.rand(256, 256).astype(np.float32) * 50
        srtm_sim = simulate_srtm_from_gt(gt)
        rel_depth = (gt - gt.min()) / (gt.max() - gt.min() + 1e-6)
        return rel_depth, srtm_sim, gt

    dataset = GeoFusionDataset(patch_ids=list(range(20)), load_fn=fake_load_fn)
    loader = DataLoader(dataset, batch_size=4, shuffle=True)

    model = GeoFusionNet()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    trained_model = train(model, loader, epochs=3, device=device, checkpoint_path="geofusion_weights_demo.pt")
    print("Smoke test complete.")
