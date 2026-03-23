import importlib
import inspect
import logging
import os
import re
import typing as T

from llm.base import LLM
from llm.config import LLMConfig


def find_module_with_class(class_name: str) -> T.Optional[str]:
    """
    Find which module file contains the specified class name.

    Parameters
    ----------
    class_name : str
        The class name to search for

    Returns
    -------
    str or None
        The module name (without .py) that contains the class, or None if not found
    """
    plugins_dir = os.path.join(os.path.dirname(__file__), "plugins")

    if not os.path.exists(plugins_dir):
        return None

    plugin_files = [f for f in os.listdir(plugins_dir) if f.endswith(".py")]

    for plugin_file in plugin_files:
        file_path = os.path.join(plugins_dir, plugin_file)

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            pattern = rf"^class\s+{re.escape(class_name)}\s*\([^)]*LLM[^)]*\)\s*:"

            if re.search(pattern, content, re.MULTILINE):
                return plugin_file[:-3]

        except Exception as e:
            logging.warning(f"Could not read {plugin_file}: {e}")
            continue

    return None


def get_llm_class(class_name: str) -> T.Type[LLM]:
    """
    Get an LLM class by its class name.

    Parameters
    ----------
    class_name : str
        The exact class name

    Returns
    -------
    T.Type[LLM]
        The LLM class
    """
    module_name = find_module_with_class(class_name)

    if module_name is None:
        raise ValueError(f"Class '{class_name}' not found in any LLM plugin module")

    try:
        module = importlib.import_module(f"llm.plugins.{module_name}")
        llm_class = getattr(module, class_name)

        if not (
            inspect.isclass(llm_class)
            and issubclass(llm_class, LLM)
            and llm_class != LLM
        ):
            raise ValueError(f"'{class_name}' is not a valid LLM subclass")

        logging.debug(f"Got LLM class {class_name} from {module_name}.py")
        return llm_class

    except ImportError as e:
        raise ValueError(f"Could not import LLM module '{module_name}': {e}")
    except AttributeError:
        raise ValueError(
            f"Class '{class_name}' not found in LLM module '{module_name}'"
        )


def load_llm(
    llm_config: T.Dict[str, T.Any],
    available_actions: T.Optional[list] = None,
) -> LLM:
    """
    Load an LLM instance with its configuration.

    Parameters
    ----------
    llm_config : dict
        Configuration dictionary
    available_actions : list, optional
        List of available actions for function calling

    Returns
    -------
    LLM
        The instantiated LLM
    """
    class_name = llm_config["type"]
    module_name = find_module_with_class(class_name)

    if module_name is None:
        raise ValueError(f"Class '{class_name}' not found in LLM plugin module")

    try:
        module = importlib.import_module(f"llm.plugins.{module_name}")
        llm_class = getattr(module, class_name)

        if not (
            inspect.isclass(llm_class)
            and issubclass(llm_class, LLM)
            and llm_class != LLM
        ):
            raise ValueError(f"'{class_name}' is not a valid LLM subclass")

        config_class = None
        for obj in module.__dict__.values():
            if (
                isinstance(obj, type)
                and issubclass(obj, LLMConfig)
                and obj != LLMConfig
            ):
                config_class = obj

        config_dict = llm_config.get("config", {})
        if config_class is not None:
            config = config_class(
                **(config_dict if isinstance(config_dict, dict) else {})
            )
        else:
            config = LLMConfig(**(config_dict if isinstance(config_dict, dict) else {}))

        logging.debug(f"Loaded LLM {class_name} from {module_name}.py")
        return llm_class(config=config, available_actions=available_actions)

    except ImportError as e:
        raise ValueError(f"Could not import LLM module '{module_name}': {e}")
    except AttributeError:
        raise ValueError(
            f"Class '{class_name}' not found in LLM module '{module_name}'"
        )
