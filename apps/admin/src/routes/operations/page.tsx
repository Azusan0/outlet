/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useState } from "react"
import type { RouteConfig, RouteHandle } from "@mercurjs/dashboard-sdk"
import {
  getErrorMessage,
  listTenants,
  setActiveTenantId,
  type TenantOption,
  type TenantSummary,
} from "../../lib/operations-api"
import { AgentView } from "./AgentView"
import { ErpView } from "./ErpView"
import { ImportView } from "./ImportView"
import { KnowledgeView } from "./KnowledgeView"
import { StorefrontView } from "./StorefrontView"
import { Glyph, OperationsMark, type GlyphName } from "./ui"
import "./operations.css"

type ViewId = "storefront" | "import" | "agent" | "knowledge" | "erp"

type ViewDefinition = {
  id: ViewId
  index: string
  label: string
  shortLabel: string
  description: string
  icon: GlyphName
}

const VIEWS: ViewDefinition[] = [
  {
    id: "storefront",
    index: "01",
    label: "店铺装修",
    shortLabel: "装修",
    description: "配置租户首页、品牌色、公告与首屏叙事，保存后由 Store API 实时读取。",
    icon: "storefront",
  },
  {
    id: "import",
    index: "02",
    label: "Excel 导入",
    shortLabel: "导入",
    description: "解析真实货单，完成表头映射、字段校验、人工复核与安全提交。",
    icon: "import",
  },
  {
    id: "agent",
    index: "03",
    label: "AI 运营助手",
    shortLabel: "Agent",
    description: "用流式对话驱动受控工具调用，并保留每一步检索、预览与执行轨迹。",
    icon: "agent",
  },
  {
    id: "knowledge",
    index: "04",
    label: "知识库",
    shortLabel: "知识库",
    description: "沉淀 SOP、政策和商品资料，测试租户隔离的语义检索与引用。",
    icon: "knowledge",
  },
  {
    id: "erp",
    index: "05",
    label: "ERP 同步审计",
    shortLabel: "ERP",
    description: "先预览差异再执行同步，用完整审计链还原每次自动化操作。",
    icon: "erp",
  },
]

export const config: RouteConfig = {
  label: "运营工作台",
  icon: OperationsMark,
  rank: 8,
}

export const handle: RouteHandle = {
  breadcrumb: () => "运营工作台",
}

