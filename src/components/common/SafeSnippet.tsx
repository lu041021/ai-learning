function renderSnippet(html: string) {
  const parts = html.split(/<\/?mark>/)
  return parts.map((part, i) =>
    i % 2 === 1 ? { text: part, highlight: true } : { text: part, highlight: false },
  )
}

export function SafeSnippet({ html }: { html: string }) {
  const parts = renderSnippet(html)
  return (
    <>
      {parts.map((p, i) =>
        p.highlight ? (
          <mark
            key={i}
            style={{
              background: 'var(--accent-light)',
              color: 'var(--accent)',
              borderRadius: '2px',
              padding: '0 1px',
            }}
          >
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  )
}
