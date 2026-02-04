"""
Provider factory for OpenAI Agents SDK.
"""

import os
import logging
from typing import Optional

from .base import BaseAgentFactory
from .types import ProviderType

logger = logging.getLogger(__name__)


def _get_openai_factory() -> type:
    """Import OpenAI factory."""
    from .openai.factory import OpenAIAgentFactory
    return OpenAIAgentFactory


class ProviderFactory:
    """
    Factory for creating OpenAI agent factory.
    This version only supports OpenAI Agents SDK.
    """

    @classmethod
    def get_provider(cls) -> ProviderType:
        """
        Get the provider type (always OpenAI).

        Returns:
            ProviderType.OPENAI
        """
        return ProviderType.OPENAI

    @classmethod
    def create_factory(cls, provider: Optional[ProviderType] = None) -> BaseAgentFactory:
        """
        Create the OpenAI agent factory.

        Args:
            provider: Ignored, always uses OpenAI.

        Returns:
            OpenAI agent factory instance
        """
        factory_class = _get_openai_factory()
        factory = factory_class()
        logger.info("Created OpenAI agent factory")
        return factory

    @classmethod
    def is_provider_available(cls) -> bool:
        """Check if OpenAI is available (has API key)."""
        return bool(os.getenv("OPENAI_API_KEY"))


def get_default_factory() -> BaseAgentFactory:
    """
    Get the OpenAI agent factory.

    Returns:
        OpenAI agent factory instance
    """
    return ProviderFactory.create_factory()


def get_provider_type() -> ProviderType:
    """
    Get the provider type (always OpenAI).

    Returns:
        ProviderType.OPENAI
    """
    return ProviderType.OPENAI
