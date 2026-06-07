// Mock Tauri APIs for frontend-only development (VITE_MOCK=true)
// Intercepted via vite.config.ts resolve.alias

function delay(ms = 80 + Math.random() * 160) {
  return new Promise((r) => setTimeout(r, ms))
}

// ── Mock Data ──────────────────────────────────────────────

const mockConfig = {
  api_key: '',
  api_provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  theme: 'dark',
}

const mockCourses = [
  {
    id: 1,
    title: 'Rust 编程入门',
    slug: 'rust-intro',
    description: '从零开始学习 Rust 编程语言，涵盖所有权、生命周期、 trait 等核心概念',
  },
  {
    id: 2,
    title: 'TypeScript 高级特性',
    slug: 'ts-advanced',
    description: '深入理解 TypeScript 类型系统，泛型、条件类型、模板字面量类型',
  },
  {
    id: 3,
    title: 'React 19 实战',
    slug: 'react-19',
    description: 'React 19 新特性与最佳实践， Server Components、Actions、use() hook',
  },
]

const mockCourseDetail = {
  id: 1,
  title: 'Rust 编程入门',
  slug: 'rust-intro',
  description: '从零开始学习 Rust',
  chapters: [
    {
      id: 1,
      title: '第一章：基础语法',
      order_index: 1,
      lessons: [
        { id: 1, title: '变量与可变性', order_index: 1 },
        { id: 2, title: '数据类型', order_index: 2 },
        { id: 3, title: '函数与控制流', order_index: 3 },
      ],
    },
    {
      id: 2,
      title: '第二章：所有权系统',
      order_index: 2,
      lessons: [
        { id: 4, title: '所有权规则', order_index: 4 },
        { id: 5, title: '引用与借用', order_index: 5 },
        { id: 6, title: '生命周期', order_index: 6 },
      ],
    },
  ],
}

const mockLesson = {
  id: 1,
  title: '变量与可变性',
  content_md: `# 变量与可变性

## 概述
Rust 中的变量默认是**不可变的**。这是 Rust 安全性的基石之一。

## 可变变量
使用 \`mut\` 关键字声明可变变量：

\`\`\`rust
let x = 5;     // 不可变
let mut y = 5;  // 可变
y = 6;          // OK
\`\`\`

## 常量
使用 \`const\` 声明常量，必须标注类型：

\`\`\`rust
const MAX_POINTS: u32 = 100_000;
\`\`\`

## 隐藏（Shadowing）
可以声明同名新变量来"隐藏"旧变量：

\`\`\`rust
let x = 5;
let x = x + 1;  // x = 6
\`\`\`
`,
  order_index: 1,
  chapter_id: 1,
}

const mockQuiz = {
  id: 1,
  lesson_id: 1,
  title: '变量与可变性 - 测验',
  questions: [
    {
      id: 1,
      question_text: 'Rust 中变量默认是？',
      options: JSON.stringify(['可变的', '不可变的', '常量', '静态的']),
      explanation: 'Rust 中变量默认是不可变的，使用 mut 关键字声明可变变量。',
    },
    {
      id: 2,
      question_text: '以下哪个是声明常量的正确方式？',
      options: JSON.stringify([
        'let X = 5',
        'const X = 5',
        'const X: i32 = 5',
        'static X: i32 = 5',
      ]),
      explanation: '常量必须显式标注类型。',
    },
  ],
}

const mockProgress = { completed_lesson_ids: [1, 2], quiz_scores: { '1': 80, '2': 100 } }

const mockUser = { id: 1, username: 'Learner_Mock', local_id: 'mock-local-id' }

const mockConversations: Array<{
  id: number
  title: string
  lesson_id: number | null
  created_at: string
  updated_at: string
}> = [
  {
    id: 1,
    title: '关于 Rust 所有权的讨论',
    lesson_id: 4,
    created_at: '2026-06-05T10:00:00Z',
    updated_at: '2026-06-05T10:30:00Z',
  },
  {
    id: 2,
    title: 'TypeScript 泛型问题',
    lesson_id: null,
    created_at: '2026-06-04T14:00:00Z',
    updated_at: '2026-06-04T14:20:00Z',
  },
]

