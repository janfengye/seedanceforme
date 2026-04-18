import { useState } from 'react';
import { updateProfile } from '../services/userService';
import type { User } from '../types';

interface Props {
  currentUser: User;
  onNicknameSet: (user: User) => void;
}

export default function NicknamePromptModal({ currentUser, onNicknameSet }: Props) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError('昵称不能为空');
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 10) {
      setError('昵称长度需要 2-10 个字符');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const updated = await updateProfile({ nickname: trimmed });
      onNicknameSet({ ...currentUser, nickname: updated.nickname });
    } catch (err) {
      setError(err instanceof Error ? err.message : '设置昵称失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1c1f2e] border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-2">设置昵称</h2>
        <p className="text-gray-400 text-sm mb-4">
          请先设置你的昵称，方便团队协作时识别你生成的内容。
        </p>
        <input
          type="text"
          value={nickname}
          onChange={(e) => { setNickname(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="输入昵称（2-10个字符）"
          className="w-full px-4 py-2.5 bg-[#0f111a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 mb-2"
          autoFocus
          maxLength={10}
        />
        {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={saving || !nickname.trim()}
          className="w-full mt-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? '保存中...' : '确认'}
        </button>
      </div>
    </div>
  );
}
