pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract CryptoMonsters is ERC721 {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIds;

    uint256 public constant MINT_PRICE = 0.01 ether;
    uint256 public constant MAX_SUPPLY = 1000;

    enum Rarity {
        COMMON,
        RARE,
        LEGENDARY
    }

    struct Monster {
        Rarity rarity;
        string name;
    }

    mapping(uint256 => Monster) public monsters;

    constructor() ERC721("CryptoMonsters", "CM") {}

    function mintMonster() public payable {
        require(msg.value >= MINT_PRICE, "Insufficient funds.");
        require(_tokenIds.current() < MAX_SUPPLY, "Max supply reached.");

        _tokenIds.increment();

        uint256 newItemId = _tokenIds.current();
        _mint(msg.sender, newItemId);

        // Determine rarity (example, can be more sophisticated)
        Rarity rarity;
        uint256 randomNumber = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, newItemId))) % 100;

        if (randomNumber < 70) {
            rarity = Rarity.COMMON;
        } else if (randomNumber < 95) {
            rarity = Rarity.RARE;
        } else {
            rarity = Rarity.LEGENDARY;
        }

        // Generate a basic name based on rarity
        string memory name;
        if (rarity == Rarity.COMMON) {
            name = "Common Monster";
        } else if (rarity == Rarity.RARE) {
            name = "Rare Monster";
        } else {
            name = "Legendary Monster";
        }

        monsters[newItemId] = Monster(rarity, name);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");

        // You would typically generate a dynamic JSON here based on the monster's attributes
        // For simplicity, let's return a basic URI
        return string(abi.encodePacked("ipfs://your_ipfs_hash/", Strings.toString(tokenId), ".json"));
    }
}
