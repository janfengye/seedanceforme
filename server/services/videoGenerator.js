import crypto from 'crypto';
import browserService from '../browser-service.js';
import { getDatabase } from '../database/index.js';
import { disableAccountBySessionId } from "./jimengSessionService.js";

// 常量定义
const JIMENG_BASE_URL = 'https://jimeng.jianying.com';
const DEFAULT_ASSISTANT_ID = 513695;
const VERSION_CODE = '8.4.0';
const PLATFORM_CODE = '7';
const accountIdentityCache = new Map();

function getAccountIdentity(sessionId) {
  const cacheKey = String(sessionId || '').trim();
  if (!cacheKey) {
    return {
      webId: Math.random() * 999999999999999999 + 7000000000000000000,
      userId: crypto.randomUUID().replace(/-/g, ''),
    };
  }

  const existing = accountIdentityCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const identity = {
    webId: Math.random() * 999999999999999999 + 7000000000000000000,
    userId: crypto.randomUUID().replace(/-/g, ''),
  };
  accountIdentityCache.set(cacheKey, identity);
  return identity;
}

function buildSessionCookie(sessionId, webId, userId) {
  return [
    `_tea_web_id=${webId}`,
    `is_staff_user=false`,
    `store-region=cn-gd`,
    `store-region-src=uid`,
    `uid_tt=${userId}`,
    `uid_tt_ss=${userId}`,
    `sid_tt=${sessionId}`,
    `sessionid=${sessionId}`,
    `sessionid_ss=${sessionId}`,
  ].join('; ');
}

function createJimengRequestContext(sessionId, storedCookies = null) {
  const { webId, userId } = getAccountIdentity(sessionId);
  return { sessionId, webId, userId, storedCookies };
}

function getSessionLogLabel(sessionId) {
  const normalized = String(sessionId || '').trim();
  if (!normalized) {
    return 'empty';
  }
  return `${normalized.substring(0, 8)}...`;
}

function getRequestContext(options = {}) {
  return options.requestContext || createJimengRequestContext(options.sessionId, options.storedCookies);
}

function parseCookieJsonToString(cookieJsonStr) {
  try {
    const cookies = JSON.parse(cookieJsonStr);
    if (!Array.isArray(cookies)) return '';
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
  } catch {
    return '';
  }
}

function buildGenerateHeaders(requestContext) {
  const cookieStr = requestContext.storedCookies
    ? parseCookieJsonToString(requestContext.storedCookies)
    : buildSessionCookie(requestContext.sessionId, requestContext.webId, requestContext.userId);
  return {
    ...FAKE_HEADERS,
    Cookie: cookieStr,
  };
}

function buildGenerateParams(requestContext, extraParams = {}) {
  return {
    aid: DEFAULT_ASSISTANT_ID,
    device_platform: 'web',
    region: 'cn',
    webId: requestContext.webId,
    da_version: '3.3.12',
    web_component_open_flag: 1,
    web_version: '7.5.0',
    aigc_features: 'app_lip_sync',
    ...extraParams,
  };
}

function withRequestContext(options = {}, requestContext) {
  return {
    ...options,
    requestContext,
  };
}

function logRequestContext(action, requestContext) {
  console.log(`[video] ${action} session: ${getSessionLogLabel(requestContext.sessionId)}, webId: ${String(requestContext.webId).slice(0, 10)}..., uid: ${requestContext.userId.slice(0, 8)}...`);
}



const FAKE_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Accept-language': 'zh-CN,zh;q=0.9',
  'App-Sdk-Version': '48.0.0',
  'Cache-control': 'no-cache',
  Appid: String(DEFAULT_ASSISTANT_ID),
  Appvr: VERSION_CODE,
  Lan: 'zh-Hans',
  Loc: 'cn',
  Origin: 'https://jimeng.jianying.com',
  Pragma: 'no-cache',
  Priority: 'u=1, i',
  Referer: 'https://jimeng.jianying.com',
  Pf: PLATFORM_CODE,
  'Sec-Ch-Ua':
    '"Google Chrome";v="132", "Chromium";v="132", "Not_A Brand";v="8"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
};

// 模型映射
const MODEL_MAP = {
  'seedance-2.0': 'dreamina_seedance_40_pro',
  'seedance-2.0-fast': 'dreamina_seedance_40',
  'seedance-2.0-fast-vip': 'dreamina_seedance_40_vision',
  'seedance-2.0-vip': 'dreamina_seedance_40_pro_vision',
};

const BENEFIT_TYPE_MAP = {
  'seedance-2.0': 'dreamina_video_seedance_20_pro',
  'seedance-2.0-fast': 'dreamina_seedance_20_fast',
  'seedance-2.0-fast-vip': 'seedance_20_fast_720p_output',
  'seedance-2.0-vip': 'seedance_20_pro_720p_output',
};

// VIP 模型使用 3.3.12，普通模型使用 3.3.9
const DRAFT_VERSION_MAP = {
  'seedance-2.0': '3.3.9',
  'seedance-2.0-fast': '3.3.9',
  'seedance-2.0-fast-vip': '3.3.12',
  'seedance-2.0-vip': '3.3.12',
};

// 分辨率配置
const VIDEO_RESOLUTION = {
  '1:1': { width: 720, height: 720 },
  '4:3': { width: 960, height: 720 },
  '3:4': { width: 720, height: 960 },
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
  '21:9': { width: 1680, height: 720 },
};

