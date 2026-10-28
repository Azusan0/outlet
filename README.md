# Outlet

一个可运行的多租户电商与 AI 运营平台。以 Medusa 为唯一电商核心，使用 Mercur 的商家、Offer、多卖家购物车和订单组能力，在其上扩展店铺装修、表格导入、只读 Agent、租户知识库与 ERP 审计。

## 已实现

- **多租户商城**：`/north`、`/field` 两个独立店铺，独立 Publishable Key、销售渠道、主题、首页、区域与购物车 Cookie。
- **完整交易链路**：商品目录、详情、卖家 Offer、购物车、结账、按 Seller 拆单与订单组，复用 Medusa/Mercur，不维护第二套订单系统。
- **服务端隔离**：商品、Offer、Seller、购物车按租户校验；运营接口按用户 membership 和角色授权；知识、导入、同步与审计均保存 `tenant_id`。
- **表单式装修**：主题色、公告、首页文案与主图配置，保存后触发对应店铺缓存刷新。
- **Excel / CSV 导入**：中文/英文表头映射、重复 SKU、价格、库存、条码、公式校验、逐行预览和人工提交。当前支持已有 Offer SKU 的价格与库存更新，不静默处理新增或删除。
- **AI 运营助手**：DeepSeek OpenAI-compatible API、SSE、有限轮次工具调用与超时控制；工具覆盖商品、库存、订单/履约诊断、知识检索和 ERP 预览。无模型 Key 时使用真实工具的确定性降级，不使用模拟业务结果。
- **租户知识库**：文本、Markdown、文本型 PDF 上传，清洗切分、BM25 检索、引用定位、去重与软删除恢复。扫描型 PDF 需要 OCR，本版本不伪造识别结果。
- **ERP 与审计**：dry-run / execute、幂等键、行级结果、失败记录、可配置 HTTP Webhook。`ERP_SIMULATE=true` 只用于明确标注的模拟演示。

## 工程难点与解决

这个项目不是模板拼接，而是在 Medusa + Mercur 上做多租户扩展时，真实遇到并修掉的工程问题。下面挑了 8 个最能体现工程判断的点，完整记录（含持续过程与验证命令）见 [`docs/DEBUG_LOG.md`](docs/DEBUG_LOG.md)。

| # | 问题现象 | 根因 | 解决手段 |
| --- | --- | --- | --- |
| 1 | Admin 构建报 `Cannot find module '@outlet/api/_generated'`，补跑 codegen 时卡在访问 GitHub `canary` 清单 | 直接构建 API 不会生成路由类型；Mercur CLI 默认从可变的 `canary` 分支拉清单，网络被重置，且各应用可能拿到不同清单导致不可复现构建 | 把 v2.3.7 对应的路由清单固定为本地构建输入，用官方 `MERCUR_ROUTES_MANIFEST_URL` 读取；用 Node `--import` 只拦截自定义清单协议，不改第三方包。构建从此可复现 |
| 2 | `pnpm install` 返回 `ERR_PNPM_IGNORED_BUILDS`（`@swc/core`、`esbuild`、`sharp`） | pnpm 11 默认不执行依赖安装脚本，`pnpm rebuild` 也不改安装审批状态 | 在 `pnpm-workspace.yaml` 同时声明 `allowBuilds` 与 `onlyBuiltDependencies`，只放行依赖树真正需要的原生构建 |
| 3 | Excel 价格提交报 `Cannot read properties of undefined (reading 'currency_code')`，多个 Offer 价格悬空 | 实现先 `updateProductsWorkflow` 重写共享 Variant PriceSet，再更新 Offer，破坏了按 `offer_id` 隔离的 Offer 专属价格链接 | 价格只经 `updateOffersWorkflow` 更新当前 Offer；商品名/条码走 Product 工作流但不再提交 `prices`；读取时过滤悬空 `null`，并补单测覆盖 |
| 4 | 直接用 filter 查商品/Seller/Offer，无法证明所有查询路径都收敛到当前租户 | Marketplace 框架的 filter 并非所有自定义组合查询都自动落成最终资源边界 | Store 路由先解析租户允许的商品与 Seller ID 并在服务端显式相交；跨租户资源统一 404，不靠前端隐藏 |
| 5 | Store SDK 注入租户头的代码类型报错，且并发请求共享租户状态 | `@mercurjs/client` 的 `fetchOptions` 是标准 `RequestInit`，请求由 SDK 内部调用全局 `fetch`，不接受自定义 `fetch` 回调；全局 `sdk` 会串租户 | 每次端点调用独立解析服务端租户，通过 `fetchOptions.headers` 注入 Publishable Key；缓存请求附 `tenant-{slug}` 标签，恢复严格类型并补并发测试 |
| 6 | 生产日志 `redisUrl not found`，回退到 fake Redis、本地事件总线、内存锁 | 服务器已设 `REDIS_URL`，但 `medusa-config.ts` 未映射到 `projectConfig.redisUrl` | 显式读取 `REDIS_URL`，并显式启用 Redis Event Bus、Redis Locking、Redis Workflow Engine |
| 7 | API 容器循环重启，`sh: 1: medusa: not found` | 生产 artifact 的 `node_modules` 在 `/app/packages/api/node_modules`，而运行目录是 `.medusa/server`，`pnpm start` 不沿用 workspace 链接 | 保留 compiled server 工作目录，改用父目录绝对路径 `.../node_modules/.bin/medusa` 启动 |
| 8 | Agent 接口返回 HTTP 200 + SSE，但事件只有 `error`，没有 `tool_start/tool_result/token/done` | 配置模型 Key 后固定走外部模型，鉴权/超时/网络错误被顶层捕获后直接结束，没有复用已实现的本地工具模式 | 保留外部模型优先；失败时发 `status(fallback)` 再跑本地只读工具并 `done(mode=demo)`，补 provider 401 回归测试 |

