import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function luminance(hex: string) {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((index) => {
    const channel = Number.parseInt(value.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return ((hi ?? 1) + 0.05) / ((lo ?? 0) + 0.05);
}

function vars(block: string) {
  const found: Record<string, string> = {};
  for (const match of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    if (match[1] && match[2]) found[match[1]] = match[2];
  }
  return found;
}

describe('brand contrast', () => {
  const css = readFileSync(path.resolve('src/styles/tokens.css'), 'utf8');
  const light = vars(css.split(":root[data-theme='dark']")[0] ?? css);
  const dark = vars(css.split(":root[data-theme='dark']")[1] ?? '');

  it('meets WCAG AA for text and UI pairs in both themes', () => {
    const pairs: [Record<string, string>, string, string, number][] = [
      [light, 'text', 'bg-page', 4.5],
      [light, 'text', 'bg-card', 4.5],
      [light, 'text-muted', 'bg-page', 4.5],
      [light, 'text-muted', 'bg-card', 4.5],
      [light, 'link', 'bg-page', 4.5],
      [light, 'link', 'bg-card', 4.5],
      [light, 'header-fg', 'header-bg', 4.5],
      [light, 'rag-red', 'rag-red-bg', 4.5],
      [light, 'rag-amber', 'rag-amber-bg', 4.5],
      [light, 'rag-green', 'rag-green-bg', 4.5],
      [light, 'brand-purple', 'bg-page', 3],
      [dark, 'text', 'bg-page', 4.5],
      [dark, 'text', 'bg-card', 4.5],
      [dark, 'text-muted', 'bg-page', 4.5],
      [dark, 'text-muted', 'bg-card', 4.5],
      [dark, 'link', 'bg-page', 4.5],
      [dark, 'rag-red', 'rag-red-bg', 4.5],
      [dark, 'rag-amber', 'rag-amber-bg', 4.5],
      [dark, 'rag-green', 'rag-green-bg', 4.5],
      [dark, 'brand-purple', 'bg-page', 3],
    ];
    for (const [source, fg, bg, minimum] of pairs) {
      const foreground = source[fg];
      const background = source[bg];
      expect(foreground, fg).toBeTruthy();
      expect(background, bg).toBeTruthy();
      expect(
        contrast(foreground ?? '#000000', background ?? '#ffffff'),
        `${fg} on ${bg}`,
      ).toBeGreaterThanOrEqual(minimum);
    }
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith('.tsx') ? [full] : [];
  });
}

describe('color tokens', () => {
  it('keeps hex colors out of components', () => {
    const roots = ['src/components', 'src/features', 'src/app'].map((dir) => path.resolve(dir));
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of walk(root)) {
        const text = readFileSync(file, 'utf8');
        if (/#[0-9A-Fa-f]{3,8}\b/.test(text)) offenders.push(path.relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
