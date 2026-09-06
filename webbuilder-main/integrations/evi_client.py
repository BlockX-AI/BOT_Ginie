"""
EVI Client - Smart Contract Generation, Deployment, Audit & Compliance
Based on the reference acv-test-logic.js implementation

Endpoints:
- /api/ai/pipeline - Generate, compile, deploy contract
- /api/ai/fix - Fix compilation errors and redeploy
- /api/job/:id/status - Get job status
- /api/job/:id/logs - Get job logs
- /api/job/:id/logs/stream - SSE log streaming
- /api/artifacts - Download artifacts (sources, ABIs, scripts)
- /api/verify/byJob - Verify contract on explorer
- /api/audit/byJob - Run security audit
- /api/audit/orchestrate - Full audit pipeline
- /api/compliance/byJob - Run compliance check
- /api/compliance/orchestrate - Full compliance pipeline
- /api/artifacts/audit - Get audit report
- /api/artifacts/compliance - Get compliance report
"""

import httpx
import asyncio
import json
import os
import logging
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

# =============================================================================
# Configuration
# =============================================================================

API_BASE_URL = os.getenv("EVI_API_BASE_URL", "http://localhost:3000")
DEFAULT_NETWORK = os.getenv("EVI_NETWORK", "botchain")
DEFAULT_MAX_ITERS = int(os.getenv("EVI_MAX_ITERS", "11"))


