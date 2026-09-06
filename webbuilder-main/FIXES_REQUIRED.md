# 🔧 **Required Fixes for Production Deployment**

**Based on comprehensive integration testing on January 8, 2026**

---

## 🔴 **Critical Fix #1: AI Generation Endpoint 500 Error**

### **Problem:**
```
POST /api/ai/generate
Response: 500 Internal Server Error
```

### **Root Cause:**
The endpoint is likely missing error handling or AI API credentials are not configured.

### **Fix for Backend Server:**

**File:** `backend/routes/ai.py` or similar

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import asyncio
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class GenerateRequest(BaseModel):
    prompt: str
    model: str = "gpt-4"

@router.post("/api/ai/generate")
async def generate_contract(request: GenerateRequest):
    """
    Generate a smart contract from natural language prompt
    Fixed version with proper error handling
    """
    try:
        # Check if AI service is configured
        from config import settings
        
        if not settings.OPENAI_API_KEY and not settings.GOOGLE_API_KEY:
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "AI service not configured",
                    "message": "No AI API keys found. Please set OPENAI_API_KEY or GOOGLE_API_KEY"
                }
            )
        
        # Generate with timeout
        from services.ai_service import generate_solidity_contract
        
        logger.info(f"Generating contract with prompt length: {len(request.prompt)}")
        
        response = await asyncio.wait_for(
            generate_solidity_contract(request.prompt, request.model),
            timeout=120.0  # 2 minutes
        )
        
        return {
            "ok": True,
            "codeBlock": {
                "code": response["code"],
                "filename": response.get("filename", "Contract.sol"),
                "language": "solidity"
            }
        }
        
    except asyncio.TimeoutError:
        logger.error("AI generation timeout")
        raise HTTPException(
            status_code=504,
            detail={
                "error": "Generation timeout",
                "message": "AI service took too long to respond (>120s)"
            }
        )
    
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    
    except Exception as e:
        # Log the full error for debugging
        logger.error(f"AI generation error: {e}", exc_info=True)
        
        # Return a sanitized error to client
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Generation failed",
                "message": str(e) if len(str(e)) < 200 else "Internal server error",
                "type": type(e).__name__
            }
        )
```

### **Environment Variables Check:**

Add to your `.env` file:
```bash
# At least ONE of these must be set
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
ANTHROPIC_API_KEY=...

# Or use Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://...
AZURE_OPENAI_KEY=...
```

### **Verification:**

```bash
# Test the endpoint
curl -X POST https://evi-web-test-production.up.railway.app/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a simple ERC20 token",
    "model": "gpt-4"
  }'

# Should return 200 with contract code
# Not 500 error
```

---

## 🟡 **Important Fix #2: OpenZeppelin Dependency Pre-installation**

### **Problem:**
```
Error HH411: The library @openzeppelin/contracts@4.9.3 is not installed
```

### **Root Cause:**
Hardhat compilation sandbox doesn't have common Solidity libraries pre-installed.

### **Solution 1: Pre-install Dependencies (Recommended)**

**File:** `backend/services/hardhat_sandbox/package.json`

```json
{
  "name": "evi-hardhat-sandbox",
  "version": "1.0.0",
  "description": "Hardhat environment for contract compilation and deployment",
  "dependencies": {
    "hardhat": "^2.19.0",
    "@nomicfoundation/hardhat-toolbox": "^4.0.0",
    "@openzeppelin/contracts": "^4.9.3",
    "@openzeppelin/contracts-upgradeable": "^4.9.3",
    "@chainlink/contracts": "^0.8.0",
    "ethers": "^6.9.0"
  }
}
```

**Installation:**
```bash
cd backend/services/hardhat_sandbox
npm install
```

### **Solution 2: Auto-install on Demand**

**File:** `backend/services/contract_compiler.py`

```python
import subprocess
import re
from pathlib import Path

def auto_install_missing_dependencies(error_message: str, project_dir: Path) -> bool:
    """
    Parse compilation error and auto-install missing npm packages
    Returns True if dependency was installed
    """
    # Pattern: "The library @openzeppelin/contracts@4.9.3 is not installed"
    pattern = r'library ([^\s,]+)(?:@[^\s,]+)? is not installed'
    match = re.search(pattern, error_message)
    
    if not match:
        return False
    
    package_name = match.group(1)
    logger.info(f"Auto-installing missing dependency: {package_name}")
    
    try:
        # Install the package
        result = subprocess.run(
            ["npm", "install", "--save", package_name],
            cwd=str(project_dir),
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            logger.info(f"Successfully installed {package_name}")
            return True
        else:
            logger.error(f"Failed to install {package_name}: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        logger.error(f"Timeout installing {package_name}")
        return False
    except Exception as e:
        logger.error(f"Error installing {package_name}: {e}")
        return False

async def compile_with_auto_install(
    code: str,
    filename: str,
    project_dir: Path,
    max_retries: int = 3
) -> dict:
    """
    Compile contract with automatic dependency installation
    """
    for attempt in range(max_retries):
        try:
            result = await compile_contract(code, filename, project_dir)
            
            # If compilation succeeded, return
            if result.get("success"):
                return result
            
            # Check if error is due to missing dependency
            errors = result.get("errors", [])
            error_text = "\n".join(errors)
            
            if "is not installed" in error_text:
                # Try to install missing dependency
                if auto_install_missing_dependencies(error_text, project_dir):
                    logger.info(f"Retrying compilation (attempt {attempt + 1}/{max_retries})")
                    continue
            
            # If not a dependency issue, return the error
            return result
            
        except Exception as e:
            logger.error(f"Compilation error: {e}")
            return {"success": False, "errors": [str(e)]}
    
    return {
        "success": False,
        "errors": ["Failed to compile after installing dependencies"]
    }
```

### **Solution 3: Use Pre-built Docker Image**

**File:** `backend/Dockerfile.hardhat`

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install Hardhat and common dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Pre-install common Solidity libraries
RUN npm install --save \
    @openzeppelin/contracts@^4.9.3 \
    @openzeppelin/contracts-upgradeable@^4.9.3 \
    @chainlink/contracts@^0.8.0

# Copy Hardhat config
COPY hardhat.config.js ./

EXPOSE 8545

CMD ["npx", "hardhat", "node"]
```

### **Verification:**

```javascript
// Test compilation with OpenZeppelin
const code = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    constructor() ERC20("Test", "TEST") {
        _mint(msg.sender, 1000 * 10**18);
    }
}
`;

// Should compile without "is not installed" error
```

---

## 🟢 **Enhancement: Better Error Response Format**

### **Current Issue:**
Error responses are inconsistent across endpoints.

### **Standardized Error Response:**

**File:** `backend/middleware/error_handler.py`

```python
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import uuid
import logging

logger = logging.getLogger(__name__)

class APIError(Exception):
    """Base API error with standardized format"""
    
    def __init__(
        self,
        code: str,
        message: str,
        details: dict = None,
        status_code: int = 400
    ):
        self.code = code
        self.message = message
        self.details = details or {}
        self.status_code = status_code
        super().__init__(message)

async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
    """Handle custom API errors"""
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    
    logger.error(
        f"API Error [{exc.code}]: {exc.message}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "details": exc.details
        }
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
                "request_id": request_id
            }
        }
    )

