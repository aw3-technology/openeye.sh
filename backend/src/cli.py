import logging
import multiprocessing as mp
import os

import dotenv
import json5
import typer

from runtime.config import load_mode_config

app = typer.Typer()


@app.command()
def modes(config_name: str) -> None:
    try:
        mode_config = load_mode_config(config_name)
        print("-" * 32)
        print(f"Mode System: {mode_config.name}")
        print(f"Default Mode: {mode_config.default_mode}")
        print(f"Manual Switching: {'Enabled' if mode_config.allow_manual_switching else 'Disabled'}")
        print()
        print("Available Modes:")
        print("-" * 50)
        for name, mode in mode_config.modes.items():
            is_default = " (DEFAULT)" if name == mode_config.default_mode else ""
            print(f"  {mode.display_name}{is_default}")
            print(f"  Name: {name}")
            print(f"  Description: {mode.description}")
            print(f"  Frequency: {mode.hertz} Hz")
            print()
        print("Transition Rules:")
        print("-" * 50)
        for rule in mode_config.transition_rules:
            from_display = (
                mode_config.modes[rule.from_mode].display_name
                if rule.from_mode != "*" and rule.from_mode in mode_config.modes
                else rule.from_mode if rule.from_mode != "*" else "Any Mode"
            )
            to_display = (
                mode_config.modes[rule.to_mode].display_name
                if rule.to_mode in mode_config.modes
                else rule.to_mode
            )
            print(f"  {from_display} -> {to_display}")
            print(f"  Type: {rule.transition_type.value}")
            if rule.trigger_keywords:
                print(f"  Keywords: {', '.join(rule.trigger_keywords)}")
            print()
    except FileNotFoundError:
        logging.error(f"Configuration file not found: {config_name}.json5")
        raise typer.Exit(1)
    except Exception as e:
        logging.error(f"Error loading mode configuration: {e}")
        raise typer.Exit(1)


@app.command()
def list_configs() -> None:
    config_dir = os.path.join(os.path.dirname(__file__), "../config")
    if not os.path.exists(config_dir):
        print("Configuration directory not found")
        return
    configs = []
    for filename in os.listdir(config_dir):
        if filename.endswith(".json5"):
            config_name = filename[:-6]
            config_path = os.path.join(config_dir, filename)
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    raw_config = json5.load(f)
                display_name = raw_config.get("name", config_name)
                configs.append((config_name, display_name))
            except Exception:
                configs.append((config_name, "Invalid config"))
    print("-" * 32)
    print("Configurations:")
    print("-" * 32)
    for config_name, display_name in sorted(configs):
        print(f"  {config_name} - {display_name}")


if __name__ == "__main__":
    if mp.get_start_method(allow_none=True) != "spawn":
        mp.set_start_method("spawn")
    dotenv.load_dotenv()
    app()
