const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

// 确保主进程在准备就绪后运行
app.whenReady().then(() => {
  // 创建一个隐藏的窗口用于利用 Chromium 的 Canvas 环境
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const logoPath = path.resolve(__dirname, '..', 'public', 'logo.png');
  const outputDir = path.resolve(__dirname, '..', 'resources', 'tray');

  if (!fs.existsSync(logoPath)) {
    console.error(`未找到 logo 源文件: ${logoPath}`);
    app.quit();
    process.exit(1);
  }

  const logoBase64 = fs.readFileSync(logoPath).toString('base64');

  // 构建要在 BrowserWindow 中执行 of HTML/JS 代码
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"/></head>
    <body>
      <script>
        const fs = require('fs');
        const path = require('path');
        const { ipcRenderer } = require('electron');

        const logoBase64 = ${JSON.stringify(logoBase64)};
        const outputDir = ${JSON.stringify(outputDir)};

        // 将 logo 内容加载为 Image
        const img = new Image();
        img.src = 'data:image/png;base64,' + logoBase64;
        img.onload = () => {
          try {
            // 确保输出目录存在
            fs.mkdirSync(outputDir, { recursive: true });

            // 1. 创建临时的原图 Canvas
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(img, 0, 0);

            // 2. 生成 tray-icon-mac.png (18x18，内部 15x15 居中)
            const canvasMac = document.createElement('canvas');
            canvasMac.width = 18;
            canvasMac.height = 18;
            const ctxMac = canvasMac.getContext('2d');
            ctxMac.drawImage(tempCanvas, 1.5, 1.5, 15, 15);
            const macBuffer = getPngBuffer(canvasMac);
            fs.writeFileSync(path.join(outputDir, 'tray-icon-mac.png'), macBuffer);

            // 3. 生成 tray-icon-mac@2x.png (36x36，内部 30x30 居中)
            const canvasMac2x = document.createElement('canvas');
            canvasMac2x.width = 36;
            canvasMac2x.height = 36;
            const ctxMac2x = canvasMac2x.getContext('2d');
            ctxMac2x.drawImage(tempCanvas, 3, 3, 30, 30);
            const mac2xBuffer = getPngBuffer(canvasMac2x);
            fs.writeFileSync(path.join(outputDir, 'tray-icon-mac@2x.png'), mac2xBuffer);

            // 4. 生成 tray-icon.png (48x48，内部 40x40 居中)
            const canvasLinux = document.createElement('canvas');
            canvasLinux.width = 48;
            canvasLinux.height = 48;
            const ctxLinux = canvasLinux.getContext('2d');
            ctxLinux.drawImage(tempCanvas, 4, 4, 40, 40);
            const linuxBuffer = getPngBuffer(canvasLinux);
            fs.writeFileSync(path.join(outputDir, 'tray-icon.png'), linuxBuffer);

            // 5. 生成 Windows tray-icon.ico (包含 16x16, 32x32, 48x48)
            const canvas16 = document.createElement('canvas');
            canvas16.width = 16;
            canvas16.height = 16;
            canvas16.getContext('2d').drawImage(tempCanvas, 1, 1, 14, 14);

            const canvas32 = document.createElement('canvas');
            canvas32.width = 32;
            canvas32.height = 32;
            canvas32.getContext('2d').drawImage(tempCanvas, 2, 2, 28, 28);

            const canvas48 = document.createElement('canvas');
            canvas48.width = 48;
            canvas48.height = 48;
            canvas48.getContext('2d').drawImage(tempCanvas, 4, 4, 40, 40);

            const icoBuffers = [
              { size: 16, data: getPngBuffer(canvas16) },
              { size: 32, data: getPngBuffer(canvas32) },
              { size: 48, data: getPngBuffer(canvas48) }
            ];

            const icoBuffer = generateIco(icoBuffers);
            fs.writeFileSync(path.join(outputDir, 'tray-icon.ico'), icoBuffer);

            console.log('✓ 系统托盘图标生成成功！');
            ipcRenderer.send('done', { success: true });
          } catch (e) {
            console.error('❌ 生成托盘图标出错:', e);
            ipcRenderer.send('done', { success: false, error: e.message });
          }
        };

        function getPngBuffer(canvas) {
          const dataUrl = canvas.toDataURL('image/png');
          return Buffer.from(dataUrl.split(',')[1], 'base64');
        }

        function generateIco(buffers) {
          const count = buffers.length;
          const headerSize = 6;
          const entrySize = 16;
          const dataOffset0 = headerSize + entrySize * count;

          let currentOffset = dataOffset0;
          const entries = buffers.map(({ size, data }) => {
            const entry = {
              width: size >= 256 ? 0 : size,
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

          icoBuffer.writeUInt16LE(0, 0); // 保留字
          icoBuffer.writeUInt16LE(1, 2); // 1 代表 ICO 格式
          icoBuffer.writeUInt16LE(count, 4); // 包含的图片数量

          entries.forEach((e, i) => {
            const off = headerSize + i * entrySize;
            icoBuffer.writeUInt8(e.width, off + 0);
            icoBuffer.writeUInt8(e.height, off + 1);
            icoBuffer.writeUInt8(0, off + 2);
            icoBuffer.writeUInt8(0, off + 3);
            icoBuffer.writeUInt16LE(1, off + 4);
            icoBuffer.writeUInt16LE(32, off + 6);
            icoBuffer.writeUInt32LE(e.dataSize, off + 8);
            icoBuffer.writeUInt32LE(e.offset, off + 12);
          });

          entries.forEach(e => {
            e.data.copy(icoBuffer, e.offset);
          });

          return icoBuffer;
        }
      </script>
    </body>
    </html>
  `;

  // 用 loadURL 加载这段 HTML 并处理 IPC
  const { ipcMain } = require('electron');
  ipcMain.once('done', (event, res) => {
    if (!res.success) {
      console.error('渲染托盘图标失败:', res.error);
      process.exit(1);
    }
    app.quit();
  });

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
});
