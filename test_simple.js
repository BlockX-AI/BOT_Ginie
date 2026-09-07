const https = require('https');

const data = JSON.stringify({
  prompt: "Create a simple ERC20 token contract",
  model: 'gpt-4o'
});

const options = {
  hostname: 'web-production-7fc87.up.railway.app',
  port: 443,
  path: '/demo/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('🚀 Testing demo endpoint with simple prompt...\n');

const req = https.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('✅ Response Status:', res.statusCode);
    console.log('📦 Response:\n');
    
    try {
      const jsonResponse = JSON.parse(responseData);
      console.log(JSON.stringify(jsonResponse, null, 2));
      
      if (jsonResponse.chat_id) {
        console.log('\n🎯 Chat ID:', jsonResponse.chat_id);
        console.log('🔗 Frontend URL: http://localhost:3000/sandbox/' + jsonResponse.chat_id);
      }
    } catch (e) {
      console.log(responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

req.write(data);
req.end();
