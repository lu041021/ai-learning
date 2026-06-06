import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBlock } from '../ErrorBlock'

describe('ErrorBlock', () => {
  it('renders error message', () => {
    render(<ErrorBlock message="Something went wrong" />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('shows retry button when onRetry provided', () => {
    const onRetry = vi.fn()
    render(<ErrorBlock message="Error" onRetry={onRetry} />)
    const btn = screen.getByText('重试')
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('hides retry button when onRetry not provided', () => {
    render(<ErrorBlock message="Error" />)
    expect(screen.queryByText('重试')).not.toBeInTheDocument()
  })
})
