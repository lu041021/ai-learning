import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ToastContainer, useToastStore, toast } from '../Toast'

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
})

describe('ToastContainer', () => {
  it('renders nothing when no toasts', () => {
    const { container } = render(<ToastContainer />)
    expect(container.firstChild).toBeNull()
  })

  it('renders toast messages', () => {
    act(() => {
      toast.error('test error')
    })
    render(<ToastContainer />)
    expect(screen.getByText('test error')).toBeInTheDocument()
  })

  it('renders success and info types', () => {
    act(() => {
      toast.success('done')
      toast.info('note')
    })
    render(<ToastContainer />)
    expect(screen.getByText('done')).toBeInTheDocument()
    expect(screen.getByText('note')).toBeInTheDocument()
  })

  it('removes toast on click', () => {
    act(() => {
      toast.error('click me')
    })
    render(<ToastContainer />)
    const toastEl = screen.getByText('click me')
    fireEvent.click(toastEl)
    const { container } = render(<ToastContainer />)
    expect(container.firstChild).toBeNull()
  })
})

describe('useToastStore', () => {
  it('addToast appends toasts with sequential ids', () => {
    act(() => {
      useToastStore.getState().addToast('error', 'first')
      useToastStore.getState().addToast('success', 'second')
    })
    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(2)
    expect(toasts[0].message).toBe('first')
    expect(toasts[1].message).toBe('second')
    expect(toasts[0].type).toBe('error')
    expect(toasts[1].type).toBe('success')
  })

  it('removeToast removes by id', () => {
    act(() => {
      toast.error('keep')
    })
    const id = useToastStore.getState().toasts[0].id
    act(() => {
      useToastStore.getState().removeToast(id)
    })
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})
