import ManipulatorController from './core/manipulatorController.js';
import GizmoPrimitive from './primitives/gizmoPrimitive.js';
import GizmoPicker from './picking/gizmoPicker.js';
import FrameBuilder from './core/frameBuilder.js';
import PivotResolver from './pivot/pivotResolver.js';
import HudOverlay from './hud/hudOverlay.js';
import TransformSolver from './math/transformSolver.js';
import { Snapper } from './math/snapper.js';

export class UniversalManipulator {
  constructor(viewer, options = {}) {
    if (!viewer || !viewer.scene) {
      throw new Error('UniversalManipulator requires a Cesium Viewer or Scene.');
    }
    this.viewer = viewer;
    this.scene = viewer.scene;
    this.options = options;
    this.snapper = new Snapper(options.snap ?? {});
    this.frameBuilder = new FrameBuilder({ ellipsoid: viewer.scene.globe?.ellipsoid });
    this.pivotResolver = new PivotResolver({ cursor: options.cursor });
    this.hud = options.hud ?? new HudOverlay(options.hudContainer);
    this.primitive = new GizmoPrimitive({ scene: this.scene, colors: options.colors });
    this.picker = new GizmoPicker(this.scene, this.primitive);
    this.solver = new TransformSolver({ snapper: this.snapper });
    this.controller = new ManipulatorController({
      scene: this.scene,
      canvas: viewer.canvas,
      primitive: this.primitive,
      picker: this.picker,
      frameBuilder: this.frameBuilder,
      pivotResolver: this.pivotResolver,
      hud: this.hud,
      solver: this.solver,
      orientation: options.orientation ?? 'global',
      pivot: options.pivot ?? 'origin',
      snap: options.snap,
      ellipsoid: viewer.scene.globe?.ellipsoid
    });
    if (options.target) {
      this.setTarget(options.target);
    }
    if (options.size) {
      this.setSize(options.size);
    }
    this.show = options.show ?? true;
    this.primitive.setVisible(this.show);
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

  enable(mode, enabled = true) {
    this.controller.enable(mode, enabled);
  }

  setSnap(stepConfig) {
    this.controller.setSnap(stepConfig);
  }

  setSize(options) {
    this.controller.setSize(options);
  }

  set show(value) {
    this._show = !!value;
    if (this.primitive) {
      this.primitive.setVisible(this._show);
    }
  }

  get show() {
    return this._show;
  }

  destroy() {
    this.controller.destroy();
  }
}

export default UniversalManipulator;
