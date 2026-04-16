/**
 * 原有类型定义（从 types.ts 迁移过来）
 */
export type AspectRatio = '21:9' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16';

export type Duration = 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export type ModelId = 'seedance-2.0' | 'seedance-2.0-fast' | 'seedance-2.0-fast-vip' | 'seedance-2.0-vip';

// ============================================================
// 用户认证类型
// ============================================================

export interface User {
  id: number;
  email: string;
  username?: string;
  nickname?: string;
  role: 'user' | 'admin' | 'super_admin';
  status: 'active' | 'disabled';
  credits: number;
  createdAt?: string;
  updatedAt?: string;
  lastCheckInAt?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  password: string;
  invitation_code: string;
}

export interface AuthResponse {
  sessionId: string;
  user: User;
}

export interface ModelOption {
  value: ModelId;
  label: string;
  description: string;
}

export interface AppViewOption {
  id: AppView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
}

export enum AppView {
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER',
  SINGLE_TASK = 'SINGLE_TASK',
  BATCH_MANAGEMENT = 'BATCH_MANAGEMENT',
  DOWNLOAD_MANAGEMENT = 'DOWNLOAD_MANAGEMENT',
  SETTINGS = 'SETTINGS',
  ADMIN = 'ADMIN',
  PROFILE = 'PROFILE',
}

export type ReferenceMode = '全能参考' | '首帧参考' | '尾帧参考';

export interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
  index: number;
}

export interface UploadedAudio {
  id: string;
  file: File;
  name: string;
  index: number;
}

export interface GenerateVideoRequest {
  prompt: string;
  model: ModelId;
  ratio: AspectRatio;
  duration: Duration;
  files: File[];
  audioFiles?: File[];
  shotId?: number;
}

export interface VideoGenerationResponse {
  created: number;
  data: Array<{
    url: string;
    revised_prompt: string;
  }>;
}

export type GenerationStatus = 'idle' | 'generating' | 'success' | 'error';

export interface GenerationState {
  status: GenerationStatus;
  progress?: string;
  result?: VideoGenerationResponse;
  error?: string;
}

export interface RatioOption {
  value: AspectRatio;
  label: string;
  widthRatio: number;
  heightRatio: number;
}

export const RATIO_OPTIONS: RatioOption[] = [
  { value: '21:9', label: '21:9', widthRatio: 21, heightRatio: 9 },
  { value: '16:9', label: '16:9', widthRatio: 16, heightRatio: 9 },
  { value: '4:3', label: '4:3', widthRatio: 4, heightRatio: 3 },
  { value: '1:1', label: '1:1', widthRatio: 1, heightRatio: 1 },
  { value: '3:4', label: '3:4', widthRatio: 3, heightRatio: 4 },
  { value: '9:16', label: '9:16', widthRatio: 9, heightRatio: 16 },
];

export const DURATION_OPTIONS: Duration[] = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export const REFERENCE_MODES: ReferenceMode[] = ['全能参考', '首帧参考', '尾帧参考'];

export const MODEL_OPTIONS: ModelOption[] = [
  {
    value: 'seedance-2.0',
    label: 'Seedance 2.0',
    description: '全能主角，音视频图均可参考 (暂不支持真人入镜)',
  },
  {
    value: 'seedance-2.0-vip',
    label: 'Seedance 2.0 VIP',
    description: 'VIP专属720p全能模型，音视频图均可参考',
  },
  {
    value: 'seedance-2.0-fast',
    label: 'Seedance 2.0 Fast',
    description: '精简时长，音视频图均可参考 (暂不支持真人入镜)',
  },
  {
    value: 'seedance-2.0-fast-vip',
    label: 'Seedance 2.0 Fast VIP',
    description: 'VIP专属720p快速模型，音视频图均可参考',
  },
];

export interface JimengSessionAccount {
  id: number;
  userId: number;
  name: string;
  sessionId: string;
  isDefault: boolean;
  isEnabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  creditBalance?: number;
  creditUpdatedAt?: string;
  vipLevel?: number;
}

export interface JimengSessionAccountInput {
  name?: string;
  sessionId: string;
  isEnabled?: boolean;
  priority?: number;
}

export type EffectiveSessionSource = 'user_default' | 'legacy_global' | 'env_default' | 'none';

export interface EffectiveSessionResolution {
  source: EffectiveSessionSource;
  sessionId: string;
  account: JimengSessionAccount | null;
  accounts: JimengSessionAccount[];
  defaultAccount: JimengSessionAccount | null;
}

/**
 * 项目管理相关类型定义（新增）
 */

/**
 * 项目
 */
export interface Project {
  id: number;
  name: string;
  description?: string;
  code?: string;
  settings_json?: string;
  video_save_path?: string;
  default_concurrent?: number;
  default_min_interval?: number;
  default_max_interval?: number;
  task_count?: number;
  completed_count?: number;
  created_at: string;
  updated_at: string;
}

/**
 * 项目设置
 */
export interface ProjectSettings {
  model?: string;
  ratio?: string;
  duration?: number;
  referenceMode?: string;
}

/**
 * 任务
 */
