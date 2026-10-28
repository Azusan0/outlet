"use client"

import Image from "next/image"
import { useEffect, useState } from "react"

import styles from "./portal.module.css"

const imageLoader = ({ src }: { src: string }) => {
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
  return src.startsWith("/") && basePath && !src.startsWith(`${basePath}/`)
    ? `${basePath}${src}`
    : src
}

type Role = "platform" | "merchant"
type ModuleId =
  | "overview"
  | "orders"
  | "products"
  | "store"
  | "customers"
  | "marketing"
  | "service"
  | "analytics"
  | "platform"

type Submodule = {
  id: string
  label: string
  description: string
}

type ModuleDefinition = {
  id: ModuleId
  label: string
  shortLabel: string
  icon: IconName
  allowedRoles: Role[]
  submodules: Submodule[]
}

type IconName =
  | "grid"
  | "orders"
  | "products"
  | "store"
  | "customers"
  | "marketing"
  | "service"
  | "analytics"
  | "platform"
  | "search"
  | "bell"
  | "settings"
  | "chevron"
  | "plus"
  | "filter"
  | "more"
  | "check"
  | "upload"
  | "edit"
  | "box"
  | "download"
  | "external"
  | "arrow"
  | "close"

const ALL_ROLES: Role[] = ["platform", "merchant"]
const PLATFORM_ONLY: Role[] = ["platform"]

const MODULES: ModuleDefinition[] = [
  {
    id: "overview",
    label: "工作台",
    shortLabel: "工作台",
    icon: "grid",
    allowedRoles: ALL_ROLES,
    submodules: [
      { id: "overview", label: "经营概览", description: "查看当前经营状态、待办与最近变化。" },
      { id: "tasks", label: "待办事项", description: "集中处理需要人工确认的运营动作。" },
      { id: "activity", label: "最近动态", description: "查看商品、订单和店铺的最新操作记录。" },
    ],
  },
  {
    id: "orders",
    label: "订单",
    shortLabel: "订单",
    icon: "orders",
    allowedRoles: ALL_ROLES,
    submodules: [
      { id: "list", label: "订单列表", description: "查看全部订单状态、金额和结算情况。" },
      { id: "pending", label: "待处理订单", description: "优先处理待发货、售后和异常订单。" },
      { id: "history", label: "订单履历", description: "查看订单从创建到完成的操作轨迹。" },
      { id: "settlement", label: "结算记录", description: "筛选已结算与未结算订单，核对结算明细。" },
    ],
  },
  {
    id: "products",
    label: "商品",
    shortLabel: "商品",
    icon: "products",
    allowedRoles: ALL_ROLES,
    submodules: [
      { id: "list", label: "商品列表", description: "上架、下架商品，查看商品状态、价格和库存。" },
      { id: "inventory", label: "库存管理", description: "手动调整单个商品库存，批量处理低库存商品。" },
      { id: "import", label: "商品信息导入", description: "上传 Excel 货单，校验后批量更新商品信息。" },
      { id: "bulk", label: "批量修改", description: "批量修改价格、库存、状态和销售渠道。" },
    ],
  },
  {
    id: "store",
    label: "店铺",
    shortLabel: "店铺",
    icon: "store",
    allowedRoles: PLATFORM_ONLY,
    submodules: [
      { id: "decoration", label: "店铺装修", description: "配置首页主题、品牌色、公告和首屏内容。" },
      { id: "pages", label: "页面管理", description: "管理首页、专题页和内容区块。" },
      { id: "domain", label: "域名设置", description: "绑定品牌域名，设置主域名和解析状态。" },
      { id: "publish", label: "发布记录", description: "查看店铺内容的历史版本和发布时间。" },
    ],
  },
  {
    id: "customers",
    label: "客户",
    shortLabel: "客户",
    icon: "customers",
    allowedRoles: PLATFORM_ONLY,
    submodules: [
      { id: "list", label: "客户列表", description: "查看客户订单、消费金额和最近活跃时间。" },
      { id: "segments", label: "客户分群", description: "按消费频次、金额和最近购买时间划分客户。" },
      { id: "membership", label: "会员等级", description: "设置会员等级、权益和升级规则。" },
    ],
  },
  {
    id: "marketing",
    label: "营销",
    shortLabel: "营销",
    icon: "marketing",
    allowedRoles: ALL_ROLES,
    submodules: [
      { id: "campaigns", label: "优惠活动", description: "创建满减、折扣和组合促销活动。" },
      { id: "coupons", label: "优惠券", description: "管理优惠券库存、使用范围和领取状态。" },
      { id: "content", label: "内容运营", description: "维护专题内容、品牌故事和活动素材。" },
    ],
  },
  {
    id: "service",
    label: "客服",
    shortLabel: "客服",
    icon: "service",
    allowedRoles: ALL_ROLES,
    submodules: [
      { id: "inbox", label: "在线会话", description: "处理顾客实时咨询，查看当前账号权限范围内的会话。" },
      { id: "tickets", label: "售后工单", description: "跟进退款、换货和物流异常等售后问题。" },
      { id: "quick", label: "快捷回复", description: "维护常见问题、标准话术和自动回复模板。" },
    ],
  },
  {
    id: "analytics",
    label: "数据",
    shortLabel: "数据",
    icon: "analytics",
    allowedRoles: ALL_ROLES,
    submodules: [
      { id: "sales", label: "销售分析", description: "按时间、商品和商家查看销售趋势。" },
      { id: "product", label: "商品分析", description: "查看商品转化、库存周转和退款情况。" },
      { id: "inventory", label: "库存分析", description: "识别低库存、滞销和缺货风险。" },
    ],
  },
  {
    id: "platform",
    label: "平台管理",
    shortLabel: "平台",
    icon: "platform",
    allowedRoles: PLATFORM_ONLY,
    submodules: [
      { id: "merchants", label: "商家与品牌", description: "一个商家对应一个品牌，统一管理商家资料和状态。" },
      { id: "domains", label: "租户与域名", description: "管理品牌站点、域名绑定和发布状态。" },
      { id: "members", label: "角色与权限", description: "按平台、商家和数据范围配置模块访问权限。" },
      { id: "audit", label: "审计日志", description: "查看平台级配置和权限变更记录。" },
      { id: "config", label: "系统配置", description: "管理平台公共配置和集成服务。" },
    ],
  },
]

const PERMISSION_MATRIX = [
  ["工作台", "全部商家", "本店经营", "按租户隔离"],
  ["订单", "全部商家订单", "本店订单", "按 merchant_id 隔离"],
  ["商品", "全部商家商品", "本店商品", "按 merchant_id 隔离"],
  ["店铺装修 / 域名", "完整管理", "不可见", "平台专属"],
  ["客户资产", "完整管理", "不可见", "平台专属"],
  ["营销", "全部商家活动", "本店活动", "按租户隔离"],
  ["客服", "全部会话", "本店会话", "按租户隔离"],
  ["数据 BI", "全局经营分析", "本店经营分析", "聚合 / 单店两种视图"],
  ["平台管理", "完整管理", "不可见", "平台专属"],
]

const isPlatformOnly = (module: ModuleDefinition) =>
  module.allowedRoles.length === 1 && module.allowedRoles[0] === "platform"

const MERCHANTS = [
  {
    id: "m_north",
    brand: "Northline",
    merchant: "North Studio",
    category: "城市通勤与轻户外",
    status: "正常营业",
    products: 64,
    orders: 84,
    gmv: "€28.4k",
    domain: "north.outlet.local",
    owner: "shane@northline.co",
  },
  {
    id: "m_aster",
    brand: "Aster Goods",
    merchant: "Aster Studio",
    category: "日常配饰与礼物",
    status: "待补资料",
    products: 31,
    orders: 32,
    gmv: "€9.6k",
    domain: "aster.outlet.local",
    owner: "ops@astergoods.co",
  },
  {
    id: "m_field",
    brand: "Field Notes",
    merchant: "Field Supply",
    category: "自然材质与日常器物",
    status: "正常营业",
    products: 48,
    orders: 39,
    gmv: "€12.8k",
    domain: "field.outlet.local",
    owner: "hello@fieldnotes.co",
  },
]

type OrderFilter = "all" | "pending" | "settled" | "unsettled"

const ORDERS = [
  {
    id: "#OR-1048",
    merchant: "North Studio",
    brand: "Northline",
    total: "€286.00",
    status: "待发货",
    settlement: "未结算",
    date: "10-28 10:42",
  },
  {
    id: "#OR-1047",
    merchant: "Field Supply",
    brand: "Field Notes",
    total: "€124.50",
    status: "已发货",
    settlement: "已结算",
    date: "10-28 09:18",
  },
  {
    id: "#OR-1046",
    merchant: "Aster Studio",
    brand: "Aster Goods",
    total: "€89.00",
    status: "售后中",
    settlement: "未结算",
    date: "10-27 18:51",
  },
  {
    id: "#OR-1045",
    merchant: "North Studio",
    brand: "Northline",
    total: "€412.00",
    status: "已完成",
    settlement: "已结算",
    date: "10-27 16:05",
  },
  {
    id: "#OR-1044",
    merchant: "North Studio",
    brand: "Northline",
    total: "€76.00",
    status: "已完成",
    settlement: "未结算",
    date: "10-27 14:24",
  },
]

const PRODUCTS = [
  {
    id: "p_041",
    name: "Linen Overshirt / Sand",
    sku: "NS-041",
    merchant: "North Studio",
    price: "€128",
    stock: 4,
    safety: 8,
    status: "在售",
  },
  {
    id: "p_018",
    name: "Trail Tote / Olive",
    sku: "NS-018",
    merchant: "North Studio",
    price: "€76",
    stock: 7,
    safety: 10,
    status: "在售",
  },
  {
    id: "p_032",
    name: "Utility Cap / Black",
    sku: "NS-032",
    merchant: "North Studio",
    price: "€42",
    stock: 18,
    safety: 8,
    status: "在售",
  },
  {
    id: "p_009",
    name: "Field Jacket / Stone",
    sku: "NS-009",
    merchant: "North Studio",
    price: "€248",
    stock: 11,
    safety: 6,
    status: "在售",
  },
  {
    id: "p_aster_014",
    name: "Leather Card Case / Ink",
    sku: "AG-014",
    merchant: "Aster Studio",
    price: "€58",
    stock: 26,
    safety: 12,
    status: "在售",
  },
  {
    id: "p_field_022",
    name: "Canvas Field Pouch / Moss",
    sku: "FS-022",
    merchant: "Field Supply",
    price: "€64",
    stock: 3,
    safety: 8,
    status: "在售",
  },
]

