-- Unified HEX Staking Database Schema
-- Supports both Ethereum and PulseChain networks

-- Unified table for storing stake start events (both networks)
CREATE TABLE IF NOT EXISTS hex_stake_starts (
    id SERIAL PRIMARY KEY,
    stake_id VARCHAR(50) NOT NULL,
    staker_addr VARCHAR(42) NOT NULL,
    staked_hearts DECIMAL(30,8) NOT NULL,
    stake_shares DECIMAL(30,8) NOT NULL,
    stake_t_shares DECIMAL(30,8),
    staked_days INTEGER NOT NULL,
    start_day INTEGER NOT NULL,
    end_day INTEGER NOT NULL,
    timestamp BIGINT NOT NULL,
    is_auto_stake BOOLEAN DEFAULT FALSE,
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    network VARCHAR(20) NOT NULL, -- 'ethereum' or 'pulsechain'
    is_active BOOLEAN DEFAULT TRUE,
    days_served INTEGER DEFAULT 0,
    days_left INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Unique constraint on stake_id + network combination
    UNIQUE(stake_id, network)
);

-- Unified table for storing stake end events (both networks)
CREATE TABLE IF NOT EXISTS hex_stake_ends (
    id SERIAL PRIMARY KEY,
    stake_id VARCHAR(50) NOT NULL,
    staker_addr VARCHAR(42) NOT NULL,
    payout DECIMAL(30,8) DEFAULT 0,
    staked_hearts DECIMAL(30,8) NOT NULL,
    penalty DECIMAL(30,8) DEFAULT 0,
    served_days INTEGER NOT NULL,
    timestamp BIGINT NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    network VARCHAR(20) NOT NULL, -- 'ethereum' or 'pulsechain'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Unique constraint on stake_id + network combination
    UNIQUE(stake_id, network)
);

-- Unified table for storing global HEX protocol information (both networks)
CREATE TABLE IF NOT EXISTS hex_global_info (
    id SERIAL PRIMARY KEY,
    hex_day INTEGER NOT NULL,
    stake_shares_total DECIMAL(30,8) NOT NULL,
    stake_penalty_total DECIMAL(30,8) NOT NULL,
    locked_hearts_total DECIMAL(30,8) DEFAULT 0,
    latest_stake_id VARCHAR(50),
    timestamp BIGINT NOT NULL,
    network VARCHAR(20) NOT NULL, -- 'ethereum' or 'pulsechain'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Unique constraint on hex_day + network combination
    UNIQUE(hex_day, network)
);

-- Unified table for tracking sync status (both networks)
CREATE TABLE IF NOT EXISTS hex_sync_status (
    id SERIAL PRIMARY KEY,
    network VARCHAR(20) NOT NULL, -- 'ethereum' or 'pulsechain'
    last_synced_stake_id VARCHAR(50),
    last_synced_block BIGINT,
    last_synced_timestamp BIGINT,
    total_stakes_synced INTEGER DEFAULT 0,
    total_stake_ends_synced INTEGER DEFAULT 0,
    sync_in_progress BOOLEAN DEFAULT FALSE,
    last_sync_started_at TIMESTAMP,
    last_sync_completed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Unique constraint per network
    UNIQUE(network)
);

-- Unified table for storing staker metrics (both networks)
CREATE TABLE IF NOT EXISTS hex_staker_metrics (
    id SERIAL PRIMARY KEY,
    staker_addr VARCHAR(42) NOT NULL,
    total_stakes INTEGER DEFAULT 0,
    active_stakes INTEGER DEFAULT 0,
    ended_stakes INTEGER DEFAULT 0,
    total_staked_hearts DECIMAL(30,8) DEFAULT 0,
    total_t_shares DECIMAL(30,8) DEFAULT 0,
    total_payouts DECIMAL(30,8) DEFAULT 0,
    total_penalties DECIMAL(30,8) DEFAULT 0,
    average_stake_length DECIMAL(10,2) DEFAULT 0,
    first_stake_date TIMESTAMP,
    last_stake_date TIMESTAMP,
    network VARCHAR(20) NOT NULL, -- 'ethereum' or 'pulsechain'
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Unique constraint on staker_addr + network combination
    UNIQUE(staker_addr, network)
);

