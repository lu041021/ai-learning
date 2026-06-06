import { describe, it, expect, beforeEach } from 'vitest'
import { useImportStore } from '../../stores'

beforeEach(() => {
  useImportStore.setState({
    phase: 'idle',
    statusText: '',
    result: null,
    errorText: '',
    duplicate: null,
  })
})

describe('useImportStore', () => {
  it('starts in idle phase', () => {
    const s = useImportStore.getState()
    expect(s.phase).toBe('idle')
    expect(s.result).toBeNull()
    expect(s.errorText).toBe('')
    expect(s.duplicate).toBeNull()
  })

  it('setPhase transitions phase', () => {
    useImportStore.getState().setPhase('checking')
    expect(useImportStore.getState().phase).toBe('checking')

    useImportStore.getState().setPhase('importing')
    expect(useImportStore.getState().phase).toBe('importing')
  })

  it('setResult sets result and transitions to done', () => {
    const result = {
      course_id: 1,
      title: 'Test Course',
      lesson_count: 5,
      import_source: 'url',
    }
    useImportStore.getState().setResult(result)
    const s = useImportStore.getState()
    expect(s.phase).toBe('done')
    expect(s.result?.title).toBe('Test Course')
    expect(s.result?.lesson_count).toBe(5)
  })

  it('setError sets errorText and transitions to error', () => {
    useImportStore.getState().setError('网络超时')
    const s = useImportStore.getState()
    expect(s.phase).toBe('error')
    expect(s.errorText).toBe('网络超时')
  })

  it('setDuplicate stores duplicate and stays idle', () => {
    const dup = { is_duplicate: true, existing_course_id: 99, existing_title: 'Old Course' }
    useImportStore.getState().setDuplicate(dup)
    const s = useImportStore.getState()
    expect(s.phase).toBe('idle')
    expect(s.duplicate?.existing_course_id).toBe(99)
  })

  it('setDuplicate with null clears duplicate', () => {
    useImportStore.setState({
      duplicate: { is_duplicate: true, existing_course_id: 1, existing_title: 'X' },
    })
    useImportStore.getState().setDuplicate(null)
    expect(useImportStore.getState().duplicate).toBeNull()
  })

  it('resetImport returns to clean idle state from error', () => {
    useImportStore.setState({ phase: 'error', errorText: '导入失败', result: null })
    useImportStore.getState().resetImport()
    const s = useImportStore.getState()
    expect(s.phase).toBe('idle')
    expect(s.errorText).toBe('')
    expect(s.duplicate).toBeNull()
  })

  it('resetImport clears result from done state', () => {
    useImportStore.setState({
      phase: 'done',
      result: { course_id: 2, title: 'Course', lesson_count: 3, import_source: 'url' },
    })
    useImportStore.getState().resetImport()
    expect(useImportStore.getState().result).toBeNull()
    expect(useImportStore.getState().phase).toBe('idle')
  })

  it('full import success cycle: idle → checking → importing → done', () => {
    const store = useImportStore.getState()
    store.setPhase('checking')
    expect(useImportStore.getState().phase).toBe('checking')

    store.setPhase('importing')
    expect(useImportStore.getState().phase).toBe('importing')

    store.setResult({ course_id: 10, title: 'ML Course', lesson_count: 8, import_source: 'github' })
    const s = useImportStore.getState()
    expect(s.phase).toBe('done')
    expect(s.result?.course_id).toBe(10)
  })

  it('import error cycle: idle → checking → error → idle after reset', () => {
    useImportStore.getState().setPhase('checking')
    useImportStore.getState().setError('解析失败')
    expect(useImportStore.getState().phase).toBe('error')

    useImportStore.getState().resetImport()
    expect(useImportStore.getState().phase).toBe('idle')
    expect(useImportStore.getState().errorText).toBe('')
  })
})
