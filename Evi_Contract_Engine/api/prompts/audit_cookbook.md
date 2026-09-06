# Smart Contract Security Audit Cookbook

Based on real issues found in our reviews. Practical checklist for auditors.

-----

## 🔴 CRITICAL CHECKS (Stop deployment if found)

### 1. **Reentrancy Vulnerabilities**

**Check:**

- [ ] External calls before state updates?
- [ ] Missing `nonReentrant`  modifier on functions that transfer ETH/tokens?
- [ ] Checks-Effects-Interactions pattern violated?

**Red flags:**

```solidity
// BAD
function withdraw() external {
    (bool success,) = msg.sender.call{value: balance[msg.sender]}("");
    balance[msg.sender] = 0; // State updated AFTER external call
}

// GOOD
function withdraw() external nonReentrant {
    uint256 amount = balance[msg.sender];
    balance[msg.sender] = 0; // State first
    (bool success,) = msg.sender.call{value: amount}("");
}
```

### 2. **Fund Loss Scenarios**

**Check:**

- [ ] Can funds be locked permanently?
- [ ] Is there a withdrawal function for every deposit path?
- [ ] Recovery functions account for active balances?

**Example from our reviews:**

```solidity
// CRITICAL BUG FOUND
function recoverExcessETH() external {
    owner.call{value: address(this).balance}(""); // Steals ALL funds!
}

// CORRECT
function recoverExcessETH() external {
    uint256 activeFunds = calculateActiveCampaignBalances();
    uint256 excess = address(this).balance - activeFunds;
    require(excess > 0, "No excess");
    owner.call{value: excess}("");
}
```

### 3. **Withdrawal Logic Bugs**

**We found this exact bug:**

```solidity
// BLOCKER - Sends 0 ETH!
function claim() external {
    claims[msg.sender] = 0;  // Zeroed first
    msg.sender.call{value: claims[msg.sender]}(""); // Sends 0!
}

// FIX
function claim() external {
    uint256 amount = claims[msg.sender];
    claims[msg.sender] = 0;
    msg.sender.call{value: amount}("");
}
```

### 4. **Arithmetic Issues**

**Check:**

- [ ] Underflow possible? (even in 0.8.x with custom assembly)
- [ ] Division before multiplication (precision loss)?
- [ ] Unchecked blocks hiding overflows?

**Found in our reviews:**

```solidity
// BUG: Underflow if choiceP1 = 0
if (choiceP1 - 1 == choiceP2 % 3) { ... }

// FIX: Validate inputs first
require(choiceP1 >= 1 && choiceP1 <= 3, "Invalid choice");
```

### 5. **Logic Errors in Core Functions**

**We found winner calculation was 66% wrong:**

```solidity
// BROKEN LOGIC
if (choiceP1-1 == choiceP2%3) { // Wrong math
    winner = player1;
}

// CORRECT LOGIC (from Contract #1)
if ((p1 == 1 && p2 == 3) || 
    (p1 == 2 && p2 == 1) || 
    (p1 == 3 && p2 == 2)) {
    winner = player1;
}
```

-----

## 🟠 HIGH SEVERITY CHECKS

### 6. **Access Control**

**Check:**

- [ ] Owner can’t be renounced to 0x0?
- [ ] Multi-sig for critical functions?
- [ ] Role boundaries properly enforced?
- [ ] One person shouldn’t control everything

**Centralization we flagged:**

```solidity
// RISKY
function setVerifier(address v) external onlyOwner {
    verifier = IVerifier(v); // Can swap to malicious mid-game!
}

// SAFER
- Make immutable, OR
- Add timelock, OR
- Store per-game at creation
```

### 7. **Front-Running Vulnerabilities**

**Issue found in RPS game:**

- Player 1 reveals choice
- Player 2 sees in mempool
- Player 2 decides whether to reveal based on if they’ll win

**Solutions:**

- Commit-reveal-reveal (both commit to reveal time)
- Submarine sends
- Time-bound reveals

### 8. **Input Validation**

**Check every function:**

- [ ] Zero address checks on addresses?
- [ ] Amount > 0 checks?
- [ ] Array length validations?
- [ ] Enum value in range?
- [ ] String length limits?

**Missing validation we found:**

