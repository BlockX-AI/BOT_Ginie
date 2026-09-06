pragma solidity ^0.8.0;

contract SimpleStorage {
    uint256 private storedData;

    /**
     * @dev Stores a new value in the contract.
     * @param x The value to store.
     */
    function set(uint256 x) public {
        storedData = x;
    }

    /**
     * @dev Returns the currently stored value.
     * @return The stored value.
     */
    function get() public view returns (uint256) {
        return storedData;
    }
}
