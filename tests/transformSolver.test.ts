import { describe, it, expect } from 'vitest';
import { TransformSolver } from '../src/core/TransformSolver';
import { Snapper } from '../src/core/Snapper';
import { PivotResolver } from '../src/core/PivotResolver';
import { FrameBuilder } from '../src/core/FrameBuilder';
import type { FrameState, ManipulatorTarget } from '../src/core/types';
import { Cartesian3, Matrix3, Matrix4, Math as CesiumMath } from 'cesium';

function createIdentityFrame(origin = new Cartesian3()): FrameState {
  return {
    origin,
    axes: Matrix3.IDENTITY.clone(),
    matrix: Matrix4.fromTranslation(origin, new Matrix4())
  };
}

describe('TransformSolver', () => {
  const snapper = new Snapper({});
  const solver = new TransformSolver(snapper);
  const frame = createIdentityFrame(new Cartesian3(0, 0, 0));
  const context = { ctrlKey: false, shiftKey: false };

  it('solves axis translation along X', () => {
    const start = new Cartesian3(0, 0, 0);
    const current = new Cartesian3(10, 0, 0);
    const delta = solver.solveAxisTranslation(start, current, 'x', frame, context);
    expect(delta.translation.x).toBeCloseTo(10);
    expect(delta.translation.y).toBeCloseTo(0);
    expect(delta.translation.z).toBeCloseTo(0);
  });

  it('solves plane translation in XY', () => {
    const start = new Cartesian3(0, 0, 0);
    const current = new Cartesian3(5, 7, 0);
    const delta = solver.solvePlaneTranslation(start, current, 'x', 'y', frame, context);
    expect(delta.translation.x).toBeCloseTo(5);
    expect(delta.translation.y).toBeCloseTo(7);
    expect(delta.translation.z).toBeCloseTo(0);
  });

  it('solves rotation around Z axis', () => {
    const start = new Cartesian3(1, 0, 0);
    const current = new Cartesian3(0, 1, 0);
    const delta = solver.solveAxisRotation(start, current, 'z', frame, context);
    const angle = 2 * Math.acos(delta.rotation.w);
    expect(CesiumMath.toDegrees(angle)).toBeCloseTo(90, 5);
  });

  it('solves scale along Y axis', () => {
    const start = new Cartesian3(0, 1, 0);
    const current = new Cartesian3(0, 3, 0);
    const delta = solver.solveAxisScale(start, current, 'y', frame, context);
    expect(delta.scale.y).toBeCloseTo(3);
  });
});

describe('PivotResolver', () => {
  const resolver = new PivotResolver();
  const targetA: ManipulatorTarget = {
    matrix: Matrix4.fromTranslation(new Cartesian3(0, 0, 0)),
    setMatrix() {}
  };
  const targetB: ManipulatorTarget = {
    matrix: Matrix4.fromTranslation(new Cartesian3(10, 0, 0)),
    setMatrix() {}
  };

  it('returns origin pivot for origin mode', () => {
    const result = resolver.resolve([targetA, targetB], 'origin');
    expect(result.pivotPoint.x).toBeCloseTo(0);
  });

  it('returns median pivot', () => {
    const result = resolver.resolve([targetA, targetB], 'median');
    expect(result.pivotPoint.x).toBeCloseTo(5);
  });
});

describe('FrameBuilder', () => {
  const builder = new FrameBuilder();
  const origin = new Cartesian3(1, 2, 3);
  const matrix = Matrix4.fromRotationTranslation(Matrix3.IDENTITY, origin, new Matrix4());

  it('builds global frame', () => {
    const frame = builder.build(origin, matrix, 'global');
    expect(frame.origin.x).toBeCloseTo(origin.x);
    expect(frame.origin.y).toBeCloseTo(origin.y);
    expect(frame.origin.z).toBeCloseTo(origin.z);
    expect(frame.axes.equalsEpsilon(Matrix3.IDENTITY, 1e-5)).toBe(true);
  });

  it('builds local frame', () => {
    const rotation = Matrix3.fromRotationZ(CesiumMath.toRadians(45));
    const localMatrix = Matrix4.fromRotationTranslation(rotation, origin, new Matrix4());
    const frame = builder.build(origin, localMatrix, 'local');
    expect(frame.axes.equalsEpsilon(rotation, 1e-5)).toBe(true);
  });
});
