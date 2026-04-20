// ============================================================
// Seedance Cookie Importer - Popup Logic
// ============================================================

const SAMESITE_MAP = {
  'no_restriction': 'None',
  'lax': 'Lax',
  'strict': 'Strict',
  'unspecified': 'Lax',
};

// ---- State ----
let intlData = null;   // { sessionId, region, cookies, cookieString, stats }
let domesticData = null; // { sessionId }
let settings = {
  platformUrl: 'http://localhost:5173',
  authToken: '',
  proxyUrl: '',
};

// ---- DOM refs ----
const $ = (id) => document.getElementById(id);

// ============================================================
// Initialization
// ============================================================

async function init() {
  await loadSettings();
  await extractAllCookies();
}

// ============================================================
// Settings (chrome.storage.local)
// ============================================================

function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['platformUrl', 'authToken', 'proxyUrl'], (data) => {
      settings.platformUrl = data.platformUrl || 'http://localhost:5173';
      settings.authToken = data.authToken || '';
      settings.proxyUrl = data.proxyUrl || '';
      $('setting-platform-url').value = settings.platformUrl;
      $('setting-auth-token').value = settings.authToken;
      $('setting-proxy-url').value = settings.proxyUrl;
      resolve();
    });
  });
}

function saveSettings() {
  settings.platformUrl = $('setting-platform-url').value.trim().replace(/\/+$/, '') || 'http://localhost:5173';
  settings.authToken = $('setting-auth-token').value.trim();
  settings.proxyUrl = $('setting-proxy-url').value.trim();

  chrome.storage.local.set({
    platformUrl: settings.platformUrl,
    authToken: settings.authToken,
    proxyUrl: settings.proxyUrl,
  }, () => {
    // Show success in settings panel
    const btn = $('btn-save-settings');
    const originalText = btn.textContent;
    btn.textContent = '✅ 已保存';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 2000);

    // Show hint: remind user to click import
    const hint = $('settings-save-hint');
    if (hint) {
      hint.classList.remove('hidden');
      setTimeout(() => hint.classList.add('hidden'), 8000);
    }
  });
}

// ============================================================
// Cookie Extraction
// ============================================================

