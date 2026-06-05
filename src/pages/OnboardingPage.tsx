import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { api } from '../api/tauri'
import { useUserStore, useUserProfileStore } from '../stores'
import { toast } from '../components/ui/Toast'
import type { AssessmentQuestion, AssessmentResponse, UserProfileOut } from '../types'

const QUESTIONS: AssessmentQuestion[] = [
  {
    question_text: '你了解编程吗？',
    options: ['完全不会，零基础', '了解一些基本概念（变量、循环等）', '有编程经验，写过完整项目', '我是专业开发者/工程师'],
  },
  {
    question_text: '你对人工智能(AI)或机器学习(ML)有多少了解？',
    options: ['完全不了解，只知道这个词', '看过一些科普文章/视频', '自学过基础概念', '上过正式课程或有项目经验'],
  },
  {
    question_text: '你想学到什么程度？',
    options: ['了解AI的基本概念，能看懂相关新闻', '掌握核心原理，能用AI工具解决问题', '能自己训练模型，做AI项目', '成为AI开发者/研究人员'],
  },
  {
    question_text: '你对哪些AI话题最感兴趣？（可多选）',
    options: ['机器学习基础', '神经网络与深度学习', '自然语言处理(NLP)', '计算机视觉', 'AI伦理与社会影响', '生成式AI（ChatGPT、图片生成等）'],
    multi: true,
  },
  {
    question_text: '你的学习风格偏好是？',
    options: ['通过阅读和理论学习', '通过动手实践和项目', '通过看视频和听课', '通过讨论和交流'],
  },
] as (AssessmentQuestion & { multi?: boolean })[]

