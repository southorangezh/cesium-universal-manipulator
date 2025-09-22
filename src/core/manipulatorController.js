import GizmoPicker from '../picking/gizmoPicker.js';
import TransformSolver from '../math/transformSolver.js';
import FrameBuilder from './frameBuilder.js';
import PivotResolver from '../pivot/pivotResolver.js';
import HudOverlay from '../hud/hudOverlay.js';
import { Snapper } from '../math/snapper.js';
import GizmoPrimitive from '../primitives/gizmoPrimitive.js';
import { applyDelta } from '../utils/trs.js';

function toCartesian2(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: rect.height - (event.clientY - rect.top)
  };
}

function extractRay(scene, position) {
  if (!scene || !scene.camera || !scene.camera.getPickRay) {
    return null;
  }
  const Cesium = globalThis.Cesium;
  const pick = scene.camera.getPickRay(new Cesium.Cartesian2(position.x, position.y));
  if (!pick) {
    return null;
  }
  return {
    origin: [pick.origin.x, pick.origin.y, pick.origin.z],
    direction: [pick.direction.x, pick.direction.y, pick.direction.z]
  };
}

export class ManipulatorController {
  constructor(options) {
    this.scene = options.scene;
    this.canvas = options.canvas ?? (this.scene ? this.scene.canvas : null);
    this.snapper = options.snapper ?? new Snapper(options.snap ?? {});
    this.frameBuilder = options.frameBuilder ?? new FrameBuilder({ ellipsoid: options.ellipsoid });
    this.pivotResolver = options.pivotResolver ?? new PivotResolver({ cursor: options.cursor });
    this.hud = options.hud ?? new HudOverlay(options.hudContainer ?? document.body);
    this.primitive = options.primitive ?? new GizmoPrimitive({ scene: this.scene });
    this.picker = options.picker ?? new GizmoPicker(this.scene, this.primitive);
    this.solver = options.solver ?? new TransformSolver({ snapper: this.snapper });
    this.orientation = options.orientation ?? 'global';
    this.pivot = options.pivot ?? 'origin';
    this.modeEnabled = { translate: true, rotate: true, scale: true };
    this.targets = [];
    this.state = 'idle';
    this.activeHandle = null;
    this.activeSolverState = null;
    this.initialMatrices = new Map();
    this.pivotInfo = null;
    this.listeners = [];

    if (this.canvas) {
      this.attachEvents();
    }
  }

  attachEvents() {
    const onPointerDown = (event) => {
      if (!this.primitive.visible) return;
      if (!globalThis.Cesium) return;
      const pos = toCartesian2(event, this.canvas);
      const picked = this.picker.pick(new globalThis.Cesium.Cartesian2(pos.x, pos.y));
      if (!picked || !this.modeEnabled[picked.mode]) {
        return;
      }
      this.state = 'dragging';
      this.activeHandle = picked;
      this.primitive.setActive(picked.id, true);
      this.primitive.setHighlight(picked.id, true);
      const ray = extractRay(this.scene, pos);
      if (!ray) {
        return;
      }
      this.captureInitialMatrices();
      const frame = this.computeFrame();
      const axisVectors = this.resolveAxes(frame, picked);
      const solverState = this.solver.beginInteraction({
        mode: picked.mode,
        handle: picked,
        origin: frame.origin,
        axis: axisVectors.axis,
        planeAxes: axisVectors.planeAxes,
        cameraDir: [this.scene.camera.direction.x, this.scene.camera.direction.y, this.scene.camera.direction.z],
        startRay: ray,
        radius: axisVectors.radius
      });
      this.activeSolverState = solverState;
      this.pivotInfo = this.pivotResolver.resolvePivot(this.targets, this.pivot);
      this.preventDefault(event);
    };

    const onPointerMove = (event) => {
      const pos = toCartesian2(event, this.canvas);
      if (this.state === 'dragging' && this.activeSolverState) {
        const ray = extractRay(this.scene, pos);
        if (!ray) {
          return;
        }
        const delta = this.solver.update(this.activeSolverState, {
          currentRay: ray,
          modifiers: {
            ctrl: event.ctrlKey,
            shift: event.shiftKey
          }
        });
        this.applyDelta(delta);
        this.updateHud(delta);
        this.scene.requestRender?.();
        this.preventDefault(event);
      } else {
        if (globalThis.Cesium) {
          const picked = this.picker.pick(new globalThis.Cesium.Cartesian2(pos.x, pos.y));
          this.updateHover(picked);
        }
      }
    };

    const onPointerUp = (event) => {
      if (this.state === 'dragging') {
        this.finishInteraction();
      }
      this.preventDefault(event);
    };

    this.canvas.addEventListener('pointerdown', onPointerDown);
    this.canvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    this.listeners.push(['pointerdown', onPointerDown]);
    this.listeners.push(['pointermove', onPointerMove]);
    this.listeners.push(['window:pointerup', onPointerUp]);
  }