/**
 * 生成签名
 */
function generateSign(uri) {
  const deviceTime = Math.floor(Date.now() / 1000);
  const sign = crypto
    .createHash('md5')
    .update(`9e2c|${uri.slice(-7)}|${PLATFORM_CODE}|${VERSION_CODE}|${deviceTime}||11ac`)
    .digest('hex');
  return { deviceTime, sign };
}

/**
 * 计算 CRC32
 */
function calculateCRC32(buffer) {
  const crcTable = [];
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    crcTable[i] = crc;
  }

  let crc = 0 ^ -1;
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xff];
  }
  return ((crc ^ -1) >>> 0).toString(16).padStart(8, '0');
}

/**
 * AWS4-HMAC-SHA256 签名
 */
function createAWSSignature(
  method,
  url,
  headers,
  accessKeyId,
  secretAccessKey,
  sessionToken,
  payload = '',
  region = 'cn-north-1',
  service = 'imagex'
) {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname || '/';

  const timestamp = headers['x-amz-date'];
  const date = timestamp.substr(0, 8);

  const queryParams = [];
  urlObj.searchParams.forEach((value, key) => {
    queryParams.push([key, value]);
  });
  queryParams.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const canonicalQueryString = queryParams
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const headersToSign = { 'x-amz-date': timestamp };
  if (sessionToken)
    headersToSign['x-amz-security-token'] = sessionToken;

  let payloadHash = crypto.createHash('sha256').update('').digest('hex');
  if (method.toUpperCase() === 'POST' && payload) {
    payloadHash = crypto
      .createHash('sha256')
      .update(payload, 'utf8')
      .digest('hex');
    headersToSign['x-amz-content-sha256'] = payloadHash;
  }

  const signedHeaders = Object.keys(headersToSign)
    .map((k) => k.toLowerCase())
    .sort()
    .join(';');
  const canonicalHeaders = Object.keys(headersToSign)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map((k) => `${k.toLowerCase()}:${headersToSign[k].trim()}\n`)
    .join('');

  const canonicalRequest = [
    method.toUpperCase(),
    pathname,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    timestamp,
    credentialScope,
    crypto
      .createHash('sha256')
      .update(canonicalRequest, 'utf8')
      .digest('hex'),
  ].join('\n');

  const kDate = crypto
    .createHmac('sha256', `AWS4${secretAccessKey}`)
    .update(date)
    .digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto
    .createHmac('sha256', kRegion)
    .update(service)
    .digest();
  const kSigning = crypto
    .createHmac('sha256', kService)
    .update('aws4_request')
    .digest();
  const signature = crypto
    .createHmac('sha256', kSigning)
    .update(stringToSign, 'utf8')
    .digest('hex');

  return `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

/**
 * 即梦 API 请求
 */
async function jimengRequest(method, uri, sessionId, options = {}) {
  const requestContext = getRequestContext({ ...options, sessionId });
  const baseUrl = requestContext.storedCookies ? 'https://dreamina.capcut.com' : JIMENG_BASE_URL;
  const { deviceTime, sign } = generateSign(uri);
  const fullUrl = new URL(`${baseUrl}${uri}`);

  const defaultParams = buildGenerateParams(requestContext, options.params || {});

  for (const [key, value] of Object.entries(defaultParams)) {
    fullUrl.searchParams.set(key, String(value));
  }

  const headers = {
    ...buildGenerateHeaders(requestContext),
    'Device-Time': String(deviceTime),
    Sign: sign,
    'Sign-Ver': '1',
    ...(options.headers || {}),
  };

  const fetchOptions = { method: method.toUpperCase(), headers };

  if (options.data) {
    headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(options.data);
  }

  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        console.log(`  [jimeng] 重试 ${uri} (第${attempt}次)`);
      }

      const response = await fetch(fullUrl.toString(), {
        ...fetchOptions,
        signal: AbortSignal.timeout(45000),
      });

      // 401 表示 session 已失效，自动禁用该账号
      if (response.status === 401) {
        console.error("[jimeng] 401 Unauthorized for sessionId:", sessionId?.substring(0, 8) + "...");
        try { disableAccountBySessionId(sessionId); } catch (e) { console.error("[jimeng] disableAccount failed:", e.message); }
        throw Object.assign(new Error("即梦账号已失效(401)，已自动禁用"), { isApiError: true });
      }
      const data = await response.json();

      if (isFinite(Number(data.ret))) {
        if (String(data.ret) === '0') return data.data;
        const errMsg = data.errmsg || String(data.ret);
        const retCode = String(data.ret);
        if (retCode === '5000')
          throw new Error('即梦积分不足，请前往即梦官网领取积分');
        throw Object.assign(
          new Error(`即梦 API 错误 (ret=${retCode}): ${errMsg}`),
          { isApiError: true }
        );
      }

      return data;
    } catch (err) {
      if (err.isApiError) throw err;
      if (attempt === 3) throw err;
      console.log(
        `  [jimeng] 请求 ${uri} 失败 (第${attempt + 1}次): ${err.message}`
      );
    }
  }
}

/**
 * 上传图片到 ImageX CDN
 */
async function uploadImageBuffer(buffer, sessionId, requestContext = createJimengRequestContext(sessionId)) {
  console.log(`  [upload] 开始上传图片，大小：${buffer.length} 字节`);

  const tokenResult = await jimengRequest(
    'post',
    '/mweb/v1/get_upload_token',
    sessionId,
    withRequestContext({ data: { scene: 2 } }, requestContext)
  );

  const { access_key_id, secret_access_key, session_token, service_id } =
    tokenResult;
  if (!access_key_id || !secret_access_key || !session_token) {
    throw new Error('获取上传令牌失败');
  }
  const actualServiceId = service_id || 'tb4s082cfz';
  console.log(`  [upload] 上传令牌获取成功：serviceId=${actualServiceId}`);

  const fileSize = buffer.length;
  const crc32 = calculateCRC32(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  );

  const timestamp = new Date()
    .toISOString()
    .replace(/[:\-]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const randomStr = Math.random().toString(36).substring(2, 12);
  const applyUrl = `https://imagex.bytedanceapi.com/?Action=ApplyImageUpload&Version=2018-08-01&ServiceId=${actualServiceId}&FileSize=${fileSize}&s=${randomStr}`;

  const reqHeaders = {
    'x-amz-date': timestamp,
    'x-amz-security-token': session_token,
  };
  const authorization = createAWSSignature(
    'GET',
    applyUrl,
    reqHeaders,
    access_key_id,
    secret_access_key,
    session_token
  );

  const applyResponse = await fetch(applyUrl, {
    method: 'GET',
    headers: {
      accept: '*/*',
      authorization: authorization,
      origin: 'https://jimeng.jianying.com',
      referer: 'https://jimeng.jianying.com/ai-tool/video/generate',
      'user-agent': FAKE_HEADERS['User-Agent'],
      'x-amz-date': timestamp,
      'x-amz-security-token': session_token,
    },
  });

  if (!applyResponse.ok)
    throw new Error(`申请上传权限失败：${applyResponse.status}`);
  const applyResult = await applyResponse.json();
  if (applyResult?.ResponseMetadata?.Error)
    throw new Error(
      `申请上传权限失败：${JSON.stringify(applyResult.ResponseMetadata.Error)}`
    );

  const uploadAddress = applyResult?.Result?.UploadAddress;
  if (!uploadAddress?.StoreInfos?.length || !uploadAddress?.UploadHosts?.length) {
    throw new Error('获取上传地址失败');
  }

  const storeInfo = uploadAddress.StoreInfos[0];
  const uploadHost = uploadAddress.UploadHosts[0];
  const uploadUrl = `https://${uploadHost}/upload/v1/${storeInfo.StoreUri}`;

  console.log(`  [upload] 上传图片到：${uploadHost}`);

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Accept: '*/*',
      Authorization: storeInfo.Auth,
      'Content-CRC32': crc32,
      'Content-Disposition': 'attachment; filename="undefined"',
      'Content-Type': 'application/octet-stream',
      Origin: 'https://jimeng.jianying.com',
      Referer: 'https://jimeng.jianying.com/ai-tool/video/generate',
      'User-Agent': FAKE_HEADERS['User-Agent'],
    },
    body: buffer,
  });

  if (!uploadResponse.ok)
    throw new Error(`图片上传失败：${uploadResponse.status}`);
  console.log(`  [upload] 图片文件上传成功`);

  const commitUrl = `https://imagex.bytedanceapi.com/?Action=CommitImageUpload&Version=2018-08-01&ServiceId=${actualServiceId}`;
  const commitTimestamp = new Date()
    .toISOString()
    .replace(/[:\-]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const commitPayload = JSON.stringify({
    SessionKey: uploadAddress.SessionKey,
    SuccessActionStatus: '200',
  });
  const payloadHash = crypto
    .createHash('sha256')
    .update(commitPayload, 'utf8')
    .digest('hex');

  const commitReqHeaders = {
    'x-amz-date': commitTimestamp,
    'x-amz-security-token': session_token,
    'x-amz-content-sha256': payloadHash,
  };
  const commitAuth = createAWSSignature(
    'POST',
    commitUrl,
    commitReqHeaders,
    access_key_id,
    secret_access_key,
    session_token,
    commitPayload
  );

  const commitResponse = await fetch(commitUrl, {
    method: 'POST',
    headers: {
      accept: '*/*',
      authorization: commitAuth,
      'content-type': 'application/json',
      origin: 'https://jimeng.jianying.com',
      referer: 'https://jimeng.jianying.com/ai-tool/video/generate',
      'user-agent': FAKE_HEADERS['User-Agent'],
      'x-amz-date': commitTimestamp,
      'x-amz-security-token': session_token,
      'x-amz-content-sha256': payloadHash,
    },
    body: commitPayload,
  });

  if (!commitResponse.ok)
    throw new Error(`提交上传失败：${commitResponse.status}`);
  const commitResult = await commitResponse.json();
  if (commitResult?.ResponseMetadata?.Error)
    throw new Error(
      `提交上传失败：${JSON.stringify(commitResult.ResponseMetadata.Error)}`
    );

  if (!commitResult?.Result?.Results?.length)
    throw new Error('提交上传响应缺少结果');
  const result = commitResult.Result.Results[0];
  if (result.UriStatus !== 2000)
    throw new Error(`图片上传状态异常：UriStatus=${result.UriStatus}`);

  const imageUri =
    commitResult.Result?.PluginResult?.[0]?.ImageUri || result.Uri;
  console.log(`  [upload] 图片上传完成：${imageUri}`);

  // 提交图片审核（即梦官网必需步骤）
  try {
    await jimengRequest(
      'post',
      '/mweb/v1/imagex/submit_audit_job',
      sessionId,
      withRequestContext({
        data: { uri_list: [imageUri] }
      }, requestContext)
    );
    console.log(`  [upload] 图片审核已提交：${imageUri}`);
  } catch (auditErr) {
    console.warn(`  [upload] 图片审核提交失败（非致命）：${auditErr.message}`);
  }
  return imageUri;
}

