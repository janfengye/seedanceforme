import { getAuthHeaders } from './authService';
import type { ApiResponse } from '../types';

const API_BASE = '/api';

export interface UserProfile {
  id: number;
  email: string;
  nickname: string;
  role: string;
  status: string;
  credits: number;
  created_at: string;
}

export async function getProfile(): Promise<UserProfile> {
  const response = await fetch(`${API_BASE}/user/profile`, {
    headers: getAuthHeaders(),
  });
  const data: ApiResponse<UserProfile> = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || '获取用户资料失败');
  }
  return data.data!;
}

export async function updateProfile(updates: { nickname?: string }): Promise<UserProfile> {
  const response = await fetch(`${API_BASE}/user/profile`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(updates),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error === 'nickname_taken' ? (data.message || '该昵称已被使用，请换一个') : (data.error || '更新用户资料失败'));
  }
  return data.data!;
}
