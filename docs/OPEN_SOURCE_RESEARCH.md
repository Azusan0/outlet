# 开源项目调研与复用报告

## 1. 文档信息

- 调研日期：2026-10-28
- 目标项目：`outlet`
- 当前阶段：兼容性 POC 后的实现复盘
- 调研方式：官方 README、LICENSE、Release/Tag、`package.json`、关键源码与 GitHub 仓库状态
- 版本原则：以正式 Tag 和锁文件为准，不跟随 `main` 漂移
- 许可证说明：本文是工程判断，不替代法务意见

本报告先回答是否复用、复用哪一层以及风险在哪里。技术选型已确认，本文保留版本与许可证决策依据。

## 2. 结论摘要

最终采用一个电商核心、一个 Marketplace 扩展和一个商城前端起点：

| 角色 | 选择 | 结论 |
| --- | --- | --- |
| 电商核心 | `medusajs/medusa` | 采用，作为唯一商品、价格、库存、购物车、订单、支付、履约核心 |
| 多商家能力 | `mercurjs/mercur` | 采用正式版 v2.3.7 的核心 Marketplace 能力，不另建第二套电商后端 |
| 商城前端起点 | `mercurjs/mercur` Storefront | 采用与 API 同版本的 Marketplace Storefront 工程基座，再改造为 Outlet 租户商城 |
| 店铺装修 | `puckeditor/puck` | 首版不接入，只预留兼容的数据结构；表单式装修稳定后再评估 |
| 前端设计参考 | `vercel/commerce` | 仅参考信息架构、响应式与服务端组件组织，不接它的 Shopify Provider |
| 付费 UI 参考 | Tailwind Plus | 只参考视觉与交互，不复制、再分发或提交未获授权的组件源码 |
| 旧商城模板 | `medusajs/nextjs-starter-medusa` | 不采用，仓库已归档且官方明确迁移到 DTC Starter |

本项目锁定以下兼容基线：

```text
Medusa core: 2.21.2
Mercur: v2.3.7
Node.js: 22 LTS
PostgreSQL: 15+
Redis: 7
```

原因不是 Medusa 2.21.2 最新，而是 Mercur v2.3.7 的 API、Admin、Vendor 和 Storefront 依赖均围绕 `@medusajs/* 2.21.2` 验证。本项目实际将 Storefront 固定到 Medusa 2.21.2、Mercur 2.3.7、Next.js 15.5.24 与 React 18.3.1。DTC Starter 的版本线不同，因此只作为页面组织和数据加载参考，未直接并入运行时。

## 3. 版本与许可证证据

状态核验时间为 2026-10-28。

| 项目 | 锁定版本/Commit | 当前状态 | 许可证 | 主要技术栈 |
| --- | --- | --- | --- | --- |
| Medusa | `v2.22.1`，Release target `5e244c3` | 活跃；调研时最新正式版 | 核心 MIT；EE 目录另授权 | TypeScript、Node、PostgreSQL、Redis |
| DTC Starter | `main@6965d8a` | 活跃 | MIT | Medusa 2.22.1、Next.js 16.3.8、React 19.0.5、Node >=22.23.4；本项目仅参考 |
| Next.js Starter | `main@9818886` | 已归档 | MIT | 已废弃，不再作为新项目起点 |
| Mercur | `v2.3.7`，Tag Commit `57fa9cf` | 活跃 | 核心 MIT；Enterprise 另授权 | Medusa 2.21.2、React 18/19、Next.js、PostgreSQL、Redis |
| Vercel Commerce | `main@f7521d5` | 已归档 | MIT | Next.js 15.6 canary、React 19、Tailwind 4；当前只接 Shopify |
| Puck | `v0.23.0`，Tag Commit `b4204f0` | 活跃，仍为 0.x | MIT | React 18/19、TypeScript；包要求 Node >=20 |

补充事实：

