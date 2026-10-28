# 问题与验证记录

这里只记录实际发生并能复现的工程问题，便于后续维护和排查。每条都按 **现象 → 根因 → 处理 → 验证** 记录，尽量保留可复现的触发路径和验证命令，而不是只写结论。

## 概览

按问题域归类，方便快速定位。编号与下方详录标题一一对应。

| 类别 | 条目 | 一句话根因 |
| --- | --- | --- |
| 构建可复现性 | Mercur codegen 依赖 canary 分支 | 路由清单从可变分支下载，网络被重置且不可复现 |
| 依赖与安装 | pnpm 11 被依赖构建策略阻断 | pnpm 11 默认不跑依赖安装脚本 |
| 依赖与安装 | 后台无法解析 i18next | 模板宿主应用未显式声明运行时依赖，Yarn 提升掩盖了问题 |
| 类型与构建 | 新运营模块严格 TS 构建失败 | JSON 读取类型不能无条件当地业务数组 |
| 类型与构建 | Storefront Docker 构建缺路由类型生成 | 镜像只复制了 API package.json，没带固定清单和 codegen 脚本 |
| 多租户隔离 | 全局商品主档导致租户货品交叉 | 商品是共享主档，Seller/Offer 与 Sales Channel 才决定可售边界 |
| 多租户隔离 | 路由未强制租户关系过滤 | 框架 filter 不自动等于最终资源边界 |
| 多租户隔离 | Store SDK 未注入租户凭证且构建跳过类型错误 | `fetchOptions` 不接受自定义 `fetch`，全局 sdk 串租户 |
| 业务数据一致性 | Offer 价格导入改写共享 Variant PriceSet | 先重写 Variant 价格删掉了 Offer 专属价格链接 |
| 业务数据一致性 | Excel 提交用部分 Variant 更新商品 | 更新工作流把未提交的同商品 Variant 当成删除项 |
| 业务数据一致性 | 库存工具和导入查错 Offer 库存关系 | Marketplace 库存挂在 Offer 的 `inventory_items.inventory`，不是 Variant 的 `inventory_item_link` |
| 业务数据一致性 | 库存地点销售渠道关联用错工作流 | 该关系须用专门的 link 工作流，不能按普通 link 猜 schema |
| 接口契约 | Excel 预览行标识依赖字段别名 | 后端只返回 `id`，前端同时兼容多种别名，部署版本容易漂移 |
| 购物车 | 刷新后明细消失且 Seller 显示 `undefined` | HTTP 下强制 Secure Cookie、删除未 await，且行项目未补齐 Seller |
| 订单读取 | 订单详情关系过深且 `fields` 数组被 SDK 编码 | 默认展开超过 3 层，数组参数被编码成 `fields[0]` |
| 运行时配置 | Medusa 未使用已配置的 Redis | `REDIS_URL` 未映射到 `projectConfig.redisUrl` |
| 部署与运行 | API 运行镜像找不到 Medusa CLI | 运行目录与 `node_modules` 目录不一致，未沿用 workspace 链接 |
| 容错与降级 | 外部模型失败导致 Agent 只返回 error | 失败被顶层捕获后直接结束，未复用本地工具降级 |
| Windows 本地环境 | OpenSSH 私钥 ACL 拒绝连接 | 私钥继承他人写权限，权限过宽被拒 |
| Windows 本地环境 | here-string 经 SSH 产生 CRLF | PowerShell 管道发送保留 CRLF，末行路径带 `\r` |
| Windows 本地环境 | Medusa Jest 脚本不能在 Windows 执行 | 脚手架用 POSIX 环境变量赋值 |
| 操作安全 | CLI 参数曾携带管理员密码 | 便捷参数不适合长期凭据 |
| 缓存刷新 | 商品事件刷新请求发往 Storefront 首页 | 同一变量被当完整接口 URL 和基础 URL 两种语义 |
| AI 协作过程 | 长构建轮询无退出条件，空耗上下文 | 轮询判据看进程而非日志哨兵，且无硬超时 |

## 2026-10-28 Windows OpenSSH 因私钥 ACL 拒绝连接

- 现象：`ssh -i` 返回 `Bad permissions` 和 `UNPROTECTED PRIVATE KEY FILE`，随后 `Permission denied (publickey)`。
- 根因：密钥继承了其他 Windows 用户的修改权限，OpenSSH 拒绝读取权限过宽的私钥，不是服务器认证失败。
- 处理：仅对该私钥关闭 ACL 继承，保留当前管理员和 SYSTEM 的访问权限，不复制、上传或提交私钥。
- 验证：同一密钥可通过 BatchMode SSH 连接并执行容器健康检查。

