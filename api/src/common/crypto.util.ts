import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/**
 * Deriva una clave de 32 bytes a partir del secreto de entorno.
 * Usar una clave estable garantiza que se pueda descifrar lo previamente cifrado.
 */
function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

/**
 * Cifra un texto con AES-256-GCM.
 * Devuelve un string con formato: iv:authTag:cipherText (todos en base64).
 */
export function encrypt(plainText: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Descifra un texto producido por encrypt().
 */
export function decrypt(payload: string, secret: string): string {
  const key = deriveKey(secret);
  const [ivB64, authTagB64, dataB64] = payload.split(':');

  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error('Formato de dato cifrado inválido');
  }

  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(dataB64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