- Medusa `LICENSE` 明确说明：除 `ENTERPRISE-LICENSE.md` 列出的材料外，仓库采用 MIT。
- Medusa 的 RBAC 和 SSO 被列入 Enterprise Materials，不能把 Medusa EE RBAC 当成 MIT 能力列入项目能力清单或 Demo。
- Mercur README 明确列出部分 Enterprise 能力，例如 EAN 匹配与去重、Buy Box、主数据治理、多渠道库存同步、自动分账、Vendor KYC。未购买商业授权时不得启用或宣称这些能力。
- Tailwind Plus 是付费产品。官网页面和许可证页面不能作为组件源码授权证明；未购买前只做原创实现和视觉参考。
- Puck Core 包自身允许 Node >=20 和 React 18/19，但其仓库开发环境要求 Node >=24。只安装发布包与从源码二次开发是两种不同约束。

### 3.1 版本冲突

Mercur v2.3.7 的精确依赖证据：

- `apps/api/package.json`：`@medusajs/* 2.21.2`
- `apps/storefront/package.json`：Next.js 15.5.24、React 19.2.1、`@medusajs/medusa 2.21.2`
- `packages/admin/package.json`：React `^18.0.0`
- `packages/vendor/package.json`：React `^18.0.0`
- `packages/core/package.json`：React `^18.2.0`

因此存在两个必须实测的风险：

1. Mercur 正式版没有跟随 Medusa 2.22.1。混用版本可能表现为类型不匹配、迁移差异或运行时工作流失败。
2. Mercur 的 Admin/Vendor 仍声明 React 18，而 Storefront 使用 React 19。它们应作为独立 workspace 构建，禁止跨应用强行提升为同一个 React 实例；首次安装和构建必须检查 peer dependency 与锁文件。

本项目的处理策略：

- 后端以 Mercur v2.3.7 自带 API 应用为基座，所有 `@medusajs/*` 固定 2.21.2。
- Storefront 以 Mercur v2.3.7 的 Marketplace Storefront 结构为基座，改造租户路由、主题、首页和 Outlet 视觉层。
- DTC Starter 只参考 UI、路由和数据访问模式，不迁移它的后端或版本线。
- 首次提交前先完成 POC 构建；POC 不通过时优先升级到经过验证的新 Mercur 正式版，不直接追 `main`。

## 4. 各项目调研与取舍

### 4.1 Medusa

**可直接复用**

- 商品、变体、价格、价格列表、库存、销售渠道、区域、币种、语言
- 购物车、结账、支付会话、订单、退货、换货、履约
- Admin API、Store API、工作流、模块扩展、事件机制
- 与 PostgreSQL、Redis 的标准部署方式

**需要改造**

- 增加平台租户配置、域名映射、主题配置、页面配置
- 把 Agent、导入、审计等运营能力通过模块、API Route 或独立服务接入
- 为多租户请求增加可信的租户解析与资源边界

**不适合直接假定**

- Medusa 的 `Store` 不是本项目的 SaaS 租户。`v2.22.1` 的 Store 模型主要是默认销售渠道、区域、库存地点、币种、语言和 metadata。
- 商品和订单模型没有通用 `tenant_id` 分区。仅创建多个 Store 或 Sales Channel，不能自动证明所有 API、工作流、索引和缓存都完成强隔离。

**结论**

采用，但只作为电商能力核心。平台租户层必须单独设计，不能把“Medusa 有 Store”直接等同于“Medusa 原生支持 SaaS 多租户”。

### 4.2 Medusa DTC Starter

**可直接复用**

- Next.js App Router 商城结构
- 商品列表、商品详情、变体选择、购物车、结账、客户账户和订单历史
- 多区域、国家识别、服务端数据加载和响应式组件组织
- 与 Medusa Store API 的集成方式

**需要改造**

- 潮流品牌视觉、首页区块、商品卡片、导航和移动端体验
- 从 `[locale]` 路由扩展出可信的租户解析与租户主题
- 把标准 DTC 购物车/结账适配 Mercur Offer、多商家拆单和支付流程
- 将依赖固定到 Medusa 2.21.2 兼容线

**不适合直接复用**

- DTC 的后端应用。后端应采用 Mercur 的 Medusa 应用，不能同时维护 DTC backend。
- 原样品牌素材、示例文案和与目标业务无关的账户流程。

**结论**

不作为本项目的直接基座。它适合作为消费者商城的信息架构参考，但版本线与 Mercur v2.3.7 不一致，直接接入会扩大兼容性风险。

### 4.3 Mercur Storefront

**可直接复用**