/**
 * 解析音频时长
 * MP3: 按 128kbps 估算
 * WAV: 读取 byte rate (offset 28)
 */
function parseAudioDuration(buffer) {
  // WAV: check RIFF header
  if (buffer.length > 44 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    const byteRate = buffer.readUInt32LE(28);
    if (byteRate > 0) {
      const dataSize = buffer.length - 44;
      return Math.round((dataSize / byteRate) * 1000);
    }
  }
  // MP3: estimate at 128kbps
  return Math.round(buffer.length / (128 * 1000 / 8) * 1000);
}

/**
 * 上传音频到 VOD CDN
 */
async function uploadAudioBuffer(buffer, sessionId, requestContext = createJimengRequestContext(sessionId)) {
  console.log(`  [upload] 开始上传音频，大小：${buffer.length} 字节`);

  const tokenResult = await jimengRequest(
    'post',
    '/mweb/v1/get_upload_token',
    sessionId,
    withRequestContext({ data: { scene: 1 } }, requestContext)
  );

  const { access_key_id, secret_access_key, session_token } = tokenResult;
  if (!access_key_id || !secret_access_key || !session_token) {
    throw new Error('获取音频上传令牌失败');
  }

  const fileSize = buffer.length;
  const crc32 = calculateCRC32(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  );

  // Step 2: ApplyUploadInner
  const timestamp = new Date()
    .toISOString()
    .replace(/[:\-]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const randomStr = Math.random().toString(36).substring(2, 12);
  const applyUrl = `https://vod.bytedanceapi.com/?Action=ApplyUploadInner&Version=2020-11-19&SpaceName=dreamina&FileType=video&IsInner=1&FileSize=${fileSize}&s=${randomStr}`;

  const reqHeaders = {
    'x-amz-date': timestamp,
    'x-amz-security-token': session_token,
  };
  const authorization = createAWSSignature(
    'GET',
    applyUrl,
    reqHeaders,
    access_key_id,
    secret_access_key,
    session_token,
    '',
    'cn-north-1',
    'vod'
  );

  const applyResponse = await fetch(applyUrl, {
    method: 'GET',
    headers: {
      accept: '*/*',
      authorization,
      origin: 'https://jimeng.jianying.com',
      referer: 'https://jimeng.jianying.com/ai-tool/video/generate',
      'user-agent': FAKE_HEADERS['User-Agent'],
      'x-amz-date': timestamp,
      'x-amz-security-token': session_token,
    },
  });

  if (!applyResponse.ok)
    throw new Error(`申请音频上传权限失败：${applyResponse.status}`);
  const applyResult = await applyResponse.json();
  if (applyResult?.ResponseMetadata?.Error)
    throw new Error(`申请音频上传权限失败：${JSON.stringify(applyResult.ResponseMetadata.Error)}`);

  const uploadAddress = applyResult?.Result?.InnerUploadAddress;
  const uploadNode = uploadAddress?.UploadNodes?.[0];
  if (!uploadNode?.StoreInfos?.length || !uploadNode?.UploadHost) {
    throw new Error('获取音频上传地址失败');
  }

  const storeInfo = uploadNode.StoreInfos[0];
  const uploadHost = uploadNode.UploadHost;
  const sessionKey = uploadNode.SessionKey;
  const uploadVid = uploadNode.Vid;
  const uploadUrl = `https://${uploadHost}/upload/v1/${storeInfo.StoreUri}`;

  console.log(`  [upload] 上传音频到：${uploadHost}`);

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Accept: '*/*',
      Authorization: storeInfo.Auth,
      'Content-CRC32': crc32,
      'Content-Disposition': 'attachment; filename="audio.mp3"',
      'Content-Type': 'application/octet-stream',
      Origin: 'https://jimeng.jianying.com',
      Referer: 'https://jimeng.jianying.com/ai-tool/video/generate',
      'User-Agent': FAKE_HEADERS['User-Agent'],
    },
    body: buffer,
  });

  if (!uploadResponse.ok)
    throw new Error(`音频上传失败：${uploadResponse.status}`);
  console.log(`  [upload] 音频文件上传成功`);

  // Step 4: CommitUploadInner
  const commitUrl = `https://vod.bytedanceapi.com/?Action=CommitUploadInner&Version=2020-11-19&SpaceName=dreamina`;
  const commitTimestamp = new Date()
    .toISOString()
    .replace(/[:\-]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const commitPayload = JSON.stringify({
    SessionKey: sessionKey,
    Functions: [],
  });
  const payloadHash = crypto
    .createHash('sha256')
    .update(commitPayload, 'utf8')
    .digest('hex');

  const commitReqHeaders = {
    'x-amz-date': commitTimestamp,
    'x-amz-security-token': session_token,
    'x-amz-content-sha256': payloadHash,
  };
  const commitAuth = createAWSSignature(
    'POST',
    commitUrl,
    commitReqHeaders,
    access_key_id,
    secret_access_key,
    session_token,
    commitPayload,
    'cn-north-1',
    'vod'
  );

  const commitResponse = await fetch(commitUrl, {
    method: 'POST',
    headers: {
      accept: '*/*',
      authorization: commitAuth,
      'content-type': 'application/json',
      origin: 'https://jimeng.jianying.com',
      referer: 'https://jimeng.jianying.com/ai-tool/video/generate',
      'user-agent': FAKE_HEADERS['User-Agent'],
      'x-amz-date': commitTimestamp,
      'x-amz-security-token': session_token,
      'x-amz-content-sha256': payloadHash,
    },
    body: commitPayload,
  });

  if (!commitResponse.ok)
    throw new Error(`提交音频上传失败：${commitResponse.status}`);
  const commitResult = await commitResponse.json();
  if (commitResult?.ResponseMetadata?.Error)
    throw new Error(`提交音频上传失败：${JSON.stringify(commitResult.ResponseMetadata.Error)}`);

  const vid = commitResult?.Result?.Results?.[0]?.Vid || commitResult?.Result?.Vid;
  if (!vid) throw new Error('音频上传响应缺少 Vid/Uri');

  const duration = parseAudioDuration(buffer);
  console.log(`  [upload] 音频上传完成：vid=${vid}, duration=${duration}ms`);
  return { vid, duration };
}

