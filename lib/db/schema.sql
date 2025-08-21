-- PulseChain HEX Staking Database Schema
-- This schema stores staking data for efficient querying and historical analysis

-- Table for storing stake start events
CREATE TABLE IF NOT EXISTS pulsechain_stake_starts (
    id SERIAL PRIMARY KEY,
    stake_id VARCHAR(50) UNIQUE NOT NULL,
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
    network VARCHAR(20) DEFAULT 'pulsechain',
    is_active BOOLEAN DEFAULT TRUE,
    days_served INTEGER DEFAULT 0,
    days_left INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for storing stake end events
CREATE TABLE IF NOT EXISTS pulsechain_stake_ends (
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
    network VARCHAR(20) DEFAULT 'pulsechain',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stake_id) REFERENCES pulsechain_stake_starts(stake_id)
);

-- Table for storing global HEX protocol information
CREATE TABLE IF NOT EXISTS pulsechain_global_info (
    id SERIAL PRIMARY KEY,
    hex_day INTEGER NOT NULL,
    stake_shares_total DECIMAL(30,8) NOT NULL,
    stake_penalty_total DECIMAL(30,8) NOT NULL,
    locked_hearts_total DECIMAL(30,8) DEFAULT 0,
    latest_stake_id VARCHAR(50),
    timestamp BIGINT NOT NULL,
    network VARCHAR(20) DEFAULT 'pulsechain',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for tracking sync status and preventing duplicate work
CREATE TABLE IF NOT EXISTS pulsechain_sync_status (
    id SERIAL PRIMARY KEY,
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for storing staker metrics and analytics
CREATE TABLE IF NOT EXISTS pulsechain_staker_metrics (
    id SERIAL PRIMARY KEY,
    staker_addr VARCHAR(42) UNIQUE NOT NULL,
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
    network VARCHAR(20) DEFAULT 'pulsechain',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_stake_starts_staker_addr ON pulsechain_stake_starts(staker_addr);
CREATE INDEX IF NOT EXISTS idx_stake_starts_stake_id ON pulsechain_stake_starts(stake_id);
CREATE INDEX IF NOT EXISTS idx_stake_starts_timestamp ON pulsechain_stake_starts(timestamp);
CREATE INDEX IF NOT EXISTS idx_stake_starts_is_active ON pulsechain_stake_starts(is_active);
CREATE INDEX IF NOT EXISTS idx_stake_starts_staked_hearts ON pulsechain_stake_starts(staked_hearts);
CREATE INDEX IF NOT EXISTS idx_stake_starts_end_day ON pulsechain_stake_starts(end_day);

CREATE INDEX IF NOT EXISTS idx_stake_ends_staker_addr ON pulsechain_stake_ends(staker_addr);
CREATE INDEX IF NOT EXISTS idx_stake_ends_stake_id ON pulsechain_stake_ends(stake_id);
CREATE INDEX IF NOT EXISTS idx_stake_ends_timestamp ON pulsechain_stake_ends(timestamp);

CREATE INDEX IF NOT EXISTS idx_global_info_hex_day ON pulsechain_global_info(hex_day);
CREATE INDEX IF NOT EXISTS idx_global_info_timestamp ON pulsechain_global_info(timestamp);

CREATE INDEX IF NOT EXISTS idx_staker_metrics_staker_addr ON pulsechain_staker_metrics(staker_addr);
CREATE INDEX IF NOT EXISTS idx_staker_metrics_total_staked_hearts ON pulsechain_staker_metrics(total_staked_hearts);

-- Trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stake_starts_updated_at 
    BEFORE UPDATE ON pulsechain_stake_starts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_status_updated_at 
    BEFORE UPDATE ON pulsechain_sync_status 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staker_metrics_updated_at 
    BEFORE UPDATE ON pulsechain_staker_metrics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial sync status record
INSERT INTO pulsechain_sync_status (
    last_synced_stake_id, 
    last_synced_block, 
    last_synced_timestamp,
    sync_in_progress
) VALUES ('0', 0, 0, FALSE)
ON CONFLICT DO NOTHING;