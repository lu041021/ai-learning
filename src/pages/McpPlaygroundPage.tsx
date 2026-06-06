import { useEffect, useRef, useState } from 'react'
import { useMountedRef } from '../hooks/useMountedRef'

interface McpTool {
  name: string
  description: string
  inputSchema: {
    type: string
    properties?: Record<string, { type: string; description?: string }>
    required?: string[]
  }
}

interface McpResult {
  tool: string
  content: string
  duration: number
  error?: boolean
}

const MCP_URL = 'http://127.0.0.1:9529/mcp'

async function callMcp(method: string, params?: Record<string, unknown>) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  })
  return res.json()
}

const prettyJSON = (s: string) => {
  try {
    return JSON.stringify(JSON.parse(s), null, 2)
  } catch {
    return s
  }
}

export function McpPlaygroundPage() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [tools, setTools] = useState<McpTool[]>([])
  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null)
  const [requestBody, setRequestBody] = useState('{}')
  const [results, setResults] = useState<McpResult[]>([])
  const [running, setRunning] = useState(false)
  const resultsEndRef = useRef<HTMLDivElement>(null)
  const mountedRef = useMountedRef()

  useEffect(() => {
    document.title = 'MCP Playground - AI 学堂'

    // Ping to check connection
    callMcp('ping')
      .then((r) => {
        if (mountedRef.current) {
          setConnected(r.result !== undefined || !r.error)
        }
      })
      .catch(() => {
        if (mountedRef.current) setConnected(false)
      })

    // Fetch tool list
    callMcp('tools/list')
      .then((r) => {
        if (mountedRef.current && r.result?.tools) {
          setTools(r.result.tools)
        }
      })
      .catch(() => {})
  }, [mountedRef])

  useEffect(() => {
    resultsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [results])

  const runTool = async (tool: McpTool, args: Record<string, unknown> = {}) => {
    const start = performance.now()
    try {
      const res = await callMcp('tools/call', {
        name: tool.name,
        arguments: args,
      })
      const duration = Math.round(performance.now() - start)
      const content = res.result?.content?.[0]?.text || JSON.stringify(res.result || res)
      setResults((prev) => [
        ...prev,
        {
          tool: tool.name,
          content,
          duration,
          error: res.result?.isError || false,
        },
      ])
    } catch (e) {
      setResults((prev) => [
        ...prev,
        {
          tool: tool.name,
          content: String(e),
          duration: 0,
          error: true,
        },
      ])
    }
  }

  const handleRun = () => {
    if (!selectedTool) return
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(requestBody)
    } catch {
      /* use empty args */
    }
    runTool(selectedTool, args)
  }

  const handleSelectTool = (tool: McpTool) => {
    setSelectedTool(tool)
    // Build a default request body
    const defaults: Record<string, unknown> = {}
    if (tool.inputSchema.properties) {
      for (const [key, schema] of Object.entries(tool.inputSchema.properties)) {
        if (schema.type === 'string') defaults[key] = ''
        else if (schema.type === 'integer') defaults[key] = 0
      }
    }
    setRequestBody(JSON.stringify(defaults, null, 2))
  }

  const handleQuickDemo = async () => {
    setRunning(true)
    setResults([])
    try {
      const steps = [
        { tool: { name: 'initialize', inputSchema: { type: 'object', properties: {} } }, args: {} },
        { tool: { name: 'tools/list', inputSchema: { type: 'object', properties: {} } }, args: {} },
        { tool: tools.find((t) => t.name === 'list_courses')!, args: {} },
        { tool: tools.find((t) => t.name === 'get_dashboard')!, args: { user_id: 1 } },
      ]

      // initialize
      const initRes = await callMcp('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'mcp-playground', version: '1.0.0' },
      })
      const initDuration = 5 // approximate
      setResults((prev) => [
        ...prev,
        {
          tool: 'initialize',
          content: JSON.stringify(initRes.result, null, 2),
          duration: initDuration,
        },
      ])
      await callMcp('notifications/initialized')

      for (const step of steps) {
        if (!step.tool) continue
        const start = performance.now()
        try {
          const res = await callMcp('tools/call', { name: step.tool.name, arguments: step.args })
          const duration = Math.round(performance.now() - start)
          const content = res.result?.content?.[0]?.text || JSON.stringify(res.result || res)
          setResults((prev) => [
            ...prev,
            {
              tool: step.tool.name,
              content,
              duration,
              error: res.result?.isError || false,
            },
          ])
        } catch (e) {
          setResults((prev) => [
            ...prev,
            { tool: step.tool.name, content: String(e), duration: 0, error: true },
          ])
        }
      }
    } catch (e) {
      setResults((prev) => [
        ...prev,
        { tool: 'quick-demo', content: String(e), duration: 0, error: true },
      ])
    }
    setRunning(false)
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>
            MCP Playground
            <span
              style={{
                marginLeft: '10px',
                fontSize: '12px',
                padding: '2px 8px',
                borderRadius: '10px',
                fontWeight: 500,
                background: connected
                  ? 'var(--success-light)'
                  : connected === false
                    ? 'var(--danger-light)'
                    : 'var(--bg-tertiary)',
                color: connected
                  ? 'var(--success)'
                  : connected === false
                    ? 'var(--danger)'
                    : 'var(--text-muted)',
              }}
            >
              {connected ? '已连接' : connected === false ? '连接失败' : '检测中...'}
            </span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            MCP 服务运行在 {MCP_URL} — 共有 {tools.length} 个工具可用
          </p>
        </div>
        <button
          onClick={handleQuickDemo}
          disabled={running || !connected}
          style={{
            padding: '8px 20px',
            background: running ? 'var(--bg-tertiary)' : 'var(--accent)',
            color: running ? 'var(--text-muted)' : '#fff',
            borderRadius: 'var(--radius)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {running ? '运行中...' : '快速演示'}
        </button>
      </div>

      <div
        style={{ display: 'flex', gap: '16px', height: 'calc(100vh - 200px)', minHeight: '500px' }}
      >
        {/* Tool Catalog (Left) */}
        <div
          style={{
            width: '260px',
            flexShrink: 0,
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            overflow: 'auto',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            工具目录
          </div>
          {tools.map((tool) => (
            <div
              key={tool.name}
              onClick={() => handleSelectTool(tool)}
              style={{
                padding: '10px 16px',
                cursor: 'pointer',
                background:
                  selectedTool?.name === tool.name ? 'var(--accent-light)' : 'transparent',
                borderLeft:
                  selectedTool?.name === tool.name
                    ? '3px solid var(--accent)'
                    : '3px solid transparent',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {tool.name}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  marginTop: '2px',
                  lineHeight: 1.4,
                }}
              >
                {tool.description.slice(0, 60)}
                {tool.description.length > 60 ? '...' : ''}
              </div>
            </div>
          ))}
        </div>

        {/* Request Builder (Center) */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>请求构建器</span>
            {selectedTool && (
              <span style={{ fontSize: '12px', color: 'var(--accent)', textTransform: 'none' }}>
                tools/call — {selectedTool.name}
              </span>
            )}
          </div>
          <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column' }}>
            {selectedTool ? (
              <>
                {Object.keys(selectedTool.inputSchema.properties || {}).length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        marginBottom: '8px',
                      }}
                    >
                      参数说明
                    </div>
                    {Object.entries(selectedTool.inputSchema.properties || {}).map(
                      ([key, schema]) => (
                        <div key={key} style={{ fontSize: '12px', marginBottom: '4px' }}>
                          <code style={{ color: 'var(--accent)' }}>{key}</code>
                          <span style={{ color: 'var(--text-muted)' }}> ({schema.type})</span>
                          {schema.description && (
                            <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>
                              {schema.description}
                            </span>
                          )}
                          {selectedTool.inputSchema.required?.includes(key) && (
                            <span style={{ color: 'var(--danger)', marginLeft: '4px' }}>*必填</span>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                )}
                <textarea
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  style={{
                    flex: 1,
                    width: '100%',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '12px',
                    fontFamily: '"Cascadia Code", "Fira Code", monospace',
                    fontSize: '13px',
                    resize: 'none',
                    outline: 'none',
                  }}
                  spellCheck={false}
                />
                <button
                  onClick={handleRun}
                  style={{
                    marginTop: '12px',
                    padding: '8px 20px',
                    background: 'var(--accent)',
                    color: '#fff',
                    borderRadius: 'var(--radius)',
                    fontSize: '13px',
                    fontWeight: 600,
                    alignSelf: 'flex-start',
                  }}
                >
                  执行
                </button>
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '14px',
                }}
              >
                从左侧选择一个工具
              </div>
            )}
          </div>
        </div>

        {/* Response Viewer (Right) */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>响应查看器</span>
            {results.length > 0 && (
              <button
                onClick={() =>
                  navigator.clipboard.writeText(
                    results
                      .map((r) => `=== ${r.tool} (${r.duration}ms) ===\n${prettyJSON(r.content)}\n`)
                      .join('\n'),
                  )
                }
                style={{
                  fontSize: '11px',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                复制全部
              </button>
            )}
          </div>
          <div style={{ flex: 1, padding: '12px', overflow: 'auto' }}>
            {results.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--text-muted)',
                  fontSize: '14px',
                }}
              >
                执行工具以查看结果
              </div>
            ) : (
              results.map((r, i) => (
                <div key={i} style={{ marginBottom: '12px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 10px',
                      background: r.error ? 'var(--danger-light)' : 'var(--bg-primary)',
                      borderRadius: 'var(--radius) var(--radius) 0 0',
                      border: '1px solid var(--border)',
                      borderBottom: 'none',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '6px',
                        background: r.error ? 'var(--danger)' : 'var(--success)',
                        color: '#fff',
                        fontWeight: 600,
                      }}
                    >
                      {r.error ? 'ERROR' : 'OK'}
                    </span>
                    <span
                      style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}
                    >
                      {r.tool}
                    </span>
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {r.duration}ms
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(prettyJSON(r.content))}
                      style={{
                        fontSize: '11px',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-secondary)',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      复制
                    </button>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: '10px 12px',
                      background: 'var(--bg-primary)',
                      borderRadius: '0 0 var(--radius) var(--radius)',
                      border: '1px solid var(--border)',
                      borderTop: 'none',
                      fontSize: '12px',
                      fontFamily: '"Cascadia Code", "Fira Code", monospace',
                      color: 'var(--text-primary)',
                      overflow: 'auto',
                      maxHeight: '200px',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {prettyJSON(r.content)}
                  </pre>
                </div>
              ))
            )}
            <div ref={resultsEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
