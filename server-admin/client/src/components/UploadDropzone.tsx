import { useState } from 'react';
import { Upload, Progress, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';

// 自适应 API 端口基址
const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8082'
    : '';

interface UploadDropzoneProps {
  token: string;
  accept: string; // 例如 ".zip" 或 "image/*"
  onUploadSuccess: (url: string) => void;
  placeholderText?: string;
}

export default function UploadDropzone({
  token,
  accept,
  onUploadSuccess,
  placeholderText = '点击或拖拽文件到此区域上传'
}: UploadDropzoneProps) {
  const [percent, setPercent] = useState<number | null>(null);

  // 自定义二进制流式 XHR 上传以对接原生 Node 服务端点
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customUploadRequest = async (options: any) => {
    const { file, onSuccess, onError } = options;
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/upload-file?filename=${encodeURIComponent(file.name)}`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        setPercent(pct);
      }
    };

    xhr.onload = () => {
      setPercent(null);
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.success) {
            const finalUrl = data.url;
            onUploadSuccess(finalUrl);
            onSuccess(data);
            message.success(`${file.name} 上传成功`);
          } else {
            onError(new Error(data.error || '上传处理失败'));
            message.error(`上传处理失败: ${data.error}`);
          }
        } catch (err) {
          onError(err);
          message.error('响应解析出错');
        }
      } else {
        onError(new Error(`HTTP ${xhr.status}`));
        message.error(`上传失败 (HTTP ${xhr.status})`);
      }
    };

    xhr.onerror = () => {
      setPercent(null);
      onError(new Error('上传连接异常'));
      message.error('上传连接异常');
    };

    xhr.send(file);
  };

  const uploadProps: UploadProps = {
    accept,
    multiple: false,
    showUploadList: false,
    customRequest: customUploadRequest,
    beforeUpload(file) {
      const isZip = accept.includes('.zip');
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (isZip) {
        if (ext !== '.zip') {
          message.error('仅支持上传 .zip 文件');
          return Upload.LIST_IGNORE;
        }
      } else {
        const allowedImage = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
        if (!allowedImage.includes(ext)) {
          message.error('仅支持上传常用图片格式 (.png, .jpg, .jpeg, .gif, .svg, .webp)');
          return Upload.LIST_IGNORE;
        }
      }
      return true;
    }
  };

  return (
    <div style={{ marginTop: '8px' }}>
      <Upload.Dragger {...uploadProps}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">{placeholderText}</p>
        <p className="ant-upload-hint" style={{ fontSize: '11px', color: '#999' }}>
          支持直接流式大文件传输，后台将自动生成云端链接并回填
        </p>
      </Upload.Dragger>
      {percent !== null && (
        <Progress percent={percent} size="small" style={{ marginTop: 8 }} />
      )}
    </div>
  );
}
