"""geofusion_model.py - GeoFusion Algorithm model (DepthWizard SIH26175)."""

import torch
import torch.nn as nn


class ConvBlock(nn.Module):
    def __init__(self, in_ch: int, out_ch: int):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        return self.block(x)


class GeoFusionNet(nn.Module):
    """U-Net that fuses relative depth + SRTM prior into a calibrated DSM (residual learning)."""

    def __init__(self, in_channels: int = 2, base_channels: int = 32):
        super().__init__()
        c = base_channels

        self.enc1 = ConvBlock(in_channels, c)
        self.pool1 = nn.MaxPool2d(2)
        self.enc2 = ConvBlock(c, c * 2)
        self.pool2 = nn.MaxPool2d(2)
        self.enc3 = ConvBlock(c * 2, c * 4)
        self.pool3 = nn.MaxPool2d(2)

        self.bottleneck = ConvBlock(c * 4, c * 8)

        self.up3 = nn.ConvTranspose2d(c * 8, c * 4, 2, stride=2)
        self.dec3 = ConvBlock(c * 8, c * 4)
        self.up2 = nn.ConvTranspose2d(c * 4, c * 2, 2, stride=2)
        self.dec2 = ConvBlock(c * 4, c * 2)
        self.up1 = nn.ConvTranspose2d(c * 2, c, 2, stride=2)
        self.dec1 = ConvBlock(c * 2, c)

        self.out_head = nn.Conv2d(c, 1, kernel_size=1)

    def forward(self, relative_depth: torch.Tensor, srtm_prior: torch.Tensor) -> torch.Tensor:
        if relative_depth.shape != srtm_prior.shape:
            raise ValueError("relative_depth and srtm_prior must have the same shape.")
        if relative_depth.shape[-1] % 8 or relative_depth.shape[-2] % 8:
            raise ValueError("H and W must be divisible by 8.")

        x = torch.cat([relative_depth, srtm_prior], dim=1)

        e1 = self.enc1(x)
        e2 = self.enc2(self.pool1(e1))
        e3 = self.enc3(self.pool2(e2))
        b = self.bottleneck(self.pool3(e3))

        d3 = self.dec3(torch.cat([self.up3(b), e3], dim=1))
        d2 = self.dec2(torch.cat([self.up2(d3), e2], dim=1))
        d1 = self.dec1(torch.cat([self.up1(d2), e1], dim=1))

        residual_correction = self.out_head(d1)
        return srtm_prior + residual_correction
