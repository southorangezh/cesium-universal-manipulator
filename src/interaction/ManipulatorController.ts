import {
  Cartesian2,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Scene
} from 'cesium';
import type { GizmoHit, GizmoPicker } from './GizmoPicker';
import type { FrameState, Mode } from '../core/types';

export interface ManipulatorControllerCallbacks {
  onHover(hit: GizmoHit | undefined): void;
  onDragStart(hit: GizmoHit, position: Cartesian2): void;
  onDragMove(position: Cartesian2): void;
  onDragEnd(cancelled: boolean): void;
}

export class ManipulatorController {
  private readonly scene: Scene;
  private readonly picker: GizmoPicker;
  private readonly callbacks: ManipulatorControllerCallbacks;
  private readonly handler: ScreenSpaceEventHandler;
  private mode: Mode = 'translate';
  private frame: FrameState | undefined;
  private hover: GizmoHit | undefined;
  private dragging = false;

  constructor(scene: Scene, picker: GizmoPicker, callbacks: ManipulatorControllerCallbacks) {
    this.scene = scene;
    this.picker = picker;
    this.callbacks = callbacks;
    this.handler = new ScreenSpaceEventHandler(scene.canvas);
    this.bindEvents();
  }

  public setMode(mode: Mode): void {
    this.mode = mode;
  }

  public setFrame(frame: FrameState | undefined): void {
    this.frame = frame;
  }

  public destroy(): void {
    this.handler.destroy();
  }

  private bindEvents(): void {
    this.handler.setInputAction((movement) => {
      if (!this.frame) {
        return;
      }
      const position = movement.endPosition ?? movement.startPosition ?? movement.position;
      if (!position) {
        return;
      }
      const hit = this.picker.pick(position, this.frame, this.mode);
      this.hover = hit;
      this.callbacks.onHover(hit);
    }, ScreenSpaceEventType.MOUSE_MOVE);

    this.handler.setInputAction((movement) => {
      if (!this.frame || !this.hover) {
        return;
      }
      this.dragging = true;
      this.callbacks.onDragStart(this.hover, movement.position);
    }, ScreenSpaceEventType.LEFT_DOWN);

    this.handler.setInputAction((movement) => {
      if (!this.dragging) {
        return;
      }
      const position = movement.endPosition ?? movement.startPosition ?? movement.position;
      if (!position) {
        return;
      }
      this.callbacks.onDragMove(position);
    }, ScreenSpaceEventType.MOUSE_MOVE);

    this.handler.setInputAction(() => {
      if (!this.dragging) {
        return;
      }
      this.dragging = false;
      this.callbacks.onDragEnd(false);
    }, ScreenSpaceEventType.LEFT_UP);

    this.handler.setInputAction(() => {
      if (!this.dragging) {
        return;
      }
      this.dragging = false;
      this.callbacks.onDragEnd(true);
    }, ScreenSpaceEventType.RIGHT_DOWN);
  }
}
