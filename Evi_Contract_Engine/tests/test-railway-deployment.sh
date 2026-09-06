#!/bin/bash

# Test Railway Deployment - Comprehensive Test Suite
# URL: https://evi-wallet-production.up.railway.app

BASE_URL="https://evi-wallet-production.up.railway.app"

echo "🚀 Testing Railway Deployment: $BASE_URL"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TOTAL=0
PASSED=0
FAILED=0

test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_code=$5
    
    TOTAL=$((TOTAL + 1))
    echo -n "Testing: $name ... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_code" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $http_code)"
        PASSED=$((PASSED + 1))
        if [ ! -z "$body" ]; then
            echo "   Response: $(echo $body | head -c 100)..."
        fi
    else
        echo -e "${RED}❌ FAIL${NC} (Expected $expected_code, got $http_code)"
        FAILED=$((FAILED + 1))
        echo "   Response: $body"
    fi
    echo ""
}

echo "=== BASIC HEALTH CHECKS ==="
test_endpoint "Root endpoint" "GET" "/" "" "200"
test_endpoint "API docs JSON" "GET" "/api-docs.json" "" "200"
test_endpoint "Swagger UI" "GET" "/api-docs" "" "200"

echo ""
echo "=== WALLET ENDPOINTS ==="
test_endpoint "Wallet session stats" "GET" "/api/wallet/sessions/stats" "" "200"

echo ""
echo "=== AI ENDPOINTS ==="
test_endpoint "AI generate (no prompt - should fail)" "POST" "/api/ai/generate" '{}' "400"
test_endpoint "AI compile (no code - should fail)" "POST" "/api/ai/compile" '{}' "400"

echo ""
echo "=== JOB ENDPOINTS ==="
test_endpoint "Get non-existent job" "GET" "/api/job/fake_job_id" "" "404"

echo ""
echo "=== ARTIFACT ENDPOINTS ==="
test_endpoint "List artifacts" "GET" "/api/artifacts" "" "200"
test_endpoint "List sources" "GET" "/api/artifacts/sources" "" "200"
test_endpoint "List ABIs" "GET" "/api/artifacts/abis" "" "200"

echo ""
echo "=== AUDIT ENDPOINTS ==="
test_endpoint "Audit analyze (no code - should fail)" "POST" "/api/audit/analyze" '{}' "400"

echo ""
echo "=== COMPLIANCE ENDPOINTS ==="
test_endpoint "Compliance analyze (no code - should fail)" "POST" "/api/compliance/analyze" '{}' "400"

echo ""
echo "=== STATIC FILES ==="
test_endpoint "Demo page" "GET" "/demo-wallet-deploy.html" "" "404"
echo -e "${YELLOW}⚠️  Static files not being served correctly${NC}"
echo ""

echo "=================================================="
echo "📊 TEST SUMMARY"
echo "=================================================="
echo "Total Tests: $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
else
    echo -e "${YELLOW}⚠️  Some tests failed - review above${NC}"
fi

echo ""
echo "=== FULL WALLET DEPLOYMENT TEST ==="
echo "This requires GEMINI_API_KEY to be set in Railway environment"
echo ""
echo "Test command:"
echo "curl -X POST $BASE_URL/api/wallet/deploy-with-wallet \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{"
echo "    \"prompt\": \"Create an ERC20 token named TestToken with symbol TEST\","
echo "    \"network\": \"basecamp-testnet\""
echo "  }'"
echo ""

echo "=== QUICK MANUAL TESTS ==="
echo "1. Visit Swagger UI: $BASE_URL/api-docs"
echo "2. Check session stats: $BASE_URL/api/wallet/sessions/stats"
echo "3. Check health: $BASE_URL/"
