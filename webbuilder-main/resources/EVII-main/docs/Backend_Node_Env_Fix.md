# Backend Node/Hardhat Environment Fix

The compile errors (Hardhat Node.js warning + HH506: Error running solcjs) are from the backend toolchain. Fix the backend runtime; the Next.js frontend is fine.

## Target versions
- Node.js: LTS that your Hardhat supports (e.g., 20.11.1)
- Hardhat: latest stable (or a version compatible with your Node)
- Solidity: pin a supported compiler (e.g., 0.8.20)

## Railway (recommended)
1) Project → Settings → Variables
   - Add: `NIXPACKS_NODE_VERSION=20.11.1`
2) Redeploy the service.

Optional (backend package.json):
```json
{
  "engines": { "node": "^20.11.1" }
}
```

## Vercel
- Project → Settings → General → Node.js Version → 20.x
- Or add `.nvmrc` with `20.11.1` in the backend repo.

## Hardhat setup (backend repo)
Update and pin compiler:
```bash
npm i -D hardhat@latest
```
`hardhat.config.js`:
```js
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
};
```

## Verify locally (backend repo)
```bash
npx hardhat --version
npx hardhat compile
```
No more Node/Hardhat warning or HH506 should appear.

## Meanwhile in the app
- Use Auto-Fix & Retry → Editor to iterate.
- After backend Node/Hardhat is corrected, pipeline compile should pass normally.
