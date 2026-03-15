"""RemoteVisionClient — calls a remote OpenEye server via gRPC or REST."""

from __future__ import annotations

import base64
import logging
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

class RemoteVisionClient:
    """Client for :class:`RobotVision` in ``REMOTE`` mode.

    Connects to a remote OpenEye gRPC or REST server and proxies
    :meth:`perceive` calls.

    Parameters
    ----------
    server_url : str, optional
        REST base URL (e.g. ``http://host:8000``).
    grpc_address : str, optional
        gRPC address (e.g. ``host:50051``).
    """

    def __init__(
        self,
        server_url: str | None = None,
        grpc_address: str | None = None,
    ) -> None:
        self._server_url = server_url
        self._grpc_address = grpc_address
        self._grpc_channel: Any = None
        self._grpc_stub: Any = None
        self._http_client: Any = None

    # ------------------------------------------------------------------ #
    #  Connection lifecycle
    # ------------------------------------------------------------------ #

    def connect(self) -> None:
        """Establish connection to the remote server."""
        if self._grpc_address:
            self._connect_grpc()
        elif self._server_url:
            self._connect_rest()
        else:
            raise ValueError(
                "RemoteVisionClient requires either server_url or grpc_address"
            )

    def close(self) -> None:
        """Close the remote connection."""
        if self._grpc_channel is not None:
            self._grpc_channel.close()
            self._grpc_channel = None
            self._grpc_stub = None
        if self._http_client is not None:
            self._http_client.close()
            self._http_client = None

    # ------------------------------------------------------------------ #
    #  Perception
    # ------------------------------------------------------------------ #

    def perceive(
        self,
        frame: np.ndarray,
        depth_map: np.ndarray | None = None,
    ) -> Any:
        """Send a frame to the remote server and return a PerceptionFrame."""
        if self._grpc_stub is not None:
            return self._perceive_grpc(frame, depth_map)
        if self._http_client is not None:
            return self._perceive_rest(frame, depth_map)
        raise RuntimeError("Not connected. Call connect() first.")

    # ------------------------------------------------------------------ #
    #  gRPC transport
    # ------------------------------------------------------------------ #

    def _connect_grpc(self) -> None:
        try:
            import grpc

            from perception_grpc import openeye_perception_pb2_grpc as stubs
        except ImportError as exc:
            raise ImportError(
                "gRPC dependencies not installed. "
                "Install with: pip install openeye-ai[robotics]"
            ) from exc

        self._grpc_channel = grpc.insecure_channel(self._grpc_address)
        self._grpc_stub = stubs.RobotVisionServiceStub(self._grpc_channel)
        logger.info("Connected to gRPC server at %s", self._grpc_address)

    def _perceive_grpc(
        self,
        frame: np.ndarray,
        depth_map: np.ndarray | None,
    ) -> Any:
        from perception_grpc import openeye_perception_pb2 as pb
        from perception_grpc.converters import proto_to_perception_frame

        h, w = frame.shape[:2]
        req = pb.PerceiveRequest(
            frame_data=frame.tobytes(),
            width=w,
            height=h,
            channels=frame.shape[2] if frame.ndim == 3 else 1,
        )
        if depth_map is not None:
            req.depth_data = depth_map.astype(np.float32).tobytes()
            req.depth_width = depth_map.shape[1]
            req.depth_height = depth_map.shape[0]

        response = self._grpc_stub.Perceive(req)
        return proto_to_perception_frame(response)

    # ------------------------------------------------------------------ #
    #  REST transport
    # ------------------------------------------------------------------ #

    def _connect_rest(self) -> None:
        import httpx

        self._http_client = httpx.Client(
            base_url=self._server_url,
            timeout=30.0,
        )
        logger.info("Connected to REST server at %s", self._server_url)

    def _perceive_rest(
        self,
        frame: np.ndarray,
        depth_map: np.ndarray | None,
    ) -> Any:
        from openeye_ai.robotics._pipeline_bridge import ensure_backend_path

        ensure_backend_path()
        from perception.models import PerceptionFrame

        import io

        from PIL import Image

        img = Image.fromarray(frame)
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        buf.seek(0)

        files = {"file": ("frame.jpg", buf, "image/jpeg")}
        data: dict[str, Any] = {}
        if depth_map is not None:
            data["depth"] = base64.b64encode(
                depth_map.astype(np.float32).tobytes()
            ).decode()

        resp = self._http_client.post("/predict", files=files, data=data)
        resp.raise_for_status()
        return PerceptionFrame.model_validate(resp.json())
