// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IOriginProtocol
 * @dev Interface for Camp Network's Origin Protocol
 * This interface defines the methods needed to interact with Camp Network's Origin Protocol
 * for asset registration, royalty distribution, ownership verification, and provenance tracking.
 */
interface IOriginProtocol {
    /**
     * @dev Registers an asset with the Origin Protocol
     * @param assetId The ID of the asset to register
     * @param creator The address of the asset creator/owner
     */
    function registerAsset(uint256 assetId, address creator) external;

    /**
     * @dev Distributes royalty payments for an asset
     * @param assetId The ID of the asset
     * @param recipient The address receiving the royalty payment
     * @param amount The amount to distribute
     */
    function distributeRoyalty(uint256 assetId, address recipient, uint256 amount) external;

    /**
     * @dev Records royalty payments for an asset without transferring funds
     * @param assetId The ID of the asset
     * @param recipient The address that received the royalty
     * @param amount The amount paid
     */
    function recordRoyaltyPayment(uint256 assetId, address recipient, uint256 amount) external;

    /**
     * @dev Verifies if an address is the owner of an asset
     * @param assetId The ID of the asset to verify
     * @param claimedOwner The address claiming ownership
     * @return isOwner True if the address is the owner, false otherwise
     */
    function verifyOwnership(uint256 assetId, address claimedOwner) external view returns (bool isOwner);

    /**
     * @dev Gets usage rights information for an asset
     * @param assetId The ID of the asset
     * @return licenseType The type of license (e.g., "CC-BY", "All Rights Reserved")
     * @return licenseURI URI pointing to the full license details
     */
    function getUsageRights(uint256 assetId) external view returns (string memory licenseType, string memory licenseURI);

    /**
     * @dev Gets provenance information for an asset
     * @param assetId The ID of the asset
     * @return creators Array of creator addresses
     * @return timestamps Array of timestamps for each creation/modification event
     * @return descriptions Array of descriptions for each creation/modification event
     */
    function getProvenance(uint256 assetId) external view returns (
        address[] memory creators,
        uint256[] memory timestamps,
        string[] memory descriptions
    );
}
