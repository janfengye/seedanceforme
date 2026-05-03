import { getDatabase } from '../database/index.js';
import * as settingsService from './settingsService.js';

function normalizeSessionId(sessionId) {
  return String(sessionId || '').trim();
}

function normalizePriority(priority, fallback = 0) {
  const normalized = Number(priority);
  if (!Number.isFinite(normalized) || normalized < 0) {
    return fallback;
  }
  return Math.floor(normalized);
}

function mapAccount(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name || '',
    sessionId: row.session_id,
    isDefault: Boolean(row.is_default),
    isEnabled: row.is_enabled !== undefined ? Boolean(row.is_enabled) : true,
    priority: row.priority !== undefined ? Number(row.priority) || 0 : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at || null,
    creditBalance: row.credit_balance || 0,
    creditUpdatedAt: row.credit_updated_at || null,
    vipLevel: row.vip_level || 0,
    cookies: row.cookies || null,
    versionType: row.version_type || "domestic",
    proxyUrl: row.proxy_url || null,
  };
}

function maskSessionId(sessionId) {
  const normalized = normalizeSessionId(sessionId);
  if (!normalized) {
    return '';
  }
  if (normalized.length <= 8) {
    return normalized;
  }
  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
}

function getEnabledAccountRows() {
  const db = getDatabase();
  return db.prepare(`
    SELECT *
    FROM jimeng_session_accounts
    WHERE is_enabled = 1
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      AND (credit_updated_at IS NULL OR credit_balance > 0)
    ORDER BY priority ASC, id ASC
  `).all();
}

