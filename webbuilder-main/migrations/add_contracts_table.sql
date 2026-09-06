-- Migration: Add contracts table for smart contract tracking
-- Run this migration to add DApp functionality

CREATE TABLE IF NOT EXISTS contracts (
    id VARCHAR(36) PRIMARY KEY,
    chat_id VARCHAR(36) NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    contract_name VARCHAR(255) NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    network VARCHAR(50) NOT NULL,
    chain_id INTEGER NOT NULL,
    abi JSON NOT NULL,
    source_code TEXT,
    job_id VARCHAR(100),
    deploy_tx_hash VARCHAR(66),
    verified INTEGER DEFAULT 0,
    explorer_url VARCHAR(512),
    deployment_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_contracts_chat_id (chat_id),
    INDEX idx_contracts_address (contract_address),
    INDEX idx_contracts_job_id (job_id)
);

-- Comments for documentation
COMMENT ON TABLE contracts IS 'Stores deployed smart contract information from AcademicChain';
COMMENT ON COLUMN contracts.chat_id IS 'Links contract to a project/chat';
COMMENT ON COLUMN contracts.contract_address IS 'Ethereum-style address (0x...)';
COMMENT ON COLUMN contracts.network IS 'Network name (sepolia, basecamp-testnet, polygon, etc.)';
COMMENT ON COLUMN contracts.chain_id IS 'EVM chain ID number';
COMMENT ON COLUMN contracts.abi IS 'Full contract ABI as JSON';
COMMENT ON COLUMN contracts.job_id IS 'AcademicChain job ID for tracking';
COMMENT ON COLUMN contracts.deployment_status IS 'pending, deployed, or failed';
