import { HANDLE_TYPES } from './constants.js';

const HANDLE_PRIORITIES = {
  [HANDLE_TYPES.TRANSLATE_AXIS]: 3,
  [HANDLE_TYPES.SCALE_AXIS]: 3,
  [HANDLE_TYPES.ROTATE_AXIS]: 3,
  [HANDLE_TYPES.TRANSLATE_PLANE]: 2,
  [HANDLE_TYPES.SCALE_UNIFORM]: 1,
  [HANDLE_TYPES.ROTATE_VIEW]: 1,
};

function cloneCartesian(Cesium, value) {
  if (!value) return null;
  if (Cesium?.Cartesian3 && value instanceof Cesium.Cartesian3) {
    return value;
  }
  if (typeof value.x === 'number' && typeof value.y === 'number' && typeof value.z === 'number') {
    if (Cesium?.Cartesian3) {
      return new Cesium.Cartesian3(value.x, value.y, value.z);
    }
    return { x: value.x, y: value.y, z: value.z };
  }
  return null;
}

function averagePositions(Cesium, positions, dropLastDuplicate = false) {
  if (!Array.isArray(positions) || !positions.length) {
    return null;
  }
  const length = dropLastDuplicate && positions.length > 1 ? positions.length - 1 : positions.length;
  let count = 0;
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  for (let i = 0; i < length; i++) {
    const position = positions[i];
    if (!position) continue;
    const cart = cloneCartesian(Cesium, position);
    if (!cart) continue;
    sumX += cart.x;
    sumY += cart.y;
    sumZ += cart.z;
    count++;
  }
  if (count === 0) {
    return null;
  }
  if (Cesium?.Cartesian3) {
    return new Cesium.Cartesian3(sumX / count, sumY / count, sumZ / count);
  }
  return { x: sumX / count, y: sumY / count, z: sumZ / count };
}

export class GizmoPicker {
  constructor(scene, gizmo) {
    this.scene = scene;
    this.gizmo = gizmo;
    this.Cesium = gizmo?.Cesium;
    this._scratchCanvas = this.Cesium?.Cartesian2 ? new this.Cesium.Cartesian2() : null;
  }

  _priorityForHandle(handle) {
    if (!handle) return 0;
    return HANDLE_PRIORITIES[handle.type] ?? 0;
  }

  _handleWorldPosition(handle) {
    if (!handle) return null;
    const Cesium = this.Cesium;
    const entity = handle.entity;
    if (!entity) return null;
    const positions = entity.polyline?.positions;
    switch (handle.type) {
      case HANDLE_TYPES.TRANSLATE_AXIS:
      case HANDLE_TYPES.SCALE_AXIS: {
        if (Array.isArray(positions) && positions.length) {
          const tip = positions[positions.length - 1];
          return cloneCartesian(Cesium, tip);
        }
        if (entity.billboard?.position) {
          return cloneCartesian(Cesium, entity.billboard.position);
        }
        if (entity.point?.position) {
          return cloneCartesian(Cesium, entity.point.position);
        }
        break;
      }
      case HANDLE_TYPES.TRANSLATE_PLANE: {
        if (Array.isArray(positions) && positions.length) {
          return averagePositions(Cesium, positions, true);
        }
        const hierarchy = entity.polygon?.hierarchy;
        const hierarchyPositions = hierarchy?.positions ?? hierarchy?.getValue?.();
        if (hierarchyPositions) {
          return averagePositions(Cesium, hierarchyPositions, true);
        }
        break;
      }
      case HANDLE_TYPES.ROTATE_AXIS:
      case HANDLE_TYPES.ROTATE_VIEW: {
        if (Array.isArray(positions) && positions.length) {
          return averagePositions(Cesium, positions, true);
        }
        break;
      }
      case HANDLE_TYPES.SCALE_UNIFORM: {
        if (entity.point?.position) {
          return cloneCartesian(Cesium, entity.point.position);
        }
        break;
      }
      default:
        break;
    }
    if (entity.position) {
      const value = typeof entity.position.getValue === 'function' ? entity.position.getValue() : entity.position;
      return cloneCartesian(Cesium, value);
    }
    return null;
  }

  _screenPositionForHandle(handle) {
    if (!this.scene?.cartesianToCanvasCoordinates) {
      return null;
    }
    const world = this._handleWorldPosition(handle);
    if (!world) {
      return null;
    }
    let canvasPosition = null;
    try {
      if (this._scratchCanvas) {
        canvasPosition = this.scene.cartesianToCanvasCoordinates(world, this._scratchCanvas);
      } else {
        canvasPosition = this.scene.cartesianToCanvasCoordinates(world);
      }
    } catch (error) {
      canvasPosition = null;
    }
    if (!canvasPosition) {
      return null;
    }
    return { x: canvasPosition.x, y: canvasPosition.y };
  }

  _buildPickResult(id, handle, entity) {
    if (!handle) return null;
    return {
      id,
      mode: handle.mode,
      axis: handle.axis,
      plane: handle.plane,
      type: handle.type,
      priority: this._priorityForHandle(handle),
      screenPosition: this._screenPositionForHandle(handle),
      entity,
    };
  }

  pick(position) {
    if (!this.scene) return null;
    const picked = this.scene.pick(position);
    if (!picked) return null;
    const entity = picked.id ?? picked;
    const id = typeof entity === 'string' ? entity : entity.id;
    if (!id) return null;
    const handle = this.gizmo.handles.get(id);
    return this._buildPickResult(id, handle, entity);
  }

  drillPick(position) {
    if (!this.scene?.drillPick) {
      return this.pick(position);
    }
    const picks = this.scene.drillPick(position, 10) ?? [];
    let best = null;
    for (const picked of picks) {
      const entity = picked?.id ?? picked;
      const id = typeof entity === 'string' ? entity : entity?.id;
      if (!id) continue;
      const handle = this.gizmo.handles.get(id);
      if (!handle) continue;
      const result = this._buildPickResult(id, handle, entity);
      if (!result) continue;
      if (!best || result.priority > best.priority) {
        best = result;
      }
    }
    return best;
  }
}
