"""SmolVLA adapter — vision-language-action model for robotic control."""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from PIL import Image

from openeye_ai.adapters.base import ModelAdapter


class Adapter(ModelAdapter):
    def __init__(self) -> None:
        self._policy = None

    def pull(self, model_dir: Path) -> None:
        """Download SmolVLA weights from HuggingFace."""
        from huggingface_hub import snapshot_download

        model_dir.mkdir(parents=True, exist_ok=True)
        snapshot_download(
            repo_id="HuggingFaceTB/SmolVLA-base",
            local_dir=str(model_dir),
        )

    def _do_load(self, model_dir: Path) -> None:
        import torch
        from lerobot.common.policies.smolvla.modeling_smolvla import SmolVLAPolicy

        self._policy = SmolVLAPolicy.from_pretrained(str(model_dir))
        self._policy.eval()
        if torch.cuda.is_available():
            self._policy = self._policy.cuda()

    def _do_predict(self, image: Image.Image) -> dict[str, Any]:
        import numpy as np
        import torch

        start = time.perf_counter()

        # Prepare observation for the policy
        img_array = np.array(image.resize((224, 224)))
        img_tensor = (
            torch.from_numpy(img_array).permute(2, 0, 1).float() / 255.0
        )
        img_tensor = img_tensor.unsqueeze(0)

        if torch.cuda.is_available():
            img_tensor = img_tensor.cuda()

        observation = {"observation.image": img_tensor}

        with torch.no_grad():
            action = self._policy.select_action(observation)

        action_vector = action.cpu().numpy().tolist()
        elapsed = (time.perf_counter() - start) * 1000

        return {
            "objects": [],
            "depth_map": None,
            "vla_action": action_vector,
            "inference_ms": round(elapsed, 2),
        }
