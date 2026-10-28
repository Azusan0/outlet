import type { ReactNode } from "react"

export type GlyphName =
  | "storefront"
  | "import"
  | "agent"
  | "knowledge"
  | "erp"
  | "refresh"
  | "check"
  | "warning"
  | "arrow"
  | "plus"
  | "search"
  | "send"
  | "stop"
  | "file"
  | "chevron"
  | "shield"
  | "database"
  | "spark"
  | "clock"
  | "external"

type GlyphProps = {
  name: GlyphName
  size?: number
  className?: string
}

export function Glyph({ name, size = 18, className }: GlyphProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  }

  switch (name) {
    case "storefront":
      return (
        <svg {...common}>
          <path d="M4 10h16" />
          <path d="M5 10V5h14v5" />
          <path d="M4 10l1.5 9h13L20 10" />
          <path d="M9 19v-5h6v5" />
        </svg>
      )
    case "import":
      return (
        <svg {...common}>
          <path d="M12 3v11" />
          <path d="m8 10 4 4 4-4" />
          <path d="M4 15v4h16v-4" />
        </svg>
      )
    case "agent":
      return (
        <svg {...common}>
          <path d="M8 4h8v4H8z" />
          <path d="M5 9h14v10H5z" />
          <path d="M9 13h.01M15 13h.01" />
          <path d="M9 17h6" />
          <path d="M12 2v2" />
        </svg>
      )
    case "knowledge":
      return (
        <svg {...common}>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22z" />
          <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22z" />
        </svg>
      )
    case "erp":
      return (
        <svg {...common}>
          <path d="M4 7h11" />
          <path d="m12 4 3 3-3 3" />
          <path d="M20 17H9" />
          <path d="m12 14-3 3 3 3" />
          <path d="M4 7v10M20 7v10" />
        </svg>
      )
    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 7v5h-5" />
          <path d="M4 17v-5h5" />
          <path d="M6.1 9a7 7 0 0 1 11.7-2.4L20 9" />
          <path d="M17.9 15A7 7 0 0 1 6.2 17.4L4 15" />
        </svg>
      )
    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      )
    case "warning":
      return (
        <svg {...common}>
          <path d="M12 3 2.5 20h19z" />
          <path d="M12 9v5M12 17h.01" />
        </svg>
      )
    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="m14 7 5 5-5 5" />
        </svg>
      )
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m16 16 4 4" />
        </svg>
      )
    case "send":
      return (
        <svg {...common}>
          <path d="m3 3 18 9-18 9 3-9z" />
          <path d="M6 12h15" />
        </svg>
      )
    case "stop":
      return (
        <svg {...common}>
          <rect x="6" y="6" width="12" height="12" />
        </svg>
      )
    case "file":
      return (
        <svg {...common}>
          <path d="M6 2h8l4 4v16H6z" />
          <path d="M14 2v5h5" />
          <path d="M9 13h6M9 17h6" />
        </svg>
      )
    case "chevron":
      return (
        <svg {...common}>
          <path d="m8 10 4 4 4-4" />
        </svg>
      )
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      )
    case "database":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="5" rx="8" ry="3" />
          <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
          <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
        </svg>
      )
    case "spark":
      return (
        <svg {...common}>
          <path d="m12 2 1.4 5.1L18 9l-4.6 1.9L12 16l-1.4-5.1L6 9l4.6-1.9z" />
          <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z" />
        </svg>
      )
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      )
    case "external":
      return (
        <svg {...common}>
          <path d="M14 4h6v6" />
          <path d="m20 4-9 9" />
          <path d="M18 13v6H5V6h6" />
        </svg>
      )
  }
}

export function OperationsMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path d="M3 6h26v20H3z" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11h16M8 16h11M8 21h8" stroke="currentColor" strokeWidth="2" />
      <path d="M22 20h4v4h-4z" fill="currentColor" />
    </svg>
  )
}

export function StatusNotice({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "error" | "warning"
  children: ReactNode
}) {
  return (
    <div className={`ops-notice ops-notice--${tone}`} role="status">
      <Glyph
        name={
          tone === "success"
            ? "check"
            : tone === "error" || tone === "warning"
              ? "warning"
              : "spark"
        }
        size={16}
      />
      <span>{children}</span>
    </div>
  )
}

export function LoadingLines({ label = "正在读取数据" }: { label?: string }) {
  return (
    <div className="ops-loading" role="status" aria-label={label}>
      <span />
      <span />
      <span />
      <p>{label}</p>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="ops-empty">
      <Glyph name="database" size={26} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function SectionHeading({
  index,
  title,
  description,
  aside,
}: {
  index: string
  title: string
  description: string
  aside?: ReactNode
}) {
  return (
    <div className="ops-section-head">
      <div>
        <span className="ops-section-index">{index}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {aside ? <div className="ops-section-aside">{aside}</div> : null}
    </div>
  )
}
