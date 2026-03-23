import typing as T

from pydantic import BaseModel, ConfigDict, Field


class LLMConfig(BaseModel):
    """
    Configuration class for Language Learning Models.

    Parameters
    ----------
    base_url : str, optional
        Base URL for the LLM API endpoint
    api_key : str, optional
        Authentication key for the LLM service
    model : str, optional
        Name of the LLM model to use
    history_length : int, optional
        Number of interactions to store in the history buffer
    extra_params : dict, optional
        Additional parameters for the LLM API request
    """

    model_config = ConfigDict(extra="allow")

    base_url: T.Optional[str] = Field(
        default=None, description="Base URL for the LLM API endpoint"
    )
    api_key: T.Optional[str] = Field(
        default=None, description="Authentication key for the LLM service"
    )
    model: T.Optional[str] = Field(
        default=None, description="Name of the LLM model to use"
    )
    timeout: T.Optional[int] = Field(
        default=10, description="Request timeout in seconds"
    )
    agent_name: T.Optional[str] = Field(
        default="IRIS", description="Name of the agent identity"
    )
    history_length: T.Optional[int] = Field(
        default=0, description="Number of past interactions to keep in context"
    )
    extra_params: T.Dict[str, T.Any] = Field(default_factory=dict)

    def __getitem__(self, item: str) -> T.Any:
        """
        Get an item from the configuration.

        Parameters
        ----------
        item : str
            The key to retrieve from the configuration

        Returns
        -------
        T.Any
            The value associated with the key in the configuration
        """
        try:
            return getattr(self, item)
        except AttributeError:
            return self.extra_params[item]

    def __setitem__(self, key: str, value: T.Any) -> None:
        """
        Set an item in the configuration.

        Parameters
        ----------
        key : str
            The key to set in the configuration
        value : T.Any
            The value to associate with the key in the configuration
        """
        if hasattr(self, key):
            setattr(self, key, value)
        else:
            self.extra_params[key] = value
