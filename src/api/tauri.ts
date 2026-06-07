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
  UsageProfile,
  UserProfileFull,
  DocumentOut,
} from '../types'

export interface AppConfig {
  api_key: string
  api_provider: string
  model: string
  theme: string
}

export const api = {
  getConfig: () => invoke<AppConfig>('get_config'),

  setConfig: (apiKey: string, model: string, theme: string, apiProvider: string) =>
    invoke<void>('set_config', { apiKey, model, theme, apiProvider }),

  getCourses: (limit?: number, offset?: number) =>
    invoke<CourseSummary[]>('list_courses', { limit, offset }),

  getCourse: (slug: string) => invoke<CourseDetail>('get_course', { slug }),

  getLesson: (id: number) => invoke<LessonDetail>('get_lesson', { lessonId: id }),

  getQuiz: async (lessonId: number) => {
    const quiz = await invoke<
      | (Quiz & {
          questions: Array<Omit<Quiz['questions'][0], 'options'> & { options: string | string[] }>
        })
      | null
    >('get_quiz', { lessonId })
    if (!quiz) return null
    return {
      ...quiz,
      questions: quiz.questions.map((q) => ({
        ...q,
        options: typeof q.options === 'string' ? (JSON.parse(q.options) as string[]) : q.options,
      })),
    } as Quiz
  },

  submitQuiz: (userId: number, quizId: number, answers: number[]) =>
    invoke<QuizResult>('submit_quiz', { userId, quizId, answers }),

  getProgress: (userId: number) => invoke<UserProgress>('get_progress', { userId }),

  markComplete: (userId: number, lessonId: number) =>
    invoke<string>('mark_complete', { userId, lessonId }),

  createUser: (username: string, localId: string) =>
    invoke<User>('create_user', { username, localId }),

  getUserByLocal: (localId: string) => invoke<User>('get_user_by_local', { localId }),

  getConversations: (userId: number, limit?: number, offset?: number) =>
    invoke<ConversationSummary[]>('list_conversations', { userId, limit, offset }),

  getMessages: (convId: number) => invoke<ChatMessage[]>('get_messages', { convId }),

  sendChat: (
    userId: number,
    message: string,
    lessonId: number | null,
    selectedText: string | null,
    conversationId: number | null,
  ) =>
    invoke<number>('send_chat', {
      userId,
      lessonId,
      message,
      selectedText,
      conversationId,
    }),

  cancelChat: (convId: number) => invoke<void>('cancel_chat', { convId }),

  clearUserData: (userId: number) => invoke<void>('clear_user_data', { userId }),

  assessUserSkill: (userId: number, responses: AssessmentResponse[]) =>
    invoke<UserProfileOut>('assess_user_skill', {
      input: { user_id: userId, responses },
    }),

  getUserProfile: (userId: number) => invoke<UserProfileOut | null>('get_user_profile', { userId }),

  generateLearningPath: (userId: number) =>
    invoke<LearningPathOut>('generate_learning_path', { userId }),

  getLearningPath: (userId: number) =>
    invoke<LearningPathOut | null>('get_learning_path', { userId }),

  listLearningPathVersions: (userId: number) =>
    invoke<LearningPathVersionSummary[]>('list_learning_path_versions', { userId }),

  getLearningPathVersion: (userId: number, versionId: number) =>
    invoke<LearningPathOut | null>('get_learning_path_version', { userId, versionId }),

  getDashboardData: (userId: number) => invoke<DashboardData>('get_dashboard_data', { userId }),

  getWrongAnswers: (userId: number) => invoke<WrongAnswerItem[]>('get_wrong_answers', { userId }),

  importFromUrl: (url: string) => invoke<ImportCourseResult>('import_from_url', { url }),

  checkImportUrl: (url: string) => invoke<DuplicateCheckResult>('check_import_url', { url }),

  searchGithubAwesome: (query: string) => invoke<AwesomeRepo[]>('search_github_awesome', { query }),

  fetchAwesomeLinks: (owner: string, repo: string) =>
    invoke<AwesomeLink[]>('fetch_awesome_links', { owner, repo }),

  previewImportLink: (url: string) => invoke<LinkPreview>('preview_import_link', { url }),

  subscribeFeed: (feedUrl: string) => invoke<FeedSubscription>('subscribe_feed', { feedUrl }),

  unsubscribeFeed: (id: number) => invoke<void>('unsubscribe_feed', { id }),

  listFeedSubscriptions: () => invoke<FeedSubscription[]>('list_feed_subscriptions'),

  fetchFeedArticles: (feedUrl: string) => invoke<FeedArticle[]>('fetch_feed_articles', { feedUrl }),

  searchAll: (query: string, limit?: number) =>
    invoke<SearchResultItem[]>('search_all', { query, limit: limit ?? 20 }),

  getKnowledgeGraph: (userId: number) =>
    invoke<KnowledgeGraphData>('get_knowledge_graph', { userId }),

  getRecommendations: (userId: number) =>
    invoke<RecommendationItem[]>('get_recommendations', { userId }),

  getAnalytics: (userId: number) => invoke<AnalyticsData>('get_analytics', { userId }),

  analyzeUsage: () => invoke<UsageProfile>('analyze_usage'),

  generateGoalPath: (userId: number) => invoke<LearningPathOut>('generate_goal_path', { userId }),

  assessUserSkillDeep: (userId: number, responses: AssessmentResponse[]) =>
    invoke<UserProfileFull>('assess_user_skill_deep', {
      input: { user_id: userId, responses },
    }),

  generateEnrichedLearningPath: (userId: number) =>
    invoke<LearningPathOut>('generate_enriched_learning_path', { userId }),

  getMcpToken: () => invoke<string>('get_mcp_token'),

  uploadDocument: (userId: number, filename: string, fileBytes: number[]) =>
    invoke<DocumentOut>('upload_document', { userId, filename, fileBytes }),

  listDocuments: (userId: number) => invoke<DocumentOut[]>('list_documents', { userId }),

  deleteDocument: (docId: number, userId: number) =>
    invoke<void>('delete_document', { docId, userId }),
}
