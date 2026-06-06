import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { api } from '../api/tauri'
import { useUserStore, useProgressStore } from '../stores'
import { toast } from '../components/ui/Toast'
import { useMountedRef } from '../hooks/useMountedRef'
import type { Quiz, QuizResult } from '../types'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { ErrorBlock } from '../components/common/ErrorBlock'

function safeParseOptions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((o) => typeof o === 'string')) {
      return parsed
    }
    return ['[选项加载异常]']
  } catch {
    return ['[选项加载异常]']
  }
}

export function QuizPage() {
  const { slug, lessonId } = useParams<{ slug: string; lessonId: string }>()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [answers, setAnswers] = useState<number[]>([])
  const [result, setResult] = useState<QuizResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const userId = useUserStore((s) => s.userId)
  const mountedRef = useMountedRef()

  const fetchQuiz = useCallback(() => {
    if (!lessonId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    api
      .getQuiz(parseInt(lessonId))
      .then((q) => {
        if (mountedRef.current) {
          setQuiz(q)
          if (q) setAnswers(new Array(q.questions.length).fill(-1))
          setLoading(false)
        }
      })
      .catch(() => {
        if (mountedRef.current) {
          setError('加载测验失败')
          setLoading(false)
        }
      })
  }, [lessonId, mountedRef])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    fetchQuiz()
  }, [fetchQuiz])

  useEffect(() => {
    if (quiz) document.title = `${quiz.title} - AI 学堂`
  }, [quiz])

  const handleSelect = (qIndex: number, optIndex: number) => {
    setAnswers((prev) => {
      const next = [...prev]
      next[qIndex] = optIndex
      return next
    })
  }

  const handleSubmit = async () => {
    if (!userId || !quiz || answers.includes(-1)) return
    setSubmitting(true)
    try {
      const res = await api.submitQuiz(userId, quiz.id, answers)
      if (mountedRef.current) {
        setResult(res)
        useProgressStore.getState().setQuizScore(quiz.id, res.score)
        if (res.score >= 0.7 && lessonId) {
          const lid = parseInt(lessonId)
          api
            .markComplete(userId, lid)
            .then(() => {
              useProgressStore.getState().markComplete(userId, lid)
            })
            .catch(() => {})
        }
      }
    } catch {
      toast.error('提交测验失败')
    }
    if (mountedRef.current) setSubmitting(false)
  }

  if (loading) {
    return <LoadingSpinner text="加载测验中..." />
  }

  if (error) {
    return <ErrorBlock message={error} onRetry={fetchQuiz} />
  }

  if (!quiz) {
    return (
      <div style={{ color: 'var(--text-muted)', padding: '40px', textAlign: 'center' }}>
        测验不存在
      </div>
    )
  }

  const allAnswered = !answers.includes(-1)

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <Link
        to={`/courses/${slug}/lessons/${lessonId}`}
        style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          marginBottom: '20px',
          display: 'inline-block',
        }}
      >
        &larr; 返回课时
      </Link>

      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>{quiz.title}</h1>

      {result ? (
        <div
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: '28px',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div
              style={{
                fontSize: '48px',
                fontWeight: 700,
                color:
                  result.score === 1
                    ? 'var(--success)'
                    : result.score >= 0.7
                      ? 'var(--warning)'
                      : 'var(--danger)',
              }}
            >
              {Math.round(result.score * 100)}%
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
              正确 {result.correct}/{result.total}
            </div>
          </div>
          <div
            className="markdown-body"
            style={{
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius)',
              padding: '20px',
              fontSize: '14px',
              lineHeight: 1.6,
              color: 'var(--text-primary)',
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {result.feedback}
            </ReactMarkdown>
          </div>
          {result.next_step_recommendation && (
            <div
              style={{
                marginTop: '16px',
                background:
                  'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(59, 130, 246, 0.08))',
                borderRadius: 'var(--radius)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                padding: '16px 20px',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#a78bfa',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px',
                }}
              >
                AI 学习建议
              </div>
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {result.next_step_recommendation}
              </p>
              <button
                onClick={() => {
                  toast.info('练习题生成功能将在后续版本中上线')
                }}
                style={{
                  marginTop: '12px',
                  padding: '8px 16px',
                  background: 'rgba(139, 92, 246, 0.15)',
                  color: '#c4b5fd',
                  borderRadius: 'var(--radius)',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                }}
              >
                生成练习题
              </button>
            </div>
          )}
          <div
            style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'center' }}
          >
            <button
              onClick={() => {
                setResult(null)
                setAnswers(new Array(quiz.questions.length).fill(-1))
              }}
              style={{
                padding: '10px 20px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius)',
                fontSize: '14px',
                fontWeight: 500,
                border: '1px solid var(--border)',
              }}
            >
              重试
            </button>
            <Link
              to={`/courses/${slug}/lessons/${lessonId}`}
              style={{
                padding: '10px 20px',
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 'var(--radius)',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              返回课时
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {quiz.questions.map((q, qi) => {
            const options = safeParseOptions(q.options)
            return (
              <div
                key={q.id}
                style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  padding: '20px',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '14px' }}>
                  {qi + 1}. {q.question_text}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {options.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() => handleSelect(qi, oi)}
                      style={{
                        textAlign: 'left',
                        padding: '10px 14px',
                        background:
                          answers[qi] === oi ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                        border:
                          answers[qi] === oi
                            ? '1px solid var(--accent)'
                            : '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        transition: 'all 0.15s',
                      }}
                    >
                      {String.fromCharCode(65 + oi)}. {opt}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
            style={{
              padding: '14px 28px',
              background: allAnswered ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: allAnswered ? '#fff' : 'var(--text-muted)',
              borderRadius: 'var(--radius)',
              fontSize: '15px',
              fontWeight: 600,
              marginTop: '8px',
            }}
          >
            {submitting ? '提交中...' : '提交答案'}
          </button>
        </div>
      )}
    </div>
  )
}
