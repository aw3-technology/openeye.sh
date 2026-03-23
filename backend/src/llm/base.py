import logging
import typing as T

from llm.config import LLMConfig
from llm.function_schemas import generate_function_schemas_from_actions
from providers.io_provider import IOProvider

R = T.TypeVar("R")


class LLM(T.Generic[R]):
    """
    Base class for Language Learning Model implementations.

    Generic interface for implementing LLM clients with type-safe responses.

    Type Parameters
    ---------------
    R
        Type specification for model responses.

    Parameters
    ----------
    config : LLMConfig
        Configuration settings for the LLM.
    available_actions : list, optional
        List of available actions for function calling.
    """

    def __init__(
        self,
        config: LLMConfig,
        available_actions: T.Optional[list] = None,
    ):
        # Set up the LLM configuration
        self._config = config

        # Set up available actions for function calling
        self._available_actions = available_actions or []
        self.function_schemas = []
        if self._available_actions:
            self.function_schemas = generate_function_schemas_from_actions(
                self._available_actions
            )
            logging.info(
                f"LLM initialized with {len(self.function_schemas)} function schemas"
            )

        # Set up the IO provider
        self.io_provider = IOProvider()

        # Enable state management by default
        self._skip_state_management: bool = False

    async def ask(
        self, prompt: str, messages: T.Optional[T.List[T.Dict[str, str]]] = None
    ) -> T.Optional[R]:
        """
        Send a prompt to the LLM and receive a typed response.

        Parameters
        ----------
        prompt : str
            Input text to send to the model
        messages : List[Dict[str, str]]
            List of message dictionaries to send to the model.

        Returns
        -------
        R
            Response matching the output_model type specification

        Raises
        ------
        NotImplementedError
            Must be implemented by subclasses
        """
        raise NotImplementedError
