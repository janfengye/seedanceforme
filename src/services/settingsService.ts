import type {
  Settings,
  ApiResponse,
  JimengSessionAccount,
  JimengSessionAccountInput,
  EffectiveSessionResolution,
} from '../types/index';
import { getAuthHeaders } from './authService';

const API_BASE = '/api';

export interface SessionAccountsResponse {
  accounts?: JimengSessionAccount[];
  effective?: EffectiveSessionResolution;
  summary?: { total: number; available: number };
}

/**
 * 获取全局设置
 */
export async function getSettings(): Promise<Settings> {
  const response = await fetch(`${API_BASE}/settings`);
  const result: ApiResponse<Settings> = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取设置失败');
  }
  return result.data || {};
}

/**
 * 更新全局设置
 */
export async function updateSettings(
  settings: Record<string, string>
): Promise<Settings> {
  const response = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  const result: ApiResponse<Settings> = await response.json();
  if (!result.success) {
    throw new Error(result.error || '更新设置失败');
  }
  return result.data!;
}

export async function getSessionAccounts(): Promise<SessionAccountsResponse> {
  const response = await fetch(`${API_BASE}/settings/session-accounts`, {
    headers: getAuthHeaders(),
  });
  const result: ApiResponse<SessionAccountsResponse> = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取 SessionID 列表失败');
  }
  return result.data!;
}

export async function createSessionAccount(
  input: JimengSessionAccountInput
): Promise<JimengSessionAccount> {
  const response = await fetch(`${API_BASE}/settings/session-accounts`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
  });
  const result: ApiResponse<JimengSessionAccount> = await response.json();
  if (!result.success) {
    throw new Error(result.error || '新增 SessionID 失败');
  }
  return result.data!;
}

export async function updateSessionAccount(
  id: number,
  input: Partial<JimengSessionAccountInput>
): Promise<JimengSessionAccount> {
  const response = await fetch(`${API_BASE}/settings/session-accounts/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
  });
  const result: ApiResponse<JimengSessionAccount> = await response.json();
  if (!result.success) {
    throw new Error(result.error || '更新 SessionID 失败');
  }
  return result.data!;
}

export async function deleteSessionAccount(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/settings/session-accounts/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const result: ApiResponse = await response.json();
  if (!result.success) {
    throw new Error(result.error || '删除 SessionID 失败');
  }
}

export async function testJimengSessionId(
  sessionId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const response = await fetch(`${API_BASE}/settings/session-accounts/test`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ sessionId }),
  });
  const result: ApiResponse<{
    success: boolean;
    message?: string;
    error?: string;
  }> = await response.json();
  return result;
}


export async function refreshAccountCredits(accountId: number) {
  const response = await fetch(`${API_BASE}/settings/session-accounts/${accountId}/refresh-credits`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error || '刷新积分失败');
  return result.data;
}

export async function refreshAllAccountCredits() {
  const response = await fetch(`${API_BASE}/settings/session-accounts/refresh-all-credits`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error || '刷新积分失败');
  return result.data;
}

export default {
  getSettings,
  updateSettings,
  getSessionAccounts,
  createSessionAccount,
  updateSessionAccount,
  deleteSessionAccount,
  testJimengSessionId,
  refreshAccountCredits,
  refreshAllAccountCredits,
};

export async function signAll(): Promise<{results: any[]}> {
  const response = await fetch(`${API_BASE}/jimeng/sign-all`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error || '签到失败');
  return result.data;
}

export async function getSignStatus(): Promise<any[]> {
  const response = await fetch(`${API_BASE}/jimeng/sign-status`, {
    headers: getAuthHeaders(),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error || '获取签到状态失败');
  return result.data;
}