async function extractAllCookies() {
  try {
    // --- International: Dreamina (.capcut.com + dreamina.capcut.com) ---
    const capcutCookies = await getCookiesForUrl('https://www.capcut.com');
    const dreaminaCookies = await getCookiesForUrl('https://dreamina.capcut.com');

    // Merge & deduplicate by (name, domain)
    const intlCookieMap = new Map();
    for (const c of [...capcutCookies, ...dreaminaCookies]) {
      const key = `${c.name}|${c.domain}`;
      if (!intlCookieMap.has(key)) {
        intlCookieMap.set(key, c);
      }
    }
    const allIntlCookies = [...intlCookieMap.values()];

    // Find sessionid
    const intlSessionCookie = allIntlCookies.find(c => c.name === 'sessionid');
    if (intlSessionCookie) {
      let sessionId = intlSessionCookie.value;

      // Get region from store-country-code cookie (e.g. "SG", "JP", "US")
      const countryCodeCookie = allIntlCookies.find(c => c.name === 'store-country-code');
      const countryCode = countryCodeCookie
        ? countryCodeCookie.value.replace(/_/g, '').toUpperCase()
        : '';

      // If sessionId doesn't already have a region prefix, prepend countryCode-
      const prefixMatch = sessionId.toLowerCase().match(/^([a-z]{2})-/);
      let region = prefixMatch ? prefixMatch[1].toUpperCase() : '';

      if (!prefixMatch && countryCode) {
        // sessionId is raw (no prefix), build full ID: "sg-abc123..."
        sessionId = `${countryCode.toLowerCase()}-${sessionId}`;
        region = countryCode;
      } else if (!region && countryCode) {
        // Fallback: use store-country-code as region
        region = countryCode;
      }

      // Format as Cookie Editor JSON (compatible with our parseJsonCookiesToPlaywrightCookies)
      const formatted = allIntlCookies
        .filter(c => (c.domain || '').includes('capcut.com'))
        .map(c => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          hostOnly: c.hostOnly || false,
          path: c.path || '/',
          secure: c.secure || false,
          httpOnly: c.httpOnly || false,
          sameSite: SAMESITE_MAP[c.sameSite] || 'Lax',
          session: c.session || false,
          ...(c.expirationDate ? { expirationDate: Math.floor(c.expirationDate) } : {}),
        }));

      // Domain stats
      const domainCounts = {};
      for (const c of formatted) {
        const d = c.domain || 'unknown';
        domainCounts[d] = (domainCounts[d] || 0) + 1;
      }

      intlData = {
        sessionId,
        region,
        cookies: formatted,
        cookieString: JSON.stringify(formatted),
        stats: {
          total: formatted.length,
          domains: domainCounts,
        },
      };
    }

    // --- Domestic: Jimeng (jimeng.jianying.com) ---
    const jimengCookies = await getCookiesForUrl('https://jimeng.jianying.com');
    const domesticSessionCookie = jimengCookies.find(c => c.name === 'sessionid');
    if (domesticSessionCookie) {
      domesticData = {
        sessionId: domesticSessionCookie.value,
      };
    }

    // --- Update UI ---
    $('loading').classList.add('hidden');

    if (intlData) {
      renderIntlSection();
    }
    if (domesticData) {
      renderDomesticSection();
    }
    if (!intlData && !domesticData) {
      $('no-cookies').classList.remove('hidden');
    }
  } catch (err) {
    $('loading').innerHTML = `<div style="color:#f87171">检测失败: ${escapeHtml(err.message)}</div>`;
  }
}

function getCookiesForUrl(url) {
  return new Promise((resolve) => {
    chrome.cookies.getAll({ url }, (cookies) => {
      resolve(cookies || []);
    });
  });
}

// ============================================================
// UI Rendering
// ============================================================

function renderIntlSection() {
  const section = $('intl-section');
  section.classList.remove('hidden');

  // Session ID (masked)
  const sid = intlData.sessionId;
  $('intl-session-id').textContent = sid.length > 16
    ? `${sid.slice(0, 8)}...${sid.slice(-8)}`
    : sid;

  // Region badge
  if (intlData.region) {
    const badge = $('intl-region');
    badge.textContent = intlData.region;
    badge.classList.remove('hidden');
  }

  // Cookie count
  $('intl-cookie-count').textContent = `${intlData.stats.total} 个`;

  // Domain distribution
  const domainHtml = Object.entries(intlData.stats.domains)
    .map(([d, n]) => `<span class="domain-item">${escapeHtml(d)}: ${n}</span>`)
    .join('');
  $('intl-domains').innerHTML = domainHtml;

  // Auto-fill name
  $('intl-name').value = `Dreamina ${intlData.region || 'INTL'}`;
}

function renderDomesticSection() {
  const section = $('domestic-section');
  section.classList.remove('hidden');

  const sid = domesticData.sessionId;
  $('domestic-session-id').textContent = sid.length > 16
    ? `${sid.slice(0, 8)}...${sid.slice(-8)}`
    : sid;

  $('domestic-name').value = `即梦账号`;
}

// ============================================================
// Actions: Copy
// ============================================================

function copyIntlJSON() {
  if (!intlData) return;

  const importData = [{
    sessionId: intlData.sessionId,
    cookies: intlData.cookieString,
    versionType: 'international',
    ...(intlData.region ? { region: intlData.region } : {}),
    ...(settings.proxyUrl ? { proxyUrl: settings.proxyUrl } : {}),
    name: $('intl-name').value || `Dreamina ${intlData.region || 'INTL'}`,
  }];

  const text = JSON.stringify(importData, null, 2);

  navigator.clipboard.writeText(text).then(() => {
    showResult('intl', true, '已复制到剪贴板！可在 Seedance 设置页 → 批量导入 → 粘贴');
  }).catch(() => {
    // Fallback: textarea copy
    fallbackCopy(text);
    showResult('intl', true, '已复制到剪贴板！');
  });
}

