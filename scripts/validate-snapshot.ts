import { readFileSync } from 'node:fs';
import { formatZodIssues, Snapshot } from '../src/data/schema';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run validate:snapshot -- path/to/file.json');
  process.exit(1);
}

const result = Snapshot.safeParse(JSON.parse(readFileSync(file, 'utf8')));
if (!result.success) {
  console.error(formatZodIssues(result.error));
  process.exit(1);
}

console.log(`Valid schema version ${result.data.schemaVersion}: ${file}`);
