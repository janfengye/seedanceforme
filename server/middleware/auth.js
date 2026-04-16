import * as authService from '../services/authService.js';

/**
 * 认证中间件 — 校验 X-Session-ID 并挂载 req.user
 */
export const authenticate = async (req, res, next) => {
  const sessionId = req.headers['x-session-id'];

  if (!sessionId) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const user = await authService.getCurrentUser(sessionId);
    if (!user) {
      return res.status(401).json({ error: 'Session 已过期或无效' });
    }
    req.user = user;
    req.sessionId = sessionId;
    next();
  } catch (error) {
    res.status(401).json({ error: '认证失败' });
  }
};

/**
 * 管理员认证中间件 — 要求 admin 或 super_admin 角色
 */
export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
};
