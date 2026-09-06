/*
 Simple API test script for the AcademicChain backend.

 Usage:
   BASE_URL=http://localhost:3001 node scripts/test-api.js
 Optional:
   DEPLOY_TEST=true \ 
   TOKEN_NAME="MyToken" TOKEN_SYMBOL="MYT" TOKEN_SUPPLY="1000000" OWNER="0xYourAddress" NETWORK="camp-testnet" \ 
   BASE_URL=http://localhost:3001 node scripts/test-api.js

 Notes:
 - This script does not use your Gemini API key yet because AI routes are not implemented.
 - Set GEMINI_API_KEY in your environment for future AI routes (do not hardcode keys).
*/

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

async function getJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  try { return { status: res.status, json: JSON.parse(text) }; } catch (_) { return { status: res.status, text }; }
}

(async () => {
  console.log(`\n=== Testing API at ${baseUrl} ===`);

  // 1) Health
  const health = await getJson(`${baseUrl}/`);
  console.log('\n[Health /]');
  console.log(health);

  // 2) Swagger availability
  const docs = await fetch(`${baseUrl}/api-docs`);
  console.log('\n[Swagger /api-docs]');
  console.log({ status: docs.status, ok: docs.ok, contentType: docs.headers.get('content-type') });

  // 3) Job status (expect 404 for random id)
  const badJob = await getJson(`${baseUrl}/api/job/unknown-id/status`);
  console.log('\n[Job status (expected 404)]');
  console.log(badJob);

  // 4) Optional ERC20 deploy
  if (String(process.env.DEPLOY_TEST).toLowerCase() === 'true') {
    const body = {
      name: process.env.TOKEN_NAME || 'Business Token',
      symbol: process.env.TOKEN_SYMBOL || 'BUS',
      initialSupply: process.env.TOKEN_SUPPLY || '1000000',
      owner: process.env.OWNER || '',
      network: process.env.NETWORK || 'camp-testnet'
    };
    console.log('\n[Deploy ERC20] Request body:', body);
    const deploy = await getJson(`${baseUrl}/api/deploy/erc20`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    console.log('[Deploy ERC20] Response:');
    console.log(deploy);
  } else {
    console.log('\n[Deploy ERC20] Skipped. Set DEPLOY_TEST=true to run.');
  }

  console.log('\n=== Done ===');
})().catch((e) => {
  console.error('Test script error:', e);
  process.exit(1);
});
