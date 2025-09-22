import type { Cartesian3, Matrix3, Matrix4, Quaternion } from 'cesium';

export type Axis = 'x' | 'y' | 'z';
export type Mode = 'translate' | 'rotate' | 'scale';
export type Orientation = 'global' | 'local' | 'view' | 'enu' | 'normal' | 'gimbal';
export type Pivot = 'origin' | 'median' | 'cursor' | 'individual';

export interface TargetLike {
  matrix: Matrix4;
  setMatrix(matrix: Matrix4): void;
}

export interface TargetEntity {
  getMatrix(): Matrix4;
  setMatrix(matrix: Matrix4): void;
}

export type ManipulatorTarget = TargetLike | TargetEntity;

export interface ManipulatorOptions {
  target?: ManipulatorTarget | ManipulatorTarget[];
  orientation?: Orientation;
  pivot?: Pivot;
  enableTranslate?: boolean;
  enableRotate?: boolean;
  enableScale?: boolean;
  snap?: SnapOptions;
  size?: SizeOptions;
}

export interface SizeOptions {
  screenPixelRadius?: number;
  minScale?: number;
  maxScale?: number;
}

export interface SnapOptions {
  translate?: number;
  rotate?: number;
  scale?: number;
}

export interface FrameState {
  origin: Cartesian3;
  axes: Matrix3;
  matrix: Matrix4;
}

export interface DeltaTransform {
  translation: Cartesian3;
  rotation: Quaternion;
  scale: Cartesian3;
}

export interface SnapContext {
  ctrlKey: boolean;
  shiftKey: boolean;
}

export interface InteractionEvent {
  startPosition: Cartesian3;
  currentPosition: Cartesian3;
  delta: DeltaTransform;
}
