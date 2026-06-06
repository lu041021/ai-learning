interface ErrorBlockProps {
  message: string
  onRetry?: () => void
}

export function ErrorBlock({ message, onRetry }: ErrorBlockProps) {
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <p style={{ color: 'var(--danger)', marginBottom: '16px' }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '8px 20px',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: 'var(--radius)',
            fontSize: '14px',
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          重试
        </button>
      )}
    </div>
  )
}
