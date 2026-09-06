// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IOriginProtocol.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockOriginProtocol
 * @dev Mock implementation of the Camp Network's Origin Protocol interface
 * This contract simulates the behavior of the Origin Protocol for testing and development
 */
contract MockOriginProtocol is IOriginProtocol, Ownable {
    struct Asset {
        address creator;
        uint256 registrationTime;
        bool exists;
        string licenseType;
        string licenseURI;
    }

    struct ProvenanceRecord {
        address[] creators;
        uint256[] timestamps;
        string[] descriptions;
    }

    struct RoyaltyRecord {
        address recipient;
        uint256 amount;
        uint256 timestamp;
    }

    mapping(uint256 => Asset) private assets;
    mapping(uint256 => ProvenanceRecord) private provenanceRecords;
    mapping(uint256 => RoyaltyRecord[]) private royaltyRecords;

    event AssetRegistered(uint256 indexed assetId, address indexed creator, uint256 timestamp);
    event RoyaltyDistributed(uint256 indexed assetId, address indexed recipient, uint256 amount);
    event RoyaltyRecorded(uint256 indexed assetId, address indexed recipient, uint256 amount);

    /**
     * @dev Registers an asset with the Origin Protocol
     * @param assetId The ID of the asset to register
     * @param creator The address of the asset creator/owner
     */
    function registerAsset(uint256 assetId, address creator) external override {
        require(!assets[assetId].exists, "Asset already registered");
        
        assets[assetId] = Asset({
            creator: creator,
            registrationTime: block.timestamp,
            exists: true,
            licenseType: "All Rights Reserved",
            licenseURI: ""
        });

        // Initialize provenance record
        address[] memory creators = new address[](1);
        creators[0] = creator;
        
        uint256[] memory timestamps = new uint256[](1);
        timestamps[0] = block.timestamp;
        
        string[] memory descriptions = new string[](1);
        descriptions[0] = "Asset registration";
        
        provenanceRecords[assetId] = ProvenanceRecord({
            creators: creators,
            timestamps: timestamps,
            descriptions: descriptions
        });

        emit AssetRegistered(assetId, creator, block.timestamp);
    }

    /**
     * @dev Distributes royalty payments for an asset
     * @param assetId The ID of the asset
     * @param recipient The address receiving the royalty payment
     * @param amount The amount to distribute
     */
    function distributeRoyalty(uint256 assetId, address recipient, uint256 amount) external override {
        require(assets[assetId].exists, "Asset does not exist");
        
        // Record the royalty
        royaltyRecords[assetId].push(RoyaltyRecord({
            recipient: recipient,
            amount: amount,
            timestamp: block.timestamp
        }));
        
        emit RoyaltyDistributed(assetId, recipient, amount);
    }

    /**
     * @dev Records royalty payments for an asset without transferring funds
     * @param assetId The ID of the asset
     * @param recipient The address that received the royalty
     * @param amount The amount paid
     */
    function recordRoyaltyPayment(uint256 assetId, address recipient, uint256 amount) external override {
        require(assets[assetId].exists, "Asset does not exist");
        
        royaltyRecords[assetId].push(RoyaltyRecord({
            recipient: recipient,
            amount: amount,
            timestamp: block.timestamp
        }));
        
        emit RoyaltyRecorded(assetId, recipient, amount);
    }

    /**
     * @dev Verifies if an address is the owner of an asset
     * @param assetId The ID of the asset to verify
     * @param claimedOwner The address claiming ownership
     * @return isOwner True if the address is the owner, false otherwise
     */
    function verifyOwnership(uint256 assetId, address claimedOwner) external view override returns (bool isOwner) {
        return assets[assetId].exists && assets[assetId].creator == claimedOwner;
    }

    /**
     * @dev Gets usage rights information for an asset
     * @param assetId The ID of the asset
     * @return licenseType The type of license
     * @return licenseURI URI pointing to the full license details
     */
    function getUsageRights(uint256 assetId) external view override returns (string memory licenseType, string memory licenseURI) {
        require(assets[assetId].exists, "Asset does not exist");
        return (assets[assetId].licenseType, assets[assetId].licenseURI);
    }

    /**
     * @dev Gets provenance information for an asset
     * @param assetId The ID of the asset
     * @return creators Array of creator addresses
     * @return timestamps Array of timestamps for each creation/modification event
     * @return descriptions Array of descriptions for each creation/modification event
     */
    function getProvenance(uint256 assetId) external view override returns (
        address[] memory creators,
        uint256[] memory timestamps,
        string[] memory descriptions
    ) {
        require(assets[assetId].exists, "Asset does not exist");
        ProvenanceRecord storage record = provenanceRecords[assetId];
        return (record.creators, record.timestamps, record.descriptions);
    }

    /**
     * @dev Updates the license information for an asset
     * @param assetId The ID of the asset
     * @param licenseType The new license type
     * @param licenseURI The new license URI
     */
    function setLicense(uint256 assetId, string memory licenseType, string memory licenseURI) external onlyOwner {
        require(assets[assetId].exists, "Asset does not exist");
        assets[assetId].licenseType = licenseType;
        assets[assetId].licenseURI = licenseURI;
    }

    /**
     * @dev Adds a new provenance record to an asset
     * @param assetId The ID of the asset
     * @param creator The address to add to creators
     * @param description Description of the provenance event
     */
    function addProvenanceRecord(uint256 assetId, address creator, string memory description) external onlyOwner {
        require(assets[assetId].exists, "Asset does not exist");
        ProvenanceRecord storage record = provenanceRecords[assetId];
        
        uint256 length = record.creators.length;
        address[] memory newCreators = new address[](length + 1);
        uint256[] memory newTimestamps = new uint256[](length + 1);
        string[] memory newDescriptions = new string[](length + 1);
        
        for (uint256 i = 0; i < length; i++) {
            newCreators[i] = record.creators[i];
            newTimestamps[i] = record.timestamps[i];
            newDescriptions[i] = record.descriptions[i];
        }
        
        newCreators[length] = creator;
        newTimestamps[length] = block.timestamp;
        newDescriptions[length] = description;
        
        record.creators = newCreators;
        record.timestamps = newTimestamps;
        record.descriptions = newDescriptions;
    }
}
