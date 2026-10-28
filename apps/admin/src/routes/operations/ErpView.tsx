import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react"
import {
  executeErp,
  getErrorMessage,
  listAuditEvents,
  previewErp,
  type AuditEvent,
  type ErpExecuteResult,
  type ErpPreview,
  type ErpRequest,
  type ErpTarget,
} from "../../lib/operations-api"
import {
  EmptyState,
  Glyph,
  LoadingLines,
  SectionHeading,
  StatusNotice,
} from "./ui"
import { formatDate, formatDuration, summarize } from "./utils"

type EditableRow = {
  id: string
  sku: string
  price: string
  stock: string
  currency: string
}

const TARGETS: Array<{ value: ErpTarget; label: string; hint: string }> = [
  { value: "stock", label: "库存", hint: "校验并同步可售库存" },
  { value: "price", label: "价格", hint: "校验并同步渠道价格" },
  { value: "erp", label: "ERP 全量", hint: "同时处理库存与价格" },
]

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function emptyRow(): EditableRow {
  return {
    id: makeId("row"),
    sku: "",
    price: "",
    stock: "",
    currency: "EUR",
  }
}

function auditTone(status: string): string {
  const value = status.toLowerCase()
  if (["success", "succeeded", "completed", "ok", "applied"].includes(value)) {
    return "valid"
  }
  if (["failed", "error", "rejected", "invalid"].includes(value)) return "invalid"
  return "warning"
}

function buildRequest(
  target: ErpTarget,
  idempotencyKey: string,
  rows: EditableRow[]
): ErpRequest {
  const populated = rows.filter(
    (row) => row.sku.trim() || row.price.trim() || row.stock.trim()
  )
  if (populated.length === 0) {
    throw new Error("请至少填写一行 SKU、价格和库存。")
  }

  const items = populated.map((row, index) => {
    const sku = row.sku.trim()
    const price = Number(row.price)
    const stock = Number(row.stock)
    if (!sku) throw new Error(`第 ${index + 1} 行缺少 SKU。`)
    if (!row.price.trim() || !Number.isFinite(price) || price < 0) {
      throw new Error(`第 ${index + 1} 行价格无效。`)
    }
    if (!row.stock.trim() || !Number.isFinite(stock) || stock < 0) {
      throw new Error(`第 ${index + 1} 行库存无效。`)
    }
    return {
      row_id: row.id,
      sku,
      price,
      stock,
      currency: row.currency.trim().toUpperCase() || "EUR",
    }
  })

  return {
    target,
    idempotency_key: idempotencyKey,
    items,
  }
}

