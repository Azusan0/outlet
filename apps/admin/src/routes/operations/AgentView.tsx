import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react"
import {
  getErrorMessage,
  streamAgent,
  type AgentToolTrace,
} from "../../lib/operations-api"
import {
  EmptyState,
  Glyph,
  SectionHeading,
  StatusNotice,
} from "./ui"
import { summarize } from "./utils"

type Message = {
  id: string
  role: "user" | "assistant"
  text: string
  pending?: boolean
}

const SUGGESTIONS = [
  "检查本周库存异常，并按处理优先级给出清单。",
  "根据知识库说明售后政策，并附上引用来源。",
  "找出价格异常的商品，先预览再等待我确认。",
]

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toolStatusLabel(status: AgentToolTrace["status"]): string {
  if (status === "completed") return "完成"
  if (status === "error") return "失败"
  return "执行中"
}

export function AgentView() {
  const [prompt, setPrompt] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [traces, setTraces] = useState<AgentToolTrace[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")
  const transcriptRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [messages, traces])

  useEffect(
    () => () => {
      abortRef.current?.abort()
    },
    []
  )

  const stop = () => {
    abortRef.current?.abort()
  }

  const send = async () => {
    const message = prompt.trim()
    if (!message || running) return

    const userMessage: Message = {
      id: makeId("user"),
      role: "user",
      text: message,
    }
    const assistantId = makeId("assistant")
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      text: "",
      pending: true,
    }

    setMessages((current) => [...current, userMessage, assistantMessage])
    setTraces([])
    setPrompt("")
    setError("")
    setRunning(true)

    let answer = ""
    let streamError = ""
    const controller = new AbortController()
    abortRef.current = controller

    try {
      await streamAgent(
        {
          message,
          history: messages.slice(-8).map((item) => ({
            role: item.role,
            content: item.text,
          })),
          context: {
            surface: "admin_operations",
            intent: "operations_assistant",
            require_tenant_scope: true,
          },
        },
        (event) => {
          if (event.type === "message") {
            answer += event.text
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantId
                  ? { ...item, text: answer, pending: true }
                  : item
              )
            )
          }
          if (event.type === "tool") {
            setTraces((current) => {
              const index = current.findIndex((trace) => trace.id === event.tool.id)
              if (index < 0) return [...current, event.tool]
              const next = [...current]
              const previous = current[index]
              next[index] = {
                ...previous,
                ...event.tool,
                input: event.tool.input ?? previous.input,
                output: event.tool.output ?? previous.output,
              }
              return next
            })
          }
          if (event.type === "error") {
            streamError = event.message
            setError(event.message)
          }
        },
        controller.signal
      )
    } catch (streamFailure) {
      if (streamFailure instanceof DOMException && streamFailure.name === "AbortError") {
        streamError = "已停止本次生成。"
      } else {
        streamError = getErrorMessage(streamFailure)
      }
      setError(streamError)
    } finally {
      setMessages((current) =>
        current.map((item) => {
          if (item.id !== assistantId) return item
          return {
            ...item,
            text:
              item.text ||
              (streamError
                ? "本次请求没有完成，请根据右侧错误信息检查后重试。"
                : "操作已完成，但没有返回可展示的文本。"),
            pending: false,
          }
        })
      )
      setRunning(false)
      abortRef.current = null
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void send()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault()
      void send()
    }
  }

  return (
    <div className="ops-agent">
      <SectionHeading
        index="03"
        title="AI 运营助手"
        description="通过流式响应执行受控运营任务。每次工具调用都会进入右侧轨迹，涉及写操作时先预览、再确认。"
        aside={
          <span className={`ops-live ${running ? "is-running" : ""}`}>
            <i />
            {running ? "STREAMING" : "READY"}
          </span>
        }
      />

      {error ? <StatusNotice tone="error">{error}</StatusNotice> : null}

      <div className="ops-agent-grid">
        <section className="ops-chat">
          <div className="ops-chat-head">
            <div>
              <span className="ops-label">运营会话</span>
              <strong>先查数据，再做动作</strong>
            </div>
            <span className="ops-mono">{messages.length} MESSAGES</span>
          </div>

          <div className="ops-transcript" ref={transcriptRef}>
            {messages.length === 0 ? (
              <div className="ops-agent-intro">
                <span>OUTLET AGENT / TOOL ENABLED</span>
                <h3>
                  不猜答案。
                  <br />
                  让助手查系统、给证据。
                </h3>
                <p>
                  可以查询库存、解释知识库、生成导入计划或触发 ERP 预览。所有结果都会标明工具来源。
                </p>
                <div className="ops-suggestions">
                  {SUGGESTIONS.map((suggestion, index) => (
                    <button
                      type="button"
                      key={suggestion}
                      onClick={() => setPrompt(suggestion)}
                    >
                      <span>0{index + 1}</span>
                      {suggestion}
                      <Glyph name="arrow" size={14} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <article
                  className={`ops-message ops-message--${message.role}`}
                  key={message.id}
                >
                  <div className="ops-message-meta">
                    <span>{message.role === "user" ? "你" : "运营助手"}</span>
                    <span>{message.role === "user" ? "OPERATOR" : "AGENT"}</span>
                  </div>
                  <div className="ops-message-body">
                    {message.text || (
                      <span className="ops-thinking">
                        正在读取上下文
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>

          <form className="ops-composer" onSubmit={handleSubmit}>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="描述你想检查或执行的运营任务…"
              rows={3}
              maxLength={2000}
              disabled={running}
            />
            <div className="ops-composer-footer">
              <span>Ctrl / ⌘ + Enter 发送 · 写操作必须预览确认</span>
              {running ? (
                <button
                  className="ops-btn ops-btn--danger"
                  type="button"
                  onClick={stop}
                >
                  <Glyph name="stop" size={15} />
                  停止
                </button>
              ) : (
                <button
                  className="ops-btn ops-btn--primary"
                  type="submit"
                  disabled={!prompt.trim()}
                >
                  <Glyph name="send" size={15} />
                  发送
                </button>
              )}
            </div>
          </form>
        </section>

        <aside className="ops-trace-panel">
          <div className="ops-trace-head">
            <div>
              <span className="ops-label">工具调用</span>
              <strong>可审计轨迹</strong>
            </div>
            <span className="ops-count">{traces.length}</span>
          </div>

          <div className="ops-trace-list">
            {traces.length === 0 ? (
              <EmptyState
                title="尚无工具调用"
                description="发送问题后，检索、查询、预览和写入动作会按时间显示在这里。"
              />
            ) : (
              traces.map((trace, index) => (
                <details
                  className={`ops-trace ops-trace--${trace.status}`}
                  key={trace.id}
                  open={trace.status === "running" || index === traces.length - 1}
                >
                  <summary>
                    <span className="ops-trace-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="ops-trace-name">{trace.name}</span>
                    <span className={`ops-badge ops-badge--${trace.status}`}>
                      {toolStatusLabel(trace.status)}
                    </span>
                    <Glyph name="chevron" size={15} />
                  </summary>
                  <div className="ops-trace-body">
                    {trace.input !== undefined ? (
                      <div>
                        <span>输入</span>
                        <pre>{summarize(trace.input)}</pre>
                      </div>
                    ) : null}
                    {trace.output !== undefined ? (
                      <div>
                        <span>输出</span>
                        <pre>{summarize(trace.output)}</pre>
                      </div>
                    ) : null}
                    {trace.error ? (
                      <div>
                        <span>错误</span>
                        <pre>{trace.error}</pre>
                      </div>
                    ) : null}
                  </div>
                </details>
              ))
            )}
          </div>

          <div className="ops-trace-foot">
            <Glyph name="shield" size={17} />
            <p>
              助手只使用当前登录用户可见的租户数据。工具返回的租户 ID 不会被当作授权依据。
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

