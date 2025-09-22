const DEFAULT_COLORS = {
  x: [1, 0, 0, 1],
  y: [0, 1, 0, 1],
  z: [0, 0, 1, 1],
  highlight: [1, 0.8, 0.2, 1],
  active: [1, 1, 1, 1],
  view: [1, 1, 1, 1]
};

const HANDLE_DEFINITIONS = [
  { id: 'translate-x', mode: 'translate', type: 'axis', axis: 'x' },
  { id: 'translate-y', mode: 'translate', type: 'axis', axis: 'y' },
  { id: 'translate-z', mode: 'translate', type: 'axis', axis: 'z' },
  { id: 'translate-xy', mode: 'translate', type: 'plane', axes: ['x', 'y'] },
  { id: 'translate-yz', mode: 'translate', type: 'plane', axes: ['y', 'z'] },
  { id: 'translate-xz', mode: 'translate', type: 'plane', axes: ['x', 'z'] },
  { id: 'translate-free', mode: 'translate', type: 'free' },
  { id: 'scale-x', mode: 'scale', type: 'axis', axis: 'x' },
  { id: 'scale-y', mode: 'scale', type: 'axis', axis: 'y' },
  { id: 'scale-z', mode: 'scale', type: 'axis', axis: 'z' },
  { id: 'scale-uniform', mode: 'scale', type: 'uniform' },
  { id: 'rotate-x', mode: 'rotate', type: 'axis', axis: 'x' },
  { id: 'rotate-y', mode: 'rotate', type: 'axis', axis: 'y' },
  { id: 'rotate-z', mode: 'rotate', type: 'axis', axis: 'z' },
  { id: 'rotate-view', mode: 'rotate', type: 'view' }
];

function axisColor(axis, colors) {
  if (axis === 'x') return colors.x;
  if (axis === 'y') return colors.y;
  if (axis === 'z') return colors.z;
  return colors.view;
}

export class GizmoPrimitive {
  constructor(options = {}) {
    this.scene = options.scene;
    this.colors = { ...DEFAULT_COLORS, ...(options.colors ?? {}) };
    this.handles = new Map();
    this.visible = true;
    this.scale = options.scale ?? 1;
    this.collection = null;

    HANDLE_DEFINITIONS.forEach((definition) => {
      const handle = {
        ...definition,
        color: axisColor(definition.axis, this.colors),
        active: false,
        highlighted: false
      };
      this.handles.set(definition.id, handle);
    });

    if (this.scene && globalThis.Cesium) {
      this.collection = new globalThis.Cesium.PrimitiveCollection();
      this.collection.show = this.visible;
      this.scene.primitives.add(this.collection);
      this._createCesiumPrimitives();
    }
  }

  _createCesiumPrimitives() {
    if (!this.collection) return;
    const Cesium = globalThis.Cesium;
    const unit = 1;
    const arrowLength = unit * 0.8;
    const axisThickness = unit * 0.01;
    HANDLE_DEFINITIONS.forEach((handleDef) => {
      if (handleDef.mode === 'translate' && handleDef.type === 'axis') {
        const color = Cesium.Color.fromBytes(
          Math.floor(this.colors[handleDef.axis][0] * 255),
          Math.floor(this.colors[handleDef.axis][1] * 255),
          Math.floor(this.colors[handleDef.axis][2] * 255)
        );
        const geometry = Cesium.CylinderGeometry.createGeometry(
          new Cesium.CylinderGeometry({
            length: arrowLength,
            topRadius: axisThickness,
            bottomRadius: axisThickness,
            vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT
          })
        );
        const instance = new Cesium.GeometryInstance({
          geometry,
          id: handleDef.id,
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(color)
          }
        });
        this.collection.add(new Cesium.Primitive({
          geometryInstances: [instance],
          appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: false })
        }));
      }
    });
  }

  setVisible(show) {
    this.visible = !!show;
    if (this.collection) {
      this.collection.show = this.visible;
    }
  }

  setScale(scale) {
    this.scale = scale;
  }

  updateFrame(frame) {
    this.frame = frame;
  }

  setHighlight(handleId, state) {
    const handle = this.handles.get(handleId);
    if (handle) {
      handle.highlighted = !!state;
    }
  }

  setActive(handleId, state) {
    const handle = this.handles.get(handleId);
    if (handle) {
      handle.active = !!state;
    }
  }

  getHandle(handleId) {
    return this.handles.get(handleId);
  }

  getHandles() {
    return Array.from(this.handles.values());
  }

  destroy() {
    if (this.collection && this.scene) {
      this.scene.primitives.remove(this.collection);
    }
    this.handles.clear();
  }
}

export default GizmoPrimitive;
