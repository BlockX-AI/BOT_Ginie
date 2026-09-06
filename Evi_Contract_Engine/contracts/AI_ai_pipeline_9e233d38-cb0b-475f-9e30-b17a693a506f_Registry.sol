pragma solidity ^0.8.0;

/**
 * @title SimpleRegistry
 * @dev A simple contract that allows users to register a string associated with their address.
 */
contract SimpleRegistry {
    mapping(address => string) public data;

    /**
     * @dev Sets the data associated with the sender's address.
     * @param _data The string to store.
     */
    function setMyData(string memory _data) public {
        data[msg.sender] = _data;
    }

    /**
     * @dev Retrieves the data associated with the given address.
     * @param _address The address to retrieve the data for.
     * @return The string associated with the address, or an empty string if no data is set.
     */
    function getData(address _address) public view returns (string memory) {
        return data[_address];
    }
}
