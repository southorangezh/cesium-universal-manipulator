import { Math as CesiumMath } from 'cesium';
import type { SnapContext, SnapOptions } from './types';

export class Snapper {
  private translateStep: number | undefined;
  private rotateStep: number | undefined;
  private scaleStep: number | undefined;

  constructor(options: SnapOptions = {}) {
    this.update(options);
  }

  public update(options: SnapOptions): void {
    this.translateStep = options.translate;
    this.rotateStep = options.rotate;
    this.scaleStep = options.scale;
  }

  public snapTranslation(value: number, context: SnapContext): number {
    if (!this.translateStep) {
      return this.applyFineAdjustment(value, context);
    }
    return this.snapValue(value, this.translateStep, context);
  }

  public snapRotation(value: number, context: SnapContext): number {
    const step = this.rotateStep ?? CesiumMath.toRadians(5);
    return this.snapValue(value, step, context);
  }

  public snapScale(value: number, context: SnapContext): number {
    if (!this.scaleStep) {
      return this.applyFineAdjustment(value, context);
    }
    return this.snapValue(value, this.scaleStep, context);
  }

  private snapValue(value: number, step: number, context: SnapContext): number {
    if (context.shiftKey) {
      return value;
    }
    const effectiveStep = context.ctrlKey ? step : step * 0.2;
    if (effectiveStep <= 0) {
      return value;
    }
    const snapped = Math.round(value / effectiveStep) * effectiveStep;
    return context.ctrlKey ? snapped : this.applyFineAdjustment(snapped, context);
  }

  private applyFineAdjustment(value: number, context: SnapContext): number {
    if (!context.shiftKey) {
      return value;
    }
    return value * 0.1;
  }
}
