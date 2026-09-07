const https = require('https');
const fs = require('fs');

// Read the prompt from file
const prompt = fs.readFileSync('subscription_prompt.txt', 'utf8');

const data = JSON.stringify({
  prompt: prompt,
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

console.log('🚀 Submitting dApp generation request...\n');
console.log('📝 Prompt length:', prompt.length, 'characters\n');

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
        const chatId = jsonResponse.chat_id;
        console.log('\n🎯 Chat ID:', chatId);
        console.log('🔗 Connect via WebSocket to see progress');
        console.log('📊 Tokens remaining:', jsonResponse.tokens_remaining);
        console.log('⏰ Reset in:', jsonResponse.reset_in_hours, 'hours');
      } else if (jsonResponse.error) {
        console.log('\n❌ Error:', jsonResponse.error);
        console.log('💬 Message:', jsonResponse.message || 'No additional details');
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
