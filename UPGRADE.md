# Upgrade Guide - v2.0.0

## 重大变更

### TypeScript 迁移
项目已完全迁移到 TypeScript，提供更好的类型安全和开发体验。

### 依赖更新
所有依赖已更新到最新版本：

- **commander**: 2.19.0 → 12.1.0 (最新 CLI 框架)
- **globby**: 8.0.1 → 13.2.2 (现代文件匹配)
- **debug**: 4.1.0 → 4.3.7 (最新调试工具)
- **urllib**: 2.31.1 → 4.5.1 (最新 HTTP 客户端)
- **nunjucks**: 3.1.3 → 3.2.4 (最新模板引擎)
- **eslint**: 5.5.0 → 9.17.0 (最新代码检查)
- **移除 mkdirp** - 使用 Node.js 内置 `fs.mkdir({ recursive: true })`

### Node.js 版本要求
- **最低要求**: Node.js >= 18.0.0
- 推荐使用 Node.js 18 LTS 或更高版本

### 工具链改进
新增开发工具：
- **TypeScript 5.7** - 类型安全
- **Prettier 3.4** - 代码格式化
- **ESLint 9** - 代码质量检查
- **tsx** - TypeScript 执行器

## 新功能

### 类型定义
现在提供完整的 TypeScript 类型定义：
```typescript
import Jar2proxy from 'jar2proxy';
import type { Jar2proxyOptions, ProxyConfig } from 'jar2proxy';
```

### 改进的脚本命令
```json
{
  "build": "tsc",                    // 编译 TypeScript
  "dev": "tsc --watch",              // 监听模式开发
  "lint": "eslint . --fix",          // 代码检查
  "format": "prettier --write ...",  // 代码格式化
  "typecheck": "tsc --noEmit",       // 类型检查
  "build:java": "..."                // 单独构建 Java 部分
}
```

## 迁移指南

### 使用方式
基本使用方式保持不变，但现在支持更好的类型提示：

```typescript
// 使用 TypeScript
import Jar2proxy from 'jar2proxy';

const jar2proxy = new Jar2proxy({
  baseDir: '/path/to/project',
  proxyConfigPath: 'config/proxy.js',
});

await jar2proxy.run();
```

### 配置文件
配置文件格式保持向后兼容，无需修改。

## 开发者说明

### 构建项目
```bash
# 安装依赖
npm install

# 构建 TypeScript
npm run build

# 可选：构建 Java 部分（需要 JDK 8）
npm run build:java
```

### 代码质量
```bash
# 格式化代码
npm run format

# 代码检查
npm run lint

# 类型检查
npm run typecheck
```

## 已知问题

### Java 构建
- Java 代码需要 JDK 8
- 使用较新 JDK 版本时，Java 构建可能需要调整
- 如果遇到 `com.sun.tools.javadoc` 相关错误，请确保使用 JDK 8

## 向后兼容性

v2.0.0 保持了与 v1.x 的 API 兼容性：
- 配置文件格式不变
- CLI 命令不变
- 生成的代理文件格式不变

主要变化在于内部实现和开发体验的提升。