const mockMessages = [
  {
    id: 1,
    role: 'user' as const,
    content: '什么是 Rust 的所有权？',
    created_at: '2026-06-05T10:00:00Z',
  },
  {
    id: 2,
    role: 'assistant' as const,
    content: '所有权（Ownership）是 Rust 最独特的特性...',
    created_at: '2026-06-05T10:00:05Z',
  },
]

const mockProfile = {
  id: 1,
  user_id: 1,
  experience_level: 'intermediate',
  interests: ['Rust', 'TypeScript', '系统编程'],
  learning_goals: '掌握 Rust 高级特性',
  assessment_completed: true,
  summary: '有一定编程基础，对系统编程感兴趣。',
}

const mockLearningPath = {
  id: 1,
  user_id: 1,
  steps: [
    {
      order: 1,
      title: 'Rust 基础语法',
      description: '掌握变量、类型、函数等基础概念',
      step_type: 'course_lesson' as const,
      course_id: 1,
      lesson_id: 1,
      status: 'completed' as const,
      estimated_minutes: 30,
    },
    {
      order: 2,
      title: '所有权深入理解',
      description: '深入理解所有权、借用、生命周期',
      step_type: 'ai_concept' as const,
      course_id: null,
      lesson_id: null,
      status: 'available' as const,
      estimated_minutes: 45,
    },
    {
      order: 3,
      title: '基础练习',
      description: '完成基础语法相关测验',
      step_type: 'practice_quiz' as const,
      course_id: 1,
      lesson_id: 1,
      status: 'available' as const,
      estimated_minutes: 20,
    },
    {
      order: 4,
      title: '构建命令行工具',
      description: '用 Rust 构建一个实用的 CLI 工具',
      step_type: 'project' as const,
      course_id: null,
      lesson_id: null,
      status: 'locked' as const,
      estimated_minutes: 120,
    },
  ],
  generated_at: '2026-06-05T12:00:00Z',
  updated_at: '2026-06-05T12:00:00Z',
}

const mockPathVersions = [
  { id: 1, version: 1, is_active: true, generated_at: '2026-06-05T12:00:00Z', step_count: 4 },
]

const mockDashboard = {
  total_lessons: 24,
  completed_lessons: 8,
  total_quizzes: 12,
  avg_quiz_score: 82.5,
  skill_radar: [
    { label: 'Rust', score: 65 },
    { label: 'TypeScript', score: 80 },
    { label: 'React', score: 70 },
    { label: '算法', score: 55 },
    { label: '系统设计', score: 40 },
  ],
  course_progress: [
    {
      course_id: 1,
      title: 'Rust 编程入门',
      slug: 'rust-intro',
      total_lessons: 12,
      completed_lessons: 5,
    },
    {
      course_id: 2,
      title: 'TypeScript 高级特性',
      slug: 'ts-advanced',
      total_lessons: 8,
      completed_lessons: 3,
    },
  ],
  calendar_days: [
    { date: '2026-06-01', count: 3 },
    { date: '2026-06-02', count: 2 },
    { date: '2026-06-03', count: 5 },
    { date: '2026-06-04', count: 1 },
    { date: '2026-06-05', count: 4 },
  ],
  knowledge_tree: [
    {
      id: 1,
      title: 'Rust 编程入门',
      kind: 'course' as const,
      completed: false,
      children: [
        {
          id: 1,
          title: '基础语法',
          kind: 'chapter' as const,
          completed: false,
          children: [
            {
              id: 1,
              title: '变量与可变性',
              kind: 'lesson' as const,
              completed: true,
              children: [],
              course_slug: 'rust-intro',
            },
            {
              id: 2,
              title: '数据类型',
              kind: 'lesson' as const,
              completed: true,
              children: [],
              course_slug: 'rust-intro',
            },
            {
              id: 3,
              title: '函数与控制流',
              kind: 'lesson' as const,
              completed: false,
              children: [],
              course_slug: 'rust-intro',
            },
          ],
          course_slug: null,
        },
      ],
      course_slug: null,
    },
  ],
}