## 2026-10-28 PowerShell here-string 经 SSH 产生 CRLF 配置

- 现象：初始化脚本末尾出现 `cannot access '/home/ubuntu/outlet/api.env'$'\r'`。
- 根因：PowerShell 把本地 here-string 通过管道发送给 Linux bash 时保留 CRLF，导致末行路径带 `\r`。
- 处理：部署脚本显式转换为 LF；服务器只修复本次尚未使用的初始化文件，不批量改写文件。
- 验证：配置文件恢复为 Unix 换行，数据库连接参数仅保存在服务器受限权限的 env 文件中。

## 2026-10-28 Medusa Jest 脚本不能在 Windows 执行

- 现象：`TEST_TYPE=unit ...` 返回 `'TEST_TYPE' is not recognized as an internal or external command`。
- 根因：脚手架脚本使用 POSIX 环境变量赋值，在 Windows 默认 shell 中不成立。
- 处理：使用项目显式声明的 `cross-env` 设置测试类型和 Node 参数，保持 Linux CI 与 Windows 本地相同入口。
- 验证：重新安装锁文件后执行 `pnpm --filter @outlet/api test:unit`。

## 2026-10-28 新运营模块严格 TypeScript 构建失败

- 现象：新增 Excel/ERP 路由后出现 JSON 类型收窄、Medusa JSON DTO 数组约束和审计枚举类型错误。
- 根因：Medusa 生成的 `model.json()` 读取类型不能无条件视为业务数组；创建方法也需要与模型定义一致的对象或对象数组。
- 处理：对持久化 JSON 先做运行时数组判断；显式声明审计状态枚举；让 Offer 价格与 Mercur DTO 对齐。
- 验证：完整 `medusa build`，不能只依赖跳过 TypeScript 的前端构建。

## 2026-10-28 pnpm 11 安装被依赖构建策略阻断

- 现象：首次依赖下载完成后，`pnpm install` 返回 `ERR_PNPM_IGNORED_BUILDS`，涉及 `@swc/core`、`esbuild`、`sharp` 等包。
- 根因：pnpm 11 默认不运行依赖的安装脚本。仅运行 `pnpm rebuild` 不会修改安装审批状态。
- 处理：在 `pnpm-workspace.yaml` 同时声明 `allowBuilds` 和 `onlyBuiltDependencies`，只放行当前依赖树确实需要的原生构建。
- 验证：`pnpm install` 成功，`@outlet/api` 的 Medusa 后端构建成功。

## 2026-10-28 Mercur codegen 依赖 canary 分支导致后台无法编译

- 现象：Admin 构建报 `Cannot find module '@outlet/api/_generated'`；补跑 codegen 时提示无法获取 `https://raw.githubusercontent.com/mercurjs/mercur/canary/packages/cli/routes-manifest.json`。
- 根因：直接构建 API 不会生成路由类型，且 Mercur CLI 默认从可变的 `canary` 分支下载清单；当前网络访问该地址被重置。不同应用各自拿到不同清单也会带来不可复现构建。
- 处理：将 Mercur v2.3.7 tag 对应的路由清单作为构建输入保存，通过 CLI 官方的 `MERCUR_ROUTES_MANIFEST_URL` 配置读取。临时的本地 HTTP 服务在子进程内也无法访问，因此改用 Node 的 `--import` 只拦截自定义清单协议，其他网络请求仍走原生 `fetch`，不修改第三方包。
- 验证：运行 `pnpm --filter @outlet/api codegen` 和根目录 `pnpm build`，要求后台 TypeScript 编译不再跳过错误。

## 2026-10-28 pnpm 下 Admin/Vendor 无法解析 i18next

- 现象：路由类型问题解决后，两个后台的 Vite 构建都报 `Rollup failed to resolve import "i18next"`。
- 根因：Mercur 后台运行时需要 i18next，但模板的宿主应用没有显式声明该运行时依赖；原 Yarn 提升方式会隐藏这一问题。
- 处理：在两个实际使用方中声明 `i18next`，并按模板提升规则保留公共可解析入口；不把前端依赖 externalize 到生产浏览器。
- 验证：重新安装后执行完整 Turborepo 构建。

