// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CitationRegistry
 * @dev Tracks citations between research papers
 * This contract is responsible for recording and verifying citations,
 * as well as providing methods to query citation data.
 */
contract CitationRegistry is Ownable {
    struct Citation {
        uint256 citationId;
        uint256 citingPaperId;   // Paper that is citing
        uint256 citedPaperId;    // Paper being cited
        address citer;
        uint256 timestamp;
        bool isVerified;
    }

    // All citations by citation ID
    mapping(uint256 => Citation) public citations;
    
    // Maps paperId to arrays of citation IDs where it's cited
    mapping(uint256 => uint256[]) private paperCitations;
    
    // Maps paperId to arrays of citation IDs that it cites
    mapping(uint256 => uint256[]) private paperCites;
    
    // Tracks the total number of citations
    uint256 private nextCitationId = 1;
    
    // Addresses allowed to record citations (typically other contracts)
    mapping(address => bool) public citationRecorders;
    
    // Addresses allowed to verify citations (typically academic institutions)
    mapping(address => bool) public citationVerifiers;

    // Events
    event CitationRecorded(uint256 indexed citationId, uint256 indexed citingPaperId, uint256 indexed citedPaperId, address citer);
    event CitationVerified(uint256 indexed citationId, address verifier);
    event CitationRecorderAdded(address indexed recorder);
    event CitationRecorderRemoved(address indexed recorder);
    event CitationVerifierAdded(address indexed verifier);
    event CitationVerifierRemoved(address indexed verifier);

    // Modifiers
    modifier onlyCitationRecorder() {
        require(citationRecorders[msg.sender] || msg.sender == owner(), "Not authorized to record citations");
        _;
    }

    modifier onlyCitationVerifier() {
        require(citationVerifiers[msg.sender] || msg.sender == owner(), "Not authorized to verify citations");
        _;
    }

    /**
     * @dev Records a citation between papers
     * @param _citingPaperId The ID of the paper doing the citing
     * @param _citedPaperId The ID of the paper being cited
     * @param _citer Address of the account creating the citation
     * @return citationId The ID of the newly recorded citation
     */
    function recordCitation(
        uint256 _citingPaperId, 
        uint256 _citedPaperId, 
        address _citer
    ) external onlyCitationRecorder returns (uint256) {
        require(_citingPaperId != _citedPaperId, "Cannot cite self");
        
        // Create the citation
        uint256 citationId = nextCitationId++;
        
        citations[citationId] = Citation({
            citationId: citationId,
            citingPaperId: _citingPaperId,
            citedPaperId: _citedPaperId,
            citer: _citer,
            timestamp: block.timestamp,
            isVerified: false
        });
        
        // Update the citation lists
        paperCitations[_citedPaperId].push(citationId);
        paperCites[_citingPaperId].push(citationId);
        
        emit CitationRecorded(citationId, _citingPaperId, _citedPaperId, _citer);
        
        return citationId;
    }

    /**
     * @dev Verifies a citation
     * @param _citationId The ID of the citation to verify
     */
    function verifyCitation(uint256 _citationId) external onlyCitationVerifier {
        require(_citationId > 0 && _citationId < nextCitationId, "Citation does not exist");
        require(!citations[_citationId].isVerified, "Citation already verified");
        
        citations[_citationId].isVerified = true;
        
        emit CitationVerified(_citationId, msg.sender);
    }

    /**
     * @dev Get citation count for a paper
     * @param _paperId The ID of the paper
     * @return The number of times the paper has been cited
     */
    function getCitationCount(uint256 _paperId) external view returns (uint256) {
        return paperCitations[_paperId].length;
    }

    /**
     * @dev Get verified citation count for a paper
     * @param _paperId The ID of the paper
     * @return The number of verified citations for the paper
     */
    function getVerifiedCitationCount(uint256 _paperId) external view returns (uint256) {
        uint256 count = 0;
        uint256[] memory citationIds = paperCitations[_paperId];
        
        for (uint256 i = 0; i < citationIds.length; i++) {
            if (citations[citationIds[i]].isVerified) {
                count++;
            }
        }
        
        return count;
    }

    /**
     * @dev Get all citations for a paper
     * @param _paperId The ID of the paper
     * @return An array of citation IDs where the paper is cited
     */
    function getCitations(uint256 _paperId) external view returns (uint256[] memory) {
        return paperCitations[_paperId];
    }

    /**
     * @dev Get all papers cited by a paper
     * @param _paperId The ID of the paper
     * @return An array of citation IDs that the paper cites
     */
    function getCitedPapers(uint256 _paperId) external view returns (uint256[] memory) {
        return paperCites[_paperId];
    }

    /**
     * @dev Get details about a specific citation
     * @param _citationId The ID of the citation
     * @return citingPaperId The ID of the paper doing the citing
     * @return citedPaperId The ID of the paper being cited
     * @return citer Address of the account that created the citation
     * @return timestamp When the citation was recorded
     * @return isVerified Whether the citation has been verified
     */
    function getCitationDetails(uint256 _citationId) external view returns (
        uint256 citingPaperId,
        uint256 citedPaperId,
        address citer,
        uint256 timestamp,
        bool isVerified
    ) {
        require(_citationId > 0 && _citationId < nextCitationId, "Citation does not exist");
        Citation memory citation = citations[_citationId];
        
        return (
            citation.citingPaperId,
            citation.citedPaperId,
            citation.citer,
            citation.timestamp,
            citation.isVerified
        );
    }

    /**
     * @dev Add an address to the list of authorized citation recorders
     * @param _recorder Address to authorize
     */
    function addCitationRecorder(address _recorder) external onlyOwner {
        require(_recorder != address(0), "Invalid address");
        require(!citationRecorders[_recorder], "Already a citation recorder");
        
        citationRecorders[_recorder] = true;
        
        emit CitationRecorderAdded(_recorder);
    }

    /**
     * @dev Remove an address from the list of authorized citation recorders
     * @param _recorder Address to remove authorization from
     */
    function removeCitationRecorder(address _recorder) external onlyOwner {
        require(citationRecorders[_recorder], "Not a citation recorder");
        
        citationRecorders[_recorder] = false;
        
        emit CitationRecorderRemoved(_recorder);
    }

    /**
     * @dev Add an address to the list of authorized citation verifiers
     * @param _verifier Address to authorize
     */
    function addCitationVerifier(address _verifier) external onlyOwner {
        require(_verifier != address(0), "Invalid address");
        require(!citationVerifiers[_verifier], "Already a citation verifier");
        
        citationVerifiers[_verifier] = true;
        
        emit CitationVerifierAdded(_verifier);
    }

    /**
     * @dev Remove an address from the list of authorized citation verifiers
     * @param _verifier Address to remove authorization from
     */
    function removeCitationVerifier(address _verifier) external onlyOwner {
        require(citationVerifiers[_verifier], "Not a citation verifier");
        
        citationVerifiers[_verifier] = false;
        
        emit CitationVerifierRemoved(_verifier);
    }
}