export function OnboardingPage() {
  const [stage, setStage] = useState<'welcome' | 'questions' | 'assessing' | 'results'>('welcome')
  const [currentQ, setCurrentQ] = useState(0)
  const [responses, setResponses] = useState<AssessmentResponse[]>([])
  const [selectedMulti, setSelectedMulti] = useState<Set<number>>(new Set())
  const [profile, setProfile] = useState<UserProfileOut | null>(null)

  const userId = useUserStore((s) => s.userId)
  const setProfileStore = useUserProfileStore((s) => s.setProfile)
  const navigate = useNavigate()

  const handleSelect = (optIndex: number) => {
    const q = QUESTIONS[currentQ]
    if ((q as any).multi) {
      setSelectedMulti((prev) => {
        const next = new Set(prev)
        if (next.has(optIndex)) { next.delete(optIndex); } else { next.add(optIndex); }
        return next
      })
    } else {
      const resp: AssessmentResponse = {
        question_index: currentQ,
        question_text: q.question_text,
        answer_index: optIndex,
        answer_text: q.options[optIndex],
      }
      const next = [...responses.filter((r) => r.question_index !== currentQ), resp]
      setResponses(next)
    }
  }

  const handleMultiNext = () => {
    const q = QUESTIONS[currentQ]
    const answerText = [...selectedMulti].map((i) => q.options[i]).join('、')
    const resp: AssessmentResponse = {
      question_index: currentQ,
      question_text: q.question_text,
      answer_index: -1,
      answer_text: answerText || '未选择',
    }
    const next = [...responses.filter((r) => r.question_index !== currentQ), resp]
    setResponses(next)
    setSelectedMulti(new Set())
    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ(currentQ + 1)
    } else {
      handleSubmit(next)
    }
  }

  const handleNext = () => {
    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ(currentQ + 1)
    } else {
      handleSubmit(responses)
    }
  }

  const handleSubmit = async (finalResponses: AssessmentResponse[]) => {
    if (!userId) {
      toast.error('用户初始化中，请稍候再试')
      return
    }
    setStage('assessing')
    try {
      const profile = await api.assessUserSkill(userId, finalResponses)
      setProfile(profile)
      setProfileStore(profile)
      setStage('results')
    } catch (e) {
      toast.error(typeof e === 'string' ? e : '评估失败，请检查 API Key 配置')
      setStage('questions')
    }
  }

  const currentQuestion = QUESTIONS[currentQ]
  const isMulti = (currentQuestion as any).multi
  const hasCurrentAnswer = isMulti
    ? selectedMulti.size > 0
    : responses.some((r) => r.question_index === currentQ)
  const isLast = currentQ === QUESTIONS.length - 1

  const handleGeneratePath = () => {
    navigate('/learning-path')
  }

  const handleSkip = () => {
    navigate('/settings')
  }

  if (stage === 'welcome') {
    document.title = '欢迎 - AI 学堂'
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)', padding: '40px 20px',
      }}>
        <div style={{ maxWidth: '520px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '24px' }}>{'{}'}</div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '12px' }}>欢迎来到 AI 学堂</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.7, marginBottom: '8px' }}>
            在开始学习之前，让我们先了解你的当前水平和学习目标。
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '32px' }}>
            AI 将根据你的回答，为你量身定制学习路线。
          </p>
          <button
            onClick={() => setStage('questions')}
            style={{
              padding: '14px 40px', background: 'var(--accent)', color: '#fff',
              borderRadius: 'var(--radius)', fontSize: '16px', fontWeight: 600,
            }}
          >
            开始评估
          </button>
          <div style={{ marginTop: '16px' }}>
            <button
              onClick={handleSkip}
              style={{
                background: 'transparent', color: 'var(--text-muted)',
                fontSize: '14px', padding: '8px 16px',
              }}
            >
              跳过，先去配置 API Key
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'questions') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)', padding: '40px 20px',
      }}>
        <div style={{ maxWidth: '560px', width: '100%' }}>
          <div style={{ marginBottom: '24px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
            {QUESTIONS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: '32px', height: '4px', borderRadius: '2px',
                  background: i <= currentQ ? 'var(--accent)' : 'var(--bg-tertiary)',
                  transition: 'background 0.3s',
                }}
              />
            ))}
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px', lineHeight: 1.5 }}>
            {currentQuestion.question_text}
          </h2>
          {isMulti && (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>
              可选择多个答案
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {currentQuestion.options.map((opt, oi) => {
              const isSelected = isMulti
                ? selectedMulti.has(oi)
                : responses.some((r) => r.question_index === currentQ && r.answer_index === oi)
              return (
                <button
                  key={oi}
                  onClick={() => handleSelect(oi)}
                  style={{
                    textAlign: 'left', padding: '14px 18px',
                    background: isSelected ? 'var(--accent-light)' : 'var(--bg-secondary)',
                    border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius)', color: 'var(--text-primary)',
                    fontSize: '15px', transition: 'all 0.15s',
                  }}
                >
                  {String.fromCharCode(65 + oi)}. {opt}
                </button>
              )
            })}
          </div>
          <div style={{ marginTop: '28px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            {currentQ > 0 && (
              <button
                onClick={() => setCurrentQ(currentQ - 1)}
                style={{
                  padding: '10px 24px', background: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)', borderRadius: 'var(--radius)',
                  fontSize: '14px', fontWeight: 500, border: '1px solid var(--border)',
                }}
              >
                上一题
              </button>
            )}
            <button
              onClick={isMulti ? handleMultiNext : handleNext}
              disabled={!hasCurrentAnswer}
              style={{
                padding: '10px 28px',
                background: hasCurrentAnswer ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: hasCurrentAnswer ? '#fff' : 'var(--text-muted)',
                borderRadius: 'var(--radius)', fontSize: '14px', fontWeight: 600,
              }}
            >
              {isLast ? '提交评估' : '下一题'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'assessing') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)', padding: '40px 20px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px', animation: 'pulse 1.5s infinite' }}>...</div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>AI 正在评估你的水平</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            请稍候，这可能需要几秒钟...
          </p>
        </div>
      </div>
    )
  }

  if (stage === 'results' && profile) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)', padding: '40px 20px',
      }}>
        <div style={{ maxWidth: '560px', width: '100%' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '20px', textAlign: 'center' }}>
            你的学习画像
          </h1>

          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)', padding: '24px', marginBottom: '16px',
            display: 'grid', gap: '16px',
          }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>经验水平</div>
              <div style={{
                fontSize: '16px', fontWeight: 600, color: 'var(--accent)',
                textTransform: 'capitalize',
              }}>
                {profile.experience_level === 'beginner' ? '初学者' : profile.experience_level === 'intermediate' ? '有一定基础' : '进阶学习者'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>兴趣领域</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {profile.interests.map((t, i) => (
                  <span key={i} style={{
                    background: 'var(--accent-light)', color: 'var(--accent)',
                    padding: '4px 12px', borderRadius: '20px', fontSize: '13px',
                    fontWeight: 500,
                  }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>学习目标</div>
              <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                {profile.learning_goals}
              </div>
            </div>
          </div>

          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)', padding: '20px', marginBottom: '24px',
          }}>
            <div className="markdown-body" style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text-primary)' }}>
              <ReactMarkdown>{profile.summary}</ReactMarkdown>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/')}
              style={{
                padding: '12px 28px', background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)', borderRadius: 'var(--radius)',
                fontSize: '15px', fontWeight: 500, border: '1px solid var(--border)',
              }}
            >
              直接开始学习
            </button>
            <button
              onClick={handleGeneratePath}
              style={{
                padding: '12px 28px', background: 'var(--accent)', color: '#fff',
                borderRadius: 'var(--radius)', fontSize: '15px', fontWeight: 600,
              }}
            >
              生成我的学习路线
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
