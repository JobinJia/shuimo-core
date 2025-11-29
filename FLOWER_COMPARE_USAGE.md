# 花朵对比工具使用说明

## 访问地址

启动 playground 后访问:
```
http://localhost:3001/flower-compare
```

## 功能说明

### 每次点击生成新的随机花朵

**行为:**
1. 点击 "🎲 Generate Both (New Random Seed)" 按钮
2. 自动生成一个新的随机种子(基于时间戳 + 随机字符串)
3. **两边同时**使用这个**相同的种子**生成花朵

**预期结果:**
- 左边: 原版 Canvas 实现
- 右边: SVG 实现
- **两个花朵应该完全相同**

### 种子显示

- 种子输入框是**只读**的
- 每次点击按钮会自动更新
- 格式: `{timestamp}-{random}` (例如: `1732835200000-a3f2k`)

### 验证方法

#### 1. 视觉对比
直接用肉眼对比两边的花朵:
- 植物类型(woody 或 herbal)应该相同
- 形状、颜色、位置应该完全一致
- 如果看起来不同,说明实现有问题

#### 2. 控制台日志对比
打开浏览器控制台(F12),查看日志:

**原版日志:**
```
int seed [数字]
// ... 其他日志
```

**SVG 日志(带 🌺 标记):**
```
🌺 [1] After seed, first 3 randoms: [0.xxx, 0.xxx, 0.xxx]
🌺 [2] After makeBG(), next 3 randoms: [0.xxx, 0.xxx, 0.xxx]
🌺 [3] After generate() paper, next 3 randoms: [0.xxx, 0.xxx, 0.xxx]
🌺 [4] Plant type decision random: 0.xxx → woody/herbal
🌺 [5] Generating woody/herbal plant
```

**检查点:**
- 种子应该相同
- 植物类型决定的随机数应该相同
- 选中的植物类型应该相同

## 常见问题

### Q: 为什么每次生成的花朵都不一样?
A: 这是正常的!每次点击都会生成新的随机种子。重点是**两边使用相同种子时应该生成相同的花朵**。

### Q: 如何测试特定的种子?
A: 目前界面不支持手动输入种子。如果需要测试特定种子:
1. 打开浏览器控制台
2. 运行以下代码:
```javascript
// 测试原版
window.location.href = '/reference-code/flowers/index.html?seed=test-123'

// 测试 SVG(需要在 generateFlower 调用中手动设置)
```

或者直接访问:
- 原版: `http://localhost:3001/reference-code/flowers/index.html?seed=YOUR_SEED`
- SVG: 需要修改代码中的 seed 参数

### Q: 两边的花朵不一样,怎么排查?
A: 按以下步骤排查:

1. **检查控制台日志:**
   - 原版的 `int seed` 值
   - SVG 的 `🌺 [1]` 到 `🌺 [5]` 各个检查点

2. **对比关键随机数:**
   - Step 4 的 "Plant type decision random" 是否相同?
   - 如果不同,说明前面的随机数消费次数不匹配

3. **查看详细诊断:**
   - 阅读 `flower-generation-diagnosis.md`
   - 查看 `FLOWER_FIX_SUMMARY.md`

## 技术细节

### 随机数序列匹配

为了确保两边生成相同的花朵,关键是确保随机数序列完全匹配:

```
Seed → PRNG 初始化(10次预热)
  ↓
makeBG() → paper() 第一次调用
  ↓ (消费 ~202,243 次随机数)
generate() → paper() 第二次调用
  ↓ (消费 ~198,147 次随机数)
Math.random() <= 0.5 → 决定植物类型
  ↓ (第 400,391 个随机数!)
woody() / herbal() → genParams() → 生成参数
```

如果任何一步的消费次数不匹配,后续的所有随机数都会不同!

### 验证工具

项目中提供了额外的验证工具:

1. **`verify-original-sequence.html`**
   - 直接测试原版的随机数序列
   - 打印关键检查点的值

2. **`test-random-sequence-fixed.html`**
   - 自动对比原版和 SVG 版本的随机序列
   - 显示每个检查点是否匹配

## 开发注意事项

### 修改 generateFlower() 函数时

如果修改 `packages/core/src/drawing/Flower.ts`,必须确保:

1. **顺序不能变**: 严格按 Step 1-5 的顺序执行
2. **次数必须匹配**: 每个 `paper()` 调用消费的随机数次数必须相同
3. **不要优化**: 即使某些计算不需要,也要执行以消费随机数

### 测试流程

修改代码后:
1. 重启 dev 服务器: `pnpm playground dev`
2. 访问 `/flower-compare`
3. 点击 10 次 "Generate Both"
4. 检查是否所有花朵都匹配
5. 如果有不匹配,检查控制台日志

## 参考文档

- `flower-generation-diagnosis.md` - 详细的问题诊断
- `FLOWER_FIX_SUMMARY.md` - 修复总结
- `reference-code/flowers/main.js` - 原版实现