function rebalancePriorities(userId) {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT id
    FROM jimeng_session_accounts
    WHERE user_id = ?
    ORDER BY is_enabled DESC, priority ASC, is_default DESC, id ASC
  `).all(userId);

  const stmt = db.prepare(`
    UPDATE jimeng_session_accounts
    SET priority = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `);

  rows.forEach((row, index) => {
    stmt.run(index, row.id, userId);
  });
}

function ensureDefaultAccount(userId) {
  const db = getDatabase();
  const enabledDefault = db.prepare(`
    SELECT id
    FROM jimeng_session_accounts
    WHERE user_id = ? AND is_enabled = 1
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      AND (credit_updated_at IS NULL OR credit_balance > 0)
    ORDER BY priority ASC, id ASC
    LIMIT 1
  `).get(userId);

  const fallbackDefault = enabledDefault || db.prepare(`
    SELECT id
    FROM jimeng_session_accounts
    WHERE user_id = ?
    ORDER BY priority ASC, id ASC
    LIMIT 1
  `).get(userId);

  db.prepare(`
    UPDATE jimeng_session_accounts
    SET is_default = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(userId);

  if (fallbackDefault?.id) {
    db.prepare(`
      UPDATE jimeng_session_accounts
      SET is_default = 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(fallbackDefault.id, userId);
  }
}

function syncAccountOrdering(userId) {
  const db = getDatabase();
  const transaction = db.transaction(() => {
    rebalancePriorities(userId);
    ensureDefaultAccount(userId);
  });
  transaction();
}

export function listUserAccounts() {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT *
    FROM jimeng_session_accounts
    ORDER BY is_enabled DESC, priority ASC, id ASC
  `).all();

  return rows.map(mapAccount);
}

export function listActiveAccounts() {
  return getEnabledAccountRows().map(mapAccount);
}

export function createUserAccount(userId, payload) {
  const db = getDatabase();
  const sessionId = normalizeSessionId(payload.sessionId);
  const name = String(payload.name || '').trim();

  if (!sessionId) {
    throw new Error('SessionID 不能为空');
  }

  const exists = db.prepare(`
    SELECT id FROM jimeng_session_accounts
    WHERE user_id = ? AND session_id = ?
  `).get(userId, sessionId);

  if (exists) {
    throw new Error('该 SessionID 已存在');
  }

  const hasAny = db.prepare(`
    SELECT COUNT(*) AS count FROM jimeng_session_accounts
    WHERE user_id = ?
  `).get(userId);

  const nextPriorityRow = db.prepare(`
    SELECT COALESCE(MAX(priority), -1) + 1 AS nextPriority
    FROM jimeng_session_accounts
    WHERE user_id = ?
  `).get(userId);

  const isFirstAccount = !hasAny || Number(hasAny.count) === 0;
  const isEnabled = payload.isEnabled === undefined ? 1 : (payload.isEnabled ? 1 : 0);
  const priority = isFirstAccount
    ? 0
    : normalizePriority(payload.priority, Number(nextPriorityRow?.nextPriority) || 0);
  const isDefault = isFirstAccount ? 1 : 0;

  const cookies = payload.cookies || null;
  const versionType = payload.versionType || 'domestic';
  const proxyUrl = payload.proxyUrl || null;

  const result = db.prepare(`
    INSERT INTO jimeng_session_accounts (
      user_id,
      name,
      session_id,
      is_default,
      is_enabled,
      priority,
      cookies,
      version_type,
      proxy_url,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(userId, name, sessionId, isDefault, isEnabled, priority, cookies, versionType, proxyUrl);

  syncAccountOrdering(userId);
  return getUserAccountById(userId, Number(result.lastInsertRowid));
}

export function getUserAccountById(userId, accountId) {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT *
    FROM jimeng_session_accounts
    WHERE id = ? AND user_id = ?
  `).get(accountId, userId);

  return row ? mapAccount(row) : null;
}

export function updateUserAccount(userId, accountId, payload) {
  const db = getDatabase();
  const existing = getUserAccountById(userId, accountId);

  if (!existing) {
    throw new Error('SessionID 账号不存在');
  }

  const nextName = payload.name !== undefined ? String(payload.name || '').trim() : existing.name;
  const nextSessionId = payload.sessionId !== undefined
    ? normalizeSessionId(payload.sessionId)
    : existing.sessionId;
  const nextIsEnabled = payload.isEnabled !== undefined ? Boolean(payload.isEnabled) : existing.isEnabled;
  const nextPriority = payload.priority !== undefined
    ? normalizePriority(payload.priority, existing.priority)
    : existing.priority;

  if (!nextSessionId) {
    throw new Error('SessionID 不能为空');
  }

  const duplicated = db.prepare(`
    SELECT id FROM jimeng_session_accounts
    WHERE user_id = ? AND session_id = ? AND id != ?
  `).get(userId, nextSessionId, accountId);

  if (duplicated) {
    throw new Error('该 SessionID 已存在');
  }

  const nextCookies = payload.cookies !== undefined ? (payload.cookies || null) : existing.cookies;
  const nextVersionType = payload.versionType !== undefined ? (payload.versionType || 'domestic') : existing.versionType;
  const nextProxyUrl = payload.proxyUrl !== undefined ? (payload.proxyUrl || null) : existing.proxyUrl;

  db.prepare(`
    UPDATE jimeng_session_accounts
    SET name = ?,
        session_id = ?,
        is_enabled = ?,
        priority = ?,
        cookies = ?,
        version_type = ?,
        proxy_url = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(nextName, nextSessionId, nextIsEnabled ? 1 : 0, nextPriority, nextCookies, nextVersionType, nextProxyUrl, accountId, userId);

  syncAccountOrdering(userId);
  return getUserAccountById(userId, accountId);
}

export function setDefaultAccount(userId, accountId) {
  const db = getDatabase();
  const existing = getUserAccountById(userId, accountId);

  if (!existing) {
    throw new Error('SessionID 账号不存在');
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE jimeng_session_accounts
      SET is_default = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(userId);

    db.prepare(`
      UPDATE jimeng_session_accounts
      SET is_default = 1,
          is_enabled = 1,
          priority = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(accountId, userId);

    rebalancePriorities(userId);
    ensureDefaultAccount(userId);
  });

  transaction();
  return getUserAccountById(userId, accountId);
}

