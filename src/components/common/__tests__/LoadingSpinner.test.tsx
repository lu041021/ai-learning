import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingSpinner } from '../LoadingSpinner'

describe('LoadingSpinner', () => {
  it('renders default text', () => {
    render(<LoadingSpinner />)
    expect(screen.getByText('加载中...')).toBeInTheDocument()
  })

  it('renders custom text', () => {
    render(<LoadingSpinner text="请稍候..." />)
    expect(screen.getByText('请稍候...')).toBeInTheDocument()
  })
})
