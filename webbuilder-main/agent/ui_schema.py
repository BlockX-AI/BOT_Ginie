"""
Deterministic ABI → UI Schema Generator
Ported from wizard's apps/cli/src/utils/abi.ts

Generates typed UI control metadata from contract ABI, eliminating the need
for the LLM to infer types/validation. The LLM only handles layout/styling.
"""

from typing import List, Dict, Any, Literal, Optional

UiControlType = Literal["text", "textarea", "number-bigint", "address", "bool", "bytes"]


def build_ui_schema(abi: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Build deterministic UI schema from contract ABI.
    
    Args:
        abi: Contract ABI (list of function/event/error definitions)
        
    Returns:
        List of UI function specs:
        [{
            "name": str,
            "kind": "read" | "write" | "payable",
            "fields": [{name, solidityType, control, validation}],
            "outputs": [{name, solidityType}]
        }]
    """
    functions = [item for item in abi if item.get("type") == "function"]
    return [_map_function_to_ui_spec(fn) for fn in functions]


def _map_function_to_ui_spec(fn: Dict[str, Any]) -> Dict[str, Any]:
    """Map a single ABI function to a UI spec."""
    state_mutability = fn.get("stateMutability", "nonpayable")
    
    if state_mutability in ("view", "pure"):
        kind = "read"
    elif state_mutability == "payable":
        kind = "payable"
    else:
        kind = "write"
    
    inputs = fn.get("inputs", [])
    outputs = fn.get("outputs", [])
    
    return {
        "name": fn.get("name", "unknown"),
        "kind": kind,
        "fields": [_map_param_to_field(param) for param in inputs],
        "outputs": [
            {
                "name": out.get("name") or "value",
                "solidityType": out.get("type", "uint256")
            }
            for out in outputs
        ]
    }


def _map_param_to_field(param: Dict[str, Any]) -> Dict[str, Any]:
    """
    Map an ABI parameter to a typed UI field with validation.
    
    Returns:
        {
            "name": str,
            "solidityType": str,
            "control": UiControlType,
            "validation": {required: true, ...}
        }
    """
    param_type = param.get("type", "string")
    param_name = param.get("name") or "value"
    
    # Address type
    if param_type == "address":
        return {
            "name": param_name,
            "solidityType": param_type,
            "control": "address",
            "validation": {
                "required": True,
                "isAddress": True
            }
        }
    
    # Boolean type
    if param_type == "bool":
        return {
            "name": param_name,
            "solidityType": param_type,
            "control": "bool",
            "validation": {
                "required": True
            }
        }
    
    # Integer types (uint*, int*)
    if param_type.startswith("uint") or param_type.startswith("int"):
        validation: Dict[str, Any] = {"required": True}
        if param_type.startswith("uint"):
            validation["min"] = "0"
        
        return {
            "name": param_name,
            "solidityType": param_type,
            "control": "number-bigint",
            "validation": validation
        }
    
    # Bytes types
    if param_type.startswith("bytes"):
        # Fixed-size bytes (bytes1, bytes32, etc.)
        if param_type != "bytes" and len(param_type) > 5:
            try:
                byte_size = int(param_type.replace("bytes", ""))
                hex_pattern = f"^0x[0-9a-fA-F]{{{byte_size * 2}}}$"
            except ValueError:
                hex_pattern = "^0x([0-9a-fA-F]{2})*$"
        else:
            # Dynamic bytes
            hex_pattern = "^0x([0-9a-fA-F]{2})*$"
        
        return {
            "name": param_name,
            "solidityType": param_type,
            "control": "bytes",
            "validation": {
                "required": True,
                "hexPattern": hex_pattern
            }
        }
    
    # String type
    if param_type == "string":
        return {
            "name": param_name,
            "solidityType": param_type,
            "control": "text",
            "validation": {
                "required": True
            }
        }
    
    # Arrays, tuples, and other complex types → textarea with JSON
    return {
        "name": param_name,
        "solidityType": param_type,
        "control": "textarea",
        "validation": {
            "required": True,
            "isJson": True  # Hint that this needs JSON.parse
        }
    }
