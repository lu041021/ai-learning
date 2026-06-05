import { create } from 'zustand'
import { api } from '../api/tauri'
import { getLocalId, getSavedUserId, saveUserId } from '../utils/storage'
import type { ConversationSummary } from '../types'
import type { UserProfileOut, LearningPathOut } from '../types'
import type { ImportCourseResult, DuplicateCheckResult } from '../types'
import { listen } from '@tauri-apps/api/event'
import { toast } from '../components/ui/Toast'

interface MessageItem {
  role: 'user' | 'assistant'
  content: string
}

interface UserStore {
  userId: number | null
  username: string
  loading: boolean
  initUser: () => Promise<void>
}

export const useUserStore = create<UserStore>((set) => ({
  userId: getSavedUserId(),
  username: 'Learner',
  loading: false,
  initUser: async () => {
    const savedId = getSavedUserId()
    if (savedId) {
      try {
        const user = await api.getUserByLocal(getLocalId())
        set({ userId: user.id, username: user.username })
        return
      } catch {
        // user not found, create new one
      }
    }
    set({ loading: true })
    try {
      const localId = getLocalId()
      const user = await api.createUser(`Learner_${localId.slice(0, 6)}`, localId)
      saveUserId(user.id)
      set({ userId: user.id, username: user.username, loading: false })
    } catch {
      set({ loading: false })
      toast.error('创建用户失败')
    }
  },
}))

interface ProgressStore {
  completedIds: Set<number>
  quizScores: Record<number, number>
  loaded: boolean
  fetchProgress: (userId: number) => Promise<void>
  markComplete: (userId: number, lessonId: number) => Promise<void>
  setQuizScore: (quizId: number, score: number) => void
}

export const useProgressStore = create<ProgressStore>((set) => ({
  completedIds: new Set(),
  quizScores: {},
  loaded: false,
  fetchProgress: async (userId: number) => {
    try {
      const p = await api.getProgress(userId)
      set({ completedIds: new Set(p.completed_lesson_ids), quizScores: p.quiz_scores, loaded: true })
    } catch {
      set({ loaded: true })
      toast.error('加载进度失败')
    }
  },
  markComplete: async (userId: number, lessonId: number) => {
    try {
      await api.markComplete(userId, lessonId)
      set((s) => {
        const next = new Set(s.completedIds)
        next.add(lessonId)
        return { completedIds: next }
      })
    } catch {
      toast.error('标记完成失败')
    }
  },
  setQuizScore: (quizId: number, score: number) => {
    set((s) => ({ quizScores: { ...s.quizScores, [quizId]: score } }))
  },
}))

interface ChatStore {
  conversations: ConversationSummary[]
  messages: MessageItem[]
  activeConversationId: number | null
  streamingConvId: number | null
  _unlistenToken: (() => void) | null
  _unlistenDone: (() => void) | null
  _unlistenTitle: (() => void) | null
  fetchConversations: (userId: number) => Promise<void>
  fetchMessages: (convId: number) => Promise<void>
  sendMessage: (
    userId: number,
    message: string,
    lessonId?: number | null,
    selectedText?: string | null
  ) => Promise<number>
  cancelStream: () => void
  newChat: () => void
  selectConversation: (id: number) => void
}