class JobState(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


# =============================================================================
# Network Configuration
# =============================================================================

NETWORK_CONFIG = {
    "basecamp": {
        "chain_id": 123420111,
        "name": "Base Camp",
        "rpc": "https://rpc.basecamp.t.raas.gelato.cloud",
        "explorer": "https://basecamp.cloud.blockscout.com"
    },
    "basecamp-testnet": {  # Alias for backward compatibility
        "chain_id": 123420111,
        "name": "Base Camp",
        "rpc": "https://rpc.basecamp.t.raas.gelato.cloud",
        "explorer": "https://basecamp.cloud.blockscout.com"
    },
    "base-sepolia": {
        "chain_id": 84532,
        "name": "Base Sepolia",
        "rpc": "https://sepolia.base.org",
        "explorer": "https://sepolia.basescan.org"
    },
    "sepolia": {
        "chain_id": 11155111,
        "name": "Ethereum Sepolia",
        "rpc": "https://ethereum-sepolia-rpc.publicnode.com",
        "explorer": "https://sepolia.etherscan.io"
    },
    "polygon": {
        "chain_id": 137,
        "name": "Polygon",
        "rpc": "https://polygon.llamarpc.com",
        "explorer": "https://polygonscan.com"
    },
    "polygon-amoy": {
        "chain_id": 80002,
        "name": "Polygon Amoy",
        "rpc": "https://rpc-amoy.polygon.technology",
        "explorer": "https://amoy.polygonscan.com"
    },
    "arbitrum-sepolia": {
        "chain_id": 421614,
        "name": "Arbitrum Sepolia",
        "rpc": "https://sepolia-rollup.arbitrum.io/rpc",
        "explorer": "https://sepolia.arbiscan.io"
    },
    "optimism-sepolia": {
        "chain_id": 11155420,
        "name": "Optimism Sepolia",
        "rpc": "https://sepolia.optimism.io",
        "explorer": "https://sepolia-optimism.etherscan.io"
    },
    "avalanche-fuji": {
        "chain_id": 43113,
        "name": "Avalanche Fuji",
        "rpc": "https://api.avax-test.network/ext/bc/C/rpc",
        "explorer": "https://testnet.snowtrace.io"
    },
    "botchain": {
        "chain_id": 677,
        "name": "BOT Chain",
        "rpc": "https://rpc.botchain.ai",
        "explorer": "https://scan.botchain.ai"
    },
    "botchain-testnet": {
        "chain_id": 968,
        "name": "BOT Chain Testnet (Bohr)",
        "rpc": "https://rpc.bohr.life",
        "explorer": "https://scan.bohr.life"
    }
}


def get_network_info(network: str) -> Dict[str, Any]:
    """Get network configuration by name"""
    return NETWORK_CONFIG.get(network, NETWORK_CONFIG.get("botchain", {}))


def get_explorer_url(network: str, address: str) -> str:
    """Generate block explorer URL for contract"""
    config = get_network_info(network)
    if not config:
        return ""
    return f"{config['explorer']}/address/{address}"


# =============================================================================
# Game Templates (for quick contract generation)
# =============================================================================

GAME_TEMPLATES = {
    "tic-tac-toe": {
        "prompt": """Create a Tic Tac Toe game smart contract. Features:
- Two players take turns marking X or O on a 3x3 grid
- Track game state on-chain with board array
- Detect win conditions (rows, columns, diagonals) and draw
- Emit events for moves, wins, and draws
- Allow starting new games
- Keep constructor empty, gas-efficient design""",
        "filename": "TicTacToe.sol",
        "contract_name": "TicTacToe",
        "expected_type": "PVP_TURN"
    },
    "temple-run": {
        "prompt": """Create a Temple Run style endless runner game smart contract. Features:
- Player runs and dodges obstacles
- Track distance/score on-chain
- Submit high scores to global leaderboard
- Collect coins during run
- Energy system with cooldowns
- Emit events for game start/end/score submission
- Gas-efficient score verification
- Keep constructor empty""",
        "filename": "TempleRunner.sol",
        "contract_name": "TempleRunner",
        "expected_type": "RUNNER"
    },
    "2048": {
        "prompt": """Create a 2048 puzzle game smart contract. Features:
- 4x4 grid with sliding tiles
- Merge same numbers when colliding
- Track high scores on-chain
- Global leaderboard
- Emit events for moves and game over
- Gas-efficient state management
- Keep constructor empty""",
        "filename": "Puzzle2048.sol",
        "contract_name": "Puzzle2048",
        "expected_type": "PUZZLE"
    },
    "coin-flip": {
        "prompt": """Create a Coin Flip betting game smart contract. Features:
- Players bet ETH on heads or tails
- Use commit-reveal for fairness (or VRF placeholder)
- House edge 2%
- Track betting history per player
- Emit events for bets placed and results
- Anti-cheat with commit-reveal pattern
- Keep constructor empty""",
        "filename": "CoinFlipBet.sol",
        "contract_name": "CoinFlipBet",
        "expected_type": "BETTING"
    },
    "idle-clicker": {
        "prompt": """Create an Idle Clicker game smart contract. Features:
- Players click to earn tokens
- Upgrade multipliers with earned tokens
- Passive income generation over time
- Prestige system to reset with bonuses
- Track total clicks and earnings on-chain
- Gas-efficient batch claiming
- Keep constructor empty""",
        "filename": "IdleClicker.sol",
        "contract_name": "IdleClicker",
        "expected_type": "IDLE"
    },
    "bouncing-balls": {
        "prompt": """Create a comprehensive Web3 Bouncing Balls game smart contract. Features:
- Ball NFTs with physics properties
- Arena competitions
- Earn rewards for wins
- Leaderboard system
- Keep constructor empty
- Production-ready, auditable code""",
        "filename": "Web3BouncingBalls.sol",
        "contract_name": "Web3BouncingBalls",
        "expected_type": "PVP_REALTIME"
    },
    "rpg-dungeon": {
        "prompt": """Create an RPG Dungeon Crawler game smart contract. Features:
- Character creation with stats (STR, DEX, INT)
- Dungeon exploration with random encounters
- Loot drops as NFT items
- Experience and leveling system
- Equipment slots and inventory
- Boss battles with rewards
- Keep constructor empty""",
        "filename": "DungeonCrawler.sol",
        "contract_name": "DungeonCrawler",
        "expected_type": "RPG"
    },
    "racing": {
        "prompt": """Create a Racing game smart contract. Features:
- Real-time race simulation
- Multiple players compete simultaneously
- Car NFTs with speed/handling stats
- Race entry fees and prize pools
- Leaderboard and rankings
- Emit events for race start/finish/positions
- Keep constructor empty""",
        "filename": "RacingGame.sol",
        "contract_name": "RacingGame",
        "expected_type": "PVP_REALTIME"
    }
}


# =============================================================================
# SSE Log Entry
# =============================================================================

@dataclass
class LogEntry:
    index: int
    timestamp: int
    level: str
    message: str
    raw: Dict[str, Any]


# =============================================================================
# EVI Client
# =============================================================================

class EVIClient:
    """
    Client for interacting with EVI smart contract backend.
    Based on the reference acv-test-logic.js implementation.
    """
    
    def __init__(
        self,
        base_url: str = None,
        network: str = None,
        max_iters: int = None,
        timeout: float = 300.0
    ):
        self.base_url = (base_url or API_BASE_URL).rstrip("/")
        self.network = network or DEFAULT_NETWORK
        self.max_iters = max_iters or DEFAULT_MAX_ITERS
        self.client = httpx.AsyncClient(timeout=timeout)
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    # =========================================================================
    # HTTP Helper with retry
    # =========================================================================
    
    async def _request(
        self,
        method: str,
        endpoint: str,
        params: Dict[str, Any] = None,
        json_body: Dict[str, Any] = None,
        retries: int = 3,
        retry_delay: float = 2.0
    ) -> Dict[str, Any]:
        """
        Make HTTP request with retry/backoff on failures.
        """
        url = f"{self.base_url}{endpoint}"
        last_error = None
        
        for attempt in range(retries):
            try:
                response = await self.client.request(
                    method=method,
                    url=url,
                    params=params,
                    json=json_body,
                    headers={"Content-Type": "application/json"}
                )
                
                text = response.text
                try:
                    result = json.loads(text)
                except json.JSONDecodeError:
                    result = {"raw": text}
                
                if not response.is_success:
                    error_msg = f"HTTP {response.status_code}: {text[:500]}"
                    logger.warning(f"Request failed: {error_msg}")
                    if attempt < retries - 1:
                        await asyncio.sleep(retry_delay * (attempt + 1))
                        continue
                    raise Exception(error_msg)
                
                return result
                
            except httpx.RequestError as e:
                last_error = e
                logger.warning(f"Request error (attempt {attempt + 1}/{retries}): {e}")
                if attempt < retries - 1:
                    await asyncio.sleep(retry_delay * (attempt + 1))
                    continue
                raise
        
        raise last_error or Exception("Request failed after retries")
    
    # =========================================================================
    # AI Pipeline Endpoints
    # =========================================================================
    
    async def start_pipeline(
        self,
        prompt: str,
        network: str = None,
        max_iters: int = None,
        contract_name: str = None,
        filename: str = None,
        constructor_args: List[str] = None,
        strict_args: bool = True,
        context: str = None
    ) -> Dict[str, Any]:
        """
        Start the AI pipeline: generate → compile → deploy contract.
        
        POST /api/ai/pipeline
        
        Args:
            prompt: Natural language description of the contract
            network: Target blockchain network
            max_iters: Maximum fix iterations
            contract_name: Specific contract name
            filename: Solidity filename
            constructor_args: Constructor arguments
            strict_args: Strict constructor arg validation
            context: Additional context for AI
            
        Returns:
            {"ok": bool, "job": {"id": str, "type": str, "payload": dict}}
        """
        payload = {
            "prompt": prompt,
            "network": network or self.network,
            "maxIters": max_iters or self.max_iters,
            "constructorArgs": constructor_args or [],
            "strictArgs": strict_args,
            "context": context or ""
        }
        
        if contract_name:
            payload["contractName"] = contract_name
        if filename:
            payload["filename"] = filename
        
        return await self._request("POST", "/api/ai/pipeline", json_body=payload)
    
    async def start_fix(
        self,
        code: str,
        errors: str = "",
        context: str = "",
        network: str = None,
        filename: str = None,
        constructor_args: List[str] = None,
        contract_name: str = None,
        max_iters: int = None
    ) -> Dict[str, Any]:
        """
        Fix compilation errors and redeploy.
        
        POST /api/ai/fix
        
        Args:
            code: Solidity source code
            errors: Compilation errors to fix
            context: Additional context
            network: Target network
            filename: Solidity filename
            constructor_args: Constructor arguments
            contract_name: Contract name
            max_iters: Max fix iterations
            
        Returns:
            {"ok": bool, "job": {"id": str, "type": str}}
        """
        payload = {
            "code": code,
            "errors": errors,
            "context": context,
            "network": network or self.network,
            "filename": filename or "Contract.sol",
            "constructorArgs": constructor_args or [],
            "contractName": contract_name,
            "maxIters": max_iters or self.max_iters
        }
        
        return await self._request("POST", "/api/ai/fix", json_body=payload)
    
    async def generate_contract(
        self,
        prompt: str,
        model: str = None
    ) -> Dict[str, Any]:
        """
        Generate Solidity code from natural language (no deployment).
        
        POST /api/ai/generate
        """
        payload = {"prompt": prompt}
        if model:
            payload["model"] = model
        
        return await self._request("POST", "/api/ai/generate", json_body=payload)
    
    async def compile_contract(
        self,
        filename: str,
        code: str
    ) -> Dict[str, Any]:
        """
        Compile Solidity code.
        
        POST /api/ai/compile
        """
        return await self._request("POST", "/api/ai/compile", json_body={
            "filename": filename,
            "code": code
        })
    
    # =========================================================================
    # Job Management
    # =========================================================================
    
    async def get_job_status(
        self,
        job_id: str,
        verbose: bool = False
    ) -> Dict[str, Any]:
        """
        Get job status.
        
        GET /api/job/:id/status?verbose=1
        
        Returns:
            {"ok": bool, "data": {"id": str, "state": str, "result": dict, ...}}
        """
        params = {"verbose": "1" if verbose else "0"}
        return await self._request("GET", f"/api/job/{job_id}/status", params=params)
    
    async def get_job_logs(
        self,
        job_id: str,
        since: int = None,
        after_index: int = None,
        level: str = None,
        contains: str = None,
        limit: int = None,
        offset: int = None
    ) -> Dict[str, Any]:
        """
        Get job logs.
        
        GET /api/job/:id/logs
        """
        params = {}
        if since is not None:
            params["since"] = str(since)
        if after_index is not None:
            params["afterIndex"] = str(after_index)
        if level:
            params["level"] = level
        if contains:
            params["contains"] = contains
        if limit is not None:
            params["limit"] = str(limit)
        if offset is not None:
            params["offset"] = str(offset)
        
        return await self._request("GET", f"/api/job/{job_id}/logs", params=params)
    
    async def stream_job_logs_sse(
        self,
        job_id: str,
        after_index: int = 0,
        callback: Callable[[str, Any], None] = None
    ) -> List[LogEntry]:
        """
        Stream job logs via Server-Sent Events (SSE).
        
        GET /api/job/:id/logs/stream?afterIndex=N
        
        Args:
            job_id: Job identifier
            after_index: Start from this log index
            callback: Optional callback(event_name, data) for each event
            
        Returns:
            List of all log entries received
        """
        url = f"{self.base_url}/api/job/{job_id}/logs/stream?afterIndex={after_index}"
        logs: List[LogEntry] = []
        
        try:
            async with self.client.stream(
                "GET",
                url,
                headers={"Accept": "text/event-stream"},
                timeout=300.0
            ) as response:
                if not response.is_success:
                    raise Exception(f"SSE connection failed: {response.status_code}")
                
                buffer = ""
                async for chunk in response.aiter_text():
                    buffer += chunk
                    
                    # Process complete SSE messages (delimited by \n\n)
                    while "\n\n" in buffer:
                        idx = buffer.index("\n\n")
                        raw = buffer[:idx]
                        buffer = buffer[idx + 2:]
                        
                        # Parse SSE format
                        lines = raw.split("\n")
                        event_name = ""
                        data_str = ""
                        
                        for line in lines:
                            if line.startswith("event: "):
                                event_name = line[7:].strip()
                            elif line.startswith("data: "):
                                data_str += line[6:]
                        
                        if not event_name:
                            continue
                        
                        # Parse data
                        try:
                            data = json.loads(data_str) if data_str else None
                        except json.JSONDecodeError:
                            data = data_str
                        
                        # Handle events
                        if event_name == "log" and data:
                            entry = LogEntry(
                                index=data.get("i", 0),
                                timestamp=data.get("t", 0),
                                level=data.get("level", "info"),
                                message=data.get("msg", ""),
                                raw=data
                            )
                            logs.append(entry)
                        elif event_name == "end":
                            if callback:
                                callback("end", None)
                            return logs
                        
                        # Call callback if provided (handle both sync and async)
                        if callback:
                            result = callback(event_name, data)
                            if asyncio.iscoroutine(result):
                                await result
        
        except Exception as e:
            logger.warning(f"SSE stream error: {e}")
        
        return logs
    
    async def wait_for_job_completion(
        self,
        job_id: str,
        poll_interval: float = 2.0,
        timeout: float = 300.0,
        on_status: Callable[[Dict[str, Any]], None] = None
    ) -> Dict[str, Any]:
        """
        Poll job until completion or timeout with retry on errors.
        
        Args:
            job_id: Job identifier
            poll_interval: Seconds between polls
            timeout: Maximum wait time
            on_status: Optional callback on each status update
            
        Returns:
            Final job status with {"ok": bool, "data": {"state": str, ...}}
        """
        start_time = asyncio.get_event_loop().time()
        
        while True:
            elapsed = asyncio.get_event_loop().time() - start_time
            if elapsed > timeout:
                raise TimeoutError(f"Job {job_id} did not complete within {timeout}s")
            
            try:
                status = await self.get_job_status(job_id, verbose=True)
            except Exception as e:
                logger.warning(f"Status poll failed: {e}, retrying...")
                await asyncio.sleep(poll_interval)
                continue
            
            if on_status:
                on_status(status)
            
            # Check state from data.state (not top-level status)
            state = status.get("data", {}).get("state", "pending")
            
            if state in [JobState.COMPLETED, JobState.FAILED, "completed", "failed"]:
                return status
            
            await asyncio.sleep(poll_interval)
    
    # =========================================================================
    # Artifacts
    # =========================================================================
    
    async def download_artifacts(
        self,
        job_id: str,
        include: str = "all"
    ) -> Dict[str, Any]:
        """
        Download job artifacts (sources, ABIs, scripts).
        
        GET /api/artifacts?jobId=X&include=all
        
        Note: Uses query params, NOT headers (fixed from original implementation)
        
        Returns:
            {"ok": bool, "sources": [...], "abis": [...], "scripts": [...]}
        """
        params = {
            "jobId": job_id,
            "include": include
        }
        return await self._request("GET", "/api/artifacts", params=params)
    
    async def get_contract_abi(self, job_id: str) -> Dict[str, Any]:
        """
        Get compiled contract ABI.
        
        GET /api/artifacts/abis?jobId=X
        """
        return await self._request("GET", "/api/artifacts/abis", params={"jobId": job_id})
    
    async def get_contract_source(self, job_id: str) -> Dict[str, Any]:
        """
        Get contract source code.
        
        GET /api/artifacts/sources?jobId=X
        """
        return await self._request("GET", "/api/artifacts/sources", params={"jobId": job_id})
    
    # =========================================================================
    # Verification
    # =========================================================================
    
    async def verify_by_job(
        self,
        job_id: str,
        network: str = None,
        fully_qualified_name: str = None
    ) -> Dict[str, Any]:
        """
        Verify contract on block explorer using job artifacts.
        
        POST /api/verify/byJob
        
        Returns:
            {"ok": bool, "verified": bool, "explorerUrl": str}
        """
        payload = {
            "jobId": job_id,
            "network": network or self.network
        }
        if fully_qualified_name:
            payload["fullyQualifiedName"] = fully_qualified_name
        
        return await self._request("POST", "/api/verify/byJob", json_body=payload)
    
    async def verify_by_address(
        self,
        address: str,
        network: str = None,
        fully_qualified_name: str = None,
        constructor_args: List[str] = None
    ) -> Dict[str, Any]:
        """
        Verify contract by address.
        
        POST /api/verify/byAddress
        """
        payload = {
            "address": address,
            "network": network or self.network
        }
        if fully_qualified_name:
            payload["fullyQualifiedName"] = fully_qualified_name
        if constructor_args:
            payload["args"] = constructor_args
        
        return await self._request("POST", "/api/verify/byAddress", json_body=payload)
    
    # =========================================================================
    # Audit
    # =========================================================================
    
    async def audit_by_job(
        self,
        job_id: str,
        model: str = None,
        policy: str = None
    ) -> Dict[str, Any]:
        """
        Run security audit on code from a completed job.
        
        POST /api/audit/byJob
        
        Returns:
            {"ok": bool, "job": {"id": str, "type": "audit"}}
        """
        payload = {"jobId": job_id}
        if model:
            payload["model"] = model
        if policy:
            payload["policy"] = policy
        
        return await self._request("POST", "/api/audit/byJob", json_body=payload)
    
    async def audit_orchestrate(
        self,
        code: str = None,
        job_id: str = None,
        fix: bool = False,
        deploy: bool = False,
        network: str = None,
        model: str = None,
        fix_model: str = None,
        constructor_args: List[str] = None
    ) -> Dict[str, Any]:
        """
        Full audit orchestration: audit → fix → deploy pipeline.
        
        POST /api/audit/orchestrate
        
        Returns:
            {"ok": bool, "job": {"id": str, "type": "audit-orchestrate"}}
        """
        payload = {
            "fix": fix,
            "deploy": deploy,
            "network": network or self.network,
            "constructorArgs": constructor_args or []
        }
        if code:
            payload["code"] = code
        if job_id:
            payload["jobId"] = job_id
        if model:
            payload["model"] = model
        if fix_model:
            payload["fixModel"] = fix_model
        
        return await self._request("POST", "/api/audit/orchestrate", json_body=payload)
    
    async def get_audit_report(self, job_id: str) -> Dict[str, Any]:
        """
        Fetch persisted audit report for a job.
        
        GET /api/artifacts/audit?jobId=X
        """
        return await self._request("GET", "/api/artifacts/audit", params={"jobId": job_id})
    
    # =========================================================================
    # Compliance
    # =========================================================================
    
    async def compliance_by_job(
        self,
        job_id: str,
        model: str = None,
        profile: str = "generic",
        strict: bool = False,
        policy_pack: str = None,
        policy_checks: List[str] = None
    ) -> Dict[str, Any]:
        """
        Run compliance check on code from a completed job.
        
        POST /api/compliance/byJob
        
        Returns:
            {"ok": bool, "job": {"id": str, "type": "compliance"}}
        """
        payload = {
            "jobId": job_id,
            "profile": profile,
            "strict": strict
        }
        if model:
            payload["model"] = model
        if policy_pack:
            payload["policyPack"] = policy_pack
        if policy_checks:
            payload["policyChecks"] = policy_checks
        
        return await self._request("POST", "/api/compliance/byJob", json_body=payload)
    
    async def compliance_orchestrate(
        self,
        code: str = None,
        job_id: str = None,
        target_profile: str = "generic",
        strict: bool = False,
        fix: bool = False,
        deploy: bool = False,
        network: str = None,
        model: str = None,
        fix_model: str = None,
        constructor_args: List[str] = None
    ) -> Dict[str, Any]:
        """
        Full compliance orchestration: compliance → fix → deploy pipeline.
        
        POST /api/compliance/orchestrate
        
        Returns:
            {"ok": bool, "job": {"id": str, "type": "compliance-orchestrate"}}
        """
        payload = {
            "targetProfile": target_profile,
            "strict": strict,
            "fix": fix,
            "deploy": deploy,
            "network": network or self.network,
            "constructorArgs": constructor_args or []
        }
        if code:
            payload["code"] = code
        if job_id:
            payload["jobId"] = job_id
        if model:
            payload["model"] = model
        if fix_model:
            payload["fixModel"] = fix_model
        
        return await self._request("POST", "/api/compliance/orchestrate", json_body=payload)
    
    async def get_compliance_report(self, job_id: str) -> Dict[str, Any]:
        """
        Fetch persisted compliance report for a job.
        
        GET /api/artifacts/compliance?jobId=X
        """
        return await self._request("GET", "/api/artifacts/compliance", params={"jobId": job_id})
    
    # =========================================================================
    # Helper Methods
    # =========================================================================
    
    @staticmethod
    def extract_errors_from_logs(logs: List[Dict[str, Any]]) -> str:
        """
        Extract error/warning messages from job logs.
        Useful for providing context to fix endpoint.
        """
        parts = []
        for log in logs or []:
            level = str(log.get("level", "")).lower()
            if level in ("error", "warn"):
                parts.append(log.get("msg", ""))
        return "\n".join(parts)
    
    async def run_full_pipeline(
        self,
        prompt: str,
        network: str = None,
        contract_name: str = None,
        filename: str = None,
        constructor_args: List[str] = None,
        context: str = None,
        on_log: Callable[[LogEntry], None] = None,
        on_status: Callable[[str, str], None] = None,
        verify: bool = True,
        audit: bool = True,
        compliance: bool = True
    ) -> Dict[str, Any]:
        """
        Run the complete ACV pipeline: Generate → Deploy → Verify → Audit → Compliance
        
        Args:
            prompt: Natural language contract description
            network: Target network
            contract_name: Contract name
            filename: Solidity filename
            constructor_args: Constructor args
            context: Additional context
            on_log: Callback for each log entry
            on_status: Callback for status updates (phase, message)
            verify: Run verification after deploy
            audit: Run security audit
            compliance: Run compliance check
            
        Returns:
            {
                "success": bool,
                "job_id": str,
                "contract_address": str,
                "network": str,
                "explorer_url": str,
                "abi": list,
                "source_code": str,
                "verification": dict,
                "audit": dict,
                "compliance": dict,
                "error": str (if failed)
            }
        """
        result = {
            "success": False,
            "job_id": None,
            "contract_address": None,
            "network": network or self.network,
            "explorer_url": None,
            "abi": None,
            "source_code": None,
            "verification": None,
            "audit": None,
            "compliance": None,
            "error": None
        }
        
        def status(phase: str, msg: str):
            if on_status:
                on_status(phase, msg)
            logger.info(f"[{phase}] {msg}")
        
        try:
            # 1. Start Pipeline
            status("pipeline", "Starting AI pipeline...")
            pipeline_resp = await self.start_pipeline(
                prompt=prompt,
                network=network,
                contract_name=contract_name,
                filename=filename,
                constructor_args=constructor_args,
                context=context
            )
            
            job_id = pipeline_resp.get("job", {}).get("id")
            if not job_id:
                result["error"] = "No job ID returned from pipeline"
                return result
            
            result["job_id"] = job_id
            status("pipeline", f"Job created: {job_id}")
            
            # 2. Wait for completion (with SSE streaming if callback provided)
            if on_log:
                # Stream logs in background
                async def stream_logs():
                    await self.stream_job_logs_sse(
                        job_id,
                        callback=lambda e, d: on_log(LogEntry(
                            index=d.get("i", 0) if d else 0,
                            timestamp=d.get("t", 0) if d else 0,
                            level=d.get("level", "info") if d else "info",
                            message=d.get("msg", "") if d else "",
                            raw=d or {}
                        )) if e == "log" else None
                    )
                
                stream_task = asyncio.create_task(stream_logs())
            
            final_status = await self.wait_for_job_completion(job_id)
            
            if on_log:
                stream_task.cancel()
                try:
                    await stream_task
                except asyncio.CancelledError:
                    pass
            
            # 3. Check result
            state = final_status.get("data", {}).get("state")
            job_result = final_status.get("data", {}).get("result", {})
            
            if state != "completed":
                # Attempt fix flow
                status("fix", "Pipeline failed, attempting fix...")
                
                # Get logs and code for fix
                try:
                    logs_resp = await self.get_job_logs(job_id, limit=5000)
                    errors = self.extract_errors_from_logs(logs_resp.get("data", {}).get("logs", []))
                except Exception:
                    errors = final_status.get("data", {}).get("error", "Unknown error")
                
                try:
                    artifacts = await self.download_artifacts(job_id)
                    sources = artifacts.get("sources", [])
                    code = sources[0].get("content", "") if sources else ""
                except Exception:
                    code = ""
                
                if code.strip():
                    fix_resp = await self.start_fix(
                        code=code,
                        errors=errors,
                        context="Fix after pipeline failure",
                        network=network,
                        filename=filename,
                        constructor_args=constructor_args,
                        contract_name=contract_name
                    )
                    
                    fix_job_id = fix_resp.get("job", {}).get("id")
                    if fix_job_id:
                        job_id = fix_job_id
                        result["job_id"] = job_id
                        
                        final_status = await self.wait_for_job_completion(job_id)
                        state = final_status.get("data", {}).get("state")
                        job_result = final_status.get("data", {}).get("result", {})
                
                if state != "completed":
                    result["error"] = final_status.get("data", {}).get("error", "Deployment failed")
                    return result
            
            # 4. Extract deployment info
            contract_address = job_result.get("address")
            if not contract_address:
                result["error"] = "No contract address in result"
                return result
            
            result["contract_address"] = contract_address
            result["explorer_url"] = get_explorer_url(result["network"], contract_address)
            status("deploy", f"Contract deployed: {contract_address}")
            
            # 5. Get artifacts
            try:
                artifacts = await self.download_artifacts(job_id)
                sources = artifacts.get("sources", [])
                abis = artifacts.get("abis", [])
                
                result["source_code"] = sources[0].get("content") if sources else None
                result["abi"] = abis[0].get("abi") if abis else None
            except Exception as e:
                logger.warning(f"Failed to download artifacts: {e}")
            
            # 6. Verification
            if verify:
                status("verify", "Verifying contract...")
                try:
                    verify_resp = await self.verify_by_job(job_id, network)
                    result["verification"] = {
                        "verified": verify_resp.get("verified", False),
                        "explorer_url": verify_resp.get("explorerUrl")
                    }
                    if verify_resp.get("verified"):
                        status("verify", f"Verified: {verify_resp.get('explorerUrl')}")
                except Exception as e:
                    result["verification"] = {"verified": False, "error": str(e)}
                    logger.warning(f"Verification failed: {e}")
            
            # 7. Audit
            if audit:
                status("audit", "Running security audit...")
                try:
                    audit_start = await self.audit_orchestrate(job_id=job_id, network=network)
                    audit_job_id = audit_start.get("job", {}).get("id")
                    
                    if audit_job_id:
                        await self.wait_for_job_completion(audit_job_id, timeout=120)
                        
                        # Try to get report from both job IDs
                        audit_report = None
                        try:
                            audit_report = await self.get_audit_report(job_id)
                        except Exception:
                            try:
                                audit_report = await self.get_audit_report(audit_job_id)
                            except Exception:
                                pass
                        
                        if audit_report:
                            score = audit_report.get("score") or audit_report.get("data", {}).get("score")
                            result["audit"] = {
                                "score": score,
                                "report": audit_report
                            }
                            status("audit", f"Audit score: {score}/100")
                except Exception as e:
                    result["audit"] = {"error": str(e)}
                    logger.warning(f"Audit failed: {e}")
            
            # 8. Compliance
            if compliance:
                status("compliance", "Running compliance check...")
                try:
                    comp_start = await self.compliance_orchestrate(
                        job_id=job_id,
                        target_profile="generic",
                        network=network
                    )
                    comp_job_id = comp_start.get("job", {}).get("id")
                    
                    if comp_job_id:
                        await self.wait_for_job_completion(comp_job_id, timeout=120)
                        
                        comp_report = None
                        try:
                            comp_report = await self.get_compliance_report(job_id)
                        except Exception:
                            try:
                                comp_report = await self.get_compliance_report(comp_job_id)
                            except Exception:
                                pass
                        
                        if comp_report:
                            score = comp_report.get("score") or comp_report.get("data", {}).get("score")
                            result["compliance"] = {
                                "score": score,
                                "report": comp_report
                            }
                            status("compliance", f"Compliance score: {score}/100")
                except Exception as e:
                    result["compliance"] = {"error": str(e)}
                    logger.warning(f"Compliance failed: {e}")
            
            result["success"] = True
            status("complete", "Pipeline completed successfully!")
            return result
            
        except Exception as e:
            result["error"] = str(e)
            logger.error(f"Pipeline failed: {e}")
            return result
    
    async def deploy_game(
        self,
        game_type: str,
        network: str = None,
        on_status: Callable[[str, str], None] = None
    ) -> Dict[str, Any]:
        """
        Deploy a predefined game contract.
        
        Args:
            game_type: One of the GAME_TEMPLATES keys
            network: Target network
            on_status: Status callback
            
        Returns:
            Full pipeline result
        """
        if game_type not in GAME_TEMPLATES:
            return {
                "success": False,
                "error": f"Unknown game type: {game_type}. Available: {list(GAME_TEMPLATES.keys())}"
            }
        
        template = GAME_TEMPLATES[game_type]
        
        return await self.run_full_pipeline(
            prompt=template["prompt"],
            network=network,
            contract_name=template["contract_name"],
            filename=template["filename"],
            context=f"Game type: {template['expected_type']}",
            on_status=on_status
        )
