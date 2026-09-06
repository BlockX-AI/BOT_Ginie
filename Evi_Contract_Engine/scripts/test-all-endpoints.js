/*
 Run:
   BASE_URL=https://acadcodegen-production.up.railway.app \
   TEST_ADDRESS=0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E \
   ALT_ADDRESS=0x941Ca723C71E0824e238505894254Ae214C11fF4 \
   ORIGIN_PROTOCOL=0x0000000000000000000000000000000000000000 \
   node scripts/test-all-endpoints.js

 Notes:
 - State-changing routes require the server wallet to be funded and configured.
 - Academic Suite deploy requires a valid ORIGIN_PROTOCOL address; skipped if not set.
*/

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const ADDR = (process.env.TEST_ADDRESS || '0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E').trim();
const ALT_ADDR = (process.env.ALT_ADDRESS || '0x941Ca723C71E0824e238505894254Ae214C11fF4').trim();
const ORIGIN_PROTOCOL = (process.env.ORIGIN_PROTOCOL || '').trim();

async function ensureFetch() {
  if (typeof fetch === 'undefined') {
    const mod = await import('node-fetch');
    global.fetch = mod.default;
  }
}

async function httpGet(path) {
  const url = `${BASE}${path}`;
  const res = await fetch(url);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, ok: res.ok, json };
}

async function httpPost(path, body) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, ok: res.ok, json };
}

function logStep(title, result) {
  console.log(`\n=== ${title} ===`);
  console.log('Status:', result.status, 'OK:', !!result.ok);
  console.dir(result.json, { depth: null });
}

