# Project Todo List

## ✅ 已完成
- [x] 统一操纵器框架：`UniversalManipulator` 组合 Gizmo、Picker、控制器、Pivot/Snapper 与 HUD，并提供模式、枢轴与尺寸配置。 【F:src/UniversalManipulator.js†L1-L117】
- [x] 交互控制器：在拖拽时锁定相机、请求重绘、记录历史，并支持撤销/重做接口。 【F:src/ManipulatorController.js†L312-L365】【F:src/ManipulatorController.js†L858-L906】
- [x] ENU 解算与多目标枢轴：拖拽会在局部 ENU 中求解并按枢轴模式写回所有目标。 【F:src/ManipulatorController.js†L476-L720】
- [x] 拾取优先级与屏幕坐标：GizmoPicker 返回手柄元数据供 HUD 与 Hover 使用。 【F:src/GizmoPicker.js†L1-L124】
- [x] Gizmo 可视化：轴/平面/圆环/均匀缩放手柄具备屏幕等比、高亮与视图环对齐逻辑。 【F:src/GizmoPrimitive.js†L240-L452】
- [x] 吸附与微调：`Snapper` 支持 Ctrl 吸附和 Shift 微调，拖拽中可解析键入单位。 【F:src/Snapper.js†L1-L40】【F:src/ManipulatorController.js†L296-L333】【F:src/ValueParser.js†L1-L67】
- [x] HUD 反馈：拖拽时显示模式/轴、实时数值与输入缓冲。 【F:src/HudOverlay.js†L1-L56】
- [x] 文档与示例：README 提供安装、API 说明，示例页面演示多选与吸附配置。 【F:README.md†L1-L68】【F:examples/index.html†L1-L110】
- [x] 示范面板覆盖 Normal/Gimbal Orientation，并暴露撤销按钮与键入指南。 【F:examples/index.html†L20-L138】【F:examples/src/styles.css†L1-L58】
- [x] README 记录撤销/重做、数值输入与单位支持，补全交互说明。 【F:README.md†L37-L86】
- [x] 针对高纬度、极端视角、requestRenderMode 场景添加端到端测试，验证拾取优先级与拖拽稳定性。 【F:tests/run-tests.js†L1-L280】
- [x] 处理负缩放后的法线修正或面剔除一致性，满足镜像操作安全性要求。 【F:src/ManipulatorController.js†L1-L949】
- [x] 记录并监控性能指标（帧率、内存分配），确保满足 60 FPS 与低 GC 的质量门槛，并在示例中展示监控结果。 【F:src/PerformanceMonitor.js†L1-L78】【F:src/UniversalManipulator.js†L1-L121】【F:examples/index.html†L1-L174】

## ⏳ 待完成
- _暂无任务_
