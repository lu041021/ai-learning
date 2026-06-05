export interface CourseSummary {
  id: number
  title: string
  slug: string
  description: string
}

export interface LessonSummary {
  id: number
  title: string
  order_index: number
}

export interface ChapterDetail {
  id: number
  title: string
  order_index: number
  lessons: LessonSummary[]
}

export interface CourseDetail {
  id: number
  title: string
  slug: string
  description: string
  chapters: ChapterDetail[]
}

export interface LessonDetail {
  id: number
  title: string
  content_md: string
  order_index: number
  chapter_id: number
}

export interface QuizQuestion {
  id: number
  question_text: string
  options: string
  explanation: string
}

export interface Quiz {
  id: number
  lesson_id: number
  title: string
  questions: QuizQuestion[]
}

export interface QuizResult {
  score: number
  total: number
  correct: number
  feedback: string
  next_step_recommendation?: string
}

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface ConversationSummary {
  id: number
  title: string
  lesson_id: number | null
  created_at: string
  updated_at: string
}

export interface UserProgress {
  completed_lesson_ids: number[]
  quiz_scores: Record<number, number>
}

export interface User {
  id: number
  username: string
  local_id: string
}

export interface AssessmentQuestion {
  question_text: string
  options: string[]
}

export interface AssessmentResponse {
  question_index: number
  question_text: string
  answer_index: number
  answer_text: string
}

export interface SkillAssessment {
  experience_level: string
  interests: string[]
  learning_goals: string
  summary: string
}

export interface UserProfileOut {
  id: number
  user_id: number
  experience_level: string
  interests: string[]
  learning_goals: string
  assessment_completed: boolean
  summary: string
}

export interface LearningPathStep {
  order: number
  title: string
  description: string
  step_type: 'course_lesson' | 'ai_concept' | 'practice_quiz' | 'project'
  course_id: number | null
  lesson_id: number | null
  status: 'locked' | 'available' | 'in_progress' | 'completed'
  estimated_minutes: number
}

export interface LearningPathOut {
  id: number
  user_id: number
  steps: LearningPathStep[]
  generated_at: string
  updated_at: string
}

export interface LearningPathVersionSummary {
  id: number
  version: number
  is_active: boolean
  generated_at: string
  step_count: number
}

export interface SkillRadarItem {
  label: string
  score: number
}

export interface CourseProgressItem {
  course_id: number
  title: string
  slug: string
  total_lessons: number
  completed_lessons: number
}

export interface CalendarDay {
  date: string
  count: number
}

export interface TreeNodeData {
  id: number
  title: string
  kind: 'course' | 'chapter' | 'lesson'
  completed: boolean
  children: TreeNodeData[]
  course_slug: string | null
}

export interface DashboardData {
  total_lessons: number
  completed_lessons: number
  total_quizzes: number
  avg_quiz_score: number
  skill_radar: SkillRadarItem[]
  course_progress: CourseProgressItem[]
  calendar_days: CalendarDay[]
  knowledge_tree: TreeNodeData[]
}

export interface ImportCourseResult {
  course_id: number
  course_title: string
  course_slug: string
  chapters_count: number
  lessons_count: number
  quiz_count: number
}

export interface DuplicateCheckResult {
  exists: boolean
  existing_course_id: number | null
  existing_course_title: string | null
}

export interface AwesomeRepo {
  full_name: string
  description: string
  stars: number
  url: string
}

export interface AwesomeLink {
  text: string
  url: string
  description: string
}

export interface LinkPreview {
  title: string
  description: string
  url: string
  text_length: number
  text_preview: string
}

export interface FeedSubscription {
  id: number
  feed_url: string
  feed_title: string
  last_fetched_at: string | null
  created_at: string
}

export interface FeedArticle {
  title: string
  url: string
  description: string
  published_at: string | null
  author: string | null
}

export interface WrongAnswerItem {
  quiz_id: number
  quiz_title: string
  question_text: string
  options: string[]
  your_answer_index: number
  correct_answer_index: number
  explanation: string
  lesson_id: number
  lesson_title: string
  course_slug: string
  attempted_at: string
}

export interface SearchResultItem {
  source_type: 'course' | 'lesson' | 'quiz_question'
  source_id: number
  title: string
  snippet: string
  context_id: number
  context_type: string
  context_slug: string
  rank: number
}

export interface ConceptNode {
  id: number
  name: string
  domain: string
  lessonCount: number
  completedCount: number
}

export interface ConceptEdge {
  sourceId: number
  targetId: number
  weight: number
}

export interface KnowledgeGraphData {
  nodes: ConceptNode[]
  edges: ConceptEdge[]
  positions: [number, number][]
}

export interface RecommendationItem {
  courseId: number
  title: string
  slug: string
  description: string
  score: number
  reason: string
  tags: string[]
  totalLessons: number
  completedLessons: number
}

export interface CourseAnalytics {
  courseId: number
  title: string
  slug: string
  totalLessons: number
  completed: number
  avgQuizScore: number
  quizAttempts: number
}

export interface WeekActivity {
  week: string
  sessions: number
  lessonsCompleted: number
}

export interface AccuracyPoint {
  label: string
  score: number
}

export interface DomainAccuracy {
  domain: string
  accuracy: number
  attempts: number
}

export interface WeakArea {
  conceptName: string
  accuracy: number
  lessonTitle: string
  courseSlug: string
  lessonId: number
}

export interface AnalyticsData {
  completionPct: number
  accuracyPct: number
  streakDays: number
  longestStreak: number
  reviewRate: number
  perCourse: CourseAnalytics[]
  weeklyActivity: WeekActivity[]
  accuracyTrend: AccuracyPoint[]
  domainAccuracy: DomainAccuracy[]
  weakAreas: WeakArea[]
  strongAreas: string[]
}
