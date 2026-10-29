import { mkdirSync, writeFileSync } from 'node:fs';
import { legacyFixture } from '../src/data/mock/legacyFixture';
import { portfolioFixture } from '../src/data/mock/portfolioFixture';

mkdirSync(new URL('../src/data/mock/fixtures/', import.meta.url), { recursive: true });
writeFileSync(
  new URL('../src/data/mock/fixtures/portfolio.v2.json', import.meta.url),
  `${JSON.stringify(portfolioFixture, null, 2)}\n`,
);
writeFileSync(
  new URL('../src/data/mock/fixtures/legacy.v1.json', import.meta.url),
  `${JSON.stringify(legacyFixture, null, 2)}\n`,
);
console.log('Wrote portfolio and legacy fixtures');
