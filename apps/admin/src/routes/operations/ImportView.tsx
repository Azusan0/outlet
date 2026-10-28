import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react"
import {
  commitImport,
  formatImportIssue,
  getErrorMessage,
  previewImport,
  type ImportCommitResult,
  type ImportPreview,
  type ImportPreviewRow,
} from "../../lib/operations-api"
import {
  EmptyState,
  Glyph,
  SectionHeading,
  StatusNotice,
} from "./ui"
import { firstValue } from "./utils"

const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".csv"]
const MAX_FILE_SIZE = 5 * 1024 * 1024

function fileIsAccepted(file: File): boolean {
  const lowerName = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
}

function rowTone(row: ImportPreviewRow): string {
  if (row.status === "invalid") return "invalid"
  if (row.status === "warning") return "warning"
  return "valid"
}

export function ImportView() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [result, setResult] = useState<ImportCommitResult | null>(null)

  const selectFile = (nextFile: File | null) => {
    setError("")
    setSuccess("")
    setPreview(null)
    setResult(null)
    setSelected(new Set())
    if (!nextFile) {
      setFile(null)
      return
    }
    if (!fileIsAccepted(nextFile)) {
      setFile(null)
      setError("仅支持 .xlsx、.xls 或 .csv 文件。")
      return
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setFile(null)
      setError("文件超过 5 MB，请先拆分后再导入。")
      return
    }
    setFile(nextFile)
  }

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    selectFile(event.target.files?.[0] ?? null)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    selectFile(event.dataTransfer.files?.[0] ?? null)
  }

  const runPreview = async () => {
    if (!file) {
      setError("请先选择一个货单文件。")
      return
    }
    setLoading(true)
    setError("")
    setSuccess("")
    setResult(null)
    try {
      const nextPreview = await previewImport(file)
      setPreview(nextPreview)
      setSelected(
        new Set(
          nextPreview.rows
            .filter((row) => row.status !== "invalid")
            .map((row) => row.key)
        )
      )
      if (nextPreview.rows.length === 0) {
        setError("后端没有返回可预览的数据行，请检查模板表头或文件内容。")
      }
    } catch (previewError) {
      setError(getErrorMessage(previewError))
    } finally {
      setLoading(false)
    }
  }

  const selectableRows = preview?.rows.filter((row) => row.status !== "invalid") ?? []
  const allSelected =
    selectableRows.length > 0 && selectableRows.every((row) => selected.has(row.key))

  const toggleRow = (key: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(selectableRows.map((row) => row.key)))
  }

  const runCommit = async () => {
    if (!preview) return
    const rowIds = preview.rows
      .filter((row) => selected.has(row.key))
      .map((row) => row.rowId)
    if (!preview.batchId) {
      setError("预览结果缺少 batch_id，无法安全提交。请重新生成预览。")
      return
    }
    if (rowIds.length === 0) {
      setError("请至少选择一条可导入记录。")
      return
    }
    setCommitting(true)
    setError("")
    setSuccess("")
    try {
      const nextResult = await commitImport(preview.batchId, rowIds)
      setResult(nextResult)
      setSuccess(
        `已提交 ${rowIds.length} 条记录。成功 ${nextResult.imported}，跳过 ${nextResult.skipped}，失败 ${nextResult.failed}。`
      )
    } catch (commitError) {
      setError(getErrorMessage(commitError))
    } finally {
      setCommitting(false)
    }
  }

  return (
    <div className="ops-import">
      <SectionHeading
        index="02"
        title="Excel 货单导入"
        description="上传模板文件，先做表头映射、重复项、价格、库存与条码校验，再选择有效行提交。预览阶段不会写入商品库。"
        aside={
          <span className="ops-status ops-status--quiet">
            XLSX / XLS / CSV · MAX 5 MB
          </span>
        }
      />

      {error ? <StatusNotice tone="error">{error}</StatusNotice> : null}
      {success ? <StatusNotice tone="success">{success}</StatusNotice> : null}

      <div className="ops-import-grid">
        <div className="ops-upload-panel">
          <div
            className={`ops-dropzone ${dragging ? "is-dragging" : ""} ${file ? "has-file" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              event.preventDefault()
              setDragging(false)
            }}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS.join(",")}
              onChange={handleInput}
              hidden
            />
            <Glyph name="import" size={34} />
            <h3>{file ? file.name : "把标准货单拖到这里"}</h3>
            <p>
              {file
                ? `${(file.size / 1024).toFixed(1)} KB · 点击可更换文件`
                : "或点击选择文件。系统只做预览，确认后才提交。"}
            </p>
            <button
              className="ops-btn ops-btn--ghost"
              type="button"
              onClick={() => inputRef.current?.click()}
            >
              {file ? "更换文件" : "选择货单"}
            </button>
          </div>

          <div className="ops-upload-actions">
            <button
              className="ops-btn ops-btn--primary"
              type="button"
              onClick={() => void runPreview()}
              disabled={!file || loading}
            >
              <Glyph name={loading ? "refresh" : "search"} size={16} />
              {loading ? "正在解析" : "生成导入预览"}
            </button>
            <button
              className="ops-btn ops-btn--ghost"
              type="button"
              onClick={() => {
                selectFile(null)
                if (inputRef.current) inputRef.current.value = ""
              }}
              disabled={!file || loading || committing}
            >
              清空
            </button>
          </div>

          <div className="ops-process-note">
            <span>校验顺序</span>
            <ol>
              <li>识别模板与表头映射</li>
              <li>规范化 SKU、价格、库存、条码</li>
              <li>检查重复行与缺失必填项</li>
              <li>只提交人工勾选的有效行</li>
            </ol>
          </div>
        </div>

        <div className="ops-import-side">
          <div className="ops-stat-strip">
            <Stat label="总行数" value={preview?.summary.total ?? 0} />
            <Stat label="可导入" value={preview?.summary.valid ?? 0} />
            <Stat label="待复核" value={preview?.summary.warning ?? 0} />
            <Stat label="错误" value={preview?.summary.invalid ?? 0} />
          </div>

          {preview ? (
            <>
              <div className="ops-mapping">
                <div>
                  <span className="ops-label">文件</span>
                  <strong>{preview.fileName || file?.name}</strong>
                </div>
                <div>
                  <span className="ops-label">导入批次</span>
                  <strong className="ops-mono">
                    {preview.batchId || "后端未返回 batch_id"}
                  </strong>
                </div>
                <div>
                  <span className="ops-label">字段映射</span>
                  <div className="ops-chip-list">
                    {Object.entries(preview.mapping).length > 0 ? (
                      Object.entries(preview.mapping).map(([source, target]) => (
                        <span className="ops-chip" key={`${source}-${target}`}>
                          {source} <Glyph name="arrow" size={12} /> {target || "忽略"}
                        </span>
                      ))
                    ) : (
                      <span className="ops-muted">后端未返回显式映射，按标准字段处理。</span>
                    )}
                  </div>
                </div>
              </div>
              {preview.globalErrors.length > 0 ? (
                <StatusNotice tone="error">
                  {preview.globalErrors.map(formatImportIssue).join("；")}
                </StatusNotice>
              ) : null}
              {preview.warnings.length > 0 ? (
                <StatusNotice tone="warning">
                  {preview.warnings.map(formatImportIssue).join("；")}
                </StatusNotice>
              ) : null}
            </>
          ) : (
            <EmptyState
              title="等待货单"
              description="上传后这里会显示表头映射、校验统计与逐行结果。"
            />
          )}
        </div>
      </div>

      {preview && preview.rows.length > 0 ? (
        <section className="ops-preview-table-section">
          <div className="ops-table-toolbar">
            <div>
              <span className="ops-label">预览结果</span>
              <strong>{selected.size} 条已选择</strong>
            </div>
            <div className="ops-toolbar-actions">
              <button
                className="ops-btn ops-btn--ghost ops-btn--small"
                type="button"
                onClick={toggleAll}
              >
                {allSelected ? "取消全选" : "选择全部可导入行"}
              </button>
              <button
                className="ops-btn ops-btn--primary"
                type="button"
                onClick={() => void runCommit()}
                disabled={selected.size === 0 || committing}
              >
                <Glyph name={committing ? "refresh" : "check"} size={16} />
                {committing ? "正在提交" : `提交 ${selected.size} 条`}
              </button>
            </div>
          </div>

          <div className="ops-table-wrap">
            <table className="ops-table ops-table--import">
              <thead>
                <tr>
                  <th aria-label="选择" />
                  <th>行</th>
                  <th>状态</th>
                  <th>SKU / 货号</th>
                  <th>商品名称</th>
                  <th>价格</th>
                  <th>库存</th>
                  <th>校验信息</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => {
                  const selectable = row.status !== "invalid"
                  return (
                    <tr className={`ops-row--${rowTone(row)}`} key={row.key}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(row.key)}
                          onChange={() => toggleRow(row.key)}
                          disabled={!selectable}
                          aria-label={`选择第 ${row.rowNumber} 行`}
                        />
                      </td>
                      <td className="ops-mono">{row.rowNumber}</td>
                      <td>
                        <span className={`ops-badge ops-badge--${rowTone(row)}`}>
                          {row.status === "valid"
                            ? "可导入"
                            : row.status === "warning"
                              ? "待复核"
                              : row.status === "invalid"
                                ? "错误"
                                : "未知"}
                        </span>
                      </td>
                      <td className="ops-mono">
                        {firstValue(row.values, [
                          "sku",
                          "SKU",
                          "货号",
                          "商品编码",
                          "款号",
                          "sku_code",
                        ])}
                      </td>
                      <td>
                        {firstValue(row.values, [
                          "title",
                          "name",
                          "商品名称",
                          "商品名",
                          "品名",
                          "product_name",
                        ])}
                      </td>
                      <td>
                        {firstValue(row.values, [
                          "price",
                          "价格",
                          "零售价",
                          "吊牌价",
                          "sale_price",
                        ])}
                      </td>
                      <td>
                        {firstValue(row.values, [
                          "stock",
                          "inventory",
                          "库存",
                          "可售库存",
                          "quantity",
                        ])}
                      </td>
                      <td>
                        <div className="ops-row-messages">
                          {[...row.errors, ...row.warnings].length > 0 ? (
                            [...row.errors, ...row.warnings].map((issue, index) => (
                              <span key={`${issue.field}-${issue.code}-${index}`}>
                                {formatImportIssue(issue)}
                              </span>
                            ))
                          ) : (
                            <span className="ops-muted">通过</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {result ? (
        <div className="ops-result-band">
          <Glyph name="check" size={22} />
          <div>
            <strong>{result.message}</strong>
            <span>
              成功 {result.imported} / 跳过 {result.skipped} / 失败 {result.failed}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

