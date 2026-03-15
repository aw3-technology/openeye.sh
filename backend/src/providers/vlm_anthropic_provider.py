"""Anthropic VLM provider — processes camera frames via Anthropic Claude vision API."""

import logging
import time
from typing import Callable, Optional

from anthropic import AsyncAnthropic

from .singleton import singleton
from .video_stream import VideoStream


@singleton
class VLMAnthropicProvider:
    def __init__(
        self,
        api_key: str,
        model: str = "claude-sonnet-4-6",
        fps: int = 5,
        camera_index: int = 0,
    ):
        self.running: bool = False
        self.model: str = model
        self.api_client: AsyncAnthropic = AsyncAnthropic(api_key=api_key)
        self.video_stream: VideoStream = VideoStream(
            frame_callback=self._process_frame,
            fps=fps,
            device_index=camera_index,
        )
        self.message_callback: Optional[Callable] = None

    async def _process_frame(self, frame: str):
        processing_start = time.perf_counter()
        try:
            response = await self.api_client.messages.create(
                model=self.model,
                max_tokens=300,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "What is the most interesting aspect in this series of images?",
                            },
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/jpeg",
                                    "data": frame,
                                },
                            },
                        ],
                    }
                ],
            )
            processing_latency = time.perf_counter() - processing_start
            logging.debug(f"Anthropic VLM processing latency: {processing_latency:.3f}s")
            if self.message_callback:
                self.message_callback(response)
        except Exception as e:
            logging.error(f"Anthropic VLM error processing frame: {e}")

    def register_message_callback(self, message_callback: Optional[Callable]):
        self.message_callback = message_callback

    def start(self):
        if self.running:
            return
        self.running = True
        self.video_stream.start()
        logging.info("Anthropic VLM provider started")

    def stop(self):
        self.running = False
        self.video_stream.stop()
