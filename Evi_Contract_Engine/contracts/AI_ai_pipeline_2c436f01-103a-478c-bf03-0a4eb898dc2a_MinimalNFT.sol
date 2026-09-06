// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MinimalERC721
 * @author Your Name
 * @notice A minimal, secure ERC721 non-fungible token contract using OpenZeppelin.
 * This contract features an ownership model where only the contract owner can mint new tokens.
 * It intentionally omits token URI logic to keep the implementation as simple as possible.
 */
contract MinimalERC721 is ERC721, Ownable {

    /**
     * @notice Sets the name and symbol for the NFT collection.
     * @param name_ The name of the token collection (e.g., "My NFT").
     * @param symbol_ The symbol for the token collection (e.g., "MNFT").
     */
    constructor(string memory name_, string memory symbol_)
        ERC721(name_, symbol_)
        Ownable()
    {
        // The compiler error indicates an OpenZeppelin version is used where
        // the Ownable constructor does not accept an argument.
        // In such versions, msg.sender is automatically set as the initial owner.
    }

    /**
     * @notice Mints a new token to a specified address.
     * @dev Can only be called by the contract owner.
     * The `tokenId` must not already exist.
     * @param to The address that will receive the minted token.
     * @param tokenId The unique identifier for the new token.
     */
    function mintTo(address to, uint256 tokenId) public onlyOwner {
        _mint(to, tokenId);
    }

    /**
     * @dev Overriding this internal function to bypass URI storage logic.
     * Since the request specified "No URI logic," this ensures that `tokenURI`
     * will return an empty string, saving gas on deployment and minting.
     * OpenZeppelin's base ERC721 implementation will call this function
     * when `tokenURI` is queried.
     */
    function _baseURI() internal pure override returns (string memory) {
        return "";
    }
}
