/**
 * 批量任务调度器 - 增强版
 * 支持：并发控制、自动间隔、视频自动保存、任务取消
 */
import { readFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { getDatabase } from '../database/index.js';
import * as settingsService from './settingsService.js';
import * as taskService from './taskService.js';
import * as projectService from './projectService.js';
import { generateSeedanceVideo } from './videoGenerator.js';
import * as jimengSessionService from './jimengSessionService.js';
import * as videoDownloader from './videoDownloader.js';

// ============================================================
// 工具函数
// ============================================================

function normalizeBatchStatus(status) {
  switch (status) {
    case 'running':
    case 'paused':
    case 'done':
    case 'error':
    case 'cancelled':
    case 'pending':
      return status;
    case 'completed':
      return 'done';
    default:
      return 'pending';
  }
}

function normalizeTaskStatus(status) {
  switch (status) {
    case 'generating':
    case 'done':
    case 'error':
    case 'cancelled':
    case 'pending':
      return status;
    case 'completed':
      return 'done';
    default:
      return 'pending';
  }
}

function parseTaskIds(taskIds) {
  if (!taskIds) {
    return [];
  }
  try {
    return JSON.parse(taskIds);
  } catch {
    return [];
  }
}

function buildTaskSnapshot(task) {
  const assets = taskService.getTaskAssets(task.id);
  return {
    taskId: task.id,
    prompt: task.prompt || '',
    status: normalizeTaskStatus(task.status),
    progress: task.progress || undefined,
    errorMessage: task.error_message || undefined,
    submitId: task.submit_id || undefined,
    historyId: task.history_id || undefined,
    itemId: task.item_id || undefined,
    videoUrl: task.video_url || undefined,
    sourceTaskId: task.source_task_id ?? undefined,
    rowGroupId: task.row_group_id || undefined,
    outputIndex: task.output_index ?? undefined,
    assetCount: assets.filter(a => a.asset_type === 'image').length,
  };
}

function buildBatchDetail(batch, runtime = null, userId = null, isAdmin = false) {
  const taskIds = parseTaskIds(batch.task_ids);
  const runtimeTasks = runtime?.tasks ?? new Map();

  const taskSnapshots = taskIds.map((taskId) => {
    const runtimeTask = runtimeTasks.get(taskId);
    if (runtimeTask) {
      return { ...runtimeTask };
    }
    const task = taskService.getTaskById(taskId, userId, isAdmin);
    if (!task) {
      return {
        taskId,
        prompt: '',
        status: 'error',
        errorMessage: '任务不存在',
        assetCount: 0,
      };
    }
    return buildTaskSnapshot(task);
  });

  const counts = taskSnapshots.reduce(
    (acc, task) => {
      if (task.status === 'done') acc.completedCount += 1;
      else if (task.status === 'error') acc.failedCount += 1;
      else if (task.status === 'cancelled') acc.cancelledCount += 1;
      return acc;
    },
    { completedCount: 0, failedCount: 0, cancelledCount: 0 }
  );

  return {
    batchId: Number(batch.id),
    projectId: Number(batch.project_id),
    name: batch.name || undefined,
    status: normalizeBatchStatus(runtime?.status ?? batch.status),
    totalCount: Number(batch.total_count ?? taskIds.length ?? 0),
    completedCount: counts.completedCount,
    failedCount: counts.failedCount,
    cancelledCount: counts.cancelledCount,
    currentRunning: Number(runtime?.currentRunning ?? batch.current_running ?? 0),
    queueLength: Number(runtime?.queueLength ?? batch.queue_length ?? 0),
    concurrentCount: Number(batch.concurrent_count ?? runtime?.maxConcurrent ?? 0),
    createdAt: batch.created_at || undefined,
    startedAt: batch.started_at || undefined,
    completedAt: batch.completed_at || undefined,
    tasks: taskSnapshots,
  };
}

// ============================================================
// BatchScheduler 类
// ============================================================

class BatchScheduler {
  constructor(options = {}) {
    this.accounts = Array.isArray(options.accounts) ? [...options.accounts] : [];
    this.maxConcurrent = Math.max(1, Math.min(options.maxConcurrent || 5, this.accounts.length || options.maxConcurrent || 5));
    this.minInterval = options.minInterval || 30000;
    this.maxInterval = options.maxInterval || 50000;
    this.currentRunning = 0;
    this.queue = [];
    this.batchId = null;
    this.status = 'pending';
    this.taskSnapshots = new Map();
    this.activeTaskGenerators = new Map(); // 存储正在生成的任务控制器
    this.accountCursor = 0;
    this.accountBusySet = new Set();

    // 回调函数
    this.onProgress = options.onProgress || (() => {});
    this.onTaskComplete = options.onTaskComplete || (() => {});
    this.onBatchComplete = options.onBatchComplete || (() => {});
    this.onFinalize = options.onFinalize || (() => {});
  }

  async start(batchId, taskIds, userId = null, isAdmin = false) {
    this.batchId = Number(batchId);
    this.status = 'running';
    this.queue = [...taskIds];

    this._initializeTaskSnapshots(taskIds, userId, isAdmin);
    this._updateBatchRecord({
      status: 'running',
      started_at: new Date().toISOString(),
      completed_at: null,
    });
    this._persistBatchCounts();
    this._processQueue();

    return { batchId: this.batchId, totalTasks: taskIds.length };
  }

  _initializeTaskSnapshots(taskIds, userId = null, isAdmin = false) {
    for (const taskId of taskIds) {
      const task = taskService.getTaskById(taskId, userId, isAdmin);
      if (!task) {
        this.taskSnapshots.set(taskId, {
          taskId,
          prompt: '',
          status: 'error',
          errorMessage: '任务不存在',
          assetCount: 0,
        });
        continue;
      }
      this.taskSnapshots.set(taskId, buildTaskSnapshot(task));
    }
  }

  async _processQueue() {
    while (
      this.status === 'running' &&
      this.currentRunning < this.maxConcurrent &&
      this.queue.length > 0
    ) {
      const account = this._acquireNextAccount();
      if (!account) {
        break;
      }

      const taskId = this.queue.shift();
      this.currentRunning += 1;

      await taskService.updateTaskStatus(taskId, 'generating', {
        progress: '正在准备素材...',
        error_message: null,
        account_info: jimengSessionService.formatAccountInfo(account),
      });
      this._mergeTaskSnapshot(taskId, {
        status: 'generating',
        progress: '正在准备素材...',
        errorMessage: undefined,
      });
      this._persistBatchCounts();
      this._updateBatchRuntime({ currentRunning: this.currentRunning, queueLength: this.queue.length });

      if (this.currentRunning > 1) {
        await this._sleep(this._randomDelay());
      }

      this._executeTask(taskId, account).finally(() => {
        this._releaseAccount(account);
        this.currentRunning -= 1;
        this._persistBatchCounts();
        this._updateBatchRuntime({ currentRunning: this.currentRunning, queueLength: this.queue.length });
        this._processQueue();
        this._finalizeIfIdle();
      });
    }

    this._finalizeIfIdle();
  }

  _acquireNextAccount() {
    if (this.accounts.length === 0) {
      return null;
    }

    for (let offset = 0; offset < this.accounts.length; offset += 1) {
      const index = (this.accountCursor + offset) % this.accounts.length;
      const account = this.accounts[index];
      if (this.accountBusySet.has(account.id)) {
        continue;
      }
      this.accountBusySet.add(account.id);
      this.accountCursor = (index + 1) % this.accounts.length;
      console.log(`[batch][account] 轮询选择账号: ${account.name || `账号${index + 1}`} (${index + 1}/${this.accounts.length})`);
      console.log(`[batch][account] 已预留下次轮询起点: ${this.accounts[this.accountCursor].name || `账号${this.accountCursor + 1}`} (${this.accountCursor + 1}/${this.accounts.length})`);
      return account;
    }

    return null;
  }

  _advanceAccountCursor(account) {
    if (!account || this.accounts.length <= 1) {
      return;
    }

    const currentIndex = this.accounts.findIndex((item) => item.id === account.id);
    if (currentIndex === -1) {
      return;
    }

    this.accountCursor = (currentIndex + 1) % this.accounts.length;
    console.log(`[batch][account] 本次成功账号: ${account.name || `账号${currentIndex + 1}`} (${currentIndex + 1}/${this.accounts.length})`);
    console.log(`[batch][account] 下次轮询起点: ${this.accounts[this.accountCursor].name || `账号${this.accountCursor + 1}`} (${this.accountCursor + 1}/${this.accounts.length})`);
  }

  _getAccountLabel(account, index) {
    return account?.name || `账号${index + 1}`;
  }

  _releaseAccount(account) {
    if (!account) {
      return;
    }
    this.accountBusySet.delete(account.id);
  }

  _getOrderedAccounts(preferredAccount = null) {
    if (!preferredAccount) {
      return [...this.accounts];
    }

    const preferredIndex = this.accounts.findIndex((account) => account.id === preferredAccount.id);
    if (preferredIndex === -1) {
      return [...this.accounts];
    }

    return [
      ...this.accounts.slice(preferredIndex),
      ...this.accounts.slice(0, preferredIndex),
    ];
  }

  async _executeTask(taskId, preferredAccount = null) {
    let task = null;
    let isCancelled = false;

    try {
      task = taskService.getTaskById(taskId);
      if (!task) {
        throw new Error(`任务 ${taskId} 不存在`);
      }

      this._notifyProgress(taskId, '正在准备素材...');

      // 检查任务是否被取消
      const checkCancelled = () => {
        const updatedTask = taskService.getTaskById(taskId);
        return updatedTask?.status === 'cancelled';
      };

      const result = await this._generateVideo(task, preferredAccount, checkCancelled);

      // 再次检查是否被取消
      if (checkCancelled()) {
        isCancelled = true;
        return;
      }

      await taskService.updateTaskStatus(taskId, 'done', {
        submit_id: result.submitId,
        history_id: result.historyId,
        item_id: result.itemId,
        video_url: result.videoUrl,
        progress: '视频生成完成',
        error_message: null,
        account_info: result.accountInfo || null,
      });
      // 分配版本号

      this._mergeTaskSnapshot(taskId, {
        status: 'done',
        progress: '视频生成完成',
        errorMessage: undefined,
        submitId: result.submitId,
        historyId: result.historyId,
        itemId: result.itemId,
        videoUrl: result.videoUrl,
      });

      this._notifyProgress(taskId, '视频生成完成');

      // 自动下载视频到项目文件夹
      try {
        await this._autoDownloadVideo(taskId, result.videoUrl, result.historyId);
      } catch (downloadError) {
        console.error(`[batch] 自动下载视频失败 (taskId=${taskId}):`, downloadError.message);
      }

      this._onTaskComplete(taskId, 'done');
    } catch (error) {
      if (isCancelled) {
        this._mergeTaskSnapshot(taskId, {
          status: 'cancelled',
          progress: undefined,
          errorMessage: undefined,
        });
        this._onTaskComplete(taskId, 'cancelled');
        return;
      }

      const retryCount = Number(task?.retry_count ?? 0) + 1;
      await taskService.updateTaskStatus(taskId, 'error', {
        error_message: error.message,
        retry_count: retryCount,
        progress: '',
      });

      this._mergeTaskSnapshot(taskId, {
        status: 'error',
        progress: undefined,
        errorMessage: error.message,
      });
      this._notifyProgress(taskId, 'error', error.message);
      this._onTaskComplete(taskId, 'error', error.message);
    } finally {
      this.activeTaskGenerators.delete(taskId);
      this._persistBatchCounts();
    }
  }

  async _generateVideo(task, preferredAccount, checkCancelled) {
    const assets = taskService.getTaskAssets(task.id);
    const imageAssets = assets.filter(asset => asset.asset_type === 'image');
    const settings = settingsService.getAllSettings();

    if (this.accounts.length === 0) {
      throw new Error('未配置可用的 SessionID，请在设置页添加并启用账号');
    }

    const files = [];
    for (const asset of imageAssets) {
      try {
        const buffer = readFileSync(asset.file_path);
        files.push({
          buffer,
          originalname: asset.file_path.split('/').pop(),
          size: buffer.length,
        });
      } catch (error) {
        console.error(`[batch] 读取图片文件失败：${asset.file_path}`, error.message);
      }

      if (checkCancelled && checkCancelled()) {
        throw new Error('任务已取消');
      }
    }

    if (files.length === 0) {
      throw new Error('任务没有可用的图片素材');
    }

    let lastError = null;
    const orderedAccounts = this._getOrderedAccounts(preferredAccount);
    for (let index = 0; index < orderedAccounts.length; index += 1) {
      const account = orderedAccounts[index];
      try {
        if (index > 0) {
          const switchMessage = `当前账号不可用，切换到下一个账号：${account.name || `账号${index + 1}`}`;
          await taskService.updateTask(task.id, {
            progress: switchMessage,
            account_info: jimengSessionService.formatAccountInfo(account),
          });
          this._mergeTaskSnapshot(task.id, { progress: switchMessage });
          this._notifyProgress(task.id, switchMessage);
        }

        const result = await generateSeedanceVideo({
          prompt: task.prompt,
          ratio: settings.ratio || '16:9',
          duration: parseInt(settings.duration, 10) || 5,
          files,
          sessionId: account.sessionId,
          model: settings.model || 'seedance-2.0-fast',
          onProgress: async (progress) => {
            await taskService.updateTask(task.id, {
              progress,
              account_info: jimengSessionService.formatAccountInfo(account),
            });
            this._mergeTaskSnapshot(task.id, { progress });
            this._notifyProgress(task.id, progress);
          },
          onSubmitId: async (submitId) => {
            const submittedAt = new Date().toISOString();
            await taskService.updateTask(task.id, {
              submit_id: submitId,
              submitted_at: submittedAt,
              account_info: jimengSessionService.formatAccountInfo(account),
            });
            this._mergeTaskSnapshot(task.id, { submitId });
          },
          onHistoryId: async (historyId) => {
            await taskService.updateTask(task.id, {
              history_id: historyId,
              status: 'generating',
              account_info: jimengSessionService.formatAccountInfo(account),
            });
            this._mergeTaskSnapshot(task.id, { historyId });
          },
          onItemId: async (itemId) => {
            await taskService.updateTask(task.id, { item_id: itemId });
            this._mergeTaskSnapshot(task.id, { itemId });
          },
          onVideoReady: async (videoUrl) => {
            await taskService.updateTask(task.id, { video_url: videoUrl });
            this._mergeTaskSnapshot(task.id, { videoUrl });
          },
        });

        this._advanceAccountCursor(account);
        return {
          ...result,
          accountInfo: jimengSessionService.formatAccountInfo(account),
        };
      } catch (error) {
        lastError = error;
        const message = String(error?.message || error || '').toLowerCase();
        const retryable = ['session', '401', '403', '积分不足', '未登录', '过期', 'cookie', '账号', 'timeout', '超时', 'navigate', 'net::', 'err_connection', 'page.goto', 'fetch failed', 'econnrefused', 'econnreset'].some((keyword) => message.includes(keyword));
        if (!retryable || index === orderedAccounts.length - 1) {
          throw error;
        }
      }
    }

    throw lastError || new Error('生成失败');
  }

  async _autoDownloadVideo(taskId, videoUrl, historyId) {
    const task = taskService.getTaskById(taskId);
    if (!task) return;

    const project = projectService.getProjectById(task.project_id);
    if (!project) return;

    // 获取下载路径：项目设置 > 全局设置 > 默认
    let downloadPath = project.video_save_path;
    if (!downloadPath) {
      downloadPath = settingsService.getSetting('download_path');
    }
    if (!downloadPath) {
      downloadPath = path.join(process.cwd(), 'data', 'downloads');
    }

    // 创建项目文件夹
    const projectDir = path.join(downloadPath, project.name || `project_${project.id}`);
    if (!existsSync(projectDir)) {
      mkdirSync(projectDir, { recursive: true });
    }

    // 规范命名：项目名 - 任务序号 - 视频序号.mp4
    const safeProjectName = (project.name || 'project').replace(/[<>:"/\\|？*]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const videoFilename = `${safeProjectName}_task${taskId}_${timestamp}.mp4`;
    const videoPath = path.join(projectDir, videoFilename);

    console.log(`[batch] 开始自动下载视频到：${videoPath}`);

    // 确保目录存在
    if (!existsSync(projectDir)) {
      mkdirSync(projectDir, { recursive: true });
    }

    // 下载视频
    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
        Referer: 'https://jimeng.jianying.com/',
      },
    });

    if (!response.ok) {
      throw new Error(`视频下载失败：${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 写入文件
    const fs = await import('fs');
    fs.writeFileSync(videoPath, buffer);

    // 更新任务记录
    const db = getDatabase();
    db.prepare(`
      UPDATE tasks
      SET video_path = ?, download_status = 'done', download_path = ?, downloaded_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(videoPath, videoPath, taskId);

    console.log(`[batch] 视频已保存到：${videoPath}`);
  }

  /**
   * 取消单个任务
   */
  async cancelTask(taskId) {
    if (!this.queue.includes(taskId)) {
      // 任务已在运行，标记为取消（生成逻辑会检查）
      const task = taskService.getTaskById(taskId);
      if (task && task.status === 'generating') {
        await taskService.updateTaskStatus(taskId, 'cancelled', {
          progress: '',
          error_message: '用户取消任务',
        });
        this._mergeTaskSnapshot(taskId, {
          status: 'cancelled',
          progress: undefined,
          errorMessage: undefined,
        });
      }
      return true;
    }

    // 任务在队列中，直接移除
    const index = this.queue.indexOf(taskId);
    if (index > -1) {
      this.queue.splice(index, 1);
      const task = taskService.getTaskById(taskId);
      if (task && task.status === 'pending') {
        await taskService.updateTaskStatus(taskId, 'cancelled', {
          progress: '',
          error_message: null,
        });
        this._mergeTaskSnapshot(taskId, {
          status: 'cancelled',
          progress: undefined,
          errorMessage: undefined,
        });
      }
      this._updateBatchRuntime({ queueLength: this.queue.length });
      return true;
    }

    return false;
  }

  cancel() {
    if (this.status === 'done' || this.status === 'error' || this.status === 'cancelled') {
      return;
    }

    const cancelledTaskIds = [...this.queue];
    this.queue = [];
    this.status = 'cancelled';

    for (const taskId of cancelledTaskIds) {
      taskService.updateTaskStatus(taskId, 'cancelled', {
        progress: '',
        error_message: null,
      });
      this._mergeTaskSnapshot(taskId, {
        status: 'cancelled',
        progress: undefined,
        errorMessage: undefined,
      });
    }

    this._updateBatchRecord({ status: 'cancelled' });
    this._persistBatchCounts();
    this._finalizeIfIdle();
  }

  pause() {
    if (this.status !== 'running') {
      return;
    }

    this.status = 'paused';
    this._updateBatchRecord({ status: 'paused' });
  }

  resume() {
    if (this.status !== 'paused') {
      return;
    }

    this.status = 'running';
    this._updateBatchRecord({ status: 'running' });
    this._processQueue();
  }

  _completeBatch() {
    this.status = 'done';
    this._updateBatchRecord({
      status: 'done',
      completed_at: new Date().toISOString(),
    });
    this._persistBatchCounts();
    this._onBatchComplete();
    this.onFinalize(this.batchId);
  }

  _finalizeIfIdle() {
    if (this.currentRunning !== 0 || this.queue.length !== 0) {
      return;
    }

    if (this.status === 'running') {
      this._completeBatch();
      return;
    }

    if (this.status === 'cancelled') {
      this._updateBatchRecord({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      });
      this._persistBatchCounts();
      this._onBatchComplete();
      this.onFinalize(this.batchId);
    }
  }

  _updateBatchRecord(extraUpdates = {}) {
    try {
      const db = getDatabase();
      const updates = [];
      const values = [];

      for (const [key, value] of Object.entries(extraUpdates)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }

      if (updates.length === 0) {
        return;
      }

      values.push(this.batchId);
      const stmt = db.prepare(`UPDATE batches SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);
    } catch (error) {
      console.error('[batch] 更新批量任务状态失败:', error.message);
    }
  }

  _updateBatchRuntime(extraUpdates = {}) {
    // 运行时状态只存在于内存中
    // 可以通过事件通知前端
  }

  _persistBatchCounts() {
    const counts = [...this.taskSnapshots.values()].reduce(
      (acc, task) => {
        if (task.status === 'done') acc.completed_count += 1;
        else if (task.status === 'error') acc.failed_count += 1;
        else if (task.status === 'cancelled') acc.cancelled_count += 1;
        return acc;
      },
      { completed_count: 0, failed_count: 0, cancelled_count: 0 }
    );

    this._updateBatchRecord(counts);
  }

  _mergeTaskSnapshot(taskId, updates) {
    const existing = this.taskSnapshots.get(taskId) || {
      taskId,
      prompt: '',
      status: 'pending',
      assetCount: 0,
    };

    const nextSnapshot = { ...existing, ...updates };

    if (nextSnapshot.progress === '') delete nextSnapshot.progress;
    if (nextSnapshot.errorMessage === null) delete nextSnapshot.errorMessage;
    if (nextSnapshot.submitId === null) delete nextSnapshot.submitId;
    if (nextSnapshot.videoUrl === null) delete nextSnapshot.videoUrl;
    if (nextSnapshot.historyId === null) delete nextSnapshot.historyId;
    if (nextSnapshot.itemId === null) delete nextSnapshot.itemId;

    this.taskSnapshots.set(taskId, nextSnapshot);
  }

  _notifyProgress(taskId, progress, error = null) {
    this.onProgress({
      batchId: this.batchId,
      taskId,
      progress,
      error,
      timestamp: Date.now(),
    });
  }

  _onTaskComplete(taskId, status, error = null) {
    this.onTaskComplete({ batchId: this.batchId, taskId, status, error });
  }

  _onBatchComplete() {
    this.onBatchComplete({ batchId: this.batchId });
  }

  _randomDelay() {
    return Math.random() * (this.maxInterval - this.minInterval) + this.minInterval;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus(userId = null, isAdmin = false) {
    const batch = getBatchById(this.batchId, userId, isAdmin);
    if (!batch) {
      return null;
    }

    return buildBatchDetail(batch, {
      status: this.status,
      currentRunning: this.currentRunning,
      queueLength: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      tasks: this.taskSnapshots,
    }, userId, isAdmin);
  }
}

// ============================================================
// 导出函数
// ============================================================

const activeBatches = new Map();

export function createBatch({ projectId, taskIds, name = '', concurrent = 5 }) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO batches (name, project_id, task_ids, status, total_count, concurrent_count)
    VALUES (?, ?, ?, 'pending', ?, ?)
  `);
  const result = stmt.run(name, projectId, JSON.stringify(taskIds), taskIds.length, concurrent);
  return result.lastInsertRowid;
}

function getAccessibleBatch(batchId, userId = null, isAdmin = false) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM batches WHERE id = ?');
  const batch = stmt.get(batchId);
  if (!batch) {
    return null;
  }

  const project = projectService.getProjectById(batch.project_id, userId, isAdmin);
  if (!project) {
    return null;
  }

  return batch;
}

export function getBatchById(batchId, userId = null, isAdmin = false) {
  return getAccessibleBatch(batchId, userId, isAdmin);
}

export async function startBatch(batchId, options = {}) {
  const batch = getBatchById(batchId);
  if (!batch) {
    throw new Error(`批量任务 ${batchId} 不存在`);
  }

  const taskIds = parseTaskIds(batch.task_ids);
  const scheduler = new BatchScheduler({
    maxConcurrent: Math.min(batch.concurrent_count || 5, Array.isArray(options.accounts) && options.accounts.length > 0 ? options.accounts.length : (batch.concurrent_count || 5)),
    minInterval: batch.min_interval || 30000,
    maxInterval: batch.max_interval || 50000,
    ...options,
    onFinalize: () => {
      activeBatches.delete(Number(batchId));
      options.onFinalize?.(Number(batchId));
    },
  });

  activeBatches.set(Number(batchId), scheduler);
  return scheduler.start(batchId, taskIds);
}

export function pauseBatch(batchId) {
  const scheduler = activeBatches.get(Number(batchId));
  if (!scheduler) {
    return false;
  }
  scheduler.pause();
  return true;
}

export function resumeBatch(batchId) {
  const scheduler = activeBatches.get(Number(batchId));
  if (!scheduler) {
    return false;
  }
  scheduler.resume();
  return true;
}

export function cancelBatch(batchId) {
  const scheduler = activeBatches.get(Number(batchId));
  if (!scheduler) {
    return false;
  }
  scheduler.cancel();
  return true;
}

export function cancelBatchTask(batchId, taskId) {
  const scheduler = activeBatches.get(Number(batchId));
  if (!scheduler) {
    return false;
  }
  return scheduler.cancelTask(taskId);
}

export function getBatchStatus(batchId, userId = null, isAdmin = false) {
  const numericBatchId = Number(batchId);
  const scheduler = activeBatches.get(numericBatchId);
  if (scheduler) {
    return scheduler.getStatus(userId, isAdmin);
  }

  const batch = getBatchById(numericBatchId, userId, isAdmin);
  if (!batch) {
    return null;
  }

  return buildBatchDetail(batch, null, userId, isAdmin);
}

export function getActiveBatchScheduler(batchId) {
  return activeBatches.get(Number(batchId));
}

export default {
  BatchScheduler,
  createBatch,
  getBatchById,
  startBatch,
  pauseBatch,
  resumeBatch,
  cancelBatch,
  cancelBatchTask,
  getBatchStatus,
  getActiveBatchScheduler,
};
