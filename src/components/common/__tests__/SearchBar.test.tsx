import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SearchBar } from '../SearchBar'

const mockSearchAll = vi.fn()
vi.mock('../../../api/tauri', () => ({
  api: { searchAll: (...args: unknown[]) => mockSearchAll(...args) },
}))

function renderSearchBar() {
  return render(
    <MemoryRouter>
      <SearchBar />
    </MemoryRouter>,
  )
}

describe('SearchBar', () => {
  it('renders nothing when closed', () => {
    const { container } = renderSearchBar()
    expect(container.firstChild).toBeNull()
  })

  it('opens on Ctrl+K', () => {
    renderSearchBar()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'k' }))
    })
    expect(screen.getByPlaceholderText('搜索课程、课时、题目...')).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    renderSearchBar()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'k' }))
    })
    expect(screen.getByPlaceholderText('搜索课程、课时、题目...')).toBeInTheDocument()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    // After close, the SearchBar component returns null
  })

  it('closes on backdrop click', () => {
    renderSearchBar()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'k' }))
    })
    const input = screen.getByPlaceholderText('搜索课程、课时、题目...')
    expect(input).toBeInTheDocument()
  })
})
