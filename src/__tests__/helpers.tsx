import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { type ReactElement } from 'react'

function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, {
    wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    ...options,
  })
}

export { renderWithProviders }
// eslint-disable-next-line react-refresh/only-export-components
export * from '@testing-library/react'