const CUSTOMERS = [
  { name: "Mia Chen", email: "mia.chen@example.com", orders: 8, spend: "€1,248", active: "今天 09:12" },
  { name: "Jonas Weber", email: "jonas.w@example.com", orders: 4, spend: "€682", active: "昨天 18:40" },
  { name: "Sofia Rossi", email: "sofia.r@example.com", orders: 2, spend: "€246", active: "10-26 14:08" },
  { name: "Alex Kim", email: "alex.kim@example.com", orders: 1, spend: "€89", active: "10-25 11:32" },
]

type ConversationStatus = "待接入" | "处理中" | "已结束"
type ChatMessage = {
  from: "customer" | "agent" | "system"
  text: string
  time: string
}
type Conversation = {
  id: string
  customer: string
  merchant: string
  brand: string
  lastMessage: string
  wait: string
  unread: number
  status: ConversationStatus
  order: string
  customerSince: string
  totalSpend: string
  tags: string[]
  messages: ChatMessage[]
}

const CONVERSATIONS: Conversation[] = [
  {
    id: "CS-2081",
    customer: "Mia Chen",
    merchant: "North Studio",
    brand: "Northline",
    lastMessage: "这件衬衫还有 M 码吗？",
    wait: "2 分钟",
    unread: 2,
    status: "待接入",
    order: "#OR-1048",
    customerSince: "2024-03-18",
    totalSpend: "€1,248",
    tags: ["高价值客户", "复购 8 次"],
    messages: [
      { from: "system", text: "顾客从订单详情页发起咨询", time: "10:40" },
      { from: "customer", text: "你好，这件 Linen Overshirt 还有 M 码吗？", time: "10:41" },
      { from: "customer", text: "我 165cm，平时穿 M 码。", time: "10:41" },
    ],
  },
  {
    id: "CS-2079",
    customer: "Jonas Weber",
    merchant: "North Studio",
    brand: "Northline",
    lastMessage: "物流三天没有更新了",
    wait: "6 分钟",
    unread: 1,
    status: "处理中",
    order: "#OR-1045",
    customerSince: "2025-01-09",
    totalSpend: "€682",
    tags: ["复购客户"],
    messages: [
      { from: "customer", text: "我的包裹物流三天没有更新了，可以帮我看一下吗？", time: "10:31" },
      { from: "agent", text: "可以，我正在联系承运商核实，请稍等。", time: "10:34" },
    ],
  },
  {
    id: "CS-2076",
    customer: "Sofia Rossi",
    merchant: "Aster Studio",
    brand: "Aster Goods",
    lastMessage: "礼盒包装可以更换颜色吗？",
    wait: "11 分钟",
    unread: 3,
    status: "待接入",
    order: "#OR-1046",
    customerSince: "2025-08-22",
    totalSpend: "€246",
    tags: ["新客户"],
    messages: [
      { from: "customer", text: "礼盒包装可以更换颜色吗？我想送人。", time: "10:24" },
      { from: "customer", text: "如果可以，希望换成米白色。", time: "10:25" },
      { from: "customer", text: "订单还没有发货。", time: "10:25" },
    ],
  },
  {
    id: "CS-2071",
    customer: "Alex Kim",
    merchant: "Field Supply",
    brand: "Field Notes",
    lastMessage: "已收到，谢谢",
    wait: "刚刚结束",
    unread: 0,
    status: "已结束",
    order: "#OR-1042",
    customerSince: "2025-10-25",
    totalSpend: "€89",
    tags: ["新客户", "已解决"],
    messages: [
      { from: "customer", text: "补发的肩带已经收到了。", time: "09:52" },
      { from: "agent", text: "好的，感谢确认。后续有问题随时联系我们。", time: "09:53" },
      { from: "customer", text: "已收到，谢谢", time: "09:54" },
    ],
  },
]

const SERVICE_TICKETS = [
  ["TK-318", "#OR-1046", "Aster Goods", "礼盒包装颜色更换", "中", "待处理", "今天 10:25"],
  ["TK-317", "#OR-1045", "Northline", "物流轨迹超过 72 小时未更新", "高", "处理中", "今天 10:31"],
  ["TK-314", "#OR-1039", "Field Notes", "缺少配件，申请补发", "中", "待客户确认", "昨天 18:12"],
  ["TK-309", "#OR-1036", "Northline", "尺码不合适，申请换货", "低", "已解决", "10-26 14:40"],
]

const QUICK_REPLIES = [
  ["库存与尺码", "这款目前有货，尺码建议可参考详情页的尺码表。如仍不确定，请告诉我身高体重，我再帮你判断。"],
  ["物流查询", "已收到你的物流问题，我正在联系承运商核实最新轨迹，会在 30 分钟内回复你。"],
  ["退换货", "支持签收后 14 天内无理由退换，商品需保持吊牌完整。请提供订单号和商品照片。"],
  ["礼盒与包装", "目前提供标准礼盒包装，部分品牌支持颜色备注。我们会尽量按你的需求安排。"],
]

const ACTIVITY = [
  { time: "10:42", title: "更新店铺首页", detail: "Northline / 首页首屏内容已保存" },
  { time: "09:18", title: "订单状态变更", detail: "#OR-1047 已标记为已发货" },
  { time: "08:51", title: "商品导入校验完成", detail: "IMP-028 / 126 行中 12 行待复核" },
  { time: "昨天", title: "商家资料更新", detail: "Aster Studio 进入待补资料状态" },
]

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, string> = {
    grid: "M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z",
    orders: "M5 3h10v14l-2.5-1.5L10 17l-2.5-1.5L5 17zM7.5 7h5M7.5 10h5",
    products: "M4 6h12M5 6v10h10V6M7 3h6v3H7zM7 10h5M7 13h3",
    store: "M3 8 5 3h10l2 5v2H3zM4 10v7h12v-7M7 17v-4h4v4",
    customers: "M8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 17c.5-3 2.3-4.5 5.5-4.5s5 1.5 5.5 4.5M14 5.5a2.3 2.3 0 1 0 0 4.6M13.5 12.8c2.4.2 3.8 1.5 4.2 4.2",
    marketing: "M3 9v4h3l5 3V6L6 9zM14 7c1.2 1.2 1.8 2.6 1.8 4S15.2 13.8 14 15M16.5 4.5C18.5 6 19.5 8 19.5 10s-1 4-3 5.5",
    service: "M4 4h12v9H9l-4 3v-3H4zM7 8h6M7 10.5h4",
    analytics: "M4 16V9M9 16V5M14 16v-4M19 16V7M2 19h18",
    platform: "M10 2.5 17 6v4.5c0 4-2.5 6.2-7 8-4.5-1.8-7-4-7-8V6zM7.5 10.2l1.6 1.6 3.5-3.6",
    search: "M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM13.5 13.5 18 18",
    bell: "M4 14h12l-1.5-2V8a4.5 4.5 0 0 0-9 0v4zM8 17a2 2 0 0 0 4 0",
    settings: "M10 12.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8ZM10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4",
    chevron: "m6 8 4 4 4-4",
    plus: "M10 3v14M3 10h14",
    filter: "M3 5h14M6 10h8M8 15h4",
    more: "M5 10h.01M10 10h.01M15 10h.01",
    check: "m4 10 4 4 8-8",
    upload: "M10 15V3M6 7l4-4 4 4M4 17h12",
    edit: "m4 16-.5 2.5L6 18l9.5-9.5-2-2zM12 6l2 2",
    box: "m3 5 7-3 7 3v10l-7 3-7-3zM3 5l7 3 7-3M10 8v10",
    download: "M10 3v12M6 11l4 4 4-4M4 19h12",
    external: "M4 16 16 4M8 4h8v8",
    arrow: "M3 10h12M11 6l4 4-4 4",
    close: "m5 5 10 10M15 5 5 15",
  }

  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d={paths[name]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  )
}

function Badge({ tone, children }: { tone: "green" | "amber" | "red" | "blue" | "gray"; children: React.ReactNode }) {
  return <span className={`${styles.badge} ${styles[`badge_${tone}`]}`}>{children}</span>
}

function StatCard({ label, value, note, icon }: { label: string; value: string; note: string; icon: IconName }) {
  return (
    <article className={styles.statCard}>
      <div className={styles.statTop}>
        <span>{label}</span>
        <span className={styles.statIcon}><Icon name={icon} size={17} /></span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  )
}

function SectionHead({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className={styles.sectionHead}>
      <div>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  )
}

