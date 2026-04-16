import { useState, useEffect } from 'react';
import {
  getSystemStats,
  getUserList,
  updateUserStatus,
  updateUserCredits,
  resetUserPassword,
  deleteUser,
  setUserRole,
} from '../services/authService';
import {
  getInvitationCodes,
  generateInvitationCodes,
  updateInvitationCode,
  deleteInvitationCode,
} from '../services/adminService';
import type { User, InvitationCode } from '../types';
import { useApp } from '../context/AppContext';
import { UsersIcon, ShieldIcon, CheckIcon, SparkleIcon, CloseIcon, PlusIcon } from '../components/Icons';

interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalProjects: number;
  totalTasks: number;
  todayCheckIns: number;
  totalCreditsIssued: number;
}

export default function AdminPage() {
  const { currentUser } = useApp();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'users' | 'invitations'>('users');

  // 弹窗状态
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editCredits, setEditCredits] = useState('');
  const [editOperation, setEditOperation] = useState<'set' | 'add' | 'subtract'>('set');

  // 邀请码状态
  const [invitationCodes, setInvitationCodes] = useState<InvitationCode[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateForm, setGenerateForm] = useState({ count: 1, max_uses: 1, note: '' });
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const loadStats = async () => {
    try {
      const data = await getSystemStats();
      setStats(data);
    } catch (err) {
      console.error('加载系统统计失败:', err);
    }
  };

  const loadUsers = async (page: number = 1) => {
    try {
      setLoading(true);
      const filters: Record<string, string> = {};
      if (filterStatus !== 'all') filters.status = filterStatus;
      if (filterRole !== 'all') filters.role = filterRole;

      const result = await getUserList(page, 20, filters);
      setUsers(result.users);
      setTotalPages(result.pagination.totalPages);
      setTotalUsers(result.pagination.total);
      setCurrentPage(result.pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadInvitationCodes = async () => {
    try {
      setInvLoading(true);
      const codes = await getInvitationCodes();
      setInvitationCodes(codes);
    } catch (err) {
      console.error('加载邀请码失败:', err);
    } finally {
      setInvLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadUsers();
  }, []);

  useEffect(() => {
    loadUsers(1);
  }, [filterStatus, filterRole]);

  useEffect(() => {
    if (activeTab === 'invitations' && invitationCodes.length === 0) {
      loadInvitationCodes();
    }
  }, [activeTab]);

  const handleStatusChange = async (userId: number, newStatus: 'active' | 'disabled') => {
    try {
      await updateUserStatus(userId, newStatus);
      loadUsers(currentPage);
      loadStats();
    } catch (err) {
      alert(err instanceof Error ? err.message : '更新状态失败');
    }
  };

  const handleOpenUserModal = (user: User) => {
    setSelectedUser(user);
    setEditCredits('');
    setShowUserModal(true);
  };

  const handleUpdateCredits = async () => {
    if (!selectedUser || !editCredits) return;

    try {
      const credits = parseInt(editCredits);
      if (isNaN(credits) || credits < 0) {
        alert('请输入有效的积分数量');
        return;
      }

      await updateUserCredits(selectedUser.id, credits, editOperation);
      loadUsers(currentPage);
      loadStats();
      setShowUserModal(false);
      alert('积分已更新');
    } catch (err) {
      alert(err instanceof Error ? err.message : '更新积分失败');
    }
  };

  const handleToggleRole = async (userId: number, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const actionText = newRole === 'admin' ? '设为管理员' : '取消管理员';
    if (!confirm(`确定要${actionText}吗？`)) return;

    try {
      await setUserRole(userId, newRole);
      loadUsers(currentPage);
      loadStats();
    } catch (err) {
      alert(err instanceof Error ? err.message : '设置角色失败');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (!confirm(`确定要删除用户「${(selectedUser as any).username || selectedUser.email}」吗？\n\n该操作不可恢复，将同时删除该用户的所有项目、任务和数据。`)) return;

    try {
      await deleteUser(selectedUser.id);
      setShowUserModal(false);
      loadUsers(currentPage);
      loadStats();
      alert('用户已删除');
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除用户失败');
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;

    const newPassword = prompt('请输入新密码（至少 8 位，包含数字和字母）:');
    if (!newPassword) return;

    try {
      await resetUserPassword(selectedUser.id, newPassword);
      alert(`用户 ${selectedUser.email} 的密码已重置，新密码：${newPassword}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '重置密码失败');
    }
  };

  const handleGenerateCodes = async () => {
    try {
      await generateInvitationCodes(generateForm);
      setShowGenerateModal(false);
      setGenerateForm({ count: 1, max_uses: 1, note: '' });
      loadInvitationCodes();
    } catch (err) {
      alert(err instanceof Error ? err.message : '生成邀请码失败');
    }
  };

  const handleToggleCode = async (code: InvitationCode) => {
    try {
      await updateInvitationCode(code.id, { is_active: code.is_active ? 0 : 1 });
      loadInvitationCodes();
    } catch (err) {
      alert(err instanceof Error ? err.message : '更新邀请码失败');
    }
  };

  const handleDeleteCode = async (id: number) => {
    if (!confirm('确定要删除这个邀请码吗？')) return;
    try {
      await deleteInvitationCode(id);
      loadInvitationCodes();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除邀请码失败');
    }
  };

  const handleCopyCode = (code: string, id: number) => {
    navigator.clipboard.writeText(`${window.location.origin}/register?code=${code}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const StatCard = ({ title, value, icon: Icon, color }: {
    title: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }) => (
    <div className="bg-[#1c1f2e] border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm mb-1">{title}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f111a] p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">管理后台</h1>
          <p className="text-gray-400">管理系统用户和查看系统统计</p>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <StatCard title="总用户数" value={stats.totalUsers} icon={UsersIcon} color="bg-gradient-to-br from-blue-500 to-cyan-500" />
            <StatCard title="活跃用户" value={stats.activeUsers} icon={CheckIcon} color="bg-gradient-to-br from-green-500 to-emerald-500" />
            <StatCard title="总项目数" value={stats.totalProjects} icon={SparkleIcon} color="bg-gradient-to-br from-purple-500 to-pink-500" />
            <StatCard title="总任务数" value={stats.totalTasks} icon={ShieldIcon} color="bg-gradient-to-br from-amber-500 to-orange-500" />
            <StatCard title="发放积分" value={stats.totalCreditsIssued} icon={SparkleIcon} color="bg-gradient-to-br from-indigo-500 to-violet-500" />
          </div>
        )}

        {/* 标签栏 */}
        <div className="flex gap-1 mb-6 bg-[#1c1f2e] border border-gray-800 rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'users'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            用户管理
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'invitations'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            邀请码管理
          </button>
        </div>

        {/* 用户管理 Tab */}
        {activeTab === 'users' && (
          <div className="bg-[#1c1f2e] border border-gray-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <h2 className="text-xl font-semibold text-white">用户管理</h2>
                <div className="flex items-center gap-3">
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="px-4 py-2 bg-[#0f111a] border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">所有角色</option>
                    <option value="user">普通用户</option>
                    <option value="admin">管理员</option>
                    <option value="super_admin">超级管理员</option>
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 bg-[#0f111a] border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">所有状态</option>
                    <option value="active">正常</option>
                    <option value="disabled">禁用</option>
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin text-purple-500">
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeWidth={2} strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-gray-400 mt-4">加载中...</p>
              </div>
            ) : error ? (
              <div className="p-12 text-center text-red-400">{error}</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#0f111a]">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">ID</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">用户名</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">角色</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">状态</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">积分</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">注册时间</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-[#0f111a]/50">
                          <td className="px-6 py-4 text-sm text-gray-400">#{user.id}</td>
                          <td className="px-6 py-4 text-sm text-white">{(user as any).username || user.email}</td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                              user.role === 'super_admin'
                                ? 'bg-red-500/20 text-red-400'
                                : user.role === 'admin'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              {user.role === 'super_admin' ? '超级管理员' : user.role === 'admin' ? '管理员' : '普通用户'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                              user.status === 'active'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {user.status === 'active' ? '正常' : '禁用'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-white">{user.credits}</td>
                          <td className="px-6 py-4 text-sm text-gray-400">
                            {new Date(user.createdAt!).toLocaleDateString('zh-CN')}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleStatusChange(
                                  user.id,
                                  user.status === 'active' ? 'disabled' : 'active'
                                )}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  user.status === 'active'
                                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                    : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                }`}
                              >
                                {user.status === 'active' ? '禁用' : '启用'}
                              </button>
                              <button
                                onClick={() => handleOpenUserModal(user)}
                                className="px-3 py-1.5 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-lg text-xs font-medium transition-all"
                              >
                                编辑
                              </button>
                              {isSuperAdmin && user.role !== 'super_admin' && (
                                <button
                                  onClick={() => handleToggleRole(user.id, user.role)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    user.role === 'admin'
                                      ? 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                                      : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                                  }`}
                                >
                                  {user.role === 'admin' ? '取消管理员' : '设为管理员'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 分页 */}
                <div className="p-6 border-t border-gray-800 flex items-center justify-between">
                  <p className="text-sm text-gray-400">
                    共 {totalUsers} 个用户，第 {currentPage} / {totalPages} 页
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadUsers(currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="px-4 py-2 bg-[#0f111a] border border-gray-700 rounded-xl text-white text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      上一页
                    </button>
                    <button
                      onClick={() => loadUsers(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                      className="px-4 py-2 bg-[#0f111a] border border-gray-700 rounded-xl text-white text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* 邀请码管理 Tab */}
        {activeTab === 'invitations' && (
          <div className="bg-[#1c1f2e] border border-gray-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">邀请码管理</h2>
              <button
                onClick={() => setShowGenerateModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium text-sm transition-all hover:from-purple-600 hover:to-pink-600"
              >
                <PlusIcon className="w-4 h-4" />
                生成邀请码
              </button>
            </div>

            {invLoading ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin text-purple-500">
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeWidth={2} strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-gray-400 mt-4">加载中...</p>
              </div>
            ) : invitationCodes.length === 0 ? (
              <div className="p-12 text-center text-gray-400">暂无邀请码，点击上方按钮生成</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#0f111a]">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">邀请码</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">使用次数</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">状态</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">备注</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">创建时间</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {invitationCodes.map((code) => (
                      <tr key={code.id} className="hover:bg-[#0f111a]/50">
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-white tracking-wider">{code.code}</span>
                            <button
                              onClick={() => handleCopyCode(code.code, code.id)}
                              className="text-gray-500 hover:text-purple-400 transition-colors text-xs"
                            >
                              {copiedId === code.id ? '已复制链接' : '复制链接'}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-400">
                          {code.actual_used_count ?? code.used_count} / {code.max_uses}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            code.is_active
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {code.is_active ? '启用' : '禁用'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-400">{code.note || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-400">
                          {new Date(code.created_at).toLocaleDateString('zh-CN')}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleCode(code)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                code.is_active
                                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                  : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                              }`}
                            >
                              {code.is_active ? '禁用' : '启用'}
                            </button>
                            <button
                              onClick={() => handleDeleteCode(code.id)}
                              className="px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-xs font-medium transition-all"
                            >
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 用户编辑弹窗 */}
        {showUserModal && selectedUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1c1f2e] border border-gray-800 rounded-2xl p-6 w-full max-w-md">
              <h3 className="text-xl font-semibold text-white mb-6">
                编辑用户 - {(selectedUser as any).username || selectedUser.email}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    修改积分
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={editOperation}
                      onChange={(e) => setEditOperation(e.target.value as 'set' | 'add' | 'subtract')}
                      className="px-4 py-3 bg-[#0f111a] border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="set">设置为</option>
                      <option value="add">增加</option>
                      <option value="subtract">减少</option>
                    </select>
                    <input
                      type="number"
                      value={editCredits}
                      onChange={(e) => setEditCredits(e.target.value)}
                      className="flex-1 px-4 py-3 bg-[#0f111a] border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="数量"
                      min="0"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleResetPassword}
                    className="flex-1 px-4 py-3 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded-xl font-medium transition-all"
                  >
                    重置密码
                  </button>
                  <button
                    onClick={handleUpdateCredits}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium transition-all"
                  >
                    保存积分
                  </button>
                </div>

                <div className="flex gap-3 mt-3">
                  <button
                    onClick={handleDeleteUser}
                    className="flex-1 px-4 py-3 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-xl font-medium transition-all border border-red-500/30"
                  >
                    删除账号
                  </button>
                  <button
                    onClick={() => setShowUserModal(false)}
                    className="flex-1 px-4 py-3 bg-[#0f111a] border border-gray-700 text-white hover:bg-gray-800 rounded-xl font-medium transition-all"
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 生成邀请码弹窗 */}
        {showGenerateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1c1f2e] border border-gray-800 rounded-2xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">生成邀请码</h3>
                <button onClick={() => setShowGenerateModal(false)} className="text-gray-400 hover:text-white">
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">生成数量</label>
                  <input
                    type="number"
                    value={generateForm.count}
                    onChange={(e) => setGenerateForm({ ...generateForm, count: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-3 bg-[#0f111a] border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    min="1"
                    max="50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">每码最大使用次数</label>
                  <input
                    type="number"
                    value={generateForm.max_uses}
                    onChange={(e) => setGenerateForm({ ...generateForm, max_uses: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-3 bg-[#0f111a] border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">备注（可选）</label>
                  <input
                    type="text"
                    value={generateForm.note}
                    onChange={(e) => setGenerateForm({ ...generateForm, note: e.target.value })}
                    className="w-full px-4 py-3 bg-[#0f111a] border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="例如：内测用户第一批"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowGenerateModal(false)}
                    className="flex-1 px-4 py-3 bg-[#0f111a] border border-gray-700 text-white hover:bg-gray-800 rounded-xl font-medium transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleGenerateCodes}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium transition-all"
                  >
                    生成
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