function copyDomesticJSON() {
  if (!domesticData) return;

  const importData = [{
    sessionId: domesticData.sessionId,
    versionType: 'domestic',
    name: $('domestic-name').value || '即梦账号',
  }];

  const text = JSON.stringify(importData, null, 2);

  navigator.clipboard.writeText(text).then(() => {
    showResult('domestic', true, '已复制到剪贴板！可在 Seedance 设置页 → 批量导入 → 粘贴');
  }).catch(() => {
    fallbackCopy(text);
    showResult('domestic', true, '已复制到剪贴板！');
  });
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

// ============================================================
// Actions: Import to Platform
// ============================================================

async function importToPlatform(type) {
  if (type === 'intl' && !intlData) return;
  if (type === 'domestic' && !domesticData) return;

  // Check settings
  if (!settings.authToken) {
    showResult(type, false, '请先在"平台设置"中配置认证 Session ID');
    // Auto-open settings
    $('settings-panel').classList.remove('hidden');
    $('settings-arrow').classList.add('open');
    $('setting-auth-token').focus();
    return;
  }

  const btn = $(`btn-import-${type}`);
  btn.disabled = true;
  btn.textContent = '⏳ 导入中...';

  try {
    let body;

    if (type === 'intl') {
      body = {
        name: $('intl-name').value || `Dreamina ${intlData.region || 'INTL'}`,
        sessionId: intlData.sessionId,
        versionType: 'international',
        isEnabled: true,
        cookies: intlData.cookieString,
        ...(settings.proxyUrl ? { proxyUrl: settings.proxyUrl } : {}),
      };
    } else {
      body = {
        name: $('domestic-name').value || '即梦账号',
        sessionId: domesticData.sessionId,
        versionType: 'domestic',
        isEnabled: true,
      };
    }

    const response = await fetch(`${settings.platformUrl}/api/settings/session-accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': settings.authToken,
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (result.success) {
      showResult(type, true, `导入成功！账号 "${body.name}" 已添加到 Seedance 平台`);
    } else {
      showResult(type, false, `导入失败: ${result.error || '未知错误'}`);
    }
  } catch (err) {
    showResult(type, false, `连接失败: ${err.message}。请检查平台地址和认证信息。`);
  } finally {
    btn.disabled = false;
    btn.textContent = '🚀 一键导入';
  }
}

// ============================================================
// Result display
// ============================================================

function showResult(type, success, message) {
  const el = $(`${type}-result`);
  el.className = `result-msg ${success ? 'result-success' : 'result-error'}`;
  el.textContent = message;
  el.classList.remove('hidden');

  // Auto-hide success after 5s
  if (success) {
    setTimeout(() => el.classList.add('hidden'), 5000);
  }
}

// ============================================================
// Utilities
// ============================================================

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// Event Bindings
// ============================================================

// Settings toggle
$('btn-toggle-settings').addEventListener('click', () => {
  const panel = $('settings-panel');
  const arrow = $('settings-arrow');
  const visible = !panel.classList.contains('hidden');
  panel.classList.toggle('hidden', visible);
  arrow.classList.toggle('open', !visible);
});

// Save settings
$('btn-save-settings').addEventListener('click', saveSettings);

// International actions
$('btn-copy-intl').addEventListener('click', copyIntlJSON);
$('btn-import-intl').addEventListener('click', () => importToPlatform('intl'));

// Domestic actions
$('btn-copy-domestic').addEventListener('click', copyDomesticJSON);
$('btn-import-domestic').addEventListener('click', () => importToPlatform('domestic'));

// ============================================================
// Start
// ============================================================

init();