## 2026-10-28 Offer 价格导入改写共享 Variant PriceSet

- 现象：Excel 价格提交在 Offer 更新阶段报 `Cannot read properties of undefined (reading 'currency_code')`；提交前商品 Variant 价格更新已运行，导致共享 PriceSet 中多个 Offer 的价格链接悬空。
- 根因：实现先用 `updateProductsWorkflow` 重写 Variant 的 `prices`，再调用 `updateOffersWorkflow`。Marketplace 的多个 Offer 共用 Variant PriceSet，但价格通过 `offer_id` 规则隔离；重写 Variant 价格会删除或替换 Offer 专属价格 ID，后续读取到空链接时又未过滤 `null`。
- 修复：价格只通过 `updateOffersWorkflow` 更新当前 Offer；商品名称与条码仍由 Product 工作流处理，但不再提交 `prices`；Offer 价格列表过滤悬空 `null` 项。
- 数据恢复：演示租户内 3 个已发布 Offer 的 6 条悬空链接已清理，并基于仍存活的 PriceSet 价格重建独立 Offer 价格。原 Offer 的专属金额已无法从被删除记录追溯，因此恢复为存活价格集的金额；此处仅涉及合成演示数据。
- 验证：新增导入工作流单测，覆盖 `null` 价格链接和不调用共享 Product 价格更新；API 冒烟测试需再验证合法提交、重放和 ERP 幂等流程。

## 2026-10-28 Store SDK 未注入租户凭证且构建跳过类型错误

- 现象：恢复 Storefront 严格类型检查后，租户请求头注入代码因把 `fetch` 放入 `fetchOptions` 而报类型错误；Next.js 配置此前启用 `ignoreBuildErrors`，完整构建不会暴露该问题。
- 根因：`@mercurjs/client` 的 `fetchOptions` 是标准 `RequestInit`，请求由 SDK 内部调用全局 `fetch`；它不接受自定义 `fetch` 回调，因此不会运行原本写在该属性里的租户头逻辑。全局 `sdk` 还必须避免并发请求共享租户状态。
- 修复：为每次 SDK 端点调用独立解析服务端租户，再通过标准 `fetchOptions.headers` 注入当前租户的 Publishable Key；缓存请求附加 `tenant-{slug}` 标签，并恢复严格类型构建。
- 验证：新增两个 Node 测试，使用真实 `@mercurjs/client` 并发请求验证租户头、缓存标签、旧头覆盖与输入不可变；需完成后续全量构建及 API 冒烟复验。

## 2026-10-28 全局商品主档导致租户货品交叉

- 现象：初始化种子中同一共享商品可能同时挂到两个租户渠道，目录隔离看起来只由页面路由决定。
- 根因：Marketplace 商品是共享主档，Seller/Offer 与销售渠道关系才决定可售边界；种子脚本重复分配商品不能代表租户隔离。
- 修复：种子保持幂等，并让每个演示商品只关联一个租户；Store API 仍按租户关系做服务端过滤。
- 验证：API 冒烟检查每租户目录与跨租户资源访问；不能用客户端隐藏商品替代服务端隔离。

## 2026-10-28 Marketplace 路由未强制执行租户关系过滤

- 现象：仅给 Mercur 商品、Offer 和 Seller 查询设置 filter，不足以证明所有查询路径都已缩小到当前租户范围。
- 根因：框架/Marketplace 的请求过滤字段并非所有自定义组合查询都自动落实为最终资源边界。
- 修复：Outlet Store 路由在查询前解析租户允许的商品与 Seller ID，并在服务端显式相交；购物车及运营接口另做租户关系校验。
- 验证：API 冒烟应分别读取两租户目录，并用另一租户资源 ID 验证不可见或 404。

## 2026-10-28 库存地点销售渠道关联使用错误工作流

- 现象：租户 seed 尝试用通用 Link 写入无效的 stock-location 关联。
- 根因：该关系应使用 Medusa 提供的销售渠道关联工作流，不能按普通实体 link 猜测 schema。
- 修复：改用 `linkSalesChannelsToStockLocationWorkflow` 建立关系，并保持 seed 可重复运行。
- 验证：重跑 seed 后检查地点与销售渠道关联、API 健康状态及库存读取。

## 2026-10-28 CLI 参数曾携带管理员密码

