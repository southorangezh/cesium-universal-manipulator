import {
  Cartesian2,
  Cartesian3,
  Matrix3,
  Matrix4,
  Plane,
  Ray,
  IntersectionTests,
  Scene,
  Camera,
  Math as CesiumMath,
  SceneTransforms
} from 'cesium';
import type {
  Axis,
  DeltaTransform,
  FrameState,
  ManipulatorOptions,
  ManipulatorTarget,
  Mode,
  Orientation,
  Pivot,
  SnapOptions
} from './types';
import { FrameBuilder } from './FrameBuilder';
import { GizmoPrimitive } from '../render/GizmoPrimitive';
import { GizmoPicker, GizmoHit } from '../interaction/GizmoPicker';
import { ManipulatorController } from '../interaction/ManipulatorController';
import { Snapper } from './Snapper';
import { TransformSolver } from './TransformSolver';
import { PivotResolver } from './PivotResolver';
import { HudOverlay } from './HudOverlay';

export interface UniversalManipulatorOptions extends ManipulatorOptions {
  scene: Scene;
  camera?: Camera;
  hudContainer?: HTMLElement;
}

interface ActiveDragState {
  hit: GizmoHit;
  startWindow: Cartesian2;
  startWorld: Cartesian3;
  pivot: Cartesian3;
  baseMatrices: Map<ManipulatorTarget, Matrix4>;
  perTargetPivot?: Map<ManipulatorTarget, Cartesian3>;
}

const scratchRay = new Ray();
const scratchPlane = new Plane(Cartesian3.UNIT_Z, 0);
const scratchMatrix = new Matrix4();

export class UniversalManipulator {
  public show = true;
  private readonly scene: Scene;
  private readonly camera: Camera;
  private readonly snapper: Snapper;
  private readonly solver: TransformSolver;
  private readonly frameBuilder: FrameBuilder;
  private readonly gizmo: GizmoPrimitive;
  private readonly picker: GizmoPicker;
  private readonly controller: ManipulatorController;
  private readonly pivotResolver: PivotResolver;
  private readonly hud: HudOverlay;
  private orientation: Orientation = 'global';
  private pivot: Pivot = 'origin';
  private mode: Mode = 'translate';
  private size = { screenPixelRadius: 90, minScale: 0.6, maxScale: 4 };
  private targets: ManipulatorTarget[] = [];
  private frame: FrameState | undefined;
  private drag: ActiveDragState | undefined;

  constructor(options: UniversalManipulatorOptions) {
    this.scene = options.scene;
    this.camera = options.camera ?? options.scene.camera;
    this.snapper = new Snapper(options.snap ?? {});
    this.solver = new TransformSolver(this.snapper);
    this.frameBuilder = new FrameBuilder({ camera: this.camera });
    this.pivotResolver = new PivotResolver();
    this.gizmo = new GizmoPrimitive({ scene: this.scene });
    this.picker = new GizmoPicker(this.scene);
    this.hud = new HudOverlay({ container: options.hudContainer });
    this.controller = new ManipulatorController(this.scene, this.picker, {
      onHover: (hit) => this.onHover(hit),
      onDragStart: (hit, position) => this.onDragStart(hit, position),
      onDragMove: (position) => this.onDragMove(position),
      onDragEnd: (cancelled) => this.onDragEnd(cancelled)
    });
    if (options.target) {
      this.setTarget(options.target);
    }
    if (options.orientation) {
      this.orientation = options.orientation;
    }
    if (options.pivot) {
      this.pivot = options.pivot;
    }
    if (options.snap) {
      this.snapper.update(options.snap);
    }
    if (options.size) {
      this.setSize(options.size.screenPixelRadius ?? 90, options.size.minScale ?? 0.6, options.size.maxScale ?? 4);
    }
    this.updateFrame();
  }

  public destroy(): void {
    this.controller.destroy();
    this.gizmo.destroy();
  }

  public enable(options: { translate?: boolean; rotate?: boolean; scale?: boolean }): void {
    if (options.translate) {
      this.mode = 'translate';
    } else if (options.rotate) {
      this.mode = 'rotate';
    } else if (options.scale) {
      this.mode = 'scale';
    }
    this.controller.setMode(this.mode);
  }