```solidity
// BAD
function revealChoice(uint8 choice, ...) external {
    playerInfo.choice = choice; // Could be 0 or 255!
}

// GOOD
function revealChoice(uint8 choice, ...) external {
    require(choice >= 1 && choice <= 3, "Invalid");
    playerInfo.choice = choice;
}
```

### 9. **Hash Verification**

**Critical bug we found:**

```solidity
// BROKEN - Missing keccak256!
function computeHash(uint64[4] memory encoded) internal pure returns (bytes32) {
    return bytes32(abi.encodePacked(encoded[0], encoded[1], encoded[2], encoded[3]));
    // This is NOT a hash, just packed bytes!
}

// CORRECT
function computeHash(uint64[4] memory encoded) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(encoded[0], encoded[1], encoded[2], encoded[3]));
}
```

-----

## 🟡 MEDIUM SEVERITY CHECKS

### 10. **Timestamp Dependence**

**Check:**

- [ ] Critical logic uses `block.timestamp` ?
- [ ] Miner manipulation possible?
- [ ] Use block numbers for time-sensitive operations?

### 11. **Gas Limitations**

**Check:**

- [ ] Unbounded loops?
- [ ] Arrays that grow indefinitely?
- [ ] O(n²) complexity?

**We found these gas bombs:**

```solidity
// GAS BOMB - O(n²)
for (uint i = 0; i < donors.length; i++) {
    for (uint j = 0; j < i; j++) { // Nested!
        if (donors[j] == donors[i]) { ... }
    }
}

// SOLUTION: Use mapping or off-chain indexing
```

### 12. **Refund Accounting**

**Bug pattern we discovered:**

```solidity
// BROKEN - Balance out of sync
function refund() external {
    uint256 amount = donations[msg.sender];
    donations[msg.sender] = 0;
    // MISSING: totalRaised -= amount;
    msg.sender.call{value: amount}("");
}
```

### 13. **Pause Mechanisms**

**Check:**

- [ ] What pauses? (donations, withdrawals, both?)
- [ ] Can pause be abused?
- [ ] Emergency unpause path?

-----

## 🟢 LOW/INFO CHECKS

### 14. **Storage Optimization**

**Check:**

- [ ] Variables packed efficiently?
- [ ] Can use smaller types?
- [ ] Unnecessary storage reads?

**Example:**

```solidity
// UNOPTIMIZED (4 slots)
struct Deadlines {
    uint256 join;    // slot 0
    uint256 commit;  // slot 1
    uint256 proof;   // slot 2
    uint256 reveal;  // slot 3
}

// OPTIMIZED (1 slot)
struct Deadlines {
    uint64 join;     // \
    uint64 commit;   //  } All in slot 0
    uint64 proof;    // /
    uint64 reveal;   // /
}
```

### 15. **Event Emissions**

**Check:**

- [ ] All state changes emit events?
- [ ] Indexed parameters for filtering?
- [ ] Sensitive data in events?

### 16. **Error Messages vs Custom Errors**

**Gas efficiency:**

```solidity
// EXPENSIVE
require(amount > 0, "Amount must be greater than zero");

// CHEAP (0.8.4+)
error InvalidAmount();
if (amount == 0) revert InvalidAmount();
```

-----

## 📋 PATTERN-SPECIFIC CHECKS

### For Donation/Crowdfunding:

- [ ] Goal enforcement (cap vs target)?
- [ ] Refund conditions clear?
- [ ] Time limits on campaigns?
- [ ] Withdrawal limits/timelocks?
- [ ] Fee calculations correct?
- [ ] Can beneficiary drain instantly?

### For Commit-Reveal Schemes:

- [ ] Hash verification correct?
- [ ] Reveal deadline enforced?
- [ ] Front-running prevented?
- [ ] Timeout handling?
- [ ] Salt uniqueness?

### For Role-Based Systems:

- [ ] Role hierarchy correct?
- [ ] Can’t lock out all admins?
- [ ] Role changes logged?
- [ ] Emergency role exists?

-----

## 🔍 CODE QUALITY CHECKS

### 17. **Compilation**

- [ ] Actually compiles?
- [ ] No syntax errors? (check for `*`  vs `_`  typos)
- [ ] Correct pragma version?
- [ ] All imports resolve?

**Real bug from our review:**