const mockWrongAnswers: Array<{
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
}> = [
  {
    quiz_id: 1,
    quiz_title: '变量与可变性 - 测验',
    question_text: 'Rust 中变量默认是？',
    options: ['可变的', '不可变的', '常量', '静态的'],
    your_answer_index: 0,
    correct_answer_index: 1,
    explanation: '默认不可变。',
    lesson_id: 1,
    lesson_title: '变量与可变性',
    course_slug: 'rust-intro',
    attempted_at: '2026-06-04T10:00:00Z',
  },
]

const mockKnowledgeGraph = {
  nodes: [
    { id: 1, name: '所有权', domain: 'Rust', lessonCount: 3, completedCount: 1 },
    { id: 2, name: '借用', domain: 'Rust', lessonCount: 2, completedCount: 0 },
    { id: 3, name: '泛型', domain: 'TypeScript', lessonCount: 2, completedCount: 2 },
  ],
  edges: [{ sourceId: 1, targetId: 2, weight: 0.8 }],
  positions: [
    [100, 100],
    [200, 150],
    [150, 250],
  ],
}

const mockRecommendations = [
  {
    courseId: 2,
    title: 'TypeScript 高级特性',
    slug: 'ts-advanced',
    description: '深入 TypeScript 类型系统',
    score: 0.85,
    reason: '与你的 Rust 学习互补',
    tags: ['类型系统', '前端'],
    totalLessons: 8,
    completedLessons: 0,
  },
  {
    courseId: 3,
    title: 'React 19 实战',
    slug: 'react-19',
    description: 'React 19 新特性',
    score: 0.72,
    reason: '前端技能提升',
    tags: ['React', '前端'],
    totalLessons: 10,
    completedLessons: 0,
  },
]

const mockAnalytics = {
  completionPct: 33.3,
  accuracyPct: 82.5,
  streakDays: 4,
  longestStreak: 7,
  reviewRate: 0.65,
  perCourse: [
    {
      courseId: 1,
      title: 'Rust 编程入门',
      slug: 'rust-intro',
      totalLessons: 12,
      completed: 5,
      avgQuizScore: 80,
      quizAttempts: 3,
    },
  ],
  weeklyActivity: [
    { week: '2026-05-30', sessions: 12, lessonsCompleted: 5 },
    { week: '2026-06-06', sessions: 8, lessonsCompleted: 3 },
  ],
  accuracyTrend: [
    { label: '第1周', score: 70 },
    { label: '第2周', score: 78 },
    { label: '第3周', score: 82 },
  ],
  domainAccuracy: [
    { domain: 'Rust', accuracy: 78, attempts: 10 },
    { domain: 'TypeScript', accuracy: 88, attempts: 5 },
  ],
  weakAreas: [
    {
      conceptName: '生命周期',
      accuracy: 55,
      lessonTitle: '生命周期标注',
      courseSlug: 'rust-intro',
      lessonId: 6,
    },
  ],
  strongAreas: ['TypeScript 泛型', 'React Hooks'],
}

const mockUsageProfile = {
  frequent_topics: ['Rust', 'TypeScript', '系统编程'],
  tool_usage: [
    { tool_name: 'Read', frequency: 'high', proficiency_hint: '熟练使用文件阅读' },
    { tool_name: 'Edit', frequency: 'medium', proficiency_hint: '基本掌握代码编辑' },
  ],
  error_patterns: ['生命周期标注错误', '泛型约束遗漏'],
  knowledge_gaps: [
    { domain: 'Rust 生命周期', description: '对复杂生命周期场景理解不足', severity: 'high' },
    { domain: '异步编程', description: '对 async/await 底层原理不熟悉', severity: 'medium' },
  ],
  learning_recommendations: [
    '深入学习 Rust 生命周期',
    '了解 async runtime 原理',
    '实践 Tokio 框架',
  ],
  experience_summary:
    '你有不错的中级编程基础，在 TypeScript 方面表现良好，但在 Rust 系统编程方面还有提升空间。',
}