  public setTarget(target: ManipulatorTarget | ManipulatorTarget[]): void {
    this.targets = Array.isArray(target) ? target : [target];
    this.updateFrame();
  }

  public setOrientation(orientation: Orientation): void {
    this.orientation = orientation;
    this.updateFrame();
  }

  public setPivot(pivot: Pivot): void {
    this.pivot = pivot;
    this.updateFrame();
  }

  public setSnap(stepConfig: SnapOptions): void {
    this.snapper.update(stepConfig);
  }

  public setSize(screenPixelRadius: number, minScale: number, maxScale: number): void {
    this.size = { screenPixelRadius, minScale, maxScale };
  }

  public setShow(show: boolean): void {
    this.show = show;
    this.gizmo.setShow(show);
  }

  public getHudElement(): HTMLElement {
    return this.hud.getElement();
  }

  private updateFrame(): void {
    if (this.targets.length === 0) {
      this.frame = undefined;
      this.gizmo.setShow(false);
      this.controller.setFrame(undefined);
      return;
    }
    const pivotResult = this.pivotResolver.resolve(this.targets, this.pivot);
    const primaryMatrix = this.getTargetMatrix(this.targets[0]);
    this.frame = this.frameBuilder.build(pivotResult.pivotPoint, primaryMatrix, this.orientation);
    this.gizmo.setShow(this.show);
    const scale = this.computeScreenScale(pivotResult.pivotPoint);
    this.gizmo.update(this.frame, scale);
    this.controller.setFrame(this.frame);
  }

  private computeScreenScale(position: Cartesian3): number {
    const canvas = this.scene.canvas;
    const windowPosition = SceneTransforms.worldToWindowCoordinates(this.scene, position);
    if (!windowPosition) {
      return 1;
    }
    const distance = Cartesian3.distance(position, this.camera.position);
    const fov = this.camera.frustum.fov ?? CesiumMath.PI_OVER_THREE;
    const height = canvas.clientHeight;
    const scale = (distance * Math.tan(fov / 2) * 2) / height;
    return CesiumMath.clamp(scale * this.size.screenPixelRadius * 0.01, this.size.minScale, this.size.maxScale);
  }

  private onHover(hit: GizmoHit | undefined): void {
    // In this simplified version we do not change visual state beyond HUD reset.
    if (!hit) {
      this.hud.reset();
    }
  }

  private onDragStart(hit: GizmoHit, position: Cartesian2): void {
    if (!this.frame) {
      return;
    }
    const pivotResult = this.pivotResolver.resolve(this.targets, this.pivot);
    const startWorld = this.intersectPointer(position, hit, pivotResult.pivotPoint);
    if (!startWorld) {
      return;
    }
    const baseMatrices = new Map<ManipulatorTarget, Matrix4>();
    this.targets.forEach((target) => {
      baseMatrices.set(target, Matrix4.clone(this.getTargetMatrix(target), new Matrix4()));
    });
    this.drag = {
      hit,
      startWindow: position,
      startWorld,
      pivot: pivotResult.pivotPoint,
      baseMatrices,
      perTargetPivot: pivotResult.perTarget
    };
  }

  private onDragMove(position: Cartesian2): void {
    if (!this.drag || !this.frame) {
      return;
    }
    const currentWorld = this.intersectPointer(position, this.drag.hit, this.drag.pivot);
    if (!currentWorld) {
      return;
    }
    const context = { ctrlKey: false, shiftKey: false };
    let delta: DeltaTransform | undefined;
    switch (this.mode) {
      case 'translate':
        delta = this.solver.solveAxisTranslation(this.drag.startWorld, currentWorld, this.drag.hit.axis, this.frame, context);
        break;
      case 'rotate':
        delta = this.solver.solveAxisRotation(this.drag.startWorld, currentWorld, this.drag.hit.axis, this.frame, context);
        break;
      case 'scale':
        delta = this.solver.solveAxisScale(this.drag.startWorld, currentWorld, this.drag.hit.axis, this.frame, context);
        break;
    }
    if (!delta) {
      return;
    }
    this.applyDeltaToTargets(delta, this.drag);
    this.hud.update(delta);
    this.scene.requestRender();
  }

