import { readdir, stat, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
async function walk(directory) {
  const files = [];
  for (const name of await readdir(directory)) {
    assert.match(name, /^[\x21-\x7e]+$/, `Non-ASCII or whitespace filename: ${name}`);
    assert.ok(!['node_modules', 'src', 'tests', 'sdk.js'].includes(name), `Unexpected production artifact: ${name}`);
    assert.ok(!/\.(map|log|tmp|test\.[cm]?js|md)$/.test(name), `Debug/development file in production: ${name}`);
    const file = path.join(directory, name), info = await stat(file);
    if (info.isDirectory()) files.push(...await walk(file)); else files.push({ file, bytes: info.size });
  }
  return files;
}
const files = await walk('dist');
assert.ok(files.some(f => f.file === path.join('dist', 'index.html')), 'index.html must be at archive root');
assert.equal(files.filter(f => path.basename(f.file) === 'index.html').length, 1, 'Exactly one index.html required');
const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
const scripts = (await Promise.all(files.filter(f => f.file.endsWith('.js')).map(f => readFile(f.file, 'utf8')))).join('\n');
assert.ok(scripts.includes('Курьерская Империя') && scripts.includes('Courier Empire') && scripts.includes("Where's My Cola?!"), 'Both complete translation dictionaries must ship in dist');
assert.ok(bytes < 100000000, 'Uncompressed dist must be below 100 MB');
console.log(`Yandex archive checks PASS: ${files.length} files, ${bytes} bytes (${(bytes / 1000000).toFixed(3)} MB / ${(bytes / 1048576).toFixed(3)} MiB), root index.html, ASCII names, no SDK/development files.`);
