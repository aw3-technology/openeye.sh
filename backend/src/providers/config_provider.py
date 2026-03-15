"""No-op stub for ConfigProvider. Original uses Zenoh for remote config updates."""

import logging


class ConfigProvider:
    def __init__(self):
        self.running = False

    def start(self):
        self.running = True
        logging.debug("ConfigProvider stub started")

    def stop(self):
        self.running = False
        logging.debug("ConfigProvider stub stopped")
