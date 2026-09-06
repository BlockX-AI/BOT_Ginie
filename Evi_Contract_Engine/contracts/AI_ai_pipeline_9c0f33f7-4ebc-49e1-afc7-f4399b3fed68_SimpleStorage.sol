// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SimpleStorage
 * @dev A basic contract to demonstrate storing and retrieving a single uint256 value.
 * This contract does not require any OpenZeppelin imports.
 */
contract SimpleStorage {
    // State variable to store a number.
    // Declared as private to encapsulate storage and only allow access
    // through the getter and setter functions.
    uint256 private _number;

    /**
     * @dev Stores a new unsigned integer.
     * @param newNumber The new uint256 value to be stored.
     */
    function set(uint256 newNumber) public {
        _number = newNumber;
    }

    /**
     * @dev Retrieves the last stored number.
     * @return The current uint256 value.
     */
    function get() public view returns (uint256) {
        return _number;
    }
}
