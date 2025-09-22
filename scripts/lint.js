#!/usr/bin/env node
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function collectFiles(dir, results = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectFiles(full, results);
    } else if (full.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

const files = collectFiles(new URL('../src', import.meta.url).pathname);
let hasIssue = false;
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  if (/\bconsole\.log\b/.test(content)) {
    console.error(`Lint: console.log found in ${file}`);
    hasIssue = true;
  }
}
if (hasIssue) {
  process.exit(1);
}
console.log(`Lint passed for ${files.length} files.`);
