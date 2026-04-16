import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, updateProfile } from '../services/userService';
import { changePassword } from '../services/authService';
import { UserIcon, LockIcon, CheckIcon } from '../components/Icons';
import type { User } from '../types';

interface ProfilePageProps {
  currentUser: User | null;
  onUserUpdate?: (user: User) => void;
}

export default function ProfilePage({ currentUser, onUserUpdate }: ProfilePageProps) {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [originalNickname, setOriginalNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState('');
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const profile = await getProfile();
      setNickname(profile.nickname || '');
      setOriginalNickname(profile.nickname || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    }
  };

  const handleSaveNickname = async () => {
    if (!nickname.trim()) {
      setError('昵称不能为空');
      return;
    }
    if (!/^[A-Za-z0-9]{2,10}$/.test(nickname)) {
      setError('昵称需为 2-10 位英文字母或数字');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      await updateProfile({ nickname });
      setOriginalNickname(nickname);
      setMessage('昵称已更新');
      if (onUserUpdate && currentUser) {
        onUserUpdate({ ...currentUser, nickname });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '更新失败';
      if (msg.includes('nickname_taken') || msg.includes('已被使用')) {
        setError('该昵称已被使用，请换一个');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwMessage('');

    if (newPassword.length < 8) {
      setPwError('新密码至少 8 位');
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPwError('新密码需包含数字和字母');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('两次输入的新密码不一致');
      return;
    }

    setPwLoading(true);
    try {
      await changePassword(oldPassword, newPassword);
      setPwMessage('密码已修改，请重新登录');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : '修改密码失败');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-y-auto bg-[#0f111a] text-white">
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">个人设置</h1>

        <div className="bg-[#1c1f2e] rounded-xl p-6 mb-6 border border-gray-800">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-purple-400" />
            账号信息
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">邮箱</span>
              <span>{currentUser?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">角色</span>
              <span className={currentUser?.role === 'admin' ? 'text-amber-400' : 'text-gray-300'}>
                {currentUser?.role === 'admin' ? '管理员' : '普通用户'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">积分</span>
              <span className="text-purple-400">{currentUser?.credits}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#1c1f2e] rounded-xl p-6 mb-6 border border-gray-800">
          <h2 className="text-lg font-bold mb-4">昵称设置</h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
          )}
          {message && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2">
              <CheckIcon className="w-4 h-4" />{message}
            </div>
          )}

          <div className="flex gap-3">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="设置你的昵称"
              maxLength={10}
              className="flex-1 px-4 py-3 bg-[#0f111a] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <button
              onClick={handleSaveNickname}
              disabled={loading || nickname === originalNickname}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-medium rounded-xl transition-all"
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">仅支持英文字母和数字，2-10个字符</p>
        </div>

        <div className="bg-[#1c1f2e] rounded-xl p-6 mb-6 border border-gray-800">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <LockIcon className="w-5 h-5 text-purple-400" />
            修改密码
          </h2>
          
          {pwError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{pwError}</div>
          )}
          {pwMessage && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">{pwMessage}</div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="当前密码"
              className="w-full px-4 py-3 bg-[#0f111a] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="新密码（至少8位，包含数字和字母）"
              className="w-full px-4 py-3 bg-[#0f111a] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="确认新密码"
              className="w-full px-4 py-3 bg-[#0f111a] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
            <button
              type="submit"
              disabled={pwLoading}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-700 disabled:to-gray-700 text-white font-medium rounded-xl transition-all"
            >
              {pwLoading ? '修改中...' : '修改密码'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
