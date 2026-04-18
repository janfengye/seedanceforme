import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/Toast';
import * as settingsService from '../services/settingsService';
import { RATIO_OPTIONS, DURATION_OPTIONS, MODEL_OPTIONS, type JimengSessionAccount } from '../types/index';
import { PlusIcon, SparkleIcon } from '../components/Icons';

type SettingsTab = 'accounts' | 'generation' | 'system';

function getStatusColor(account: JimengSessionAccount): string {
  if (!account.isEnabled) return 'red';
  if ((account.creditBalance ?? 0) === 0) return 'red';
  if (account.expiresAt) {
    const daysLeft = Math.ceil((new Date(account.expiresAt).getTime() - Date.now()) / 86400000);
    if (daysLeft <= 0) return 'red';
    if (daysLeft <= 7) return 'yellow';
  }
  if ((account.creditBalance ?? 0) < 50) return 'yellow';
  return 'green';
}

function StatusDot({ color }: { color: string }) {
  const colorClass = color === 'green' ? 'bg-green-400' : color === 'yellow' ? 'bg-yellow-400' : 'bg-red-400';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colorClass}`} />;
}

export default function SettingsPage() {
  const { state, updateSettingsAction, currentUser } = useApp();
  const { settings } = state;
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>('accounts');

  const [localSettings, setLocalSettings] = useState({
    model: settings.model || 'seedance-2.0-fast',
    ratio: settings.ratio || '16:9',
    duration: settings.duration || '5',
    reference_mode: settings.reference_mode || '全能参考',
    download_path: settings.download_path || '',
    max_concurrent: settings.max_concurrent || '5',
    min_interval: settings.min_interval || '30000',
    max_interval: settings.max_interval || '50000',
  });

  // Session ID account management
  const [sessionAccounts, setSessionAccounts] = useState<JimengSessionAccount[]>([]);
  const [newAccount, setNewAccount] = useState({ name: '', sessionId: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingAccount, setEditingAccount] = useState({ name: '', sessionId: '', isEnabled: true, priority: 0 });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  const [testTargetId, setTestTargetId] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [refreshingCredits, setRefreshingCredits] = useState<number | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [accountSummary, setAccountSummary] = useState({ total: 0, available: 0 });
  const [expandedAccountId, setExpandedAccountId] = useState<number | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [signingAll, setSigningAll] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  const sortAccounts = (accounts: JimengSessionAccount[]) => (
    [...accounts].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.id - b.id;
    })
  );

  const getNextPriority = (accounts: JimengSessionAccount[]) => {
    if (accounts.length === 0) return 0;
    return Math.max(...accounts.map((a) => Number(a.priority) || 0)) + 1;
  };

  const persistPriorityOrder = async (accounts: JimengSessionAccount[]) => {
    const ordered = sortAccounts(accounts);
    const updates = ordered
      .map((account, index) => ({ account, index }))
      .filter(({ account, index }) => account.priority !== index);
    if (updates.length === 0) return ordered;
    const updatedAccounts = [...ordered];
    for (const { account, index } of updates) {
      const updated = await settingsService.updateSessionAccount(account.id, { priority: index });
      const targetIndex = updatedAccounts.findIndex((item) => item.id === account.id);
      if (targetIndex >= 0) updatedAccounts[targetIndex] = updated;
    }
    return sortAccounts(updatedAccounts);
  };

  const loadSessionAccounts = async () => {
    try {
      const data = await settingsService.getSessionAccounts();
      if (!isAdmin && 'summary' in data && data.summary) {
        setAccountSummary(data.summary);
      } else {
        setSessionAccounts(sortAccounts(data.accounts || []));
      }
    } catch (error) {
      console.error('加载 SessionID 列表失败:', error);
    }
  };

  useEffect(() => { loadSessionAccounts(); }, []);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleRefreshCredits = async (accountId: number) => {
    setRefreshingCredits(accountId);
    try {
      const result = await settingsService.refreshAccountCredits(accountId);
      setSessionAccounts(prev => prev.map(a => a.id === accountId ? {
        ...a, creditBalance: result.creditBalance, vipLevel: result.vipLevel,
        expiresAt: result.expiresAt, creditUpdatedAt: result.creditUpdatedAt,
        giftCredit: result.giftCredit, purchaseCredit: result.purchaseCredit, vipCredit: result.vipCredit,
      } : a));
      showToast('积分已刷新');
    } catch (error) {
      showToast(`刷新失败：${error instanceof Error ? error.message : error}`, 'error');
    } finally {
      setRefreshingCredits(null);
    }
  };

  const handleRefreshAllCredits = async () => {
    setRefreshingAll(true);
    try {
      const results = await settingsService.refreshAllAccountCredits();
      setSessionAccounts(prev => prev.map(a => {
        const r = results.find((r: any) => r.id === a.id);
        if (r && r.success) {
          return { ...a, creditBalance: r.creditBalance, vipLevel: r.vipLevel, expiresAt: r.expiresAt,
            creditUpdatedAt: r.creditUpdatedAt, giftCredit: r.giftCredit, purchaseCredit: r.purchaseCredit, vipCredit: r.vipCredit };
        }
        return a;
      }));
      const failed = results.filter((r: any) => !r.success).length;
      if (failed > 0) showToast(`${failed} 个账号刷新失败`, 'error');
      else showToast('全部积分已刷新');
    } catch (error) {
      showToast(`刷新失败：${error instanceof Error ? error.message : error}`, 'error');
    } finally {
      setRefreshingAll(false);
    }
  };

  const handleSave = async () => {
    try {
      await updateSettingsAction(localSettings);
      setHasChanges(false);
      showToast('设置已保存');
    } catch (error) {
      showToast(`保存失败：${error instanceof Error ? error.message : error}`, 'error');
    }
  };

  const handleAddAccount = async () => {
    if (!newAccount.sessionId) { showToast('请输入 SessionID', 'error'); return; }
    try {
      const account = await settingsService.createSessionAccount({
        name: newAccount.name || `账号 ${sessionAccounts.length + 1}`,
        sessionId: newAccount.sessionId, isEnabled: true,
        priority: getNextPriority(sessionAccounts),
      });
      setSessionAccounts(sortAccounts([...sessionAccounts, account]));
      setNewAccount({ name: '', sessionId: '' });
      showToast('添加成功');
    } catch (error) {
      showToast(`添加失败：${error instanceof Error ? error.message : error}`, 'error');
    }
  };

  const handleDeleteAccount = async (id: number) => {
    if (!confirm('确定要删除此 SessionID 账号吗？')) return;
    try {
      await settingsService.deleteSessionAccount(id);
      const nextAccounts = sessionAccounts.filter((a) => a.id !== id);
      const normalized = await persistPriorityOrder(nextAccounts);
      setSessionAccounts(normalized);
      showToast('删除成功');
    } catch (error) {
      showToast(`删除失败：${error instanceof Error ? error.message : error}`, 'error');
    }
  };

  const handleToggleEnabled = async (account: JimengSessionAccount) => {
    try {
      const updated = await settingsService.updateSessionAccount(account.id, { isEnabled: !account.isEnabled });
      setSessionAccounts(sortAccounts(sessionAccounts.map((item) => (item.id === account.id ? updated : item))));
    } catch (error) {
      showToast(`更新失败：${error instanceof Error ? error.message : error}`, 'error');
    }
  };

  const handleMoveAccount = async (id: number, direction: 'up' | 'down') => {
    const ordered = sortAccounts(sessionAccounts);
    const currentIndex = ordered.findIndex((a) => a.id === id);
    if (currentIndex < 0) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= ordered.length) return;
    const reordered = [...ordered];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    try {
      const normalized = await persistPriorityOrder(reordered);
      setSessionAccounts(normalized);
    } catch (error) {
      showToast(`调整顺序失败：${error instanceof Error ? error.message : error}`, 'error');
    }
  };

  const startEditing = (account: JimengSessionAccount) => {
    setEditingId(account.id);
    setEditingAccount({ name: account.name, sessionId: account.sessionId, isEnabled: account.isEnabled, priority: account.priority });
    setExpandedAccountId(account.id);
    setMenuOpenId(null);
  };

  const handleSaveEdit = async (id: number) => {
    try {
      const updated = await settingsService.updateSessionAccount(id, editingAccount);
      setSessionAccounts(sortAccounts(sessionAccounts.map((a) => (a.id === id ? updated : a))));
      setEditingId(null);
      showToast('更新成功');
    } catch (error) {
      showToast(`更新失败：${error instanceof Error ? error.message : error}`, 'error');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingAccount({ name: '', sessionId: '', isEnabled: true, priority: 0 });
  };

  const handleTestSession = async (sessionId: string, id: number | null = null) => {
    if (!sessionId) { showToast('请先输入 SessionID', 'error'); return; }
    setIsTesting(true); setTestResult(null); setTestTargetId(id);
    try {
      const result = await settingsService.testJimengSessionId(sessionId);
      setTestResult(result);
      if (result.success) showToast('SessionID 有效');
      else showToast(result.error || 'SessionID 无效', 'error');
    } catch (error) {
      setTestResult({ success: false, error: error instanceof Error ? error.message : '测试失败' });
      showToast('测试失败', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSignAll = async () => {
    setSigningAll(true);
    try {
      const data = await settingsService.signAll();
      const results = (data as any).results || data;
      if (Array.isArray(results)) {
        const succeeded = results.filter((r: any) => r.success).length;
        showToast(`签到完成: ${succeeded}/${results.length} 成功`);
        // Reload accounts to get updated lastSignAt
        await loadSessionAccounts();
      } else {
        showToast('签到完成');
      }
    } catch (error) {
      showToast(`签到失败：${error instanceof Error ? error.message : error}`, 'error');
    } finally {
      setSigningAll(false);
    }
  };

  useEffect(() => {
    const changed =
      localSettings.model !== (settings.model || 'seedance-2.0-fast') ||
      localSettings.ratio !== (settings.ratio || '16:9') ||
      localSettings.duration !== (settings.duration || '5') ||
      localSettings.reference_mode !== (settings.reference_mode || '全能参考') ||
      localSettings.download_path !== (settings.download_path || '') ||
      localSettings.max_concurrent !== (settings.max_concurrent || '5') ||
      localSettings.min_interval !== (settings.min_interval || '30000') ||
      localSettings.max_interval !== (settings.max_interval || '50000');
    setHasChanges(changed);
  }, [localSettings, settings]);

  const orderedAccounts = sortAccounts(sessionAccounts);
  const enabledAccounts = orderedAccounts.filter((a) => a.isEnabled);
  const totalCredits = orderedAccounts.reduce((sum, a) => sum + (a.creditBalance ?? 0), 0);
  const signedCount = orderedAccounts.filter(a => a.lastSignAt && isToday(a.lastSignAt)).length;
  const allSigned = orderedAccounts.length > 0 && signedCount === orderedAccounts.length;

  function isToday(dateStr: string): boolean {
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }

  function getDaysLeft(expiresAt: string): number {
    return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  }

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: 'accounts', label: '账号管理' },
    { key: 'generation', label: '生成设置' },
    { key: 'system', label: '系统设置' },
  ];

  return (
    <div className="h-screen overflow-y-auto bg-[#0f111a] text-white">
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">全局设置</h1>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-[#1c1f2e] rounded-lg p-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ===================== ACCOUNTS TAB ===================== */}
        {activeTab === 'accounts' && (
          <>
            {isAdmin ? (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-4 gap-3 mb-6">
                  <div className="bg-[#1c1f2e] rounded-lg p-4 text-center border border-gray-800">
                    <p className="text-2xl font-bold text-white">{orderedAccounts.length}</p>
                    <p className="text-xs text-gray-400 mt-1">总账号</p>
                  </div>
                  <div className="bg-[#1c1f2e] rounded-lg p-4 text-center border border-gray-800">
                    <p className="text-2xl font-bold text-green-400">{enabledAccounts.length}</p>
                    <p className="text-xs text-gray-400 mt-1">可用</p>
                  </div>
                  <div className="bg-[#1c1f2e] rounded-lg p-4 text-center border border-gray-800">
                    <p className="text-2xl font-bold text-purple-400">{totalCredits}</p>
                    <p className="text-xs text-gray-400 mt-1">总积分</p>
                  </div>
                  <div className="bg-[#1c1f2e] rounded-lg p-4 text-center border border-gray-800">
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-2xl font-bold text-white">{signedCount}/{orderedAccounts.length}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">已签到</p>
                    <button
                      onClick={handleSignAll}
                      disabled={signingAll || allSigned}
                      className={`mt-2 px-3 py-1 rounded text-xs font-medium transition-colors ${
                        allSigned
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-500 text-white'
                      }`}
                    >
                      {signingAll ? '签到中...' : allSigned ? '已全部签到' : '一键签到'}
                    </button>
                  </div>
                </div>

                {/* Add new account */}
                <div className="bg-[#1c1f2e] rounded-xl p-4 mb-4 border border-gray-800">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">添加新账号</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text" value={newAccount.name}
                      onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                      placeholder="账号名称（可选）"
                      className="bg-[#0f111a] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                    />
                    <input
                      type="text" value={newAccount.sessionId}
                      onChange={(e) => setNewAccount({ ...newAccount, sessionId: e.target.value })}
                      placeholder="SessionID（从即梦 Cookie 获取）"
                      className="bg-[#0f111a] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={handleAddAccount} disabled={!newAccount.sessionId}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 rounded-lg transition-all font-medium"
                    >
                      <PlusIcon className="w-4 h-4" /> 添加
                    </button>
                  </div>
                </div>

                {/* Refresh all button */}
                <div className="flex justify-end mb-3">
                  <button
                    onClick={handleRefreshAllCredits} disabled={refreshingAll}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-xs font-medium transition-colors"
                  >
                    {refreshingAll ? '刷新中...' : '刷新全部积分'}
                  </button>
                </div>

                {/* Account list */}
                {orderedAccounts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>暂无 SessionID 账号</p>
                    <p className="text-xs mt-1">访问 https://jimeng.jianying.com 后，从开发者工具获取 sessionid</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orderedAccounts.map((account, index) => {
                      const isExpanded = expandedAccountId === account.id;
                      const isEditing = editingId === account.id;
                      const statusColor = getStatusColor(account);
                      const daysLeft = account.expiresAt ? getDaysLeft(account.expiresAt) : null;
                      const isSigned = account.lastSignAt ? isToday(account.lastSignAt) : false;

                      return (
                        <div key={account.id}
                          className={`rounded-lg border transition-all ${
                            account.isEnabled ? 'bg-purple-500/5 border-purple-500/30' : 'bg-[#0f111a] border-gray-700'
                          }`}
                        >
                          {/* Collapsed row */}
                          <div
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
                            onClick={() => setExpandedAccountId(isExpanded ? null : account.id)}
                          >
                            <StatusDot color={statusColor} />
                            <span className="font-medium text-gray-200 min-w-0 truncate">{account.name || '未命名'}</span>
                            {account.vipLevel ? <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">VIP</span> : null}
                            {account.creditBalance != null && (
                              <span className="text-xs text-gray-400">积分 <span className="text-gray-200 font-medium">{account.creditBalance}</span></span>
                            )}
                            {daysLeft != null && (
                              <span className={`text-xs ${daysLeft <= 0 ? 'text-red-400' : daysLeft <= 7 ? 'text-yellow-400' : 'text-gray-500'}`}>
                                {daysLeft <= 0 ? '已过期' : `${daysLeft}天`}
                              </span>
                            )}
                            {isSigned && <span className="text-xs text-green-400">已签到</span>}
                            {/* Toggle */}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleToggleEnabled(account); }}
                              className={`ml-auto w-9 h-5 rounded-full transition-colors relative ${account.isEnabled ? 'bg-purple-600' : 'bg-gray-600'}`}
                            >
                              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${account.isEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                            </button>
                            {/* Menu */}
                            <div className="relative" ref={menuOpenId === account.id ? menuRef : undefined}>
                              <button
                                onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === account.id ? null : account.id); }}
                                className="px-1 py-0.5 text-gray-400 hover:text-white text-lg leading-none"
                              >
                                &#8943;
                              </button>
                              {menuOpenId === account.id && (
                                <div className="absolute right-0 top-full mt-1 w-32 bg-[#1c1f2e] border border-gray-700 rounded-lg shadow-xl z-50 py-1">
                                  <button onClick={() => { startEditing(account); }} className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700">编辑</button>
                                  <button onClick={() => { setMenuOpenId(null); handleTestSession(account.sessionId, account.id); }} className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700">测试</button>
                                  <button onClick={() => { setMenuOpenId(null); handleRefreshCredits(account.id); }} className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700">刷新积分</button>
                                  <button onClick={() => { setMenuOpenId(null); handleMoveAccount(account.id, 'up'); }} disabled={index === 0} className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 disabled:text-gray-600">上移</button>
                                  <button onClick={() => { setMenuOpenId(null); handleMoveAccount(account.id, 'down'); }} disabled={index === orderedAccounts.length - 1} className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 disabled:text-gray-600">下移</button>
                                  <button onClick={() => { setMenuOpenId(null); handleDeleteAccount(account.id); }} className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-gray-700">删除</button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Expanded content */}
                          {isExpanded && (
                            <div className="px-4 pb-4 border-t border-gray-700/50">
                              {isEditing ? (
                                <div className="pt-3 space-y-3">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <input type="text" value={editingAccount.name}
                                      onChange={(e) => setEditingAccount({ ...editingAccount, name: e.target.value })}
                                      placeholder="账号名称"
                                      className="bg-[#1c1f2e] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500" />
                                    <input type="text" value={editingAccount.sessionId}
                                      onChange={(e) => setEditingAccount({ ...editingAccount, sessionId: e.target.value })}
                                      placeholder="SessionID"
                                      className="bg-[#1c1f2e] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500" />
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => handleSaveEdit(account.id)}
                                      className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium">保存</button>
                                    <button onClick={cancelEdit}
                                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium">取消</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="pt-3 space-y-3">
                                  {/* Credit breakdown */}
                                  {(account.giftCredit != null || account.purchaseCredit != null || account.vipCredit != null) && (
                                    <div className="flex gap-4 text-xs text-gray-400">
                                      <span>赠送 <span className="text-gray-200">{account.giftCredit ?? 0}</span></span>
                                      <span>购买 <span className="text-gray-200">{account.purchaseCredit ?? 0}</span></span>
                                      <span>VIP <span className="text-gray-200">{account.vipCredit ?? 0}</span></span>
                                    </div>
                                  )}
                                  {/* SessionID */}
                                  <div className="text-xs text-gray-500 font-mono break-all">
                                    {account.sessionId.slice(0, 16)}...{account.sessionId.slice(-8)}
                                  </div>
                                  {account.creditUpdatedAt && (
                                    <div className="text-xs text-gray-600">
                                      积分更新于 {new Date(account.creditUpdatedAt).toLocaleString('zh-CN')}
                                    </div>
                                  )}
                                  {/* Action buttons */}
                                  <div className="flex flex-wrap gap-2">
                                    <button onClick={() => startEditing(account)}
                                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium">编辑</button>
                                    <button onClick={() => handleTestSession(account.sessionId, account.id)}
                                      disabled={isTesting && testTargetId === account.id}
                                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded text-xs font-medium">
                                      {isTesting && testTargetId === account.id ? '测试中...' : '测试'}</button>
                                    <button onClick={() => handleRefreshCredits(account.id)}
                                      disabled={refreshingCredits === account.id}
                                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 rounded text-xs font-medium">
                                      {refreshingCredits === account.id ? '刷新中...' : '刷新积分'}</button>
                                    <button onClick={() => handleDeleteAccount(account.id)}
                                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-xs font-medium">删除</button>
                                  </div>
                                </div>
                              )}
                              {testTargetId === account.id && testResult && (
                                <div className={`mt-3 p-2 rounded text-sm ${
                                  testResult.success ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                  {testResult.success ? `OK ${testResult.message || ''}` : `${testResult.error || 'SessionID 无效'}`}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              /* Non-admin summary */
              <div className="bg-[#1c1f2e] rounded-xl p-6 border border-gray-800">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <SparkleIcon className="w-5 h-5 text-purple-400" />
                  即梦账号状态
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#0f111a] rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-white">{accountSummary.total}</p>
                    <p className="text-sm text-gray-400 mt-1">总账号数</p>
                  </div>
                  <div className="bg-[#0f111a] rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-400">{accountSummary.available}</p>
                    <p className="text-sm text-gray-400 mt-1">可用账号</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-4">即梦账号由管理员统一管理。如需添加账号，请联系管理员。</p>
              </div>
            )}
          </>
        )}

        {/* ===================== GENERATION TAB ===================== */}
        {activeTab === 'generation' && (
          <div className="bg-[#1c1f2e] rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-bold mb-4">生成设置</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">选择模型</label>
                <div className="space-y-2">
                  {MODEL_OPTIONS.map((option) => (
                    <button key={option.value}
                      onClick={() => setLocalSettings((prev) => ({ ...prev, model: option.value }))}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                        localSettings.model === option.value
                          ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 bg-[#161824] hover:border-gray-600'}`}>
                      <div className={`text-sm font-medium ${localSettings.model === option.value ? 'text-purple-400' : 'text-gray-300'}`}>{option.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">参考模式</label>
                <div className="flex gap-2">
                  {['全能参考', '首帧参考', '尾帧参考'].map((mode) => (
                    <button key={mode}
                      onClick={() => setLocalSettings((prev) => ({ ...prev, reference_mode: mode }))}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                        localSettings.reference_mode === mode
                          ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                          : 'border-gray-700 bg-[#161824] text-gray-400 hover:border-gray-600'}`}>
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">画面比例</label>
                <div className="grid grid-cols-6 gap-2">
                  {RATIO_OPTIONS.map((opt) => (
                    <button key={opt.value}
                      onClick={() => setLocalSettings((prev) => ({ ...prev, ratio: opt.value }))}
                      className={`flex flex-col items-center gap-1.5 py-2 rounded-lg border transition-all ${
                        localSettings.ratio === opt.value
                          ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 bg-[#161824] hover:border-gray-600'}`}>
                      <div className="flex items-center justify-center w-8 h-8">
                        <div className={`rounded-sm border ${localSettings.ratio === opt.value ? 'border-purple-400' : 'border-gray-500'}`}
                          style={{
                            width: `${(opt.widthRatio / Math.max(opt.widthRatio, opt.heightRatio)) * 24}px`,
                            height: `${(opt.heightRatio / Math.max(opt.widthRatio, opt.heightRatio)) * 24}px`,
                          }} />
                      </div>
                      <span className={`text-[11px] ${localSettings.ratio === opt.value ? 'text-purple-400' : 'text-gray-400'}`}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">视频时长 (秒)</label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_OPTIONS.map((d) => (
                    <button key={d}
                      onClick={() => setLocalSettings((prev) => ({ ...prev, duration: String(d) }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                        localSettings.duration === String(d)
                          ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                          : 'border-gray-700 bg-[#161824] text-gray-400 hover:border-gray-600'}`}>
                      {d}秒
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Save button for generation */}
            <div className="flex justify-end mt-6 pt-4 border-t border-gray-700">
              <button onClick={handleSave} disabled={!hasChanges}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 rounded-lg transition-all font-medium">
                保存设置
              </button>
            </div>
          </div>
        )}

        {/* ===================== SYSTEM TAB ===================== */}
        {activeTab === 'system' && (
          <div className="bg-[#1c1f2e] rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-bold mb-4">系统设置</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">最大并发数</label>
                <input type="number" min="1" max="10"
                  value={localSettings.max_concurrent}
                  onChange={(e) => setLocalSettings((prev) => ({ ...prev, max_concurrent: e.target.value }))}
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">最小间隔 (秒)</label>
                  <input type="number" min={10} max={120} step={5}
                    value={Math.round(Number(localSettings.min_interval) / 1000)}
                    onChange={(e) => setLocalSettings((prev) => ({ ...prev, min_interval: String(Number(e.target.value) * 1000) }))}
                    className="w-full bg-[#0f111a] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">最大间隔 (秒)</label>
                  <input type="number" min={10} max={120} step={5}
                    value={Math.round(Number(localSettings.max_interval) / 1000)}
                    onChange={(e) => setLocalSettings((prev) => ({ ...prev, max_interval: String(Number(e.target.value) * 1000) }))}
                    className="w-full bg-[#0f111a] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">视频保存路径</label>
                <input type="text" value={localSettings.download_path}
                  onChange={(e) => setLocalSettings((prev) => ({ ...prev, download_path: e.target.value }))}
                  placeholder="留空则使用默认路径：~/Videos/Team"
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500" />
                <p className="text-xs text-gray-500 mt-2">生成的视频将自动保存到此目录下的对应项目文件夹中</p>
              </div>
            </div>

            {/* Save button for system */}
            <div className="flex justify-end mt-6 pt-4 border-t border-gray-700">
              <button onClick={() => setLocalSettings({
                model: settings.model || 'seedance-2.0-fast', ratio: settings.ratio || '16:9',
                duration: settings.duration || '5', reference_mode: settings.reference_mode || '全能参考',
                download_path: settings.download_path || '', max_concurrent: settings.max_concurrent || '5',
                min_interval: settings.min_interval || '30000', max_interval: settings.max_interval || '50000',
              })} className="px-6 py-2.5 text-gray-400 hover:text-white transition-colors mr-3">
                重置
              </button>
              <button onClick={handleSave} disabled={!hasChanges}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 rounded-lg transition-all font-medium">
                保存设置
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
