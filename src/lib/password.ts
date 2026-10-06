import { randomBytes, scrypt as rawScrypt, timingSafeEqual } from 'node:crypto';
// Parâmetros compartilhados pela criação e pela conferência de senhas.
const options = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const scrypt = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) =>
    rawScrypt(password, salt, 64, options, (error, key) => (error ? reject(error) : resolve(key))),
  );
export function validPassword(password: string) {
  return password.length >= 12 && password.length <= 128;
}
export async function hashPassword(password: string): Promise<string> {
  if (!validPassword(password)) throw new Error('Use uma senha com 12 a 128 caracteres.');
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt);
  return `scrypt$${options.N}$8$1$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (password.length > 128) return false;
  const pieces = stored.split('$');
  if (
    pieces.length !== 6 ||
    pieces[0] !== 'scrypt' ||
    pieces[1] !== String(options.N) ||
    pieces[2] !== '8' ||
    pieces[3] !== '1' ||
    !/^[a-f0-9]{32}$/.test(pieces[4]) ||
    !/^[a-f0-9]{128}$/.test(pieces[5])
  )
    return false;
  const key = await scrypt(password, pieces[4]);
  return timingSafeEqual(key, Buffer.from(pieces[5], 'hex'));
}