-- Optimized indexes for performance
-- Stake starts indexes
CREATE INDEX IF NOT EXISTS idx_hex_stake_starts_network ON hex_stake_starts(network);
CREATE INDEX IF NOT EXISTS idx_hex_stake_starts_staker_addr ON hex_stake_starts(staker_addr);
CREATE INDEX IF NOT EXISTS idx_hex_stake_starts_stake_id_network ON hex_stake_starts(stake_id, network);
CREATE INDEX IF NOT EXISTS idx_hex_stake_starts_timestamp ON hex_stake_starts(timestamp);
CREATE INDEX IF NOT EXISTS idx_hex_stake_starts_is_active ON hex_stake_starts(is_active);
CREATE INDEX IF NOT EXISTS idx_hex_stake_starts_staked_hearts ON hex_stake_starts(staked_hearts DESC);
CREATE INDEX IF NOT EXISTS idx_hex_stake_starts_end_day ON hex_stake_starts(end_day);
CREATE INDEX IF NOT EXISTS idx_hex_stake_starts_network_active ON hex_stake_starts(network, is_active);

-- Stake ends indexes
CREATE INDEX IF NOT EXISTS idx_hex_stake_ends_network ON hex_stake_ends(network);
CREATE INDEX IF NOT EXISTS idx_hex_stake_ends_staker_addr ON hex_stake_ends(staker_addr);
CREATE INDEX IF NOT EXISTS idx_hex_stake_ends_stake_id_network ON hex_stake_ends(stake_id, network);
CREATE INDEX IF NOT EXISTS idx_hex_stake_ends_timestamp ON hex_stake_ends(timestamp);

-- Global info indexes
CREATE INDEX IF NOT EXISTS idx_hex_global_info_network ON hex_global_info(network);
CREATE INDEX IF NOT EXISTS idx_hex_global_info_hex_day ON hex_global_info(hex_day);
CREATE INDEX IF NOT EXISTS idx_hex_global_info_timestamp ON hex_global_info(timestamp);
CREATE INDEX IF NOT EXISTS idx_hex_global_info_network_timestamp ON hex_global_info(network, timestamp DESC);

-- Sync status indexes
CREATE INDEX IF NOT EXISTS idx_hex_sync_status_network ON hex_sync_status(network);

-- Staker metrics indexes
CREATE INDEX IF NOT EXISTS idx_hex_staker_metrics_network ON hex_staker_metrics(network);
CREATE INDEX IF NOT EXISTS idx_hex_staker_metrics_staker_addr ON hex_staker_metrics(staker_addr);
CREATE INDEX IF NOT EXISTS idx_hex_staker_metrics_total_staked_hearts ON hex_staker_metrics(total_staked_hearts DESC);

-- Trigger functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_hex_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at columns
CREATE TRIGGER update_hex_stake_starts_updated_at 
    BEFORE UPDATE ON hex_stake_starts 
    FOR EACH ROW EXECUTE FUNCTION update_hex_updated_at_column();

CREATE TRIGGER update_hex_sync_status_updated_at 
    BEFORE UPDATE ON hex_sync_status 
    FOR EACH ROW EXECUTE FUNCTION update_hex_updated_at_column();

CREATE TRIGGER update_hex_staker_metrics_updated_at 
    BEFORE UPDATE ON hex_staker_metrics 
    FOR EACH ROW EXECUTE FUNCTION update_hex_updated_at_column();

-- Initialize sync status records for both networks
INSERT INTO hex_sync_status (
    network,
    last_synced_stake_id, 
    last_synced_block, 
    last_synced_timestamp,
    sync_in_progress
) VALUES 
    ('ethereum', '0', 0, 0, FALSE),
    ('pulsechain', '0', 0, 0, FALSE)
ON CONFLICT (network) DO NOTHING;