```solidity
// DOESN'T COMPILE
uint256 private constant *NOT*ENTERED = 1;
*status = *ENTERED;

// Should be:
uint256 private constant _NOT_ENTERED = 1;
_status = _ENTERED;
```

### 18. **Testing Evidence**

- [ ] Unit tests exist?
- [ ] Edge cases covered?
- [ ] Integration tests?
- [ ] Fuzzing performed?

### 19. **Documentation**

- [ ] NatSpec on all functions?
- [ ] State variables documented?
- [ ] Architecture diagram?
- [ ] Known limitations listed?

-----

## 🎯 QUICK AUDIT CHECKLIST

**30-Minute Scan:**

```
□ Compiles without errors
□ No external calls before state updates
□ Input validation on all functions
□ Access control on admin functions
□ No obvious arithmetic issues
□ Withdrawal logic tested manually
□ Events on all state changes
□ No unbounded loops
```

**Full Audit (4-8 hours):**

```
□ All items above
□ Test each function with edge cases
□ Check for front-running
□ Verify all hash operations
□ Test refund flows
□ Verify access control boundaries
□ Check storage layout
□ Review gas costs
□ Verify emergency procedures
□ Check upgrade mechanisms
□ Review external dependencies
```

-----

## 📊 SCORING RUBRIC (Out of 100)

**Security: 40 points**

- Critical bugs: -20 each
- High severity: -5 each
- Medium: -2 each
- Low: -0.5 each

**Functionality: 25 points**

- Core features work: 15pts
- Edge cases handled: 5pts
- Error handling: 5pts

**Code Quality: 20 points**

- Documentation: 5pts
- Readability: 5pts
- Best practices: 5pts
- Testing: 5pts

**Gas Efficiency: 15 points**

- Storage optimization: 5pts
- Logic efficiency: 5pts
- No gas bombs: 5pts

**Grade Scale:**

- 95-100: A+ (Production ready)
- 90-94: A (Audit, then deploy)
- 85-89: B+ (Fix issues, re-audit)
- 80-84: B (Multiple issues)
- 75-79: C+ (Significant work needed)
- 70-74: C (Major overhaul)
- <70: F (Don’t deploy)

-----

## 🚨 INSTANT FAIL CONDITIONS

Deploy these = career risk:

1. Funds can be locked permanently
1. Critical logic is broken (wrong winners, incorrect math)
1. Reentrancy without protection
1. Access control bypass possible
1. Doesn’t compile
1. Obvious copy-paste errors unfixed

-----

## 📝 COMMON PATTERNS FROM OUR REVIEWS

### Pattern 1: The “Claim Bug”

Setting balance to 0 before reading it

### Pattern 2: The “Recovery Drain”

Emergency recovery that steals active funds

### Pattern 3: The “Hash Fail”

Missing keccak256 in hash verification

### Pattern 4: The “Math Miss”

Game logic with 66% wrong outcomes

### Pattern 5: The “Syntax Slip”

Copy-paste `*`  instead of `_`  Stiud

### Pattern 6: The “Gas Bomb”

O(n²) loops that hit gas limits

### Pattern 7: The “Refund Ghost”

Refunds issued but totals not updated

-----

## 🎓 AUDITOR TRAINING

**Before your first audit:**

1. Compile and deploy each contract we reviewed
1. Try to exploit each bug we found
1. Understand why fixes work
1. Practice writing exploit PoCs

**Red flags to memorize:**

- External calls before state changes
- Missing input validation
- Unbounded loops
- Centralized control
- Missing withdrawal functions
- Hash operations without keccak256
- Balance reads after zeroing

**Always ask:**

- Can I drain all funds?
- Can I lock funds forever?
- Can I front-run this?
- What happens at the edges?
- Does the math actually work?

-----

## Final Checklist

```
BEFORE SIGNING OFF:
□ I've tried to break every function
□ I've checked all our common bug patterns
□ I've verified the math with pen and paper
□ I've tested edge cases (0, max uint, etc.)
□ I've checked for centralization risks
□ I've verified access controls
□ I've run a gas profiler
□ I've read the code 3 times
□ I've questioned every assumption
□ I'm confident recommending deployment (or not)
```

**Remember:** Your signature protects users’ money. When in doubt, dig deeper.​​​​​​​​​​​​​​​​