export interface Task {
  id: number;
  project_id: number;
  batch_id?: number;
  prompt: string;
  task_kind: TaskKind;
  source_task_id?: number | null;
  row_group_id?: string | null;
  row_index?: number | null;
  video_count: number;
  output_index?: number | null;
  status: TaskStatus;
  submit_id?: string | null;
  history_id?: string | null;
  item_id?: string | null;
  video_url?: string | null;
  video_path?: string | null;
  download_status?: DownloadStatus | null;
  download_path?: string | null;
  downloaded_at?: string | null;
  submitted_at?: string | null;
  account_info?: string | null;
  progress?: string | null;
  audio_path?: string;
  audio_uri?: string;
  send_count?: number;
  last_sent_at?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string | null;
  retry_count?: number;
  shot_id?: number | null;
  version_label?: string | null;
  standard_filename?: string | null;
  project_name?: string;
  assets?: TaskAsset[];
}

export type TaskKind = 'draft' | 'output';

/**
 * 任务状态
 */
export type TaskStatus =
  | 'pending'     // 等待中
  | 'generating'  // 生成中
  | 'done'        // 已完成
  | 'error'       // 出错
  | 'cancelled';  // 已取消

/**
 * 任务素材
 */
export interface TaskAsset {
  id: number;
  task_id: number;
  asset_type: 'image' | 'audio';
  file_path: string;
  image_uri?: string;
  sort_order: number;
}

/**
 * 批量任务
 */
export interface Batch {
  id: number;
  name?: string;
  project_id: number;
  task_ids: string; // JSON 数组
  status: BatchStatus;
  total_count: number;
  completed_count: number;
  failed_count: number;
  cancelled_count: number;
  concurrent_count: number;
  min_interval: number;
  max_interval: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

/**
 * 批量任务状态
 */
export type BatchStatus =
  | 'pending'    // 等待中
  | 'running'    // 运行中
  | 'paused'     // 已暂停
  | 'done'       // 已完成
  | 'error'      // 出错
  | 'cancelled'; // 已取消

export interface BatchTaskSnapshot {
  taskId: number;
  prompt: string;
  status: TaskStatus;
  progress?: string;
  errorMessage?: string;
  submitId?: string;
  historyId?: string;
  itemId?: string;
  videoUrl?: string;
  sourceTaskId?: number;
  rowGroupId?: string;
  outputIndex?: number;
  assetCount?: number;
}

export interface BatchStatusDetail {
  batchId: number;
  projectId: number;
  name?: string;
  status: BatchStatus;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
  currentRunning: number;
  queueLength: number;
  concurrentCount: number;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  tasks: BatchTaskSnapshot[];
}

export interface InvalidBatchTask {
  taskId: number;
  prompt: string;
  reason: string;
}

export interface BatchStartResult {
  batchId: number;
  totalTasks: number;
}

/**
 * 全局设置
 */
export interface Settings {
  model?: string;
  ratio?: string;
  duration?: string;
  reference_mode?: string;
  download_path?: string;
  max_concurrent?: string;
  min_interval?: string;
  max_interval?: string;
}

/**
 * 定时任务
 */
export interface Schedule {
  id: number;
  name: string;
  project_id?: number;
  task_ids?: string; // JSON 数组
  cron_expression: string;
  enabled: number;
  last_run_at?: string;
  next_run_at?: string;
  created_at: string;
}

/**
 * API 响应
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 生成历史
 */
export interface GenerationHistory {
  id: number;
  task_id: number;
  batch_id?: string;
  request_data?: string;
  response_data?: string;
  created_at: string;
}

/**
 * 下载管理相关类型定义（新增）
 */

/**
 * 下载状态
 */
export type DownloadStatus =
  | 'pending'     // 待下载
  | 'downloading' // 下载中
  | 'done'        // 已下载
  | 'failed'      // 下载失败
  | 'generating'; // 生成中

/**
 * 下载任务
 */
export interface DownloadTask {
  id: number;
  prompt: string;
  status: TaskStatus;
  download_status: DownloadStatus;
  video_url?: string;
  video_path?: string;
  download_path?: string;
  downloaded_at?: string;
  account_info?: string;
  submit_id?: string;
  history_id?: string;
  created_at: string;
  completed_at?: string;
  project_name?: string;
  hasHistory: boolean;
  model_type: 'image' | 'video';
  effective_download_status: DownloadStatus;
}

/**
 * 下载任务列表（分页）
 */
export interface DownloadTaskList {
  tasks: DownloadTask[];
  total: number;
  page: number;
  pageSize: number;
}


// ============================================================
// 项目结构类型（M3+M4）
// ============================================================

export interface Episode {
  id: number;
  project_id: number;
  episode_number: number;
  title?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Shot {
  id: number;
  episode_id: number;
  shot_number: number;
  description?: string;
  prompt?: string;
  reference_image_url?: string;
  preferred_model?: string;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface EpisodeWithShots extends Episode {
  shots: Shot[];
}

export interface ShotVersion {
  id: number;
  user_id: number;
  version_label: string;
  status: string;
  video_url?: string;
  created_at: string;
  nickname?: string;
  username?: string;
}

// ============================================================
// 邀请码类型
// ============================================================

export interface InvitationCode {
  id: number;
  code: string;
  created_by: number;
  creator_email?: string;
  max_uses: number;
  used_count: number;
  actual_used_count?: number;
  is_active: number;
  note: string;
  expires_at: string | null;
  created_at: string;
}

export interface InvitationUsage {
  id: number;
  code_id: number;
  user_id: number;
  user_email?: string;
  used_at: string;
}