- 现象：Medusa 用户初始化命令将密码作为命令行参数传入，可能暴露在终端历史或进程参数中。
- 根因：便捷 CLI 参数不适用于需要保密的长期凭据。
- 处理：轮换演示管理员密码，只保留在本地忽略文件和受限部署环境；后续不得把参数回显、密码或访问密钥写入提交。
- 验证：使用本地脚本登录 API 并确认运行日志、仓库暂存区不包含敏感值；不输出密码本身。

## 2026-10-28 商品事件缓存刷新请求发往 Storefront 首页

- 现象：店铺配置保存会请求 `/api/revalidate`，但商品/Offer 事件订阅器直接请求 `STOREFRONT_REVALIDATE_URL`，同一个环境变量无法同时满足两种路径规则。
- 根因：订阅器把变量当完整接口 URL，店铺配置路由却把它当 Storefront 基础 URL。
- 修复：统一将变量定义为 Storefront 基础 URL，两个调用方都追加 `/api/revalidate`；生产基础 URL包含 `/outlet` base path。
- 验证：部署后用主题保存和商品更新分别检查 revalidate 接口返回成功，并确认页面缓存更新。

## 2026-10-28 Medusa 未使用已配置的 Redis

- 现象：生产迁移日志提示 `redisUrl not found`，并回退到 fake Redis、本地事件总线与内存锁。
- 根因：服务器已设置 `REDIS_URL`，但 `medusa-config.ts` 未将它映射到 `projectConfig.redisUrl`。
- 修复：显式读取 `process.env.REDIS_URL`，并在模块配置中显式启用 Redis Event Bus、Redis Locking Provider 和 Redis Workflow Engine。
- 验证：数据库迁移已完成；API 容器日志确认 `event-bus-redis`、`locking-redis` 和 `workflow-engine-redis` 均已建立连接，容器健康检查通过。

## 2026-10-28 Storefront Docker 构建缺少路由类型生成

- 现象：Storefront 容器构建在严格类型检查阶段报 `Cannot find module '@outlet/api/_generated'`。
- 根因：本地根构建会先执行 API codegen，但 Storefront Dockerfile 只复制 API 的 `package.json`，没有复制固定路由清单和 codegen 脚本。
- 修复：镜像构建时复制 `packages/api/scripts`，先执行 API codegen，再执行 Storefront production build。
- 验证：修复后的 Storefront 镜像已完成生产构建并部署；本地全仓构建的 Storefront、Admin、Vendor 和 API 四个 package 全部通过。

## 2026-10-28 API 运行镜像工作目录找不到 Medusa CLI

- 现象：API 容器循环重启，日志为 `sh: 1: medusa: not found`，并提示当前目录的 `package.json` 没有本地 `node_modules`。
- 根因：生产 artifact 的 `node_modules` 位于 `/app/packages/api/node_modules`，而运行工作目录是 `/app/packages/api/.medusa/server`；通过 `pnpm start` 查找脚本二进制时没有沿用父目录的 workspace 链接。
- 修复：保留 compiled server 工作目录，改用父目录中已安装的绝对路径 `/app/packages/api/node_modules/.bin/medusa` 启动。
- 验证：重建 API runtime 镜像并重新启动容器后，`/health` 返回 `200 OK`，容器状态为 `healthy`。

## 2026-10-28 外部模型失败导致 Agent 只返回 error

- 现象：云端完整冒烟中 Agent 接口返回 HTTP 200 和 SSE，但事件序列只有 `error`，没有 `tool_start`、`tool_result`、`token` 和 `done`。
- 根因：配置了模型 Key 后 Agent 固定走外部模型；鉴权、超时或网络错误被顶层捕获后直接结束，没有复用已经实现的本地工具模式。
- 修复：保留外部模型优先策略；模型请求失败时发送 `status(fallback)`，再执行本地只读工具并返回 `done(mode=demo)`，同时补一个 provider 401 回归测试。
- 验证：`@outlet/api` 单元测试 6 个套件、15 个用例通过；云端 Agent SSE 已复验包含 `status`、`tool_start`、`tool_result`、`token` 和 `done`，外部模型不可用时可稳定降级为本地只读工具模式。

## 2026-10-28 商品详情退货文案残留家具模板词