export default function OperationsPage() {
  const [activeId, setActiveId] = useState<ViewId>("storefront")
  const [mountedViews, setMountedViews] = useState<Set<ViewId>>(
    () => new Set<ViewId>(["storefront"])
  )
  const [tenant, setTenant] = useState<TenantSummary | null>(null)
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [tenantError, setTenantError] = useState("")
  const [tenantReady, setTenantReady] = useState(false)
  const [tenantRevision, setTenantRevision] = useState(0)
  const activeView = VIEWS.find((view) => view.id === activeId) ?? VIEWS[0]

  useEffect(() => {
    let active = true
    void listTenants()
      .then((options) => {
        if (!active) return
        setTenants(options)
        const saved = window.localStorage.getItem("outlet-active-tenant")
        const selected =
          options.find((option) => option.id === saved) || options[0]
        if (selected) {
          setActiveTenantId(selected.id)
          setTenant(selected)
        }
        setTenantReady(true)
      })
      .catch((error: unknown) => {
        if (!active) return
        setTenantError(getErrorMessage(error))
        setTenantReady(true)
      })
    return () => {
      active = false
    }
  }, [])

  const selectTenant = (tenantId: string) => {
    const selected = tenants.find((option) => option.id === tenantId)
    if (!selected) return
    setActiveTenantId(selected.id)
    window.localStorage.setItem("outlet-active-tenant", selected.id)
    setTenant(selected)
    setMountedViews(new Set<ViewId>([activeId]))
    setTenantRevision((revision) => revision + 1)
  }

  const selectView = (viewId: ViewId) => {
    setActiveId(viewId)
    setMountedViews((current) => {
      if (current.has(viewId)) return current
      const next = new Set(current)
      next.add(viewId)
      return next
    })
  }

  const resolveTenant = useCallback((nextTenant: TenantSummary) => {
    setTenant(nextTenant)
  }, [])

  return (
    <div className="outlet-ops">
      <div className="outlet-ops__frame">
        <aside className="ops-rail">
          <div className="ops-brand">
            <span className="ops-brand__mark">
              <OperationsMark size={30} />
            </span>
            <div>
              <strong>OUTLET</strong>
              <span>OPERATIONS OS</span>
            </div>
          </div>

          <div className="ops-rail-context">
            <span>当前租户</span>
            {tenants.length ? (
              <select
                className="ops-tenant-select"
                value={tenant?.id || ""}
                onChange={(event) => selectTenant(event.target.value)}
                aria-label="切换运营租户"
              >
                {tenants.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            ) : (
              <strong>{tenantReady ? "无可用租户" : "读取登录租户"}</strong>
            )}
            <small>{tenant ? `${tenant.slug} / ${tenant.status}` : "服务端权限上下文"}</small>
          </div>

          <nav className="ops-nav" aria-label="运营工作台导航">
            <span className="ops-nav-label">工作区</span>
            {VIEWS.map((view) => (
              <button
                type="button"
                key={view.id}
                className={activeId === view.id ? "is-active" : ""}
                onClick={() => selectView(view.id)}
                aria-current={activeId === view.id ? "page" : undefined}
              >
                <span className="ops-nav-index">{view.index}</span>
                <span className="ops-nav-icon">
                  <Glyph name={view.icon} size={17} />
                </span>
                <span className="ops-nav-copy">
                  <strong>{view.label}</strong>
                  <small>{view.shortLabel}</small>
                </span>
                <Glyph name="arrow" size={14} />
              </button>
            ))}
          </nav>

          <div className="ops-rail-foot">
            <div>
              <span className="ops-pulse" />
              Tenant isolation on
            </div>
            <div>
              <Glyph name="shield" size={14} />
              Auth + audit ready
            </div>
            <div className="ops-version">
              <span>OUTLET / OPS</span>
              <span>BUILD 01</span>
            </div>
          </div>
        </aside>

        <main className="ops-main">
          <header className="ops-hero">
            <div className="ops-hero-copy">
              <span className="ops-kicker">
                OUTLET / OPERATIONS DESK / {activeView.index}
              </span>
              <h1>
                {activeView.label}
                <em>.</em>
              </h1>
              <p>{activeView.description}</p>
            </div>
            <div className="ops-hero-aside">
              <div>
                <span>租户范围</span>
                <strong>{tenant?.slug || "AUTHENTICATED"}</strong>
              </div>
              <div>
                <span>工作模式</span>
                <strong>HUMAN IN THE LOOP</strong>
              </div>
              <div className="ops-hero-stamp">
                <span>O</span>
                <small>/ OPS</small>
              </div>
            </div>
          </header>

          <div className="ops-mobile-nav" aria-label="移动端运营工作台导航">
            {VIEWS.map((view) => (
              <button
                type="button"
                key={view.id}
                className={activeId === view.id ? "is-active" : ""}
                onClick={() => selectView(view.id)}
              >
                <Glyph name={view.icon} size={16} />
                {view.shortLabel}
              </button>
            ))}
          </div>

          <div className="ops-view-stage">
            {tenantError ? (
              <div className="ops-fatal">
                <strong>无法读取租户权限</strong>
                <p>{tenantError}</p>
              </div>
            ) : null}
            {!tenantError && !tenantReady ? (
              <div className="ops-fatal">正在验证当前账号的租户权限…</div>
            ) : null}
            {tenantReady && !tenantError && !tenant ? (
              <div className="ops-fatal">当前账号尚未分配可用租户。</div>
            ) : null}
            {tenant ? (
              <div key={`${tenant.id}-${tenantRevision}`}>
                {mountedViews.has("storefront") ? (
                  <section hidden={activeId !== "storefront"} className="ops-view">
                    <StorefrontView onTenantResolved={resolveTenant} />
                  </section>
                ) : null}
                {mountedViews.has("import") ? (
                  <section hidden={activeId !== "import"} className="ops-view">
                    <ImportView />
                  </section>
                ) : null}
                {mountedViews.has("agent") ? (
                  <section hidden={activeId !== "agent"} className="ops-view">
                    <AgentView />
                  </section>
                ) : null}
                {mountedViews.has("knowledge") ? (
                  <section hidden={activeId !== "knowledge"} className="ops-view">
                    <KnowledgeView />
                  </section>
                ) : null}
                {mountedViews.has("erp") ? (
                  <section hidden={activeId !== "erp"} className="ops-view">
                    <ErpView />
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}
