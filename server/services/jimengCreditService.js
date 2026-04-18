import { getDatabase } from '../database/index.js';

const CREDIT_PROXY_URL = 'http://150.158.91.71:19999/query-credits';
const SIGN_INFO_URL = 'http://150.158.91.71:19999/sign-info';
const DAILY_SIGN_URL = 'http://150.158.91.71:19999/daily-sign';

/**
 * 通过腾讯云代理查询即梦账号积分
 * commerce API 需要国内 IP + 完整请求头
 */
export async function queryAccountCredits(sessionId) {
  const normalized = String(sessionId || '').trim();
  if (!normalized) throw new Error('SessionID 不能为空');

  const resp = await fetch(CREDIT_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: normalized }),
    signal: AbortSignal.timeout(20000),
  });

  const result = await resp.json();
  if (!result.success) {
    throw new Error(result.error || '查询积分失败');
  }

  return {
    creditBalance: result.creditBalance,
    giftCredit: result.giftCredit,
    purchaseCredit: result.purchaseCredit,
    vipCredit: result.vipCredit,
    vipLevel: result.vipLevel,
    expiresAt: result.expiresAt,
  };
}

/**
 * 查询签到状态
 */
export async function getSignInfo(sessionId) {
  const resp = await fetch(SIGN_INFO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
    signal: AbortSignal.timeout(20000),
  });
  const result = await resp.json();
  if (!result.success) throw new Error(result.error || '查询签到失败');
  return result.data;
}

/**
 * 执行签到
 */
export async function signInAccount(sessionId) {
  const resp = await fetch(DAILY_SIGN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
    signal: AbortSignal.timeout(20000),
  });
  const result = await resp.json();
  if (!result.success) throw new Error(result.error || '签到失败');
  return result.data;
}

/**
 * 一键签到所有启用账号
 */
export async function signInAllAccounts() {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM jimeng_session_accounts WHERE is_enabled = 1').all();
  const results = [];
  for (const row of rows) {
    try {
      const signResult = await signInAccount(row.session_id);
      const now = new Date().toISOString();
      db.prepare('UPDATE jimeng_session_accounts SET last_sign_at = ?, updated_at = ? WHERE id = ?').run(now, now, row.id);
      results.push({ id: row.id, name: row.name, success: true, ...signResult });
    } catch (error) {
      results.push({ id: row.id, name: row.name, success: false, error: error.message });
    }
  }
  return results;
}

/**
 * 刷新单个账号积分并写入数据库
 */
export async function refreshAccountCredits(accountId) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM jimeng_session_accounts WHERE id = ?').get(accountId);
  if (!row) throw new Error('账号不存在');

  const result = await queryAccountCredits(row.session_id);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE jimeng_session_accounts
    SET credit_balance = ?, vip_level = ?, expires_at = ?, credit_updated_at = ?,
        gift_credit = ?, purchase_credit = ?, vip_credit = ?,
        updated_at = ?
    WHERE id = ?
  `).run(result.creditBalance, String(result.vipLevel || 0), result.expiresAt, now,
         result.giftCredit || 0, result.purchaseCredit || 0, result.vipCredit || 0,
         now, accountId);

  return {
    id: accountId,
    creditBalance: result.creditBalance,
    giftCredit: result.giftCredit,
    purchaseCredit: result.purchaseCredit,
    vipCredit: result.vipCredit,
    vipLevel: result.vipLevel,
    expiresAt: result.expiresAt,
    creditUpdatedAt: now,
  };
}

/**
 * 刷新所有启用账号的积分
 */
export async function refreshAllAccountCredits(userId) {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM jimeng_session_accounts WHERE is_enabled = 1').all();
  const results = [];
  for (const row of rows) {
    try {
      const result = await refreshAccountCredits(row.id);
      results.push({ ...result, name: row.name, success: true });
    } catch (error) {
      results.push({ id: row.id, name: row.name, success: false, error: error.message });
    }
  }
  return results;
}