  preventDefault(event) {
    if (event.cancelable) {
      event.preventDefault();
    }
  }

  updateHover(picked) {
    this.primitive.getHandles().forEach((handle) => {
      this.primitive.setHighlight(handle.id, picked && picked.id === handle.id);
    });
  }

  captureInitialMatrices() {
    this.initialMatrices.clear();
    this.targets.forEach((target) => {
      const matrix = typeof target.getModelMatrix === 'function' ? target.getModelMatrix() : target.matrix;
      this.initialMatrices.set(target, matrix.slice());
    });
  }

  applyDelta(delta) {
    this.targets.forEach((target) => {
      const original = this.initialMatrices.get(target);
      if (!original) {
        return;
      }
      const pivotPoint = this.pivot === 'individual'
        ? this.pivotResolver.extractTranslation(target)
        : this.pivotInfo.point;
      const updated = applyDelta(original, delta, pivotPoint);
      if (typeof target.setModelMatrix === 'function') {
        target.setModelMatrix(updated);
      } else {
        target.matrix = updated;
      }
    });
  }

  updateHud(delta) {
    if (!delta) {
      this.hud.update(null);
      return;
    }
    if (delta.translation) {
      this.hud.update({ mode: 'translate', delta: delta.translation });
    } else if (delta.rotation) {
      this.hud.update({ mode: 'rotate', angle: delta.rotationAngle });
    } else if (delta.scale) {
      this.hud.update({ mode: 'scale', factor: delta.scale[0] });
    }
  }

  finishInteraction() {
    if (this.activeHandle) {
      this.primitive.setActive(this.activeHandle.id, false);
      this.primitive.setHighlight(this.activeHandle.id, false);
    }
    this.hud.update(null);
    this.state = 'idle';
    this.activeHandle = null;
    this.activeSolverState = null;
    this.initialMatrices.clear();
  }

  resolveAxes(frame, handle) {
    const axisMap = {
      x: frame.axes.x,
      y: frame.axes.y,
      z: frame.axes.z
    };
    const result = {
      axis: frame.axes.x,
      planeAxes: [],
      radius: 1
    };
    if (handle.axis) {
      result.axis = axisMap[handle.axis];
    }
    if (handle.axes) {
      result.planeAxes = handle.axes.map((axis) => axisMap[axis]);
    }
    result.radius = frame.radius ?? 1;
    return result;
  }

  computeFrame() {
    const pivotInfo = this.pivotResolver.resolvePivot(this.targets, this.pivot);
    const origin = pivotInfo.point;
    const matrix = this.targets.length > 0 ? (typeof this.targets[0].getModelMatrix === 'function'
      ? this.targets[0].getModelMatrix()
      : this.targets[0].matrix) : undefined;
    const frame = this.frameBuilder.build({
      orientation: this.orientation,
      origin,
      matrix,
      camera: this.scene?.camera
    });
    frame.origin = origin;
    frame.radius = this.computeScreenScale(origin);
    this.primitive.updateFrame(frame);
    return frame;
  }

  computeScreenScale(origin) {
    if (!this.scene || !this.scene.camera || !globalThis.Cesium) {
      return 1;
    }
    const Cesium = globalThis.Cesium;
    const camera = this.scene.camera;
    const distance = Cesium.Cartesian3.distance(camera.positionWC ?? camera.position, new Cesium.Cartesian3(origin[0], origin[1], origin[2]));
    const fov = camera.frustum.fov ?? (60 * Math.PI / 180);
    const height = this.scene.canvas.height;
    const worldPerPixel = 2 * distance * Math.tan(fov / 2) / height;
    return worldPerPixel * (this.size?.screenPixelRadius ?? 80);
  }

  setTargets(targets) {
    this.targets = Array.isArray(targets) ? targets : [targets];
    this.computeFrame();
  }

  setOrientation(orientation) {
    this.orientation = orientation;
    this.computeFrame();
  }

  setPivot(pivot) {
    this.pivot = pivot;
    this.computeFrame();
  }

  enable(mode, enabled) {
    this.modeEnabled[mode] = enabled;
  }

  setSnap(config) {
    this.snapper.update(config);
  }

  setSize(options) {
    this.size = options;
  }

  destroy() {
    this.listeners.forEach(([type, handler]) => {
      if (type === 'window:pointerup') {
        window.removeEventListener('pointerup', handler);
      } else {
        this.canvas.removeEventListener(type, handler);
      }
    });
    this.listeners = [];
    this.primitive.destroy();
    this.hud.destroy();
  }
}

export default ManipulatorController;
