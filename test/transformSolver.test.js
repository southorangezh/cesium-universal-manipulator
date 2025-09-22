import test from 'node:test';
import assert from 'node:assert/strict';
import { TransformSolver } from '../src/math/transformSolver.js';
import { Snapper } from '../src/math/snapper.js';
import { FrameBuilder } from '../src/core/frameBuilder.js';
import PivotResolver from '../src/pivot/pivotResolver.js';

function ray(origin, direction) {
  return { origin, direction };
}

test('axis translation produces expected delta', () => {
  const solver = new TransformSolver({ snapper: new Snapper({ translationStep: 0 }) });
  const state = solver.beginInteraction({
    mode: 'translate',
    handle: { type: 'axis' },
    origin: [0, 0, 0],
    axis: [1, 0, 0],
    cameraDir: [0, 0, -1],
    startRay: ray([0, 1, 0], [0, -1, 0])
  });
  const delta = solver.update(state, {
    currentRay: ray([2, 1, 0], [0, -1, 0]),
    modifiers: {}
  });
  assert.deepEqual(delta.translation.map((v) => Number(v.toFixed(6))), [2, 0, 0]);
});

test('plane translation uses both axes', () => {
  const solver = new TransformSolver({ snapper: new Snapper({ translationStep: 0 }) });
  const state = solver.beginInteraction({
    mode: 'translate',
    handle: { type: 'plane' },
    origin: [0, 0, 0],
    planeAxes: [[1, 0, 0], [0, 0, 1]],
    cameraDir: [0, 1, 0],
    startRay: ray([0, 5, 0], [0, -1, 0])
  });
  const delta = solver.update(state, {
    currentRay: ray([2, 5, 3], [0, -1, 0]),
    modifiers: {}
  });
  assert.equal(delta.translation[0].toFixed(6), '2.000000');
  assert.equal(delta.translation[2].toFixed(6), '3.000000');
});

test('axis rotation solves signed angle', () => {
  const solver = new TransformSolver({ snapper: new Snapper({ rotationStep: 0 }) });
  const state = solver.beginInteraction({
    mode: 'rotate',
    handle: { type: 'axis' },
    origin: [0, 0, 0],
    axis: [0, 0, 1],
    cameraDir: [0, 0, -1],
    startRay: ray([1, 0, 1], [0, 0, -1])
  });
  const delta = solver.update(state, {
    currentRay: ray([0, 1, 1], [0, 0, -1]),
    modifiers: {}
  });
  assert.ok(Math.abs(delta.rotationAngle - Math.PI / 2) < 1e-6);
});

test('uniform scale doubles size', () => {
  const solver = new TransformSolver({ snapper: new Snapper({ scaleStep: 0 }) });
  const state = solver.beginInteraction({
    mode: 'scale',
    handle: { type: 'uniform' },
    origin: [0, 0, 0],
    cameraDir: [0, 0, -1],
    startRay: ray([1, 0, 5], [0, 0, -1])
  });
  const delta = solver.update(state, {
    currentRay: ray([2, 0, 5], [0, 0, -1]),
    modifiers: {}
  });
  assert.ok(Math.abs(delta.scale[0] - 2) < 1e-6);
});

test('snapper applies snapping rules', () => {
  const snapper = new Snapper({ translationStep: 1, rotationStep: Math.PI / 2, scaleStep: 0.5 });
  assert.equal(snapper.snapTranslation(0.3), 0);
  assert.equal(snapper.snapTranslation(1.2), 1);
  assert.equal(snapper.snapAngle(Math.PI * 0.6).toFixed(6), (Math.PI / 2).toFixed(6));
  assert.equal(snapper.snapScale(1.26), 1.5);
});

test('frame builder respects orientation', () => {
  const frameBuilder = new FrameBuilder();
  const localFrame = frameBuilder.build({ orientation: 'global', origin: [0, 0, 0] });
  assert.deepEqual(localFrame.axes.x, [1, 0, 0]);
});

test('pivot resolver handles median and cursor', () => {
  const resolver = new PivotResolver({ cursor: [10, 0, 0] });
  const targets = [
    { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
    { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 0, 0, 1] }
  ];
  const median = resolver.resolvePivot(targets, 'median');
  assert.deepEqual(median.point.map((v) => Number(v.toFixed(2))), [1.0, 0, 0]);
  const cursor = resolver.resolvePivot(targets, 'cursor');
  assert.deepEqual(cursor.point, [10, 0, 0]);
});
