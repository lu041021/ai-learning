import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { api } from '../api/tauri'
import { useUserStore, useUserProfileStore } from '../stores'
import { toast } from '../components/ui/Toast'
import type { AssessmentQuestion, AssessmentResponse, UserProfileFull } from '../types'

const QUESTIONS: AssessmentQuestion[] = [
  {
    question_text: '你了解编程吗？',
    options: [
      '完全不会，零基础',
      '了解一些基本概念（变量、循环等）',
      '有编程经验，写过完整项目',
      '我是专业开发者/工程师',
    ],
  },
  {
    question_text: '你对人工智能(AI)或机器学习(ML)有多少了解？',
    options: [
      '完全不了解，只知道这个词',
      '看过一些科普文章/视频',
      '自学过基础概念',
      '上过正式课程或有项目经验',
    ],
  },
  {
    question_text: '你想学到什么程度？',
    options: [
      '了解AI的基本概念，能看懂相关新闻',
      '掌握核心原理，能用AI工具解决问题',
      '能自己训练模型，做AI项目',
      '成为AI开发者/研究人员',
    ],
  },
  {
    question_text: '你对哪些AI话题最感兴趣？（可多选）',
    options: [
      '机器学习基础',
      '神经网络与深度学习',
      '自然语言处理(NLP)',
      '计算机视觉',
      'AI伦理与社会影响',
      '生成式AI（ChatGPT、图片生成等）',
    ],
    multi: true,
  },
  {
    question_text: '你的学习风格偏好是？',
    options: ['通过阅读和理论学习', '通过动手实践和项目', '通过看视频和听课', '通过讨论和交流'],
  },
]

