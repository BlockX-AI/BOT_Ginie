# 🎮 EVI Web Builder - Team Testing Guide

**Live URL:** http://evi-web-lovat.vercel.app

---

## 📋 Table of Contents
1. [Quick Start](#-quick-start-mobile--desktop)
2. [Build Process Observation](#-build-process-observation-guide)
3. [Estimated Build Times](#-estimated-build-times)
4. [Tool Call Monitoring](#-tool-call-monitoring-checklist)
5. [Side Viewer/Preview Checklist](#-side-viewerpreview-panel-checklist)
6. [Test Case: Sudoku Game](#-test-case-build-a-sudoku-puzzle-game)
7. [Mobile Testing Checklist](#-mobile-testing-checklist)
8. [UI/UX Checklist](#-uiux-testing-checklist)
9. [Performance Checklist](#-performance-testing-checklist)
10. [Web3 Features Checklist](#-web3-features-checklist)
11. [Error Handling Checklist](#-error-handling-checklist)
12. [Chat Interface Checklist](#-chat-interface-checklist)
13. [Deployment Checklist](#-deployment-checklist)
14. [Accessibility Checklist](#-accessibility-checklist)
15. [Cross-Browser Checklist](#-cross-browser-testing-checklist)
16. [Regression Checklist](#-regression-testing-checklist)

---

## 📱 Quick Start (Mobile & Desktop)

### Step 1: Open the App
1. Go to **http://evi-web-lovat.vercel.app** on your browser
2. Click **"Sign In"** (top right)
3. Login with Google or GitHub account

### Step 2: Create New Project
1. Click **"New Chat"** or **"+"** button
2. You'll see a chat interface (like ChatGPT)

---

## 🔍 Build Process Observation Guide

When you send a prompt, watch the chat for these **stages in order**:

### Build Pipeline Stages

| Stage | Icon | What You'll See | Est. Time |
|-------|------|-----------------|-----------|
| 1. **Started** | 🚀 | "Starting LangGraph workflow..." | 1-2 sec |
| 2. **Enhancing** | ✨ | "Enhancing your prompt..." | 5-15 sec |
| 3. **Planning** | 📋 | Shows component hierarchy & file list | 10-20 sec |
| 4. **Building** | 🔨 | Tool calls appear (create_file, etc.) | 1-3 min |
| 5. **Validating** | ✅ | "Running code validation..." | 10-30 sec |
| 6. **App Check** | 🔍 | "Checking application..." | 20-40 sec |
| 7. **Deploying** | 🚀 | "Deploying to Vercel..." | 30-60 sec |
| 8. **Complete** | 🎉 | Shows live URL! | - |

### What to Observe During Each Stage

#### Stage 1-2: Initialization
- [ ] "Started" message appears immediately after sending prompt
- [ ] No long delays before enhancement starts
- [ ] Enhancement shows improved/detailed version of your prompt

#### Stage 3: Planning
- [ ] Plan shows logical component structure
- [ ] All requested features are included in plan
- [ ] File names follow React conventions (.jsx)

#### Stage 4: Building (MOST IMPORTANT)
- [ ] Tool calls appear one by one
- [ ] Each file creation is logged
- [ ] Progress indicator shows activity
- [ ] No stuck/frozen state for > 60 seconds

#### Stage 5-6: Validation
- [ ] Errors (if any) are clearly shown
- [ ] Auto-retry happens for fixable errors
- [ ] Success message appears when clean

#### Stage 7-8: Deployment
- [ ] Vercel deployment starts automatically
- [ ] Progress updates during deployment
- [ ] Final URL is clickable

---

## ⏱️ Estimated Build Times

| Project Type | Complexity | Est. Time | Example |
|--------------|------------|-----------|---------|
| **Simple UI** | Low | 1-2 min | Landing page, static site |
| **Interactive App** | Medium | 2-4 min | Sudoku, Calculator, Todo |
| **Web3 App (No Contract)** | Medium | 3-5 min | Wallet connect + existing contract |
| **Web3 Game (With Contract)** | High | 5-8 min | New contract + frontend |
| **Complex DApp** | Very High | 8-12 min | Multi-contract, complex UI |

### Time Breakdown for Sudoku Game

```
┌─────────────────────────────────────────────────────┐
│  SUDOKU GAME BUILD (~3-4 minutes total)             │
├─────────────────────────────────────────────────────┤
│  Prompt Enhancement    ████░░░░░░░░░░░░░░  10 sec   │
│  Planning              ████████░░░░░░░░░░  20 sec   │
│  Building Files        ████████████████░░  2 min    │
│  Code Validation       ████░░░░░░░░░░░░░░  15 sec   │
│  App Check             ██████░░░░░░░░░░░░  30 sec   │
│  Vercel Deploy         ██████████░░░░░░░░  45 sec   │
└─────────────────────────────────────────────────────┘
```

### When to Be Concerned

| Situation | Wait Time | Action |
|-----------|-----------|--------|
| No response after prompt | > 30 sec | Refresh page, try again |
| Stuck on "Building" | > 5 min | May be complex, wait more |
| Stuck on "Deploying" | > 2 min | Check network, wait |
| Error message appears | - | Read error, modify prompt |
| Page becomes unresponsive | - | Refresh, start new chat |

---

## 🛠️ Tool Call Monitoring Checklist

During the **Building** phase, you'll see tool calls. Monitor these:

### Common Tool Calls You'll See

| Tool Name | Purpose | Success Indicator |
|-----------|---------|-------------------|
| `create_file` | Creates a new file | "Created file: src/..." |
| `read_file` | Reads existing file | Shows file content |
| `execute_command` | Runs npm/shell commands | "Command completed" |
| `list_directory` | Shows folder structure | Lists files/folders |
| `write_multiple_files` | Batch file creation | "Created X files" |
| `create_web3_boilerplate` | Sets up wagmi/wallet | "Web3 boilerplate created" |
| `save_contract_info` | Stores contract ABI | "Saved contract..." |
| `deploy_smart_contract` | Deploys to blockchain | Shows contract address |
| `deploy_game_contract` | Deploys game template | Shows contract + explorer |

### Tool Call Observation Checklist

- [ ] Tool calls appear in sequence
- [ ] Each tool shows input parameters
- [ ] Each tool shows output/result
- [ ] No repeated failed tool calls (> 3 times)
- [ ] Tool names match expected actions
- [ ] File paths are correct (src/components/...)
- [ ] No "undefined" or "null" in outputs
- [ ] Progress continues after each tool

### Tool Call Timing

| Tool | Expected Duration | Slow if > |
|------|-------------------|-----------|
| `create_file` | 1-3 sec | 10 sec |
| `read_file` | 1-2 sec | 5 sec |
| `execute_command` | 2-30 sec | 60 sec |
| `deploy_smart_contract` | 30-90 sec | 3 min |
| `deploy_game_contract` | 20-60 sec | 2 min |

### Red Flags to Report

- [ ] Same tool called > 5 times in a row
- [ ] Tool errors with no retry
- [ ] "Failed to create file" messages
- [ ] Empty tool outputs
- [ ] Tool stuck with no completion

---

## 👁️ Side Viewer/Preview Panel Checklist

The side panel shows live preview of your app being built.

### Side Panel Features to Test

#### Panel Visibility & Controls
- [ ] Side panel opens automatically when build starts
- [ ] Panel can be resized (drag border)
- [ ] Panel can be collapsed/expanded
- [ ] Refresh button works
- [ ] Open in new tab button works
- [ ] URL is displayed correctly

#### Live Preview During Build
- [ ] Preview loads initial template
- [ ] Preview updates as files are created
- [ ] Changes reflect within 2-5 seconds
- [ ] No blank/white screen for > 30 sec
- [ ] Error overlay shows build errors clearly
- [ ] Hot reload works (auto-refresh on changes)

#### Preview Functionality
- [ ] App renders correctly in preview
- [ ] Interactive elements work (buttons, inputs)
- [ ] Navigation works (if multi-page)
- [ ] Responsive - can resize preview panel
- [ ] Touch simulation works (mobile preview)

#### Preview URL
- [ ] Temporary E2B URL shows during build
- [ ] URL format: `https://xxxxx-5173.e2b.dev`
- [ ] URL is accessible in browser
- [ ] Final Vercel URL replaces E2B URL

### Preview Error States

| Error | What You See | What to Do |
|-------|--------------|------------|
| Blank screen | White/empty panel | Wait, may be loading |
| "Refused to connect" | Browser error | Sandbox starting, wait |
| Red error overlay | Build error message | Check chat for details |
| Infinite loading | Spinner forever | Refresh preview |
| 404 Not Found | Page doesn't exist | Wrong route, check App.jsx |

---

## 🧩 Test Case: Build a Sudoku Puzzle Game

### Option A: Simple Sudoku (No Blockchain)

Type this prompt in the chat:

```
Build a mobile-friendly Sudoku puzzle game with these features:

1. 9x9 grid with beautiful UI
2. Three difficulty levels: Easy, Medium, Hard
3. Auto-generate valid Sudoku puzzles
4. Highlight row, column, and 3x3 box when cell is selected
5. Number pad for input (touch-friendly for mobile)
6. Timer to track solving time
7. Hint button (max 3 hints per game)
8. Check solution button
9. New game button
10. Dark mode support
11. Celebrate animation when puzzle is solved

Make it responsive for mobile phones with large touch targets.
Use Tailwind CSS for styling with a clean, modern look.
```

### Option B: Web3 Sudoku Game (With Blockchain)

Type this prompt for a blockchain-based version:

```
Create a Web3 Sudoku puzzle game on basecamp network with:

GAME FEATURES:
1. 9x9 Sudoku grid with mobile-friendly UI
2. Difficulty levels: Easy (30 empty), Medium (45 empty), Hard (55 empty)
3. Touch-friendly number input pad
4. Timer and move counter
5. Hint system (limited hints)
6. Solution validation
7. Celebration animation on completion

WEB3 FEATURES:
1. Wallet connection (MetaMask/WalletConnect)
2. Submit score on-chain after solving
3. Leaderboard showing top solvers
4. NFT badge for completing puzzles under certain time

Deploy the smart contract and create the full React frontend.
Make everything mobile responsive with large buttons.
```

---

## ⏳ What Happens After You Send the Prompt

You'll see these stages in the chat:

| Stage | What You'll See |
|-------|-----------------|
| 🔄 **Enhancing** | "Enhancing your prompt..." |
| 📋 **Planning** | Shows component structure |
| 🔨 **Building** | Creates files one by one |
| ✅ **Validating** | Checks for errors |
| 🚀 **Deploying** | "Deploying to Vercel..." |
| 🎉 **Done** | Shows live URL! |

**Wait Time:** 2-5 minutes depending on complexity

---

## 📱 Mobile Testing Checklist

After the game is deployed, test these on your phone:

### Touch & Interaction
- [ ] Can tap cells easily (not too small)
- [ ] Number pad buttons are large enough (min 44px)
- [ ] Swipe gestures work (if any)
- [ ] No accidental double-taps
- [ ] Long press doesn't trigger unwanted actions
- [ ] Pinch-to-zoom disabled where appropriate
- [ ] Touch feedback visible (button press states)

### Screen & Layout
- [ ] Text is readable without zooming (min 16px)
- [ ] Grid fits on screen without horizontal scroll
- [ ] Buttons have enough spacing (min 8px gap)
- [ ] Colors have good contrast (4.5:1 ratio)
- [ ] No content cut off at edges
- [ ] Safe area respected (notch/home indicator)

### Responsiveness
- [ ] Portrait mode works perfectly
- [ ] Landscape mode works (if supported)
- [ ] Rotating phone doesn't break layout
- [ ] Content reflows properly on rotation
- [ ] Keyboard doesn't obscure inputs

### Mobile Performance
- [ ] Game loads in < 3 seconds on 4G
- [ ] No lag when selecting cells
- [ ] Timer updates smoothly (no jank)
- [ ] Animations run at 60fps
- [ ] No excessive battery drain
- [ ] Works offline after first load (if PWA)

### Mobile Web3 (if applicable)
- [ ] MetaMask mobile app connects
- [ ] WalletConnect QR code works
- [ ] Deep link to MetaMask works
- [ ] Transaction confirmation appears
- [ ] Network switching prompt works
- [ ] Correct chain ID displayed

### Device-Specific Testing

| Device Type | Screen Size | Test Priority |
|-------------|-------------|---------------|
| iPhone SE | 375px | High (small screen) |
| iPhone 14 | 390px | High (common) |
| iPhone 14 Pro Max | 430px | Medium |
| Samsung S23 | 360px | High |
| Pixel 7 | 412px | Medium |
| iPad Mini | 744px | Low |

---

## 🎨 UI/UX Testing Checklist

### Visual Design
- [ ] Consistent color scheme throughout
- [ ] Proper visual hierarchy (headings, text, buttons)
- [ ] Icons are clear and meaningful
- [ ] Images load properly (no broken images)
- [ ] Loading states are visible (spinners, skeletons)
- [ ] Empty states have helpful messages
- [ ] Success/error states are clearly indicated

### Typography
- [ ] Font loads correctly (no FOUT/FOIT)
- [ ] Text is legible at all sizes
- [ ] Line height is comfortable (1.5 for body)
- [ ] No text overflow or truncation issues
- [ ] Proper text alignment

### Interactive Elements
- [ ] Buttons look clickable (affordance)
- [ ] Hover states work (desktop)
- [ ] Focus states visible (keyboard navigation)
- [ ] Active/pressed states visible
- [ ] Disabled states are clear
- [ ] Links are distinguishable from text

### Forms & Inputs
- [ ] Input fields have labels
- [ ] Placeholder text is helpful
- [ ] Validation errors are clear
- [ ] Required fields are marked
- [ ] Auto-focus works on first input
- [ ] Tab order is logical

### Navigation
- [ ] Current page/state is indicated
- [ ] Back button works as expected
- [ ] No dead-end screens
- [ ] Easy to return to home/main screen

### Feedback & Communication
- [ ] Actions have immediate feedback
- [ ] Success messages appear
- [ ] Error messages are helpful
- [ ] Loading progress is shown
- [ ] Confirmations for destructive actions

---

## ⚡ Performance Testing Checklist

### Load Time Metrics

| Metric | Target | Poor if > |
|--------|--------|-----------|
| First Contentful Paint (FCP) | < 1.5s | 3s |
| Largest Contentful Paint (LCP) | < 2.5s | 4s |
| Time to Interactive (TTI) | < 3s | 5s |
| Total Blocking Time (TBT) | < 200ms | 500ms |

### Performance Checks
- [ ] Page loads under 3 seconds (4G)
- [ ] No layout shifts during load (CLS < 0.1)
- [ ] Images are optimized/lazy-loaded
- [ ] JavaScript bundle is not too large (< 500KB)
- [ ] No memory leaks during gameplay
- [ ] Smooth scrolling (60fps)
- [ ] Animations don't cause jank

### Network Conditions
- [ ] Works on slow 3G (with loading states)
- [ ] Handles offline gracefully
- [ ] No excessive API calls
- [ ] Proper error handling for network failures

### How to Test Performance

1. **Chrome DevTools:**
   - Press F12 → Performance tab → Record
   - Lighthouse tab → Generate report

2. **Mobile Testing:**
   - Chrome DevTools → Network → Slow 3G
   - Test actual device on cellular

---

## 🔗 Web3 Features Checklist

### Wallet Connection
- [ ] "Connect Wallet" button is visible
- [ ] Multiple wallet options shown (MetaMask, WalletConnect)
- [ ] Connection modal appears on click
- [ ] Wallet address shows after connection
- [ ] Truncated address format (0x1234...5678)
- [ ] Copy address button works
- [ ] Disconnect option available
- [ ] Reconnects on page refresh

### Network Handling
- [ ] Correct network name displayed
- [ ] Wrong network warning appears
- [ ] "Switch Network" button works
- [ ] Network switch prompt opens wallet
- [ ] Chain ID matches expected (84532 for basecamp)

### Transaction Flow
- [ ] Transaction button is clear
- [ ] Loading state during transaction
- [ ] Wallet popup appears for approval
- [ ] Pending state shown while mining
- [ ] Success message with tx hash
- [ ] Link to block explorer works
- [ ] Error handling for rejected tx
- [ ] Gas estimation shown (if applicable)

### Contract Interactions
- [ ] Read functions return data
- [ ] Write functions trigger wallet
- [ ] Events are captured correctly
- [ ] Contract errors are displayed
- [ ] Retry option for failed transactions

### Web3 Error States

| Error | User Message | Recovery |
|-------|--------------|----------|
| No wallet | "Please install MetaMask" | Link to install |
| User rejected | "Transaction cancelled" | Try again button |
| Insufficient funds | "Not enough ETH" | Show balance needed |
| Wrong network | "Please switch to X" | Switch button |
| Contract error | "Transaction failed: reason" | Retry button |

---

## ⚠️ Error Handling Checklist

### Build-Time Errors
- [ ] Syntax errors are displayed clearly
- [ ] File path is shown for errors
- [ ] Line number indicated
- [ ] Auto-fix is attempted
- [ ] Error doesn't crash the entire build

### Runtime Errors
- [ ] App doesn't show white screen on error
- [ ] Error boundary catches React errors
- [ ] User-friendly error message shown
- [ ] "Try Again" or "Go Back" option
- [ ] Errors are logged (visible in chat)

### Network Errors
- [ ] "No internet" message shown
- [ ] Retry button available
- [ ] Cached data shown if available
- [ ] Timeout errors handled

### User Input Errors
- [ ] Invalid input highlighted
- [ ] Error message near the field
- [ ] Explains what's wrong
- [ ] Suggests how to fix

### Error Recovery Testing

| Scenario | Expected Behavior |
|----------|-------------------|
| Refresh during build | Resumes or restarts cleanly |
| Close tab during build | Can reopen and continue |
| Network disconnect | Shows offline message |
| Server error (500) | Shows retry option |
| Invalid prompt | Helpful error message |

---

## 💬 Chat Interface Checklist

### Message Display
- [ ] User messages aligned right (or distinct)
- [ ] AI messages aligned left (or distinct)
- [ ] Timestamps visible (optional)
- [ ] Messages don't overlap
- [ ] Long messages wrap properly
- [ ] Code blocks formatted correctly
- [ ] Links are clickable

### Input Area
- [ ] Text input is visible
- [ ] Placeholder text helpful
- [ ] Send button works
- [ ] Enter key sends message
- [ ] Shift+Enter for new line
- [ ] Input clears after send
- [ ] Can't send empty message

### Tool Calls Display
- [ ] Tool name clearly shown
- [ ] Tool inputs visible (expandable)
- [ ] Tool outputs visible
- [ ] Success/failure indicated
- [ ] Collapsible for long outputs

### Chat History
- [ ] Previous messages load on return
- [ ] Scroll to bottom on new message
- [ ] Can scroll up to see history
- [ ] No duplicate messages
- [ ] Messages persist after refresh

### Chat Actions
- [ ] New chat button works
- [ ] Chat title shown
- [ ] Can switch between chats
- [ ] Delete chat option (if available)

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] Build completes without errors
- [ ] All files are created
- [ ] Package.json has all dependencies
- [ ] No TypeScript errors (if using TS)

### During Deployment
- [ ] "Deploying to Vercel" message appears
- [ ] Progress indication shown
- [ ] No timeout during deployment
- [ ] Deployment completes in < 2 min

### Post-Deployment
- [ ] Vercel URL is returned
- [ ] URL is clickable in chat
- [ ] URL format: `https://project-name.vercel.app`
- [ ] App loads at the URL
- [ ] All features work on deployed version
- [ ] No CORS errors
- [ ] Environment variables work

### Deployment Verification

| Check | How to Verify |
|-------|---------------|
| App loads | Visit URL, see content |
| Routing works | Navigate to different pages |
| API calls work | Check network tab |
| Assets load | Check images, fonts |
| Web3 works | Connect wallet |

### Vercel URL States

| State | Meaning |
|-------|---------|
| `xxx.vercel.app` | Production deployment |
| `xxx-git-xxx.vercel.app` | Preview deployment |
| URL not returned | Deployment failed |

---

## ♿ Accessibility Checklist

### Keyboard Navigation
- [ ] All interactive elements focusable
- [ ] Tab order is logical
- [ ] Focus indicator visible
- [ ] No keyboard traps
- [ ] Escape closes modals
- [ ] Enter activates buttons

### Screen Reader
- [ ] Page has proper headings (h1, h2, h3)
- [ ] Images have alt text
- [ ] Buttons have labels
- [ ] Form fields have labels
- [ ] ARIA labels where needed

### Visual Accessibility
- [ ] Color contrast ratio ≥ 4.5:1
- [ ] Not relying only on color
- [ ] Text resizable to 200%
- [ ] No flashing content

### Motion & Animation
- [ ] Respects prefers-reduced-motion
- [ ] Animations can be disabled
- [ ] No auto-playing videos with sound

---

## 🌐 Cross-Browser Testing Checklist

### Desktop Browsers

| Browser | Version | Priority | Status |
|---------|---------|----------|--------|
| Chrome | Latest | High | [ ] |
| Firefox | Latest | Medium | [ ] |
| Safari | Latest | High | [ ] |
| Edge | Latest | Medium | [ ] |

### Mobile Browsers

| Browser | Platform | Priority | Status |
|---------|----------|----------|--------|
| Chrome | Android | High | [ ] |
| Safari | iOS | High | [ ] |
| Samsung Internet | Android | Low | [ ] |
| Firefox | Android | Low | [ ] |

### Cross-Browser Issues to Check
- [ ] Layout is consistent
- [ ] Fonts render correctly
- [ ] CSS animations work
- [ ] JavaScript features work
- [ ] Wallet connection works
- [ ] Touch events work (mobile)

---

## 🔄 Regression Testing Checklist

After any changes or follow-up prompts, verify:

### Core Functionality
- [ ] Previous features still work
- [ ] No new errors introduced
- [ ] UI hasn't broken
- [ ] Navigation still works
- [ ] Data persists correctly

### Web3 Regression (if applicable)
- [ ] Wallet still connects
- [ ] Contract calls still work
- [ ] Network detection works
- [ ] Transaction flow intact

### Performance Regression
- [ ] Load time hasn't increased significantly
- [ ] No new memory leaks
- [ ] Animations still smooth

---

## 🔗 Testing the Generated Game

Once you get the **Vercel URL** (e.g., `https://sudoku-game-xyz.vercel.app`):

1. **Copy the link** from chat
2. **Open on mobile** - Send link to yourself via WhatsApp/Telegram
3. **Test all features** - Use the checklist above
4. **Share with friends** - They can play without any setup!

---

## 🛠️ Troubleshooting

### "Build Failed" Error
- Try simplifying your prompt
- Check if you're asking for unsupported features
- Start a new chat and try again

### Game Doesn't Load on Mobile
- Clear browser cache
- Try Chrome or Safari
- Check internet connection

### Wallet Won't Connect
- Make sure MetaMask app is installed
- Use WalletConnect option instead
- Check you're on correct network (basecamp)

### UI Looks Broken on Mobile
- Report specific issue in chat: "The number pad is too small on mobile, please make buttons larger"
- The AI will fix and redeploy

---

## 📝 Test Prompts Library

### Simple Games (No Web3)
```
Build a 2048 puzzle game with swipe controls for mobile
```

```
Create a Tic-Tac-Toe game with AI opponent, mobile friendly
```

```
Make a memory card matching game with 16 cards, touch optimized
```

### Web3 Games
```
Create a coin flip betting game on basecamp with wallet connect
```

```
Build an on-chain rock-paper-scissors game with ETH betting
```

```
Make an NFT minting page for a pixel art collection
```

---

## 📊 Testing Report Template

After testing, share feedback in this format:

```
## Test Report - [Your Name]
Date: [Date]
Device: [iPhone 14 / Samsung S23 / etc.]
Browser: [Chrome Mobile / Safari]

### Game Tested: Sudoku Puzzle
Live URL: [paste URL]

### What Worked ✅
- [List features that work well]

### Issues Found ❌
- [List bugs or problems]

### Suggestions 💡
- [Improvement ideas]

### Overall Rating: ⭐⭐⭐⭐☆ (4/5)
```

---

## 🎯 Quick Commands for Iterating

If something needs fixing, use these follow-up prompts:

| Issue | Follow-up Prompt |
|-------|------------------|
| Buttons too small | "Make all buttons at least 48px tall for better mobile touch" |
| Colors hard to see | "Increase contrast and use darker colors for the grid" |
| Game too slow | "Optimize performance, reduce re-renders" |
| Need dark mode | "Add a dark mode toggle" |
| Wallet issues | "Fix wallet connection, add WalletConnect v2 support" |

---

## 🚀 Let's Test!

1. Open http://evi-web-lovat.vercel.app
2. Login
3. Paste the Sudoku prompt
4. Wait for deployment
5. Test on mobile
6. Report findings!

**Happy Testing! 🎮**
