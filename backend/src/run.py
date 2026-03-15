import asyncio
import logging
import multiprocessing as mp
import os
import shutil
from typing import Optional, Tuple

import dotenv
import typer

from runtime.config import load_mode_config
from runtime.cortex import ModeCortexRuntime
from runtime.logging import setup_logging

app = typer.Typer()


def setup_config_file(config_name: Optional[str]) -> Tuple[str, str]:
    if config_name is None:
        runtime_config_path = os.path.join(
            os.path.dirname(__file__), "../config/memory", ".runtime.json5"
        )
        if not os.path.exists(runtime_config_path):
            logging.error(f"Default runtime configuration file not found: {runtime_config_path}")
            raise typer.Exit(1)
        config_name = ".runtime"
        config_path = os.path.join(
            os.path.dirname(__file__), "../config", config_name + ".json5"
        )
        shutil.copy2(runtime_config_path, config_path)
        logging.info("Using default runtime configuration from memory folder")
    else:
        config_path = os.path.join(
            os.path.dirname(__file__), "../config", config_name + ".json5"
        )
    return config_name, config_path


@app.command()
def start(
    config_name: Optional[str] = typer.Argument(
        None,
        help="The name of the configuration file (without extension) located in the config directory.",
    ),
    hot_reload: bool = typer.Option(True, help="Enable hot-reload of configuration files."),
    check_interval: int = typer.Option(60, help="Interval in seconds between config file checks."),
    log_level: str = typer.Option("INFO", help="The logging level to use."),
    log_to_file: bool = typer.Option(False, help="Whether to log output to a file."),
    grpc_port: int = typer.Option(50051, help="Port for gRPC perception streaming endpoint."),
) -> None:
    config_name, config_path = setup_config_file(config_name)
    setup_logging(config_name, log_level, log_to_file)

    try:
        mode_config = load_mode_config(config_name)
        runtime = ModeCortexRuntime(
            mode_config,
            config_name,
            hot_reload=hot_reload,
            check_interval=check_interval,
        )
        logging.info(f"Starting OpenEye with configuration: {config_name}")
        logging.info(f"Available modes: {list(mode_config.modes.keys())}")
        logging.info(f"Default mode: {mode_config.default_mode}")
        asyncio.run(runtime.run())
    except FileNotFoundError:
        logging.error(f"Configuration file not found: {config_path}")
        raise typer.Exit(1)
    except Exception as e:
        logging.error(f"Error loading configuration: {e}")
        raise typer.Exit(1)


if __name__ == "__main__":
    if mp.get_start_method(allow_none=True) != "spawn":
        mp.set_start_method("spawn")
    dotenv.load_dotenv()
    app()