const mockSearchResults = [
  {
    source_type: 'lesson' as const,
    source_id: 1,
    title: '变量与可变性',
    snippet: 'Rust 中变量默认是不可变的...',
    context_id: 1,
    context_type: 'course',
    context_slug: 'rust-intro',
    rank: 1,
  },
  {
    source_type: 'lesson' as const,
    source_id: 4,
    title: '所有权规则',
    snippet: '所有权是 Rust 的核心特性...',
    context_id: 1,
    context_type: 'course',
    context_slug: 'rust-intro',
    rank: 2,
  },
]

const mockLinkPreview = {
  title: 'Rust 官方文档',
  description: 'Rust 编程语言的官方文档',
  url: 'https://doc.rust-lang.org/book/',
  text_length: 5000,
  text_preview: '# The Rust Programming Language...',
}

const mockFeedArticles = [
  {
    title: 'Rust 2026 路线图',
    url: 'https://example.com/rust-2026',
    description: 'Rust 项目 2026 年发展路线图',
    published_at: '2026-06-01T00:00:00Z',
    author: 'Rust Team',
  },
  {
    title: 'TypeScript 6.0 发布',
    url: 'https://example.com/ts-6',
    description: 'TypeScript 6.0 正式发布',
    published_at: '2026-05-28T00:00:00Z',
    author: 'Microsoft',
  },
]

const mockFeedSubscriptions = [
  {
    id: 1,
    feed_url: 'https://blog.rust-lang.org/feed.xml',
    feed_title: 'Rust Blog',
    last_fetched_at: '2026-06-05T08:00:00Z',
    created_at: '2026-06-01T00:00:00Z',
  },
]

const mockDeepProfile = {
  experience_level: '中级偏上，在 TypeScript/前端领域有扎实基础，Rust 处于入门进阶阶段',
  interests: ['Rust 系统编程', 'TypeScript 类型体操', '编译原理', 'WebAssembly'],
  learning_goals: '半年内能用 Rust 独立完成中型项目，理解编译器前端原理',
  concept_mastery: [
    {
      concept_name: '所有权',
      domain: 'Rust',
      mastery_score: 0.65,
      quiz_attempts: 3,
      last_score: 80,
    },
    { concept_name: '借用', domain: 'Rust', mastery_score: 0.5, quiz_attempts: 2, last_score: 60 },
    {
      concept_name: '泛型',
      domain: 'TypeScript',
      mastery_score: 0.85,
      quiz_attempts: 4,
      last_score: 90,
    },
  ],
  domain_strengths: ['TypeScript 类型系统', 'React 组件设计'],
  weakness_details: [
    {
      domain: 'Rust',
      concept_name: '生命周期',
      severity: 'high' as const,
      current_score: 0.35,
      suggested_focus: '重点学习生命周期省略规则和显式标注场景',
    },
    {
      domain: 'Rust',
      concept_name: '异步编程',
      severity: 'medium' as const,
      current_score: 0.45,
      suggested_focus: '理解 Future trait 和 async/await 转换',
    },
  ],
  learning_style: {
    pace: 'steady',
    consistency: 'weekday_evening',
    preferred_format: 'text+code',
    review_tendency: 'moderate',
    avg_session_minutes: 45,
  },
  total_lessons_completed: 8,
  total_quizzes_taken: 5,
  avg_quiz_score: 82.5,
  streak_days: 4,
  completion_pct: 33.3,
  external_skill_context: null,
  goal_analysis: {
    goal_text: '半年内能用 Rust 独立完成中型项目',
    gap_description:
      '当前 Rust 基础概念（所有权）已掌握 60%，但生命周期和异步编程差距较大，缺少实际项目经验',
    priority_domains: ['Rust 生命周期', 'Rust 异步编程', 'Rust 项目实战'],
    suggested_milestones: [
      '完成所有权系统学习（2周）',
      '掌握生命周期标注（3周）',
      '学习 async/await 和 Tokio（3周）',
      '构建第一个 CLI 项目（2周）',
    ],
  },
  summary:
    '你在 TypeScript 领域有扎实的中级水平，泛型和类型体操表现突出。Rust 方面所有权基础已建立但尚未稳固，生命周期和异步编程是主要瓶颈。建议优先攻克生命周期（高严重度），同时保持 TypeScript 优势领域的学习节奏。学习风格偏稳步推进，适合结构化学习路径。',
  profile_version: 2,
  generated_at: '2026-06-05T12:00:00Z',
}

