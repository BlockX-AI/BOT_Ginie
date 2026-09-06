# AcademicChain Frontend Development Guide

## Overview

This document outlines the requirements for developing the AcademicChain frontend application. The frontend will interact with the AcademicChain API to provide researchers, institutions, and readers with a user-friendly interface for managing research papers, citations, and royalty distributions on the blockchain.

## Table of Contents
- [Technical Stack](#technical-stack)
- [Core Features](#core-features)
- [Page Structure](#page-structure)
- [Component Requirements](#component-requirements)
- [User Flows](#user-flows)
- [Integration with API](#integration-with-api)
- [Wallet Integration](#wallet-integration)
- [Design Guidelines](#design-guidelines)
- [Testing Requirements](#testing-requirements)
- [Implementation Priority](#implementation-priority)

## Technical Stack

**Recommended stack:**
- **Frontend Framework**: React.js (v18+)
- **State Management**: Redux or React Context API
- **Styling**: Tailwind CSS or Material UI
- **Web3 Integration**: ethers.js v6 (same as API)
- **API Client**: Axios
- **Routing**: React Router v6
- **Form Handling**: React Hook Form
- **Documentation**: StoryBook (optional)

## Core Features

### 1. Authentication & User Management
- Wallet connection (MetaMask, WalletConnect)
- User profile management
- Role-based access (researcher, institution, reader)

### 2. Research Paper Management
- Paper registration form
- Paper details view
- Search functionality (by title, keyword, author)
- Paper listing with filtering/sorting
- Paper verification for institutions

### 3. Citation System
- Citation creation interface
- Citation visualization (citation network)
- Citation verification for institutions

### 4. Royalty Management
- Royalty payment interface
- Balance checking
- Payment history
- Withdrawal interface

### 5. Origin Protocol Integration
- Asset registration
- Asset ownership verification
- Asset transfer interface

## Page Structure

### Public Pages
1. **Home Page**
   - Platform overview
   - Featured papers
   - Statistics (total papers, citations, royalties distributed)
   - Call to action for registration/login

2. **Paper Explorer**
   - Searchable/filterable list of papers
   - Advanced search options (date, author, keywords, citation count)
   - Preview cards with basic paper information

3. **Paper Details** (public view)
   - Paper metadata (title, authors, date, abstract)
   - Citation count and list of citing papers
   - Verification status
   - Link to full paper (if available)

4. **About/FAQ**
   - Platform explanation
   - How the system works
   - Benefits for researchers

### Authenticated Pages
5. **Dashboard**
   - Overview of user's papers
   - Recent citations to user's work
   - Royalty summary
   - Action cards for common tasks

6. **My Papers**
   - List of user's registered papers
   - Paper status indicators (verification status, citation count)
   - Actions (register new, update, etc.)

7. **Paper Registration**
   - Multi-step form for paper submission
   - IPFS upload integration
   - Co-author management
   - Keyword selection

8. **Citation Management**
   - Create new citations
   - View received citations
   - Citation verification status

9. **Royalty Hub**
   - Current balance
   - Payment history
   - Make payments to other researchers
   - Withdraw funds

10. **Profile Settings**
    - User information
    - Notification preferences
    - Wallet connections

11. **Institution Verification Portal** (for institutions)
    - Papers pending verification
    - Citation verification requests
    - Verification history

## Component Requirements

### Core Components

1. **WalletConnector**
   - Connect button
   - Connected wallet info
   - Network status/switcher

2. **PaperCard**
   - Paper thumbnail/icon
   - Title, authors, publication date
   - Citation count
   - Verification badge
   - Action menu

3. **SearchBar**
   - Keyword search
   - Advanced filters (dropdown/modal)
   - Recent searches

4. **CitationGraph**
   - Visual representation of paper citations
   - Interactive nodes
   - Zoom/pan controls

5. **TransactionModal**
   - Transaction details
   - Status updates
   - Confirmation steps
   - Success/failure feedback

6. **RoyaltyCalculator**
   - Input amount
   - Split calculation (for co-authors)
   - Fee display

7. **VerificationBadge**
   - Visual indicator of verification status
   - Tooltip with verification details
   - Click action to view verification

8. **MetadataEditor**
   - Form for paper metadata
   - Keyword management (add/remove)
   - Co-author management

### Form Components

1. **PaperSubmissionForm**
   - File upload (PDF → IPFS)
   - Metadata input
   - Co-author selection
   - Keyword selection
   - Preview functionality

2. **CitationForm**
   - Citing paper selection
   - Cited paper selection (search functionality)
   - Citation context (optional)
   - Citation location (page/section)

3. **RoyaltyPaymentForm**
   - Recipient selection
   - Amount input
   - Reason selection
   - Payment confirmation

## User Flows

### Researcher Flow
1. Connect wallet
2. Register new paper
   - Upload paper to IPFS
   - Fill metadata
   - Submit transaction
3. View paper on dashboard
4. Create citations to other papers
5. Monitor received citations
6. Collect and withdraw royalties

### Institution Flow
1. Connect institution wallet
2. Access verification portal
3. Review pending verification requests
4. Verify papers/citations
5. Generate verification reports

### Reader Flow
1. Browse paper explorer
2. Search for specific papers
3. View paper details
4. (Optional) Connect wallet
5. Pay royalties for access/use

## Integration with API

### API Client Setup
Create an API client module using Axios that encapsulates all API calls. Configure base URL, error handling, and response transformation.

```javascript
// Example API client setup
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Error handling interceptor
apiClient.interceptors.response.use(
  response => response,
  error => {
    // Handle errors (show notifications, etc)
    return Promise.reject(error);
  }
);

export default apiClient;
```

### API Service Modules
Create separate service modules for each API category:

1. **PaperService** - Interface with `/api/papers` endpoints
2. **CitationService** - Interface with `/api/citations` endpoints
3. **RoyaltyService** - Interface with `/api/royalties` endpoints
4. **OriginService** - Interface with `/api/origin` endpoints

Example service implementation:

```javascript
// Example PaperService
import apiClient from './apiClient';

export const PaperService = {
  registerPaper: (paperData) => 
    apiClient.post('/api/papers', paperData),
  
  getPaper: (id) => 
    apiClient.get(`/api/papers/${id}`),
  
  getResearcherPapers: (address) => 
    apiClient.get(`/api/papers/researcher/${address}`),
  
  // etc.
};
```

## Wallet Integration

### Requirements
- Support for MetaMask and WalletConnect
- Network detection and switching (to Basecamp)
- Transaction signing and confirmation
- Address display with ENS resolution (if available)

### Implementation
Use ethers.js for wallet integration, matching the API server's ethers.js version:

```javascript
// Example wallet connector
import { ethers } from 'ethers';

export const connectWallet = async () => {
  if (window.ethereum) {
    try {
      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      // Create ethers provider
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Check network
      const network = await provider.getNetwork();
      const chainId = network.chainId;
      
      // Switch to Basecamp if needed (chainId: 123420001114)
      if (chainId !== BigInt(123420001114)) {
        // Show network switch prompt
      }
      
      return { account: accounts[0], provider, signer };
    } catch (error) {
      throw new Error('Failed to connect wallet: ' + error.message);
    }
  } else {
    throw new Error('No Ethereum wallet found. Please install MetaMask.');
  }
};
```

## Design Guidelines

### Visual Identity
- Clean, academic aesthetic
- Blue and white primary color scheme with accent colors
- Paper/document visual metaphors
- Blockchain visualization for citations

### UI Components
- Use consistent card-based design for papers
- Clear status indicators (verified, pending, rejected)
- Transaction progress indicators
- Responsive design for desktop and mobile

### UX Considerations
- Minimize blockchain complexity for users
- Provide clear feedback for all transactions
- Include help tooltips for blockchain concepts
- Optimize gas usage and explain fees
- Support dark mode

## Testing Requirements

### Unit Tests
- Component testing with React Testing Library
- Service/API client tests with mock responses

### Integration Tests
- Wallet connection flow
- Paper registration flow
- Citation creation flow
- Royalty payment flow

### E2E Tests
- Full user journeys using Cypress
- Test on multiple browsers and devices

## Implementation Priority

### Phase 1: Core Infrastructure
1. Wallet connection
2. API service integration
3. Basic navigation/routing
4. User authentication

### Phase 2: Paper Management
5. Paper registration
6. Paper explorer
7. Paper detail view
8. Search functionality

### Phase 3: Citations & Verification
9. Citation creation
10. Citation visualization
11. Verification interface

### Phase 4: Royalties & Advanced Features
12. Royalty payment/withdrawal
13. Analytics dashboard
14. Notification system

## Technical Notes

### State Management
Use Redux or Context API for:
- User authentication state
- Connected wallet information
- Transaction status tracking
- Paper/citation data caching

### Performance Considerations
- Implement pagination for paper/citation lists
- Use virtualization for large lists (react-window)
- Cache API responses
- Optimize blockchain calls
- Implement debounced search

### Security Best Practices
- Never store private keys in frontend code
- Use appropriate error handling for API/blockchain errors
- Validate all user inputs
- Implement rate limiting for API requests
- Consider using Web3Auth for improved UX

## Deployment Strategy
- Configure for deployment on Vercel or Netlify
- Set up environment variables for different environments
- Implement CI/CD pipeline
- Configure proper CORS settings with API
- Set up monitoring and error tracking (Sentry)

---

This guide provides a comprehensive overview of the requirements for the AcademicChain frontend application. The development team should use this as a starting point but may need to adapt and evolve the requirements as the project develops. Regular communication with the backend team is essential to ensure smooth integration between the frontend and the API.
