# Outlet 测试说明

## 自动化验证

在仓库根目录执行：

```powershell
pnpm --filter @outlet/api test:unit
pnpm --filter @outlet/storefront exec tsc --noEmit
pnpm test:tenant-client
pnpm test:cookie-security
pnpm build
pnpm peers check
```

当前测试覆盖表格解析、知识库去重、Agent 本地降级、流式 LLM 解析，以及真实 Store SDK 请求中的租户头和租户缓存标签隔离。完整构建同时检查 API、Admin、Vendor 和 Storefront；Storefront 构建不跳过 TypeScript 错误。

## API 冒烟清单

### 多租户

- 两个租户可以读取各自目录、主题和首页。
- 使用租户 A 的路径读取租户 B 的商品、Seller、Offer、购物车时返回不可见或 404。
- 未认证用户和无效租户头不能访问运营接口。
- `viewer` 角色不能执行导入、ERP 或店铺写操作。

### Excel 导入

使用 `examples/outlet-import-template.xlsx` 或本地生成脚本创建测试文件：

```powershell
pnpm generate:template
```

验证合法文件可以预览；非法价格、库存、重复 SKU、危险公式、缺少 SKU 和 create/delete 操作会被标记；存在错误的批次不能 commit；相同批次重复 commit 返回幂等结果。

### ERP

- `dry_run` 返回 `would_update` 且不写入商品数据。
- `execute` 更新合法的库存或价格。
- 相同租户、相同幂等键和相同 payload 重放时返回 `idempotent_replay: true`。
- 相同幂等键但 payload 不同返回冲突。
- 没有 Webhook 且未显式打开模拟开关时，不把外部同步伪装成成功。

### Agent

- 未配置模型 Key 时仍可使用确定性工具降级，并返回工具来源。
- 配置 OpenAI-compatible 服务后，SSE 至少包含工具开始、工具结果、文本和结束事件。
- 真实 DeepSeek 验收必须确认 `done.mode=ai`；只看到 HTTP 200 或 `done` 不能证明调用了外部模型。
- Provider 工具名只能使用字母、数字、下划线和连字符；内部审计名称可以保留点号，但发送前必须映射为兼容别名。
- Agent 只能执行白名单只读查询以及 ERP 预览，不能直接执行 ERP 写入。

## 部署验收

1. API `/health` 返回 `OK`。
2. 数据库迁移、租户 seed 和管理员初始化均可重复运行。
3. 反向代理只公开 API 与 Storefront，数据库和 Redis 不映射公网。
4. SSE 代理关闭 buffering，并设置足够的读取超时。
5. 生产日志不出现 API Key、密码、私钥和完整上传内容。
6. `NEXT_PUBLIC_BASE_URL` 必须与浏览器公开入口协议一致。生产建议 HTTPS；仅 HTTP 演示入口无法使用 Secure Cookie，不能用于真实账号或支付数据。
7. 商品加入购物车后刷新页面，明细仍存在；切换租户不能看到另一店铺的购物车。

## 已知限制

- Demo 只支持已有 Offer SKU 的价格和库存更新，不静默创建或删除商品。
- 扫描型 PDF 需要外部 OCR，本版本不会假装识别成功。
- ERP 外部系统需要真实 Webhook 合同；`ERP_SIMULATE=true` 只能用于明确标记的演示。
- 浏览器的静态构建成功不等于支付供应商和真实外部 ERP 已完成端到端联调。
- 不同 Variant 共用同一条码会被数据库唯一约束拒绝；当前不会自动合并、覆盖或忽略该冲突。
- 本轮冻结前，真实 Excel 提交已触发库存关系、变体替换和测试条码问题；相关代码与单测已修复，但尚未重新发布和完成云端端到端复验。

## 2026-10-28 本轮收口验收

### 已通过

- `pnpm --filter @outlet/api test:unit`：7 个测试套件、19 个用例通过。
- `pnpm --filter @outlet/api exec tsc --noEmit`：通过，无输出。
- `pnpm --filter @outlet/storefront exec tsc --noEmit`：本轮修改后通过。
- `pnpm test:tenant-client`：2 个用例通过，覆盖租户请求头和缓存标签隔离。
- `pnpm test:cookie-security`：3 个用例通过，覆盖 HTTP/HTTPS Cookie 策略。
- `pnpm test:request-cache`、`pnpm test:image-loader`：分别 3 个、2 个用例通过。
- 公网 API 健康检查此前返回成功；容器状态为 `outlet-api-1` healthy，Storefront、PostgreSQL、Redis 均为 `Up`。
- DeepSeek Agent 真实请求此前返回 `done.mode=ai`，并包含工具调用轨迹。
- Excel 预览接口此前返回 HTTP 201、`total=2`、`valid=2`，确认文件解析和预览数据正常。

### 未通过/未覆盖

- 真实 Excel 提交尚未完整通过：历史失败记录为 Offer 库存关系缺失、同商品变体被替换、测试条码唯一约束。
- 本轮新增的 API 契约和导入修复尚未发布到公网生产镜像。
- Agent 库存工具的云端复验、订单详情最终浏览器复验未在本轮冻结范围内执行。
- 知识库新增/搜索、ERP dry-run/execute/幂等、Vendor 租户隔离尚未完成最终统一冒烟。
- 1024px、移动端和桌面端最终视觉回归矩阵未完整覆盖。
- 最后一轮全仓 `pnpm build` 和 `pnpm peers check` 未在冻结前重跑；当前结论仅限已列出的自动化与运行状态证据。