> 这些问题的共同点：大多数不是"写错一行代码"，而是**版本线、构建可复现性、租户隔离边界、幂等与容错**这些真正的工程边界。记录里每条都保留了"现象 → 根因 → 处理 → 验证"四段，便于面试时还原真实排错过程。

## 架构

```text
Next.js Storefront ── Store API ── Medusa 2.21.2 + Mercur 2.3.7
                                      │
Admin / Vendor panels ─ Admin API ────┼── Tenant + Operations + Knowledge
                                      ├── PostgreSQL
                                      └── Redis

Agent ── SSE ── 受控只读工具 ── DeepSeek（可选）
ERP execute ── 幂等任务 ── 本地工作流或管理员配置的 Webhook
```

Tenant（平台客户）不等于 Seller（商家），也不等于 Sales Channel（销售渠道）。一个 Tenant 可以包含多个 Seller；商品是 Mercur 共享主档，卖家通过 Offer 提供 SKU、价格与库存。

## 本地开发

要求：Node.js 22、pnpm 11.25、PostgreSQL 16、Redis 7。Windows 下推荐使用 PowerShell。

```powershell
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install
Copy-Item packages/api/.env.template packages/api/.env
# 填写数据库、Redis、JWT_SECRET、COOKIE_SECRET 和公开地址
pnpm --filter @outlet/api exec medusa db:migrate
pnpm --filter @outlet/api exec medusa user -e admin@example.com -p "replace-me"
pnpm --filter @outlet/api seed
pnpm --filter @outlet/api seed:tenants
pnpm dev
```

种子脚本输出每个租户的 Publishable Key。仅在服务端设置 `OUTLET_BOOTSTRAP_KEY` 和 `OUTLET_TENANT_INDEX`，不要将密钥提交到仓库或暴露到客户端环境变量。

## 验证

```powershell
pnpm build
pnpm --filter @outlet/api test:unit
pnpm --filter @outlet/storefront exec tsc --noEmit
pnpm test:tenant-client
pnpm peers check
```

`docs/DEBUG_LOG.md` 记录实际发生的构建、运行和部署问题，以及根因、修复和验证方式。业务边界与测试方法见 `docs/ARCHITECTURE.md`、`docs/TESTING.md`。

## 环境变量

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` / `REDIS_URL` | Medusa 持久化与 Redis |
| `JWT_SECRET` / `COOKIE_SECRET` | 服务端认证，必须为随机值 |
| `STORE_CORS` / `ADMIN_CORS` / `VENDOR_CORS` / `AUTH_CORS` | 允许访问的来源，按实际部署配置 |
| `FILE_BACKEND_URL` | 上传文件的公开 URL 前缀 |
| `OUTLET_BOOTSTRAP_KEY` / `OUTLET_TENANT_INDEX` | Storefront 服务端租户索引 |
| `STOREFRONT_REVALIDATE_URL` / `STOREFRONT_REVALIDATE_SECRET` | 商城缓存刷新 |
| `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` | 可选模型服务，默认 DeepSeek Chat |
| `ERP_WEBHOOK_URL` / `ERP_WEBHOOK_TOKEN` | 可选 ERP 执行端点 |
| `ERP_SIMULATE` | 显式启用模拟 ERP；不设置时不冒充外部同步成功 |

## 部署与许可

生产镜像由 `packages/api/Dockerfile` 与 `apps/storefront/Dockerfile` 构建，`deploy/docker-compose.production.yml` 提供 API、Storefront 与 Redis 编排。数据库和 Redis 应使用私有网络；公网通过反向代理暴露。

基于 Mercur 的 MIT 核心模块开发，复用 Medusa MIT 核心能力。Mercur Enterprise、Medusa EE 能力、Tailwind Plus 付费组件均未使用。具体版本、许可证和取舍见 `docs/OPEN_SOURCE_RESEARCH.md` 与 `NOTICE.md`。
