#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const math = await import(resolve(__dirname, '../src/math.js'));
const solver = await import(resolve(__dirname, '../src/TransformSolver.js'));

const results = [];

function test(name, fn) {
  try {
    fn();
    results.push({ name, status: 'passed' });
  } catch (error) {
    results.push({ name, status: 'failed', error });
  }
}

test('vector normalization', () => {
  const v = math.normalize({ x: 3, y: 4, z: 0 });
  assert.ok(Math.abs(v.x - 0.6) < 1e-12);
  assert.ok(Math.abs(v.y - 0.8) < 1e-12);
  assert.equal(v.z, 0);
});

test('matrix TRS decomposition', () => {
  const translation = { x: 10, y: -4, z: 3 };
  const rotation = math.fromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 4);
  const scale = { x: 2, y: 3, z: 4 };
  const matrix = math.composeTransform(translation, rotation, scale);
  const decomposed = math.decomposeTransform(matrix);
  assert.ok(math.equalsEpsilon(decomposed.translation, translation, 1e-9));
  assert.ok(math.equalsQuaternion(decomposed.rotation, rotation, 1e-9));
  assert.ok(math.equalsEpsilon(decomposed.scale, scale, 1e-9));
});

test('axis drag translation delta', () => {
  const axis = math.normalize({ x: 1, y: 0, z: 0 });
  const pivot = { x: 0, y: 0, z: 0 };
  const startRay = { origin: { x: 0, y: 0, z: 10 }, direction: math.normalize({ x: 0, y: 0, z: -1 }) };
  const currentRay = { origin: { x: 1, y: 0, z: 10 }, direction: math.normalize({ x: 0, y: 0, z: -1 }) };
  const session = solver.beginAxisTranslation({ axis, pivot, startRay, cameraDirection: { x: 0, y: 0, z: -1 } });
  const delta = solver.updateAxisTranslation(session, currentRay);
  assert.ok(Math.abs(delta.distance - 1) < 1e-6);
  assert.ok(math.equalsEpsilon(delta.vector, { x: 1, y: 0, z: 0 }, 1e-6));
});

let failed = 0;
for (const result of results) {
  if (result.status === 'failed') {
    failed++;
    console.error(`\u274c ${result.name}`);
    console.error(result.error);
  } else {
    console.log(`\u2705 ${result.name}`);
  }
}

if (failed) {
  console.error(`\n${failed} test(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${results.length} tests passed.`);
