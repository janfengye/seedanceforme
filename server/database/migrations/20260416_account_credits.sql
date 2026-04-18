ALTER TABLE jimeng_session_accounts ADD COLUMN expires_at TEXT;
ALTER TABLE jimeng_session_accounts ADD COLUMN credit_balance INTEGER DEFAULT 0;
ALTER TABLE jimeng_session_accounts ADD COLUMN credit_updated_at TEXT;
ALTER TABLE jimeng_session_accounts ADD COLUMN vip_level INTEGER DEFAULT 0;
