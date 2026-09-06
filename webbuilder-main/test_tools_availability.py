#!/usr/bin/env python3
"""
Test that all Web3 tools are properly created and available
"""

import sys
sys.path.insert(0, '/Users/satyamsinghal/Downloads/webbuilder-main')

from agent.tools import create_tools_with_context
from unittest.mock import MagicMock
import inspect

# Create mock objects
mock_sandbox = MagicMock()
mock_socket = MagicMock()
test_project_id = "test-project-123"

print("🧪 Testing Tool Creation and Availability")
print("=" * 60)

try:
    # Create tools with mocked context
    tools = create_tools_with_context(
        sandbox=mock_sandbox,
        socket=mock_socket,
        project_id=test_project_id
    )
    
    print(f"\n✅ Tools created successfully")
    print(f"📊 Total tools count: {len(tools)}")
    
    # Expected Web3 tools (EVI Client)
    expected_web3_tools = [
        "deploy_smart_contract",
        "deploy_game_contract",
        "fix_contract",
        "verify_contract", 
        "audit_contract",
        "check_contract_compliance",
        "get_contract_job_status",
        "download_contract_artifacts",
        "get_contract_logs",
        "list_available_games"
    ]
    
    # Get all tool names
    tool_names = []
    for tool in tools:
        # LangChain tools have a 'name' attribute
        if hasattr(tool, 'name'):
            tool_names.append(tool.name)
        elif hasattr(tool, '__name__'):
            tool_names.append(tool.__name__)
    
    print(f"\n📋 Available Tools:")
    print("-" * 60)
    
    # Check for Web3 tools
    web3_tools_found = []
    web3_tools_missing = []
    
    for expected_tool in expected_web3_tools:
        if expected_tool in tool_names:
            web3_tools_found.append(expected_tool)
            print(f"  ✅ {expected_tool}")
        else:
            web3_tools_missing.append(expected_tool)
            print(f"  ❌ {expected_tool} (NOT FOUND)")
    
    # Show other tools
    print(f"\n📦 Other Available Tools:")
    print("-" * 60)
    other_tools = [t for t in tool_names if t not in expected_web3_tools]
    for tool_name in other_tools:
        print(f"  • {tool_name}")
    
    # Results
    print("\n" + "=" * 60)
    print("📊 RESULTS")
    print("=" * 60)
    print(f"Total tools: {len(tools)}")
    print(f"Web3 tools found: {len(web3_tools_found)}/{len(expected_web3_tools)}")
    
    if web3_tools_missing:
        print(f"\n⚠️  Missing Web3 tools: {', '.join(web3_tools_missing)}")
        sys.exit(1)
    else:
        print(f"\n🎉 All {len(expected_web3_tools)} Web3 tools are available!")
        print("✨ Integration is complete and working!")
        
        # Bonus: Check if tools have docstrings
        print(f"\n📚 Checking Tool Documentation:")
        print("-" * 60)
        for tool in tools:
            if hasattr(tool, 'name') and tool.name in expected_web3_tools:
                if hasattr(tool, 'description') and tool.description:
                    print(f"  ✅ {tool.name}: Has description")
                elif hasattr(tool, 'func') and tool.func.__doc__:
                    print(f"  ✅ {tool.name}: Has docstring")
                else:
                    print(f"  ⚠️  {tool.name}: Missing documentation")
        
        sys.exit(0)

except Exception as e:
    print(f"\n❌ Error creating tools: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
