import { Viewer, Matrix4, Cartesian3, Color, Quaternion, Entity, Math as CesiumMath } from 'cesium';
import { UniversalManipulator, type ManipulatorTarget } from '../src';

class EntityTarget implements ManipulatorTarget {
  public readonly entity: Entity;
  private readonly viewer: Viewer;
  private readonly baseDimensions?: Cartesian3;

  constructor(entity: Entity, viewer: Viewer) {
    this.entity = entity;
    this.viewer = viewer;
    if (entity.box) {
      this.baseDimensions = Cartesian3.clone(entity.box.dimensions?.getValue(viewer.clock.currentTime) ?? new Cartesian3(1, 1, 1));
    }
  }

  public getMatrix(): Matrix4 {
    return this.entity.computeModelMatrix(this.viewer.clock.currentTime, new Matrix4());
  }

  public setMatrix(matrix: Matrix4): void {
    const translation = Matrix4.getTranslation(matrix, new Cartesian3());
    const rotation = new Quaternion();
    const scale = new Cartesian3();
    Matrix4.decompose(matrix, translation, rotation, scale);
    this.entity.position = translation;
    this.entity.orientation = rotation;
    if (this.entity.box && this.baseDimensions) {
      const scaled = new Cartesian3(
        this.baseDimensions.x * scale.x,
        this.baseDimensions.y * scale.y,
        this.baseDimensions.z * scale.z
      );
      this.entity.box.dimensions = scaled;
    }
  }
}

const viewer = new Viewer('viewer', {
  terrain: undefined,
  infoBox: false,
  selectionIndicator: false,
  baseLayerPicker: true
});

viewer.scene.globe.depthTestAgainstTerrain = true;

function createBox(position: Cartesian3, dimensions: Cartesian3, color: Color): Entity {
  return viewer.entities.add({
    position,
    box: {
      dimensions,
      material: color
    }
  });
}

const boxes = [
  createBox(Cartesian3.fromDegrees(-75.59777, 40.03883, 300), new Cartesian3(200, 200, 200), Color.RED.withAlpha(0.7)),
  createBox(Cartesian3.fromDegrees(-75.6, 40.03883, 300), new Cartesian3(150, 150, 150), Color.GREEN.withAlpha(0.7)),
  createBox(Cartesian3.fromDegrees(-75.59, 40.03883, 300), new Cartesian3(100, 250, 180), Color.BLUE.withAlpha(0.7))
];

const targets = boxes.map((box) => new EntityTarget(box, viewer));

const manipulator = new UniversalManipulator({
  scene: viewer.scene,
  target: targets[0],
  orientation: 'global',
  pivot: 'origin',
  snap: { translate: 0.5, rotate: CesiumMath.toRadians(5), scale: 0.1 }
});

viewer.container.appendChild(manipulator.getHudElement());

let selection: EntityTarget[] = [targets[0]];

function updateSelection(): void {
  const checkboxes = Array.from(document.querySelectorAll('.entity-selector')) as HTMLInputElement[];
  const selectedTargets = checkboxes
    .filter((input) => input.checked)
    .map((input) => targets[parseInt(input.dataset.index ?? '0', 10)]);
  selection = selectedTargets.length > 0 ? selectedTargets : [targets[0]];
  manipulator.setTarget(selection.length === 1 ? selection[0] : selection);
}

function bindControls(): void {
  const mode = document.getElementById('mode') as HTMLSelectElement;
  const orientation = document.getElementById('orientation') as HTMLSelectElement;
  const pivot = document.getElementById('pivot') as HTMLSelectElement;
  const snapTranslate = document.getElementById('snap-translate') as HTMLInputElement;
  const snapRotate = document.getElementById('snap-rotate') as HTMLInputElement;
  const snapScale = document.getElementById('snap-scale') as HTMLInputElement;

  mode.addEventListener('change', () => {
    const value = mode.value as 'translate' | 'rotate' | 'scale';
    manipulator.enable({ translate: value === 'translate', rotate: value === 'rotate', scale: value === 'scale' });
  });

  orientation.addEventListener('change', () => {
    manipulator.setOrientation(orientation.value as any);
  });

  pivot.addEventListener('change', () => {
    manipulator.setPivot(pivot.value as any);
  });

  const updateSnap = () => {
    manipulator.setSnap({
      translate: parseFloat(snapTranslate.value),
      rotate: CesiumMath.toRadians(parseFloat(snapRotate.value)),
      scale: parseFloat(snapScale.value)
    });
  };

  snapTranslate.addEventListener('input', updateSnap);
  snapRotate.addEventListener('input', updateSnap);
  snapScale.addEventListener('input', updateSnap);
}

function bindSelectionControls(): void {
  const checkboxes = Array.from(document.querySelectorAll('.entity-selector')) as HTMLInputElement[];
  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', updateSelection);
  });
  updateSelection();
}

bindControls();
bindSelectionControls();

viewer.zoomTo(viewer.entities);
