"""No-op stub for AvatarProvider. Original uses Zenoh pub/sub for avatar control."""

import logging


class AvatarProvider:
    def __init__(self):
        self.running = False

    def send_avatar_command(self, command: str):
        logging.debug(f"AvatarProvider stub: {command}")

    def start(self):
        self.running = True

    def stop(self):
        self.running = False
