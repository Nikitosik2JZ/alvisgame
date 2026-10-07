import { readdir, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
async function walk(directory) {
  const files = [];
  for (const name of await readdir(directory)) {
    assert.match(name, /^[\x21-\x7e]+$/, `Non-ASCII or whitespace filename: ${name}`);
    assert.ok(!['node_modules', 'src', 'tests', 'sdk.js'].includes(name), `Unexpected production artifact: ${name}`);
    const file = path.join(directory, name), info = await stat(file);
    if (info.isDirectory()) files.push(...await walk(file)); else files.push({ file, bytes: info.size });
  }
  return files;
}
const files = await walk('dist');
assert.ok(files.some(f => f.file === path.join('dist', 'index.html')), 'index.html must be at archive root');
const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
assert.ok(bytes < 100000000, 'Uncompressed dist must be below 100 MB');
console.log(`Yandex archive checks PASS: ${files.length} files, ${bytes} bytes (${(bytes / 1000000).toFixed(3)} MB / ${(bytes / 1048576).toFixed(3)} MiB), root index.html, ASCII names, no SDK/development files.`);
