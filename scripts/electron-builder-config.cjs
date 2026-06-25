'use strict';

const fs = require('fs');
const path = require('path');

// 清理无效的代码签名证书环境变量，防止 Windows 打包时报错
for (const envVar of ['WIN_CSC_LINK', 'CSC_LINK']) {
  const val = process.env[envVar];
  if (val) {
    try {
      const resolved = path.resolve(val);
      // 如果解析出来的路径在系统里存在但不是文件（例如是目录或 "."）
      if (fs.existsSync(resolved) && !fs.statSync(resolved).isFile()) {
        console.log(`[Codesign] 清理指向目录的无效证书路径环境变量 ${envVar}: ${val}`);
        delete process.env[envVar];
      } else if (!fs.existsSync(resolved) && (val === '.' || val.length < 10)) {
        // 如果路径不存在，且长度过短明显不是有效的 base64 证书内容，则做清理
        console.log(`[Codesign] 清理无效的证书环境变量 ${envVar}: ${val}`);
        delete process.env[envVar];
      }
    } catch {
      delete process.env[envVar];
    }
  }
}

const config = require('../electron-builder.json');

const DEFAULT_KEYFROM = 'official';
const KEYFROM_PATTERN = /^[a-z0-9_-]{1,64}$/;

function normalizeKeyfrom(value) {
  if (typeof value !== 'string') return DEFAULT_KEYFROM;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return DEFAULT_KEYFROM;
  if (!KEYFROM_PATTERN.test(normalized)) return DEFAULT_KEYFROM;
  return normalized;
}

function readBuildKeyfrom() {
  if (process.env.KEYFROM !== undefined) {
    return normalizeKeyfrom(process.env.KEYFROM);
  }

  const buildInfoPath = path.join(__dirname, '..', '.keyfrom-build', 'keyfrom.json');
  try {
    if (!fs.existsSync(buildInfoPath)) {
      return DEFAULT_KEYFROM;
    }
    const parsed = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
    return normalizeKeyfrom(parsed?.keyfrom);
  } catch (error) {
    console.warn('[Keyfrom] failed to read build keyfrom for artifact names, using official:', error);
    return DEFAULT_KEYFROM;
  }
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function resourceKey(resource) {
  if (typeof resource === 'string') return `string:${resource}`;
  return `${resource?.from || ''}->${resource?.to || ''}`;
}

function mergeExtraResources(platformName) {
  const baseResources = asArray(config.extraResources);
  const platformConfig = config[platformName] || {};
  const platformResources = asArray(platformConfig.extraResources);
  const merged = [];
  const seen = new Set();

  for (const resource of [...baseResources, ...platformResources]) {
    const key = resourceKey(resource);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(resource);
  }

  config[platformName] = {
    ...platformConfig,
    extraResources: merged,
  };
}

const keyfrom = readBuildKeyfrom();

for (const platformName of ['mac', 'win', 'linux']) {
  mergeExtraResources(platformName);
}

delete config.extraResources;

config.dmg = {
  ...(config.dmg || {}),
  artifactName: `HeyClaw-mac-\${arch}-\${version}-${keyfrom}.\${ext}`,
};

config.nsis = {
  ...(config.nsis || {}),
  artifactName: `HeyClaw-win-\${arch}-\${version}-${keyfrom}.\${ext}`,
};

console.log(`[Keyfrom] configured artifact keyfrom as ${keyfrom}`);

if (!process.env.CSC_LINK) {
  console.log('[Codesign] CSC_LINK is not set, disabling Mac code signing identity to prevent signature conflicts');
  if (!config.mac) {
    config.mac = {};
  }
  config.mac.identity = null;
}

module.exports = config;
