import {
  Cartesian3,
  Matrix3,
  Matrix4,
  Quaternion,
  Math as CesiumMath
} from 'cesium';
import type { Axis, DeltaTransform, FrameState, SnapContext } from './types';
import { Snapper } from './Snapper';
import { axisAngleToQuaternion } from '../utils/math';

const scratchMatrix = new Matrix4();

function axisIndex(axis: Axis): number {
  switch (axis) {
    case 'x':
      return 0;
    case 'y':
      return 1;
    case 'z':
      return 2;
  }
}

export class TransformSolver {
  constructor(private readonly snapper: Snapper) {}

  public solveAxisTranslation(
    start: Cartesian3,
    current: Cartesian3,
    axis: Axis,
    frame: FrameState,
    context: SnapContext
  ): DeltaTransform {
    const axisVector = Matrix3.getColumn(frame.axes, axisIndex(axis), new Cartesian3());
    Cartesian3.normalize(axisVector, axisVector);
    const deltaWorld = Cartesian3.subtract(current, start, new Cartesian3());
    const amount = Cartesian3.dot(deltaWorld, axisVector);
    const snapped = this.snapper.snapTranslation(amount, context);
    const translation = Cartesian3.multiplyByScalar(axisVector, snapped, new Cartesian3());
    return {
      translation,
      rotation: Quaternion.IDENTITY.clone(),
      scale: new Cartesian3(1, 1, 1)
    };
  }

  public solvePlaneTranslation(
    start: Cartesian3,
    current: Cartesian3,
    axisA: Axis,
    axisB: Axis,
    frame: FrameState,
    context: SnapContext
  ): DeltaTransform {
    const columnA = Matrix3.getColumn(frame.axes, axisIndex(axisA), new Cartesian3());
    const columnB = Matrix3.getColumn(frame.axes, axisIndex(axisB), new Cartesian3());
    const deltaWorld = Cartesian3.subtract(current, start, new Cartesian3());
    const amountA = Cartesian3.dot(deltaWorld, Cartesian3.normalize(columnA, columnA));
    const amountB = Cartesian3.dot(deltaWorld, Cartesian3.normalize(columnB, columnB));
    const snappedA = this.snapper.snapTranslation(amountA, context);
    const snappedB = this.snapper.snapTranslation(amountB, context);
    const translation = Cartesian3.add(
      Cartesian3.multiplyByScalar(columnA, snappedA, new Cartesian3()),
      Cartesian3.multiplyByScalar(columnB, snappedB, new Cartesian3()),
      new Cartesian3()
    );
    return {
      translation,
      rotation: Quaternion.IDENTITY.clone(),
      scale: new Cartesian3(1, 1, 1)
    };
  }

  public solveAxisRotation(
    start: Cartesian3,
    current: Cartesian3,
    axis: Axis,
    frame: FrameState,
    context: SnapContext
  ): DeltaTransform {
    const origin = frame.origin;
    const axisVector = Matrix3.getColumn(frame.axes, axisIndex(axis), new Cartesian3());
    const startVector = Cartesian3.subtract(start, origin, new Cartesian3());
    const currentVector = Cartesian3.subtract(current, origin, new Cartesian3());
    Cartesian3.normalize(startVector, startVector);
    Cartesian3.normalize(currentVector, currentVector);
    const dot = CesiumMath.clamp(Cartesian3.dot(startVector, currentVector), -1, 1);
    let angle = Math.acos(dot);
    const cross = Cartesian3.cross(startVector, currentVector, new Cartesian3());
    if (Cartesian3.dot(cross, axisVector) < 0) {
      angle *= -1;
    }
    const snapped = this.snapper.snapRotation(angle, context);
    const rotation = axisAngleToQuaternion(axisVector, snapped, new Quaternion());
    return {
      translation: new Cartesian3(0, 0, 0),
      rotation,
      scale: new Cartesian3(1, 1, 1)
    };
  }

  public solveViewRotation(
    start: Cartesian3,
    current: Cartesian3,
    viewNormal: Cartesian3,
    frame: FrameState,
    context: SnapContext
  ): DeltaTransform {
    const origin = frame.origin;
    const normal = Cartesian3.normalize(viewNormal, new Cartesian3());
    const startVector = Cartesian3.subtract(start, origin, new Cartesian3());
    const currentVector = Cartesian3.subtract(current, origin, new Cartesian3());
    Cartesian3.normalize(startVector, startVector);
    Cartesian3.normalize(currentVector, currentVector);
    const dot = CesiumMath.clamp(Cartesian3.dot(startVector, currentVector), -1, 1);
    let angle = Math.acos(dot);
    const cross = Cartesian3.cross(startVector, currentVector, new Cartesian3());
    if (Cartesian3.dot(cross, normal) < 0) {
      angle *= -1;
    }
    const snapped = this.snapper.snapRotation(angle, context);
    const rotation = axisAngleToQuaternion(normal, snapped, new Quaternion());
    return {
      translation: new Cartesian3(0, 0, 0),
      rotation,
      scale: new Cartesian3(1, 1, 1)
    };
  }

  public solveAxisScale(
    start: Cartesian3,
    current: Cartesian3,
    axis: Axis,
    frame: FrameState,
    context: SnapContext
  ): DeltaTransform {
    const axisVector = Matrix3.getColumn(frame.axes, axisIndex(axis), new Cartesian3());
    const startProjection = Cartesian3.dot(
      Cartesian3.subtract(start, frame.origin, new Cartesian3()),
      Cartesian3.normalize(axisVector, axisVector)
    );
    const currentProjection = Cartesian3.dot(
      Cartesian3.subtract(current, frame.origin, new Cartesian3()),
      axisVector
    );
    const delta = currentProjection - startProjection;
    const snapped = this.snapper.snapScale(delta, context);
    const scale = new Cartesian3(1, 1, 1);
    if (axis === 'x') {
      scale.x = 1 + snapped;
    } else if (axis === 'y') {
      scale.y = 1 + snapped;
    } else {
      scale.z = 1 + snapped;
    }
    return {
      translation: new Cartesian3(0, 0, 0),
      rotation: Quaternion.IDENTITY.clone(),
      scale
    };
  }

  public solveUniformScale(
    start: Cartesian3,
    current: Cartesian3,
    frame: FrameState,
    context: SnapContext
  ): DeltaTransform {
    const startDistance = Cartesian3.distance(start, frame.origin);
    const currentDistance = Cartesian3.distance(current, frame.origin);
    const factor = currentDistance / (startDistance === 0 ? 1 : startDistance);
    const snappedFactor = 1 + this.snapper.snapScale(factor - 1, context);
    const scale = new Cartesian3(snappedFactor, snappedFactor, snappedFactor);
    return {
      translation: new Cartesian3(0, 0, 0),
      rotation: Quaternion.IDENTITY.clone(),
      scale
    };
  }

  public applyDelta(matrix: Matrix4, delta: DeltaTransform): Matrix4 {
    const trsMatrix = Matrix4.fromTranslationQuaternionRotationScale(
      delta.translation,
      delta.rotation,
      delta.scale,
      new Matrix4()
    );
    Matrix4.multiply(matrix, trsMatrix, scratchMatrix);
    return Matrix4.clone(scratchMatrix, new Matrix4());
  }
}
