import { invoke } from '@tauri-apps/api/core'
import type {
  CourseSummary,
  CourseDetail,
  LessonDetail,
  Quiz,
  QuizResult,
  UserProgress,
  User,
  ConversationSummary,
  ChatMessage,
  UserProfileOut,
  AssessmentResponse,
  LearningPathOut,
  LearningPathVersionSummary,
  DashboardData,
  ImportCourseResult,
  DuplicateCheckResult,
  AwesomeRepo,
  AwesomeLink,
  LinkPreview,
  FeedSubscription,
  FeedArticle,
  WrongAnswerItem,
  SearchResultItem,
  KnowledgeGraphData,
  RecommendationItem,
  AnalyticsData,
} from '../types'

export interface AppConfig {
  api_key: string
  api_provider: string
  model: string
  theme: string
}

const getApiKey = (config: AppConfig) => config.api_key || ''

export const api = {
  getConfig: () => invoke<AppConfig>('get_config'),

  setApiKey: (apiKey: string) => invoke<void>('set_api_key', { apiKey }),

  setConfig: (apiKey: string, model: string, theme: string, apiProvider: string) =>
    invoke<void>('set_config', { apiKey, model, theme, apiProvider }),

  getCourses: () => invoke<CourseSummary[]>('list_courses'),

  getCourse: (slug: string) => invoke<CourseDetail>('get_course', { slug }),

  getLesson: (id: number) => invoke<LessonDetail>('get_lesson', { lessonId: id }),

  getQuiz: (lessonId: number) => invoke<Quiz>('get_quiz', { lessonId }),

  submitQuiz: async (userId: number, quizId: number, answers: number[]) => {
    const config = await invoke<AppConfig>('get_config')
    return invoke<QuizResult>('submit_quiz', {
      userId,
      quizId,
      answers,
      apiKey: getApiKey(config),
      model: config.model,
      apiProvider: config.api_provider || 'anthropic',
    })
  },

  getProgress: (userId: number) => invoke<UserProgress>('get_progress', { userId }),

  markComplete: (userId: number, lessonId: number) =>
    invoke<string>('mark_complete', { userId, lessonId }),

  createUser: (username: string, localId: string) =>
    invoke<User>('create_user', { username, localId }),

  getUserByLocal: (localId: string) =>
    invoke<User>('get_user_by_local', { localId }),

  getConversations: (userId: number) =>
    invoke<ConversationSummary[]>('list_conversations', { userId }),

  getMessages: (convId: number) =>
    invoke<ChatMessage[]>('get_messages', { convId }),

  sendChat: async (
    userId: number,
    message: string,
    lessonId: number | null,
    selectedText: string | null,
    conversationId: number | null,
  ) => {
    const config = await invoke<AppConfig>('get_config')
    return invoke<number>('send_chat', {
      userId,
      lessonId,
      message,
      selectedText,
      conversationId,
      apiKey: getApiKey(config),
      model: config.model,
      apiProvider: config.api_provider || 'anthropic',
    })
  },

  cancelChat: (convId: number) => invoke<void>('cancel_chat', { convId }),

  clearUserData: (userId: number) => invoke<void>('clear_user_data', { userId }),

  assessUserSkill: async (userId: number, responses: AssessmentResponse[]) => {
    const config = await invoke<AppConfig>('get_config')
    return invoke<UserProfileOut>('assess_user_skill', {
      input: { user_id: userId, responses },
      apiKey: getApiKey(config),
      model: config.model,
      apiProvider: config.api_provider || 'anthropic',
    })
  },

  getUserProfile: (userId: number) =>
    invoke<UserProfileOut | null>('get_user_profile', { userId }),

  generateLearningPath: async (userId: number) => {
    const config = await invoke<AppConfig>('get_config')
    return invoke<LearningPathOut>('generate_learning_path', {
      userId,
      apiKey: getApiKey(config),
      model: config.model,
      apiProvider: config.api_provider || 'anthropic',
    })
  },

  getLearningPath: (userId: number) =>
    invoke<LearningPathOut | null>('get_learning_path', { userId }),

  listLearningPathVersions: (userId: number) =>
    invoke<LearningPathVersionSummary[]>('list_learning_path_versions', { userId }),

  getLearningPathVersion: (userId: number, versionId: number) =>
    invoke<LearningPathOut | null>('get_learning_path_version', { userId, versionId }),

  getDashboardData: (userId: number) =>
    invoke<DashboardData>('get_dashboard_data', { userId }),

  getWrongAnswers: (userId: number) =>
    invoke<WrongAnswerItem[]>('get_wrong_answers', { userId }),

  importFromUrl: async (url: string) => {
    const config = await invoke<AppConfig>('get_config')
    return invoke<ImportCourseResult>('import_from_url', {
      url,
      apiKey: getApiKey(config),
      model: config.model,
      apiProvider: config.api_provider || 'anthropic',
    })
  },

  checkImportUrl: (url: string) =>
    invoke<DuplicateCheckResult>('check_import_url', { url }),

  searchGithubAwesome: (query: string) =>
    invoke<AwesomeRepo[]>('search_github_awesome', { query }),

  fetchAwesomeLinks: (owner: string, repo: string) =>
    invoke<AwesomeLink[]>('fetch_awesome_links', { owner, repo }),

  previewImportLink: (url: string) =>
    invoke<LinkPreview>('preview_import_link', { url }),

  subscribeFeed: (feedUrl: string) =>
    invoke<FeedSubscription>('subscribe_feed', { feedUrl }),

  unsubscribeFeed: (id: number) =>
    invoke<void>('unsubscribe_feed', { id }),

  listFeedSubscriptions: () =>
    invoke<FeedSubscription[]>('list_feed_subscriptions'),

  fetchFeedArticles: (feedUrl: string) =>
    invoke<FeedArticle[]>('fetch_feed_articles', { feedUrl }),

  importFeedArticle: async (url: string) => {
    const config = await invoke<AppConfig>('get_config')
    return invoke<ImportCourseResult>('import_from_url', {
      url,
      apiKey: getApiKey(config),
      model: config.model,
      apiProvider: config.api_provider || 'anthropic',
    })
  },

  searchAll: (query: string, limit?: number) =>
    invoke<SearchResultItem[]>('search_all', { query, limit: limit ?? 20 }),

  getKnowledgeGraph: (userId: number) =>
    invoke<KnowledgeGraphData>('get_knowledge_graph', { userId }),

  getRecommendations: (userId: number) =>
    invoke<RecommendationItem[]>('get_recommendations', { userId }),

  getAnalytics: (userId: number) =>
    invoke<AnalyticsData>('get_analytics', { userId }),
}
