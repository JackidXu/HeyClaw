import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
// 用于加解密的对称秘钥及盐（硬编码，以保护本地物理文件）
const SECRET_KEY = crypto.scryptSync('HeyClawSkillBarrierKeySecret!', 'HeyClawSalt', 32);
const IV = Buffer.alloc(16, 0); // 使用固定 IV，确保相同的明文加密结果一致

/**
 * 加密 Skill.md 内容
 */
export function encryptSkillContent(content: string): string {
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, IV);
  let encrypted = cipher.update(content, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `HEYCLAW_ENC:${encrypted}`;
}

/**
 * 解密已加密的 Skill.md 内容
 */
export function decryptSkillContent(encryptedContent: string): string {
  if (!encryptedContent.startsWith('HEYCLAW_ENC:')) {
    return encryptedContent; // 若未加密，直接返回，确保向前兼容性
  }
  const hexContent = encryptedContent.slice('HEYCLAW_ENC:'.length);
  const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, IV);
  let decrypted = decipher.update(hexContent, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