export function deleteUserAccount(userId, accountId) {
  const db = getDatabase();
  const existing = getUserAccountById(userId, accountId);

  if (!existing) {
    throw new Error('SessionID 账号不存在');
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      DELETE FROM jimeng_session_accounts
      WHERE id = ? AND user_id = ?
    `).run(accountId, userId);

    rebalancePriorities(userId);
    ensureDefaultAccount(userId);
  });

  transaction();
  return { success: true };
}

export async function testSessionId(sessionId) {
  const normalized = normalizeSessionId(sessionId);
  if (!normalized) {
    throw new Error('SessionID 不能为空');
  }

  return settingsService.testSessionId(normalized);
}

export function resolveEffectiveSessions(userId) {
  const accounts = listActiveAccounts();
  if (accounts.length > 0) {
    return {
      source: 'user_default',
      sessionId: accounts[0].sessionId,
      account: accounts[0],
      accounts,
      defaultAccount: accounts[0],
    };
  }

  const legacyGlobal = settingsService.getLegacyGlobalSessionId();
  if (legacyGlobal) {
    return {
      source: 'legacy_global',
      sessionId: legacyGlobal,
      account: null,
      accounts: [{
        id: 0,
        userId,
        name: 'legacy_global',
        sessionId: legacyGlobal,
        isDefault: true,
        isEnabled: true,
        priority: 0,
        createdAt: '',
        updatedAt: '',
      }],
      defaultAccount: null,
    };
  }

  const envSessionId = process.env.VITE_DEFAULT_SESSION_ID || '';
  if (envSessionId) {
    return {
      source: 'env_default',
      sessionId: envSessionId,
      account: null,
      accounts: [{
        id: -1,
        userId,
        name: 'env_default',
        sessionId: envSessionId,
        isDefault: true,
        isEnabled: true,
        priority: 0,
        createdAt: '',
        updatedAt: '',
      }],
      defaultAccount: null,
    };
  }

  return {
    source: 'none',
    sessionId: '',
    account: null,
    accounts: [],
    defaultAccount: null,
  };
}

export function resolveEffectiveSession(userId) {
  const resolved = resolveEffectiveSessions(userId);
  return {
    source: resolved.source,
    sessionId: resolved.sessionId,
    account: resolved.account,
  };
}

export function formatAccountInfo(account) {
  if (!account) {
    return null;
  }

  return JSON.stringify({
    accountId: account.id ?? null,
    name: account.name || '',
    sessionId: maskSessionId(account.sessionId),
    priority: account.priority ?? 0,
    source: account.id > 0 ? 'user_account' : account.name || 'fallback',
  });
}


export async function keepAliveSessions() {
  const accounts = getEnabledAccountRows();
  if (accounts.length === 0) return;

  console.log(`[keepalive] 开始验证 ${accounts.length} 个账号的 Session 有效性...`);
  for (const row of accounts) {
    try {
      const result = await testSessionId(row.session_id);
      if (result.success) {
        console.log(`[keepalive] ✅ ${row.name || row.id} (${row.session_id.substring(0, 8)}...) 有效`);
      } else {
        console.warn(`[keepalive] ❌ ${row.name || row.id} (${row.session_id.substring(0, 8)}...) 失效: ${result.error}`);
        // 标记为禁用
        const db = getDatabase();
        db.prepare('UPDATE jimeng_session_accounts SET is_enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);
        console.warn(`[keepalive] 已自动禁用账号: ${row.name || row.id}`);
      }
    } catch (e) {
      console.warn(`[keepalive] ⚠ ${row.name || row.id} 验证异常: ${e.message}`);
    }
    // 间隔 2 秒，避免请求过快
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log('[keepalive] 验证完成');
}

/**
 * 禁用指定 sessionId 的账号（如 401 被封时调用）
 */
export function disableAccountBySessionId(sessionId) {
  const db = getDatabase();
  const result = db.prepare(
    "UPDATE jimeng_session_accounts SET is_enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND is_enabled = 1"
  ).run(sessionId);
  if (result.changes > 0) {
    console.warn("[jimengSession] Disabled account with sessionId:", sessionId.substring(0, 8) + "...");
  }
  return result.changes;
}

export default {
  listUserAccounts,
  listActiveAccounts,
  createUserAccount,
  getUserAccountById,
  updateUserAccount,
  setDefaultAccount,
  deleteUserAccount,
  testSessionId,
  keepAliveSessions,
  resolveEffectiveSessions,
  resolveEffectiveSession,
  formatAccountInfo,
  disableAccountBySessionId,
};
