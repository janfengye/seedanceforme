-- 为国际版 (Dreamina) 账号支持添加 cookies、version_type、proxy_url 字段
ALTER TABLE jimeng_session_accounts ADD COLUMN cookies TEXT;
ALTER TABLE jimeng_session_accounts ADD COLUMN version_type TEXT DEFAULT 'domestic';
ALTER TABLE jimeng_session_accounts ADD COLUMN proxy_url TEXT;
