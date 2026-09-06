/*
 Simple test script to call the Academic Suite one-click deploy endpoint.

 Usage examples:
   BASE_URL=http://localhost:3000 \
   RP_NAME=AcademicPaper RP_SYMBOL=APPR \
   ORIGIN_PROTOCOL=0xYourOriginProtocolAddress \
   TREASURY=0xYourTreasuryAddress PLATFORM_FEE_BPS=500 \
   NETWORK=basecamp \
   node scripts/test-academic-suite.js

 Notes:
 - Server must be running with the new route loaded (npm run start).
 - originProtocol is required. Use a real address; placeholder values will fail.
 - On network=basecamp, response includes Blockscout explorer URLs.
*/

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

const body = {
  rpName: process.env.RP_NAME || 'ResearchPaper',
  rpSymbol: process.env.RP_SYMBOL || 'RPR',
  originProtocol: process.env.ORIGIN_PROTOCOL || '',
  treasury: process.env.TREASURY || '',
  platformFeeBps: process.env.PLATFORM_FEE_BPS || '500',
  network: process.env.NETWORK || 'camp-testnet',
};

async function main() {
  if (!body.originProtocol || body.originProtocol.startsWith('0xYour') || body.originProtocol.includes('...')) {
    console.error('ERROR: You must set a valid ORIGIN_PROTOCOL address in env.');
    console.error('Example: ORIGIN_PROTOCOL=0x1234... node scripts/test-academic-suite.js');
    process.exit(1);
  }

  console.log(`\n=== Testing Academic Suite Deploy at ${baseUrl} ===`);
  console.log('[Request Body]', body);

  const res = await fetch(`${baseUrl}/api/deploy/academic-suite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch (_) {}

  console.log('\n[Status]', res.status);
  if (parsed) {
    console.log('[JSON Response]');
    console.dir(parsed, { depth: null });
  } else {
    console.log('[Raw Response]');
    console.log(text);
  }

  console.log('\n=== Done ===');
}

main().catch((e) => {
  console.error('Test script error:', e);
  process.exit(1);
});
