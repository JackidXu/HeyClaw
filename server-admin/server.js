// 加载本地 .env 配置文件
require('dotenv').config({ override: true });

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const OSS = require('ali-oss');

// 配置参数 (支持环境变量覆盖)
const PORT = process.env.PORT || 8082;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'HeyClawAdmin123';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../server-assets');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, 'backups');
const ASSETS_DIR = process.env.ASSETS_DIR || path.join(DATA_DIR, 'zip-bundles');

// 确保本地相关目录存在 (以便在未配置云端或云端异常时支持本地模式降级运行)
[DATA_DIR, BACKUP_DIR, ASSETS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 初始化阿里云 OSS 客户端 (使用 try-catch 保护以支持优雅降级)
let storeClient = null;
if (process.env.OSS_ACCESS_KEY_ID && process.env.OSS_ACCESS_KEY_SECRET) {
  try {
    // 快速防呆校验：如果包含中文占位符，说明尚未填写配置，直接跳过初始化并优雅提示
    const hasPlaceholder = /[\u4e00-\u9fa5]/.test(process.env.OSS_ACCESS_KEY_ID + process.env.OSS_ACCESS_KEY_SECRET + (process.env.OSS_BUCKET || ''));
    if (hasPlaceholder) {
      console.warn('⚠️ [OSS] 检测到 .env 中仍包含中文占位符，跳过 OSS 客户端初始化，将以本地开发模式运行。');
    } else {
      storeClient = new OSS({
        accessKeyId: process.env.OSS_ACCESS_KEY_ID,
        accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
        bucket: process.env.OSS_BUCKET,
        endpoint: process.env.OSS_ENDPOINT,
      });
      console.log(`✓ [OSS] 阿里云 OSS 客户端初始化成功。使用 Bucket: ${process.env.OSS_BUCKET}`);
    }
  } catch (err) {
    console.warn(`⚠️ [OSS] 客户端初始化失败，服务已自动安全降级为本地开发模式运行。原因: ${err.message}`);
    storeClient = null;
  }
} else {
  console.log('ℹ️ [OSS] 未配置云端 OSS 密钥，服务将自动以本地开发模式运行。');
}

const CDN_PREFIX = (process.env.CDN_URL_PREFIX || '').replace(/\/+$/, '');

// 在内存中记录活跃的会话 Token 和安全登录防护
const activeTokens = new Set();
const loginFailures = new Map(); // IP -> { count, lockUntil }

// 辅助方法：格式化时间戳
function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${m}-${d}_${h}-${min}-${s}`;
}

// 上一次定时备份日期
let lastBackupDate = '';

// 每日定时同步云端备份函数 (现在备份文件直接在云端 OSS 的 backups/ 下创建)
async function checkAndPerformDailyBackup() {
  const date = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const today = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  if (lastBackupDate === today) return; // 今天已经备份过
  if (!storeClient) return; // 未配置云端，直接跳过自动同步备份

  try {
    for (const fileName of ['kit-store.json', 'skill-store.json']) {
      const cloudPath = `heyclaw/server-assets/${fileName}`;
      try {
        const result = await storeClient.get(cloudPath);
        const cloudContent = result.content.toString('utf8');
        
        const baseName = path.basename(fileName, '.json');
        const backupName = `${baseName}.${today}.bak.json`;
        const cloudBackupPath = `heyclaw/server-assets/backups/${backupName}`;
        
        await storeClient.put(cloudBackupPath, Buffer.from(cloudContent, 'utf8'));
        console.log(`[Admin] Daily cloud backup created on OSS: ${cloudBackupPath}`);
      } catch (err) {
        if (err.name !== 'NoSuchKeyError' && err.code !== 'NoSuchKey') {
          console.error(`[Admin] Daily cloud backup for ${fileName} failed:`, err);
        }
      }
    }
    lastBackupDate = today;
  } catch (err) {
    console.error('[Admin] Daily backup job failed:', err);
  }
}

// 每天轮询一次 (24 小时)
setInterval(checkAndPerformDailyBackup, 24 * 60 * 60 * 1000);
// 启动服务后 5 秒立即检查并执行首发备份
setTimeout(checkAndPerformDailyBackup, 5000);

// 辅助方法：读取 JSON Body
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// 辅助方法：发送 JSON 响应
function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// 备份逻辑 (从云端拉取当前最新版本并备份到云端 OSS backups 目录下)
async function createCloudBackup(fileName) {
  if (!storeClient) return null;
  const cloudPath = `heyclaw/server-assets/${fileName}`;
  try {
    const result = await storeClient.get(cloudPath);
    const content = result.content.toString('utf8');
    
    const baseName = path.basename(fileName, '.json');
    const backupName = `${baseName}.${formatTimestamp()}.bak.json`;
    const cloudBackupPath = `heyclaw/server-assets/backups/${backupName}`;
    
    // 写入云端 OSS
    await storeClient.put(cloudBackupPath, Buffer.from(content, 'utf8'));
    console.log(`[Backup] Cloud backup created successfully: ${cloudBackupPath}`);
    return backupName;
  } catch (err) {
    console.warn(`[Backup] Create cloud backup for ${fileName} failed:`, err.message);
    return null;
  }
}

// 静态文件服务
function serveStaticFile(res, filePath) {
  // 防目录穿越安全保护
  const safePath = path.resolve(filePath);
  const distDir = path.resolve(path.join(__dirname, 'dist'));
  if (!safePath.startsWith(distDir) && safePath !== distDir) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
    // 如果文件不存在，回退到 index.html 以支持 SPA 路由
    const indexPath = path.join(distDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      serveStaticFile(res, indexPath);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
    return;
  }

  const ext = path.extname(safePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };

  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
  fs.createReadStream(safePath).pipe(res);
}

// 获取请求客户端 IP
function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
}

// 创建服务
const server = http.createServer(async (req, res) => {
  // 支持跨域以便本地前端调试
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // 1. 登录路由
  if (pathname === '/api/login' && req.method === 'POST') {
    const ip = getClientIp(req);
    const now = Date.now();

    // 检查是否已被锁定
    const failInfo = loginFailures.get(ip);
    if (failInfo && failInfo.lockUntil > now) {
      const waitMinutes = Math.ceil((failInfo.lockUntil - now) / 60000);
      return sendJson(res, { success: false, error: `登录尝试过多，请在 ${waitMinutes} 分钟后再试` }, 429);
    }

    try {
      const { password } = await readJsonBody(req);
      if (password === ADMIN_PASSWORD) {
        // 验证成功，清除失败记录并生成 Token
        loginFailures.delete(ip);
        const token = crypto.randomBytes(32).toString('hex');
        activeTokens.add(token);
        return sendJson(res, { success: true, token });
      } else {
        // 失败计数与锁定逻辑
        const currentFail = loginFailures.get(ip) || { count: 0, lockUntil: 0 };
        currentFail.count += 1;
        if (currentFail.count >= 5) {
          currentFail.lockUntil = now + 15 * 60 * 1000; // 锁定 15 分钟
          loginFailures.set(ip, currentFail);
          return sendJson(res, { success: false, error: '密码错误次数过多，账号已锁定 15 分钟' }, 429);
        } else {
          loginFailures.set(ip, currentFail);
          return sendJson(res, { success: false, error: `密码错误！还可尝试 ${5 - currentFail.count} 次` }, 401);
        }
      }
    } catch (err) {
      return sendJson(res, { success: false, error: '请求解析失败' }, 400);
    }
  }

  // 2. 身份验证过滤器 (以 /api/ 开头的均拦截，除 login 外)
  if (pathname.startsWith('/api/')) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/, '').trim();
    if (!token || !activeTokens.has(token)) {
      return sendJson(res, { success: false, error: '身份校验失效，请重新登录' }, 401);
    }
  }

  // 3. API - 获取数据
  if (pathname === '/api/data' && req.method === 'GET') {
    try {
      const defaultKits = '{"data":{"value":{"kits":[]}}}';
      const defaultSkills = '{"data":{"value":{"localSkill":[],"marketplace":[],"marketTags":[]}}}';

      let kitsData = defaultKits;
      let skillsData = defaultSkills;

      if (storeClient) {
        const kitCloudPath = 'heyclaw/server-assets/kit-store.json';
        const skillCloudPath = 'heyclaw/server-assets/skill-store.json';

        // 尝试从云端 OSS 读取，如果 NoSuchKey 则用本地或默认数据初始化并上云
        try {
          const result = await storeClient.get(kitCloudPath);
          kitsData = result.content.toString('utf8');

          // 主动迁移防护：如果云端是空列表，但本地存有历史数据，自动将本地存量数据同步推上云
          const localKitPath = path.join(DATA_DIR, 'kit-store.json');
          if (fs.existsSync(localKitPath)) {
            try {
              const localRaw = fs.readFileSync(localKitPath, 'utf8');
              const localParsed = JSON.parse(localRaw);
              const cloudParsed = JSON.parse(kitsData);
              const localList = localParsed?.data?.value?.kits || [];
              const cloudList = cloudParsed?.data?.value?.kits || [];
              if (cloudList.length === 0 && localList.length > 0) {
                console.log(`[Admin] Cloud ${kitCloudPath} is empty but local has ${localList.length} items. Automatically migrating local data to cloud...`);
                await storeClient.put(kitCloudPath, Buffer.from(localRaw, 'utf8'));
                kitsData = localRaw;
              }
            } catch (migErr) {
              console.warn(`[Migration] Check kit migration failed:`, migErr.message);
            }
          }
        } catch (err) {
          if (err.name === 'NoSuchKeyError' || err.code === 'NoSuchKey') {
            // 优先读取本地历史数据作为初始化内容，实现无缝上云
            const localKitPath = path.join(DATA_DIR, 'kit-store.json');
            const initData = fs.existsSync(localKitPath) ? fs.readFileSync(localKitPath, 'utf8') : defaultKits;
            console.log(`[Admin] Cloud file ${kitCloudPath} not found, migrating from local or default...`);
            await storeClient.put(kitCloudPath, Buffer.from(initData, 'utf8'));
            kitsData = initData;
          } else {
            throw err;
          }
        }

        try {
          const result = await storeClient.get(skillCloudPath);
          skillsData = result.content.toString('utf8');

          // 主动迁移防护：如果云端是空列表，但本地存有历史数据，自动将本地存量数据同步推上云
          const localSkillPath = path.join(DATA_DIR, 'skill-store.json');
          if (fs.existsSync(localSkillPath)) {
            try {
              const localRaw = fs.readFileSync(localSkillPath, 'utf8');
              const localParsed = JSON.parse(localRaw);
              const cloudParsed = JSON.parse(skillsData);
              
              const localListS = localParsed?.data?.value?.localSkill || [];
              const localListM = localParsed?.data?.value?.marketplace || [];
              const cloudListS = cloudParsed?.data?.value?.localSkill || [];
              const cloudListM = cloudParsed?.data?.value?.marketplace || [];
              
              if (cloudListS.length === 0 && cloudListM.length === 0 && (localListS.length > 0 || localListM.length > 0)) {
                console.log(`[Admin] Cloud ${skillCloudPath} is empty but local has items. Automatically migrating local data to cloud...`);
                await storeClient.put(skillCloudPath, Buffer.from(localRaw, 'utf8'));
                skillsData = localRaw;
              }
            } catch (migErr) {
              console.warn(`[Migration] Check skill migration failed:`, migErr.message);
            }
          }
        } catch (err) {
          if (err.name === 'NoSuchKeyError' || err.code === 'NoSuchKey') {
            // 优先读取本地历史数据作为初始化内容，实现无缝上云
            const localSkillPath = path.join(DATA_DIR, 'skill-store.json');
            const initData = fs.existsSync(localSkillPath) ? fs.readFileSync(localSkillPath, 'utf8') : defaultSkills;
            console.log(`[Admin] Cloud file ${skillCloudPath} not found, migrating from local or default...`);
            await storeClient.put(skillCloudPath, Buffer.from(initData, 'utf8'));
            skillsData = initData;
          } else {
            throw err;
          }
        }
      } else {
        // 本地降级回退
        const kitPath = path.join(DATA_DIR, 'kit-store.json');
        const skillPath = path.join(DATA_DIR, 'skill-store.json');
        kitsData = fs.existsSync(kitPath) ? fs.readFileSync(kitPath, 'utf8') : defaultKits;
        skillsData = fs.existsSync(skillPath) ? fs.readFileSync(skillPath, 'utf8') : defaultSkills;
      }

      return sendJson(res, {
        success: true,
        kits: JSON.parse(kitsData),
        skills: JSON.parse(skillsData),
      });
    } catch (err) {
      console.error('[Admin] Get data failed:', err);
      return sendJson(res, { success: false, error: `拉取数据失败: ${err.message}` }, 500);
    }
  }

  // 4. API - 保存修改
  if (pathname === '/api/save' && req.method === 'POST') {
    try {
      const { type, payload } = await readJsonBody(req);
      if (type !== 'kits' && type !== 'skills') {
        return sendJson(res, { success: false, error: '不支持的数据类型' }, 400);
      }

      const fileName = type === 'kits' ? 'kit-store.json' : 'skill-store.json';
      const cloudPath = `heyclaw/server-assets/${fileName}`;
      const contentStr = JSON.stringify(payload, null, 2);

      // 安全机制：在保存覆盖云端数据前，先创建一份本地的带时间戳历史备份
      await createCloudBackup(fileName);

      if (storeClient) {
        // 写入新数据到 OSS
        await storeClient.put(cloudPath, Buffer.from(contentStr, 'utf8'));
        console.log(`[Admin] Successfully updated cloud file ${cloudPath}.`);
      } else {
        // 本地降级写入
        const targetPath = path.join(DATA_DIR, fileName);
        fs.writeFileSync(targetPath, contentStr, 'utf8');
        console.log(`[Admin] Successfully updated local file ${fileName}.`);
      }

      return sendJson(res, { success: true });
    } catch (err) {
      console.error('[Admin] Save data failed:', err);
      return sendJson(res, { success: false, error: `保存失败: ${err.message}` }, 500);
    }
  }

  // 5. API - 列出历史备份
  if (pathname === '/api/backups' && req.method === 'GET') {
    try {
      if (storeClient) {
        // 从 OSS 顺序列出指定前缀下的所有文件
        const prefix = 'heyclaw/server-assets/backups/';
        const result = await storeClient.list({
          prefix: prefix,
          'max-keys': 100
        });

        const files = (result.objects || [])
          .map((obj) => {
            const fileName = path.basename(obj.name);
            return {
              fileName: fileName,
              size: obj.size,
              createdAt: new Date(obj.lastModified).getTime(),
              type: fileName.startsWith('kit-store') ? 'kits' : 'skills',
            };
          })
          .filter(file => file.fileName.endsWith('.json'))
          .sort((a, b) => b.createdAt - a.createdAt); // 按时间倒序

        return sendJson(res, { success: true, backups: files });
      } else {
        // 本地降级模式获取列表
        const files = fs.existsSync(BACKUP_DIR)
          ? fs.readdirSync(BACKUP_DIR)
              .filter((file) => file.endsWith('.json'))
              .map((file) => {
                const filePath = path.join(BACKUP_DIR, file);
                const stat = fs.statSync(filePath);
                return {
                  fileName: file,
                  size: stat.size,
                  createdAt: stat.mtimeMs,
                  type: file.startsWith('kit-store') ? 'kits' : 'skills',
                };
              })
              .sort((a, b) => b.createdAt - a.createdAt)
          : [];
        return sendJson(res, { success: true, backups: files });
      }
    } catch (err) {
      return sendJson(res, { success: false, error: `获取备份列表失败: ${err.message}` }, 500);
    }
  }

  // 6. API - 恢复备份
  if (pathname === '/api/restore' && req.method === 'POST') {
    try {
      const { fileName } = await readJsonBody(req);
      if (!fileName || !fileName.endsWith('.json')) {
        return sendJson(res, { success: false, error: '非法的备份文件名' }, 400);
      }

      // 区分类型，并替换目标文件
      const type = fileName.startsWith('kit-store') ? 'kits' : 'skills';
      const targetName = type === 'kits' ? 'kit-store.json' : 'skill-store.json';
      
      // 1. 安全锁：恢复之前，再次对当前最新的云端版本做一次快照备份，防备二次覆盖搞丢
      const secureBackup = await createCloudBackup(targetName);

      if (storeClient) {
        const cloudBackupPath = `heyclaw/server-assets/backups/${fileName}`;
        const cloudTargetPath = `heyclaw/server-assets/${targetName}`;
        
        // 从云端备份读取内容，并覆盖云端目标文件
        const result = await storeClient.get(cloudBackupPath);
        await storeClient.put(cloudTargetPath, result.content);
        console.log(`[Admin] Restored cloud ${targetName} from cloud backup ${fileName}. Safe snapshot: ${secureBackup}`);
      } else {
        // 本地降级模式的物理拷贝
        const sourcePath = path.join(BACKUP_DIR, fileName);
        if (!fs.existsSync(sourcePath)) {
          return sendJson(res, { success: false, error: '备份文件不存在' }, 404);
        }
        const targetPath = path.join(DATA_DIR, targetName);
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`[Admin] Restored local ${targetName} from backup ${fileName}. Safe snapshot: ${secureBackup}`);
      }

      return sendJson(res, { success: true, safetyBackupCreated: secureBackup });
    } catch (err) {
      console.error('[Admin] Restore backup failed:', err);
      return sendJson(res, { success: false, error: `回退失败: ${err.message}` }, 500);
    }
  }

  // 6.5. API - 查看备份文件内容
  if (pathname === '/api/backup-content' && req.method === 'GET') {
    try {
      const fileName = urlObj.searchParams.get('filename');
      if (!fileName || !fileName.endsWith('.json')) {
        return sendJson(res, { success: false, error: '非法的备份文件名' }, 400);
      }

      let contentStr = '';
      if (storeClient) {
        const cloudBackupPath = `heyclaw/server-assets/backups/${fileName}`;
        const result = await storeClient.get(cloudBackupPath);
        contentStr = result.content.toString('utf8');
      } else {
        const localPath = path.join(BACKUP_DIR, fileName);
        if (!fs.existsSync(localPath)) {
          return sendJson(res, { success: false, error: '备份文件不存在' }, 404);
        }
        contentStr = fs.readFileSync(localPath, 'utf8');
      }

      return sendJson(res, { success: true, content: JSON.parse(contentStr) });
    } catch (err) {
      console.error('[Admin] Get backup content failed:', err);
      return sendJson(res, { success: false, error: `读取备份内容失败: ${err.message}` }, 500);
    }
  }

  // 7. API - 二进制直接流式上传文件 (支持 Zip 及常见图标图片，直传至 OSS)
  if ((pathname === '/api/upload-zip' || pathname === '/api/upload-file') && req.method === 'POST') {
    const rawFileName = urlObj.searchParams.get('filename');
    if (!rawFileName) {
      return sendJson(res, { success: false, error: '请提供文件名' }, 400);
    }

    const allowedExts = ['.zip', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
    const ext = path.extname(rawFileName).toLowerCase();
    if (!allowedExts.includes(ext)) {
      return sendJson(res, { success: false, error: '不支持的文件类型，仅支持上传 .zip 及常用图片图标' }, 400);
    }

    // 防路径穿越，只保留文件名基本信息并附加时间戳防重名冲突
    const safeBaseName = path.basename(rawFileName);
    const fileExt = path.extname(safeBaseName);
    const nameWithoutExt = path.basename(safeBaseName, fileExt);
    const uniqueFileName = `${nameWithoutExt}-${Date.now()}${fileExt}`;
    const cloudFilePath = `heyclaw/server-assets/zip-bundles/${uniqueFileName}`;

    if (storeClient) {
      try {
        // 使用 ali-oss 提供的 putStream 接口直接将请求可读流 Pipe 传输到 OSS
        const ossResult = await storeClient.putStream(cloudFilePath, req);
        
        // 优先使用配置的 CDN 域名，否则回退为 OSS 自身的访问 URL
        const finalUrl = CDN_PREFIX 
          ? `${CDN_PREFIX}/heyclaw/server-assets/zip-bundles/${uniqueFileName}`
          : ossResult.url;

        console.log(`[Admin] Successfully uploaded asset to cloud: ${cloudFilePath}, URL: ${finalUrl}`);
        return sendJson(res, { success: true, url: finalUrl });
      } catch (uploadErr) {
        console.error('[Admin] Cloud upload stream failed:', uploadErr);
        return sendJson(res, { success: false, error: `流式上传云端失败: ${uploadErr.message}` }, 500);
      }
    } else {
      // 本地降级写入
      const targetFilePath = path.join(ASSETS_DIR, uniqueFileName);
      const writeStream = fs.createWriteStream(targetFilePath);
      req.pipe(writeStream);

      writeStream.on('finish', () => {
        const relativeUrl = `/zip-bundles/${uniqueFileName}`;
        console.log(`[Admin] Successfully uploaded asset locally to: ${targetFilePath}`);
        return sendJson(res, { success: true, url: relativeUrl });
      });

      writeStream.on('error', (err) => {
        console.error('[Admin] File upload write error:', err);
        return sendJson(res, { success: false, error: `写入文件出错: ${err.message}` }, 500);
      });
    }
    return;
  }

  // 8. 静态托管 React 客户端（如果未匹配任何 API）
  if (!pathname.startsWith('/api/')) {
    const distPath = path.join(__dirname, 'dist', pathname);
    return serveStaticFile(res, distPath);
  }

  // API 404
  res.writeHead(404);
  res.end('Not Found');
});

// 监听端口
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` HeyClaw Cloud Admin System is running on port ${PORT}`);
  console.log(` Mode: Native Node.js Zero-Dependency Server`);
  console.log(` Data Directory: ${DATA_DIR}`);
  console.log(` Backups Directory: ${BACKUP_DIR}`);
  console.log(` Zip Assets Directory: ${ASSETS_DIR}`);
  console.log(`====================================================`);
});
