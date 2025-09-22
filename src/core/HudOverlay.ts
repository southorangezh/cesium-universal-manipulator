import { Cartesian3, Math as CesiumMath } from 'cesium';
import type { DeltaTransform } from './types';

export interface HudOverlayOptions {
  container?: HTMLElement;
}

export class HudOverlay {
  private readonly element: HTMLElement;
  private readonly translationEl: HTMLElement;
  private readonly rotationEl: HTMLElement;
  private readonly scaleEl: HTMLElement;

  constructor(options: HudOverlayOptions = {}) {
    this.element = options.container ?? document.createElement('div');
    this.element.className = 'cum-hud';
    this.translationEl = document.createElement('div');
    this.rotationEl = document.createElement('div');
    this.scaleEl = document.createElement('div');
    this.translationEl.className = 'cum-hud__translation';
    this.rotationEl.className = 'cum-hud__rotation';
    this.scaleEl.className = 'cum-hud__scale';
    this.element.append(this.translationEl, this.rotationEl, this.scaleEl);
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public update(delta: DeltaTransform): void {
    this.translationEl.textContent = `ΔX ${delta.translation.x.toFixed(3)} m | ΔY ${delta.translation.y.toFixed(3)} m | ΔZ ${delta.translation.z.toFixed(3)} m`;
    const angle = CesiumMath.toDegrees(2 * Math.acos(delta.rotation.w));
    this.rotationEl.textContent = `Δθ ${angle.toFixed(2)}°`;
    this.scaleEl.textContent = `Scale ${delta.scale.x.toFixed(3)} ${delta.scale.y.toFixed(3)} ${delta.scale.z.toFixed(3)}`;
  }

  public reset(): void {
    this.translationEl.textContent = 'ΔX 0 m | ΔY 0 m | ΔZ 0 m';
    this.rotationEl.textContent = 'Δθ 0°';
    this.scaleEl.textContent = 'Scale 1 1 1';
  }
}
