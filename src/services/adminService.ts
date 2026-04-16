import { getAuthHeaders } from './authService';
import type { InvitationCode, InvitationUsage, ApiResponse } from '../types';

const API_BASE = '/api';

export async function getInvitationCodes(): Promise<InvitationCode[]> {
  const response = await fetch(`${API_BASE}/admin/invitation-codes`, {
    headers: getAuthHeaders(),
  });
  const data: ApiResponse<InvitationCode[]> = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || '获取邀请码列表失败');
  }
  return data.data!;
}

export async function generateInvitationCodes(params: {
  count?: number;
  max_uses?: number;
  note?: string;
  expires_at?: string | null;
}): Promise<InvitationCode[]> {
  const response = await fetch(`${API_BASE}/admin/invitation-codes`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  const data: ApiResponse<InvitationCode[]> = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || '生成邀请码失败');
  }
  return data.data!;
}

export async function updateInvitationCode(
  id: number,
  updates: { is_active?: number; note?: string; max_uses?: number }
): Promise<InvitationCode> {
  const response = await fetch(`${API_BASE}/admin/invitation-codes/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(updates),
  });
  const data: ApiResponse<InvitationCode> = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || '更新邀请码失败');
  }
  return data.data!;
}

export async function deleteInvitationCode(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/admin/invitation-codes/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const data: ApiResponse = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || '删除邀请码失败');
  }
}

export async function getInvitationCodeUsage(id: number): Promise<InvitationUsage[]> {
  const response = await fetch(`${API_BASE}/admin/invitation-codes/${id}/usage`, {
    headers: getAuthHeaders(),
  });
  const data: ApiResponse<InvitationUsage[]> = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || '获取使用记录失败');
  }
  return data.data!;
}