- Marketplace 商品列表、商品详情、卖家页、Offer 展示和购物车结构
- 与 Mercur v2.3.7 API 相匹配的客户端类型和请求方式
- Next.js App Router 的商品、结账、账户和订单页面组织

**需要改造**

- 租户路径/域名解析、服务端 publishable key 和购物车 Cookie 命名空间
- Outlet 的主题 Token、首页区块、导航和多租户缓存标签
- 与平台运营后台、Agent、导入和 ERP 审计的边界

**结论**

作为本项目的实际商城前端起点。它与所选 Marketplace 后端版本对齐，适合先保证商品、Offer、卖家和交易链路，再替换视觉与租户配置。

### 4.4 Mercur

**可直接复用的核心能力**

- Seller 入驻、审核、暂停、恢复、终止和删除
- Seller member、邀请、角色和成员权限
- Offer、商品归属、卖家价格、库存与销售渠道关联
- 多卖家购物车校验、按 Seller 拆单、订单组
- 支付拆分工作流和跨 Seller 订单处理
- Commission rate/rule/line 与订单佣金刷新
- Payout account、Payout 和 provider 接口
- Admin/Vendor API、权限定义、Admin/Vendor 面板和集成测试

关键源码证据包括：

- `packages/core/src/modules/{seller,offer,commission,payout}/`
- `packages/core/src/workflows/cart/workflows/complete-cart-with-split-orders.ts`
- `packages/core/src/workflows/commission/`
- `packages/core/src/workflows/payout/`
- `packages/core/src/permissions/`
- `packages/core/src/api/utils/permissions-middleware.ts`
- `integration-tests/http/{seller,offer,order,payment,payouts,permissions}/`

**必须注意**

- Mercur Seller 是“商家”，不天然等于平台客户“租户”。本项目需要显式建立 `Tenant -> Seller(s) + SalesChannel + StorefrontConfig` 映射。
- `permissions-middleware.ts` 在没有启用 resolver 或没有 actor 时会 `grantAll` 并标记未强制执行。启用 Mercur 权限后必须验证它确实进入 enforcement 分支，不能只看路由上有中间件。
- Payout 模块和工作流可复用，但 Stripe Connect、自动分账等生产能力仍需要 provider 配置和端到端验证。
- 自动分账、KYC、EAN 去重、Buy Box、主数据治理和多渠道库存同步属于 Enterprise 边界，不能默认纳入。

**需要改造**

- 平台租户层与 Seller 映射
- 多店铺主题、首页配置、域名和发布流程
- 品牌化 Admin/Vendor 外壳与运营工作台整合
- Agent、知识库、Excel 导入和审计模块

**结论**

采用核心 Marketplace 能力，在 Medusa 上扩展，不替代 Medusa，也不另建第二套订单系统。

### 4.5 Vercel Commerce

**可参考**

- App Router 页面拆分
- 商品列表与详情的数据加载方式
- Server Components、Suspense、响应式布局和可访问性
- 设计系统与空状态处理

**不采用**

- 当前仓库已归档，且默认 Provider 是 Shopify。
- 官方另有 `medusajs/vercel-commerce`，但最后推送停留在 2023 年，属于旧版 Medusa 方案，不能作为新后端模板。
- 不应为了参考页面再引入 Shopify 或第二个电商后端。

**结论**

只做前端设计与工程结构参考。

### 4.6 Tailwind Plus

**可参考**

- 电商导航、商品目录、筛选和响应式布局思路
- 信息密度、间距、可访问状态和移动端交互

**限制**

- 不是开源电商系统，也没有可复用的完整业务后端。
- 付费组件源码的复制、修改、分发和团队使用受购买许可约束。
- 未确认授权前不把其源码、截图资产或模板文件提交到仓库。

**结论**

仅作原创 UI 的视觉参考，不作为依赖或代码来源。

### 4.7 Puck

**可复用潜力**

- React 组件注册表
- `fields` 配置驱动编辑面板
- `Puck` 编辑器和 `Render` 运行时分离
- `Data` 结构中的 `root`、`content`、`zones`
- `onPublish` 保存回调
- 拖拽、预览、组件区域和字段扩展

**首版不接入的原因**

