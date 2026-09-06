# Camp Extended Test Results
Started: 2025-09-18 01:40:26
Server: https://acadcodegen-production.up.railway.app
Settings: POLL_INTERVAL=3s, TIMEOUT=1200s

### 1) CrossChainInbox
- Server: https://acadcodegen-production.up.railway.app
- Job ID: ai_pipeline_cb36a84a-68d3-4795-8949-5178c3499fb9
- Outcome: Success
- State: completed
- Step: deploy
- Progress: 100
- Duration (s): 36
- Started At: 2025-09-18 01:40:27
- Finished At: 2025-09-18 01:41:03
- Network: basecamp
- Contract: CrossChainInbox
- FQN: contracts/AI_ai_pipeline_cb36a84a-68d3-4795-8949-5178c3499fb9_CrossChainInbox.sol:CrossChainInbox
- Deployer: 0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E
- Filename: CrossChainInbox.sol
- Constructor Args: []
- Prompt: \n\n\tCrossChainInbox: contract to receive messages (bytes data, address sender, uint256 srcChainId). Owner can set trusted bridges. Events MessageReceived, BridgeUpdated.\n
- Address: 0xe1EbF68F9A874c6bC583e2d62993280a5dC01d17
- Explorer: https://basecamp.cloud.blockscout.com/address/0xe1EbF68F9A874c6bC583e2d62993280a5dC01d17

### 2) MicroGrantDAO
- Server: https://acadcodegen-production.up.railway.app
- Job ID: ai_pipeline_7ec274b9-536a-442d-9b3c-26205c20bafd
- Outcome: Failed
- State: failed
- Step: fix
- Progress: 100
- Duration (s): 63
- Started At: 2025-09-18 01:41:03
- Finished At: 2025-09-18 01:42:06
- Network: basecamp
- Contract: 
- FQN: 
- Deployer: 
- Filename: MicroGrantDAO.sol
- Constructor Args: []
- Prompt: \n\n\tMicroGrantDAO using AccessControl: proposeGrant(string ipfsCid,uint256 amount), voteYes/voteNo (token-weighted optional simple model), finalize() sets approved flag. Treasury address settable; if approved, mark payable() to accept funding. Events Proposed, Voted, Finalized.\n
- Error: context is not defined

### 3) OnchainAttestor
- Server: https://acadcodegen-production.up.railway.app
- Job ID: ai_pipeline_96b2715b-3103-4e1f-a347-28c5cae98cf6
- Outcome: Success
- State: completed
- Step: deploy
- Progress: 100
- Duration (s): 167
- Started At: 2025-09-18 01:42:06
- Finished At: 2025-09-18 01:44:53
- Network: basecamp
- Contract: OnchainAttestor
- FQN: contracts/AI_ai_pipeline_96b2715b-3103-4e1f-a347-28c5cae98cf6_OnchainAttestor.sol:OnchainAttestor
- Deployer: 0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E
- Filename: OnchainAttestor.sol
- Constructor Args: []
- Prompt: \n\n\tOnchainAttestor: auditors with role can issue bytes32 attestations per subject address keyed by topic bytes32. revoke/update supported. Query latest by subject+topic. Events Issued, Revoked, Updated.\n
- Address: 0x81F3A1c016C69c9d8A4F6e4d3E9a233D14B2F71d
- Explorer: https://basecamp.cloud.blockscout.com/address/0x81F3A1c016C69c9d8A4F6e4d3E9a233D14B2F71d

### 4) CampFaucet
- Server: https://acadcodegen-production.up.railway.app
- Job ID: ai_pipeline_04faacb9-4f70-4246-bc22-0786b79416b9
- Outcome: Failed
- State: failed
- Step: deploy_prep
- Progress: 100
- Duration (s): 53
- Started At: 2025-09-18 01:44:54
- Finished At: 2025-09-18 01:45:47
- Network: basecamp
- Contract: 
- FQN: 
- Deployer: 
- Filename: CampFaucet.sol
- Constructor Args: []
- Prompt: \n\n\tCampFaucet: daily rate faucet for ERC20 token: claim() gives fixed amount per 24h per address. Owner can set amount and token. Anti-abuse via cooldown mapping. Events Claimed, ParamsUpdated.\n
- Error: CONSTRUCTOR_ARGS_REQUIRED

