import { sanitizeCanvasHtml, toWellFormed } from './canvasText'

describe('Canvas text normalization', () => {
  it('replaces isolated UTF-16 surrogates before persistence', () => {
    const value = toWellFormed('Sala \ud83d sin pareja')

    expect(value).toBe('Sala � sin pareja')
    expect(() => JSON.parse(JSON.stringify({ value }))).not.toThrow()
  })

  it('keeps valid emoji pairs and sanitizes HTML', () => {
    expect(sanitizeCanvasHtml('<p>Temario 📝</p><script>alert(1)</script>')).toBe('Temario 📝')
  })
})
