interface LoadingSpinnerProps {
  text?: string
}

export function LoadingSpinner({ text = '加载中...' }: LoadingSpinnerProps) {
  return (
    <div style={{ color: 'var(--text-muted)', padding: '40px', textAlign: 'center' }}>{text}</div>
  )
}
