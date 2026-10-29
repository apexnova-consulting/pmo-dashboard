import { writeFileSync } from 'node:fs';
import { toJSONSchema } from 'zod';
import { Snapshot } from '../src/data/schema';

const schema = toJSONSchema(Snapshot);
writeFileSync(
  new URL('../docs/snapshot.schema.json', import.meta.url),
  `${JSON.stringify(schema, null, 2)}\n`,
);
console.log('Wrote docs/snapshot.schema.json');
