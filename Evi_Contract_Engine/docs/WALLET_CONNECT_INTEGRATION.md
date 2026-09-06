# 🔌 Wallet Connect Integration Guide

This guide shows you how to integrate **Privy** and **WalletConnect** for better wallet connectivity.

---

## 🌟 Option 1: Privy (RECOMMENDED)

**Why Privy?**
- ✅ Email login (no wallet needed!)
- ✅ Social login (Google, Twitter, Discord)
- ✅ Embedded wallets (auto-created)
- ✅ Better UX for non-crypto users
- ✅ Mobile-friendly

### **Setup Steps**

#### 1. Get Privy Account

```bash
# Go to https://dashboard.privy.io
# 1. Sign up
# 2. Create new app
# 3. Copy your App ID
```

#### 2. Install Privy SDK

```bash
cd api
npm install @privy-io/react-auth @privy-io/js
```

#### 3. Add to Environment

```bash
# In api/.env
echo 'PRIVY_APP_ID=clxxxx-your-app-id-here' >> .env
```

#### 4. Update sign.html

Replace the App ID in `/api/public/sign-with-privy.html`:

```javascript
const PRIVY_APP_ID = process.env.PRIVY_APP_ID || 'YOUR_APP_ID_HERE';
```

#### 5. Test It

```bash
# Start server
npm start

# Create deployment
curl -X POST http://localhost:3000/api/wallet/deploy-with-wallet \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Create ERC20 token","network":"basecamp"}' \
  | python3 -m json.tool

# Get magic link from response, replace /sign/ with /sign-with-privy/
# Example: http://localhost:3000/sign-with-privy/sess_xxxxx
```

---

## 📱 Option 2: WalletConnect

**Why WalletConnect?**
- ✅ Works with ANY mobile wallet
- ✅ QR code scanning
- ✅ Trust Wallet, Rainbow, MetaMask Mobile
- ✅ No browser extension needed

### **Setup Steps**

#### 1. Install WalletConnect

```bash
cd api
npm install @walletconnect/web3-provider qrcode
```

#### 2. Test It

```bash
# Create deployment
curl -X POST http://localhost:3000/api/wallet/deploy-with-wallet \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Create ERC20 token","network":"basecamp"}' \
  | python3 -m json.tool

# Get magic link, replace /sign/ with /sign-with-walletconnect/
# Example: http://localhost:3000/sign-with-walletconnect/sess_xxxxx
```

**Usage:**
1. Open link on desktop
2. Scan QR code with mobile wallet app
3. Confirm transaction in wallet
4. Done!

---

## 🔀 Option 3: Unified Signing Page (Best UX)

Let users choose their preferred wallet method!

### **Create Unified Sign Page**

Update your `api/routes/wallet-deploy.js` to use a unified page:

```javascript
// In wallet-deploy.js, line 286
const magicLink = `${baseUrl}/sign-unified/${session.sessionId}`;
```

Create `/api/public/sign-unified.html`:

```html
<div class="wallet-selector">
  <h2>Choose Your Wallet</h2>
  
  <button onclick="usePrivy()">
    🔐 Email / Social Login (Privy)
  </button>
  
  <button onclick="useWalletConnect()">
    📱 Mobile Wallet (WalletConnect)
  </button>
  
  <button onclick="useMetaMask()">
    🦊 Browser Extension (MetaMask)
  </button>
</div>
```

---

## 📊 Feature Comparison

| Feature | MetaMask | WalletConnect | Privy |
|---------|----------|---------------|-------|
| **Browser Extension** | ✅ | ❌ | ❌ |
| **Mobile Wallet** | ✅ | ✅ | ✅ |
| **Email Login** | ❌ | ❌ | ✅ |
| **Social Login** | ❌ | ❌ | ✅ |
| **QR Code** | ❌ | ✅ | ✅ |
| **Embedded Wallet** | ❌ | ❌ | ✅ |
| **Non-crypto Users** | ❌ | ❌ | ✅ |
| **Setup Complexity** | Easy | Medium | Medium |

---

