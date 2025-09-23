# Cesium Universal Manipulator 用户操作手册

本手册介绍如何在 CesiumJS 1.133 场景中使用 **Cesium Universal Manipulator** 进行平移、旋转和缩放操作。内容覆盖环境准备、交互方式、HUD 与数值输入、吸附及撤销/重做等高级功能，帮助你在复杂的地理场景中稳定控制单个或多个对象。

## 1. 环境准备

1. 引入 Cesium CDN 资源：

   ```html
   <link
     rel="stylesheet"
     href="https://cdn.jsdelivr.net/npm/cesium@1.133.0/Build/Cesium/Widgets/widgets.css"
   />
   <script>
     window.CESIUM_BASE_URL = "https://cdn.jsdelivr.net/npm/cesium@1.133.0/Build/Cesium/";
   </script>
   <script src="https://cdn.jsdelivr.net/npm/cesium@1.133.0/Build/Cesium/Cesium.js"></script>
   ```

2. 安装库并构建：

   ```bash
   npm install cesium-universal-manipulator
   npm run build
   ```

3. 在代码中初始化操纵器：

   ```js
   import { UniversalManipulator } from 'cesium-universal-manipulator';

   const manipulator = new UniversalManipulator({
     Cesium,
     viewer,
     target: entityOrArray,
     mode: 'translate',
     orientation: 'global',
     pivot: 'origin',
     snap: {
       translate: 1.0,
       rotate: Cesium.Math.toRadians(5),
       scale: 0.1,
     },
     size: {
       screenRadius: 110,
       minScale: 0.2,
       maxScale: 2.5,
     },
   });
   ```

## 2. 目标对象与枢轴

- **目标对象**：支持 `Cesium.Entity`、`Cesium.Model`、自带 `matrix/modelMatrix` 的对象或实现了 `getWorldMatrix()/setMatrix()` 的封装体。多选时可以传入数组。
- **枢轴 (Pivot)**：
  - `origin`：对象原点。
  - `median`：多选时的几何中心。
  - `cursor`：3D Cursor 位置。
  - `individual`：对多选每个对象独立变换。
- 通过 `manipulator.setPivot(pivot)` 切换；枢轴影响数值显示与旋转缩放中心，但不会改变平移方向。

## 3. 模式与手柄

### 3.1 平移（Translate）

- **单轴箭头**：红/绿/蓝箭头圆锥分别沿 X/Y/Z 轴移动。
- **平面手柄**：两轴之间的半透明方片在对应平面内移动（XY、YZ、XZ）。
- **自由移动**（可选）：允许在视图平面上拖拽。
- **Orientation**：
  - `global`：对齐世界轴。
  - `local`：沿对象局部轴移动（对象已旋转时箭头随姿态变化）。
  - `enu`/`view`/`normal`/`gimbal`：按需选择 ENU、本地视图、法线或万向节框架。
- **Pivot**：仅影响 HUD 中的参考点，不会改变平移方向。

### 3.2 缩放（Scale）

- **单轴缩放**：红/绿/蓝小立方体沿 X/Y/Z 缩放，对应快捷键 S+X/Y/Z。
- **均匀缩放**：中心白色方块均匀缩放（S）。
- **Pivot**：决定缩放中心（Origin/Median/Cursor/Individual）。
- **Orientation**：仅影响单轴缩放方向（Global vs Local 等）。
- **负数输入**：输入负比例会触发镜像，可能翻转法线，应谨慎使用。

### 3.3 旋转（Rotate）

- **三轴圆环**：红/绿/蓝环分别绕 X/Y/Z 旋转（R+X/Y/Z）。
- **白色外环**：按当前视图方向自由旋转（View）。
- **Pivot**：旋转枢轴即变换中心。
- **Orientation**：支持 Global/Local/View/ENU/Normal/Gimbal，切换后圆环朝向随之更新。

## 4. 交互流程

1. **Hover**：将指针移到手柄上，高亮显示。
2. **Drag**：按下鼠标左键并拖拽；HUD 实时显示 ΔX/ΔY/ΔZ、角度或缩放因子。
3. **Release**：松开左键提交变换；拖拽过程中按 <kbd>Esc</kbd> 或鼠标右键可取消并还原。

> **移动端**：缺少 Hover，可通过单击手柄进入激活状态，然后拖拽。

## 5. 键盘与数值输入

