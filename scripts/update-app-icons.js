const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 定义源图标与目标路径
const SOURCE_IMAGE = '/Users/xubingxiong/.gemini/antigravity-ide/brain/342ef627-33ae-4e6d-b47a-91e1cab992b7/media__1781857092259.png';
const PUBLIC_LOGO = path.join(__dirname, '..', 'public', 'logo.png');
const PNG_DIR = path.join(__dirname, '..', 'build', 'icons', 'png');
const MAC_DIR = path.join(__dirname, '..', 'build', 'icons', 'mac');
const WIN_DIR = path.join(__dirname, '..', 'build', 'icons', 'win');
const TMP_DIR = path.join(__dirname, '..', 'build', 'icons', '_tmp_build');

// 确保目录存在
fs.mkdirSync(PNG_DIR, { recursive: true });
fs.mkdirSync(MAC_DIR, { recursive: true });
fs.mkdirSync(WIN_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

console.log('🚀 开始更新品牌图标资源...');

// 1. 拷贝源图片到 public/logo.png
if (fs.existsSync(SOURCE_IMAGE)) {
  fs.copyFileSync(SOURCE_IMAGE, PUBLIC_LOGO);
  console.log('✓ 成功更新前端展示图 public/logo.png');
} else {
  console.error(`❌ 未找到源图片文件: ${SOURCE_IMAGE}`);
  process.exit(1);
}

// 2. 生成各个大小的打包 PNG 图标
const pngSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
pngSizes.forEach(size => {
  const targetPath = path.join(PNG_DIR, `${size}x${size}.png`);
  execSync(`sips -z ${size} ${size} "${PUBLIC_LOGO}" --out "${targetPath}"`, { stdio: 'ignore' });
  console.log(`✓ 已生成打包 PNG 图标: ${size}x${size}.png`);
});

// 3. 生成 macOS 专用的 icon.icns 图标
const iconsetPath = path.join(TMP_DIR, 'icon.iconset');
fs.mkdirSync(iconsetPath, { recursive: true });

const macSizes = [
  { size: 16, name: 'icon_16x16.png' },
  { size: 32, name: 'icon_16x16@2x.png' },
  { size: 32, name: 'icon_32x32.png' },
  { size: 64, name: 'icon_32x32@2x.png' },
  { size: 128, name: 'icon_128x128.png' },
  { size: 256, name: 'icon_128x128@2x.png' },
  { size: 256, name: 'icon_256x256.png' },
  { size: 512, name: 'icon_256x256@2x.png' },
  { size: 512, name: 'icon_512x512.png' },
  { size: 1024, name: 'icon_512x512@2x.png' }
];

macSizes.forEach(item => {
  const targetPath = path.join(iconsetPath, item.name);
  const innerSize = Math.round(item.size * 0.72);
  execSync(`sips -z ${innerSize} ${innerSize} "${PUBLIC_LOGO}" --out "${targetPath}"`, { stdio: 'ignore' });
  execSync(`sips -p ${item.size} ${item.size} "${targetPath}" --out "${targetPath}"`, { stdio: 'ignore' });
});

const icnsDest = path.join(MAC_DIR, 'icon.icns');
try {
  execSync(`iconutil -c icns "${iconsetPath}" -o "${icnsDest}"`);
  console.log('✓ 成功生成 macOS 专属 icon.icns 图标');
} catch (e) {
  console.error('❌ 生成 macOS icon.icns 失败:', e.message);
}

// 4. 生成 Windows 专用的 icon.ico 图标
const icoSizes = [256, 128, 64, 48, 32, 16];
const pngBuffers = icoSizes.map(size => {
  const tmpPngPath = path.join(TMP_DIR, `icon_${size}.png`);
  execSync(`sips -z ${size} ${size} "${PUBLIC_LOGO}" --out "${tmpPngPath}"`, { stdio: 'ignore' });
  return { size, data: fs.readFileSync(tmpPngPath) };
});

const count = pngBuffers.length;
const headerSize = 6;
const entrySize = 16;
const dataOffset0 = headerSize + entrySize * count;

let currentOffset = dataOffset0;
const entries = pngBuffers.map(({ size, data }) => {
  const entry = {
    width: size >= 256 ? 0 : size, // 256 在 ICO 格式里定义为 0
    height: size >= 256 ? 0 : size,
    dataSize: data.length,
    offset: currentOffset,
    data
  };
  currentOffset += data.length;
  return entry;
});

const totalSize = currentOffset;
const icoBuffer = Buffer.alloc(totalSize);

// 写入 ICO 头信息
icoBuffer.writeUInt16LE(0, 0); // 保留字
icoBuffer.writeUInt16LE(1, 2); // 1 代表 ICO 格式
icoBuffer.writeUInt16LE(count, 4); // 包含的图片数量

// 写入每个图片条目的元数据
entries.forEach((e, i) => {
  const off = headerSize + i * entrySize;
  icoBuffer.writeUInt8(e.width, off + 0); // 宽度
  icoBuffer.writeUInt8(e.height, off + 1); // 高度
  icoBuffer.writeUInt8(0, off + 2); // 调色板
  icoBuffer.writeUInt8(0, off + 3); // 保留字
  icoBuffer.writeUInt16LE(1, off + 4); // 颜色通道
  icoBuffer.writeUInt16LE(32, off + 6); // 每个像素占用的位数 (32位)
  icoBuffer.writeUInt32LE(e.dataSize, off + 8); // 数据大小
  icoBuffer.writeUInt32LE(e.offset, off + 12); // 数据偏移量
});

// 写入图片实际的 PNG 数据
entries.forEach(e => {
  e.data.copy(icoBuffer, e.offset);
});

const icoDest = path.join(WIN_DIR, 'icon.ico');
fs.writeFileSync(icoDest, icoBuffer);
console.log('✓ 成功生成 Windows 专属 icon.ico 图标');

// 5. 垃圾清理
try {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  console.log('🧹 临时构建缓存目录已清理干净。');
} catch (e) {
  // 忽略清理失败
}

console.log('🎉 品牌图标更新任务圆满完成！');
