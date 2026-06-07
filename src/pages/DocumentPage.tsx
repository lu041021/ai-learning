import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/tauri'
import { useUserStore } from '../stores'
import { toast } from '../components/ui/Toast'
import type { DocumentOut } from '../types'

const S = {
  card: {
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    padding: '24px',
  } as React.CSSProperties,
  dropzone: {
    border: '2px dashed var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '40px 24px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
  } as React.CSSProperties,
  dropzoneActive: {
    borderColor: 'var(--accent)',
    background: 'var(--accent-light)',
  } as React.CSSProperties,
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function DocumentPage() {
  const userId = useUserStore((s) => s.userId)
  const [docs, setDocs] = useState<DocumentOut[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadDocs = useCallback(() => {
    if (!userId) return
    api
      .listDocuments(userId)
      .then(setDocs)
      .catch(() => toast.error('加载文档列表失败'))
  }, [userId])

  useEffect(() => {
    document.title = '我的文档 - AI 学堂'
  }, [])

  useEffect(() => {
    void loadDocs()
  }, [loadDocs])

  async function handleFiles(files: FileList | null) {
    if (!files || !userId) return
    setUploading(true)
    let successCount = 0
    for (const file of Array.from(files)) {
      try {
        const arrayBuf = await file.arrayBuffer()
        const bytes = Array.from(new Uint8Array(arrayBuf))
        await api.uploadDocument(userId, file.name, bytes)
        successCount++
      } catch (e) {
        toast.error(`上传 ${file.name} 失败: ${e}`)
      }
    }
    if (successCount > 0) {
      toast.success(`成功上传 ${successCount} 个文档`)
      await loadDocs()
    }
    setUploading(false)
  }

  async function handleDelete(docId: number) {
    if (!userId) return
    if (!window.confirm('确定要删除这个文档吗？')) return
    try {
      await api.deleteDocument(docId, userId)
      setDocs((prev) => prev.filter((d) => d.id !== docId))
      toast.success('文档已删除')
    } catch {
      toast.error('删除失败')
    }
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <Link
        to="/"
        style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          marginBottom: '20px',
          display: 'inline-block',
        }}
      >
        &larr; 返回首页
      </Link>

      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>我的文档</h1>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
        上传参考文档（PDF、Word、TXT、Markdown），AI 导师会在回答时自动引用相关内容。
      </p>

      <div style={{ display: 'grid', gap: '20px' }}>
        <div
          style={{
            ...S.card,
            ...S.dropzone,
            ...(dragging ? S.dropzoneActive : {}),
          }}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFiles(e.dataTransfer.files)
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".txt,.md,.markdown,.pdf,.docx"
            style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>&#128196;</div>
          <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>
            {uploading ? '上传中...' : '点击或拖拽文件到这里'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            支持 .pdf、.docx、.txt、.md 格式
          </div>
        </div>

        {docs.length > 0 && (
          <div style={S.card}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
              已上传文档 ({docs.length})
            </h2>
            <div style={{ display: 'grid', gap: '10px' }}>
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {doc.filename}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {doc.fileType.toUpperCase()} · {formatBytes(doc.sizeBytes)} · {doc.chunkCount}{' '}
                      个片段
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    style={{
                      padding: '4px 10px',
                      background: 'transparent',
                      color: 'var(--danger)',
                      border: '1px solid var(--danger)',
                      borderRadius: 'var(--radius)',
                      fontSize: '12px',
                      flexShrink: 0,
                    }}
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {docs.length === 0 && !uploading && (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '14px',
              padding: '20px',
            }}
          >
            还没有上传过文档
          </div>
        )}
      </div>
    </div>
  )
}