  private onDragEnd(cancelled: boolean): void {
    if (cancelled && this.drag) {
      this.drag.baseMatrices.forEach((matrix, target) => {
        this.writeTargetMatrix(target, matrix);
      });
    }
    this.drag = undefined;
    this.hud.reset();
    this.updateFrame();
  }

  private intersectPointer(position: Cartesian2, hit: GizmoHit, pivot: Cartesian3): Cartesian3 | undefined {
    const ray = this.camera.getPickRay(position, scratchRay);
    if (!ray) {
      return undefined;
    }
    if (this.mode === 'translate') {
      const axisVector = Matrix3.getColumn(this.frame!.axes, axisToIndex(hit.axis), new Cartesian3());
      const planeNormal = this.createAxisPlaneNormal(axisVector);
      Plane.fromPointNormal(pivot, planeNormal, scratchPlane);
      return IntersectionTests.rayPlane(ray, scratchPlane, new Cartesian3());
    }
    if (this.mode === 'rotate' || this.mode === 'scale') {
      const axisVector = Matrix3.getColumn(this.frame!.axes, axisToIndex(hit.axis), new Cartesian3());
      Plane.fromPointNormal(pivot, axisVector, scratchPlane);
      return IntersectionTests.rayPlane(ray, scratchPlane, new Cartesian3());
    }
    return undefined;
  }

  private createAxisPlaneNormal(axisVector: Cartesian3): Cartesian3 {
    const cameraDirection = Cartesian3.normalize(this.camera.direction, new Cartesian3());
    const cross = Cartesian3.cross(cameraDirection, axisVector, new Cartesian3());
    if (Cartesian3.magnitudeSquared(cross) < 1e-6) {
      // Axis parallel to camera direction, fallback to another perpendicular vector
      const fallback = axisVector.y !== 0 || axisVector.z !== 0 ? new Cartesian3(1, 0, 0) : new Cartesian3(0, 1, 0);
      Cartesian3.cross(axisVector, fallback, cross);
    }
    const planeNormal = Cartesian3.cross(axisVector, cross, new Cartesian3());
    return Cartesian3.normalize(planeNormal, planeNormal);
  }

  private applyDeltaToTargets(delta: DeltaTransform, drag: ActiveDragState): void {
    const pivot = drag.pivot;
    const deltaMatrix = Matrix4.fromTranslationQuaternionRotationScale(delta.translation, delta.rotation, delta.scale, new Matrix4());
    drag.baseMatrices.forEach((baseMatrix, target) => {
      const targetPivot = drag.perTargetPivot?.get(target) ?? pivot;
      const pivotTranslationLocal = Matrix4.fromTranslation(targetPivot, new Matrix4());
      const pivotInverseLocal = Matrix4.fromTranslation(Cartesian3.negate(targetPivot, new Cartesian3()), new Matrix4());
      const deltaAroundTargetPivot = Matrix4.multiply(
        Matrix4.multiply(pivotTranslationLocal, deltaMatrix, new Matrix4()),
        pivotInverseLocal,
        new Matrix4()
      );
      const result = Matrix4.multiply(deltaAroundTargetPivot, baseMatrix, new Matrix4());
      this.writeTargetMatrix(target, result);
    });
  }

  private getTargetMatrix(target: ManipulatorTarget): Matrix4 {
    if ('getMatrix' in target) {
      return target.getMatrix();
    }
    return target.matrix;
  }

  private writeTargetMatrix(target: ManipulatorTarget, matrix: Matrix4): void {
    if ('setMatrix' in target) {
      target.setMatrix(Matrix4.clone(matrix, new Matrix4()));
    } else {
      (target as any).matrix = Matrix4.clone(matrix, new Matrix4());
    }
  }
}

function axisToIndex(axis: Axis): number {
  switch (axis) {
    case 'x':
      return 0;
    case 'y':
      return 1;
    case 'z':
    default:
      return 2;
  }
}