export function OnboardingPage() {
  const [stage, setStage] = useState<'welcome' | 'questions' | 'goals' | 'assessing' | 'results'>(
    'welcome',
  )
  const [currentQ, setCurrentQ] = useState(0)
  const [responses, setResponses] = useState<AssessmentResponse[]>([])
  const [selectedMulti, setSelectedMulti] = useState<Set<number>>(new Set())
  const [profile, setProfile] = useState<UserProfileFull | null>(null)
  const [apiConfigured, setApiConfigured] = useState(false)
  const [, setErrorDetail] = useState('')
  const [goalText, setGoalText] = useState('')

  const userId = useUserStore((s) => s.userId)
  const setProfileStore = useUserProfileStore((s) => s.setProfile)
  const navigate = useNavigate()

  useEffect(() => {
    api
      .getConfig()
      .then((c) => {
        setApiConfigured(!!c.api_key)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const titles: Record<string, string> = {
      welcome: '欢迎 - AI 学堂',
      questions: '能力评估 - AI 学堂',
      goals: '学习目标 - AI 学堂',
      assessing: '分析中 - AI 学堂',
      results: '评估结果 - AI 学堂',
    }
    if (titles[stage]) document.title = titles[stage]
  }, [stage])

  const handleSelect = (optIndex: number) => {
    const q = QUESTIONS[currentQ]
    if (q.multi) {
      setSelectedMulti((prev) => {
        const next = new Set(prev)
        if (next.has(optIndex)) {
          next.delete(optIndex)
        } else {
          next.add(optIndex)
        }
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
      setStage('goals')
    }
  }

  const handleNext = () => {
    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ(currentQ + 1)
    } else {
      setStage('goals')
    }
  }

  const handleSubmit = async (finalResponses: AssessmentResponse[]) => {
    if (!userId) {
      toast.error('用户初始化中，请稍候再试')
      return
    }
    setStage('assessing')
    setErrorDetail('')
    const allResponses = goalText.trim()
      ? [
          ...finalResponses,
          {
            question_index: finalResponses.length,
            question_text: '你的具体学习目标',
            answer_index: -1,
            answer_text: goalText.trim(),
          },
        ]
      : finalResponses
    try {
      const profile = await api.assessUserSkillDeep(userId, allResponses)
      setProfile(profile)
      setProfileStore({
        id: 0,
        user_id: userId,
        experience_level: profile.experience_level,
        interests: profile.interests,
        learning_goals: profile.learning_goals,
        assessment_completed: true,
        summary: profile.summary,
      })
      setStage('results')
    } catch (e) {
      const msg = typeof e === 'string' ? e : '评估失败，请检查 API Key 配置'
      setErrorDetail(msg)
      toast.error(msg)
      setStage('questions')
    }
  }

  const handleCancelAssess = () => {
    setStage('questions')
    toast.info('已取消评估')
  }

  const currentQuestion = QUESTIONS[currentQ]
  const isMulti = currentQuestion.multi
  const hasCurrentAnswer = isMulti
    ? selectedMulti.size > 0
    : responses.some((r) => r.question_index === currentQ)
  const isLast = currentQ === QUESTIONS.length - 1

  const handleGeneratePath = () => {
    navigate('/learning-path?autoGenerate=1')
  }

  const handleSkip = () => {
    navigate('/settings')
  }

  if (stage === 'welcome') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          padding: '40px 20px',
        }}
      >
        <div style={{ maxWidth: '520px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '24px' }}>{'{}'}</div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '12px' }}>
            欢迎来到 AI 学堂
          </h1>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '15px',
              lineHeight: 1.7,
              marginBottom: '8px',
            }}
          >
            在开始学习之前，让我们先了解你的当前水平和学习目标。
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '32px' }}>
            AI 将根据你的回答，为你量身定制学习路线。
          </p>

          {!apiConfigured && (
            <div
              style={{
                background: 'var(--warning-light)',
                border: '1px solid var(--warning)',
                borderRadius: 'var(--radius)',
                padding: '16px',
                marginBottom: '20px',
                textAlign: 'left',
              }}
            >
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--warning)',
                  marginBottom: '6px',
                }}
              >
                未配置 API Key
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                评估需要调用 AI 服务，请先配置 API Key 再开始。
              </p>
            </div>
          )}

          <button
            onClick={() => {
              if (!apiConfigured) {
                toast.error('请先配置 API Key 再开始评估')
                return
              }
              setStage('questions')
            }}
            style={{
              padding: '14px 40px',
              background: apiConfigured ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: apiConfigured ? '#fff' : 'var(--text-muted)',
              borderRadius: 'var(--radius)',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            开始评估
          </button>
          <div style={{ marginTop: '16px' }}>
            <button
              onClick={handleSkip}
              style={{
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: '14px',
                padding: '8px 16px',
              }}
            >
              {apiConfigured ? '跳过评估，直接开始学习' : '先去配置 API Key'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'questions') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          padding: '40px 20px',
        }}
      >
        <div style={{ maxWidth: '560px', width: '100%' }}>
          <div style={{ marginBottom: '20px' }}>
            <Link
              to="/settings"
              style={{
                fontSize: '13px',
                color: 'var(--text-muted)',
                padding: '6px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
              }}
            >
              &larr; 设置
            </Link>
          </div>

          <div
            style={{ marginBottom: '24px', display: 'flex', gap: '8px', justifyContent: 'center' }}
          >
            {QUESTIONS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: '32px',
                  height: '4px',
                  borderRadius: '2px',
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
                    textAlign: 'left',
                    padding: '14px 18px',
                    background: isSelected ? 'var(--accent-light)' : 'var(--bg-secondary)',
                    border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--text-primary)',
                    fontSize: '15px',
                    transition: 'all 0.15s',
                  }}
                >
                  {String.fromCharCode(65 + oi)}. {opt}
                </button>
              )
            })}
          </div>
          <div
            style={{ marginTop: '28px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}
          >
            {currentQ > 0 && (
              <button
                onClick={() => setCurrentQ(currentQ - 1)}
                style={{
                  padding: '10px 24px',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  borderRadius: 'var(--radius)',
                  fontSize: '14px',
                  fontWeight: 500,
                  border: '1px solid var(--border)',
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
                borderRadius: 'var(--radius)',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              {isLast ? '提交评估' : '下一题'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'goals') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          padding: '40px 20px',
        }}
      >
        <div style={{ maxWidth: '560px', width: '100%' }}>
          <div style={{ marginBottom: '16px' }}>
            <Link
              to="/settings"
              style={{
                fontSize: '13px',
                color: 'var(--text-muted)',
                padding: '6px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
              }}
            >
              &larr; 设置
            </Link>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '10px' }}>
            你的学习目标是什么？
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '14px',
              lineHeight: 1.6,
              marginBottom: '20px',
            }}
          >
            比如：能独立写 Tauri 插件、能读懂 Rust 源码、能用 AI 工具提升工作效率...
            <br />
            越具体，AI 为你生成的路线越精准。
          </p>
          <textarea
            value={goalText}
            onChange={(e) => setGoalText(e.target.value)}
            placeholder="请输入你的学习目标..."
            rows={5}
            autoFocus
            style={{
              width: '100%',
              padding: '14px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-primary)',
              fontSize: '15px',
              lineHeight: 1.6,
              resize: 'vertical',
              outline: 'none',
            }}
          />
          <div
            style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}
          >
            <button
              onClick={() => setStage('questions')}
              style={{
                padding: '10px 24px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius)',
                fontSize: '14px',
                fontWeight: 500,
                border: '1px solid var(--border)',
              }}
            >
              返回修改
            </button>
            <button
              onClick={() => handleSubmit(responses)}
              style={{
                padding: '10px 28px',
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 'var(--radius)',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              提交评估
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'assessing') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          padding: '40px 20px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px', animation: 'pulse 1.5s infinite' }}>
            ...
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
            AI 正在评估你的水平
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
            请稍候，这可能需要几秒钟...
          </p>
          <button
            onClick={handleCancelAssess}
            style={{
              padding: '8px 20px',
              background: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: '14px',
            }}
          >
            取消
          </button>
        </div>
      </div>
    )
  }

  if (stage === 'results' && profile) {
    const severityColor = (s: string) =>
      s === 'high' ? 'var(--danger)' : s === 'medium' ? 'var(--warning)' : 'var(--text-muted)'
    const severityBg = (s: string) =>
      s === 'high'
        ? 'var(--danger-light)'
        : s === 'medium'
          ? 'var(--warning-light)'
          : 'var(--bg-tertiary)'
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg-primary)',
          padding: '40px 20px',
        }}
      >
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h1
            style={{ fontSize: '26px', fontWeight: 700, marginBottom: '24px', textAlign: 'center' }}
          >
            你的学习画像
          </h1>

          {/* Basic info */}
          <div
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              padding: '24px',
              marginBottom: '16px',
              display: 'grid',
              gap: '14px',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                经验水平
              </div>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--accent)',
                  lineHeight: 1.5,
                }}
              >
                {profile.experience_level}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                兴趣领域
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {profile.interests.map((t, i) => (
                  <span
                    key={i}
                    style={{
                      background: 'var(--accent-light)',
                      color: 'var(--accent)',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                学习目标
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                {profile.learning_goals}
              </div>
            </div>
          </div>

          {/* Learning style */}
          <div
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              padding: '20px',
              marginBottom: '16px',
            }}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>学习风格</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                [
                  '节奏',
                  profile.learning_style.pace === 'fast'
                    ? '快速'
                    : profile.learning_style.pace === 'moderate'
                      ? '适中'
                      : '稳健',
                ],
                [
                  '持续性',
                  profile.learning_style.consistency === 'consistent'
                    ? '持续稳定'
                    : profile.learning_style.consistency === 'irregular'
                      ? '不规律'
                      : '突击型',
                ],
                [
                  '偏好格式',
                  profile.learning_style.preferred_format === 'practice'
                    ? '动手实践'
                    : profile.learning_style.preferred_format === 'reading'
                      ? '阅读学习'
                      : profile.learning_style.preferred_format === 'video'
                        ? '视频听课'
                        : '互动交流',
                ],
                [
                  '复习习惯',
                  profile.learning_style.review_tendency === 'frequent'
                    ? '经常复习'
                    : profile.learning_style.review_tendency === 'occasional'
                      ? '偶尔复习'
                      : '较少复习',
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}：</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Knowledge mastery */}
          {profile.concept_mastery.length > 0 && (
            <div
              style={{
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                padding: '20px',
                marginBottom: '16px',
              }}
            >
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>
                知识掌握度
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {profile.concept_mastery.slice(0, 10).map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{ fontSize: '13px', color: 'var(--text-primary)', minWidth: '120px' }}
                    >
                      {c.concept_name}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: '8px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${c.mastery_score * 100}%`,
                          background:
                            c.mastery_score >= 0.7
                              ? 'var(--success)'
                              : c.mastery_score >= 0.4
                                ? 'var(--warning)'
                                : 'var(--danger)',
                          borderRadius: '4px',
                          transition: 'width 0.5s',
                        }}
                      />
                    </div>
                    <span
                      style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '40px' }}
                    >
                      {Math.round(c.mastery_score * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weaknesses */}
          {profile.weakness_details.length > 0 && (
            <div
              style={{
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                padding: '20px',
                marginBottom: '16px',
              }}
            >
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>薄弱环节</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {profile.weakness_details.map((w, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius)',
                      background: severityBg(w.severity),
                      borderLeft: `3px solid ${severityColor(w.severity)}`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: severityColor(w.severity),
                          padding: '1px 8px',
                          borderRadius: '10px',
                          background:
                            w.severity === 'high' ? 'var(--danger-light)' : 'var(--bg-primary)',
                        }}
                      >
                        {w.severity === 'high' ? '严重' : w.severity === 'medium' ? '中等' : '轻微'}
                      </span>
                      <span
                        style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}
                      >
                        {w.domain}/{w.concept_name}
                      </span>
                      <span
                        style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}
                      >
                        {Math.round(w.current_score * 100)}%
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {w.suggested_focus}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Goal analysis */}
          {profile.goal_analysis && (
            <div
              style={{
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                padding: '20px',
                marginBottom: '16px',
              }}
            >
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>目标分析</h3>
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  lineHeight: 1.6,
                  marginBottom: '10px',
                }}
              >
                {profile.goal_analysis.gap_description}
              </p>
              {profile.goal_analysis.priority_domains.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>优先领域：</span>
                  {profile.goal_analysis.priority_domains.map((d, i) => (
                    <span
                      key={i}
                      style={{
                        display: 'inline-block',
                        margin: '2px 4px',
                        padding: '2px 10px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        background: 'var(--accent-light)',
                        color: 'var(--accent)',
                      }}
                    >
                      {d}
                    </span>
                  ))}
                </div>
              )}
              {profile.goal_analysis.suggested_milestones.length > 0 && (
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>建议里程碑：</span>
                  <ul
                    style={{
                      margin: '6px 0 0 16px',
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.8,
                    }}
                  >
                    {profile.goal_analysis.suggested_milestones.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          <div
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              padding: '20px',
              marginBottom: '24px',
            }}
          >
            <div
              className="markdown-body"
              style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text-primary)' }}
            >
              <ReactMarkdown>{profile.summary}</ReactMarkdown>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/')}
              style={{
                padding: '12px 28px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius)',
                fontSize: '15px',
                fontWeight: 500,
                border: '1px solid var(--border)',
              }}
            >
              直接开始学习
            </button>
            <button
              onClick={handleGeneratePath}
              style={{
                padding: '12px 28px',
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 'var(--radius)',
                fontSize: '15px',
                fontWeight: 600,
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
