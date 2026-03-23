import logging
import os
import time


class YOLOFileLogger:
    """Handles JSONL file logging for YOLO detections."""

    def __init__(self, enabled: bool = False, max_file_size_bytes: int = 1024 * 1024):
        self.enabled = enabled
        self.max_file_size_bytes = max_file_size_bytes
        self.filename_current = None
        if self.enabled:
            self.filename_current = self.update_filename()

    def update_filename(self):
        dump_dir = "dump"
        os.makedirs(dump_dir, exist_ok=True)
        unix_ts = round(time.time(), 6)
        unix_ts = str(unix_ts).replace(".", "_")
        filename = f"{dump_dir}/yolo_{unix_ts}Z.jsonl"
        return filename

    def write_str_to_file(self, json_line: str):
        if not isinstance(json_line, str):
            raise ValueError("Provided json_line must be a json string.")
        if (
            self.filename_current is not None
            and os.path.exists(self.filename_current)
            and os.path.getsize(self.filename_current) > self.max_file_size_bytes
        ):
            self.filename_current = self.update_filename()
        if self.filename_current is not None:
            with open(self.filename_current, "a", encoding="utf-8") as f:
                f.write(json_line + "\n")
                f.flush()
