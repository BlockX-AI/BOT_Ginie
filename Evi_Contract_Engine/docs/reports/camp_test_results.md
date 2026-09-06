# Camp Ecosystem Test Results
Started: 2025-09-17 23:00:54
Server: https://acadcodegen-production.up.railway.app
Settings: POLL_INTERVAL=3s, TIMEOUT=600s

### 1) IdentityRegistry
- Server: https://acadcodegen-production.up.railway.app
- Job ID: ai_pipeline_075d5467-9d35-4fea-92de-b47f36fff656
- Outcome: Failed
- State: failed
- Step: deploy
- Progress: 100
- Duration (s): 98
- Started At: 2025-09-17 23:00:55
- Finished At: 2025-09-17 23:02:33
- Network: basecamp
- Contract: 
- FQN: 
- Deployer: 
- Filename: IdentityRegistry.sol
- Constructor Args: []
- Prompt: \n\n\tWrite a Solidity ^0.8.20 IdentityRegistry where users can register a DID (string), auditors can issue attestations mapping(address => bytes32 attestation). Include revoke and events. Use OpenZeppelin AccessControl for roles.\n
- Error: exit 1

### 2) FeeTreasury
- Server: https://acadcodegen-production.up.railway.app
- Job ID: ai_pipeline_401ee0fc-9be3-4cd2-a7d0-907607e906ad
- Outcome: Failed
- State: failed
- Step: deploy
- Progress: 100
- Duration (s): 79
- Started At: 2025-09-17 23:02:33
- Finished At: 2025-09-17 23:03:52
- Network: basecamp
- Contract: 
- FQN: 
- Deployer: 
- Filename: FeeTreasury.sol
- Constructor Args: []
- Prompt: \n\n\tWrite FeeTreasury contract in Solidity ^0.8.20. receive() payable, depositERC20(address token, uint256 amount). OnlyOwner can withdraw. Add function distribute(address[] recipients,uint256[] amounts). Events Deposited, Withdrawn, Distributed.\n
- Error: exit 1

