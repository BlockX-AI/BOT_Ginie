"""
Test the Vercel deployment via the agent's vercel_deployer_node.
This uses the same minimal Vite + React project used in direct client tests,
but runs through agent/graph_nodes.vercel_deployer_node with a fabricated state.
"""

import asyncio
import uuid
from typing import Dict

from dotenv import load_dotenv
from utils.store import save_json_store
from agent.graph_nodes import vercel_deployer_node


def minimal_vite_react_project() -> Dict[str, str]:
    return {
        "package.json": """{\n  \"name\": \"test-agent-project\",\n  \"version\": \"1.0.0\",\n  \"type\": \"module\",\n  \"scripts\": {\n    \"dev\": \"vite\",\n    \"build\": \"vite build\",\n    \"preview\": \"vite preview\"\n  },\n  \"dependencies\": {\n    \"react\": \"^18.2.0\",\n    \"react-dom\": \"^18.2.0\"\n  },\n  \"devDependencies\": {\n    \"@vitejs/plugin-react\": \"^4.0.0\",\n    \"vite\": \"^4.3.9\"\n  }\n}""",
        "index.html": """<!DOCTYPE html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <title>Agent Test Project</title>\n  </head>\n  <body>\n    <div id=\"root\"></div>\n    <script type=\"module\" src=\"/src/main.jsx\"></script>\n  </body>\n</html>""",
        "vite.config.js": """import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n})""",
        "src/main.jsx": """import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)""",
        "src/App.jsx": """import { useState } from 'react'\n\nfunction App() {\n  const [count, setCount] = useState(0)\n\n  return (\n    <div style={{\n      fontFamily: 'system-ui',\n      textAlign: 'center',\n      padding: '50px',\n      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',\n      minHeight: '100vh',\n      color: 'white'\n    }}>\n      <h1>✅ Agent Vercel Deployment Test</h1>\n      <p>This was deployed via vercel_deployer_node!</p>\n      <div style={{ marginTop: '30px' }}>\n        <button \n          onClick={() => setCount(count + 1)}\n          style={{\n            padding: '15px 30px',\n            fontSize: '18px',\n            borderRadius: '8px',\n            border: 'none',\n            background: 'white',\n            color: '#667eea',\n            cursor: 'pointer',\n            fontWeight: 'bold'\n          }}\n        >\n          Count: {count}\n        </button>\n      </div>\n      <div style={{ marginTop: '30px', opacity: 0.8 }}>\n        <p>🚀 Deployed through agent workflow</p>\n        <p>📅 {new Date().toLocaleString()}</p>\n      </div>\n    </div>\n  )\n}\n\nexport default App""",
        "src/index.css": """* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}\n\nbody {\n  margin: 0;\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',\n    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',\n    sans-serif;\n  -webkit-font-smoothing: antialiased;\n  -moz-osx-font-smoothing: grayscale;\n}""",
    }


async def main():
    # Load environment (VERCEL_API_TOKEN, etc.)
    load_dotenv()

    # Create a unique project/chat id
    project_id = str(uuid.uuid4())
    chat_id = project_id

    # Save files into agent context store as expected by vercel_deployer_node
    files = minimal_vite_react_project()
    save_json_store(project_id, "context.json", {"files": files})

    # Build the minimal state needed by vercel_deployer_node
    state = {
        "project_id": project_id,
        "chat_id": chat_id,
        "socket": None,           # no websocket in this test
        "success": True,           # pretend the build succeeded
        "project_name": "agent-test",
    }

    print("\n🚀 Testing agent vercel_deployer_node")
    print("=" * 60)
    print(f"Project/Chat ID: {project_id}")
    print(f"Files prepared: {len(files)}")

    # Invoke the deployer node
    new_state = await vercel_deployer_node(state)  # type: ignore

    print("\n" + "=" * 60)
    if new_state.get("deployment_status") == "deployed":
        print("🎉 Deployment via agent successful!")
        print(f"🌐 Vercel URL: {new_state.get('vercel_url')}")
        print("\n💡 This URL is permanent and will never expire!")
    else:
        print("❌ Deployment via agent failed")
        print(f"Error: {new_state.get('deployment_error')}")


if __name__ == "__main__":
    asyncio.run(main())
