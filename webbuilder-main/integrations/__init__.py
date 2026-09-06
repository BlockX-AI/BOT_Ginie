"""
Integrations Package
Contains external service integrations for DApp creation
"""

from .evi_client import EVIClient, get_network_info, get_explorer_url, NETWORK_CONFIG, GAME_TEMPLATES
from .dapp_orchestrator import DAppOrchestrator, dapp_orchestrator

# Backward compatibility alias
AcademicChainClient = EVIClient

__all__ = [
    "EVIClient",
    "AcademicChainClient",  # Deprecated alias for EVIClient
    "DAppOrchestrator",
    "dapp_orchestrator",
    "get_network_info",
    "get_explorer_url",
    "NETWORK_CONFIG",
    "GAME_TEMPLATES"
]
