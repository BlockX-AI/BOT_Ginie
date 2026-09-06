// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./interfaces/IOriginProtocol.sol";
import "./CitationRegistry.sol";

/**
 * @title ResearchPaper
 * @dev ERC721 token representing academic research papers
 * This contract handles paper registration, citation, verification, and royalty management.
 */
contract ResearchPaper is ERC721URIStorage, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    struct Paper {
        string ipfsHash;       // IPFS link to the paper content
        address researcher;    // Original author
        uint256 publishDate;   // Timestamp of registration
        string title;          // Paper title
        string[] keywords;     // Research keywords
        uint256 citationCount; // Number of citations (cached)
        bool isVerified;       // Verification status
        address[] coAuthors;   // Co-authors who may receive royalties
    }
    
    // Paper ID counter
    Counters.Counter private _tokenIds;
    
    // Paper metadata storage
    mapping(uint256 => Paper) public papers;
    
    // Keyword to paper IDs mapping for search
    mapping(string => uint256[]) private keywordPapers;
    
    // Researcher to paper IDs mapping
    mapping(address => uint256[]) private researcherPapers;
    
    // Citation registry contract
    CitationRegistry public citationRegistry;
    
    // Origin Protocol for IP registration and verification
    IOriginProtocol public originProtocol;
    
    // Verifier addresses that can verify papers
    mapping(address => bool) public verifiers;
    
    // Events
    event PaperRegistered(uint256 indexed paperId, address indexed researcher, string title, string ipfsHash);
    event PaperCited(uint256 indexed citingPaperId, uint256 indexed citedPaperId, uint256 citationId);
    event PaperVerified(uint256 indexed paperId, address indexed verifier);
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);
    event CitationRegistryUpdated(address indexed citationRegistry);

    // Modifiers
    modifier onlyVerifier() {
        require(verifiers[msg.sender] || msg.sender == owner(), "Not authorized as verifier");
        _;
    }

    modifier onlyPaperOwner(uint256 paperId) {
        require(ownerOf(paperId) == msg.sender, "Not the paper owner");
        _;
    }

    modifier paperExists(uint256 paperId) {
        require(_exists(paperId), "Paper does not exist");
        _;
    }

    /**
     * @dev Constructor initializes the contract
     * @param name Name of the ERC721 token
     * @param symbol Symbol of the ERC721 token
     * @param _originProtocol Address of the Origin Protocol contract
     */
    constructor(
        string memory name,
        string memory symbol,
        address _originProtocol
    ) ERC721(name, symbol) {
        require(_originProtocol != address(0), "Invalid Origin Protocol address");
        originProtocol = IOriginProtocol(_originProtocol);
    }

    /**
     * @dev Register a new research paper
     * @param _ipfsHash IPFS hash of the paper content
     * @param _title Title of the paper
     * @param _tokenURI URI for the paper metadata
     * @param _keywords Array of keywords for the paper
     * @param _coAuthors Array of co-author addresses (optional)
     * @return paperId The ID of the newly registered paper
     */
    function registerPaper(
        string memory _ipfsHash,
        string memory _title,
        string memory _tokenURI,
        string[] memory _keywords,
        address[] memory _coAuthors
    ) external nonReentrant returns (uint256) {
        _tokenIds.increment();
        uint256 paperId = _tokenIds.current();
        
        // Mint the NFT
        _safeMint(msg.sender, paperId);
        _setTokenURI(paperId, _tokenURI);
        
        // Store paper metadata
        papers[paperId] = Paper({
            ipfsHash: _ipfsHash,
            researcher: msg.sender,
            publishDate: block.timestamp,
            title: _title,
            keywords: _keywords,
            citationCount: 0,
            isVerified: false,
            coAuthors: _coAuthors
        });
        
        // Update mappings
        researcherPapers[msg.sender].push(paperId);
        
        // Add paper to keyword index
        for (uint i = 0; i < _keywords.length; i++) {
            keywordPapers[_keywords[i]].push(paperId);
        }
        
        // Register with Origin Protocol
        originProtocol.registerAsset(paperId, msg.sender);
        
        emit PaperRegistered(paperId, msg.sender, _title, _ipfsHash);
        
        return paperId;
    }

    /**
     * @dev Cite another paper
     * @param _citingPaperId The ID of the paper doing the citing
     * @param _citedPaperId The ID of the paper being cited
     * @return citationId The ID of the created citation
     */
    function citePaper(uint256 _citingPaperId, uint256 _citedPaperId) 
        external
        paperExists(_citingPaperId)
        paperExists(_citedPaperId)
        onlyPaperOwner(_citingPaperId)
        returns (uint256) 
    {
        require(address(citationRegistry) != address(0), "Citation registry not set");
        require(_citingPaperId != _citedPaperId, "Cannot cite self");
        
        // Record citation in the registry
        uint256 citationId = citationRegistry.recordCitation(
            _citingPaperId, 
            _citedPaperId,
            msg.sender
        );
        
        // Update citation count cache
        papers[_citedPaperId].citationCount++;
        
        emit PaperCited(_citingPaperId, _citedPaperId, citationId);
        
        return citationId;
    }

    /**
     * @dev Verify a paper (only callable by authorized verifiers)
     * @param _paperId The ID of the paper to verify
     */
    function verifyPaper(uint256 _paperId) 
        external
        onlyVerifier
        paperExists(_paperId)
    {
        require(!papers[_paperId].isVerified, "Paper already verified");
        
        papers[_paperId].isVerified = true;
        
        emit PaperVerified(_paperId, msg.sender);
    }

    /**
     * @dev Set the citation registry contract
     * @param _citationRegistry Address of the citation registry contract
     */
    function setCitationRegistry(address _citationRegistry) external onlyOwner {
        require(_citationRegistry != address(0), "Invalid address");
        citationRegistry = CitationRegistry(_citationRegistry);
        emit CitationRegistryUpdated(_citationRegistry);
    }

    /**
     * @dev Add a verifier
     * @param _verifier Address of the verifier to add
     */
    function addVerifier(address _verifier) external onlyOwner {
        require(_verifier != address(0), "Invalid address");
        require(!verifiers[_verifier], "Already a verifier");
        
        verifiers[_verifier] = true;
        
        emit VerifierAdded(_verifier);
    }

    /**
     * @dev Remove a verifier
     * @param _verifier Address of the verifier to remove
     */
    function removeVerifier(address _verifier) external onlyOwner {
        require(verifiers[_verifier], "Not a verifier");
        
        verifiers[_verifier] = false;
        
        emit VerifierRemoved(_verifier);
    }

    /**
     * @dev Get all papers published by a researcher
     * @param _researcher Address of the researcher
     * @return Array of paper IDs published by the researcher
     */
    function getPapersByResearcher(address _researcher) external view returns (uint256[] memory) {
        return researcherPapers[_researcher];
    }

    /**
     * @dev Get papers by keyword
     * @param _keyword Keyword to search for
     * @return Array of paper IDs with the specified keyword
     */
    function getPapersByKeyword(string memory _keyword) external view returns (uint256[] memory) {
        return keywordPapers[_keyword];
    }

    /**
     * @dev Get paper details
     * @param _paperId ID of the paper
     * @return ipfsHash IPFS hash of the paper content
     * @return researcher Author address
     * @return publishDate Timestamp of registration
     * @return title Title of the paper
     * @return citationCount Number of citations
     * @return isVerified Verification status
     */
    function getPaperDetails(uint256 _paperId) 
        external 
        view 
        paperExists(_paperId)
        returns (
            string memory ipfsHash,
            address researcher,
            uint256 publishDate,
            string memory title,
            uint256 citationCount,
            bool isVerified
        )
    {
        Paper memory paper = papers[_paperId];
        
        return (
            paper.ipfsHash,
            paper.researcher,
            paper.publishDate,
            paper.title,
            paper.citationCount,
            paper.isVerified
        );
    }

    /**
     * @dev Get paper keywords
     * @param _paperId ID of the paper
     * @return Array of keywords for the paper
     */
    function getPaperKeywords(uint256 _paperId) 
        external 
        view 
        paperExists(_paperId)
        returns (string[] memory)
    {
        return papers[_paperId].keywords;
    }

    /**
     * @dev Get paper co-authors
     * @param _paperId ID of the paper
     * @return Array of co-author addresses
     */
    function getPaperCoAuthors(uint256 _paperId) 
        external 
        view 
        paperExists(_paperId)
        returns (address[] memory)
    {
        return papers[_paperId].coAuthors;
    }

    /**
     * @dev Check if an address is a co-author of a paper
     * @param _paperId ID of the paper
     * @param _researcher Address to check
     * @return True if the address is a co-author
     */
    function isCoAuthor(uint256 _paperId, address _researcher) 
        external 
        view 
        paperExists(_paperId)
        returns (bool)
    {
        if (papers[_paperId].researcher == _researcher) {
            return true;
        }
        
        address[] memory coAuthors = papers[_paperId].coAuthors;
        for (uint i = 0; i < coAuthors.length; i++) {
            if (coAuthors[i] == _researcher) {
                return true;
            }
        }
        
        return false;
    }
}
