"""
Test script for Vercel deployment integration
"""

import asyncio
import uuid
from integrations.vercel_client import VercelDeploymentClient


async def test_vercel_deployment():
    """Test Vercel deployment with a simple Vite project"""
    
    print("🧪 Testing Vercel Deployment Integration")
    print("=" * 50)
    
    # Create a simple test project files
    test_files = {
        "package.json": """{
  "name": "test-project",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^4.3.9"
  }
}""",
        "index.html": """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Test Project</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>""",
        "vite.config.js": """import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})""",
        "src/main.jsx": """import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)""",
        "src/App.jsx": """import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{
      fontFamily: 'system-ui',
      textAlign: 'center',
      padding: '50px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      color: 'white'
    }}>
      <h1>✅ Vercel Deployment Test</h1>
      <p>This is a test deployment from WebBuilder!</p>
      <div style={{ marginTop: '30px' }}>
        <button 
          onClick={() => setCount(count + 1)}
          style={{
            padding: '15px 30px',
            fontSize: '18px',
            borderRadius: '8px',
            border: 'none',
            background: 'white',
            color: '#667eea',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Count: {count}
        </button>
      </div>
      <div style={{ marginTop: '30px', opacity: 0.8 }}>
        <p>🚀 Deployed successfully with Vercel API</p>
        <p>📅 {new Date().toLocaleString()}</p>
      </div>
    </div>
  )
}

export default App""",
        "src/index.css": """* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}"""
    }
    
    try:
        # Initialize Vercel client
        print("\n1️⃣ Initializing Vercel client...")
        client = VercelDeploymentClient()
        print("   ✅ Client initialized successfully")
        print(f"   📝 Using token: {client.api_token[:10]}...")
        
        # Generate test chat ID
        test_chat_id = str(uuid.uuid4())
        print(f"\n2️⃣ Test chat ID: {test_chat_id}")
        
        # Deploy the project
        print(f"\n3️⃣ Deploying {len(test_files)} files to Vercel...")
        print("   Files:")
        for file_path in test_files.keys():
            print(f"   - {file_path}")
        
        print("\n⏳ Deployment in progress...")
        success, vercel_url, error_msg = await client.deploy_project(
            project_name="test-webbuilder",
            files=test_files,
            chat_id=test_chat_id
        )
        
        print("\n" + "=" * 50)
        if success:
            print("🎉 DEPLOYMENT SUCCESSFUL!")
            print(f"🌐 Your app is live at: {vercel_url}")
            print("\n📋 Next steps:")
            print("   1. Open the URL in your browser")
            print("   2. Verify the app loads correctly")
            print("   3. Click the counter button to test interactivity")
            print("\n💡 This URL is PERMANENT and will never expire!")
            return True
        else:
            print("❌ DEPLOYMENT FAILED")
            print(f"Error: {error_msg}")
            return False
            
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_project_name_sanitization():
    """Test project name sanitization"""
    print("\n🧪 Testing project name sanitization")
    print("=" * 50)
    
    client = VercelDeploymentClient()
    
    test_cases = [
        ("My Awesome Project!", "abc12345"),
        ("Test_Project_123", "def67890"),
        ("Simple Project", "ghi11111"),
        ("a" * 150, "jkl22222"),
        ("!@#$%^&*()", "mno33333"),
    ]
    
    for original, chat_id in test_cases:
        sanitized = client._sanitize_project_name(original, chat_id)
        print(f"'{original}' → '{sanitized}'")
    
    print("\n✅ Sanitization test complete")


if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("🚀 VERCEL DEPLOYMENT TEST SUITE")
    print("=" * 50 + "\n")
    
    # Run sanitization test
    asyncio.run(test_project_name_sanitization())
    
    print("\n")
    
    # Run deployment test
    result = asyncio.run(test_vercel_deployment())
    
    print("\n" + "=" * 50)
    if result:
        print("✅ ALL TESTS PASSED!")
    else:
        print("❌ TESTS FAILED")
    print("=" * 50 + "\n")
