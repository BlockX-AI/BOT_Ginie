# AcademicChain API Documentation Summary

**Access Swagger UI at**: `http://your-domain/api-docs`

## 📚 Complete API Documentation Coverage

### ✅ Category 2: AI Smart Contract Generation (8 endpoints)

**Base Path**: `/api/ai/*`

1. **POST /api/ai/generate** - Generate Solidity contract from text prompt
   - Input: Natural language description
   - Output: Solidity code with sanitization
   - Features: Google Gemini AI, prompt augmentation

2. **POST /api/ai/fix** - Auto-fix contract compilation errors
   - Input: Contract code + error messages
   - Output: Fixed contract code
   - Features: Iterative refinement (max 12 iterations)

3. **POST /api/ai/compile** - Compile Solidity contract
   - Input: Contract source code
   - Output: Compilation result with ABI/bytecode
   - Features: Isolated sandbox, Hardhat integration

4. **POST /api/ai/pipeline** - Full AI pipeline (generate → compile → deploy)
   - Input: Prompt + network + constructor args
   - Output: Job ID for async tracking
   - Features: End-to-end automation, background processing

---

### ✅ Category 3: Background Jobs System (4 endpoints)

**Base Path**: `/api/job/*`

1. **GET /api/job/:id** - Get full job details
   - Returns: Complete job object with all fields

2. **GET /api/job/:id/status** - Get job status (slim or verbose)
   - Query params: `?verbose=1` for full details
   - Returns: State, progress, result, error

3. **GET /api/job/:id/logs** - Get paginated logs with filters
   - Query params: `since`, `afterIndex`, `level`, `contains`, `limit`, `offset`, `ndjson`
   - Returns: Filtered logs array or NDJSON stream

4. **GET /api/job/:id/logs/stream** - Real-time SSE log stream
   - Returns: Server-Sent Events with log updates
   - Events: `hello`, `log`, `heartbeat`, `end`

---

### ✅ Category 4: Contract Deployment (5 endpoints)

**Base Path**: `/api/deploy/*`

1. **POST /api/deploy/erc20** - Deploy ERC20 BusinessToken
   - Input: name, symbol, initialSupply, owner, network
   - Output: Contract address + explorer URL
   - Features: Isolated sandbox, multi-network support

2. **POST /api/deploy/research-paper** - Deploy ResearchPaper NFT contract
   - Input: name, symbol, originProtocol, network
   - Output: Contract address + explorer URL
   - Features: ERC721 for academic papers

3. **POST /api/deploy/citation-registry** - Deploy CitationRegistry
   - Input: network
   - Output: Contract address + explorer URL
   - Features: Citation tracking on-chain

4. **POST /api/deploy/royalty-distributor** - Deploy RoyaltyDistributor
   - Input: originProtocol, treasury, platformFeeBps, network
   - Output: Contract address + explorer URL
   - Features: Automatic royalty distribution

5. **POST /api/deploy/academic-suite** - Deploy all 3 academic contracts
   - Input: rpName, rpSymbol, originProtocol, treasury, platformFeeBps, network
   - Output: All 3 contract addresses + explorer URLs
   - Features: Integrated deployment with cross-configuration

---

### ✅ Category 5: Wallet-Based Deployment (4 endpoints)

**Base Path**: `/api/wallet/*`

1. **POST /api/wallet/deploy-with-wallet** - Start wallet deployment (user signs)
   - Input: prompt, network, callbackUrl, constructorArgs
   - Output: jobId + magic link
   - Features: User wallet signing, no private key sharing

2. **GET /api/wallet/sign/:sessionId** - Get session details for signing
   - Returns: Transaction data for user to sign
   - Features: Session expiry (15 min), one-time use

3. **POST /api/wallet/sign/:sessionId/submit** - Submit signed transaction
   - Input: txHash, walletAddress
   - Output: Transaction monitoring status
   - Features: Blockchain monitoring, job updates

4. **GET /api/wallet/sessions/stats** - Get deployment statistics
   - Returns: Total sessions, active sessions, success rate
   - Features: System health monitoring

---

### ✅ Category 6: Smart Contract Auditing (3 endpoints)

**Base Path**: `/api/audit/*`

1. **POST /api/audit/analyze** - Analyze Solidity source code
   - Input: code, filename, model, policy
   - Output: Security audit report (score 0-100)
   - Features: 
     - Minimum 17 findings
     - Categorized by severity (error/warning/info)
     - Exploit scenarios for critical issues
     - Remediation code
     - Coverage metrics

2. **POST /api/audit/byJob** - Audit contract from job ID
   - Input: jobId, model, policy
   - Output: Security audit report
   - Features: Auto-resolve source from artifacts