export function ErpView() {
  const [target, setTarget] = useState<ErpTarget>("stock")
  const [idempotencyKey, setIdempotencyKey] = useState(() => makeId("idem"))
  const [rows, setRows] = useState<EditableRow[]>(() => [emptyRow()])
  const [preview, setPreview] = useState<ErpPreview | null>(null)
  const [previewSignature, setPreviewSignature] = useState("")
  const [result, setResult] = useState<ErpExecuteResult | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [audit, setAudit] = useState<AuditEvent[]>([])
  const [auditLoading, setAuditLoading] = useState(true)

  const currentTarget = TARGETS.find((item) => item.value === target) ?? TARGETS[0]

  const invalidatePreview = () => {
    setPreview(null)
    setPreviewSignature("")
    setResult(null)
    setConfirmed(false)
    setError("")
    setSuccess("")
  }

  const updateRow = (
    id: string,
    field: "sku" | "price" | "stock" | "currency",
    value: string
  ) => {
    invalidatePreview()
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    )
  }

  const addRow = () => {
    invalidatePreview()
    setRows((current) => [...current, emptyRow()])
  }

  const removeRow = (id: string) => {
    invalidatePreview()
    setRows((current) => {
      const next = current.filter((row) => row.id !== id)
      return next.length > 0 ? next : [emptyRow()]
    })
  }

  const regenerateKey = () => {
    invalidatePreview()
    setIdempotencyKey(makeId("idem"))
  }

  const loadAudit = async () => {
    setAuditLoading(true)
    try {
      setAudit(await listAuditEvents(30))
    } catch (auditError) {
      setError(getErrorMessage(auditError))
    } finally {
      setAuditLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    void listAuditEvents(30)
      .then((events) => {
        if (active) setAudit(events)
      })
      .catch((auditError: unknown) => {
        if (active) setError(getErrorMessage(auditError))
      })
      .finally(() => {
        if (active) setAuditLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const handlePreview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setSuccess("")
    setPreviewing(true)
    setResult(null)
    setConfirmed(false)
    try {
      const request = buildRequest(target, idempotencyKey, rows)
      const nextPreview = await previewErp(request)
      setPreview(nextPreview)
      setPreviewSignature(JSON.stringify(request))
    } catch (previewError) {
      setPreview(null)
      setPreviewSignature("")
      setError(getErrorMessage(previewError))
    } finally {
      setPreviewing(false)
    }
  }

  const handleExecute = async () => {
    if (!preview) return
    if (!confirmed) {
      setError("请先核对预览结果并勾选确认。")
      return
    }
    setExecuting(true)
    setError("")
    setSuccess("")
    try {
      const request = buildRequest(target, idempotencyKey, rows)
      if (JSON.stringify(request) !== previewSignature) {
        throw new Error("输入内容已变化，请重新生成预览后再执行。")
      }
      const nextResult = await executeErp(request)
      setResult(nextResult)
      setSuccess(nextResult.message)
      setConfirmed(false)
      await loadAudit()
    } catch (executeError) {
      setError(getErrorMessage(executeError))
    } finally {
      setExecuting(false)
    }
  }

  const previewSummary = useMemo(
    () => (preview ? Object.entries(preview.summary).slice(0, 8) : []),
    [preview]
  )
  const resultSummary = useMemo(
    () => (result ? Object.entries(result.summary).slice(0, 8) : []),
    [result]
  )

  return (
    <div className="ops-erp">
      <SectionHeading
        index="05"
        title="ERP 同步与审计"
        description="按 SKU 编辑价格与库存，先预览差异，再用同一个幂等请求执行。接口模式由后端控制，前端不传 dry_run。"
        aside={
          <span className="ops-status ops-status--secure">
            <Glyph name="shield" size={13} />
            IDEMPOTENT SYNC
          </span>
        }
      />

      {error ? <StatusNotice tone="error">{error}</StatusNotice> : null}
      {success ? <StatusNotice tone="success">{success}</StatusNotice> : null}

      <div className="ops-erp-grid">
        <form className="ops-erp-control" onSubmit={handlePreview}>
          <div className="ops-panel-head">
            <div>
              <span className="ops-label">SYNC REQUEST</span>
              <strong>编辑同步行</strong>
            </div>
            <Glyph name="erp" size={22} />
          </div>

          <label className="ops-field">
            <span>同步目标</span>
            <select
              value={target}
              onChange={(event) => {
                invalidatePreview()
                setTarget(event.target.value as ErpTarget)
              }}
            >
              {TARGETS.map((item) => (
                <option value={item.value} key={item.value}>
                  {item.label} · {item.hint}
                </option>
              ))}
            </select>
            <small>当前：{currentTarget.hint}</small>
          </label>

          <div className="ops-idempotency">
            <div>
              <span className="ops-label">IDEMPOTENCY KEY</span>
              <code>{idempotencyKey}</code>
            </div>
            <button
              className="ops-icon-btn"
              type="button"
              onClick={regenerateKey}
              aria-label="重新生成幂等键"
            >
              <Glyph name="refresh" size={15} />
            </button>
          </div>

          <div className="ops-erp-rows">
            <div className="ops-erp-rows-head">
              <span>SKU</span>
              <span>价格</span>
              <span>库存</span>
              <span>币种</span>
              <span aria-hidden="true" />
            </div>
            {rows.map((row, index) => (
              <div className="ops-erp-row" key={row.id}>
                <label>
                  <span className="ops-sr-only">第 {index + 1} 行 SKU</span>
                  <input
                    value={row.sku}
                    onChange={(event) => updateRow(row.id, "sku", event.target.value)}
                    placeholder="SKU / 货号"
                  />
                </label>
                <label>
                  <span className="ops-sr-only">第 {index + 1} 行价格</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.price}
                    onChange={(event) => updateRow(row.id, "price", event.target.value)}
                    placeholder="0.00"
                  />
                </label>
                <label>
                  <span className="ops-sr-only">第 {index + 1} 行库存</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={row.stock}
                    onChange={(event) => updateRow(row.id, "stock", event.target.value)}
                    placeholder="0"
                  />
                </label>
                <label>
                  <span className="ops-sr-only">第 {index + 1} 行币种</span>
                  <select
                    value={row.currency}
                    onChange={(event) =>
                      updateRow(row.id, "currency", event.target.value)
                    }
                  >
                    <option value="CNY">CNY</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </label>
                <button
                  className="ops-icon-btn"
                  type="button"
                  onClick={() => removeRow(row.id)}
                  aria-label={`删除第 ${index + 1} 行`}
                >
                  <Glyph name="stop" size={13} />
                </button>
              </div>
            ))}
          </div>

          <div className="ops-erp-row-actions">
            <button className="ops-btn ops-btn--ghost ops-btn--small" type="button" onClick={addRow}>
              <Glyph name="plus" size={14} />
              添加一行
            </button>
            <span>row_id 会随行固定，预览与执行保持一致。</span>
          </div>

          <div className="ops-erp-safety">
            <Glyph name="warning" size={18} />
            <p>
              请求固定包含 <code>target</code>、<code>idempotency_key</code> 与{" "}
              <code>items</code>。预览和执行发送同一份 body，dry-run 与真实执行由后端路由模式控制。
            </p>
          </div>

          <button
            className="ops-btn ops-btn--primary ops-btn--wide"
            type="submit"
            disabled={previewing || executing}
          >
            <Glyph name={previewing ? "refresh" : "search"} size={16} />
            {previewing ? "正在生成预览" : "生成同步预览"}
          </button>
        </form>

        <section className="ops-erp-plan">
          <div className="ops-panel-head">
            <div>
              <span className="ops-label">PREVIEW RESULT</span>
              <strong>差异与执行</strong>
            </div>
            {preview?.jobId ? <span className="ops-mono">{preview.jobId}</span> : null}
          </div>

          {!preview ? (
            <EmptyState
              title="尚未生成同步预览"
              description="填写同步行后生成预览。预览不会修改 ERP 或商城数据。"
            />
          ) : (
            <>
              <div className="ops-plan-summary">
                {previewSummary.length > 0 ? (
                  previewSummary.map(([key, value]) => (
                    <div key={key}>
                      <span>{key}</span>
                      <strong>{String(value)}</strong>
                    </div>
                  ))
                ) : (
                  <div>
                    <span>返回行数</span>
                    <strong>{preview.rows.length}</strong>
                  </div>
                )}
              </div>

              <div className="ops-table-wrap ops-table-wrap--plan">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>价格</th>
                      <th>库存</th>
                      <th>状态</th>
                      <th>说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.rowId}>
                        <td className="ops-mono">{row.sku || row.rowId}</td>
                        <td>
                          {row.price ?? "—"} {row.currency}
                        </td>
                        <td>{row.stock ?? "—"}</td>
                        <td>
                          <span className={`ops-badge ops-badge--${auditTone(row.status)}`}>
                            {row.status}
                          </span>
                        </td>
                        <td>{row.message || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.rows.length === 0 ? (
                  <div className="ops-inline-empty">后端没有返回可展示的预览行。</div>
                ) : null}
              </div>

              <label className="ops-confirm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  disabled={executing}
                />
                <span>我已核对预览内容，确认使用当前幂等键执行同步。</span>
              </label>

              <div className="ops-plan-actions">
                <button
                  className="ops-btn ops-btn--danger"
                  type="button"
                  onClick={() => void handleExecute()}
                  disabled={!confirmed || executing}
                >
                  <Glyph name={executing ? "refresh" : "erp"} size={16} />
                  {executing ? "正在执行" : "执行同步"}
                </button>
                <button
                  className="ops-btn ops-btn--ghost"
                  type="button"
                  onClick={invalidatePreview}
                  disabled={executing}
                >
                  放弃预览
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {result ? (
        <div className="ops-result-band">
          <Glyph name="check" size={22} />
          <div>
            <strong>{result.message}</strong>
            <span>{result.jobId ? `JOB ${result.jobId}` : "后端未返回 job_id"}</span>
          </div>
          {resultSummary.length > 0 ? (
            <div className="ops-result-summary">
              {resultSummary.map(([key, value]) => (
                <span key={key}>
                  {key}: {String(value)}
                </span>
              ))}
            </div>
          ) : null}
          <details>
            <summary>查看原始结果</summary>
            <pre>{summarize(result.raw)}</pre>
          </details>
        </div>
      ) : null}

      <section className="ops-audit">
        <div className="ops-audit-head">
          <div>
            <span className="ops-label">AUDIT TRAIL</span>
            <h3>最近操作记录</h3>
          </div>
          <button
            className="ops-btn ops-btn--ghost ops-btn--small"
            type="button"
            onClick={() => void loadAudit()}
            disabled={auditLoading}
          >
            <Glyph name="refresh" size={15} />
            刷新
          </button>
        </div>

        {auditLoading ? <LoadingLines label="正在读取审计记录" /> : null}

        {!auditLoading && audit.length === 0 ? (
          <EmptyState
            title="暂无审计记录"
            description="执行一次预览或同步后，事件会显示在这里。"
          />
        ) : null}

        {!auditLoading && audit.length > 0 ? (
          <div className="ops-table-wrap">
            <table className="ops-table ops-table--audit">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>动作</th>
                  <th>结果</th>
                  <th>操作者</th>
                  <th>目标</th>
                  <th>耗时</th>
                  <th>详情</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((event) => (
                  <tr key={event.id}>
                    <td className="ops-mono">{formatDate(event.createdAt)}</td>
                    <td>{event.action}</td>
                    <td>
                      <span className={`ops-badge ops-badge--${auditTone(event.status)}`}>
                        {event.status}
                      </span>
                    </td>
                    <td>{event.actor}</td>
                    <td className="ops-mono">{event.target}</td>
                    <td>{formatDuration(event.durationMs)}</td>
                    <td>
                      {Object.keys(event.detail).length > 0 ? (
                        <details className="ops-audit-detail">
                          <summary>JSON</summary>
                          <pre>{summarize(event.detail)}</pre>
                        </details>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  )
}