- 现象：鞋类商品详情页的退货说明出现 `return the chair`，与当前商品类型不一致。
- 根因：Storefront 继承的通用商品模板保留了家具类示例文案，数据接口本身没有返回这段文字。
- 修复：将固定模板文案改为商品无关的 `return the item`，避免在不同品类下产生错误业务语义。
- 验证：重新执行 Storefront TypeScript 检查和生产构建，并在公网商品详情页确认文案已更新。

## 2026-10-28 长构建同步轮询无退出条件，空耗上下文

- 现象：AI 编码助手在远程 Docker 镜像构建期间，用 `Start-Sleep 25~30` + `ssh "pgrep ... && tail 日志"` 每半分钟同步轮询一次，持续约两小时没有推进任何代码改动；会话 token 持续增长、单次日志输出可达上万 token，但过程没有任何报错，看起来"一直在正常编译"。
- 根因：两点叠加。其一，轮询判据用 `pgrep -f build-api.sh` 判断"是否结束"，脚本执行期被改动/重建后，进程判据与实际状态脱节，一直判为 `RUNNING`；其二，循环没有"看到 `API_BUILD_FINISHED` 哨兵行就退出"的终止条件，也没有总超时。日志尾部只是不断重复 vite 打包输出，没有 error 字样，于是模型每轮都生成"仍在编译、不是挂起"的推理并继续 `Sleep`，把重复日志反复灌回上下文。
- 处理：改用日志哨兵行判断结束（`grep -q API_BUILD_FINISHED`），并用日志 `mtime` 停滞超过阈值判定疑卡死；给循环加硬上限（如 15 次 × 30s），超限即停止并汇报；长构建改为后台 `nohup` 运行、一次性取结果，不做同步反复拉日志。
- 验证：远程实测 `pgrep -af build-api.sh` 为空、日志末行 `API_BUILD_FINISHED`、镜像 `outlet-api:latest` 已生成、容器 `Up (healthy)`，证明构建其实早已完成，问题出在轮询判据与终止条件，而非构建本身。
- 附带暴露的问题：`build-api.sh` 末尾残留一个孤立的 `^M`（CRLF），导致 `/bin/sh: 7: : not found`，是"PowerShell here-string 经 SSH 产生 CRLF"问题的复发，写脚本时须显式转 LF。

## 排错方法小结

- **先分清"卡在执行"还是"卡在观察"**：长任务要区分"进程还在做"与"我在反复看它做"，后者加硬超时和哨兵，别用无退出的同步轮询。
- **判据要选权威且单调的信号**：优先日志里的完成哨兵行 / 退出码，而不是进程名匹配、文件存在性或会话状态。
- **先看权威现状再改代码**：远程问题先 `ps`、日志、容器状态、`docker images` 对齐事实，再决定动作。
- **每个修复都留可复现的验证**：记录触发路径和验证命令，避免"看起来好了"。
- **边界问题优先**：多租户、幂等、容错、可复现构建，这些比单个语法错误更能体现工程能力。

## 2026-10-28 DeepSeek 工具名含点号导致 400 并误走 fallback

- **现象**：云端 Agent 接口返回 HTTP 200，SSE 也包含工具事件，但 `done.mode` 为 `demo`，实际没有完成 DeepSeek 工具调用；状态事件中的原始错误为 `Invalid 'tools[0].function.name'`。
- **根因**：OpenAI-compatible 工具协议要求函数名匹配 `^[a-zA-Z0-9_-]+$`，此前把便于审计展示的 `knowledge.search`、`inventory.health` 等点号名称直接发送给 DeepSeek，导致 provider 在请求校验阶段返回 HTTP 400；Agent 随后按设计降级到本地工具模式。
- **修复**：对外协议改用 `knowledge_search`、`inventory_health`、`catalog_search`、`order_diagnose`、`erp_preview`，服务端收到工具调用后通过映射恢复内部点号名称；SSE 和审计继续展示可读的业务名称。
- **验证**：本地新增工具调用回归测试；重新构建并替换云端 API runtime 镜像后，真实请求返回 `done.mode=ai`，事件包含 `token`、`tool_start`、`tool_result`、`done`，且不再出现 fallback。

## 2026-10-28 HTTP 演示站购物车刷新后为空且 Seller 为 `undefined`