// ── Command Handler ────────────────────────────────────────

const HANDLERS: Record<string, (args: Record<string, unknown>) => unknown> = {
  get_config: () => mockConfig,
  set_config: () => null,

  list_courses: () => mockCourses,
  get_course: (args: Record<string, unknown>) => {
    const courses: Record<string, typeof mockCourseDetail> = {
      'rust-intro': mockCourseDetail,
      'ts-advanced': {
        ...mockCourseDetail,
        id: 2,
        title: 'TypeScript 高级特性',
        slug: 'ts-advanced',
        description: '深入理解 TypeScript',
      },
    }
    return courses[args?.slug as string] || mockCourseDetail
  },
  get_lesson: () => mockLesson,
  get_quiz: () => mockQuiz,
  submit_quiz: () => ({
    score: 85,
    total: 2,
    correct: 1,
    feedback: '不错！继续加油。',
    next_step_recommendation: '建议复习生命周期标注',
  }),

  get_progress: () => mockProgress,
  mark_complete: () => 'ok',

  create_user: () => mockUser,
  get_user_by_local: () => mockUser,

  list_conversations: () => mockConversations,
  get_messages: () => mockMessages,
  send_chat: () => 1,
  cancel_chat: () => null,

  clear_user_data: () => null,

  assess_user_skill: () => mockProfile,
  get_user_profile: () => mockProfile,
  generate_learning_path: () => mockLearningPath,
  get_learning_path: () => mockLearningPath,
  list_learning_path_versions: () => mockPathVersions,
  get_learning_path_version: () => mockLearningPath,

  get_dashboard_data: () => mockDashboard,
  get_wrong_answers: () => mockWrongAnswers,

  import_from_url: () => ({
    course_id: 4,
    course_title: '导入课程',
    course_slug: 'imported-course',
    chapters_count: 3,
    lessons_count: 10,
    quiz_count: 5,
  }),
  check_import_url: () => ({
    exists: false,
    existing_course_id: null,
    existing_course_title: null,
  }),
  search_github_awesome: () => [
    {
      full_name: 'rust-unofficial/awesome-rust',
      description: 'Rust 资源列表',
      stars: 45000,
      url: 'https://github.com/rust-unofficial/awesome-rust',
    },
  ],
  fetch_awesome_links: () => [
    { text: 'Rust Book', url: 'https://doc.rust-lang.org/book/', description: '官方 Rust 教程' },
  ],
  preview_import_link: () => mockLinkPreview,
  subscribe_feed: () => mockFeedSubscriptions[0],
  unsubscribe_feed: () => null,
  list_feed_subscriptions: () => mockFeedSubscriptions,
  fetch_feed_articles: () => mockFeedArticles,

  search_all: () => mockSearchResults,
  get_knowledge_graph: () => mockKnowledgeGraph,
  get_recommendations: () => mockRecommendations,
  get_analytics: () => mockAnalytics,

  analyze_usage: () => mockUsageProfile,
  generate_goal_path: () => ({ ...mockLearningPath, id: 2 }),
  assess_user_skill_deep: () => mockDeepProfile,
  generate_enriched_learning_path: () => ({ ...mockLearningPath, id: 3 }),
}

// ── Public API ─────────────────────────────────────────────

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  await delay()
  const handler = HANDLERS[cmd]
  if (!handler) {
    console.warn(`[mock-invoke] Unknown command: ${cmd}`)
    return undefined as T
  }
  try {
    return handler(args ?? {}) as T
  } catch (e) {
    console.error(`[mock-invoke] Error in ${cmd}:`, e)
    throw e
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function listen<T>(_event: string, _handler: (event: { payload: T }) => void) {
  // Return no-op unlisten function (events are not simulated in mock mode)
  return () => {}
}
