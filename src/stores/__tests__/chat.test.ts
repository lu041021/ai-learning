import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from '@testing-library/react'

type ListenCallback<T> = (event: { payload: T }) => void

const mockApi = vi.hoisted(() => ({
  getConversations: vi.fn(),
  getMessages: vi.fn(),
  sendChat: vi.fn(),
  cancelChat: vi.fn(),
}))

const mockListeners = vi.hoisted(() => new Map<string, ListenCallback<unknown>>())

vi.mock('../../api/tauri', () => ({ api: mockApi }))
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((event: string, cb: ListenCallback<unknown>) => {
    mockListeners.set(event, cb)
    return Promise.resolve(() => mockListeners.delete(event))
  }),
}))
vi.mock('../../utils/storage', () => ({
  getLocalId: () => 'test-local-id',
  getSavedUserId: () => null,
  saveUserId: vi.fn(),
}))

import { useChatStore } from '../../stores'

function resetStore() {
  useChatStore.setState({
    conversations: [],
    conversationsLoaded: false,
    messages: [],
    activeConversationId: null,
    streamingConvId: null,
  })
  mockListeners.clear()
}

beforeEach(() => {
  vi.clearAllMocks()
  resetStore()
})

describe('useChatStore', () => {
  describe('fetchConversations', () => {
    it('loads conversations', async () => {
      mockApi.getConversations.mockResolvedValueOnce([
        { id: 1, title: 'Conv 1', created_at: '2026-01-01' },
      ])
      await act(async () => {
        await useChatStore.getState().fetchConversations(1)
      })
      const s = useChatStore.getState()
      expect(s.conversations).toHaveLength(1)
      expect(s.conversations[0].title).toBe('Conv 1')
      expect(s.conversationsLoaded).toBe(true)
    })

    it('skips when already loaded', async () => {
      useChatStore.setState({ conversationsLoaded: true })
      await act(async () => {
        await useChatStore.getState().fetchConversations(1)
      })
      expect(mockApi.getConversations).not.toHaveBeenCalled()
    })
  })

  describe('newChat', () => {
    it('clears messages and activeConversationId', () => {
      useChatStore.setState({
        messages: [{ role: 'user', content: 'hi' }],
        activeConversationId: 5,
        conversationsLoaded: true,
      })
      useChatStore.getState().newChat()
      const s = useChatStore.getState()
      expect(s.messages).toHaveLength(0)
      expect(s.activeConversationId).toBeNull()
    })
  })

  describe('sendMessage', () => {
    it('appends user + empty assistant bubble immediately', async () => {
      mockApi.sendChat.mockResolvedValueOnce(10)
      mockApi.getConversations.mockResolvedValue([])
      let convId = 0
      await act(async () => {
        convId = await useChatStore.getState().sendMessage(1, 'hello')
      })
      expect(convId).toBe(10)
      const s = useChatStore.getState()
      expect(s.messages[0]).toEqual({ role: 'user', content: 'hello' })
      expect(s.messages[1]).toEqual({ role: 'assistant', content: '' })
      expect(s.streamingConvId).toBe(10)
    })

    it('accumulates tokens via chat-token event', async () => {
      mockApi.sendChat.mockResolvedValueOnce(10)
      mockApi.getConversations.mockResolvedValue([])
      await act(async () => {
        await useChatStore.getState().sendMessage(1, 'hello')
      })
      const tokenCb = mockListeners.get('chat-token') as ListenCallback<{
        token: string
        conversation_id: number
      }>
      act(() => {
        tokenCb({ payload: { token: 'Hi ', conversation_id: 10 } })
        tokenCb({ payload: { token: 'there!', conversation_id: 10 } })
      })
      const last = useChatStore.getState().messages.at(-1)
      expect(last?.content).toBe('Hi there!')
    })

    it('clears streamingConvId on chat-done', async () => {
      mockApi.sendChat.mockResolvedValueOnce(10)
      mockApi.getConversations.mockResolvedValue([])
      await act(async () => {
        await useChatStore.getState().sendMessage(1, 'hello')
      })
      const doneCb = mockListeners.get('chat-done') as ListenCallback<{ conversation_id: number }>
      await act(async () => {
        doneCb({ payload: { conversation_id: 10 } })
      })
      expect(useChatStore.getState().streamingConvId).toBeNull()
    })

    it('blocks second send while streaming', async () => {
      useChatStore.setState({ streamingConvId: 5 })
      const result = await act(async () => useChatStore.getState().sendMessage(1, 'ignored'))
      expect(result).toBe(0)
      expect(mockApi.sendChat).not.toHaveBeenCalled()
    })

    it('removes assistant bubble and resets on sendChat error', async () => {
      mockApi.sendChat.mockRejectedValueOnce(new Error('API error'))
      await act(async () => {
        await useChatStore.getState().sendMessage(1, 'hello')
      })
      const s = useChatStore.getState()
      expect(s.streamingConvId).toBeNull()
      expect(s.messages.every((m) => m.role !== 'assistant' || m.content !== '')).toBe(true)
      const lastMsg = s.messages.at(-1)
      expect(lastMsg?.role).toBe('user')
    })
  })

  describe('cancelStream', () => {
    it('calls cancelChat and resets streamingConvId', async () => {
      useChatStore.setState({ streamingConvId: 7 })
      mockApi.cancelChat.mockResolvedValueOnce(null)
      act(() => {
        useChatStore.getState().cancelStream()
      })
      expect(mockApi.cancelChat).toHaveBeenCalledWith(7)
      expect(useChatStore.getState().streamingConvId).toBeNull()
    })

    it('is a no-op when not streaming', () => {
      act(() => {
        useChatStore.getState().cancelStream()
      })
      expect(mockApi.cancelChat).not.toHaveBeenCalled()
    })
  })
})
