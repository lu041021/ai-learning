import type {
  CourseSummary,
  CourseDetail,
  LessonDetail,
  Quiz,
  ChapterDetail,
  QuizQuestion,
} from '../../types'

export function createCourse(overrides?: Partial<CourseSummary>): CourseSummary {
  return {
    id: 1,
    title: 'Test Course',
    slug: 'test-course',
    description: 'A test course',
    difficulty: 'beginner',
    duration_minutes: 0,
    tags: [],
    ...overrides,
  }
}

export function createCourseDetail(overrides?: Partial<CourseDetail>): CourseDetail {
  return {
    ...createCourse(),
    chapters: [createChapter()],
    ...overrides,
  }
}

export function createChapter(overrides?: Partial<ChapterDetail>): ChapterDetail {
  return {
    id: 1,
    title: 'Test Chapter',
    order_index: 1,
    lessons: [createLesson()],
    ...overrides,
  }
}

export function createLesson(overrides?: Partial<LessonDetail>): LessonDetail {
  return {
    id: 1,
    chapter_id: 1,
    title: 'Test Lesson',
    content_md: '# Test\n\nLesson content',
    order_index: 1,
    duration_minutes: 0,
    ...overrides,
  }
}

export function createQuiz(overrides?: Partial<Quiz>): Quiz {
  return {
    id: 1,
    lesson_id: 1,
    title: 'Test Quiz',
    questions: [createQuizQuestion()],
    ...overrides,
  }
}

export function createQuizQuestion(overrides?: Partial<QuizQuestion>): QuizQuestion {
  return {
    id: 1,
    question_text: 'What is AI?',
    options: ['A', 'B', 'C', 'D'],
    explanation: 'A is correct',
    ...overrides,
  }
}
