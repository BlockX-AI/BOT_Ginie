# AcademicChain API Documentation

This document provides comprehensive documentation for the AcademicChain API, designed for frontend developers integrating with the system.

## Table of Contents
- [General Information](#general-information)
- [Authentication](#authentication)
- [Base URL](#base-url)
- [Research Paper Endpoints](#research-paper-endpoints)
- [Citation Registry Endpoints](#citation-registry-endpoints)
- [Royalty Distributor Endpoints](#royalty-distributor-endpoints)
- [Origin Protocol Endpoints](#origin-protocol-endpoints)
- [Error Handling](#error-handling)
- [Testing](#testing)

## General Information

The AcademicChain API is a RESTful service that allows interaction with the AcademicChain smart contracts deployed on the Basecamp network. It enables the registration and management of research papers, tracking of citations between papers, and distribution of royalty payments.

### Contract Addresses

The API interacts with the following smart contracts:

- **ResearchPaper**: `0x0D3afa3339Cad61d7a4f4390D651d933B5Dc913d`
- **CitationRegistry**: `0xF09B40Dfc07A584970312D1f62Ed84A4EDd575c9`
- **RoyaltyDistributor**: `0x41D13507f38b4acd2ED99BFbBc785D96Ce420386`
- **MockOriginProtocol**: `0x83A3AFEb5D6AEbcc01eaF42AA6bb9f08b58031A1`

## Authentication

The API currently uses a predefined wallet (configured in the .env file) to sign all blockchain transactions. Frontend applications should handle user authentication separately and pass relevant addresses as parameters to the API.

## Base URL

```
http://localhost:3000
```

Interactive Swagger documentation is available at:

```
http://localhost:3000/api-docs
```

## Research Paper Endpoints

### Register a Paper

**Endpoint**: `POST /api/papers`

**Description**: Register a new research paper as an NFT on the blockchain.

**Request Body**:
```json
{
  "ipfsHash": "QmPaperContentHash123",
  "title": "Example Research Paper Title",
  "tokenURI": "https://example.com/metadata/paper1",
  "keywords": ["blockchain", "research", "academic"],
  "coAuthors": ["0x123456789abcdef123456789abcdef123456789a"]
}
```

**Response**:
```json
{
  "success": true,
  "paperId": "1",
  "txHash": "0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234"
}
```

### Get Paper Details

**Endpoint**: `GET /api/papers/:id`

**Description**: Retrieve details about a specific research paper.

**Parameters**:
- `id` (path parameter): The ID of the paper to retrieve

**Response**:
```json
{
  "ipfsHash": "QmPaperContentHash123",
  "researcher": "0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E",
  "publishDate": "1755006819",
  "title": "Example Research Paper Title",
  "citationCount": "2",
  "isVerified": true,
  "keywords": ["blockchain", "research", "academic"],
  "coAuthors": ["0x123456789abcdef123456789abcdef123456789a"]
}
```

### Get Papers by Researcher

**Endpoint**: `GET /api/papers/researcher/:address`

**Description**: Get all papers registered by a specific researcher.

**Parameters**:
- `address` (path parameter): Ethereum address of the researcher

**Response**:
```json
{
  "papers": ["1", "2", "5"]
}
```

### Get Papers by Keyword

**Endpoint**: `GET /api/papers/keyword/:keyword`

**Description**: Get all papers that contain a specific keyword.

**Parameters**:
- `keyword` (path parameter): Keyword to search for

**Response**:
```json
{
  "papers": ["1", "3", "7"]
}
```

### Verify a Paper

**Endpoint**: `POST /api/papers/verify/:id`

**Description**: Verify a paper to increase its credibility.

**Parameters**:
- `id` (path parameter): The ID of the paper to verify

**Response**:
```json
{
  "success": true,
  "paperId": "1",
  "txHash": "0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234"
}
```

### Cite a Paper

**Endpoint**: `POST /api/papers/cite`

**Description**: Record a citation from one paper to another.

**Request Body**:
```json
{
  "citingPaperId": "2",
  "citedPaperId": "1"
}
```

**Response**:
```json
{
  "success": true,
  "citationId": "1",
  "txHash": "0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234"
}
```

## Citation Registry Endpoints

### Get Citations for a Paper

**Endpoint**: `GET /api/citations/paper/:id`

**Description**: Get all citations for a specific paper.

**Parameters**:
- `id` (path parameter): The ID of the cited paper

**Response**:
```json
{
  "citations": ["1", "2", "3"]
}
```

### Get Papers Cited By

**Endpoint**: `GET /api/citations/cited-by/:id`

**Description**: Get all papers cited by a specific paper.

**Parameters**:
- `id` (path parameter): The ID of the citing paper

**Response**:
```json
{
  "citations": ["1", "4"]
}
```

### Get Citation Count

**Endpoint**: `GET /api/citations/count/:id`

**Description**: Get the total number of citations for a paper.

**Parameters**:
- `id` (path parameter): The ID of the paper

**Response**:
```json
{
  "count": "5"
}
```

### Get Citation Details

**Endpoint**: `GET /api/citations/:id`

**Description**: Get details about a specific citation.

**Parameters**:
- `id` (path parameter): The ID of the citation

**Response**:
```json
{
  "citingPaperId": "2",
  "citedPaperId": "1",
  "citer": "0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E",
  "timestamp": "1755006856",
  "isVerified": false
}
```

### Verify a Citation

**Endpoint**: `POST /api/citations/verify/:id`

**Description**: Verify a citation to increase its credibility.

**Parameters**:
- `id` (path parameter): The ID of the citation to verify

**Response**:
```json
{
  "success": true,
  "citationId": "1",
  "txHash": "0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234"
}
```

## Royalty Distributor Endpoints

### Pay Royalty

**Endpoint**: `POST /api/royalties/pay`

**Description**: Pay a royalty to a researcher for their paper.

**Request Body**:
```json
{
  "paperId": "1",
  "researcher": "0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E",
  "amount": "0.01",
  "reason": "License fee"
}
```

**Response**:
```json
{
  "success": true,
  "paymentId": "1",
  "txHash": "0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234",
  "amount": "0.01"
}
```

### Get Researcher Balance

**Endpoint**: `GET /api/royalties/balance/:address`

**Description**: Get the current royalty balance for a researcher.

**Parameters**:
- `address` (path parameter): Ethereum address of the researcher

**Response**:
```json
{
  "balance": "0.035",
  "address": "0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E"
}
```

### Get Paper Payments

**Endpoint**: `GET /api/royalties/paper/:id`

**Description**: Get all royalty payments for a specific paper.

**Parameters**:
- `id` (path parameter): The ID of the paper

**Response**:
```json
{
  "payments": ["1", "2", "3"]
}
```

### Get Payment Details

**Endpoint**: `GET /api/royalties/payment/:id`

**Description**: Get details about a specific royalty payment.

**Parameters**:
- `id` (path parameter): The ID of the payment

**Response**:
```json
{
  "paperId": "1",
  "researcher": "0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E",
  "amount": "0.01",
  "timestamp": "1755006879",
  "payer": "0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E",
  "reason": "License fee"
}
```

### Get Total Royalties for Paper

**Endpoint**: `GET /api/royalties/total/:id`

**Description**: Get the total royalties paid for a paper.

**Parameters**:
- `id` (path parameter): The ID of the paper

**Response**:
```json
{
  "total": "0.045",
  "paperId": "1"
}
```

### Withdraw Royalties

**Endpoint**: `POST /api/royalties/withdraw`

**Description**: Withdraw accumulated royalties to a researcher's wallet.

**Request Body**:
```json
{
  "researcher": "0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E",
  "amount": "0.03"
}
```

**Response**:
```json
{
  "success": true,
  "amount": "0.03",
  "researcher": "0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E",
  "txHash": "0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234"
}
```

### Batch Pay Royalties

**Endpoint**: `POST /api/royalties/batch-pay`

**Description**: Pay royalties to multiple researchers in a single transaction.

**Request Body**:
```json
{
  "payments": [
    {
      "paperId": "1",
      "researcher": "0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E",
      "amount": "0.01",
      "reason": "Citation reward"
    },
    {
      "paperId": "2",
      "researcher": "0xb69DCCb0F17279abD1d0D9069Aa8711Df4a4c58F",
      "amount": "0.02",
      "reason": "License fee"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "paymentCount": 2,
  "txHash": "0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234"
}
```

## Origin Protocol Endpoints

### Register Asset

**Endpoint**: `POST /api/origin/register`

**Description**: Register a new asset with the Origin Protocol.

**Request Body**:
```json
{
  "owner": "0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E",
  "metadata": "https://example.com/asset-metadata"
}
```

**Response**:
```json
{
  "success": true,
  "assetId": "1",
  "txHash": "0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234"
}
```

### Verify Ownership

**Endpoint**: `POST /api/origin/verify-ownership`

**Description**: Verify ownership of an asset.

**Request Body**:
```json
{
  "assetId": "1",
  "owner": "0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E"
}
```

**Response**:
```json
{
  "assetId": "1",
  "owner": "0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E",
  "isOwner": true
}
```

### Get Asset Details

**Endpoint**: `GET /api/origin/asset/:id`

**Description**: Get details about a specific asset.

**Parameters**:
- `id` (path parameter): The ID of the asset

**Response**:
```json
{
  "assetId": "1",
  "owner": "0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E",
  "metadata": "https://example.com/asset-metadata",
  "timestamp": "1755006900"
}
```

### Get Assets by Owner

**Endpoint**: `GET /api/origin/assets/owner/:address`

**Description**: Get all assets owned by a specific address.

**Parameters**:
- `address` (path parameter): Ethereum address of the owner

**Response**:
```json
{
  "owner": "0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E",
  "assets": ["1", "2"]
}
```

### Transfer Ownership

**Endpoint**: `POST /api/origin/transfer`

**Description**: Transfer ownership of an asset to a new owner.

**Request Body**:
```json
{
  "assetId": "1",
  "newOwner": "0xb69DCCb0F17279abD1d0D9069Aa8711Df4a4c58F"
}
```

**Response**:
```json
{
  "success": true,
  "assetId": "1",
  "newOwner": "0xb69DCCb0F17279abD1d0D9069Aa8711Df4a4c58F",
  "txHash": "0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234"
}
```

## Error Handling

The API uses standard HTTP status codes to indicate the success or failure of a request:

- `200 OK`: The request was successful
- `400 Bad Request`: The request was malformed or missing required fields
- `404 Not Found`: The requested resource was not found
- `500 Internal Server Error`: An error occurred on the server

Error responses include an error message:

```json
{
  "error": "Error message describing the issue"
}
```

## Testing

A comprehensive test script is available to validate all API endpoints:

```bash
cd api
node test-api.js
```

This script tests all endpoints and produces a detailed report of test results. It's recommended to run this script after any changes to the API or smart contracts to ensure everything is working correctly.

## Implementation Notes for Frontend Developers

### Transaction Processing

When sending transactions to blockchain-modifying endpoints (POST requests), note that:

1. Transactions may take several seconds to process on the blockchain
2. The API returns transaction hashes that can be used to track transaction status
3. For UX purposes, consider implementing a pending/loading state while transactions are being processed

### Ethereum Addresses

All Ethereum addresses should be properly formatted with the `0x` prefix. The API will attempt to normalize addresses but providing correctly formatted addresses is recommended.

### Gas and Transaction Costs

The API server handles gas estimation and transaction costs. All transactions are signed by the wallet configured on the server. In a production environment, you would typically implement a different approach that allows users to sign transactions with their own wallets.

### Pagination

Currently, list endpoints do not implement pagination. When retrieving large datasets, be prepared to handle potentially large response payloads.

### Date Handling

Timestamps in responses are returned as Unix timestamps (seconds since epoch). Frontend applications should convert these to appropriate date formats for display.

## Contact

For any issues or questions regarding the API, please contact the development team.