- 当前仍是 `0.x`，公共 API 和数据迁移策略需要持续跟进。
- 本项目的核心难点是租户主题、页面 Schema、草稿/发布、预览和权限，不是拖拽本身。
- 一开始引入可视化编辑器会扩大范围，并让页面数据模型被第三方 API 绑死。

**首版设计约束**

自建页面文档应保持与 Puck 类似的分层：

```text
PageDocument
  schemaVersion
  tenantId
  pageKey
  status: draft | published
  root
  content[]
  zones?
  themeVersion
```

首版使用表单式装修和受控区块注册表。未来接入 Puck 时，只替换编辑器和渲染适配层，不迁移租户、权限、版本和发布记录。

## 5. 多租户与多店铺方案

### 5.1 先区分三个概念

| 概念 | 本项目含义 |
| --- | --- |
| Platform Tenant | 平台客户/品牌方，是配置、权限、数据和计费边界 |
| Seller | Mercur 中的入驻商家，可销售 Offer |
| Sales Channel | Medusa 的销售渠道，用于控制商品可售范围 |

演示阶段建议默认“一个 Tenant 对应一个主 Seller 和一个 Sales Channel”，但数据模型保留一对多关系。这样可以先控制复杂度，又不会把 Seller 错当成租户，后续可以扩展为一个品牌下多个商家。

### 5.2 逻辑隔离方案

建议新增平台侧配置，而不是修改 Medusa 核心表：

```text
Tenant
  id, slug, name, status
  medusa_store_id
  default_sales_channel_id
  metadata

TenantSeller
  tenant_id, seller_id, relation, status

TenantDomain
  tenant_id, host, is_primary, verified_at

TenantTheme
  tenant_id, tokens, logo, typography, version

StorefrontPage
  tenant_id, page_key, status, revision, schema_version, content
```

请求链路：

1. 域名中间件根据 `Host` 查 `TenantDomain`；开发环境支持 `/[tenant]/...`。
2. 服务端解析出 Tenant，不信任客户端传入的 `tenant_id`。
3. API 从登录身份取得 Tenant 和 Seller membership，再映射 Sales Channel。
4. Store API 查询必须携带可信的租户上下文和 publishable key。
5. Admin/Vendor 工作流按 Tenant 与 Seller 双重授权。
6. 跨租户资源统一返回 404，避免泄露资源是否存在。

生产级强隔离仍需单独 POC。至少要覆盖商品、价格、库存、Offer、购物车、订单、支付、佣金、Payout、文件、Agent 会话和知识库。仅靠前端隐藏或 Sales Channel 过滤不能作为安全证明。

### 5.3 多店铺共享代码

采用一个 Monorepo，不复制多套前端：

```text
apps/
  storefront/       # 所有租户共用
  admin/            # 平台运营
  vendor/           # 商家后台
  commerce-api/     # Medusa + Mercur
  ai-service/       # Agent、RAG、导入和审计
packages/
  tenant-config/
  storefront-blocks/
  design-tokens/
  api-client/
  test-fixtures/
```

店铺差异由数据驱动：

- CSS Variables 提供颜色、字体、间距、圆角、图片比例
- Block Registry 提供 Hero、商品网格、专题、品牌故事、活动、Footer 等受控区块
- Navigation 和 Homepage 由租户配置决定
- 组件只能读取主题 Token，不能接受租户任意 CSS/HTML
- 同一份代码通过域名或租户路由输出不同品牌

## 6. 必须自行开发的能力

以下能力不能从三个核心仓库直接获得，必须自行实现：

- 平台 Tenant 模型与可信租户解析
- Tenant、Seller、Sales Channel 的映射和授权
- 租户主题 Token 与设计系统作用域
- 导航、首页、专题页的受控区块 Schema
- 表单式店铺装修后台
- 草稿、不可变 Revision、发布、回滚
- 预览链接、过期时间和租户权限
- 域名绑定、验证、主域名切换
- 每租户 SEO、Sitemap、robots、canonical、Open Graph
- 装修、导入、Agent、权限操作的审计
- 旧 Demo 的 AI、RAG、Excel 导入能力与新电商核心的适配层

## 7. 明确回答六个问题

### 7.1 哪个项目最适合作为商城前端起点？

`mercurjs/mercur` v2.3.7 的 Storefront。它与本项目后端版本线一致，直接提供 Marketplace 商品、Seller、Offer 和交易页面结构。

