# Boba Sepolia Test Results
Started: 2025-09-19 16:10:21
Server: http://localhost:3000
Settings: POLL_INTERVAL=3s, TIMEOUT=600s

### 1) IdentityRegistry (boba)
- Server: http://localhost:3000
- Job ID: ai_pipeline_f9696e51-9835-4292-bc92-9331d3eebf9c
- Outcome: Success
- State: completed
- Step: deploy
- Progress: 100
- Duration (s): 83
- Started At: 2025-09-19 16:10:21
- Finished At: 2025-09-19 16:11:44
- Network: boba-sepolia
- Contract: IdentityRegistry
- FQN: contracts/AI_ai_pipeline_f9696e51-9835-4292-bc92-9331d3eebf9c_IdentityRegistry.sol:IdentityRegistry
- Deployer: 0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E
- Filename: IdentityRegistry.sol
- Constructor Args: []
- Prompt: \n\n\tWrite a Solidity ^0.8.20 IdentityRegistry where users can register a DID (string), auditors can issue attestations mapping(address => bytes32 attestation). Include revoke and events. Use OpenZeppelin AccessControl for roles.\n
- Address: 0xe523fc1cc80A6EF2f643895b556cf43A1f1bCF60

### 2) FeeTreasury (boba)
- Server: http://localhost:3000
- Job ID: ai_pipeline_39dafb62-6e37-4a3d-bcd4-fb099ccbe05f
- Outcome: Success
- State: completed
- Step: deploy
- Progress: 100
- Duration (s): 82
- Started At: 2025-09-19 16:11:44
- Finished At: 2025-09-19 16:13:06
- Network: boba-sepolia
- Contract: FeeTreasury
- FQN: contracts/AI_ai_pipeline_39dafb62-6e37-4a3d-bcd4-fb099ccbe05f_FeeTreasury.sol:FeeTreasury
- Deployer: 0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E
- Filename: FeeTreasury.sol
- Constructor Args: []
- Prompt: \n\n\tWrite FeeTreasury contract in Solidity ^0.8.20. receive() payable, depositERC20(address token, uint256 amount). OnlyOwner can withdraw. Add function distribute(address[] recipients,uint256[] amounts). Events Deposited, Withdrawn, Distributed.\n
- Address: 0xF4437552a67d5FAAdD1A06aaa6db4466eB9Fa969

### 3) GrantsEscrow (boba)
- Server: http://localhost:3000
- Job ID: ai_pipeline_3f432949-4c67-4781-adcf-df1b467a2a94
- Outcome: Success
- State: completed
- Step: deploy
- Progress: 100
- Duration (s): 109
- Started At: 2025-09-19 16:13:06
- Finished At: 2025-09-19 16:14:55
- Network: boba-sepolia
- Contract: GrantsEscrow
- FQN: contracts/AI_ai_pipeline_3f432949-4c67-4781-adcf-df1b467a2a94_GrantsEscrow.sol:GrantsEscrow
- Deployer: 0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E
- Filename: GrantsEscrow.sol
- Constructor Args: []
- Prompt: \n\n\tGrantsEscrow contract in Solidity ^0.8.20 where funders lock ERC20 tokens for developers. release() allowed only after milestone verification (bool flag set by auditor role). Supports multiple milestones per project. Events Funded, Released, Revoked.\n
- Address: 0x83A3AFEb5D6AEbcc01eaF42AA6bb9f08b58031A1

### 4) BatchCIDAnchor (boba)
- Server: http://localhost:3000
- Job ID: ai_pipeline_64bf4e70-c74c-4c69-bd63-8017a1a8d429
- Outcome: Failed
- State: failed
- Step: deploy
- Progress: 100
- Duration (s): 210
- Started At: 2025-09-19 16:14:55
- Finished At: 2025-09-19 16:18:25
- Network: boba-sepolia
- Contract: 
- FQN: 
- Deployer: 
- Filename: BatchCIDAnchor.sol
- Constructor Args: []
- Prompt: \n\n\tWrite BatchCIDAnchor in Solidity ^0.8.20 where submitter can store multiple IPFS CIDs (string[]). mapping(bytes32 => CIDRecord) stores cid + timestamp + submitter. BatchSubmit and CIDUpdated events.\n
- Error: exit 1

### 5) DAOProposal (boba)
- Server: http://localhost:3000
- Job ID: ai_pipeline_1c7a0142-39bf-4d2e-a5c5-5c4ff442a2a2
- Outcome: Failed
- State: failed
- Step: deploy
- Progress: 100
- Duration (s): 98
- Started At: 2025-09-19 16:18:25
- Finished At: 2025-09-19 16:20:03
- Network: boba-sepolia
- Contract: 
- FQN: 
- Deployer: 
- Filename: DAOProposal.sol
- Constructor Args: []
- Prompt: \n\n\tDAOProposal contract in Solidity ^0.8.20 supporting proposals with description string, yes/no votes (ERC20 token-weighted). After deadline, proposal is executable. Use OZ Governor or simple custom model.\n
- Error: exit 1

