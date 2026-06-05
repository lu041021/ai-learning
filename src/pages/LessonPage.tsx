import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { api } from '../api/tauri'
import { useProgressStore, useUserStore, useChatStore, useUIStore } from '../stores'
import { toast } from '../components/ui/Toast'
import type { LessonDetail, LessonSummary, CourseDetail } from '../types'

function NavLink({ to, label, dir }: { to: string; label: string; dir: 'prev' | 'next' }) {
  return (
    <Link
      to={to}
      style={{
        padding: '6px 14px',
        background: 'var(--bg-tertiary)',
        color: 'var(--text-primary)',
        borderRadius: 'var(--radius)',
        fontSize: '13px',
        fontWeight: 500,
        border: '1px solid var(--border)',
        maxWidth: '220px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}
    >
      {dir === 'prev' ? `← ${label}` : `${label} →`}
    </Link>
  )
}

export function LessonPage() {
  const { slug, lessonId } = useParams<{ slug: string; lessonId: string }>()
  const [lesson, setLesson] = useState<LessonDetail | null>(null)
  const [flatLessons, setFlatLessons] = useState<LessonSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const completedIds = useProgressStore((s) => s.completedIds)
  const markComplete = useProgressStore((s) => s.markComplete)
  const userId = useUserStore((s) => s.userId)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const aiPanelOpen = useUIStore((s) => s.aiPanelOpen)
  const toggleAIPanel = useUIStore((s) => s.toggleAIPanel)

  const [selectionText, setSelectionText] = useState('')
  const [selectionPos, setSelectionPos] = useState<{ x: number; y: number } | null>(null)
  const [askingAI, setAskingAI] = useState(false)
  const articleRef = useRef<HTMLElement>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchLesson = useCallback(() => {
    if (!lessonId || !slug) return
    setLoading(true)
    setError(null)
    const id = parseInt(lessonId)
    Promise.all([
      api.getLesson(id),
      api.getCourse(slug),
    ]).then(([l, course]) => {
      if (mountedRef.current) {
        setLesson(l)
        setFlatLessons(course.chapters.flatMap((ch) => ch.lessons))
        document.title = `${l.title} - AI 学堂`
        setLoading(false)
      }
    }).catch(() => {
      if (mountedRef.current) { setError('加载课时失败'); setLoading(false) }
    })
  }, [lessonId, slug])

  useEffect(() => {
    fetchLesson()
  }, [fetchLesson])

  useEffect(() => {
    const clear = () => { setSelectionText(''); setSelectionPos(null) }
    window.addEventListener('scroll', clear, true)
    return () => window.removeEventListener('scroll', clear, true)
  }, [])

  const currentIndex = flatLessons.findIndex((l) => l.id === (lesson?.id ?? -1))
  const prevLesson = currentIndex > 0 ? flatLessons[currentIndex - 1] : null
  const nextLesson = currentIndex < flatLessons.length - 1 ? flatLessons[currentIndex + 1] : null

  const isCompleted = lesson ? completedIds.has(lesson.id) : false

  const handleComplete = useCallback(() => {
    if (userId && lesson) markComplete(userId, lesson.id)
  }, [userId, lesson, markComplete])

  const handleMouseUp = () => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setSelectionText('')
      setSelectionPos(null)
      return
    }
    const anchorNode = sel.anchorNode
    if (!anchorNode || !articleRef.current?.contains(anchorNode)) return

    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    setSelectionText(sel.toString().trim())
    setSelectionPos({ x: rect.left + rect.width / 2, y: rect.top - 8 })
  }

  const handleAskAI = async () => {
    if (!userId || !selectionText || askingAI) return
    if (!aiPanelOpen) toggleAIPanel()
    const snippet = selectionText.slice(0, 500)
    setSelectionText('')
    setSelectionPos(null)
    window.getSelection()?.removeAllRanges()
    setAskingAI(true)
    await sendMessage(userId, `请解释以下内容：\n\n> ${snippet}`, lesson?.id ?? null, snippet)
    if (mountedRef.current) setAskingAI(false)
  }

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', padding: '40px', textAlign: 'center' }}>加载中...</div>
  }

  if (error) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px', textAlign: 'center' }}>
        <p style={{ color: 'var(--danger)', marginBottom: '16px' }}>{error}</p>
        <button onClick={fetchLesson} style={{ padding: '8px 20px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontSize: '14px', fontWeight: 500 }}>重试</button>
      </div>
    )
  }

  if (!lesson) {
    return <div style={{ color: 'var(--text-muted)', padding: '40px', textAlign: 'center' }}>课时不存在</div>
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Link to={`/courses/${slug}`} style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          &larr; 返回课程
        </Link>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {isCompleted && (
            <span style={{ color: 'var(--success)', fontSize: '13px', fontWeight: 500 }}>已完成</span>
          )}
          <Link
            to={`/courses/${slug}/lessons/${lesson.id}/quiz`}
            style={{
              padding: '8px 16px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius)',
              fontSize: '13px',
              fontWeight: 500,
              border: '1px solid var(--border)',
            }}
          >
            Take Quiz
          </Link>
          {!isCompleted && (
            <button
              onClick={handleComplete}
              aria-label="标记当前课时为已完成"
              style={{
                padding: '8px 16px',
                background: 'var(--success)',
                color: '#fff',
                borderRadius: 'var(--radius)',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              标记完成
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>{prevLesson ? <NavLink to={`/courses/${slug}/lessons/${prevLesson.id}`} label={prevLesson.title} dir="prev" /> : <div />}</div>
        <div>{nextLesson ? <NavLink to={`/courses/${slug}/lessons/${nextLesson.id}`} label={nextLesson.title} dir="next" /> : <div />}</div>
      </div>

      <article
        ref={articleRef}
        onMouseUp={handleMouseUp}
        aria-label="课程内容"
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: '32px 36px',
        }}
      >
        <div className="markdown-body" style={{ color: 'var(--text-primary)' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {lesson.content_md}
          </ReactMarkdown>
        </div>
      </article>

      {selectionText && selectionPos && (
        <div style={{
          position: 'fixed',
          left: selectionPos.x,
          top: selectionPos.y,
          transform: 'translate(-50%, -100%)',
          zIndex: 1000,
        }}>
          <button
            onClick={handleAskAI}
            aria-label="向 AI 提问选中内容"
            style={{
              padding: '6px 14px',
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: '18px',
              fontSize: '12px',
              fontWeight: 600,
              boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            Ask AI
          </button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', alignItems: 'center' }}>
        <div style={{ maxWidth: '240px' }}>
          {prevLesson && <NavLink to={`/courses/${slug}/lessons/${prevLesson.id}`} label={prevLesson.title} dir="prev" />}
        </div>
        <Link
          to={`/courses/${slug}/lessons/${lesson.id}/quiz`}
          style={{
            padding: '10px 24px',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: 'var(--radius)',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          Take Quiz &rarr;
        </Link>
        <div style={{ maxWidth: '240px' }}>
          {nextLesson && <NavLink to={`/courses/${slug}/lessons/${nextLesson.id}`} label={nextLesson.title} dir="next" />}
        </div>
      </div>
    </div>
  )
}
