import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/tauri'
import { useUserStore, useProgressStore, useChatStore } from '../stores'
import { toast } from '../components/ui/Toast'

const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'deepseek', label: 'DeepSeek' },
]

const PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ],
  deepseek: [
    { value: 'deepseek-chat', label: 'DeepSeek Chat (V3)' },
    { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner (R1)' },
  ],
}

const PROVIDER_KEY_LABELS: Record<
  string,
  { label: string; placeholder: string; link: string; linkText: string }
> = {
  anthropic: {
    label: 'Anthropic API Key',
    placeholder: 'sk-ant-api03-...',
    link: 'https://console.anthropic.com/settings/keys',
    linkText: 'console.anthropic.com',
  },
  deepseek: {
    label: 'DeepSeek API Key',
    placeholder: 'sk-...',
    link: 'https://platform.deepseek.com/api_keys',
    linkText: 'platform.deepseek.com',
  },
}

export function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [theme, setTheme] = useState('dark')
  const [apiProvider, setApiProvider] = useState('anthropic')
  const [customModel, setCustomModel] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [clearing, setClearing] = useState(false)

  const userId = useUserStore((s) => s.userId)
  const fetchProgress = useProgressStore((s) => s.fetchProgress)
  const fetchConversations = useChatStore((s) => s.fetchConversations)

  const keyInfo = PROVIDER_KEY_LABELS[apiProvider] || PROVIDER_KEY_LABELS.anthropic
  const models = PROVIDER_MODELS[apiProvider] || PROVIDER_MODELS.anthropic

  useEffect(() => {
    document.title = '设置 - AI 学堂'
    api
      .getConfig()
      .then((c) => {
        const key = c.api_key || ''
        setApiKey(key)
        setModel(c.model || models[0]?.value || '')
        setTheme(c.theme || 'dark')
        setApiProvider(c.api_provider || 'anthropic')
        setLoaded(true)
      })
      .catch(() => {
        setLoaded(true)
        toast.error('加载配置失败')
      })
  }, [models])

  const handleSave = async () => {
    setSaving(true)
    try {
      const finalModel = customModel || model
      await api.setConfig(apiKey, finalModel, theme, apiProvider)
      document.documentElement.setAttribute('data-theme', theme)
      toast.success('配置已保存')
    } catch {
      toast.error('保存配置失败')
    }
    setSaving(false)
  }

  const handleThemeChange = (t: string) => {
    setTheme(t)
    document.documentElement.setAttribute('data-theme', t)
  }

  const handleClearData = async () => {
    if (!userId) return
    if (
      !window.confirm(
        '确定要清除所有学习数据吗？\n\n这将删除：\n- 学习进度\n- 测验记录\n- 对话历史\n\n此操作不可恢复！',
      )
    )
      return
    setClearing(true)
    try {
      await api.clearUserData(userId)
      fetchProgress(userId)
      fetchConversations(userId)
      toast.success('数据已清除')
    } catch {
      toast.error('清除数据失败')
    }
    setClearing(false)
  }

  if (!loaded) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ color: 'var(--text-muted)', padding: '40px', textAlign: 'center' }}>
          加载中...
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <Link
        to="/"
        style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          marginBottom: '20px',
          display: 'inline-block',
        }}
      >
        &larr; 返回首页
      </Link>

      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>设置</h1>

      <div style={{ display: 'grid', gap: '20px' }}>
        <div
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: '24px',
          }}
        >
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '8px',
              color: 'var(--text-primary)',
            }}
          >
            API 提供商
          </label>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            选择使用的 AI 服务提供商
          </p>
          <select
            value={apiProvider}
            onChange={(e) => {
              const newProvider = e.target.value
              setApiProvider(newProvider)
              setCustomModel('')
              const newModels = PROVIDER_MODELS[newProvider] || PROVIDER_MODELS.anthropic
              const isCurrentModelValid = newModels.some((m) => m.value === model)
              if (!isCurrentModelValid && customModel === '') {
                setModel(newModels[0]?.value || '')
              }
            }}
            style={{
              width: '100%',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-primary)',
              padding: '10px 14px',
              fontSize: '14px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: '24px',
          }}
        >
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '8px',
              color: 'var(--text-primary)',
            }}
          >
            {keyInfo.label}
          </label>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            用于 AI 导师和测验评分功能。可在{' '}
            <a href={keyInfo.link} target="_blank" rel="noopener noreferrer">
              {keyInfo.linkText}
            </a>{' '}
            获取。
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={keyInfo.placeholder}
              style={{
                flex: 1,
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text-primary)',
                padding: '10px 14px',
                fontSize: '14px',
                outline: 'none',
                fontFamily: 'monospace',
              }}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              style={{
                padding: '10px 14px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: '13px',
              }}
            >
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: '24px',
          }}
        >
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '8px',
              color: 'var(--text-primary)',
            }}
          >
            模型
          </label>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            选择 {PROVIDERS.find((p) => p.value === apiProvider)?.label}{' '}
            使用的模型。功能越强费用越高。
          </p>
          <select
            value={customModel ? '__custom__' : model}
            onChange={(e) => {
              if (e.target.value === '__custom__') {
                setCustomModel('')
              } else {
                setModel(e.target.value)
                setCustomModel('')
              }
            }}
            style={{
              width: '100%',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-primary)',
              padding: '10px 14px',
              fontSize: '14px',
              outline: 'none',
              cursor: 'pointer',
              marginBottom: '8px',
            }}
          >
            {models.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
            <option value="__custom__">自定义模型...</option>
          </select>
          {(!models.some((m) => m.value === model) || customModel !== '') && (
            <input
              type="text"
              value={customModel || model}
              onChange={(e) => {
                setCustomModel(e.target.value)
                setModel(e.target.value)
              }}
              placeholder="输入模型名称..."
              style={{
                width: '100%',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text-primary)',
                padding: '10px 14px',
                fontSize: '14px',
                outline: 'none',
                fontFamily: 'monospace',
                boxSizing: 'border-box',
              }}
            />
          )}
        </div>

        <div
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: '24px',
          }}
        >
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '8px',
              color: 'var(--text-primary)',
            }}
          >
            主题
          </label>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            选择浅色或深色主题
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => handleThemeChange('dark')}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 'var(--radius)',
                fontSize: '13px',
                fontWeight: 500,
                background: theme === 'dark' ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: theme === 'dark' ? '#fff' : 'var(--text-secondary)',
                border: theme === 'dark' ? '1px solid var(--accent)' : '1px solid var(--border)',
              }}
            >
              深色
            </button>
            <button
              onClick={() => handleThemeChange('light')}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 'var(--radius)',
                fontSize: '13px',
                fontWeight: 500,
                background: theme === 'light' ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: theme === 'light' ? '#fff' : 'var(--text-secondary)',
                border: theme === 'light' ? '1px solid var(--accent)' : '1px solid var(--border)',
              }}
            >
              浅色
            </button>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '12px 24px',
            background: saving ? 'var(--bg-tertiary)' : 'var(--accent)',
            color: saving ? 'var(--text-muted)' : '#fff',
            borderRadius: 'var(--radius)',
            fontSize: '15px',
            fontWeight: 600,
          }}
        >
          {saving ? '保存中...' : '保存配置'}
        </button>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 600,
              marginBottom: '12px',
              color: 'var(--danger)',
            }}
          >
            危险区域
          </h2>
          <button
            onClick={handleClearData}
            disabled={clearing}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              color: 'var(--danger)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius)',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            {clearing ? '清除中...' : '清除所有学习数据'}
          </button>
        </div>
      </div>
    </div>
  )
}