## 🎯 Recommended Setup

**For Best UX:**

1. **Default:** Use `sign.html` (MetaMask - simple, works for most)
2. **Advanced:** Use `sign-unified.html` (Let users choose)
3. **Mass Adoption:** Use `sign-with-privy.html` (Email login for everyone)

---

## 🧪 Testing Each Option

### **Test MetaMask (Current)**
```bash
curl -s -X POST http://localhost:3000/api/wallet/deploy-with-wallet \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Create ERC20"}' | jq -r '.jobId' | \
  xargs -I {} sh -c 'sleep 5 && curl -s http://localhost:3000/api/job/{} | jq -r ".result.magicLink"'

# Click link, use MetaMask
```

### **Test Privy**
```bash
# Same as above but replace /sign/ with /sign-with-privy/
```

### **Test WalletConnect**
```bash
# Same as above but replace /sign/ with /sign-with-walletconnect/
```

---

## 🔧 Make It Default

To use Privy or WalletConnect by default, update `wallet-deploy.js`:

```javascript
// Line 286 in api/routes/wallet-deploy.js

// Option 1: Privy
const magicLink = `${baseUrl}/sign-with-privy/${session.sessionId}`;

// Option 2: WalletConnect
const magicLink = `${baseUrl}/sign-with-walletconnect/${session.sessionId}`;

// Option 3: Unified (let user choose)
const magicLink = `${baseUrl}/sign-unified/${session.sessionId}`;
```

---

## 📱 Mobile-Specific Features

### **Deep Links for Mobile Apps**

```javascript
// Add to sign.html for better mobile UX
function detectMobile() {
  return /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

if (detectMobile() && window.ethereum) {
  // Open in MetaMask mobile browser
  window.location.href = `https://metamask.app.link/dapp/${window.location.href}`;
}
```

### **WalletConnect QR Code**

Already included in `sign-with-walletconnect.html`:
- Displays QR code automatically
- Works with Trust Wallet, Rainbow, etc.
- Scans with phone camera

---

## 🎨 Customization

### **Brand Colors**

Update CSS in any sign page:

```css
.button-primary {
  background: linear-gradient(135deg, #YOUR_COLOR_1 0%, #YOUR_COLOR_2 100%);
}
```

### **Custom Logos**

```html
<div class="logo">
  <img src="/logo.png" alt="Your Brand" />
</div>
```

---

## 🚀 Production Checklist

- [ ] Get Privy App ID from dashboard.privy.io
- [ ] Add PRIVY_APP_ID to .env
- [ ] Test all wallet options
- [ ] Choose default signing page
- [ ] Update magic link generation in wallet-deploy.js
- [ ] Test on mobile devices
- [ ] Add custom branding
- [ ] Monitor transaction success rate

---

## 📚 Additional Resources

**Privy:**
- Docs: https://docs.privy.io
- Dashboard: https://dashboard.privy.io
- Examples: https://github.com/privy-io/privy-examples

**WalletConnect:**
- Docs: https://docs.walletconnect.com
- Explorer: https://walletconnect.com/explorer

**Supported Wallets:**
- MetaMask: https://metamask.io
- Trust Wallet: https://trustwallet.com
- Rainbow: https://rainbow.me
- Coinbase Wallet: https://wallet.coinbase.com

---

## 🐛 Troubleshooting

### Privy Issues

**"App ID not found"**
- Check PRIVY_APP_ID in .env
- Verify App ID in Privy dashboard

**"Wallet creation failed"**
- Ensure user is logged in to Privy
- Check browser console for errors

### WalletConnect Issues

**"QR code not showing"**
- Check qrcode library is loaded
- Open browser console for errors

**"Connection timeout"**
- User may have declined
- Try reconnecting

**"Wrong network"**
- Add network RPC URL to RPC_URLS object
- Check chainId matches sessionData

---

## ✅ Next Steps

1. Choose your preferred wallet integration
2. Test with a real deployment
3. Customize branding
4. Deploy to production
5. Monitor user adoption

**Need help?** Check the browser console for detailed logs!
