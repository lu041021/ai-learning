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
      set({
        completedIds: new Set(p.completed_lesson_ids),
        quizScores: p.quiz_scores,
        loaded: true,
      })
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
  conversationsLoaded: boolean
  messages: MessageItem[]
  activeConversationId: number | null
  streamingConvId: number | null
  fetchConversations: (userId: number) => Promise<void>
  fetchMessages: (convId: number) => Promise<void>
  sendMessage: (
    userId: number,
    message: string,
    lessonId?: number | null,
    selectedText?: string | null,
  ) => Promise<number>
  cancelStream: () => void
  newChat: () => void
  selectConversation: (id: number) => void
}

let _unlistenToken: (() => void) | null = null
let _unlistenDone: (() => void) | null = null
let _unlistenTitle: (() => void) | null = null
let _streamConvId: number | null = null

function cleanupListeners() {
  _unlistenToken?.()
  _unlistenDone?.()
  _unlistenTitle?.()
  _unlistenToken = null
  _unlistenDone = null
  _unlistenTitle = null
  _streamConvId = null
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  conversationsLoaded: false,
  messages: [],
  activeConversationId: null,
  streamingConvId: null,
  fetchConversations: async (userId: number) => {
    if (get().conversationsLoaded) return
    try {
      const convs = await api.getConversations(userId)
      set({ conversations: convs, conversationsLoaded: true })
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
    cleanupListeners()
    set({ streamingConvId: null })
  },
  sendMessage: async (userId, message, lessonId = null, selectedText = null) => {
    const state = get()

    if (state.streamingConvId !== null) {
      toast.error('正在等待上一条回复，请稍候')
      return 0
    }

    cleanupListeners()

    const newMessages = [
      ...state.messages,
      { role: 'user' as const, content: message },
      { role: 'assistant' as const, content: '' },
    ]
    set({ messages: newMessages })

    const capturedConversationId = state.activeConversationId

    const unlistenToken = await listen<{ token: string; conversation_id: number }>(
      'chat-token',
      (event) => {
        if (_streamConvId !== null && event.payload.conversation_id === _streamConvId) {
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

    const unlistenDone = await listen<{ conversation_id: number }>('chat-done', (event) => {
      if (_streamConvId !== null && event.payload.conversation_id === _streamConvId) {
        cleanupListeners()
        set({ streamingConvId: null, conversationsLoaded: false })
        get().fetchConversations(userId)
      }
    })

    const unlistenTitle = await listen<{ conversation_id: number; title: string }>(
      'chat-title',
      () => {
        set({ conversationsLoaded: false })
        get().fetchConversations(userId)
      },
    )

    _unlistenToken = unlistenToken
    _unlistenDone = unlistenDone
    _unlistenTitle = unlistenTitle

    try {
      const convId = await api.sendChat(
        userId,
        message,
        lessonId,
        selectedText,
        capturedConversationId,
      )
      _streamConvId = convId
      set({
        streamingConvId: convId,
        activeConversationId: capturedConversationId ?? convId,
      })
      return convId
    } catch {
      cleanupListeners()
      set({ streamingConvId: null })
      set((s) => {
        const msgs = [...s.messages]
        msgs.pop()
        return { messages: msgs }
      })
      toast.error('发送消息失败，请检查 API Key 是否配置正确')
      return 0
    }
  },
  newChat: () => {
    get().cancelStream()
    set({ messages: [], activeConversationId: null, conversationsLoaded: false })
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
  loaded: boolean
  fetchProfile: (userId: number) => Promise<void>
  setProfile: (profile: UserProfileOut | null) => void
}

export const useUserProfileStore = create<UserProfileStore>((set, get) => ({
  profile: null,
  loading: false,
  loaded: false,
  fetchProfile: async (userId: number) => {
    if (get().loaded || get().loading) return
    set({ loading: true })
    try {
      const profile = await api.getUserProfile(userId)
      set({ profile, loading: false, loaded: true })
    } catch {
      set({ loading: false })
      toast.error('加载用户画像失败')
    }
  },
  setProfile: (profile) => set({ profile, loaded: true }),
}))

interface LearningPathStore {
  path: LearningPathOut | null
  loading: boolean
  loaded: boolean
  generating: boolean
  fetchPath: (userId: number) => Promise<void>
  generatePath: (userId: number) => Promise<void>
}

export const useLearningPathStore = create<LearningPathStore>((set, get) => ({
  path: null,
  loading: false,
  loaded: false,
  generating: false,
  fetchPath: async (userId: number) => {
    if (get().loaded || get().loading) return
    set({ loading: true })
    try {
      const path = await api.getLearningPath(userId)
      set({ path, loading: false, loaded: true })
    } catch (e) {
      set({ loading: false })
      toast.error(typeof e === 'string' ? e : '加载学习路线失败')
    }
  },
  generatePath: async (userId: number) => {
    set({ generating: true })
    try {
      const path = await api.generateLearningPath(userId)
      set({ path, generating: false, loaded: true })
      toast.success('学习路线已生成')
    } catch (e) {
      set({ generating: false })
      const msg = (e as Error)?.message || String(e || '')
      console.error('[generatePath]', msg, e)
      toast.error(msg || '生成学习路线失败')
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
  setDuplicate: (dup: DuplicateCheckResult | null) => void
  setError: (msg: string) => void
}

export const useImportStore = create<ImportStore>((set) => ({
  phase: 'idle',
  statusText: '',
  result: null,
  errorText: '',
  duplicate: null,
  resetImport: () =>
    set({ phase: 'idle', statusText: '', result: null, errorText: '', duplicate: null }),
  setPhase: (phase) => set({ phase }),
  setResult: (result) => set({ result, phase: 'done' }),
  setDuplicate: (duplicate) => set({ duplicate, phase: 'idle' }),
  setError: (errorText) => set({ errorText, phase: 'error' }),
}))