function cleanupListeners(s: Partial<ChatStore>) {
  s._unlistenToken?.()
  s._unlistenDone?.()
  s._unlistenTitle?.()
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  messages: [],
  activeConversationId: null,
  streamingConvId: null,
  _unlistenToken: null,
  _unlistenDone: null,
  _unlistenTitle: null,
  fetchConversations: async (userId: number) => {
    try {
      const convs = await api.getConversations(userId)
      set({ conversations: convs })
    } catch {
      toast.error('加载对话列表失败')
    }
  },
  fetchMessages: async (convId: number) => {
    try {
      const msgs = await api.getMessages(convId)
      set({
        messages: msgs.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        activeConversationId: convId,
      })
    } catch {
      toast.error('加载消息失败')
    }
  },
  cancelStream: () => {
    const s = get()
    if (s.streamingConvId !== null) {
      api.cancelChat(s.streamingConvId).catch(() => {})
    }
    cleanupListeners(s)
    set({ streamingConvId: null, _unlistenToken: null, _unlistenDone: null, _unlistenTitle: null })
  },
  sendMessage: async (userId, message, lessonId = null, selectedText = null) => {
    const state = get()

    // Prevent concurrent streams
    if (state.streamingConvId !== null) {
      toast.error('正在等待上一条回复，请稍候')
      return 0
    }

    // Clean up any stale listeners from previous stream (defense in depth)
    cleanupListeners(state)

    const newMessages = [
      ...state.messages,
      { role: 'user' as const, content: message },
      { role: 'assistant' as const, content: '' },
    ]
    set({ messages: newMessages })

    const capturedConversationId = state.activeConversationId
    let convId: number

    // Register event listeners BEFORE triggering the backend stream
    const unlistenToken = await listen<{ token: string; conversation_id: number }>(
      'chat-token',
      (event) => {
        if (event.payload.conversation_id === convId) {
          set((s) => {
            const msgs = [...s.messages]
            const last = msgs[msgs.length - 1]
            if (last && last.role === 'assistant') {
              msgs[msgs.length - 1] = { ...last, content: last.content + event.payload.token }
            }
            return { messages: msgs }
          })
        }
      },
    )

    const unlistenDone = await listen<{ conversation_id: number }>(
      'chat-done',
      (event) => {
        if (event.payload.conversation_id === convId) {
          cleanupListeners(get())
          set({ streamingConvId: null, _unlistenToken: null, _unlistenDone: null, _unlistenTitle: null })
          get().fetchConversations(userId)
        }
      },
    )

    const unlistenTitle = await listen<{ conversation_id: number; title: string }>(
      'chat-title',
      (_event) => {
        get().fetchConversations(userId)
      },
    )

    // Now trigger the backend — listeners are ready to receive tokens
    try {
      convId = await api.sendChat(
        userId,
        message,
        lessonId,
        selectedText,
        capturedConversationId,
      )
    } catch {
      cleanupListeners({ _unlistenToken: unlistenToken, _unlistenDone: unlistenDone, _unlistenTitle: unlistenTitle })
      set({ streamingConvId: null, _unlistenToken: null, _unlistenDone: null, _unlistenTitle: null })
      // Revert the optimistic assistant bubble on error
      set((s) => {
        const msgs = [...s.messages]
        msgs.pop()
        return { messages: msgs }
      })
      toast.error('发送消息失败，请检查 API Key 是否配置正确')
      return 0
    }

    set({
      streamingConvId: convId,
      activeConversationId: capturedConversationId ?? convId,
      _unlistenToken: unlistenToken,
      _unlistenDone: unlistenDone,
      _unlistenTitle: unlistenTitle,
    })

    return convId
  },
  newChat: () => {
    get().cancelStream()
    set({ messages: [], activeConversationId: null })
  },
  selectConversation: (id: number) => {
    get().cancelStream()
    get().fetchMessages(id)
  },
}))

interface UIStore {
  sidebarOpen: boolean
  aiPanelOpen: boolean
  toggleSidebar: () => void
  toggleAIPanel: () => void
}

interface UserProfileStore {
  profile: UserProfileOut | null
  loading: boolean
  fetchProfile: (userId: number) => Promise<void>
  setProfile: (profile: UserProfileOut | null) => void
}

export const useUserProfileStore = create<UserProfileStore>((set) => ({
  profile: null,
  loading: false,
  fetchProfile: async (userId: number) => {
    set({ loading: true })
    try {
      const profile = await api.getUserProfile(userId)
      set({ profile, loading: false })
    } catch {
      set({ loading: false })
      toast.error('加载用户画像失败')
    }
  },
  setProfile: (profile) => set({ profile }),
}))

interface LearningPathStore {
  path: LearningPathOut | null
  loading: boolean
  generating: boolean
  fetchPath: (userId: number) => Promise<void>
  generatePath: (userId: number) => Promise<void>
}

export const useLearningPathStore = create<LearningPathStore>((set) => ({
  path: null,
  loading: false,
  generating: false,
  fetchPath: async (userId: number) => {
    set({ loading: true })
    try {
      const path = await api.getLearningPath(userId)
      set({ path, loading: false })
    } catch {
      set({ loading: false })
      toast.error('加载学习路线失败')
    }
  },
  generatePath: async (userId: number) => {
    set({ generating: true })
    try {
      const path = await api.generateLearningPath(userId)
      set({ path, generating: false })
      toast.success('学习路线已生成')
    } catch {
      set({ generating: false })
      toast.error('生成学习路线失败')
    }
  },
}))

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  aiPanelOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleAIPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
}))

interface ImportStore {
  phase: 'idle' | 'checking' | 'importing' | 'done' | 'error'
  statusText: string
  result: ImportCourseResult | null
  errorText: string
  duplicate: DuplicateCheckResult | null
  resetImport: () => void
  setPhase: (phase: ImportStore['phase']) => void
  setResult: (result: ImportCourseResult) => void
  setDuplicate: (dup: DuplicateCheckResult) => void
  setError: (msg: string) => void
}

export const useImportStore = create<ImportStore>((set) => ({
  phase: 'idle',
  statusText: '',
  result: null,
  errorText: '',
  duplicate: null,
  resetImport: () => set({ phase: 'idle', statusText: '', result: null, errorText: '', duplicate: null }),
  setPhase: (phase) => set({ phase }),
  setResult: (result) => set({ result, phase: 'done' }),
  setDuplicate: (duplicate) => set({ duplicate, phase: 'idle' }),
  setError: (errorText) => set({ errorText, phase: 'error' }),
}))
