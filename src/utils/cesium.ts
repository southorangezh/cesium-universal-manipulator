import {
  Cartesian3,
  Cartographic,
  Matrix3,
  Matrix4,
  Quaternion,
  Transforms
} from 'cesium';

export function computeEnuFrame(position: Cartesian3, result = new Matrix4()): Matrix4 {
  return Transforms.eastNorthUpToFixedFrame(position, undefined, result);
}

export function computeEnuAxes(position: Cartesian3): Matrix3 {
  const matrix = computeEnuFrame(position);
  const axes = Matrix3.fromMatrix4(matrix);
  return axes;
}

export function cartesianArrayMedian(points: Cartesian3[]): Cartesian3 {
  if (points.length === 0) {
    return new Cartesian3();
  }
  const cartographic = points.map((point) => Cartographic.fromCartesian(point));
  cartographic.sort((a, b) => a.longitude - b.longitude);
  const medianLongitude = cartographic[Math.floor(cartographic.length / 2)].longitude;
  cartographic.sort((a, b) => a.latitude - b.latitude);
  const medianLatitude = cartographic[Math.floor(cartographic.length / 2)].latitude;
  cartographic.sort((a, b) => a.height - b.height);
  const medianHeight = cartographic[Math.floor(cartographic.length / 2)].height;
  return Cartesian3.fromRadians(medianLongitude, medianLatitude, medianHeight);
}

export function normalizeQuaternion(quaternion: Quaternion): Quaternion {
  return Quaternion.normalize(quaternion, quaternion);
}

export function quaternionToMatrix(quaternion: Quaternion): Matrix3 {
  return Matrix3.fromQuaternion(quaternion);
}

export function matrixToQuaternion(matrix: Matrix3): Quaternion {
  return Quaternion.fromRotationMatrix(matrix);
}

export function ensureQuaternionContinuous(previous: Quaternion, current: Quaternion): Quaternion {
  if (Quaternion.dot(previous, current) < 0) {
    current.x *= -1;
    current.y *= -1;
    current.z *= -1;
    current.w *= -1;
  }
  return current;
}
