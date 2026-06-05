import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { useChatStore, useUserStore, useUIStore } from '../../stores'
import { api } from '../../api/tauri'
import { toast } from '../ui/Toast'

export function AITutorPanel() {
  const { lessonId } = useParams()
  const messages = useChatStore((s) => s.messages)
  const streamingConvId = useChatStore((s) => s.streamingConvId)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const conversations = useChatStore((s) => s.conversations)
  const activeConversationId = useChatStore((s) => s.activeConversationId)
  const fetchConversations = useChatStore((s) => s.fetchConversations)
  const selectConversation = useChatStore((s) => s.selectConversation)
  const newChat = useChatStore((s) => s.newChat)
  const cancelStream = useChatStore((s) => s.cancelStream)
  const userId = useUserStore((s) => s.userId)
  const toggleAIPanel = useUIStore((s) => s.toggleAIPanel)

  const [input, setInput] = useState('')
  const [lessonTitle, setLessonTitle] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const messagesEnd = useRef<HTMLDivElement>(null)

  const isStreaming = streamingConvId !== null

  useEffect(() => {
    if (userId) fetchConversations(userId)
  }, [userId, fetchConversations])

  useEffect(() => {
    return () => {
      cancelStream()
    }
  }, [])

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Reset conversation when switching lessons
  useEffect(() => {
    newChat()
  }, [lessonId])

  useEffect(() => {
    if (lessonId) {
      api.getLesson(parseInt(lessonId)).then((l) => setLessonTitle(l.title)).catch(() => toast.error('加载课时信息失败'))
    } else {
      setLessonTitle('')
    }
  }, [lessonId])

  const handleSend = async () => {
    if (!input.trim() || !userId) return
    const text = input.trim()
    setInput('')
    await sendMessage(userId, text, lessonId ? parseInt(lessonId) : null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <aside style={{
      background: 'var(--bg-secondary)',
      borderLeft: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600, fontSize: '15px' }}>AI 导师</span>
          {lessonTitle && (
            <span style={{
              background: 'var(--accent-light)',
              color: 'var(--accent)',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '11px',
              maxWidth: '160px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {lessonTitle}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            aria-label={showHistory ? '隐藏对话历史' : '显示对话历史'}
            style={{
              background: 'transparent',
              color: 'var(--text-secondary)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '13px',
            }}
          >
            历史
          </button>
          <button
            onClick={newChat}
            aria-label="新建对话"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '13px',
            }}
          >
            + 新对话
          </button>
          <button
            onClick={toggleAIPanel}
            aria-label="关闭 AI 面板"
            style={{
              background: 'transparent',
              color: 'var(--text-secondary)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '16px',
            }}
          >
            x
          </button>
        </div>
      </div>

      {showHistory && (
        <div style={{
          maxHeight: '200px',
          overflow: 'auto',
          borderBottom: '1px solid var(--border)',
          padding: '8px',
        }}>
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                selectConversation(c.id)
                setShowHistory(false)
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                background: c.id === activeConversationId ? 'var(--accent-light)' : 'transparent',
                color: 'var(--text-primary)',
                borderRadius: '6px',
                fontSize: '13px',
                marginBottom: '2px',
                border: 'none',
              }}
            >
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.title}
              </div>
            </button>
          ))}
          {conversations.length === 0 && (
            <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
              暂无对话记录
            </div>
          )}
        </div>
      )}

      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 16px' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>{'{ }'}</div>
            <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>你的 AI 导师</div>
            <div style={{ fontSize: '12px' }}>
              关于当前课程有任何问题都可以问我！我可以解释概念、举例说明或出题测试。
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius)',
              background: m.role === 'user' ? 'var(--accent-light)' : 'var(--bg-tertiary)',
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '90%',
              fontSize: '13px',
              lineHeight: 1.55,
              color: 'var(--text-primary)',
            }}
          >
            <div style={{ fontSize: '13px' }}>
              {m.role === 'assistant' ? (
                <div className="markdown-body" style={{ fontSize: '13px', lineHeight: 1.55 }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                    {m.content || '_..._'}
                  </ReactMarkdown>
                </div>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEnd} />
      </div>

      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="提问课程内容..."
            disabled={isStreaming}
            rows={2}
            style={{
              flex: 1,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-primary)',
              padding: '8px 12px',
              fontSize: '13px',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            style={{
              background: isStreaming || !input.trim() ? 'var(--bg-tertiary)' : 'var(--accent)',
              color: isStreaming || !input.trim() ? 'var(--text-muted)' : '#fff',
              padding: '8px 14px',
              borderRadius: 'var(--radius)',
              fontWeight: 500,
              fontSize: '13px',
              alignSelf: 'flex-end',
            }}
          >
            {isStreaming ? '...' : '发送'}
          </button>
        </div>
      </div>
    </aside>
  )
}