function OverviewPage({
  role,
  setModule,
}: {
  role: Role
  setModule: (module: ModuleId, submodule?: string) => void
}) {
  const merchants = role === "platform" ? MERCHANTS : MERCHANTS.slice(0, 1)
  const tasks: Array<{
    index: string
    title: string
    tag: string
    module: ModuleId
    submodule: string
    tone: "amber" | "red" | "gray"
    badge: string
  }> = role === "platform"
    ? [
        { index: "01", title: "3 个商品导入批次待复核", tag: "商品信息导入", module: "products", submodule: "import", tone: "amber", badge: "待处理" },
        { index: "02", title: "8 笔订单待发货", tag: "订单列表", module: "orders", submodule: "pending", tone: "amber", badge: "待处理" },
        { index: "03", title: "Aster Studio 资料待补", tag: "商家与品牌", module: "platform", submodule: "merchants", tone: "red", badge: "需补资料" },
        { index: "04", title: "Northline 域名待验证", tag: "租户与域名", module: "platform", submodule: "domains", tone: "gray", badge: "待处理" },
      ]
    : [
        { index: "01", title: "3 个商品导入批次待复核", tag: "商品信息导入", module: "products", submodule: "import", tone: "amber", badge: "待处理" },
        { index: "02", title: "8 笔订单待发货", tag: "订单列表", module: "orders", submodule: "pending", tone: "amber", badge: "待处理" },
        { index: "03", title: "2 个顾客会话等待接入", tag: "在线会话", module: "service", submodule: "inbox", tone: "red", badge: "待回复" },
        { index: "04", title: "秋季满减将在 3 天后结束", tag: "优惠活动", module: "marketing", submodule: "campaigns", tone: "gray", badge: "待确认" },
      ]
  const quickModules = role === "platform"
    ? [
        { module: "orders" as ModuleId, submodule: "list", icon: "orders" as IconName, title: "订单列表", description: "查看全部商家的状态、结算和待处理订单" },
        { module: "products" as ModuleId, submodule: "list", icon: "products" as IconName, title: "商品列表", description: "跨商家查看商品、价格、库存和上下架状态" },
        { module: "service" as ModuleId, submodule: "inbox", icon: "service" as IconName, title: "客服工作台", description: "查看全部商家会话并介入高优先级咨询" },
        { module: "platform" as ModuleId, submodule: "merchants", icon: "platform" as IconName, title: "商家与品牌", description: "维护商家资料、品牌归属和营业状态" },
      ]
    : [
        { module: "orders" as ModuleId, submodule: "list", icon: "orders" as IconName, title: "订单列表", description: "处理本店订单、结算和售后状态" },
        { module: "products" as ModuleId, submodule: "list", icon: "products" as IconName, title: "商品列表", description: "维护本店商品、价格、库存和上下架" },
        { module: "service" as ModuleId, submodule: "inbox", icon: "service" as IconName, title: "客服工作台", description: "回复本店顾客咨询和售后问题" },
        { module: "marketing" as ModuleId, submodule: "campaigns", icon: "marketing" as IconName, title: "优惠活动", description: "查看本店活动效果和即将到期任务" },
      ]
  const activities = role === "platform"
    ? ACTIVITY
    : [
        { time: "10:42", title: "商品库存已更新", detail: "NS-041 / 当前库存 4 件" },
        { time: "10:31", title: "客服会话已分配", detail: "CS-2079 / Jonas Weber" },
        { time: "09:18", title: "订单状态变更", detail: "#OR-1047 已标记为已发货" },
        { time: "昨天", title: "商品导入校验完成", detail: "IMP-028 / 126 行中 12 行待复核" },
      ]

  return (
    <div className={styles.pageStack}>
      <div className={styles.statGrid}>
        <StatCard label="成交金额" value={role === "platform" ? "€50.8k" : "€28.4k"} note="较上月 +12.4%" icon="analytics" />
        <StatCard label="订单数" value={role === "platform" ? "155" : "84"} note="今日新增 12 单" icon="orders" />
        <StatCard label="在售商品" value={role === "platform" ? "143" : "64"} note="7 个低库存 SKU" icon="products" />
        <StatCard label={role === "platform" ? "商家数" : "待回复会话"} value={role === "platform" ? "3" : "2"} note={role === "platform" ? "1 家待补资料" : "最长等待 6 分钟"} icon={role === "platform" ? "customers" : "service"} />
      </div>

      <div className={styles.twoColumn}>
        <section className={styles.card}>
          <SectionHead
            eyebrow={role === "platform" ? "MERCHANT DIRECTORY" : "MY STORE"}
            title={role === "platform" ? "商家与品牌" : "我的店铺"}
            action={role === "platform" ? <button className={styles.textButton} onClick={() => setModule("platform", "merchants")}>查看全部 <Icon name="arrow" size={15} /></button> : <Badge tone="blue">North Studio</Badge>}
          />
          <div className={styles.merchantList}>
            {merchants.map((merchant) => (
              <button className={styles.merchantRow} key={merchant.id} onClick={() => setModule("products", "list")}>
                <span className={styles.merchantAvatar}>{merchant.brand.slice(0, 1)}</span>
                <span className={styles.merchantIdentity}>
                  <strong>{merchant.brand}</strong>
                  <small>{merchant.merchant} · {merchant.category}</small>
                </span>
                <span className={styles.merchantNumbers}>
                  <strong>{merchant.gmv}</strong>
                  <small>{merchant.orders} 单</small>
                </span>
                <Badge tone={merchant.status === "正常营业" ? "green" : "amber"}>{merchant.status}</Badge>
                <Icon name="chevron" size={15} />
              </button>
            ))}
          </div>
        </section>

        <section className={styles.card}>
          <SectionHead
            eyebrow="TODAY / ACTION QUEUE"
            title="待处理"
            action={<span className={styles.countBadge}>04</span>}
          />
          <div className={styles.taskList}>
            {tasks.map((task) => (
              <button
                className={styles.taskRow}
                key={task.index}
                onClick={() => setModule(task.module, task.submodule)}
              >
                <span>{task.index}</span>
                <strong>{task.title}</strong>
                <small>{task.tag}</small>
                <Badge tone={task.tone}>{task.badge}</Badge>
                <Icon name="chevron" size={14} />
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className={styles.card}>
        <SectionHead eyebrow="QUICK ACCESS" title="常用模块" action={<span className={styles.mutedText}>按你的工作流排序</span>} />
        <div className={styles.quickGrid}>
          {quickModules.map((item) => (
            <button className={styles.quickCard} key={item.title} onClick={() => setModule(item.module, item.submodule)}>
              <span className={styles.quickIcon}><Icon name={item.icon} size={20} /></span>
              <strong>{item.title}</strong>
              <small>{item.description}</small>
              <Icon name="arrow" size={16} />
            </button>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <SectionHead eyebrow="RECENT ACTIVITY" title="最近动态" action={<button className={styles.textButton}>查看全部 <Icon name="arrow" size={15} /></button>} />
        <div className={styles.activityList}>
          {activities.map((item) => (
            <div className={styles.activityRow} key={`${item.time}-${item.title}`}>
              <span className={styles.activityTime}>{item.time}</span>
              <span className={styles.activityDot} />
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function OrdersPage({
  role,
  submodule,
  notify,
}: {
  role: Role
  submodule: string
  notify: (message: string) => void
}) {
  const [filter, setFilter] = useState<OrderFilter>(submodule === "settlement" ? "unsettled" : submodule === "pending" ? "pending" : "all")
  const scopedOrders = role === "platform" ? ORDERS : ORDERS.filter((order) => order.merchant === "North Studio")

  useEffect(() => {
    setFilter(submodule === "settlement" ? "unsettled" : submodule === "pending" ? "pending" : "all")
  }, [submodule])

  const rows = scopedOrders.filter((order) => {
    if (filter === "pending") return order.status === "待发货" || order.status === "售后中"
    if (filter === "settled") return order.settlement === "已结算"
    if (filter === "unsettled") return order.settlement === "未结算"
    return true
  })
  const pendingCount = scopedOrders.filter((order) => order.status === "待发货").length
  const afterSalesCount = scopedOrders.filter((order) => order.status === "售后中").length
  const unsettledCount = scopedOrders.filter((order) => order.settlement === "未结算").length

  return (
    <div className={styles.pageStack}>
      <section className={styles.card}>
        <SectionHead
          eyebrow={submodule === "settlement" ? "SETTLEMENT LEDGER" : "ORDER MANAGEMENT"}
          title={submodule === "settlement" ? "结算记录" : submodule === "history" ? "订单履历" : "订单列表"}
          action={<button className={styles.secondaryButton} onClick={() => notify("已导出当前筛选结果（Demo）")}> <Icon name="download" size={15} />导出</button>}
        />
        <div className={styles.summaryStrip}>
          <div><span>全部订单</span><strong>{scopedOrders.length}</strong><small>{role === "platform" ? "全部商家" : "仅本店数据"}</small></div>
          <div><span>待发货</span><strong>{pendingCount}</strong><small>需在今日处理</small></div>
          <div><span>售后中</span><strong>{afterSalesCount}</strong><small>等待人工确认</small></div>
          <div><span>未结算</span><strong>{unsettledCount}</strong><small>待生成结算单</small></div>
        </div>
        <div className={styles.filterPanel}>
          <div className={styles.filterGrid}>
            <label className={styles.filterField}><span>订单号</span><input placeholder="请输入订单号" /></label>
            <label className={styles.filterField}><span>商家 / 品牌</span><input defaultValue={role === "merchant" ? "North Studio / Northline" : ""} placeholder="请选择或输入" disabled={role === "merchant"} /></label>
            <label className={styles.filterField}><span>下单时间</span><input placeholder="起始时间 - 结束时间" /></label>
            <label className={styles.filterField}><span>订单状态</span><select defaultValue=""><option value="">全部状态</option><option>待发货</option><option>已发货</option><option>已完成</option><option>售后中</option></select></label>
            <label className={styles.filterField}><span>结算状态</span><select defaultValue=""><option value="">全部</option><option>已结算</option><option>未结算</option></select></label>
            <label className={styles.filterField}><span>销售渠道</span><select defaultValue=""><option value="">全部渠道</option><option>线上商城</option><option>线下门店</option></select></label>
          </div>
          <div className={styles.filterActions}>
            <button className={styles.primaryButton} onClick={() => notify("已按当前条件查询订单（Demo）")}><Icon name="search" size={15} />查询</button>
            <button className={styles.ghostButton} onClick={() => notify("订单筛选条件已重置（Demo）")}>重置</button>
          </div>
        </div>
        <div className={styles.filterBar}>
          <div className={styles.filterTabs}>
            {[
              ["all", "全部订单"],
              ["pending", "待处理"],
              ["settled", "已结算"],
              ["unsettled", "未结算"],
            ].map(([value, label]) => (
              <button key={value} className={filter === value ? styles.filterActive : ""} onClick={() => setFilter(value as OrderFilter)}>{label}</button>
            ))}
          </div>
          <button className={styles.ghostButton}><Icon name="filter" size={15} />筛选</button>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>订单号</th><th>商家 / 品牌</th><th>金额</th><th>订单状态</th><th>结算状态</th><th>更新时间</th><th /></tr></thead>
            <tbody>
              {rows.map((order) => (
                <tr key={order.id}>
                  <td><strong>{order.id}</strong></td>
                  <td><span className={styles.tableIdentity}><strong>{order.merchant}</strong><small>{order.brand}</small></span></td>
                  <td>{order.total}</td>
                  <td><Badge tone={order.status === "待发货" ? "amber" : order.status === "售后中" ? "red" : "green"}>{order.status}</Badge></td>
                  <td><Badge tone={order.settlement === "已结算" ? "green" : "gray"}>{order.settlement}</Badge></td>
                  <td>{order.date}</td>
                  <td><button className={styles.iconButton} onClick={() => notify(`打开 ${order.id} 详情（Demo）`)}><Icon name="arrow" size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? <div className={styles.emptyState}>当前筛选条件下没有订单。</div> : null}
        </div>
        <div className={styles.tableFoot}><span>共 {rows.length} 条记录</span><span>订单状态与结算状态分别维护</span></div>
      </section>

      <section className={styles.tipCard}>
        <span className={styles.tipIcon}><Icon name="check" size={16} /></span>
        <div><strong>结算状态通过筛选查看</strong><p>结算记录不是一个孤立模块，而是订单列表上的状态维度。你可以直接筛选已结算或未结算订单，核对结算批次。</p></div>
      </section>
    </div>
  )
}

function ProductsPage({
  role,
  submodule,
  notify,
}: {
  role: Role
  submodule: string
  notify: (message: string) => void
}) {
  const [statuses, setStatuses] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState(PRODUCTS[0].id)
  const [saved, setSaved] = useState(false)
  const scopedProducts = role === "platform" ? PRODUCTS : PRODUCTS.filter((item) => item.merchant === "North Studio")
  const product = scopedProducts.find((item) => item.id === selected) || scopedProducts[0] || PRODUCTS[0]
  const status = statuses[product.id] || product.status

  useEffect(() => {
    setSelected(PRODUCTS[0].id)
  }, [role])

  if (submodule === "import") {
    return <ImportPage notify={notify} />
  }

  if (submodule === "inventory") {
    return (
      <section className={styles.card}>
        <SectionHead eyebrow="INVENTORY CONTROL" title="库存管理" action={<button className={styles.secondaryButton} onClick={() => notify("已导出库存报表（Demo）")}><Icon name="download" size={15} />导出库存</button>} />
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>商品</th><th>SKU</th><th>当前库存</th><th>安全库存</th><th>状态</th><th>快捷操作</th></tr></thead>
            <tbody>
              {scopedProducts.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.sku}</td>
                  <td><input className={styles.inlineInput} defaultValue={item.stock} aria-label={`${item.name} 库存`} /></td>
                  <td>{item.safety}</td>
                  <td><Badge tone={item.stock < item.safety ? "amber" : "green"}>{item.stock < item.safety ? "低库存" : "正常"}</Badge></td>
                  <td><button className={styles.textButton} onClick={() => notify(`${item.sku} 库存已保存（Demo）`)}>保存</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    )
  }

  if (submodule === "bulk") {
    return (
      <section className={styles.card}>
        <SectionHead eyebrow="BULK UPDATE" title="批量修改" action={<button className={styles.primaryButton} onClick={() => notify("批量任务已创建（Demo）")}><Icon name="check" size={15} />应用修改</button>} />
        <div className={styles.bulkToolbar}>
          <span>已选择 3 个商品</span>
          <button className={styles.ghostButton}>批量改价格</button>
          <button className={styles.ghostButton}>批量改库存</button>
          <button className={styles.ghostButton}>批量上下架</button>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th><input type="checkbox" aria-label="全选" defaultChecked /></th><th>商品</th><th>SKU</th><th>售价</th><th>库存</th><th>状态</th></tr></thead>
            <tbody>
              {scopedProducts.slice(0, 3).map((item) => (
                <tr key={item.id}><td><input type="checkbox" aria-label={`选择 ${item.name}`} defaultChecked /></td><td><strong>{item.name}</strong></td><td>{item.sku}</td><td>{item.price}</td><td>{item.stock}</td><td><Badge tone="green">在售</Badge></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    )
  }

  return (
    <div className={styles.productLayout}>
      <section className={styles.card}>
        <SectionHead eyebrow="PRODUCT CATALOG" title="商品列表" action={<button className={styles.primaryButton} onClick={() => notify("新建商品表单已打开（Demo）")}><Icon name="plus" size={15} />新建商品</button>} />
        <div className={styles.summaryStrip}>
          <div><span>在售商品</span><strong>{scopedProducts.length}</strong><small>{role === "platform" ? "全部商家" : "仅本店数据"}</small></div>
          <div><span>已下架</span><strong>0</strong><small>可重新上架</small></div>
          <div><span>低库存</span><strong>{scopedProducts.filter((item) => item.stock < item.safety).length}</strong><small>低于安全库存</small></div>
          <div><span>待完善</span><strong>0</strong><small>图片或规格缺失</small></div>
        </div>
        <div className={styles.filterPanel}>
          <div className={styles.filterGrid}>
            <label className={styles.filterField}><span>店铺名称</span><input defaultValue={role === "merchant" ? "Northline / North Studio" : ""} placeholder="全部商家" disabled={role === "merchant"} /></label>
            <label className={styles.filterField}><span>商品分类</span><select defaultValue=""><option value="">全部商品分类</option><option>服装</option><option>鞋包</option><option>配饰</option></select></label>
            <label className={styles.filterField}><span>商品编号 / SKU</span><input placeholder="支持逗号分隔批量搜索" /></label>
            <label className={styles.filterField}><span>商品名称</span><input placeholder="请输入商品名称" /></label>
            <label className={styles.filterField}><span>商品状态</span><select defaultValue=""><option value="">全部</option><option>在售</option><option>已下架</option></select></label>
            <label className={styles.filterField}><span>库存状态</span><select defaultValue=""><option value="">全部</option><option>充足</option><option>低库存</option><option>缺货</option></select></label>
          </div>
          <div className={styles.filterActions}>
            <button className={styles.primaryButton} onClick={() => notify("已按当前条件查询商品（Demo）")}><Icon name="search" size={15} />查询</button>
            <button className={styles.ghostButton} onClick={() => notify("商品筛选条件已重置（Demo）")}>重置</button>
          </div>
        </div>
        <div className={styles.filterBar}>
          <div className={styles.filterTabs}><button className={styles.filterActive}>全部商品</button><button>在售</button><button>已下架</button><button>低库存</button></div>
          <button className={styles.ghostButton}><Icon name="filter" size={15} />筛选</button>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>商品</th><th>SKU</th><th>售价</th><th>库存</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              {scopedProducts.map((item) => {
                const currentStatus = statuses[item.id] || item.status
                return (
                  <tr key={item.id} className={selected === item.id ? styles.selectedRow : ""} onClick={() => setSelected(item.id)}>
                    <td><strong>{item.name}</strong><small className={styles.tableSub}>{item.merchant}</small></td>
                    <td>{item.sku}</td>
                    <td>{item.price}</td>
                    <td><span className={item.stock < item.safety ? styles.lowStock : ""}>{item.stock}</span></td>
                    <td><Badge tone={currentStatus === "在售" ? "green" : "gray"}>{currentStatus}</Badge></td>
                    <td><button className={styles.textButton} onClick={(event) => { event.stopPropagation(); setSelected(item.id) }}>编辑</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      <aside className={styles.editorCard}>
        <div className={styles.editorHead}><div><span className={styles.eyebrow}>QUICK EDIT</span><h3>商品信息</h3></div><button className={styles.iconButton}><Icon name="close" size={16} /></button></div>
        <div className={styles.editorPreview}><span>{product.sku}</span><strong>{product.name}</strong><small>{product.merchant}</small></div>
        <label className={styles.field}><span>售价</span><input defaultValue={product.price} /></label>
        <label className={styles.field}><span>库存</span><input defaultValue={product.stock} /></label>
        <label className={styles.field}><span>商品状态</span><select defaultValue={status} onChange={(event) => setStatuses((current) => ({ ...current, [product.id]: event.target.value }))}><option>在售</option><option>已下架</option></select></label>
        <div className={styles.editorActions}><button className={styles.primaryButton} onClick={() => { setSaved(true); notify(`${product.name} 已保存（Demo）`) }}><Icon name="check" size={15} />保存修改</button><button className={styles.secondaryButton} onClick={() => setStatuses((current) => ({ ...current, [product.id]: status === "在售" ? "已下架" : "在售" }))}>{status === "在售" ? "下架商品" : "上架商品"}</button></div>
        {saved ? <div className={styles.savedHint}><Icon name="check" size={14} />演示数据已更新</div> : null}
      </aside>
    </div>
  )
}

function ImportPage({ notify }: { notify: (message: string) => void }) {
  return (
    <div className={styles.pageStack}>
      <section className={styles.card}>
        <SectionHead eyebrow="PRODUCT IMPORT" title="商品信息导入" action={<button className={styles.secondaryButton}><Icon name="download" size={15} />下载模板</button>} />
        <div className={styles.importGrid}>
          <div className={styles.dropzone}><span className={styles.uploadIcon}><Icon name="upload" size={24} /></span><strong>拖拽 Excel 货单到这里</strong><p>支持 .xlsx / .xls，导入前会先校验字段和库存数据。</p><button className={styles.primaryButton} onClick={() => notify("已选择演示文件（Demo）")}>选择文件</button></div>
          <div className={styles.importSteps}><div><span>01</span><strong>上传货单</strong><small>选择标准模板或已有货单</small></div><div><span>02</span><strong>字段校验</strong><small>识别条码、价格和库存异常</small></div><div><span>03</span><strong>预览确认</strong><small>确认后再写入商品数据</small></div></div>
        </div>
      </section>
      <section className={styles.card}>
        <SectionHead eyebrow="RECENT BATCHES" title="最近导入" action={<span className={styles.mutedText}>3 个批次</span>} />
        <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>批次</th><th>文件</th><th>行数</th><th>异常</th><th>状态</th><th>时间</th></tr></thead><tbody><tr><td><strong>IMP-028</strong></td><td>春季新品.xlsx</td><td>126</td><td>12</td><td><Badge tone="amber">待复核</Badge></td><td>今天 08:51</td></tr><tr><td><strong>IMP-027</strong></td><td>库存更新.xlsx</td><td>84</td><td>0</td><td><Badge tone="green">已完成</Badge></td><td>10-27 16:20</td></tr></tbody></table></div>
      </section>
    </div>
  )
}

function StorePage({ submodule, notify }: { submodule: string; notify: (message: string) => void }) {
  if (submodule === "pages") {
    return <SimpleTablePage eyebrow="PAGE MANAGEMENT" title="页面管理" columns={["页面", "路径", "状态", "更新时间"]} rows={[["首页", "/", "已发布", "今天 10:42"], ["春季专题", "/spring", "草稿", "10-27 18:20"], ["品牌故事", "/about", "已发布", "10-24 09:18"]]} />
  }
  if (submodule === "domain") {
    return <SimpleTablePage eyebrow="DOMAIN SETTINGS" title="域名设置" columns={["域名", "类型", "验证状态", "绑定时间"]} rows={[["north.outlet.local", "主域名", "已验证", "10-20 12:08"], ["northline.example.com", "备用域名", "待验证", "10-27 16:40"]]} />
  }
  if (submodule === "publish") {
    return (
      <section className={styles.card}><SectionHead eyebrow="PUBLISH HISTORY" title="发布记录" /><div className={styles.timeline}>{["首页首屏内容更新", "春季专题页发布", "品牌色与公告调整", "店铺域名验证"].map((item, index) => <div key={item}><span>{index === 0 ? "今天 10:42" : `10-${27 - index} ${12 + index}:18`}</span><i /><div><strong>{item}</strong><small>操作人：Shane Wu · 已发布</small></div></div>)}</div></section>
    )
  }
  return (
    <div className={styles.storeLayout}>
      <section className={styles.card}>
        <SectionHead eyebrow="STOREFRONT STUDIO" title="店铺装修" action={<button className={styles.primaryButton} onClick={() => notify("店铺首页已发布（Demo）")}><Icon name="check" size={15} />发布首页</button>} />
        <div className={styles.formGrid}>
          <label className={styles.field}><span>首页标签</span><input defaultValue="THE INDEPENDENT EDIT" /></label>
          <label className={styles.field}><span>主标题</span><input defaultValue="Selected by Northline." /></label>
          <label className={styles.field}><span>副标题</span><textarea defaultValue="A considered edit of everyday uniforms and outdoor layers." /></label>
          <div className={styles.colorField}><span>主题色</span><div><i style={{ background: "#155eef" }} /><i style={{ background: "#f5f7fb" }} /><i style={{ background: "#172033" }} /></div></div>
        </div>
      </section>
      <aside className={styles.storePreview}>
        <div className={styles.previewImage}><Image src="/images/hero/Image.jpg" alt="店铺装修预览" fill sizes="(min-width: 900px) 40vw, 100vw" loader={imageLoader} unoptimized /><span>PREVIEW / HOME</span></div>
        <div className={styles.previewCopy}><span>THE INDEPENDENT EDIT</span><h3>Selected by<br />Northline.</h3><p>A considered edit of everyday uniforms and outdoor layers.</p><button className={styles.secondaryButton}>查看店铺 <Icon name="external" size={14} /></button></div>
      </aside>
    </div>
  )
}

function SimpleTablePage({ eyebrow, title, columns, rows }: { eyebrow: string; title: string; columns: string[]; rows: string[][] }) {
  return (
    <section className={styles.card}>
      <SectionHead eyebrow={eyebrow} title={title} action={<button className={styles.primaryButton}><Icon name="plus" size={15} />新建</button>} />
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${cell}`}>{index === 2 ? <Badge tone={cell === "已发布" || cell === "已验证" ? "green" : "amber"}>{cell}</Badge> : index === 0 ? <strong>{cell}</strong> : cell}</td>)}</tr>)}</tbody></table></div>
    </section>
  )
}

function CustomersPage({ submodule }: { submodule: string }) {
  if (submodule === "segments") {
    return <section className={styles.card}><SectionHead eyebrow="CUSTOMER SEGMENTS" title="客户分群" /><div className={styles.segmentGrid}>{[["高价值客户", "18", "最近 90 天消费 ≥ €500"], ["新客户", "42", "首次购买在 30 天内"], ["待唤醒客户", "27", "超过 90 天未购买"], ["高频客户", "13", "购买次数 ≥ 3"]].map(([name, count, note]) => <div className={styles.segmentCard} key={name}><span>{count}</span><strong>{name}</strong><small>{note}</small><button className={styles.textButton}>查看客户 <Icon name="arrow" size={14} /></button></div>)}</div></section>
  }
  if (submodule === "membership") {
    return <section className={styles.card}><SectionHead eyebrow="MEMBERSHIP" title="会员等级" /><div className={styles.membershipGrid}>{[["普通会员", "0", "积分 0-499"], ["银卡会员", "5%", "积分 500-1999"], ["金卡会员", "10%", "积分 2000+"]].map(([name, discount, note]) => <div className={styles.membershipCard} key={name}><Badge tone={name === "金卡会员" ? "amber" : "blue"}>{name}</Badge><strong>{discount} 折扣</strong><small>{note}</small></div>)}</div></section>
  }
  return (
    <section className={styles.card}>
      <SectionHead eyebrow="CUSTOMER DIRECTORY" title="客户列表" action={<button className={styles.secondaryButton}><Icon name="download" size={15} />导出客户</button>} />
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>客户</th><th>邮箱</th><th>订单数</th><th>累计消费</th><th>最近活跃</th><th /></tr></thead><tbody>{CUSTOMERS.map((customer) => <tr key={customer.email}><td><strong>{customer.name}</strong></td><td>{customer.email}</td><td>{customer.orders}</td><td>{customer.spend}</td><td>{customer.active}</td><td><button className={styles.iconButton}><Icon name="arrow" size={16} /></button></td></tr>)}</tbody></table></div>
    </section>
  )
}

function MarketingPage({ submodule, notify }: { submodule: string; notify: (message: string) => void }) {
  const content = submodule === "coupons"
    ? { eyebrow: "COUPON CENTER", title: "优惠券", cards: [["新客首单券", "€10", "已领取 128 / 使用 64"], ["满减券", "€20", "已领取 84 / 使用 31"], ["会员专享券", "€30", "已领取 42 / 使用 18"]] }
    : submodule === "content"
      ? { eyebrow: "CONTENT OPERATIONS", title: "内容运营", cards: [["春季通勤专题", "已发布", "首页内容位"], ["材质与日常", "草稿", "品牌故事"], ["本周编辑精选", "已发布", "专题页"]] }
      : { eyebrow: "CAMPAIGN CENTER", title: "优惠活动", cards: [["秋季满减", "进行中", "订单满 €200 减 €20"], ["新客首单立减", "进行中", "首单立减 €10"], ["会员双倍积分", "未开始", "11-01 开始"]] }

  return (
    <div className={styles.pageStack}>
      <section className={styles.card}>
        <SectionHead eyebrow={content.eyebrow} title={content.title} action={<button className={styles.primaryButton} onClick={() => notify("新建营销活动（Demo）")}><Icon name="plus" size={15} />新建</button>} />
        <div className={styles.summaryStrip}>
          <div><span>待审核</span><strong>4</strong><small>即将生效 0</small></div>
          <div><span>生效中</span><strong>17</strong><small>线上 17 · 线下 0</small></div>
          <div><span>即将到期</span><strong>3</strong><small>未来 7 天</small></div>
          <div><span>已结束</span><strong>26</strong><small>近 90 天</small></div>
        </div>
        <div className={styles.filterPanel}>
          <div className={styles.filterGrid}>
            <label className={styles.filterField}><span>活动名称</span><input placeholder="请输入活动名称" /></label>
            <label className={styles.filterField}><span>活动类型</span><select defaultValue=""><option value="">全部类型</option><option>满减</option><option>折扣</option><option>优惠券</option></select></label>
            <label className={styles.filterField}><span>有效时间</span><input placeholder="起始时间 - 结束时间" /></label>
            <label className={styles.filterField}><span>审核状态</span><select defaultValue=""><option value="">全部</option><option>待审核</option><option>通过</option><option>不通过</option></select></label>
          </div>
          <div className={styles.filterActions}>
            <button className={styles.primaryButton} onClick={() => notify("已按当前条件查询营销活动（Demo）")}><Icon name="search" size={15} />查询</button>
            <button className={styles.ghostButton} onClick={() => notify("营销筛选条件已重置（Demo）")}>重置</button>
          </div>
        </div>
        <div className={styles.campaignGrid}>{content.cards.map(([title, value, note]) => <article className={styles.campaignCard} key={title}><div className={styles.campaignTop}><Badge tone={value === "进行中" || value === "已发布" ? "green" : "blue"}>{value}</Badge><button className={styles.iconButton}><Icon name="more" size={16} /></button></div><h3>{title}</h3><p>{note}</p><button className={styles.textButton}>查看详情 <Icon name="arrow" size={14} /></button></article>)}</div>
      </section>
      <section className={styles.tipCard}><span className={styles.tipIcon}><Icon name="marketing" size={16} /></span><div><strong>活动、内容和优惠券分开管理</strong><p>后续可以按活动类型、时间、适用商品和客户分群配置，不需要把营销动作塞进商品或订单模块。</p></div></section>
    </div>
  )
}

function ServicePage({
  role,
  submodule,
  notify,
}: {
  role: Role
  submodule: string
  notify: (message: string) => void
}) {
  const [conversations, setConversations] = useState(CONVERSATIONS)
  const [selectedId, setSelectedId] = useState(CONVERSATIONS[0].id)
  const [draft, setDraft] = useState("")
  const [queueFilter, setQueueFilter] = useState<"all" | "waiting" | "unread">("all")
  const scopedConversations = role === "platform"
    ? conversations
    : conversations.filter((conversation) => conversation.merchant === "North Studio")
  const visibleConversations = scopedConversations.filter((conversation) => {
    if (queueFilter === "waiting") return conversation.status === "待接入"
    if (queueFilter === "unread") return conversation.unread > 0
    return true
  })
  const activeConversation = visibleConversations.find((conversation) => conversation.id === selectedId)
    || scopedConversations.find((conversation) => conversation.id === selectedId)
    || scopedConversations[0]

  if (submodule === "tickets") {
    const tickets = role === "platform"
      ? SERVICE_TICKETS
      : SERVICE_TICKETS.filter((ticket) => ticket[2] === "Northline")
    return (
      <div className={styles.pageStack}>
        <section className={styles.card}>
          <SectionHead
            eyebrow="AFTER-SALES WORKFLOW"
            title="售后工单"
            action={<button className={styles.primaryButton} onClick={() => notify("新建售后工单（Demo）")}><Icon name="plus" size={15} />新建工单</button>}
          />
          <div className={styles.scopeBar}>
            <span className={styles.scopeIcon}><Icon name="service" size={17} /></span>
            <div><strong>{role === "platform" ? "全部商家售后工单" : "North Studio 售后工单"}</strong><small>{role === "platform" ? "平台客服可查看并介入所有商家的售后处理。" : "仅展示当前商家品牌下的售后工单。"}</small></div>
            <Badge tone={role === "platform" ? "blue" : "gray"}>{role === "platform" ? "平台数据范围" : "本店数据范围"}</Badge>
          </div>
          <div className={styles.filterBar}>
            <div className={styles.filterTabs}><button className={styles.filterActive}>全部工单</button><button>待处理</button><button>处理中</button><button>已解决</button></div>
            <button className={styles.ghostButton}><Icon name="filter" size={15} />筛选</button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>工单号</th><th>关联订单</th><th>商家 / 品牌</th><th>问题摘要</th><th>优先级</th><th>状态</th><th>更新时间</th><th /></tr></thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket[0]}>
                    <td><strong>{ticket[0]}</strong></td>
                    <td>{ticket[1]}</td>
                    <td>{ticket[2]}</td>
                    <td>{ticket[3]}</td>
                    <td><Badge tone={ticket[4] === "高" ? "red" : ticket[4] === "中" ? "amber" : "gray"}>{ticket[4]}</Badge></td>
                    <td><Badge tone={ticket[5] === "已解决" ? "green" : ticket[5] === "处理中" ? "blue" : "amber"}>{ticket[5]}</Badge></td>
                    <td>{ticket[6]}</td>
                    <td><button className={styles.textButton} onClick={() => notify(`打开工单 ${ticket[0]}（Demo）`)}>处理</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    )
  }

  if (submodule === "quick") {
    return (
      <div className={styles.pageStack}>
        <section className={styles.card}>
          <SectionHead
            eyebrow="SERVICE TOOLKIT"
            title="快捷回复"
            action={<button className={styles.primaryButton} onClick={() => notify("新建快捷回复（Demo）")}><Icon name="plus" size={15} />新建话术</button>}
          />
          <div className={styles.scopeBar}>
            <span className={styles.scopeIcon}><Icon name="service" size={17} /></span>
            <div><strong>{role === "platform" ? "平台公共话术库" : "本店客服话术"}</strong><small>平台维护通用模板，商家只能使用和修改自己的话术。</small></div>
            <Badge tone="blue">权限隔离</Badge>
          </div>
          <div className={styles.quickReplyGrid}>
            {QUICK_REPLIES.map(([title, content]) => (
              <article className={styles.quickReplyCard} key={title}>
                <div><span>{title.slice(0, 1)}</span><strong>{title}</strong></div>
                <p>{content}</p>
                <div className={styles.quickReplyActions}>
                  <button className={styles.textButton} onClick={() => notify(`已复制“${title}”话术（Demo）`)}>复制话术</button>
                  <button className={styles.textButton}>编辑</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    )
  }

  const waitingCount = scopedConversations.filter((conversation) => conversation.status === "待接入").length
  const unreadCount = scopedConversations.reduce((sum, conversation) => sum + conversation.unread, 0)

  const sendMessage = () => {
    const content = draft.trim()
    if (!content || !activeConversation) return
    setConversations((current) => current.map((conversation) => conversation.id === activeConversation.id
      ? {
          ...conversation,
          lastMessage: content,
          unread: 0,
          status: conversation.status === "待接入" ? "处理中" : conversation.status,
          messages: [...conversation.messages, { from: "agent", text: content, time: "刚刚" }],
        }
      : conversation))
    setDraft("")
    notify(`已回复 ${activeConversation.customer}（Demo）`)
  }

  return (
    <section className={styles.card}>
      <SectionHead
        eyebrow="CUSTOMER SERVICE DESK"
        title="在线会话"
        action={<div className={styles.serviceSummary}><span><i className={styles.liveDot} />在线</span><strong>{waitingCount}</strong><small>待接入</small><strong>{unreadCount}</strong><small>未读</small></div>}
      />
      <div className={styles.scopeBar}>
        <span className={styles.scopeIcon}><Icon name="service" size={17} /></span>
        <div><strong>{role === "platform" ? "全部商家会话" : "North Studio 本店会话"}</strong><small>{role === "platform" ? "平台客服可查看全部商家会话，也可按品牌筛选后介入。" : "仅显示当前商家租户下的顾客会话与订单信息。"}</small></div>
        <Badge tone={role === "platform" ? "blue" : "gray"}>{role === "platform" ? "平台数据范围" : "本店数据范围"}</Badge>
      </div>
      <div className={styles.filterBar}>
        <div className={styles.filterTabs}>
          <button className={queueFilter === "all" ? styles.filterActive : ""} onClick={() => setQueueFilter("all")}>全部会话 <span>{scopedConversations.length}</span></button>
          <button className={queueFilter === "waiting" ? styles.filterActive : ""} onClick={() => setQueueFilter("waiting")}>待接入 <span>{waitingCount}</span></button>
          <button className={queueFilter === "unread" ? styles.filterActive : ""} onClick={() => setQueueFilter("unread")}>未读 <span>{unreadCount}</span></button>
        </div>
        <button className={styles.ghostButton}><Icon name="filter" size={15} />全部品牌</button>
      </div>

      {activeConversation ? (
        <div className={styles.serviceWorkspace}>
          <aside className={styles.conversationPane}>
            <div className={styles.paneHead}><strong>会话队列</strong><span>按等待时间排序</span></div>
            <div className={styles.conversationList}>
              {visibleConversations.map((conversation) => (
                <button
                  className={`${styles.conversationItem} ${activeConversation.id === conversation.id ? styles.conversationActive : ""}`}
                  key={conversation.id}
                  onClick={() => setSelectedId(conversation.id)}
                >
                  <span className={styles.customerAvatar}>{conversation.customer.split(" ").map((part) => part[0]).join("")}</span>
                  <span className={styles.conversationCopy}>
                    <span><strong>{conversation.customer}</strong><small>{conversation.wait}</small></span>
                    <em>{conversation.merchant} · {conversation.brand}</em>
                    <small>{conversation.lastMessage}</small>
                  </span>
                  <span className={styles.conversationMeta}>
                    <Badge tone={conversation.status === "待接入" ? "amber" : conversation.status === "处理中" ? "blue" : "gray"}>{conversation.status}</Badge>
                    {conversation.unread ? <i>{conversation.unread}</i> : null}
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <section className={styles.chatPane}>
            <div className={styles.chatHead}>
              <div>
                <strong>{activeConversation.customer}</strong>
                <span>{activeConversation.merchant} · 关联订单 {activeConversation.order}</span>
              </div>
              <div className={styles.statusSwitch}>
                {(["待接入", "处理中", "已结束"] as ConversationStatus[]).map((status) => (
                  <button
                    key={status}
                    className={activeConversation.status === status ? styles.statusActive : ""}
                    onClick={() => {
                      setConversations((current) => current.map((conversation) => conversation.id === activeConversation.id ? { ...conversation, status } : conversation))
                      notify(`会话状态已更新为${status}（Demo）`)
                    }}
                  >{status}</button>
                ))}
              </div>
            </div>
            <div className={styles.messageList}>
              <div className={styles.messageDate}>今天</div>
              {activeConversation.messages.map((message, index) => (
                <div className={`${styles.messageRow} ${message.from === "agent" ? styles.messageAgent : message.from === "system" ? styles.messageSystem : ""}`} key={`${message.time}-${index}`}>
                  {message.from === "system" ? <span>{message.text}</span> : (
                    <>
                      <span className={styles.messageAvatar}>{message.from === "agent" ? "SW" : activeConversation.customer.slice(0, 1)}</span>
                      <div><p>{message.text}</p><small>{message.time}</small></div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); sendMessage() }}>
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="输入回复内容，支持粘贴订单号或内部备注…" aria-label="回复顾客" />
              <div>
                <span>Enter 发送 · Shift + Enter 换行</span>
                <button type="button" className={styles.ghostButton} onClick={() => setDraft(QUICK_REPLIES[0][1])}>快捷回复</button>
                <button type="submit" className={styles.primaryButton} disabled={!draft.trim()}>发送回复 <Icon name="arrow" size={14} /></button>
              </div>
            </form>
          </section>

          <aside className={styles.customerPane}>
            <div className={styles.paneHead}><strong>顾客信息</strong><button className={styles.iconButton}><Icon name="more" size={16} /></button></div>
            <div className={styles.customerProfile}>
              <span className={styles.customerAvatarLarge}>{activeConversation.customer.split(" ").map((part) => part[0]).join("")}</span>
              <strong>{activeConversation.customer}</strong>
              <small>首次购买 {activeConversation.customerSince}</small>
              <div>{activeConversation.tags.map((tag) => <Badge tone="blue" key={tag}>{tag}</Badge>)}</div>
            </div>
            <dl className={styles.customerFacts}>
              <div><dt>累计消费</dt><dd>{activeConversation.totalSpend}</dd></div>
              <div><dt>关联订单</dt><dd>{activeConversation.order}</dd></div>
              <div><dt>会话编号</dt><dd>{activeConversation.id}</dd></div>
              <div><dt>所属商家</dt><dd>{activeConversation.merchant}</dd></div>
            </dl>
            <div className={styles.customerOrder}>
              <span>当前订单</span>
              <strong>{activeConversation.order}</strong>
              <small>2 件商品 · €286.00</small>
              <button className={styles.secondaryButton} onClick={() => notify(`打开订单 ${activeConversation.order}（Demo）`)}>查看订单</button>
            </div>
          </aside>
        </div>
      ) : <div className={styles.emptyState}>当前筛选条件下没有会话。</div>}
    </section>
  )
}

function AnalyticsPage({ role, submodule }: { role: Role; submodule: string }) {
  const isPlatform = role === "platform"
  const labels = submodule === "inventory"
    ? ["低库存", "安全库存", "滞销", "缺货"]
    : submodule === "product"
      ? ["商品浏览", "加购", "下单", "退款"]
      : ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
  const values = submodule === "inventory"
    ? [34, 48, 21, 12]
    : submodule === "product"
      ? [78, 42, 28, 8]
      : isPlatform
        ? [42, 56, 48, 72, 64, 86, 78]
        : [28, 36, 32, 48, 44, 58, 52]
  const merchantProducts = PRODUCTS.filter((product) => product.merchant === "North Studio")
  const insightRows = isPlatform
    ? [
        ["Northline", "€28.4k", "+12.4%", "转化率最高"],
        ["Field Notes", "€12.8k", "+6.8%", "客单价上升"],
        ["Aster Goods", "€9.6k", "-2.1%", "待补资料影响上架"],
      ]
    : [
        ["Linen Overshirt / Sand", "€6.8k", "42 件", "低库存"],
        ["Field Jacket / Stone", "€5.2k", "21 件", "库存健康"],
        ["Trail Tote / Olive", "€3.9k", "17 件", "加购率上升"],
      ]

  return (
    <div className={styles.pageStack}>
      <div className={styles.scopeBar}>
        <span className={styles.scopeIcon}><Icon name="analytics" size={17} /></span>
        <div>
          <strong>{isPlatform ? "全平台经营分析" : "North Studio 本店经营分析"}</strong>
          <small>{isPlatform ? "聚合全部商家数据，用于平台经营监控、商家排名与风险识别。" : "仅聚合当前商家租户下的订单、商品和流量数据。"}</small>
        </div>
        <div className={styles.scopeActions}><Badge tone={isPlatform ? "blue" : "gray"}>{isPlatform ? "全平台数据" : "本店数据"}</Badge><button className={styles.secondaryButton}>近 30 天 <Icon name="chevron" size={14} /></button></div>
      </div>
      <div className={styles.statGrid}>
        <StatCard label={isPlatform ? "平台成交金额" : "本店成交金额"} value={isPlatform ? "€50.8k" : "€28.4k"} note="+12.4% vs 上月" icon="analytics" />
        <StatCard label="订单转化率" value={isPlatform ? "3.8%" : "4.2%"} note="+0.6% vs 上月" icon="orders" />
        <StatCard label={isPlatform ? "活跃商家" : "客单价"} value={isPlatform ? "3" : "€94.20"} note={isPlatform ? "1 家待补资料" : "+€4.10 vs 上月"} icon={isPlatform ? "store" : "customers"} />
        <StatCard label="退款率" value={isPlatform ? "1.1%" : "1.2%"} note="-0.3% vs 上月" icon="products" />
      </div>
      <div className={styles.analyticsLayout}>
        <section className={styles.card}>
          <SectionHead eyebrow="PERFORMANCE TREND" title={submodule === "inventory" ? "库存风险分布" : submodule === "product" ? "商品转化漏斗" : isPlatform ? "全平台销售趋势" : "本店销售趋势"} action={<span className={styles.mutedText}>单位：订单数 / 指数</span>} />
          <div className={styles.chart}>{values.map((value, index) => <div className={styles.chartColumn} key={labels[index]}><div className={styles.chartBar} style={{ height: `${value}%` }}><span>{value}</span></div><small>{labels[index]}</small></div>)}</div>
        </section>
        <aside className={styles.card}>
          <SectionHead eyebrow="BI INSIGHTS" title="经营洞察" action={<Badge tone="green">自动分析</Badge>} />
          <div className={styles.insightList}>
            {(isPlatform ? [
              ["商家集中度", "Northline 贡献平台 55.9% 成交额，需关注头部商家依赖。"],
              ["待补资料影响", "Aster Goods 商品上架率低于平台均值 18%。"],
              ["售后风险", "Field Notes 本周售后率上升 0.8 个百分点。"],
            ] : [
              ["增长机会", "轻户外系列本周转化率提升 0.9%，可增加首页曝光。"],
              ["库存预警", "NS-041 库存仅 4 件，低于安全库存 8 件。"],
              ["客服关联", "2 个会话来自高价值客户，建议优先接入。"],
            ]).map(([title, detail]) => <div className={styles.insightItem} key={title}><span><Icon name="analytics" size={15} /></span><div><strong>{title}</strong><p>{detail}</p></div></div>)}
          </div>
        </aside>
      </div>
      <section className={styles.card}>
        <SectionHead eyebrow={isPlatform ? "MERCHANT BENCHMARK" : "PRODUCT PERFORMANCE"} title={isPlatform ? "商家经营排名" : "本店商品表现"} action={<button className={styles.textButton}>导出分析 <Icon name="download" size={14} /></button>} />
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>{isPlatform ? "商家 / 品牌" : "商品"}</th><th>成交金额</th><th>指标</th><th>经营判断</th></tr></thead>
            <tbody>{insightRows.map((row) => <tr key={row[0]}><td><strong>{row[0]}</strong></td><td>{row[1]}</td><td>{row[2]}</td><td><Badge tone={row[3].includes("低库存") || row[3].includes("影响") ? "amber" : "green"}>{row[3]}</Badge></td></tr>)}</tbody>
          </table>
        </div>
        {!isPlatform ? <div className={styles.dataIsolationNote}><Icon name="platform" size={15} /><span>商家 BI 查询必须由后端强制追加 `merchant_id = currentMerchant`，前端隐藏不构成安全边界。</span></div> : null}
      </section>
    </div>
  )
}

function PermissionsPage({ notify }: { notify: (message: string) => void }) {
  const roleCards = [
    ["平台管理员", "全部模块", "全局数据范围", "可管理商家、域名、店铺、客户和平台配置"],
    ["平台运营", "运营模块", "全局只读 / 指定操作", "可查看全量数据，敏感配置需二次审批"],
    ["商家管理员", "商家模块", "本店数据范围", "不可访问店铺装修、域名、客户资产和平台管理"],
    ["商家运营", "商家模块", "本店数据范围", "按岗位进一步限制结算、营销和导出权限"],
  ]

  return (
    <div className={styles.pageStack}>
      <section className={styles.card}>
        <SectionHead
          eyebrow="RBAC + TENANT SCOPE"
          title="角色与权限"
          action={<button className={styles.primaryButton} onClick={() => notify("新建自定义角色（Demo）")}><Icon name="plus" size={15} />新建角色</button>}
        />
        <div className={styles.scopeBar}>
          <span className={styles.scopeIcon}><Icon name="platform" size={17} /></span>
          <div><strong>平台角色拥有全局范围，商家角色强制绑定 merchant_id</strong><small>前端导航隐藏只用于演示，正式系统必须在 API 层校验角色、租户和数据范围。</small></div>
          <Badge tone="blue">平台专属配置</Badge>
        </div>
        <div className={styles.roleGrid}>
          {roleCards.map(([name, modules, scope, note], index) => (
            <article className={styles.roleCard} key={name}>
              <div><span>{String(index + 1).padStart(2, "0")}</span><Badge tone={index < 2 ? "blue" : "gray"}>{index < 2 ? "平台" : "商家"}</Badge></div>
              <strong>{name}</strong>
              <dl><div><dt>模块范围</dt><dd>{modules}</dd></div><div><dt>数据范围</dt><dd>{scope}</dd></div></dl>
              <p>{note}</p>
              <button className={styles.textButton} onClick={() => notify(`编辑角色：${name}（Demo）`)}>配置权限 <Icon name="arrow" size={14} /></button>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <SectionHead eyebrow="MODULE PERMISSION MATRIX" title="模块权限矩阵" action={<span className={styles.mutedText}>按角色与数据范围授权</span>} />
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>业务模块</th><th>平台权限</th><th>商家权限</th><th>数据隔离方式</th></tr></thead>
            <tbody>
              {PERMISSION_MATRIX.map(([module, platform, merchant, scope]) => (
                <tr key={module}>
                  <td><strong>{module}</strong></td>
                  <td><Badge tone="blue">{platform}</Badge></td>
                  <td><Badge tone={merchant === "不可见" ? "gray" : "green"}>{merchant}</Badge></td>
                  <td>{scope}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.card}>
        <SectionHead eyebrow="AUTHORIZATION FLOW" title="正式系统鉴权链路" />
        <div className={styles.authFlow}>
          {[
            ["01", "身份认证", "校验登录态、MFA 和会话有效期"],
            ["02", "角色权限", "判断是否拥有模块与操作权限"],
            ["03", "租户范围", "平台使用全局 scope，商家强制追加 merchant_id"],
            ["04", "资源查询", "API 与 BI 查询统一注入数据范围条件"],
          ].map(([index, title, note]) => <div key={index}><span>{index}</span><strong>{title}</strong><small>{note}</small></div>)}
        </div>
      </section>
    </div>
  )
}

function PlatformPage({ submodule, notify }: { submodule: string; notify: (message: string) => void }) {
  if (submodule === "domains") {
    return <SimpleTablePage eyebrow="TENANT DOMAINS" title="租户与域名" columns={["品牌站", "域名", "主域名", "状态"]} rows={[["Northline", "north.outlet.local", "是", "已验证"], ["Aster Goods", "aster.outlet.local", "是", "待验证"], ["Field Notes", "field.outlet.local", "是", "已验证"]]} />
  }
  if (submodule === "members") {
    return <PermissionsPage notify={notify} />
  }
  if (submodule === "audit") {
    return <section className={styles.card}><SectionHead eyebrow="AUDIT LOG" title="审计日志" action={<button className={styles.secondaryButton}>导出日志 <Icon name="download" size={14} /></button>} /><div className={styles.timeline}>{ACTIVITY.map((item) => <div key={`${item.time}-${item.title}`}><span>{item.time}</span><i /><div><strong>{item.title}</strong><small>{item.detail}</small></div></div>)}</div></section>
  }
  if (submodule === "config") {
    return <section className={styles.card}><SectionHead eyebrow="SYSTEM CONFIG" title="系统配置" /><div className={styles.configGrid}>{[["默认市场", "Germany / EUR", "影响新商家的默认区域"], ["文件存储", "Local provider", "店铺素材与导入附件"], ["消息通知", "Email + Webhook", "平台事件通知渠道"], ["API 访问", "已启用", "服务端集成与自动化任务"]].map(([title, value, note]) => <div className={styles.configCard} key={title}><span>{title}</span><strong>{value}</strong><small>{note}</small><button className={styles.textButton}>编辑配置 <Icon name="arrow" size={14} /></button></div>)}</div></section>
  }
  return (
    <div className={styles.pageStack}>
      <section className={styles.card}>
        <SectionHead eyebrow="MERCHANT & BRAND" title="商家与品牌" action={<button className={styles.primaryButton}><Icon name="plus" size={15} />新增商家</button>} />
        <div className={styles.filterBar}><div className={styles.filterTabs}><button className={styles.filterActive}>全部商家</button><button>正常营业</button><button>待补资料</button><button>已停用</button></div><button className={styles.ghostButton}><Icon name="filter" size={15} />筛选</button></div>
        <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>品牌 / 商家</th><th>负责人</th><th>商品</th><th>订单</th><th>成交金额</th><th>状态</th><th /></tr></thead><tbody>{MERCHANTS.map((merchant) => <tr key={merchant.id}><td><span className={styles.tableIdentity}><strong>{merchant.brand}</strong><small>{merchant.merchant}</small></span></td><td>{merchant.owner}</td><td>{merchant.products}</td><td>{merchant.orders}</td><td>{merchant.gmv}</td><td><Badge tone={merchant.status === "正常营业" ? "green" : "amber"}>{merchant.status}</Badge></td><td><button className={styles.textButton}>管理</button></td></tr>)}</tbody></table></div>
      </section>
      <section className={styles.tipCard}><span className={styles.tipIcon}><Icon name="platform" size={16} /></span><div><strong>平台拥有全部商家能力</strong><p>平台侧保留商家、订单、商品、店铺、客户、营销和数据模块，并额外拥有商家治理、域名、成员、审计和系统配置。</p></div></section>
    </div>
  )
}

function PortalContent({
  role,
  module,
  submodule,
  setModule,
  notify,
}: {
  role: Role
  module: ModuleDefinition
  submodule: string
  setModule: (module: ModuleId, submodule?: string) => void
  notify: (message: string) => void
}) {
  switch (module.id) {
    case "overview":
      return <OverviewPage role={role} setModule={setModule} />
    case "orders":
      return <OrdersPage role={role} submodule={submodule} notify={notify} />
    case "products":
      return <ProductsPage role={role} submodule={submodule} notify={notify} />
    case "store":
      return <StorePage submodule={submodule} notify={notify} />
    case "customers":
      return <CustomersPage submodule={submodule} />
    case "marketing":
      return <MarketingPage submodule={submodule} notify={notify} />
    case "service":
      return <ServicePage role={role} submodule={submodule} notify={notify} />
    case "analytics":
      return <AnalyticsPage role={role} submodule={submodule} />
    case "platform":
      return <PlatformPage submodule={submodule} notify={notify} />
    default:
      return null
  }
}

export function PortalDemo() {
  const [role, setRole] = useState<Role>("platform")
  const [activeModuleId, setActiveModuleId] = useState<ModuleId>("overview")
  const [activeSubmodule, setActiveSubmodule] = useState("overview")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [notice, setNotice] = useState("")
  const modules = MODULES.filter((module) => module.allowedRoles.includes(role))
  const activeModule = modules.find((module) => module.id === activeModuleId) || modules[0]
  const currentSubmodule = activeModule.submodules.find((submodule) => submodule.id === activeSubmodule) || activeModule.submodules[0]
  const context = role === "platform" ? { name: "Outlet Platform", note: "平台管理员 · 全部商家" } : { name: "Northline / North Studio", note: "商家工作台 · 当前商家" }

  const selectRole = (nextRole: Role) => {
    setRole(nextRole)
    setActiveModuleId("overview")
    setActiveSubmodule("overview")
    setNotice("")
  }

  const selectModule = (moduleId: ModuleId, submodule?: string) => {
    const moduleDefinition = MODULES.find((item) => item.id === moduleId)
    if (!moduleDefinition || !moduleDefinition.allowedRoles.includes(role)) return
    setActiveModuleId(moduleId)
    setActiveSubmodule(submodule || moduleDefinition.submodules[0].id)
    setNotice("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const selectSubmodule = (submodule: string) => {
    setActiveSubmodule(submodule)
    setNotice("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <button className={styles.logo} onClick={() => selectModule("overview")} aria-label="返回工作台">
            <span className={styles.logoMark}>O</span>
            <span><strong>OUTLET</strong><small>COMMERCE OS</small></span>
          </button>
          <nav className={styles.primaryNav} aria-label="主模块">
            {modules.map((module) => (
              <div className={styles.navItem} key={module.id}>
                <button className={activeModuleId === module.id ? styles.primaryActive : ""} onClick={() => selectModule(module.id)} aria-haspopup="true">
                  <Icon name={module.icon} size={16} />
                  <span>{module.label}</span>
                  {isPlatformOnly(module) ? <i className={styles.platformTag}>平台</i> : null}
                  <Icon name="chevron" size={11} />
                </button>
                <div className={styles.navMenu}>
                  {module.submodules.map((submodule) => (
                    <button
                      key={submodule.id}
                      className={activeModuleId === module.id && currentSubmodule.id === submodule.id ? styles.navMenuActive : ""}
                      onClick={() => selectModule(module.id, submodule.id)}
                    >
                      <span>{submodule.label}</span>
                      <small>{submodule.description}</small>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className={styles.topbarRight}>
            <button className={styles.supportTrigger} onClick={() => selectModule("service", "inbox")} aria-label="打开客服工作台">
              <Icon name="service" size={17} />
              <span>客服工作台</span>
              <i>{role === "platform" ? 6 : 2}</i>
            </button>
            <button className={styles.searchTrigger} aria-label="搜索"><Icon name="search" size={18} /><span>搜索</span></button>
            <button className={styles.iconButton} aria-label="通知"><Icon name="bell" size={18} /><i className={styles.notificationDot} /></button>
            <div className={styles.account}>
              <button className={styles.accountButton} onClick={() => setSettingsOpen((open) => !open)} aria-expanded={settingsOpen}>
                <span className={styles.avatar}>SW</span>
                <span className={styles.accountName}><strong>Shane Wu</strong><small>{role === "platform" ? "平台管理员" : "商家管理员"}</small></span>
                <Icon name="chevron" size={15} />
              </button>
              {settingsOpen ? (
                <div className={styles.settingsMenu}>
                  <div className={styles.settingsHead}><strong>Shane Wu</strong><span>{role === "platform" ? "平台管理员" : "商家管理员"}</span></div>
                  <button><Icon name="settings" size={16} />账号设置</button>
                  <button><Icon name="bell" size={16} />通知设置</button>
                  {role === "platform" ? <button onClick={() => { selectModule("platform", "members"); setSettingsOpen(false) }}><Icon name="platform" size={16} />权限与成员</button> : null}
                  <button><Icon name="external" size={16} />切换工作区</button>
                  <div className={styles.settingsDivider} />
                  <button className={styles.logout}>退出登录</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className={styles.contextBar}>
        <div className={styles.contextInner}>
          <div className={styles.tabStrip}>
            <button className={styles.homeTab} onClick={() => selectModule("overview")}><Icon name="grid" size={14} />首页</button>
            <div className={styles.activeTab}>
              <span className={styles.activeTabDot} />
              <span>{activeModule.label} / {currentSubmodule.label}</span>
              <button aria-label="关闭当前页签" onClick={() => selectModule("overview")}><Icon name="close" size={12} /></button>
            </div>
          </div>
          <div className={styles.contextTools}>
            <div className={styles.contextIdentity}><span className={styles.contextDot} /><strong>{context.name}</strong><span>{context.note}</span></div>
            <div className={styles.roleSwitch} aria-label="切换工作区身份">
              <button className={role === "platform" ? styles.roleActive : ""} onClick={() => selectRole("platform")}>平台管理</button>
              <button className={role === "merchant" ? styles.roleActive : ""} onClick={() => selectRole("merchant")}>商家工作台</button>
            </div>
          </div>
        </div>
      </div>

      <main className={styles.workspace}>
        <section className={styles.contentHeader}>
          <div className={styles.pageHeader}>
            <div>
              <div className={styles.breadcrumb}><span>{activeModule.label}</span><i>/</i><strong>{currentSubmodule.label}</strong></div>
              <h1>{currentSubmodule.label}</h1>
              <p>{currentSubmodule.description}</p>
            </div>
            <div className={styles.pageActions}>
              {role === "platform" && activeModule.id !== "platform" ? <Badge tone="blue">平台视角 · 可管理全部商家</Badge> : null}
              {role === "merchant" ? <Badge tone="gray">商家视角 · 平台模块已隐藏</Badge> : null}
              <button className={styles.secondaryButton} onClick={() => setNotice("已刷新当前页面数据（Demo）")}>刷新数据</button>
            </div>
          </div>

          <nav className={styles.subnav} aria-label={`${activeModule.label}子模块`}>
            {activeModule.submodules.map((submodule) => (
              <button key={submodule.id} className={currentSubmodule.id === submodule.id ? styles.subnavActive : ""} onClick={() => selectSubmodule(submodule.id)}>{submodule.label}</button>
            ))}
          </nav>
        </section>

        {notice ? <div className={styles.notice}><Icon name="check" size={16} /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="关闭提示"><Icon name="close" size={15} /></button></div> : null}

        <PortalContent role={role} module={activeModule} submodule={currentSubmodule.id} setModule={selectModule} notify={setNotice} />
      </main>
    </div>
  )
}
