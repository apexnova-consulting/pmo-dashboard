import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const pattern = /VITE_[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|KEY)/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === 'dist' || name === '.git') return [];
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return [full];
  });
}

const hits: string[] = [];
for (const file of files(process.cwd())) {
  if (!/\.(ts|tsx|js|mjs|json|md|yml|yaml|example|css)$/.test(file)) continue;
  if (file.endsWith('scripts/check-vite-secrets.ts')) continue;
  const text = readFileSync(file, 'utf8');
  if (pattern.test(text)) hits.push(path.relative(process.cwd(), file));
}

if (hits.length > 0) {
  console.error(`Client env names must not carry secrets:\n${hits.join('\n')}`);
  process.exit(1);
}

console.log('No secret-like VITE_ names.');
