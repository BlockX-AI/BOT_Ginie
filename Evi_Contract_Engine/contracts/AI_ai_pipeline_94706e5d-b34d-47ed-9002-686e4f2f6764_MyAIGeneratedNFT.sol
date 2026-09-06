// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract MyNFT is ERC721, Ownable {
    using Strings for uint256;

    string private baseURI;

    uint256 private _nextTokenId;

    constructor(string memory name, string memory symbol, string memory _baseURI) ERC721(name, symbol) {
        baseURI = _baseURI;
        _nextTokenId = 1;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }

    function setBaseURI(string memory _baseURI) public onlyOwner {
        baseURI = _baseURI;
    }

    function mint(address to) public onlyOwner {
        uint256 tokenId = _nextTokenId;
        _safeMint(to, tokenId);
        _nextTokenId++;
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");

        string memory baseURIValue = _baseURI();
        return bytes(baseURIValue).length > 0 ? string(abi.encodePacked(baseURIValue, tokenId.toString(), ".json")) : "";
    }

    function currentTokenId() public view returns (uint256) {
        return _nextTokenId;
    }
}
