# Outlet 测试说明

## 自动化验证

在仓库根目录执行：

```powershell
pnpm --filter @outlet/api test:unit
pnpm --filter @outlet/storefront exec tsc --noEmit
pnpm test:tenant-client
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
- Agent 只能执行白名单只读查询以及 ERP 预览，不能直接执行 ERP 写入。

## 部署验收

1. API `/health` 返回 `OK`。
2. 数据库迁移、租户 seed 和管理员初始化均可重复运行。
3. 反向代理只公开 API 与 Storefront，数据库和 Redis 不映射公网。
4. SSE 代理关闭 buffering，并设置足够的读取超时。
5. 生产日志不出现 API Key、密码、私钥和完整上传内容。

## 已知限制

- Demo 只支持已有 Offer SKU 的价格和库存更新，不静默创建或删除商品。
- 扫描型 PDF 需要外部 OCR，本版本不会假装识别成功。
- ERP 外部系统需要真实 Webhook 合同；`ERP_SIMULATE=true` 只能用于明确标记的演示。
- 浏览器的静态构建成功不等于支付供应商和真实外部 ERP 已完成端到端联调。
