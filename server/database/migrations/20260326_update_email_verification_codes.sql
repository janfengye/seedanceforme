-- 更新 email_verification_codes 表结构（兼容新建和增量迁移）

-- 添加字段（如果不存在则添加，已存在则忽略错误）
-- SQLite 不支持 IF NOT EXISTS for ALTER TABLE，所以用条件判断

-- 如果表没有 purpose 列才添加
ALTER TABLE email_verification_codes ADD COLUMN purpose TEXT DEFAULT 'register' CHECK (purpose IN ('register', 'login', 'reset_password', 'bind_email'));

-- 如果表没有 code_hash 列才添加
ALTER TABLE email_verification_codes ADD COLUMN code_hash TEXT;

-- 如果表没有 salt 列才添加
ALTER TABLE email_verification_codes ADD COLUMN salt TEXT DEFAULT '';

-- 如果表没有 attempts 列才添加
ALTER TABLE email_verification_codes ADD COLUMN attempts INTEGER DEFAULT 0;

-- 如果表没有 request_ip 列才添加
ALTER TABLE email_verification_codes ADD COLUMN request_ip TEXT;

-- 如果表没有 consumed_at 列才添加
ALTER TABLE email_verification_codes ADD COLUMN consumed_at DATETIME;
