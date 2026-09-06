"""
Contract Deployment Registry
=============================
Prevents duplicate contract deployments by maintaining a registry
of deployed contracts per project and network.
"""

import json
import os
import time
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from datetime import datetime
import hashlib
import logging

logger = logging.getLogger(__name__)

# Registry storage path
REGISTRY_DIR = os.path.join(os.path.dirname(__file__), "..", "contract_registry")
os.makedirs(REGISTRY_DIR, exist_ok=True)


@dataclass
class DeployedContract:
    """Information about a deployed contract"""
    name: str
    address: str
    network: str
    chain_id: int
    game_type: Optional[str] = None
    job_id: Optional[str] = None
    explorer_url: Optional[str] = None
    abi: Optional[List[Dict]] = None
    deployed_at: float = field(default_factory=time.time)
    deployment_tx: Optional[str] = None
    verified: bool = False
    audited: bool = False
    
    # Content hash for deduplication
    code_hash: Optional[str] = None
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict) -> "DeployedContract":
        """Create from dictionary"""
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass 
class ProjectContracts:
    """All contracts for a project"""
    project_id: str
    contracts: Dict[str, DeployedContract] = field(default_factory=dict)  # key: network:name
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    
    def add_contract(self, contract: DeployedContract):
        """Add a contract to the registry"""
        key = f"{contract.network}:{contract.name}"
        self.contracts[key] = contract
        self.updated_at = time.time()
    
    def get_contract(self, network: str, name: str) -> Optional[DeployedContract]:
        """Get a contract by network and name"""
        key = f"{network}:{name}"
        return self.contracts.get(key)
    
    def get_by_game_type(self, game_type: str, network: str) -> Optional[DeployedContract]:
        """Get a contract by game type and network"""
        for contract in self.contracts.values():
            if contract.game_type == game_type and contract.network == network:
                return contract
        return None
    
    def get_all_for_network(self, network: str) -> List[DeployedContract]:
        """Get all contracts for a network"""
        return [c for c in self.contracts.values() if c.network == network]
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return {
            "project_id": self.project_id,
            "contracts": {k: v.to_dict() for k, v in self.contracts.items()},
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "ProjectContracts":
        """Create from dictionary"""
        pc = cls(
            project_id=data["project_id"],
            created_at=data.get("created_at", time.time()),
            updated_at=data.get("updated_at", time.time())
        )
        for key, contract_data in data.get("contracts", {}).items():
            pc.contracts[key] = DeployedContract.from_dict(contract_data)
        return pc


class ContractRegistry:
    """
    Registry for tracking deployed smart contracts.
    Prevents duplicate deployments and enables contract reuse.
    """
    
    def __init__(self):
        self._cache: Dict[str, ProjectContracts] = {}
    
    def _get_registry_path(self, project_id: str) -> str:
        """Get file path for project's contract registry"""
        return os.path.join(REGISTRY_DIR, f"{project_id}_contracts.json")
    
    def _load_project_contracts(self, project_id: str) -> ProjectContracts:
        """Load contracts for a project from disk"""
        if project_id in self._cache:
            return self._cache[project_id]
        
        path = self._get_registry_path(project_id)
        if os.path.exists(path):
            try:
                with open(path, 'r') as f:
                    data = json.load(f)
                    pc = ProjectContracts.from_dict(data)
                    self._cache[project_id] = pc
                    return pc
            except Exception as e:
                logger.error(f"Failed to load contract registry: {e}")
        
        # Create new registry for project
        pc = ProjectContracts(project_id=project_id)
        self._cache[project_id] = pc
        return pc
    
    def _save_project_contracts(self, project_id: str):
        """Save contracts for a project to disk"""
        if project_id not in self._cache:
            return
        
        path = self._get_registry_path(project_id)
        try:
            with open(path, 'w') as f:
                json.dump(self._cache[project_id].to_dict(), f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save contract registry: {e}")
    
    def register_contract(
        self,
        project_id: str,
        name: str,
        address: str,
        network: str,
        chain_id: int,
        game_type: Optional[str] = None,
        job_id: Optional[str] = None,
        explorer_url: Optional[str] = None,
        abi: Optional[List[Dict]] = None,
        deployment_tx: Optional[str] = None,
        code_hash: Optional[str] = None
    ) -> DeployedContract:
        """
        Register a newly deployed contract.
        
        Args:
            project_id: Project identifier
            name: Contract name
            address: Deployed contract address
            network: Network name (e.g., "basecamp", "sepolia")
            chain_id: Network chain ID
            game_type: Optional game type for game contracts
            job_id: Optional deployment job ID
            explorer_url: Optional block explorer URL
            abi: Optional contract ABI
            deployment_tx: Optional deployment transaction hash
            code_hash: Optional hash of contract code for deduplication
            
        Returns:
            DeployedContract object
        """
        pc = self._load_project_contracts(project_id)
        
        contract = DeployedContract(
            name=name,
            address=address,
            network=network,
            chain_id=chain_id,
            game_type=game_type,
            job_id=job_id,
            explorer_url=explorer_url,
            abi=abi,
            deployment_tx=deployment_tx,
            code_hash=code_hash
        )
        
        pc.add_contract(contract)
        self._save_project_contracts(project_id)
        
        logger.info(
            f"Registered contract {name} at {address} on {network} for project {project_id}"
        )
        
        return contract
    
    def get_contract(
        self,
        project_id: str,
        network: str,
        name: str
    ) -> Optional[DeployedContract]:
        """Get a specific contract by name and network"""
        pc = self._load_project_contracts(project_id)
        return pc.get_contract(network, name)
    
    def get_game_contract(
        self,
        project_id: str,
        game_type: str,
        network: str
    ) -> Optional[DeployedContract]:
        """
        Get an existing game contract.
        
        Args:
            project_id: Project identifier
            game_type: Game type (e.g., "coin-flip", "tic-tac-toe")
            network: Network name
            
        Returns:
            DeployedContract if found, None otherwise
        """
        pc = self._load_project_contracts(project_id)
        return pc.get_by_game_type(game_type, network)
    
    def has_contract(
        self,
        project_id: str,
        network: str,
        name: Optional[str] = None,
        game_type: Optional[str] = None
    ) -> bool:
        """
        Check if a contract already exists.
        
        Args:
            project_id: Project identifier
            network: Network name
            name: Contract name (optional)
            game_type: Game type (optional)
            
        Returns:
            True if contract exists
        """
        pc = self._load_project_contracts(project_id)
        
        if name:
            return pc.get_contract(network, name) is not None
        
        if game_type:
            return pc.get_by_game_type(game_type, network) is not None
        
        return len(pc.get_all_for_network(network)) > 0
    
    def get_all_contracts(self, project_id: str) -> List[DeployedContract]:
        """Get all contracts for a project"""
        pc = self._load_project_contracts(project_id)
        return list(pc.contracts.values())
    
    def mark_verified(self, project_id: str, network: str, name: str):
        """Mark a contract as verified on block explorer"""
        contract = self.get_contract(project_id, network, name)
        if contract:
            contract.verified = True
            self._save_project_contracts(project_id)
    
    def mark_audited(self, project_id: str, network: str, name: str):
        """Mark a contract as audited"""
        contract = self.get_contract(project_id, network, name)
        if contract:
            contract.audited = True
            self._save_project_contracts(project_id)
    
    def get_reusable_contract(
        self,
        game_type: str,
        network: str
    ) -> Optional[DeployedContract]:
        """
        Find a reusable contract across all projects.
        Useful for shared game contracts.
        
        Note: This is for read-only contracts or when
        contract ownership doesn't matter.
        """
        # Scan all registry files
        for filename in os.listdir(REGISTRY_DIR):
            if filename.endswith("_contracts.json"):
                path = os.path.join(REGISTRY_DIR, filename)
                try:
                    with open(path, 'r') as f:
                        data = json.load(f)
                        pc = ProjectContracts.from_dict(data)
                        contract = pc.get_by_game_type(game_type, network)
                        if contract and contract.verified:
                            return contract
                except Exception:
                    continue
        
        return None


# ============================================================================
# SMART DEPLOY FUNCTION
# ============================================================================

async def smart_deploy_game_contract(
    project_id: str,
    game_type: str,
    network: str = "basecamp",
    deploy_function = None,  # The actual deploy function
    force_new: bool = False
) -> Dict[str, Any]:
    """
    Smart contract deployment that checks for existing contracts first.
    
    Args:
        project_id: Project identifier
        game_type: Type of game contract
        network: Target network
        deploy_function: Async function that performs actual deployment
        force_new: Force new deployment even if contract exists
        
    Returns:
        Dict with contract details and whether it was reused
    """
    registry = ContractRegistry()
    
    # Check for existing contract
    if not force_new:
        existing = registry.get_game_contract(project_id, game_type, network)
        
        if existing:
            logger.info(
                f"Reusing existing {game_type} contract at {existing.address}"
            )
            return {
                "success": True,
                "reused": True,
                "contract_address": existing.address,
                "network": existing.network,
                "explorer_url": existing.explorer_url,
                "abi": existing.abi,
                "message": f"Reused existing {game_type} contract"
            }
    
    # No existing contract, deploy new one
    if deploy_function is None:
        return {
            "success": False,
            "error": "No deploy function provided"
        }
    
    try:
        result = await deploy_function(game_type, network)
        
        if result.get("success"):
            # Register the new contract
            contract = registry.register_contract(
                project_id=project_id,
                name=result.get("contract_name", f"{game_type}_contract"),
                address=result["contract_address"],
                network=network,
                chain_id=result.get("chain_id", 0),
                game_type=game_type,
                job_id=result.get("job_id"),
                explorer_url=result.get("explorer_url"),
                abi=result.get("abi")
            )
            
            return {
                "success": True,
                "reused": False,
                "contract_address": contract.address,
                "network": contract.network,
                "explorer_url": contract.explorer_url,
                "abi": contract.abi,
                "job_id": contract.job_id,
                "message": f"Deployed new {game_type} contract"
            }
        else:
            return result
            
    except Exception as e:
        logger.error(f"Contract deployment failed: {e}")
        return {
            "success": False,
            "error": str(e)
        }


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def compute_code_hash(solidity_code: str) -> str:
    """Compute hash of contract code for deduplication"""
    # Normalize whitespace and compute hash
    normalized = ' '.join(solidity_code.split())
    return hashlib.sha256(normalized.encode()).hexdigest()[:16]


def get_network_chain_id(network: str) -> int:
    """Get chain ID for network name"""
    chain_ids = {
        "mainnet": 1,
        "sepolia": 11155111,
        "basecamp": 123420111,  # Base Camp testnet
        "base": 8453,
        "polygon": 137,
        "arbitrum": 42161,
        "optimism": 10
    }
    return chain_ids.get(network.lower(), 0)


def format_explorer_url(network: str, address: str) -> str:
    """Format block explorer URL for contract"""
    explorers = {
        "mainnet": f"https://etherscan.io/address/{address}",
        "sepolia": f"https://sepolia.etherscan.io/address/{address}",
        "basecamp": f"https://basecamp.cloud.blockscout.com/address/{address}",
        "base": f"https://basescan.org/address/{address}",
        "polygon": f"https://polygonscan.com/address/{address}",
        "arbitrum": f"https://arbiscan.io/address/{address}"
    }
    return explorers.get(network.lower(), f"Unknown explorer for {network}")


# Global registry instance
contract_registry = ContractRegistry()