- **吸附（Snap）**：拖拽时按 <kbd>Ctrl</kbd> 应用配置的吸附步长；按 <kbd>Shift</kbd> 降低灵敏度以微调。
- **数值输入**：拖拽过程中直接输入数值并按 <kbd>Enter</kbd> 提交。
  - 距离：支持 `m/cm/km`，如 `2m`、`15cm`、`0.5km`。
  - 角度：输入 `90`、`-30` 或 `45°`。
  - 缩放：输入比例因子（如 `2`、`0.5`、`-1`）。
- **取消**：<kbd>Esc</kbd> 或右键放弃当前拖拽，HUD 显示将恢复初始状态。

## 6. HUD 与可视反馈

- HUD 默认附加在 `viewer.container` 中，可通过 `hudContainer` 自定义容器。
- 显示内容：
  - 当前模式与轴名称。
  - 位移（米）、旋转（度）或缩放因子。
  - Snap 状态与输入缓冲区。
- 手柄在 Hover/Active 状态下会改变颜色和粗细，屏幕等比缩放保证不同距离下尺寸一致。

## 7. 撤销 / 重做

- 每次拖拽提交都会记录前后矩阵，可调用 `manipulator.undo()` 或 `manipulator.redo()`。
- Demo 面板提供按钮示例，可参考实现快捷键绑定。

## 8. 性能与数值稳定

- 采用 ENU 局部坐标解算，避免高纬度或大坐标范围导致的误差。
- 非均匀缩放后会重新正交化旋转矩阵，确保 R/S 分离。
- 使用 `scene.requestRender()` 在交互期间刷新画面，闲置时遵循 Cesium 的惰性渲染模式。
- 内置 `PerformanceMonitor` 提供 FPS、帧时间、内存的滚动统计，可通过 `getPerformanceMetrics()` 查看并在 Demo HUD 中显示。

## 9. 常见操作示例

| 操作 | 步骤 |
| --- | --- |
| 沿 Y 轴移动 | Hover 绿箭头 → 按住左键拖拽 → HUD 显示 ΔY |
| 在 XY 平面移动 | Hover XY 平面手柄 → 拖拽 → HUD 显示 ΔX/ΔY |
| 沿 Z 轴缩放 | Hover 蓝色缩放方块 → 拖拽或输入比例 |
| 均匀缩放 | Hover 白色中心方块 → 拖拽或输入比例 |
| 绕 X 轴旋转 | Hover 红色圆环 → 拖拽或输入角度 |
| 按视图旋转 | Hover 白色外环 → 拖拽 |
| 精确位移 10 米 | 拖拽时输入 `10m` → Enter |
| 微调旋转 2° | 拖拽时按住 Shift，输入 `2` 或通过 Snap 设置 5° 并 Shift 调整 |
| 取消变换 | 拖拽过程中按 Esc 或鼠标右键 |
| 撤销上一步 | 调用 `manipulator.undo()` |
| 重做 | 调用 `manipulator.redo()` |

## 10. API 速查

- `setTarget(target | target[])`
- `setMode('translate' | 'rotate' | 'scale')`
- `setOrientation(orientation | { type, normal?, gimbal? })`
- `setPivot('origin' | 'median' | 'cursor' | 'individual')`
- `enable({ translate?, rotate?, scale? })`
- `setSnap({ translate?, rotate?, scale? })`
- `setSize(screenRadius, minScale, maxScale)`
- `undo()` / `redo()`
- `destroy()`
- `getPerformanceMetrics()` / `resetPerformanceMetrics()`

## 11. 故障排查

- **DeveloperError: Could not project point (0, 0, 0) to 2D**：确保目标实体拥有有效的世界矩阵；如未分配目标，可维持默认占位框架。
- **normalized result is not a number**：通常是平面手柄几何退化导致；确认操纵器已接收有效帧信息。
- **手柄不可见或不随距离缩放**：检查 `setSize` 配置以及相机是否启用对数深度；操纵器默认关闭深度测试但保留拾取。

## 12. 清理

完成后调用 `manipulator.destroy()` 以移除 primitive、事件监听及 HUD 元素，避免内存泄漏。

---

如需更多示例，请打开 `examples/index.html`，通过面板切换 Mode、Orientation、Pivot、Snap 步长、手柄尺寸和颜色，以全面体验操纵器功能。
