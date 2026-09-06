# Pipeline Test Suite

This document contains ready-to-run curl commands to exercise the AI pipeline and sections to record whether each deployed successfully. Replace the network and args as needed.

Notes:
- Use network "hardhat" for local testing (no explorer).
- For Basecamp (on-chain), set RPC and private key in .env. Explorer link template: https://basecamp.cloud.blockscout.com/address/<DEPLOYED_ADDRESS>
- After submitting, copy the job id and poll status (commands at the bottom).

---

## 1) Minimal ERC20 (name/symbol)

Command:
```bash
curl -sS -X POST http://localhost:3000/api/ai/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "prompt":"Create a minimal ERC20 using OpenZeppelin. Constructor (string name,string symbol). No mint/burn.",
    "network":"hardhat",
    "filename":"MinimalERC20.sol",
    "contractName":"MinimalERC20",
    "constructorArgs":["MinimalERC20","MER"]
  }'
```
Progress/Result:
- [ ] Completed
- Address: 
- Explorer: 

---

## 2) Owner-mint ERC20 (Ownable, no burn)

Command:
```bash
curl -sS -X POST http://localhost:3000/api/ai/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "prompt":"ERC20 using OpenZeppelin Ownable. Only owner can mint(address to,uint256 amount). No burn.",
    "network":"hardhat",
    "filename":"OwnerMintToken.sol",
    "contractName":"OwnerMintToken",
    "constructorArgs":["OwnerMintToken","OMT"]
  }'
```
Progress/Result:
- [ ] Completed
- Address: 
- Explorer: 

---

## 3) Counter (no external imports)

Command:
```bash
curl -sS -X POST http://localhost:3000/api/ai/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "prompt":"Write a Counter contract ^0.8.0 with increment(), decrement(), and view current(). No external imports.",
    "network":"hardhat",
    "filename":"Counter.sol",
    "contractName":"Counter",
    "constructorArgs":[]
  }'
```
Progress/Result:
- [ ] Completed
- Address: 
- Explorer: 

---

## 4) SimpleStorage (get/set)

Command:
```bash
curl -sS -X POST http://localhost:3000/api/ai/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "prompt":"SimpleStorage ^0.8.0 storing a uint256 with set(uint256) and view get(). No external imports.",
    "network":"hardhat",
    "filename":"SimpleStorage.sol",
    "contractName":"SimpleStorage",
    "constructorArgs":[]
  }'
```
Progress/Result:
- [ ] Completed
- Address: 
- Explorer: 

---

## 5) Minimal ERC721 (mintTo onlyOwner)

Command:
```bash
curl -sS -X POST http://localhost:3000/api/ai/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "prompt":"Minimal ERC721 via OpenZeppelin. Constructor (string name,string symbol). Add onlyOwner mintTo(address,uint256). No URI logic.",
    "network":"hardhat",
    "filename":"MinimalNFT.sol",
    "contractName":"MinimalNFT",
    "constructorArgs":["MinimalNFT","MNFT"]
  }'
```
Progress/Result:
- [ ] Completed
- Address: 
- Explorer: 

---

## 6) Reentrancy-safe Vault (no OZ imports)

Command:
```bash
curl -sS -X POST http://localhost:3000/api/ai/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "prompt":"Vault contract ^0.8.0 allowing deposits and withdrawals. Use checks-effects-interactions to prevent reentrancy. No external imports.",
    "network":"hardhat",
    "filename":"Vault.sol",
    "contractName":"Vault",
    "constructorArgs":[]
  }'
```
Progress/Result:
- [ ] Completed
- Address: 
- Explorer: 

---

## 7) Pausable ERC20 (pause/unpause by owner)

Command:
```bash
curl -sS -X POST http://localhost:3000/api/ai/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "prompt":"ERC20 using OpenZeppelin with Ownable + Pausable. Owner can pause/unpause; transfers block when paused.",
    "network":"hardhat",
    "filename":"PausableToken.sol",
    "contractName":"PausableToken",
    "constructorArgs":["PausableToken","PZT"]
  }'
```
Progress/Result:
- [ ] Completed
- Address: 
- Explorer: 

---

## 8) ERC1155 minimal (single URI, owner mint)

Command:
```bash
curl -sS -X POST http://localhost:3000/api/ai/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "prompt":"Minimal ERC1155 via OpenZeppelin. Constructor takes a baseURI string. onlyOwner mint(address to,uint256 id,uint256 amount).",
    "network":"hardhat",
    "filename":"Minimal1155.sol",
    "contractName":"Minimal1155",
    "constructorArgs":["https://example.com/{id}.json"]
  }'
```
Progress/Result:
- [ ] Completed
- Address: 
- Explorer: 

---

## 9) Registry (mapping addr=>string, set/get)

Command:
```bash
curl -sS -X POST http://localhost:3000/api/ai/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "prompt":"Simple Registry ^0.8.0 mapping(address=>string). setMyData(string) and getData(address) view. No external imports.",
    "network":"hardhat",
    "filename":"Registry.sol",
    "contractName":"Registry",
    "constructorArgs":[]
  }'
```
Progress/Result:
- [ ] Completed
- Address: 
- Explorer: 

---

## 10) Greeter (constructor message; hello())

Command:
```bash
curl -sS -X POST http://localhost:3000/api/ai/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "prompt":"Greeter ^0.8.0 with constructor(string message) and hello() view returns the message. No external imports.",
    "network":"hardhat",
    "filename":"Greeter.sol",
    "contractName":"Greeter",
    "constructorArgs":["Hello from pipeline"]
  }'
```
Progress/Result:
- [ ] Completed
- Address: 
- Explorer: 

---

## How to Poll a Job

Replace <JOB_ID> with the id from the submission response.

Poll once:
```bash
curl -s "http://localhost:3000/api/job/<JOB_ID>/status" | jq
```

Poll until completion:
```bash
while true; do
  curl -s "http://localhost:3000/api/job/<JOB_ID>/status" \
  | jq -r '"state=" + .data.state + " step=" + (.data.step//"") + " progress=" + ((.data.progress|tostring)//"")'
  sleep 3
done
```

Extract just the deployed address:
```bash
curl -s "http://localhost:3000/api/job/<JOB_ID>/status" | jq -r '.data.result.address'
```

Explorer link (Basecamp):
```text
https://basecamp.cloud.blockscout.com/address/<DEPLOYED_ADDRESS>
```