- **现象**：商品可加入购物车，但刷新后行项目消失；部分购物车和结账视图中的 Seller 显示 `undefined`。
- **根因**：HTTP 演示入口仍写入 `Secure` Cookie，浏览器不会在后续 HTTP 请求中发送；删除 Cookie 的异步调用未 `await`；购物车行项目只读取了变体关系，没有从当前租户的 Offer/Seller 关系补齐卖家。
- **处理**：根据公开入口协议决定 Cookie 的 `Secure` 属性；删除 Cookie 改为等待完成；购物车读取时按 Offer 和租户 Seller 映射补齐真实卖家，并保留未登录结账跳转登录及登录后回跳。
- **验证**：`pnpm test:cookie-security` 的 3 个用例通过；浏览器复验加入商品后刷新仍能看到行项目，Seller 显示实际店铺名而不是 `undefined`。

## 2026-10-28 Excel 预览有数据但提交时报 `row_ids` 无效

- **现象**：预览接口返回 HTTP 201、`total=2`、`valid=2`，提交却返回 `row_ids must be an array of at most 2000 non-empty strings`；页面调试对象中的 `row_id` 和 `status` 可能为空。
- **根因**：持久化行使用 `id` 表示行标识且没有显式 `status`；前端依赖 `row_id`、`rowId`、`id` 等多个别名做兼容，部署版本与接口契约发生漂移后生成了空字符串。
- **处理**：后端预览响应显式返回 `row_id` 和 `status`，同时保留内部 `id` 供批次存储和提交使用；前端继续兼容旧字段，避免历史批次失效。
- **验证**：云端原预览接口 HTTP 201 且真实返回 `id=row_2`；修复后 API 单元测试和 TypeScript 检查通过。该契约修复尚未发布到本轮冻结的公网镜像。

## 2026-10-28 Agent 库存为 0 且 Excel 提示 Offer 没有库存层级

- **现象**：数据库存在库存记录，但 Agent 库存工具返回 0 条；Excel 提交提示 `Offer ... has no inventory level to update`。
- **根因**：Marketplace 的库存挂在 Offer 的 `inventory_items.inventory.location_levels` 上，原实现查询了 Variant 的 `inventory_item_link`，关系路径与 Mercur 数据模型不一致。
- **处理**：Agent 和 Excel 导入统一从 Offer 的 `inventory_items.inventory` 读取库存层级，并按当前租户 Sales Channel 关联的库存地点过滤。
- **验证**：数据库直查确认目标 Offer 存在库存层级；新增库存工具和导入工作流单测，`pnpm --filter @outlet/api test:unit` 当前 7 个套件、19 个用例通过。云端新镜像和真实 Agent/导入结果仍待下次发布复验。

## 2026-10-28 Excel 更新商品时误删同商品其他变体

- **现象**：两行商品更新提交后均失败，其中第二行报条码已存在；进一步检查发现同一商品只留下目标尺码，其他尺码的 Variant 已消失。
- **根因**：`updateProductsWorkflow` 收到只包含目标变体的 `variants` 数组，并把它当作该商品的完整变体集合处理，未出现的同商品变体被删除。测试文件还让两个不同 SKU 共用同一测试条码，触发 `product_variant` 的条码唯一索引。
- **处理**：商品名称改用独立的商品字段更新；条码只在值与当前 Variant 不同时调用 `updateProductVariantsWorkflow` 更新单个变体；不再向商品工作流提交部分 `variants` 数组。
- **验证**：新增回归测试覆盖“不提交部分变体数组”“条码未变化不更新”“库存层级可更新”；API 测试 19 个用例和 `tsc --noEmit` 通过。
- **已知限制**：本轮冻结前没有继续修复合成演示数据中被删除的同商品变体，也没有重新执行真实 Excel 提交；共用条码仍应被数据库唯一约束拒绝，不能在未确认业务规则前自动合并或覆盖。两者均留待后续数据处理任务。

## 2026-10-28 订单详情关系展开超限及 SDK 数组参数编码错误

- **现象**：订单详情先报 `expand more than the maximum of 3 allowed relations`，改为扁平字段后又报 `Expected type: 'string' for field 'fields', got: 'id,display_id,...'`。
- **根因**：Mercur 默认订单查询展开了过深的商品关系；请求 SDK 把 `fields` 数组编码成 `fields[0]`、`fields[1]`，而 API 只接受逗号分隔字符串。
- **处理**：订单详情改为显式扁平字段列表，调用前执行 `fields.join(",")`；商品 handle 缺失时只显示文本，不生成坏链接。
- **验证**：Storefront `tsc --noEmit` 通过；最终生产镜像下的订单详情浏览器复验未在本轮冻结范围内完成。

