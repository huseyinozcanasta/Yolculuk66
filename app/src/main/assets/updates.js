/* Yolculuk66 version checker — explicit user action only; no player data sent. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.YolculukUpdates = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CURRENT_VERSION = '0.3.3';
  const REPO = 'huseyinozcanasta/Yolculuk66';
  const RELEASE_API = 'https://api.github.com/repos/' + REPO + '/releases?per_page=5';
  const RELEASES_URL = 'https://github.com/' + REPO + '/releases';

  function versionParts(value) {
    const valueText = String(value || '').trim().replace(/^v/i, '');
    if (!/^\d+\.\d+\.\d+(?:\+\d+)?$/.test(valueText)) {
      throw new Error('Geçersiz sürüm numarası.');
    }
    return valueText.split('+')[0].split('.').map(Number);
  }
  function compareVersions(a, b) {
    const left = versionParts(a), right = versionParts(b);
    for (let i = 0; i < 3; i++) {
      if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
    }
    return 0;
  }
  function trustedReleaseUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' &&
        url.hostname === 'github.com' &&
        url.pathname.toLowerCase().startsWith('/huseyinozcanasta/yolculuk66/releases/')
          ? url.toString() : RELEASES_URL;
    } catch (_) { return RELEASES_URL; }
  }
  function trustedApkUrl(assets) {
    if (!Array.isArray(assets)) return null;
    const candidate = assets.find(item => {
      if (!item || !/\.apk$/i.test(String(item.name || ''))) return false;
      const url = trustedReleaseUrl(item.browser_download_url);
      try {
        const parsed = new URL(url);
        return parsed.pathname.toLowerCase().startsWith('/huseyinozcanasta/yolculuk66/releases/download/') &&
               /\.apk$/i.test(parsed.pathname);
      } catch (_) { return false; }
    });
    return candidate ? trustedReleaseUrl(candidate.browser_download_url) : null;
  }
  async function checkForUpdates(fetchImpl, installedVersion) {
    const fetcher = typeof fetchImpl === 'function' ? fetchImpl :
      (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    if (!fetcher) throw new Error('Güncelleme kontrolü için ağ desteği bulunamadı.');
    let response;
    try {
      response = await fetcher(RELEASE_API, {
        method: 'GET', headers: {Accept: 'application/vnd.github+json'}, cache: 'no-store'
      });
    } catch (_) {
      throw new Error('Bağlantı kurulamadı; güncelleme kontrolü yapılamadı.');
    }
    if (!response || !response.ok) {
      throw new Error('Güncelleme kontrolü şu an kullanılamıyor. GitHub sürüm sayfasını daha sonra dene.');
    }
    let data;
    try { data = await response.json(); }
    catch (_) { throw new Error('Güncelleme bilgisi okunamadı.'); }
    const releases = Array.isArray(data) ? data : [data];
    const published = releases.filter(item => {
      if (!item || item.draft) return false;
      try { versionParts(item.tag_name); return true; }
      catch (_) { return false; }
    });
    if (!published.length) throw new Error('Henüz yayımlanmış sürüm bulunamadı.');
    published.sort((a,b)=>compareVersions(b.tag_name,a.tag_name));
    const release = published[0];
    const latestVersion = String(release.tag_name).trim().replace(/^v/i, '');
    const installed = installedVersion || CURRENT_VERSION;
    const hasUpdate = compareVersions(latestVersion, installed) > 0;
    return {
      status: hasUpdate ? 'available' : 'current',
      currentVersion: installed,
      latestVersion,
      isPrerelease: !!release.prerelease,
      releaseUrl: trustedReleaseUrl(release.html_url),
      apkUrl: hasUpdate ? trustedApkUrl(release.assets) : null
    };
  }
  return {CURRENT_VERSION, RELEASE_API, RELEASES_URL, compareVersions, checkForUpdates};
});
