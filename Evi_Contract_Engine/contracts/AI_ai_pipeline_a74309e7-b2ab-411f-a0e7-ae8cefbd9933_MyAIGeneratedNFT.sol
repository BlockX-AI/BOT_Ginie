// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract MyNFT is ERC721, Ownable {
    using Strings for uint256;

    string private _baseURIValue;
    uint256 private _tokenIdCounter;

    constructor(string memory name, string memory symbol, string memory baseURI_) ERC721(name, symbol) {
        _baseURIValue = baseURI_;
        _tokenIdCounter = 0;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseURIValue;
    }

   /**
    * @dev Sets the base URI for all tokens. It is automatically available as
    * `tokenURI`, but can be overridden in derived contracts, so long as it
    * keeps its general syntax. The URI must be a valid HTTP or IPFS URI.
    */
    function setBaseURI(string memory baseURI_) public onlyOwner {
        _baseURIValue = baseURI_;
    }

    /**
     * @dev Mints a new token to an address. Reverts if the given token ID already exists.
     *
     * Emits a {Transfer} event.
     */
    function safeMint(address to) public onlyOwner {
        uint256 tokenId = _tokenIdCounter;
        _safeMint(to, tokenId);
        _tokenIdCounter = _tokenIdCounter + 1;
    }

    // The following functions are overrides required by Solidity.

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");

        string memory baseURI_ = _baseURI();
        return bytes(baseURI_).length > 0 ? string(abi.encodePacked(baseURI_, tokenId.toString(), ".json")) : "";
    }

    function currentTokenId() public view returns (uint256) {
        return _tokenIdCounter;
    }
}
