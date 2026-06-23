const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 配置参数 (支持环境变量覆盖)
const PORT = process.env.PORT || 8082;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'HeyClawAdmin123';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../server-assets');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, 'backups');
const ASSETS_DIR = process.env.ASSETS_DIR || path.join(DATA_DIR, 'zip-bundles');

// 确保目录存在
[DATA_DIR, BACKUP_DIR, ASSETS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

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

// 清理超过一个月的历史备份
function cleanExpiredBackups() {
  try {
    const now = Date.now();
    const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
    if (!fs.existsSync(BACKUP_DIR)) return;
    const files = fs.readdirSync(BACKUP_DIR);
    files.forEach((file) => {
      if (file.endsWith('.json')) {
        const filePath = path.join(BACKUP_DIR, file);
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > ONE_MONTH_MS) {
          fs.unlinkSync(filePath);
          console.log(`[Admin] Cleaned expired backup file: ${file}`);
        }
      }
    });
  } catch (err) {
    console.error('[Admin] Clean expired backups failed:', err);
  }
}

// 每日定时备份函数
function checkAndPerformDailyBackup() {
  const date = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const today = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  if (lastBackupDate === today) return; // 今天已经备份过

  try {
    ['kit-store.json', 'skill-store.json'].forEach((fileName) => {
      const sourcePath = path.join(DATA_DIR, fileName);
      if (fs.existsSync(sourcePath)) {
        const baseName = path.basename(fileName, '.json');
        const backupName = `${baseName}.${today}.bak.json`;
        const targetPath = path.join(BACKUP_DIR, backupName);
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`[Admin] Daily backup created: ${backupName}`);
      }
    });
    lastBackupDate = today;

    // 清除过期备份
    cleanExpiredBackups();
  } catch (err) {
    console.error('[Admin] Daily backup failed:', err);
  }
}

// 每小时轮询一次
setInterval(checkAndPerformDailyBackup, 60 * 60 * 1000);
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

// 备份逻辑
function createBackup(fileName) {
  const sourcePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(sourcePath)) return null;

  const baseName = path.basename(fileName, '.json');
  const backupName = `${baseName}.${formatTimestamp()}.bak.json`;
  const targetPath = path.join(BACKUP_DIR, backupName);
  
  fs.copyFileSync(sourcePath, targetPath);
  return backupName;
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
    const kitPath = path.join(DATA_DIR, 'kit-store.json');
    const skillPath = path.join(DATA_DIR, 'skill-store.json');

    const kitsData = fs.existsSync(kitPath) ? fs.readFileSync(kitPath, 'utf8') : '{"data":{"value":{"kits":[]}}}';
    const skillsData = fs.existsSync(skillPath) ? fs.readFileSync(skillPath, 'utf8') : '{"data":{"value":{"localSkill":[],"marketplace":[],"marketTags":[]}}}';

    return sendJson(res, {
      success: true,
      kits: JSON.parse(kitsData),
      skills: JSON.parse(skillsData),
    });
  }

  // 4. API - 保存修改
  if (pathname === '/api/save' && req.method === 'POST') {
    try {
      const { type, payload } = await readJsonBody(req);
      if (type !== 'kits' && type !== 'skills') {
        return sendJson(res, { success: false, error: '不支持的数据类型' }, 400);
      }

      const fileName = type === 'kits' ? 'kit-store.json' : 'skill-store.json';
      const targetPath = path.join(DATA_DIR, fileName);

      // 写入新数据
      fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf8');

      console.log(`[Admin] Successfully updated ${fileName}.`);
      return sendJson(res, { success: true });
    } catch (err) {
      return sendJson(res, { success: false, error: `保存失败: ${err.message}` }, 500);
    }
  }

  // 5. API - 列出历史备份
  if (pathname === '/api/backups' && req.method === 'GET') {
    try {
      const files = fs.readdirSync(BACKUP_DIR)
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
        .sort((a, b) => b.createdAt - a.createdAt); // 按时间倒序

      return sendJson(res, { success: true, backups: files });
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

      const sourcePath = path.join(BACKUP_DIR, fileName);
      if (!fs.existsSync(sourcePath)) {
        return sendJson(res, { success: false, error: '备份文件不存在' }, 404);
      }

      // 区分类型，并替换目标文件
      const type = fileName.startsWith('kit-store') ? 'kits' : 'skills';
      const targetName = type === 'kits' ? 'kit-store.json' : 'skill-store.json';
      const targetPath = path.join(DATA_DIR, targetName);

      // 安全锁：恢复之前，对当前最新的错误版本也做一次物理备份，防止二次覆盖彻底搞丢
      const secureBackup = createBackup(targetName);

      fs.copyFileSync(sourcePath, targetPath);

      console.log(`[Admin] Restored ${targetName} from ${fileName}. Safety backup created: ${secureBackup}`);
      return sendJson(res, { success: true, safetyBackupCreated: secureBackup });
    } catch (err) {
      return sendJson(res, { success: false, error: `回退失败: ${err.message}` }, 500);
    }
  }

  // 7. API - 二进制直接流式上传文件 (支持 Zip 及常见图标图片)
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

    // 防路径穿越，只保留文件名基本信息
    const safeBaseName = path.basename(rawFileName);
    const targetFilePath = path.join(ASSETS_DIR, safeBaseName);

    const writeStream = fs.createWriteStream(targetFilePath);
    req.pipe(writeStream);

    writeStream.on('finish', () => {
      // 生成外部下载相对链接
      const relativeUrl = `/zip-bundles/${safeBaseName}`;
      console.log(`[Admin] Successfully uploaded asset to: ${targetFilePath}`);
      return sendJson(res, { success: true, url: relativeUrl });
    });

    writeStream.on('error', (err) => {
      console.error('[Admin] File upload write error:', err);
      return sendJson(res, { success: false, error: `写入文件出错: ${err.message}` }, 500);
    });
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
