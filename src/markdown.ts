import MarkdownIt from 'markdown-it'
import katex from 'katex'
import DOMPurify from 'dompurify'
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
md.inline.ruler.before('escape', 'math', (state, silent) => {
  const start = state.pos
  const slash = state.src.slice(start, start + 2) === '\\('
  if (!slash && (state.src[start] !== '$' || state.src[start + 1] === '$')) return false
  const open = slash ? 2 : 1
  const close = slash ? '\\)' : '$'
  let end = state.src.indexOf(close, start + open)
  while (end > 0 && state.src[end - 1] === '\\' && !slash) end = state.src.indexOf(close, end + 1)
  if (end < 0) return false
  if (!silent) {
    const token = state.push('math_inline', 'math', 0)
    token.content = state.src.slice(start + open, end)
  }
  state.pos = end + close.length
  return true
})
md.block.ruler.before(
  'fence',
  'math_block',
  (state, start, end, silent) => {
    const pos = state.bMarks[start]! + state.tShift[start]!
    const line = state.src.slice(pos, state.eMarks[start]).trim()
    const open = line.startsWith('$$') ? '$$' : line.startsWith('\\[') ? '\\[' : ''
    if (!open) return false
    const close = open === '$$' ? '$$' : '\\]'
    let content = line.slice(2)
    let next = start + 1
    if (content.endsWith(close)) content = content.slice(0, -2)
    else {
      let closed = false
      for (; next < end; next++) {
        const part = state.src.slice(state.bMarks[next], state.eMarks[next])
        if (part.trimEnd().endsWith(close)) {
          content += '\n' + part.trimEnd().slice(0, -2)
          next++
          closed = true
          break
        }
        content += '\n' + part
      }
      if (!closed) return false
    }
    if (silent) return true
    const token = state.push('math_block', 'math', 0)
    token.content = content
    token.block = true
    state.line = next
    return true
  },
  { alt: ['paragraph', 'reference', 'blockquote', 'list'] },
)
for (const [name, displayMode] of [
  ['math_inline', false],
  ['math_block', true],
] as const) {
  md.renderer.rules[name] = (tokens, index) =>
    katex.renderToString(tokens[index]!.content, {
      displayMode,
      throwOnError: false,
      trust: false,
      strict: 'ignore',
    })
}
export function renderMarkdown(content: string) {
  return DOMPurify.sanitize(md.render(content), {
    ADD_TAGS: ['annotation'],
    ADD_ATTR: ['encoding'],
  })
}
