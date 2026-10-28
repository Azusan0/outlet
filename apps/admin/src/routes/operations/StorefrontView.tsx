import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react"
import {
  getErrorMessage,
  getStorefront,
  saveStorefront,
  type SaveStorefrontInput,
  type StorefrontResponse,
  type TenantSummary,
} from "../../lib/operations-api"
import {
  Glyph,
  LoadingLines,
  SectionHeading,
  StatusNotice,
} from "./ui"

type StorefrontViewProps = {
  onTenantResolved: (tenant: TenantSummary) => void
}

function toDraft(data: StorefrontResponse): SaveStorefrontInput {
  return {
    tenant_id: data.tenant.id,
    accent: data.theme.accent,
    paper: data.theme.paper,
    ink: data.theme.ink,
    announcement: data.theme.announcement,
    page: {
      eyebrow: data.page.eyebrow,
      headline: data.page.headline,
      subheading: data.page.subheading,
      hero_image: data.page.hero_image,
    },
  }
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value)
}

export function StorefrontView({ onTenantResolved }: StorefrontViewProps) {
  const [data, setData] = useState<StorefrontResponse | null>(null)
  const [draft, setDraft] = useState<SaveStorefrontInput | null>(null)
  const [savedSnapshot, setSavedSnapshot] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const load = async () => {
    setLoading(true)
    setError("")
    setSuccess("")
    try {
      const next = await getStorefront()
      const nextDraft = toDraft(next)
      setData(next)
      setDraft(nextDraft)
      setSavedSnapshot(JSON.stringify(nextDraft))
      onTenantResolved(next.tenant)
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    void getStorefront()
      .then((next) => {
        if (!active) return
        const nextDraft = toDraft(next)
        setData(next)
        setDraft(nextDraft)
        setSavedSnapshot(JSON.stringify(nextDraft))
        onTenantResolved(next.tenant)
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
  }, [onTenantResolved])

  const dirty = useMemo(
    () => Boolean(draft && JSON.stringify(draft) !== savedSnapshot),
    [draft, savedSnapshot]
  )

  const updateTheme = (
    field: "accent" | "paper" | "ink" | "announcement",
    value: string
  ) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current))
    setSuccess("")
  }

  const updatePage = (
    field: "eyebrow" | "headline" | "subheading" | "hero_image",
    value: string
  ) => {
    setDraft((current) =>
      current ? { ...current, page: { ...current.page, [field]: value } } : current
    )
    setSuccess("")
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft) return
    setError("")
    setSuccess("")

    if (!draft.tenant_id) {
      setError("没有找到当前租户，无法保存装修配置。")
      return
    }
    if (!draft.page.headline.trim()) {
      setError("首页主标题不能为空。")
      return
    }
    if (![draft.accent, draft.paper, draft.ink].every(isHexColor)) {
      setError("主题色必须是 6 位十六进制颜色，例如 #df4b2b。")
      return
    }

    setSaving(true)
    try {
      const saved = await saveStorefront(draft)
      const nextDraft = toDraft(saved)
      setData(saved)
      setDraft(nextDraft)
      setSavedSnapshot(JSON.stringify(nextDraft))
      onTenantResolved(saved.tenant)
      setSuccess("店铺装修已保存，前台会在下一次请求时读取新配置。")
    } catch (saveError) {
      setError(getErrorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  const resetDraft = () => {
    if (!data) return
    const nextDraft = toDraft(data)
    setDraft(nextDraft)
    setError("")
    setSuccess("")
  }

  if (loading) return <LoadingLines label="正在读取租户装修配置" />

  if (error && !draft) {
    return (
      <div className="ops-fatal">
        <StatusNotice tone="error">{error}</StatusNotice>
        <button className="ops-btn ops-btn--primary" type="button" onClick={() => void load()}>
          <Glyph name="refresh" size={16} />
          重新读取
        </button>
      </div>
    )
  }

  if (!draft || !data) return null

  const previewStyle = {
    "--preview-accent": draft.accent,
    "--preview-paper": draft.paper,
    "--preview-ink": draft.ink,
    "--preview-image": draft.page.hero_image
      ? `linear-gradient(180deg, transparent 35%, ${draft.ink}dd), url("${draft.page.hero_image}")`
      : `radial-gradient(circle at 78% 18%, ${draft.accent} 0 12%, transparent 12.5%),
         linear-gradient(135deg, transparent 0 52%, ${draft.accent}33 52% 72%, transparent 72%)`,
  } as CSSProperties

  return (
    <form className="ops-storefront" onSubmit={handleSubmit}>
      <SectionHeading
        index="01"
        title="店铺装修"
        description="直接编辑当前租户的首页文案、品牌色与公告。保存后由 Store API 读取，前端无需重新构建。"
        aside={
          <div className="ops-status-stack">
            <span className={`ops-status ${dirty ? "ops-status--dirty" : "ops-status--clean"}`}>
              {dirty ? "有未保存修改" : "已同步"}
            </span>
            <span className="ops-status ops-status--quiet">
              {data.tenant.name} / {data.tenant.slug || "tenant"}
            </span>
          </div>
        }
      />

      {error ? <StatusNotice tone="error">{error}</StatusNotice> : null}
      {success ? <StatusNotice tone="success">{success}</StatusNotice> : null}

      <div className="ops-editor-grid">
        <div className="ops-editor-form">
          <fieldset>
            <legend>首页叙事</legend>
            <label className="ops-field">
              <span>眉题</span>
              <input
                value={draft.page.eyebrow}
                onChange={(event) => updatePage("eyebrow", event.target.value)}
                placeholder="NEW SEASON / 2026"
                maxLength={80}
              />
            </label>
            <label className="ops-field">
              <span>主标题</span>
              <textarea
                value={draft.page.headline}
                onChange={(event) => updatePage("headline", event.target.value)}
                placeholder="为日常留一点锋芒"
                rows={2}
                maxLength={120}
                required
              />
            </label>
            <label className="ops-field">
              <span>副标题</span>
              <textarea
                value={draft.page.subheading}
                onChange={(event) => updatePage("subheading", event.target.value)}
                placeholder="多品牌精选、独立库存与快速履约。"
                rows={3}
                maxLength={240}
              />
            </label>
            <label className="ops-field">
              <span>首屏图片地址</span>
              <input
                type="url"
                value={draft.page.hero_image}
                onChange={(event) => updatePage("hero_image", event.target.value)}
                placeholder="https://cdn.example.com/hero.jpg"
              />
              <small>可留空，前台会使用主题色生成编辑式背景。</small>
            </label>
          </fieldset>

          <fieldset>
            <legend>品牌与公告</legend>
            <label className="ops-field">
              <span>公告栏</span>
              <input
                value={draft.announcement}
                onChange={(event) => updateTheme("announcement", event.target.value)}
                placeholder="本周六前下单，周日统一出库"
                maxLength={160}
              />
            </label>
            <div className="ops-color-grid">
              <ColorField
                label="强调色"
                value={draft.accent}
                onChange={(value) => updateTheme("accent", value)}
              />
              <ColorField
                label="纸张色"
                value={draft.paper}
                onChange={(value) => updateTheme("paper", value)}
              />
              <ColorField
                label="墨色"
                value={draft.ink}
                onChange={(value) => updateTheme("ink", value)}
              />
            </div>
          </fieldset>

          <div className="ops-form-actions">
            <button
              className="ops-btn ops-btn--primary"
              type="submit"
              disabled={saving || !dirty}
            >
              <Glyph name={saving ? "refresh" : "check"} size={16} />
              {saving ? "正在保存" : "保存并发布"}
            </button>
            <button
              className="ops-btn ops-btn--ghost"
              type="button"
              onClick={resetDraft}
              disabled={saving || !dirty}
            >
              撤销修改
            </button>
          </div>
        </div>

        <aside className="ops-preview-column">
          <div className="ops-preview-label">
            <span>LIVE PREVIEW</span>
            <span>{data.tenant.status === "active" ? "ACTIVE" : data.tenant.status}</span>
          </div>
          <div className="ops-store-preview" style={previewStyle}>
            <header>
              <strong>{data.tenant.name}</strong>
              <span>SHOP / INDEX</span>
            </header>
            {draft.announcement ? (
              <div className="ops-store-preview__announcement">
                {draft.announcement}
              </div>
            ) : null}
            <div className="ops-store-preview__hero">
              <span>{draft.page.eyebrow || "EDITORIAL COMMERCE"}</span>
              <h3>{draft.page.headline || "首页主标题"}</h3>
              <p>{draft.page.subheading || "在这里预览你的品牌副标题。"}</p>
              <button type="button" tabIndex={-1}>
                浏览本季精选
                <Glyph name="arrow" size={14} />
              </button>
            </div>
            <footer>
              <span>NEW</span>
              <span>EDIT / 01</span>
              <span>OUTLET</span>
            </footer>
          </div>
          <p className="ops-preview-note">
            预览使用当前草稿，不会提前影响线上访客。发布动作通过当前登录用户的租户权限校验。
          </p>
        </aside>
      </div>
    </form>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="ops-color-field">
      <span>{label}</span>
      <div>
        <input
          type="color"
          value={isHexColor(value) ? value : "#000000"}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label}色板`}
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={7}
          aria-label={`${label}色值`}
        />
      </div>
    </label>
  )
}