### 7.2 哪些多商家能力可以直接复用？

Mercur v2.3.7 核心可复用 Seller 生命周期、成员与角色、Offer、多卖家购物车、拆单、支付拆分工作流、订单组、佣金、Payout 基础流程、权限定义以及 Admin/Vendor 面板。Enterprise 功能不算已获得能力。

### 7.3 哪些店铺装修功能必须自行开发？

租户品牌配置、主题 Token、导航、页面区块 Schema、草稿/Revision/发布/回滚、预览、表单式装修、域名映射、SEO 和审计必须自行开发。Puck 只可能在未来替换拖拽编辑器，不替代这些平台能力。

### 7.4 如何共享代码但保持独立主题与首页？

一个 Monorepo 共用 Storefront、组件和 API Client；Tenant 配置、Theme Token、Navigation、PageDocument、Domain 和 SEO 存在数据库中。请求先解析 Tenant，再注入主题变量和页面配置，禁止复制多套前端。

### 7.5 哪些项目存在版本、许可证或集成风险？

- Mercur v2.3.7 固定在 Medusa 2.21.2，与最新 2.22.1 不一致。
- Mercur Admin/Vendor 的 React 18 与 Storefront React 19 存在 peer 差异。
- Medusa RBAC/SSO 属于 EE，不能使用 MIT 口径描述。
- Mercur Enterprise 功能需要商业授权。
- Medusa 核心没有通用租户分区，多租户不能只靠 Store 或 Sales Channel。
- Vercel Commerce 与旧 Medusa Next.js Starter 已归档。
- Puck 仍是 0.x，存在 API 变化风险。
- Tailwind Plus 是付费授权资源，不能直接复制组件源码。

### 7.6 最终采用哪些仓库？

采用：

- `medusajs/medusa` 作为电商核心
- `mercurjs/mercur` v2.3.7 作为 Marketplace 扩展
- `mercurjs/mercur` v2.3.7 的 Storefront 作为消费者商城前端起点

延后：

- `puckeditor/puck` v0.23.0，首版只预留数据模型

只参考：

- `vercel/commerce`
- Tailwind Plus

不采用：

- 已归档的 `medusajs/nextjs-starter-medusa`
- 任何第二套独立电商后端

## 8. 进入开发前的强制 POC

用户确认方案后，第一阶段只做兼容性 POC，不先堆页面：

1. 在独立分支锁定 Medusa 2.21.2、Mercur v2.3.7、Node 22 和 pnpm 锁文件。
2. 启动 API、PostgreSQL、Redis，执行迁移与 seed。
3. 验证 Seller 审核、Offer、跨 Seller 购物车、拆单、佣金和权限 enforcement。
4. 验证 Mercur Storefront 能读取商品、创建购物车并进入结账流程。
5. 验证两个 Tenant 的域名/路径解析、主题变量、配置读取和跨租户 404。
6. 记录安装、构建、迁移、类型和运行时问题到 `docs/DEBUG_LOG.md`。

POC 通过后再进入店铺装修、导入、Agent 与完整回归。任何“安装成功但未验证业务链路”的结果都不能算兼容。

## 9. 官方来源

- Medusa: <https://github.com/medusajs/medusa>
- Medusa v2.22.1: <https://github.com/medusajs/medusa/releases/tag/v2.22.1>
- Medusa 模块文档: <https://docs.medusajs.com/resources/commerce-modules>
- DTC Starter: <https://github.com/medusajs/dtc-starter>
- 已归档 Next.js Starter: <https://github.com/medusajs/nextjs-starter-medusa>
- Mercur: <https://github.com/mercurjs/mercur>
- Mercur v2.3.7: <https://github.com/mercurjs/mercur/releases/tag/v2.3.7>
- Mercur 文档: <https://docs.mercurjs.com/>
- Vercel Commerce: <https://github.com/vercel/commerce>
- Puck: <https://github.com/puckeditor/puck>
- Puck v0.23.0: <https://github.com/puckeditor/puck/releases/tag/v0.23.0>
- Puck 文档: <https://puckeditor.com/docs>
- Tailwind Plus: <https://tailwindcss.com/plus>
- Tailwind Plus License: <https://tailwindcss.com/plus/license>
