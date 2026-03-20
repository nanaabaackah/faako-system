import { randomBytes } from 'node:crypto';

const bytes = Number(process.argv[2] ?? 64);

if (!Number.isInteger(bytes) || bytes < 32) {
  console.error('Usage: node generate-secret.mjs [bytes >= 32]');
  process.exit(1);
}

console.log(randomBytes(bytes).toString('base64url'));