### 5) NFTRaffle
- Server: https://acadcodegen-production.up.railway.app
- Job ID: ai_pipeline_c08dd676-c5a0-47ec-8fa6-c614306c8a9b
- Outcome: Failed
- State: failed
- Step: deploy_prep
- Progress: 100
- Duration (s): 58
- Started At: 2025-09-18 01:45:48
- Finished At: 2025-09-18 01:46:46
- Network: basecamp
- Contract: 
- FQN: 
- Deployer: 
- Filename: NFTRaffle.sol
- Constructor Args: []
- Prompt: \n\n\tNFTRaffle: ERC721 raffle with buyTicket(price) payable, drawWinner() onlyOwner using pseudo-random blockhash for demo. Winner can claim NFT prize by tokenId metadata CID. Events TicketBought, WinnerDrawn, PrizeClaimed.\n
- Error: CONSTRUCTOR_ARGS_REQUIRED

### 6) BountyBoard
- Server: https://acadcodegen-production.up.railway.app
- Job ID: ai_pipeline_f8f2fc19-e521-4f81-9de9-b7a29684a25b
- Outcome: Success
- State: completed
- Step: deploy
- Progress: 100
- Duration (s): 62
- Started At: 2025-09-18 01:46:47
- Finished At: 2025-09-18 01:47:49
- Network: basecamp
- Contract: BountyBoard
- FQN: contracts/AI_ai_pipeline_f8f2fc19-e521-4f81-9de9-b7a29684a25b_BountyBoard.sol:BountyBoard
- Deployer: 0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E
- Filename: BountyBoard.sol
- Constructor Args: []
- Prompt: \n\n\tBountyBoard: createBounty(string cid,uint256 reward,address token). submitWork(uint256 id,string cid). owner or reviewer resolve(id,bool success) and pay reward if success. Events Created, Submitted, Resolved, Paid.\n
- Address: 0xbeD2aa9D821fAb2aA72c2e667601870Ad1C326E9
- Explorer: https://basecamp.cloud.blockscout.com/address/0xbeD2aa9D821fAb2aA72c2e667601870Ad1C326E9

### 7) NameRegistrar
- Server: https://acadcodegen-production.up.railway.app
- Job ID: ai_pipeline_f82bb155-a288-45b0-ac2d-577128fb4563
- Outcome: Success
- State: completed
- Step: deploy
- Progress: 100
- Duration (s): 55
- Started At: 2025-09-18 01:47:50
- Finished At: 2025-09-18 01:48:45
- Network: basecamp
- Contract: NameRegistrar
- FQN: contracts/AI_ai_pipeline_f82bb155-a288-45b0-ac2d-577128fb4563_NameRegistrar.sol:NameRegistrar
- Deployer: 0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E
- Filename: NameRegistrar.sol
- Constructor Args: []
- Prompt: \n\n\tNameRegistrar: simple ENS-like registrar mapping name(string) => owner + resolver(bytes32 contenthash). register(name), setContenthash, transferName. Prevent duplicates. Events Registered, ContentUpdated, Transferred.\n
- Address: 0x7bcDD0Ba38525144BA3A26d980fA3Ca79C2F8537
- Explorer: https://basecamp.cloud.blockscout.com/address/0x7bcDD0Ba38525144BA3A26d980fA3Ca79C2F8537

### 8) StableVault
- Server: https://acadcodegen-production.up.railway.app
- Job ID: ai_pipeline_9dbad10e-f461-42c1-8917-f10413cacb65
- Outcome: Failed
- State: failed
- Step: deploy_prep
- Progress: 100
- Duration (s): 57
- Started At: 2025-09-18 01:48:45
- Finished At: 2025-09-18 01:49:42
- Network: basecamp
- Contract: 
- FQN: 
- Deployer: 
- Filename: StableVault.sol
- Constructor Args: []
- Prompt: \n\n\tStableVault: accepts deposits of an ERC20, mints receipt tokens (ERC20) 1:1. Owner can pause/unpause and set withdrawal fees in bps. Withdraw burns receipts and transfers underlying minus fee. Events Deposited, Withdrawn, ParamsUpdated.\n
- Error: CONSTRUCTOR_ARGS_REQUIRED

### 9) SocialTips
- Server: https://acadcodegen-production.up.railway.app
- Job ID: ai_pipeline_66c9e5eb-fb36-4dc4-ac8a-d7f6c3696df6
- Outcome: Failed
- State: failed
- Step: fix
- Progress: 100
- Duration (s): 42
- Started At: 2025-09-18 01:49:44
- Finished At: 2025-09-18 01:50:26
- Network: basecamp
- Contract: 
- FQN: 
- Deployer: 
- Filename: SocialTips.sol
- Constructor Args: []
- Prompt: \n\n\tSocialTips: tipping contract for creators. setProfile(bytes32 id,string cid). tip(bytes32 id) payable accumulates balance; creator withdraws. Optional split percentages to collaborators. Events ProfileSet, Tipped, Withdrawn.\n
- Error: context is not defined