/**
 * 解析 prompt 中的图片占位符，构建 meta_list
 */
function buildMetaListFromPrompt(prompt, imageCount, audioCount = 0) {
  const metaList = [];
  // Match @图N, @imageN, @audioN, @音频N
  const placeholderRegex = /@(?:图 ?|image|audio|音频 ?)(\d+)/gi;
  let lastIndex = 0;
  let match;
  const referencedAudioIndices = new Set();

  while ((match = placeholderRegex.exec(prompt)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = prompt.substring(lastIndex, match.index);
      if (textBefore.trim()) {
        metaList.push({ meta_type: 'text', text: textBefore });
      }
    }

    const refNum = parseInt(match[1]) - 1;
    const refType = match[0].toLowerCase();
    const isAudioRef = /audio|音频/.test(refType);

    if (isAudioRef) {
      if (refNum >= 0 && refNum < audioCount) {
        metaList.push({
          meta_type: 'audio',
          text: '',
          material_ref: { material_idx: refNum },
        });
        referencedAudioIndices.add(refNum);
      }
    } else {
      // Image ref: material_idx needs audioCount offset since audio materials come first
      if (refNum >= 0 && refNum < imageCount) {
        metaList.push({
          meta_type: 'image',
          text: '',
          material_ref: { material_idx: audioCount + refNum },
        });
      }
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < prompt.length) {
    const remainingText = prompt.substring(lastIndex);
    if (remainingText.trim()) {
      metaList.push({ meta_type: 'text', text: remainingText });
    }
  }

  if (metaList.length === 0) {
    for (let i = 0; i < imageCount; i++) {
      if (i === 0) metaList.push({ meta_type: 'text', text: '使用' });
      metaList.push({
        meta_type: 'image',
        text: '',
        material_ref: { material_idx: audioCount + i },
      });
      if (i < imageCount - 1)
        metaList.push({ meta_type: 'text', text: '和' });
    }
    if (prompt && prompt.trim()) {
      metaList.push({ meta_type: 'text', text: imageCount > 0 ? `图片，${prompt}` : prompt });
    } else if (imageCount > 0) {
      metaList.push({ meta_type: 'text', text: '图片生成视频' });
    }
  }

  // Auto-append unreferenced audio
  for (let i = 0; i < audioCount; i++) {
    if (!referencedAudioIndices.has(i)) {
      metaList.push({
        meta_type: 'audio',
        text: '',
        material_ref: { material_idx: i },
      });
    }
  }

  return metaList;
}

/**
 * 生成 UUID
 */
function generateUUID() {
  return crypto.randomUUID();
}

async function invokePersistenceCallback(callback, label, ...args) {
  if (typeof callback !== 'function') {
    return;
  }

  try {
    await callback(...args);
  } catch (error) {
    console.error(`[video] ${label} 回调失败: ${error.message}`);
  }
}

/**
 * Seedance 2.0 视频生成主函数
 * @param {Object} options - 生成选项
 * @param {string} options.prompt - 提示词
 * @param {string} options.ratio - 画面比例
 * @param {number} options.duration - 视频时长
 * @param {Array} options.files - 图片文件数组
 * @param {string} options.sessionId - SessionID
 * @param {string} options.model - 模型名称
 * @param {Function} options.onProgress - 进度回调函数
 * @param {Function} options.onSubmitId - 获得 submitId 时的回调
 * @param {Function} options.onHistoryId - 获得 historyId 时的回调
 * @param {Function} options.onItemId - 获得 itemId 时的回调
 * @param {Function} options.onVideoReady - 获得最终视频 URL 时的回调
 * @returns {Promise<{ videoUrl: string, historyId: string, itemId: string | null, submitId: string, revisedPrompt: string }>}
 */
async function generateSeedanceVideo(options) {
  const {
    prompt,
    ratio = '4:3',
    duration = 4,
    files = [],
    audioFiles = [],
    sessionId,
    storedCookies = null,
    model = 'seedance-2.0',
    onProgress,
    onSubmitId,
    onHistoryId,
    onItemId,
    onVideoReady,
    preUploadedUris = [],
    preUploadedIndices = [],
  } = options;

  const requestContext = getRequestContext(options);
  const startTime = Date.now();
  const modelKey = model && MODEL_MAP[model] ? model : 'seedance-2.0';
  const modelId = MODEL_MAP[modelKey];
  const benefitType = BENEFIT_TYPE_MAP[modelKey];
  const actualDuration = duration || 4;

  const resConfig = VIDEO_RESOLUTION[ratio] || VIDEO_RESOLUTION['4:3'];
  const { width, height } = resConfig;

  const draftVersion = DRAFT_VERSION_MAP[modelKey] || '3.3.9';

  console.log(`[video] ${modelKey}: ${width}x${height} (${ratio}) ${actualDuration}秒, draftVersion=${draftVersion}`);
  logRequestContext('本次生成绑定账号', requestContext);

  if (onProgress) onProgress('正在上传参考图片...');

  const uploadedImages = [];

  // Merge pre-uploaded and new uploads in original order
  if (preUploadedUris.length > 0 && preUploadedIndices.length > 0) {
    const totalCount = preUploadedUris.length + files.length;
    const preUploadedMap = new Map();
    for (let i = 0; i < preUploadedIndices.length; i++) {
      preUploadedMap.set(preUploadedIndices[i], preUploadedUris[i]);
    }
    let fileIdx = 0;
    for (let i = 0; i < totalCount; i++) {
      if (preUploadedMap.has(i)) {
        const uri = preUploadedMap.get(i);
        uploadedImages.push({ uri, width, height });
        console.log(`[video] 使用预上传图片[${i}]: ${uri.substring(0, 60)}...`);
      } else {
        if (fileIdx < files.length) {
          if (onProgress) onProgress(`正在上传第 ${fileIdx + 1}/${files.length} 张图片...`);
          console.log(`[video] 上传图片[${i}] ${fileIdx + 1}/${files.length}: ${files[fileIdx].originalname}`);
          const imageUri = await uploadImageBuffer(files[fileIdx].buffer, sessionId, requestContext);
          uploadedImages.push({ uri: imageUri, width, height });
          fileIdx++;
        }
      }
    }
  } else if (preUploadedUris.length > 0) {
    // No indices provided, append pre-uploaded first then files
    for (const uri of preUploadedUris) {
      uploadedImages.push({ uri, width, height });
      console.log(`[video] 使用预上传图片: ${uri.substring(0, 60)}...`);
    }
    for (let i = 0; i < files.length; i++) {
      if (onProgress) onProgress(`正在上传第 ${i + 1}/${files.length} 张图片...`);
      const imageUri = await uploadImageBuffer(files[i].buffer, sessionId, requestContext);
      uploadedImages.push({ uri: imageUri, width, height });
    }
  } else {
    // No pre-uploaded, upload all
    for (let i = 0; i < files.length; i++) {
      if (onProgress) onProgress(`正在上传第 ${i + 1}/${files.length} 张图片...`);
      console.log(`[video] 上传图片 ${i + 1}/${files.length}: ${files[i].originalname}`);
      const imageUri = await uploadImageBuffer(files[i].buffer, sessionId, requestContext);
      uploadedImages.push({ uri: imageUri, width, height });
    }
  }

  console.log(`[video] 全部 ${uploadedImages.length} 张图片上传完成`);

  // Upload audio files
  const uploadedAudios = [];
  for (let i = 0; i < audioFiles.length; i++) {
    if (onProgress) onProgress(`正在上传第 ${i + 1}/${audioFiles.length} 个音频...`);
    console.log(`[video] 上传音频 ${i + 1}/${audioFiles.length}: ${audioFiles[i].originalname || 'audio'}`);
    const audioResult = await uploadAudioBuffer(audioFiles[i].buffer, sessionId, requestContext);
    uploadedAudios.push(audioResult);
  }
  if (uploadedAudios.length > 0) {
    console.log(`[video] 全部 ${uploadedAudios.length} 个音频上传完成`);
  }

  // Build material list: audio first, then images (matches API capture order)
  const materialList = [];

  for (const audio of uploadedAudios) {
    materialList.push({
      type: '',
      id: generateUUID(),
      material_type: 'audio',
      audio_info: {
        type: 'audio',
        source_from: 'upload',
        vid: audio.vid,
        duration: audio.duration,
        name: '',
      },
    });
  }

  for (const img of uploadedImages) {
    materialList.push({
      type: '',
      id: generateUUID(),
      material_type: 'image',
      image_info: {
        type: 'image',
        id: generateUUID(),
        source_from: 'upload',
        platform_type: 1,
        name: '',
        image_uri: img.uri,
        aigc_image: {
          type: '',
          id: generateUUID(),
        },
        width: img.width,
        height: img.height,
        format: '',
        uri: img.uri,
      },
    });
  }

  const metaList = buildMetaListFromPrompt(prompt || '', uploadedImages.length, uploadedAudios.length);
  const componentId = generateUUID();
  const submitId = generateUUID();

  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  const aspectRatio = `${width / divisor}:${height / divisor}`;

  const isVipVisionModel = modelKey === 'seedance-2.0-fast-vip' || modelKey === 'seedance-2.0-vip';

  const sceneOption = {
    type: 'video',
    scene: 'BasicVideoGenerateButton',
    ...(isVipVisionModel ? { resolution: '720p' } : {}),
    modelReqKey: modelId,
    videoDuration: actualDuration,
    ...(isVipVisionModel ? { inputVideoDuration: 0 } : {}),
    reportParams: {
      enterSource: 'generate',
      vipSource: 'generate',
      extraVipFunctionKey: isVipVisionModel ? `${modelId}-720p` : modelId,
      useVipFunctionDetailsReporterHoc: true,
    },
    materialTypes: uploadedAudios.length > 0 ? [3, 1] : [1],
  };

  const metricsExtra = JSON.stringify({
    isDefaultSeed: 1,
    originSubmitId: submitId,
    isRegenerate: false,
    enterFrom: 'click',
    position: 'page_bottom_box',
    functionMode: 'omni_reference',
    sceneOptions: JSON.stringify([sceneOption]),
  });

  if (onProgress) onProgress('正在提交视频生成请求...');
  await invokePersistenceCallback(onSubmitId, 'onSubmitId', submitId);
  console.log(`[video] 提交生成请求：model=${modelId}, benefitType=${benefitType}`);

  const generateQueryParams = new URLSearchParams({
    aid: String(DEFAULT_ASSISTANT_ID),
    device_platform: 'web',
    region: 'cn',
    webId: String(requestContext.webId),
    da_version: draftVersion,
    os: 'windows',
    web_component_open_flag: '1',
    ...(isVipVisionModel ? { commerce_with_input_video: '1' } : {}),
    web_version: '7.5.0',
    aigc_features: 'app_lip_sync',
  });
  const generateUrl = `${JIMENG_BASE_URL}/mweb/v1/aigc_draft/generate?${generateQueryParams}`;

  const generateBody = {
    extend: {
      root_model: modelId,
      m_video_commerce_info: {
        benefit_type: benefitType,
        resource_id: 'generate_video',
        resource_id_type: 'str',
        resource_sub_type: 'aigc',
      },
      m_video_commerce_info_list: [
        {
          benefit_type: benefitType,
          resource_id: 'generate_video',
          resource_id_type: 'str',
          resource_sub_type: 'aigc',
        },
      ],
      ...(isVipVisionModel ? { workspace_id: 0 } : {}),
    },
    submit_id: submitId,
    metrics_extra: metricsExtra,
    draft_content: JSON.stringify({
      type: 'draft',
      id: generateUUID(),
      min_version: draftVersion,
      min_features: ['AIGC_Video_UnifiedEdit'],
      is_from_tsn: true,
      version: draftVersion,
      main_component_id: componentId,
      component_list: [
        {
          type: 'video_base_component',
          id: componentId,
          min_version: '1.0.0',
          aigc_mode: 'workbench',
          metadata: {
            type: '',
            id: generateUUID(),
            created_platform: 3,
            created_platform_version: '',
            created_time_in_ms: String(Date.now()),
            created_did: '',
          },
          generate_type: 'gen_video',
          abilities: {
            type: '',
            id: generateUUID(),
            gen_video: {
              type: '',
              id: generateUUID(),
              text_to_video_params: {
                type: '',
                id: generateUUID(),
                video_gen_inputs: [
                  {
                    type: '',
                    id: generateUUID(),
                    min_version: draftVersion,
                    prompt: '',
                    video_mode: 2,
                    fps: 24,
                    duration_ms: actualDuration * 1000,
                    idip_meta_list: [],
                    unified_edit_input: {
                      type: '',
                      id: generateUUID(),
                      material_list: materialList,
                      meta_list: metaList,
                    },
                  },
                ],
                video_aspect_ratio: aspectRatio,
                seed: Math.floor(Math.random() * 1000000000),
                model_req_key: modelId,
                priority: 0,
              },
              video_task_extra: metricsExtra,
            },
          },
          process_type: 1,
        },
      ],
    }),
    http_common_info: {
      aid: DEFAULT_ASSISTANT_ID,
    },
  };

  const generateResult = await browserService.fetch(
    sessionId,
    requestContext.webId,
    requestContext.userId,
    generateUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateBody),
    },
    storedCookies
  );

  if (generateResult.ret !== undefined && String(generateResult.ret) !== '0') {
    const retCode = String(generateResult.ret);
    const errMsg = generateResult.errmsg || retCode;
    console.warn(
      `[video] 提交被平台拒绝 session: ${getSessionLogLabel(sessionId)}, ret=${retCode}, errmsg=${errMsg}`
    );
    if (retCode === '5000') throw new Error('即梦积分不足，请前往即梦官网领取积分');
    throw new Error(`即梦 API 错误 (ret=${retCode}): ${errMsg}`);
  }

  const aigcData = generateResult.data?.aigc_data;
  const historyId = aigcData?.history_record_id;
  if (!historyId) {
    console.warn(
      `[video] 提交响应缺少 historyId session: ${getSessionLogLabel(sessionId)}`
    );
    throw new Error('未获取到记录 ID');
  }

  console.log(
    `[video] 提交成功 session: ${getSessionLogLabel(sessionId)}, historyId: ${historyId}`
  );
  console.log(`[video] 生成请求已提交，historyId: ${historyId}`);
  await invokePersistenceCallback(onHistoryId, 'onHistoryId', historyId);

  if (onProgress) onProgress('已提交，等待 AI 生成视频...');
  await new Promise((r) => setTimeout(r, 5000));

  let status = 20;
  let failCode;
  let itemList = [];
  const maxRetries = 360;  // 360次 × 30秒 = 最多3小时
  const POLL_INTERVAL = 30000;  // 30秒，和即梦官网一致

  for (let retryCount = 0; retryCount < maxRetries && status === 20; retryCount++) {
    try {
      // 先查询排队进度
      let queueInfo = null;
      let forecastQueueCost = 0;
      try {
        const queueResult = await jimengRequest(
          'post',
          '/mweb/v1/get_history_queue_info',
          sessionId,
          withRequestContext({ data: { history_ids: [historyId] } }, requestContext)
        );
        queueInfo = queueResult?.[historyId]?.queue_info;
        forecastQueueCost = queueResult?.[historyId]?.forecast_cost_time?.forecast_queue_cost || 0;
      } catch (e) {
        // queue_info 查询失败不影响主流程
      }

      // 再查询生成状态
      const result = await jimengRequest(
        'post',
        '/mweb/v1/get_history_by_ids',
        sessionId,
        withRequestContext({ data: { history_ids: [historyId] } }, requestContext)
      );

      const historyData = result?.history_list?.[0] || result?.[historyId];

      if (!historyData) {
        // 数据不存在，可能还在队列中
        if (queueInfo && queueInfo.queue_idx > 0) {
          const qIdx = queueInfo.queue_idx;
          const forecastMin = Math.ceil(forecastQueueCost / 60) || Math.ceil(qIdx / 50 * 30 / 60);
          console.log(`[video] 轮询 #${retryCount + 1}: 排队中 第${qIdx}位，预计${forecastMin}分钟`);
          if (onProgress) onProgress(`排队中，当前第 ${qIdx} 位，预计约 ${forecastMin} 分钟...`);
        } else {
          console.log(`[video] 轮询 #${retryCount + 1}: 数据不存在，等待中`);
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
        continue;
      }

      status = historyData.status;
      failCode = historyData.fail_code;
      itemList = historyData.item_list || [];

      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;

      console.log(
        `[video] 轮询 #${retryCount + 1}: status=${status}, ${mins}分${secs}秒`
      );

      if (status === 30) {
        throw new Error(
          failCode === 2038
            ? '内容被过滤，请修改提示词后重试'
            : `视频生成失败，错误码：${failCode}`
        );
      }

      if (status === 20) {
        let progressMsg;
        if (queueInfo && queueInfo.queue_idx > 0) {
          const qIdx = queueInfo.queue_idx;
          const forecastMin = Math.ceil(forecastQueueCost / 60) || Math.ceil(qIdx / 50 * 30 / 60);
          progressMsg = `排队中，第 ${qIdx} 位，预计 ${forecastMin} 分钟（已等 ${mins} 分钟）`;
        } else {
          progressMsg = mins < 2
            ? 'AI 正在生成视频，请耐心等待...'
            : `视频生成中，已等待 ${mins} 分钟...`;
        }
        if (onProgress) onProgress(progressMsg);
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      }
    } catch (error) {
      if (
        error.message?.includes('内容被过滤') ||
        error.message?.includes('生成失败')
      )
        throw error;
      console.log(`[video] 轮询出错：${error.message}`);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    }
  }

  if (status === 20)
    throw new Error('视频生成超时 (已等待超过3小时)，请稍后重试');


  if (onProgress) onProgress('正在获取高清视频...');

  const itemId =
    itemList?.[0]?.item_id ||
    itemList?.[0]?.id ||
    itemList?.[0]?.local_item_id ||
    itemList?.[0]?.common_attr?.id;

  let videoUrl;

  if (itemId) {
    await invokePersistenceCallback(onItemId, 'onItemId', String(itemId));
    try {
      const hqResult = await jimengRequest(
        'post',
        '/mweb/v1/get_local_item_list',
        sessionId,
        withRequestContext(
          {
            data: {
              item_id_list: [String(itemId)],
              pack_item_opt: { scene: 1, need_data_integrity: true },
              is_for_video_download: true,
            },
          },
          requestContext
        )
      );

      const hqItemList = hqResult?.item_list || hqResult?.local_item_list || [];
      const hqItem = hqItemList[0];
      const hqUrl =
        hqItem?.video?.transcoded_video?.origin?.video_url ||
        hqItem?.video?.download_url ||
        hqItem?.video?.play_url ||
        hqItem?.video?.url;

      if (hqUrl) {
        console.log(`[video] 高清视频 URL 获取成功`);
        videoUrl = hqUrl;
      }
    } catch (err) {
      console.log(`[video] 获取高清 URL 失败，使用预览 URL: ${err.message}`);
    }
  }

  if (!videoUrl) {
    videoUrl =
      itemList?.[0]?.video?.transcoded_video?.origin?.video_url ||
      itemList?.[0]?.video?.play_url ||
      itemList?.[0]?.video?.download_url ||
      itemList?.[0]?.video?.url;
  }

  if (!videoUrl) throw new Error('未能获取视频 URL');

  await invokePersistenceCallback(onVideoReady, 'onVideoReady', videoUrl);
  console.log(`[video] 视频 URL 获取成功`);
  return {
    videoUrl,
    historyId,
    itemId: itemId ? String(itemId) : null,
    submitId,
    revisedPrompt: prompt || '',
  };
}

/**
 * 更新数据库中的任务状态
 */
function updateTaskStatus(taskId, status, videoUrl = null, historyId = null) {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE tasks
    SET status = ?,
        video_url = ?,
        history_id = ?,
        completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(status, videoUrl, historyId, taskId);
}


export { jimengRequest as videoGeneratorJimengRequest,
  generateSeedanceVideo,
  updateTaskStatus,
  MODEL_MAP,
  BENEFIT_TYPE_MAP,
  VIDEO_RESOLUTION,
};
