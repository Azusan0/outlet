import {
  useEffect,
  useState,
  type FormEvent,
} from "react"
import {
  createDocument,
  getErrorMessage,
  listDocuments,
  searchKnowledge,
  type KnowledgeDocument,
  type SearchHit,
} from "../../lib/operations-api"
import {
  EmptyState,
  Glyph,
  LoadingLines,
  SectionHeading,
  StatusNotice,
} from "./ui"
import { formatDate, formatScore } from "./utils"

type KnowledgeMode = "browse" | "create" | "search"

export function KnowledgeView() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [mode, setMode] = useState<KnowledgeMode>("browse")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)

  const loadDocuments = async (preferredId?: string) => {
    setLoading(true)
    setError("")
    try {
      const nextDocuments = await listDocuments()
      setDocuments(nextDocuments)
      setSelectedId((current) => {
        if (preferredId && nextDocuments.some((item) => item.id === preferredId)) {
          return preferredId
        }
        if (nextDocuments.some((item) => item.id === current)) return current
        return nextDocuments[0]?.id ?? ""
      })
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    void listDocuments()
      .then((nextDocuments) => {
        if (!active) return
        setDocuments(nextDocuments)
        setSelectedId(nextDocuments[0]?.id ?? "")
      })
      .catch((loadError: unknown) => {
        if (active) setError(getErrorMessage(loadError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const selectedDocument =
    documents.find((document) => document.id === selectedId) ?? null

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setSuccess("")
    if (!title.trim() || !content.trim()) {
      setError("资料标题和正文不能为空。")
      return
    }
    setSaving(true)
    try {
      const created = await createDocument({
        title: title.trim(),
        text: content.trim(),
      })
      setTitle("")
      setContent("")
      setSuccess("资料已入库，后续检索会按当前租户范围召回。")
      setMode("browse")
      await loadDocuments(created?.id)
    } catch (createError) {
      setError(getErrorMessage(createError))
    } finally {
      setSaving(false)
    }
  }

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextQuery = query.trim()
    if (!nextQuery) {
      setError("请输入检索问题。")
      return
    }
    setSearching(true)
    setError("")
    setSuccess("")
    try {
      setHits(await searchKnowledge({ query: nextQuery, limit: 8 }))
    } catch (searchError) {
      setError(getErrorMessage(searchError))
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="ops-knowledge">
      <SectionHeading
        index="04"
        title="知识库"
        description="把 SOP、售后政策、商品资料沉淀为可检索知识。检索、引用和资料读取全部限定在当前租户。"
        aside={
          <div className="ops-status-stack">
            <span className="ops-status ops-status--quiet">
              {documents.length} 份资料
            </span>
            <span className="ops-status ops-status--secure">
              <Glyph name="shield" size={13} />
              TENANT SCOPED
            </span>
          </div>
        }
      />

      {error ? <StatusNotice tone="error">{error}</StatusNotice> : null}
      {success ? <StatusNotice tone="success">{success}</StatusNotice> : null}

      <div className="ops-segmented" role="tablist" aria-label="知识库视图">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "browse"}
          className={mode === "browse" ? "is-active" : ""}
          onClick={() => setMode("browse")}
        >
          资料库
          <span>{documents.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "search"}
          className={mode === "search" ? "is-active" : ""}
          onClick={() => setMode("search")}
        >
          检索测试
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "create"}
          className={mode === "create" ? "is-active" : ""}
          onClick={() => setMode("create")}
        >
          <Glyph name="plus" size={14} />
          新建资料
        </button>
      </div>

      {loading ? <LoadingLines label="正在读取租户知识库" /> : null}

      {!loading && mode === "browse" ? (
        <div className="ops-knowledge-grid">
          <section className="ops-doc-list-panel">
            <div className="ops-panel-head">
              <div>
                <span className="ops-label">DOCUMENT INDEX</span>
                <strong>资料索引</strong>
              </div>
              <button
                className="ops-icon-btn"
                type="button"
                onClick={() => void loadDocuments(selectedId)}
                aria-label="刷新资料"
              >
                <Glyph name="refresh" size={16} />
              </button>
            </div>
            {documents.length === 0 ? (
              <EmptyState
                title="还没有知识资料"
                description="先录入一份 SOP 或售后政策，再测试检索与引用。"
                action={
                  <button
                    className="ops-btn ops-btn--ghost"
                    type="button"
                    onClick={() => setMode("create")}
                  >
                    <Glyph name="plus" size={15} />
                    新建资料
                  </button>
                }
              />
            ) : (
              <div className="ops-doc-list">
                {documents.map((document, index) => (
                  <button
                    type="button"
                    key={document.id}
                    className={document.id === selectedId ? "is-selected" : ""}
                    onClick={() => setSelectedId(document.id)}
                  >
                    <span className="ops-doc-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="ops-doc-summary">
                      <strong>{document.title}</strong>
                      <small>
                        {formatDate(document.updated_at)}
                      </small>
                    </span>
                    <Glyph name="arrow" size={14} />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="ops-doc-detail">
            {selectedDocument ? (
              <>
                <div className="ops-doc-detail-head">
                  <div>
                    <span className="ops-label">DOCUMENT DETAIL</span>
                    <h3>{selectedDocument.title}</h3>
                  </div>
                  <span className="ops-badge ops-badge--valid">
                    {selectedDocument.status}
                  </span>
                </div>
                <div className="ops-doc-content">
                  {selectedDocument.content || "后端没有返回正文预览。"}
                </div>
                <dl className="ops-doc-meta">
                  <div>
                    <dt>最近更新</dt>
                    <dd>{formatDate(selectedDocument.updated_at)}</dd>
                  </div>
                  <div>
                    <dt>分块数量</dt>
                    <dd>{selectedDocument.chunk_count ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>资料 ID</dt>
                    <dd className="ops-mono">{selectedDocument.id || "—"}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <EmptyState
                title="选择一份资料"
                description="左侧选择资料后可查看正文、标签和索引元数据。"
              />
            )}
          </section>
        </div>
      ) : null}

      {!loading && mode === "create" ? (
        <form className="ops-knowledge-form" onSubmit={handleCreate}>
          <div className="ops-form-intro">
            <span className="ops-label">NEW KNOWLEDGE</span>
            <h3>录入一份可引用的运营资料</h3>
            <p>内容会先分块再建立检索索引。不要粘贴密钥、密码或与业务无关的个人信息。</p>
          </div>
          <label className="ops-field">
            <span>资料标题</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：退换货处理 SOP"
              maxLength={160}
              required
            />
          </label>
          <label className="ops-field">
            <span>正文</span>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="粘贴 SOP、政策或商品知识，建议使用清晰的标题和步骤。"
              rows={14}
              required
            />
          </label>
          <div className="ops-form-actions">
            <button
              className="ops-btn ops-btn--primary"
              type="submit"
              disabled={saving}
            >
              <Glyph name={saving ? "refresh" : "plus"} size={16} />
              {saving ? "正在入库" : "保存并建立索引"}
            </button>
            <button
              className="ops-btn ops-btn--ghost"
              type="button"
              onClick={() => setMode("browse")}
              disabled={saving}
            >
              返回资料库
            </button>
          </div>
        </form>
      ) : null}

      {!loading && mode === "search" ? (
        <div className="ops-search-view">
          <form className="ops-search-form" onSubmit={handleSearch}>
            <Glyph name="search" size={20} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例如：客户收到瑕疵品后几天内可以申请换货？"
              maxLength={500}
            />
            <button
              className="ops-btn ops-btn--primary"
              type="submit"
              disabled={searching || !query.trim()}
            >
              {searching ? "检索中" : "检索"}
            </button>
          </form>

          <div className="ops-search-note">
            <Glyph name="spark" size={16} />
            <span>结果按相关度排序，并返回可展示的引用片段。检索不会跨租户。</span>
          </div>

          {hits.length > 0 ? (
            <div className="ops-search-results">
              {hits.map((hit, index) => (
                <article className="ops-search-hit" key={`${hit.id}-${index}`}>
                  <div className="ops-search-hit-head">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{hit.title}</strong>
                    <span className="ops-score">相关度 {formatScore(hit.score)}</span>
                  </div>
                  <p>{hit.snippet || "该结果没有返回文本片段。"}</p>
                  <footer>
                    <span className="ops-mono">
                      DOC: {hit.documentId || hit.id || "—"}
                    </span>
                    {Object.entries(hit.metadata)
                      .slice(0, 3)
                      .map(([key, value]) => (
                        <span key={key}>
                          {key}: {String(value)}
                        </span>
                      ))}
                  </footer>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title={searching ? "正在检索" : "等待检索问题"}
              description={
                searching
                  ? "正在对当前租户的资料片段做相关度排序。"
                  : "输入一个真实业务问题，检查召回结果和引用是否可信。"
              }
            />
          )}
        </div>
      ) : null}
    </div>
  )
}

