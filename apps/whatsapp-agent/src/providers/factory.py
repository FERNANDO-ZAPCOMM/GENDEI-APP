"""
Provider factory for selecting AI provider at runtime.
"""

import os
import logging
from typing import Dict, Type, Optional

from .base import BaseAgentFactory
from .types import ProviderType

logger = logging.getLogger(__name__)

# Lazy imports to avoid loading unused providers
_factory_classes: Dict[ProviderType, Type[BaseAgentFactory]] = {}


def _get_openai_factory() -> Type[BaseAgentFactory]:
    """Lazy import OpenAI factory."""
    from .openai.factory import OpenAIAgentFactory
    return OpenAIAgentFactory


def _get_anthropic_factory() -> Type[BaseAgentFactory]:
    """Lazy import Anthropic factory."""
    from .anthropic.factory import AnthropicAgentFactory
    return AnthropicAgentFactory


class ProviderFactory:
    """
    Factory for creating provider-specific agent factories.
    Selects provider based on AI_PROVIDER environment variable.
    """

    _factory_loaders = {
        ProviderType.OPENAI: _get_openai_factory,
        ProviderType.ANTHROPIC: _get_anthropic_factory,
    }

    @classmethod
    def get_provider(cls) -> ProviderType:
        """
        Get configured provider from environment.

        Returns:
            ProviderType based on AI_PROVIDER env var (defaults to openai)

        Raises:
            ValueError: If AI_PROVIDER value is not supported
        """
        provider_str = os.getenv("AI_PROVIDER", "openai").lower().strip()

        try:
            provider = ProviderType(provider_str)
            logger.debug(f"Using AI provider: {provider.value}")
            return provider
        except ValueError:
            supported = [p.value for p in ProviderType]
            raise ValueError(
                f"Unknown AI_PROVIDER: '{provider_str}'. "
                f"Supported providers: {supported}"
            )

    @classmethod
    def create_factory(cls, provider: Optional[ProviderType] = None) -> BaseAgentFactory:
        """
        Create an agent factory for the specified provider.

        Args:
            provider: Provider type. Defaults to AI_PROVIDER env var.

        Returns:
            Provider-specific agent factory instance

        Raises:
            ValueError: If provider is not supported
        """
        if provider is None:
            provider = cls.get_provider()

        # Get factory class (lazy load)
        factory_loader = cls._factory_loaders.get(provider)
        if factory_loader is None:
            raise ValueError(f"No factory registered for provider: {provider.value}")

        factory_class = factory_loader()
        factory = factory_class()

        logger.info(f"Created agent factory for provider: {provider.value}")
        return factory

    @classmethod
    def register_provider(
        cls,
        provider: ProviderType,
        factory_loader: callable
    ) -> None:
        """
        Register a new provider factory loader.

        Args:
            provider: Provider type to register
            factory_loader: Callable that returns the factory class
        """
        cls._factory_loaders[provider] = factory_loader
        logger.info(f"Registered provider: {provider.value}")

    @classmethod
    def list_providers(cls) -> list:
        """List all registered providers."""
        return list(cls._factory_loaders.keys())

    @classmethod
    def is_provider_available(cls, provider: ProviderType) -> bool:
        """Check if a provider is available (has required API key)."""
        if provider == ProviderType.OPENAI:
            return bool(os.getenv("OPENAI_API_KEY"))
        elif provider == ProviderType.ANTHROPIC:
            return bool(os.getenv("ANTHROPIC_API_KEY"))
        return False


def get_default_factory() -> BaseAgentFactory:
    """
    Convenience function to get the default factory.

    Returns:
        Agent factory based on AI_PROVIDER environment variable
    """
    return ProviderFactory.create_factory()


def get_provider_type() -> ProviderType:
    """
    Convenience function to get the current provider type.

    Returns:
        ProviderType based on AI_PROVIDER environment variable
    """
    return ProviderFactory.get_provider()