async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Handle HTTP exceptions with standardized format"""
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail,
                "request_id": request_id
            }
        }
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle validation errors"""
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": {
                    "errors": exc.errors()
                },
                "request_id": request_id
            }
        }
    )

def setup_error_handlers(app):
    """Register all error handlers"""
    app.add_exception_handler(APIError, api_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
```

**Usage:**
```python
from middleware.error_handler import APIError

# In your route
if not settings.OPENAI_API_KEY:
    raise APIError(
        code="AI_SERVICE_NOT_CONFIGURED",
        message="AI service is not configured",
        details={"missing": "OPENAI_API_KEY or GOOGLE_API_KEY"},
        status_code=503
    )
```

---

## 📋 **Deployment Checklist**

### **Before Deploying to Production:**

#### ✅ **1. Environment Variables**
```bash
# Check all required variables are set on Railway
railway variables

# Required:
✓ OPENAI_API_KEY or GOOGLE_API_KEY
✓ DATABASE_URL
✓ E2B_API_KEY (for sandbox)
✓ JWT_SECRET_KEY
```

#### ✅ **2. Dependencies Installed**
```bash
# In Hardhat sandbox directory
cd backend/services/hardhat_sandbox
npm install

# Verify OpenZeppelin is installed
npm list @openzeppelin/contracts
# Should show: @openzeppelin/contracts@4.9.3
```

#### ✅ **3. Error Handling Updated**
```bash
# Check error handlers are registered
grep -r "add_exception_handler" backend/

# Should find:
# - APIError handler
# - HTTPException handler
# - ValidationError handler
```

#### ✅ **4. Run Integration Tests**
```bash
# Test Python client
python3 test_integrations.py

# Test E2E flow
python3 test_e2e_railway.py

# Test JS client
node evi-client.js --job <existing-job-id>
```

#### ✅ **5. Monitor Logs**
```bash
# After deployment, check for errors
railway logs --follow

# Look for:
# - "AI service not configured" (should not appear)
# - "is not installed" (should not appear)
# - Successful contract generation
# - Successful compilation
```

---

## 🚀 **Quick Deploy Commands**

### **Step 1: Apply Fixes**

```bash
# 1. Update AI generation endpoint with error handling
# (Apply Fix #1 code above)

# 2. Install OpenZeppelin in Hardhat sandbox
cd backend/services/hardhat_sandbox
npm install --save @openzeppelin/contracts@^4.9.3

# 3. Commit changes
git add .
git commit -m "fix: Add error handling for AI generation and pre-install OpenZeppelin"
```

### **Step 2: Set Environment Variables**

```bash
# On Railway
railway variables set OPENAI_API_KEY=sk-...
# OR
railway variables set GOOGLE_API_KEY=...
```

### **Step 3: Deploy**

```bash
# Push to Railway
git push railway main

# Or use Railway CLI
railway up
```

### **Step 4: Verify**

```bash
# Test AI generation
curl -X POST https://evi-web-test-production.up.railway.app/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create a simple ERC20 token"}'

# Should return 200, not 500

# Test OpenZeppelin import compilation
# Run: python3 test_integrations.py
# All tests should pass
```

---

## 📊 **Expected Results After Fixes**

### **Before Fixes:**
```
Python Integration Tests: 90% (9/10 passed)
- ❌ Contract generation: 500 error
- ⚠️  OpenZeppelin imports: Compilation fails
```

### **After Fixes:**
```
Python Integration Tests: 100% (10/10 passed)
- ✅ Contract generation: Working
- ✅ OpenZeppelin imports: Compilation succeeds
```

---

## 🎯 **Success Criteria**

After applying these fixes, you should see:

✅ **No 500 errors** on `/api/ai/generate`  
✅ **OpenZeppelin contracts compile** on first attempt  
✅ **All integration tests pass** (10/10)  
✅ **Full DApp creation works** end-to-end  
✅ **JavaScript client completes** full ACV pipeline  

---

**Document Version:** 1.0  
**Last Updated:** January 8, 2026  
**Status:** Ready to implement 🚀
