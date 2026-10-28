# Outlet 架构说明

## 目标

Outlet 是一个单体仓库、多应用、多租户的电商运营 Demo。Medusa 负责商品、价格、库存、购物车、结账和订单；Marketplace 扩展负责 Seller、Offer、多卖家购物车和订单组；平台侧模块负责 Tenant、主题、页面配置、导入、知识库、Agent 与 ERP 审计。

## 应用边界

```text
Storefront ── Store API ──┐
Admin ─────── Admin API ──┼── Medusa + Marketplace
Vendor ────── Vendor API ─┘          │
                                     ├── Tenant module
                                     ├── Operations module
                                     ├── Knowledge module
                                     ├── PostgreSQL
                                     └── Redis
```

- `apps/storefront`：面向消费者的租户商城，共用组件和数据访问代码。
- `apps/admin`：平台运营界面，包含店铺配置、Excel 导入、知识库、Agent、ERP 与审计。
- `apps/vendor`：Seller 运营界面，复用 Marketplace 的商家能力。
- `packages/api`：Medusa API、Marketplace 集成以及平台自定义路由和模块。

## 租户模型

平台租户、Seller 和 Sales Channel 是三个不同概念：

```text
Tenant
  ├── TenantMembership -> Admin user + role
  ├── TenantSeller     -> Marketplace seller
  ├── Sales Channel     -> Store API 可售范围
  ├── StorefrontTheme   -> 主题 Token
  └── StorefrontPage    -> 首页配置
```

请求先通过服务端中间件解析租户上下文。运营接口再从认证身份检查 membership；商品、Offer、Seller、购物车和运营数据都在服务端校验租户关系。跨租户资源统一按不可见处理，避免通过资源 ID 推断其他租户数据。

Storefront 的 `/north` 与 `/field` 只是演示路由，不是安全边界。生产部署应优先使用经过验证的域名映射，并在网关和 API 层同时保留租户校验。

## 运营链路

1. **Excel 导入**：上传文件 -> 识别表头 -> 逐行校验 -> 保存预览批次 -> 人工选择 -> 幂等提交。
2. **知识库**：上传文本型文件 -> 清洗和切分 -> BM25 检索 -> Agent 返回引用。扫描型 PDF 不做伪 OCR。
3. **Agent**：SSE 输出 `tool_start`、`tool_result`、`token`、`done` 等事件；工具默认只读，ERP 只生成预览，不由模型直接执行写入。
4. **ERP 同步**：服务端校验 `target`、数据行和幂等键；`dry_run` 不写数据，`execute` 使用本地更新流程或明确配置的 Webhook，并将结果写入审计。
5. **店铺配置**：表单保存主题和首页配置，按租户写入并触发 Storefront 重新验证。

## 关键安全约束

- 不信任客户端提交的 `tenant_id`，租户来自请求上下文和认证 membership。
- 上传限制 5 MB、2,000 行；危险公式、重复 SKU 和非法条码会阻止提交。
- Agent 工具限制在服务端白名单，不允许模型自由调用任意 URL 或 SQL。
- ERP 使用租户范围内的幂等键；同键不同 payload 返回冲突。
- `.env`、私钥、API Key、真实货单和内部账号只保留在部署环境或 `docs/local/`，不得提交。
