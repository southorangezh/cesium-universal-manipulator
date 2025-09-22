import { GizmoPrimitive } from './GizmoPrimitive.js';
import { GizmoPicker } from './GizmoPicker.js';
import { ManipulatorController } from './ManipulatorController.js';
import { FrameBuilder } from './FrameBuilder.js';
import { Snapper } from './Snapper.js';
import { PivotResolver } from './PivotResolver.js';
import { HudOverlay } from './HudOverlay.js';

export class UniversalManipulator {
  constructor(options = {}) {
    const {
      Cesium,
      viewer,
      target = null,
      mode = 'translate',
      orientation = 'global',
      pivot = 'origin',
      snap = {},
      size = {},
      hudContainer = null,
    } = options;

    if (!Cesium) {
      throw new Error('Cesium namespace must be provided to UniversalManipulator.');
    }
    if (!viewer) {
      throw new Error('viewer is required to create UniversalManipulator.');
    }

    this.Cesium = Cesium;
    this.viewer = viewer;
    this.enabledModes = { translate: true, rotate: true, scale: true };

    this.gizmo = new GizmoPrimitive({ Cesium, viewer, size });
    this.picker = new GizmoPicker(viewer.scene, this.gizmo);
    this.frameBuilder = new FrameBuilder({ Cesium });
    this.snapper = new Snapper(snap);
    this.pivotResolver = new PivotResolver();
    this.hud = new HudOverlay({ container: hudContainer ?? (typeof viewer.container !== 'string' ? viewer.container : null) });

    this.controller = new ManipulatorController({
      Cesium,
      viewer,
      gizmo: this.gizmo,
      picker: this.picker,
      frameBuilder: this.frameBuilder,
      snapper: this.snapper,
      pivotResolver: this.pivotResolver,
      hud: this.hud,
    });

    this._show = true;
    this.setMode(mode);
    this.setOrientation(orientation);
    this.setPivot(pivot);
    this.setSnap(snap);
    if (target) {
      this.setTarget(target);
    }
  }

  get show() {
    return this._show;
  }

  set show(value) {
    this._show = Boolean(value);
    this.gizmo.setShow(this._show);
  }

  setTarget(target) {
    this.controller.setTargets(target);
  }

  setOrientation(orientation) {
    this.controller.setOrientation(orientation);
  }

  setPivot(pivot) {
    this.controller.setPivot(pivot);
  }

  setCursor(position) {
    this.pivotResolver.setCursor(position);
  }

  setMode(mode) {
    if (this.enabledModes && this.enabledModes[mode] === false) {
      throw new Error(`Mode ${mode} is disabled.`);
    }
    this.mode = mode;
    this.controller.setMode(mode);
    this.gizmo.setMode(mode);
  }

  enable(config) {
    this.enabledModes = { ...this.enabledModes, ...config };
    if (this.mode && this.enabledModes[this.mode] === false) {
      const fallback = Object.keys(this.enabledModes).find((key) => this.enabledModes[key]);
      if (fallback) {
        this.setMode(fallback);
      }
    }
  }

  setSnap(stepConfig) {
    this.snapper.setConfig(stepConfig);
  }

  setSize(screenPixelRadius, minScale, maxScale) {
    const updated = { ...this.gizmo.size };
    if (screenPixelRadius !== undefined) updated.screenRadius = screenPixelRadius;
    if (minScale !== undefined) updated.minScale = minScale;
    if (maxScale !== undefined) updated.maxScale = maxScale;
    this.gizmo.size = updated;
  }

  destroy() {
    this.controller.destroy();
    this.gizmo.destroy();
    this.hud.destroy();
  }
}
