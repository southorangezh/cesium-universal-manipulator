import { Cartesian3, Matrix4 } from 'cesium';
import type { ManipulatorTarget, Pivot } from './types';
import { cartesianArrayMedian } from '../utils/cesium';

export interface PivotResult {
  pivotPoint: Cartesian3;
  perTarget?: Map<ManipulatorTarget, Cartesian3>;
}

export class PivotResolver {
  private cursorPosition: Cartesian3 | undefined;

  public setCursor(position: Cartesian3 | undefined): void {
    this.cursorPosition = position ? Cartesian3.clone(position, new Cartesian3()) : undefined;
  }

  public resolve(targets: ManipulatorTarget[], pivot: Pivot): PivotResult {
    switch (pivot) {
      case 'median':
        return this.resolveMedian(targets);
      case 'cursor':
        return this.resolveCursor(targets);
      case 'individual':
        return this.resolveIndividual(targets);
      case 'origin':
      default:
        return this.resolveOrigin(targets);
    }
  }

  private resolveOrigin(targets: ManipulatorTarget[]): PivotResult {
    const first = targets[0];
    const matrix = this.getMatrix(first);
    const translation = Matrix4.getTranslation(matrix, new Cartesian3());
    return { pivotPoint: translation };
  }

  private resolveMedian(targets: ManipulatorTarget[]): PivotResult {
    const positions = targets.map((target) => Matrix4.getTranslation(this.getMatrix(target), new Cartesian3()));
    const median = cartesianArrayMedian(positions);
    return { pivotPoint: median };
  }

  private resolveCursor(targets: ManipulatorTarget[]): PivotResult {
    if (!this.cursorPosition) {
      return this.resolveMedian(targets);
    }
    return { pivotPoint: Cartesian3.clone(this.cursorPosition, new Cartesian3()) };
  }

  private resolveIndividual(targets: ManipulatorTarget[]): PivotResult {
    const perTarget = new Map<ManipulatorTarget, Cartesian3>();
    targets.forEach((target) => {
      const translation = Matrix4.getTranslation(this.getMatrix(target), new Cartesian3());
      perTarget.set(target, translation);
    });
    const first = perTarget.get(targets[0]);
    return { pivotPoint: first ?? new Cartesian3(), perTarget };
  }

  private getMatrix(target: ManipulatorTarget): Matrix4 {
    if ('getMatrix' in target) {
      return target.getMatrix();
    }
    return target.matrix;
  }
}
