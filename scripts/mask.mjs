// Prints the masked form of an API key, to paste into API_KEY_MASKED in src/oceansailing-calendar.js:
//   npm run mask -- <google api key>
// The mask word must stay equal to MASK in the component. This is camouflage, not encryption.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src/oceansailing-calendar.js'), 'utf8');
const mask = src.match(/var MASK = '([^']+)';/)[1];
const key = process.argv[2] || '';
if (!/^AIza[A-Za-z0-9_-]{35}$/.test(key)) {
  console.error('Usage: npm run mask -- <google api key>   (a Google API key starts with AIza and has 39 characters)');
  process.exit(1);
}
console.log(Buffer.from(Array.from(Buffer.from(key, 'latin1'), (c, i) => c ^ mask.charCodeAt(i % mask.length))).toString('base64'));
