pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

// SPDX-License-Identifier: MIT

contract SimpleRegistry is Ownable {
    mapping(address => string) public registry;

    event DataChanged(address indexed account, string newData);

    /**
     * @dev Sets the data associated with the caller's address.
     * @param _data The string data to associate with the caller's address.
     */
    function setMyData(string memory _data) public {
        registry[msg.sender] = _data;
        emit DataChanged(msg.sender, _data);
    }

    /**
     * @dev Retrieves the data associated with a given address.
     * @param _address The address to query.
     * @return The data associated with the address, or an empty string if no data is associated with it.
     */
    function getData(address _address) public view returns (string memory) {
        return registry[_address];
    }

    /**
     * @dev Allows the owner to clear the data associated with a specific address.
     * @param _address The address whose data needs to be cleared.
     */
    function clearData(address _address) public onlyOwner {
        delete registry[_address];
        emit DataChanged(_address, "");
    }

    /**
     * @dev Returns a string representation of the address and the data.
     * @param _address The address to format.
     * @return A string representation of the address and associated data.
     */
    function stringify(address _address) public view returns (string memory) {
        return string.concat(Strings.toHexString(_address), " : ", registry[_address]);
    }
}
