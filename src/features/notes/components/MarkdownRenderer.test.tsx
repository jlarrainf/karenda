import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MarkdownRenderer } from './MarkdownRenderer.tsx'

describe('MarkdownRenderer', () => {
  it('renders extended Markdown and sanitizes executable HTML and links', () => {
    const { container } = render(
      <MarkdownRenderer
        content={
          '# Apunte\n\n| Tema | Estado |\n| --- | --- |\n| Rango | Listo |\n\n<script>alert("x")</script>\n\n[Enlace seguro](https://example.com)\n\n[Enlace inseguro](javascript:alert(1))'
        }
      />,
    )

    expect(screen.getByRole('heading', { name: 'Apunte' })).toBeVisible()
    expect(screen.getByRole('table')).toBeVisible()
    expect(container.querySelector('script')).not.toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'Enlace seguro' })).toHaveAttribute(
      'href',
      'https://example.com',
    )
    const links = container.querySelectorAll('a')
    expect(links).toHaveLength(2)
    expect(links[1]).not.toHaveAttribute('href', 'javascript:alert(1)')
  })

  it('renders inline and block mathematical expressions', () => {
    const { container } = render(
      <MarkdownRenderer
        content={'Complejidad $O(|d| \\cdot |p|)$ y $|d|$\n\n$$\n\\sum_{i=1}^{n} i\n$$'}
      />,
    )

    expect(container.querySelector('.katex')).toBeInTheDocument()
    expect(container.querySelector('.katex-display')).toBeInTheDocument()
    expect(container.textContent).toContain('O')
  })
})