(async () => {
  await ensureFetch();
  console.log('BASE:', BASE);
  console.log('TEST_ADDRESS:', ADDR);
  console.log('ALT_ADDRESS:', ALT_ADDR);

  // Root
  logStep('GET /', await httpGet('/'));

  // AI endpoints
  logStep('POST /api/ai/generate', await httpPost('/api/ai/generate', {
    prompt: 'Write an ERC20 with mint and burn using OpenZeppelin'
  }));

  logStep('POST /api/ai/fix', await httpPost('/api/ai/fix', {
    code: 'pragma solidity ^0.8.20; contract X{',
    errors: 'Parser error',
    context: 'Use OpenZeppelin'
  }));

  // Papers: register two papers
  const p1 = await httpPost('/api/papers', {
    ipfsHash: 'ipfs://bafy-paper-1',
    title: 'ZK 101',
    tokenURI: 'ipfs://bafy-meta-1',
    keywords: ['zk', 'privacy'],
    coAuthors: [ADDR]
  });
  logStep('POST /api/papers (p1)', p1);
  const paperId1 = p1.json && (p1.json.paperId || p1.json.id);

  const p2 = await httpPost('/api/papers', {
    ipfsHash: 'ipfs://bafy-paper-2',
    title: 'AI + Crypto',
    tokenURI: 'ipfs://bafy-meta-2',
    keywords: ['ai', 'crypto'],
    coAuthors: [ALT_ADDR]
  });
  logStep('POST /api/papers (p2)', p2);
  const paperId2 = p2.json && (p2.json.paperId || p2.json.id);

  // Cite via ResearchPaper
  if (paperId1 && paperId2) {
    logStep('POST /api/papers/cite', await httpPost('/api/papers/cite', {
      citingPaperId: String(paperId1),
      citedPaperId: String(paperId2)
    }));
  } else {
    console.warn('Skipping /api/papers/cite (missing paper ids)');
  }

  // Paper reads
  if (paperId1) logStep('GET /api/papers/:id', await httpGet(`/api/papers/${paperId1}`));
  logStep('GET /api/papers/researcher/:addr', await httpGet(`/api/papers/researcher/${ADDR}`));
  logStep('GET /api/papers/keyword/zk', await httpGet(`/api/papers/keyword/zk`));
  if (paperId1) logStep('POST /api/papers/verify/:id', await httpPost(`/api/papers/verify/${paperId1}`));

  // Citations service
  const c1 = await httpPost('/api/citations/record', {
    citingPaperId: paperId1 ? String(paperId1) : '1',
    citedPaperId: paperId2 ? String(paperId2) : '2',
    citer: ADDR
  });
  logStep('POST /api/citations/record', c1);
  const citationId = c1.json && c1.json.citationId;
  if (citationId) {
    logStep('POST /api/citations/verify/:id', await httpPost(`/api/citations/verify/${citationId}`));
    logStep('GET /api/citations/:id', await httpGet(`/api/citations/${citationId}`));
  }
  if (paperId1) {
    logStep('GET /api/citations/paper/:id', await httpGet(`/api/citations/paper/${paperId1}`));
    logStep('GET /api/citations/cited-by/:id', await httpGet(`/api/citations/cited-by/${paperId1}`));
    logStep('GET /api/citations/count/:id', await httpGet(`/api/citations/count/${paperId1}`));
    logStep('GET /api/citations/verified-count/:id', await httpGet(`/api/citations/verified-count/${paperId1}`));
  }

  // Royalties
  const pay = await httpPost('/api/royalties/pay', {
    paperId: paperId1 ? String(paperId1) : '1',
    researcher: ADDR,
    reason: 'citation',
    amount: '0.01'
  });
  logStep('POST /api/royalties/pay', pay);
  const paymentId = pay.json && pay.json.paymentId;

  logStep('POST /api/royalties/withdraw', await httpPost('/api/royalties/withdraw'));

  const batch = await httpPost('/api/royalties/batch-pay', {
    paperIds: [paperId1 || '1', paperId2 || '2'],
    researchers: [ADDR, ALT_ADDR],
    reasons: ['citation', 'access'],
    amounts: ['0.005', '0.007']
  });
  logStep('POST /api/royalties/batch-pay', batch);

  if (paymentId) logStep('GET /api/royalties/payment/:id', await httpGet(`/api/royalties/payment/${paymentId}`));
  if (paperId1) logStep('GET /api/royalties/total/:id', await httpGet(`/api/royalties/total/${paperId1}`));
  logStep('GET /api/royalties/balance/:addr', await httpGet(`/api/royalties/balance/${ADDR}`));
  if (paperId1) logStep('GET /api/royalties/paper/:id', await httpGet(`/api/royalties/paper/${paperId1}`));
  logStep('GET /api/royalties/researcher/:addr', await httpGet(`/api/royalties/researcher/${ADDR}`));

  // Origin Protocol
  const reg = await httpPost('/api/origin/register', {
    owner: ADDR,
    metadata: 'ipfs://bafy-origin-asset'
  });
  logStep('POST /api/origin/register', reg);
  const assetId = reg.json && reg.json.assetId;

  if (assetId) {
    logStep('POST /api/origin/verify-ownership', await httpPost('/api/origin/verify-ownership', {
      assetId,
      owner: ADDR
    }));
    logStep('GET /api/origin/asset/:id', await httpGet(`/api/origin/asset/${assetId}`));
    logStep('POST /api/origin/transfer', await httpPost('/api/origin/transfer', {
      assetId,
      newOwner: ALT_ADDR
    }));
  }
  logStep('GET /api/origin/assets/owner/:addr', await httpGet(`/api/origin/assets/owner/${ADDR}`));

  // Deploy ERC20
  logStep('POST /api/deploy/erc20', await httpPost('/api/deploy/erc20', {
    name: 'MyToken',
    symbol: 'MYT',
    initialSupply: '1000',
    owner: ADDR,
    network: 'basecamp'
  }));

  // Deploy Academic Suite (optional)
  if (ORIGIN_PROTOCOL && ORIGIN_PROTOCOL !== '0x0000000000000000000000000000000000000000') {
    logStep('POST /api/deploy/academic-suite', await httpPost('/api/deploy/academic-suite', {
      rpName: 'ResearchPaper',
      rpSymbol: 'RPR',
      originProtocol: ORIGIN_PROTOCOL,
      treasury: ADDR,
      platformFeeBps: '500',
      network: 'basecamp'
    }));
  } else {
    console.warn('Skipping /api/deploy/academic-suite (set ORIGIN_PROTOCOL env to enable)');
  }

  // Jobs (example: expect 404 for unknown id)
  logStep('GET /api/job/unknown/status', await httpGet('/api/job/unknown/status'));

  console.log('\nAll tests attempted. Review statuses above.');
})().catch((e) => {
  console.error('Test script failed:', e);
  process.exit(1);
});
