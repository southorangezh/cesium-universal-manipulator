import {
  Cartesian2,
  Cartesian3,
  Matrix3,
  Matrix4,
  Quaternion
} from 'cesium';

export interface TRS {
  translation: Cartesian3;
  rotation: Quaternion;
  scale: Cartesian3;
}

export const EPSILON = 1e-8;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180.0;
}

export function toDegrees(radians: number): number {
  return (radians * 180.0) / Math.PI;
}

export function createIdentityTRS(): TRS {
  return {
    translation: new Cartesian3(),
    rotation: Quaternion.IDENTITY.clone(),
    scale: new Cartesian3(1, 1, 1)
  };
}

export function composeMatrix(trs: TRS, result = new Matrix4()): Matrix4 {
  return Matrix4.fromTranslationQuaternionRotationScale(
    trs.translation,
    trs.rotation,
    trs.scale,
    result
  );
}

export function decomposeMatrix(matrix: Matrix4): TRS {
  const translation = new Cartesian3();
  const rotation = new Quaternion();
  const scale = new Cartesian3();
  Matrix4.decompose(matrix, translation, rotation, scale);
  return { translation, rotation, scale };
}

export function projectVectorOnAxis(vector: Cartesian3, axis: Cartesian3): number {
  const axisNormalized = Cartesian3.normalize(axis, new Cartesian3());
  return Cartesian3.dot(vector, axisNormalized);
}

export function rejectVectorFromAxis(vector: Cartesian3, axis: Cartesian3, result = new Cartesian3()): Cartesian3 {
  const axisNormalized = Cartesian3.normalize(axis, new Cartesian3());
  const projection = Cartesian3.multiplyByScalar(axisNormalized, Cartesian3.dot(vector, axisNormalized), new Cartesian3());
  return Cartesian3.subtract(vector, projection, result);
}

export function axisAngleToQuaternion(axis: Cartesian3, angle: number, result = new Quaternion()): Quaternion {
  const halfAngle = angle * 0.5;
  const s = Math.sin(halfAngle);
  const c = Math.cos(halfAngle);
  const n = Cartesian3.normalize(axis, new Cartesian3());
  result.x = n.x * s;
  result.y = n.y * s;
  result.z = n.z * s;
  result.w = c;
  return result;
}

export function quaternionMultiply(a: Quaternion, b: Quaternion, result = new Quaternion()): Quaternion {
  return Quaternion.multiply(a, b, result);
}

export function quaternionFromVectors(from: Cartesian3, to: Cartesian3, result = new Quaternion()): Quaternion {
  const normalizedFrom = Cartesian3.normalize(from, new Cartesian3());
  const normalizedTo = Cartesian3.normalize(to, new Cartesian3());
  const dot = Cartesian3.dot(normalizedFrom, normalizedTo);
  if (dot > 1 - EPSILON) {
    return Quaternion.clone(Quaternion.IDENTITY, result);
  }
  if (dot < -1 + EPSILON) {
    const axis = findOrthogonal(normalizedFrom);
    return axisAngleToQuaternion(axis, Math.PI, result);
  }
  const axis = Cartesian3.cross(normalizedFrom, normalizedTo, new Cartesian3());
  const angle = Math.acos(clamp(dot, -1, 1));
  return axisAngleToQuaternion(axis, angle, result);
}

export function findOrthogonal(vector: Cartesian3): Cartesian3 {
  if (Math.abs(vector.x) < Math.abs(vector.y)) {
    return Math.abs(vector.x) < Math.abs(vector.z)
      ? new Cartesian3(0, -vector.z, vector.y)
      : new Cartesian3(-vector.y, vector.x, 0);
  }
  return Math.abs(vector.y) < Math.abs(vector.z)
    ? new Cartesian3(vector.z, 0, -vector.x)
    : new Cartesian3(-vector.y, vector.x, 0);
}

export function orthonormalize(matrix: Matrix3, result = new Matrix3()): Matrix3 {
  const column0 = Matrix3.getColumn(matrix, 0, new Cartesian3());
  const column1 = Matrix3.getColumn(matrix, 1, new Cartesian3());
  const column2 = Matrix3.getColumn(matrix, 2, new Cartesian3());

  Cartesian3.normalize(column0, column0);
  Cartesian3.normalize(column1, column1);
  Cartesian3.normalize(column2, column2);

  Matrix3.setColumn(result, 0, column0, result);
  Matrix3.setColumn(result, 1, column1, result);
  Matrix3.setColumn(result, 2, column2, result);
  return result;
}

export function screenDeltaToNdc(delta: Cartesian2, canvasSize: Cartesian2): Cartesian2 {
  return new Cartesian2((delta.x * 2) / canvasSize.x, (-delta.y * 2) / canvasSize.y);
}

export function almostEquals(a: number, b: number, epsilon = 1e-5): boolean {
  return Math.abs(a - b) <= epsilon;
}

export function almostEqualsVector(a: Cartesian3, b: Cartesian3, epsilon = 1e-5): boolean {
  return almostEquals(a.x, b.x, epsilon) && almostEquals(a.y, b.y, epsilon) && almostEquals(a.z, b.z, epsilon);
}
