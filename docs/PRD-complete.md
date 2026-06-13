# 闪象完整流程规划 PRD

## 信息架构（侧边栏）

```
控制台    → /dashboard
新建项目  → /studio
我的项目  → /projects
素材中心  → /assets
设置      → /settings
```

去掉 integrations（合并到设置页）。去掉重复的"新建项目"按钮。

---

## 页面清单 & 完整流程

### 1. Dashboard `/dashboard`
**角色：** 入口控制台
**内容：**
- 欢迎区（品牌蓝背景，问候语+tagline）
- 统计卡片：项目数、生成数、当前套餐
- 最近项目（最多6个）+ 悬浮"继续"按钮
- [新建项目] 按钮 → /studio

**状态：** ✅ 已完成大部分，需微调标签

---

### 2. Studio `/studio`
**角色：** 核心创作区
**入口：** Dashboard[新建项目]、Sidebar[新建项目]、项目详情[继续制作]
**流程：**
```
打开页面 → 显示上传区域
         → 用户上传图片
         → 选择风格/平台
         → 点击"生成"（此时自动创建项目）
         → 等待生成完成
         → 预览结果显示 [下载] [发布] 按钮
         → 不满意可继续调整
```
**关键变化：**
- 不再自动创建项目
- 如果 URL 带 `?projectId=`，加载已有项目继续编辑
- 生成完成后按钮始终可见（不隐藏）
- 如果有 projectId，header 显示"查看项目→"链接

---

### 3. 我的项目 `/projects`
**角色：** 项目列表
**内容：**
- 搜索框 + 状态筛选 + 排序
- 项目卡片网格（第一个项目跨 2 列）
- 每个卡片：缩略图 + 状态标签 + 项目名 + 图片统计
- 悬浮操作：继续、发布、删除
- [新建项目] 按钮 → /studio

**bugfix：** 发布按钮导航到发布页，不直接调 API

---

### 4. 项目详情 `/projects/[id]`
**角色：** 查看/管理单个项目
**内容：**
- 面包屑：我的项目 > 项目名
- 状态标签 + 项目信息
- 两个 Tab：产品图片 | 生成结果
- 操作按钮：[继续制作] [发布/下载] [删除]
- 继续制作 → /studio?projectId=[id]

---

### 5. Detail Images `/projects/[id]/details`
**角色：** 生成商品详情长图
**内容：**
- 面包屑：我的项目 > 项目名 > 详情图
- 选择内容类型（7种）
- 生成
- 结果展示
- [发布/下载] 按钮 → /projects/[id]/publish

**补充：** 允许选择用哪张产品图生成

---

### 6. 发布页 `/projects/[id]/publish`
**角色：** 发布到平台 / 下载
**内容：**
- 面包屑：我的项目 > 项目名 > 发布
- 选择图片（默认不选任何）
- 选择平台
- [下载] 按钮
- [发布] 按钮（仅 publishable 平台）
- 发布结果

**bugfix：** 错误回退到 /dashboard，不再默认全选图片

---

### 7. 素材中心 `/assets`
**角色：** 所有已生成图片的集中管理
**内容：**
- 网格显示所有图片
- 选择模式（批量下载/删除）
- 每张图显示来源项目名，点击跳转到对应项目

---

### 8. 设置 `/settings`
**角色：** 账号管理
**内容：**
- 个人信息
- 平台连接（合并 integrations 到这里）
- 品牌预设
- 套餐管理链接

---

## URL 路由映射

| 当前路由 | 目标路由 | 说明 |
|---|---|---|
| /dashboard | /dashboard | 不变 |
| /studio | /studio | 不变 |
| /products | /projects | 重命名 |
| /products/[id] | /projects/[id] | 重命名 |
| /products/[id]/details | /projects/[id]/details | 重命名 |
| /products/[id]/publish | /projects/[id]/publish | 重命名 |
| /products/new | 删除 | 已被 studio 替代 |
| /integrations | 删除 | 合并到设置 |
| /assets | /assets | 不变 |
| /settings | /settings | 不变 |
| /settings/billing | /settings/billing | 不变 |

---

## 导航图

```
                    登陆
                     │
                     ▼
              ┌── Dashboard ──┐
              │  项目统计      │
              │  最近项目      │
              │  [新建项目]────┼──→ Studio
              └───────────────┘      │
                     │               │ 上传→选风格→生成
                     │               │ ↓
                     │               │ 预览结果
              [我的项目]              │ [下载] [发布]
                     │               │ ↓
                     ▼               │ 跳转发布页
              ┌── 项目列表 ──┐       │
              │  搜索/筛选    │       │
              │  项目卡片     │       │
              │  [新建项目]───┼──→ Studio
              └──────────────┘
                     │
                     ▼
              ┌── 项目详情 ──┐
              │  生成结果     │
              │  [继续制作]───┼──→ Studio?projectId=x
              │  [发布/下载]──┼──→ 发布页
              │  [详情图]─────┼──→ Detail Images
              └──────────────┘
                     │
                     ▼
              ┌── 发布页 ───┐
              │  选图片/平台  │
              │  [下载]      │
              │  [发布]      │
              └─────────────┘
```

## 命名统一

| 中文 | 英文 |
|---|---|
| 控制台 | Dashboard |
| 新建 | New |
| 我的项目 | Projects |
| 素材中心 | Assets |
| 设置 | Settings |
| 继续 | Continue |
| 发布 | Publish |
| 下载 | Download |

## 路由重命名计划

`/products` → `/projects` 需要移动文件夹：
- `src/app/(dashboard)/products/` → `src/app/(dashboard)/projects/`
- 更新所有 import 和 Link 引用