3. **POST /api/audit/orchestrate** - Orchestrate Audit → Fix → Deploy
   - Input: code/jobId, fix, deploy, network
   - Output: Job ID for async orchestration
   - Features: Multi-step workflow automation

---

### ✅ Category 7: Compliance Checking (3 endpoints)

**Base Path**: `/api/compliance/*`

1. **POST /api/compliance/analyze** - Check code compliance against standards
   - Input: code, filename, profile (generic/registry/token/custom), strict, policyPack, policyChecks
   - Output: Compliance report
   - Features:
     - ERC20/ERC721/ERC1155 validation
     - Required functions check
     - Missing functions detection
     - Confidence score

2. **POST /api/compliance/byJob** - Check compliance for job ID
   - Input: jobId, profile, strict, policyPack
   - Output: Compliance report
   - Features: Persists report in job folder

3. **POST /api/compliance/orchestrate** - Orchestrate Compliance → Fix → Deploy
   - Input: code/jobId, targetProfile, fix, deploy, network
   - Output: Job ID for async workflow
   - Features: Policy enforcement automation

---

### ✅ Category 8: Contract Verification (3 endpoints)

**Base Path**: `/api/verify/*`

1. **POST /api/verify/byAddress** - Verify deployed contract by address
   - Input: address, network, fullyQualifiedName, args
   - Output: Verification result + explorer URL
   - Features: Hardhat verify plugin, Blockscout integration

2. **POST /api/verify/byJob** - Verify contract from job ID
   - Input: jobId, network, fullyQualifiedName
   - Output: Verification result + explorer URL
   - Features: Auto-resolve deployment data

3. **GET /api/verify/status** - Check if contract is verified on explorer
   - Query params: address, network
   - Returns: Verification status (true/false) + explorer URL
   - Features: Blockscout API v1/v2, Etherscan API support

---

### ✅ Category 9: Artifacts Management (2 endpoints)

**Base Path**: `/api/artifacts/*`

1. **GET /api/artifacts** - List artifacts for job or project
   - Headers: `x-job-id` or query param `jobId`
   - Query params: `include` (all/sources/abis/scripts)
   - Returns: Sources, ABIs, scripts with content
   - Features: Job-specific or project fallback

2. **GET /api/artifacts/:jobId/:filename** - Get specific artifact
   - Returns: Single artifact file content
   - Features: Direct file access

---

## 🚫 Excluded from Documentation

**Category 1: Research Paper Management** (as requested)
- `/api/papers/*` - ResearchPaper contract routes
- `/api/citations/*` - CitationRegistry contract routes  
- `/api/royalties/*` - RoyaltyDistributor contract routes
- `/api/origin/*` - Origin Protocol routes

---

## 📊 Documentation Statistics

- **Total Documented Endpoints**: 32
- **Total Excluded Endpoints**: ~15 (Category 1)
- **API Categories**: 8
- **Swagger Tags**: AI, Jobs, Deploy, Wallet, Audit, Compliance, Verify, Artifacts

---

## 🔍 How to Access

1. **Development**: `http://localhost:3000/api-docs`
2. **Production**: `https://your-railway-app.railway.app/api-docs`
3. **OpenAPI Spec (JSON)**: 
   - `http://localhost:3000/api-docs.json`
   - `http://localhost:3000/openapi.json`

---

## ✨ Swagger Features

- ✅ Interactive API testing
- ✅ Request/response schemas
- ✅ Example values
- ✅ Parameter descriptions
- ✅ Authentication examples
- ✅ Error code documentation
- ✅ Model definitions

---

## 🎯 Key Improvements Made

1. ✅ Added Swagger docs for `/api/verify/status` (GET)
2. ✅ Added Swagger docs for `/api/deploy/research-paper` (POST)
3. ✅ Added Swagger docs for `/api/deploy/citation-registry` (POST)
4. ✅ Added Swagger docs for `/api/deploy/royalty-distributor` (POST)
5. ✅ Added Swagger docs for `/api/deploy/academic-suite` (POST)
6. ✅ Verified exclusion of Category 1 routes (Research Papers)
7. ✅ All essential API features documented (Categories 2-9)

---

## 📝 Notes

- All endpoints support CORS (all origins enabled)
- Request IDs tracked via `X-Request-Id` header
- Structured logging with Pino
- Error responses include `reqId` for debugging
- Job system supports SSE for real-time updates
- Deployment endpoints use queue system to prevent nonce collisions
- AI endpoints use Google Gemini 2.5 Pro model (configurable)
- Multi-network support: Basecamp, Base Sepolia, Boba Sepolia, Avalanche Fuji, BSC Testnet

---

**Last Updated**: December 2, 2025
