ALTER TABLE jimeng_session_accounts ADD COLUMN last_sign_at TEXT;
ALTER TABLE jimeng_session_accounts ADD COLUMN gift_credit INTEGER DEFAULT 0;
ALTER TABLE jimeng_session_accounts ADD COLUMN purchase_credit INTEGER DEFAULT 0;
ALTER TABLE jimeng_session_accounts ADD COLUMN vip_credit INTEGER DEFAULT 0;
