import {
  Cartesian3,
  Matrix3,
  Matrix4,
  Quaternion,
  Transforms,
  Camera
} from 'cesium';
import type { FrameState, Orientation } from './types';
import { matrixToQuaternion, quaternionToMatrix } from '../utils/cesium';

export interface FrameBuilderOptions {
  camera?: Camera;
  viewUp?: Cartesian3;
  normalProvider?: () => Cartesian3;
}

const scratchMatrix3 = new Matrix3();
const scratchQuaternion = new Quaternion();

export class FrameBuilder {
  private readonly options: FrameBuilderOptions;

  constructor(options: FrameBuilderOptions = {}) {
    this.options = options;
  }

  public setCamera(camera: Camera): void {
    this.options.camera = camera;
  }

  public build(origin: Cartesian3, worldMatrix: Matrix4, orientation: Orientation): FrameState {
    switch (orientation) {
      case 'global':
        return this.buildGlobal(origin);
      case 'local':
        return this.buildLocal(origin, worldMatrix);
      case 'view':
        return this.buildView(origin);
      case 'enu':
        return this.buildEnu(origin);
      case 'normal':
        return this.buildNormal(origin, worldMatrix);
      case 'gimbal':
      default:
        return this.buildGimbal(origin, worldMatrix);
    }
  }

  private buildGlobal(origin: Cartesian3): FrameState {
    const translation = Cartesian3.clone(origin, new Cartesian3());
    const matrix = Matrix4.fromRotationTranslation(Matrix3.IDENTITY, translation, new Matrix4());
    const axes = Matrix3.IDENTITY.clone();
    return { origin: translation, axes, matrix };
  }

  private buildLocal(origin: Cartesian3, matrix: Matrix4): FrameState {
    const rotation = Matrix3.fromMatrix4(matrix, new Matrix3());
    const translation = Cartesian3.clone(origin, new Cartesian3());
    const axes = Matrix3.clone(rotation, new Matrix3());
    const frameMatrix = Matrix4.fromRotationTranslation(rotation, translation, new Matrix4());
    return { origin: translation, axes, matrix: frameMatrix };
  }

  private buildView(origin: Cartesian3): FrameState {
    const camera = this.options.camera;
    if (!camera) {
      return this.buildGlobal(origin);
    }
    const right = Cartesian3.normalize(camera.right, new Cartesian3());
    const up = Cartesian3.normalize(camera.up, new Cartesian3());
    const forward = Cartesian3.normalize(camera.direction, new Cartesian3());
    const axes = Matrix3.clone(Matrix3.IDENTITY, new Matrix3());
    Matrix3.setColumn(axes, 0, right, axes);
    Matrix3.setColumn(axes, 1, up, axes);
    Matrix3.setColumn(axes, 2, forward, axes);
    const translation = Cartesian3.clone(origin, new Cartesian3());
    const frameMatrix = Matrix4.fromRotationTranslation(axes, translation, new Matrix4());
    return { origin: translation, axes, matrix: frameMatrix };
  }

  private buildEnu(origin: Cartesian3): FrameState {
    const translation = Cartesian3.clone(origin, new Cartesian3());
    const frameMatrix = Transforms.eastNorthUpToFixedFrame(translation, undefined, new Matrix4());
    const axes = Matrix3.fromMatrix4(frameMatrix, new Matrix3());
    return { origin: translation, axes, matrix: frameMatrix };
  }

  private buildNormal(origin: Cartesian3, matrix: Matrix4): FrameState {
    const normalProvider = this.options.normalProvider;
    const normal = normalProvider ? normalProvider() : Matrix4.getColumn(matrix, 2, new Cartesian3());
    const up = Cartesian3.normalize(normal, new Cartesian3());
    const xAxis = Matrix4.getColumn(matrix, 0, new Cartesian3());
    Cartesian3.normalize(xAxis, xAxis);
    const yAxis = Cartesian3.cross(up, xAxis, new Cartesian3());
    Cartesian3.normalize(yAxis, yAxis);
    const correctedXAxis = Cartesian3.cross(yAxis, up, new Cartesian3());
    const rotation = Matrix3.fromColumns(correctedXAxis, yAxis, up, new Matrix3());
    const translation = Cartesian3.clone(origin, new Cartesian3());
    const frameMatrix = Matrix4.fromRotationTranslation(rotation, translation, new Matrix4());
    return { origin: translation, axes: rotation, matrix: frameMatrix };
  }

  private buildGimbal(origin: Cartesian3, matrix: Matrix4): FrameState {
    const rotation = Matrix3.fromMatrix4(matrix, new Matrix3());
    const quaternion = matrixToQuaternion(rotation);
    Quaternion.normalize(quaternion, scratchQuaternion);
    const stabilised = quaternionToMatrix(scratchQuaternion);
    const translation = Cartesian3.clone(origin, new Cartesian3());
    const frameMatrix = Matrix4.fromRotationTranslation(stabilised, translation, new Matrix4());
    return { origin: translation, axes: stabilised, matrix: frameMatrix };
  }
}
