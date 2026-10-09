// Builds the published site into docs/ (served by GitHub Pages at https://calendar.navigart.net/):
//   docs/oceansailing-calendar.js   the web component, CSS inlined, API key masked. Readable on purpose (no minifying), so it can be debugged in the browser.
//   docs/index.html                 copy of src/index.html: the calendar as a standalone page and as iframe content.
//   docs/test-events.json           test events for test mode (script URL with ?test): real club events snapshot + synthetic edge cases. Shipped on purpose; the component file holds no test data.
//   docs/test.html                  copy of src/test.html: embed test page (component directly + iframe with auto-height).
//   docs/version.txt                the release version, generated from package.json "version"; lets anyone check what is deployed.
//
//   npm run build                   prints the key only as AIza…abcd
//   npm run build:show-key          prints the plain key (local use only; never in CI, logs or commits)
//
// The API key is part of the source: src/oceansailing-calendar.js holds it XOR-masked + base64 encoded (camouflage against
// secret scanners, NOT encryption). The build checks that the shipped decoder turns the shipped value into something that looks
// like a Google API key, and that the plain key is in none of the output files.
// The output is deterministic (no timestamps), so rebuilding without changes produces no git diff.
// docs/ contains only these files plus the hand-maintained CNAME; the build deletes anything else there.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { sampleEvents } from '../dev/fixtures/sample-events.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8').replace(/\r\n/g, '\n');

const templateLiteral = (s) => '`' + s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';

export function build() {
  let js = read('src/oceansailing-calendar.js');
  const css = read('src/oceansailing-calendar.css').trim();

  if (!js.includes("'/*CSS*/'")) { throw new Error('CSS placeholder missing in src/oceansailing-calendar.js'); }
  js = js.replace("'/*CSS*/'", () => templateLiteral(css));

  new vm.Script(js, { filename: 'oceansailing-calendar.js' }); // syntax check

  // Validate what is actually shipped: run its own unmask() on its own masked value.
  const salt = js.match(/var MASK = '([^']+)';/)[1];
  const shippedMasked = js.match(/var API_KEY_MASKED = '([^']+)';/)[1];
  const unmask = new Function('atob', js.match(/function unmask\([\s\S]*?\n  \}/)[0] + '\nreturn unmask;')(atob);
  const decoded = unmask(shippedMasked, salt);
  if (!/^AIza[A-Za-z0-9_-]{35}$/.test(decoded)) { throw new Error('API_KEY_MASKED does not decode to a Google API key (see npm run mask)'); }

  const version = JSON.parse(read('package.json')).version;
  if (!/^\d+\.\d+\.\d+$/.test(version)) { throw new Error('package.json "version" must look like 0.1.0'); }

  const files = { 'oceansailing-calendar.js': js, 'index.html': read('src/index.html'), 'test-events.json': buildTestEvents(), 'test.html': read('src/test.html'), 'version.txt': version + '\n' };
  for (const [name, content] of Object.entries(files)) {
    if (content.includes(decoded)) { throw new Error('Plain key found in output: ' + name); }
  }

  return { files, decoded };
}

function buildTestEvents() {
  const real = JSON.parse(read('dev/fixtures/real-events.json')).items;
  return JSON.stringify([...real, ...sampleEvents]) + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const { files, decoded } = build();
    mkdirSync(join(root, 'docs'), { recursive: true });
    // docs/ holds only the generated files plus the hand-maintained CNAME; anything else is stale and removed.
    for (const name of readdirSync(join(root, 'docs'))) {
      if (name !== 'CNAME' && !(name in files)) { rmSync(join(root, 'docs', name), { recursive: true }); console.log('removed stale docs/' + name); }
    }
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(root, 'docs', name), content);
      console.log(('docs/' + name).padEnd(40) + content.length + ' chars');
    }
    const shown = process.argv.includes('--show-key') ? decoded : decoded.slice(0, 4) + '…' + decoded.slice(-4);
    console.log('Key decoded from the built file: ' + shown + (shown === decoded ? '' : '  (npm run build:show-key for the full value)'));
  } catch (e) {
    console.error('Build failed: ' + e.message);
    process.exit(1);
  }
}
