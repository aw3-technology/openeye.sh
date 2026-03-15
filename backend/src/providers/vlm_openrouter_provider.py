"""OpenRouter VLM provider — processes camera frames via OpenRouter vision API."""

import logging
import time
from typing import Callable, Optional

from openai import AsyncOpenAI

from .singleton import singleton
from .video_stream import VideoStream


@singleton
class VLMOpenRouterProvider:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str = "qwen/qwen3-vl-235b:free",
        fps: int = 10,
        camera_index: int = 0,
        site_url: str = "https://perceptify.dev",
        site_name: str = "OpenEye",
    ):
        self.running: bool = False
        self.model: str = model
        self.api_client: AsyncOpenAI = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            default_headers={
                "HTTP-Referer": site_url,
                "X-Title": site_name,
            },
        )
        self.video_stream: VideoStream = VideoStream(
            frame_callback=self._process_frame,
            fps=fps,
            device_index=camera_index,
        )
        self.message_callback: Optional[Callable] = None

    async def _process_frame(self, frame: str):
        processing_start = time.perf_counter()
        try:
            response = await self.api_client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "What is the most interesting aspect in this series of images?",
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{frame}",
                                    "detail": "low",
                                },
                            },
                        ],
                    }
                ],
                max_tokens=300,
            )
            processing_latency = time.perf_counter() - processing_start
            logging.debug(f"OpenRouter VLM processing latency: {processing_latency:.3f}s")
            if self.message_callback:
                self.message_callback(response)
        except Exception as e:
            logging.error(f"OpenRouter VLM error processing frame: {e}")

    def register_message_callback(self, message_callback: Optional[Callable]):
        self.message_callback = message_callback

    def start(self):
        if self.running:
            return
        self.running = True
        self.video_stream.start()
        logging.info("OpenRouter VLM provider started")

    def stop(self):
        self.running = False
        self.video_stream.stop()
