import 'katex/dist/katex.min.css'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

interface MarkdownRendererProps {
  className?: string
  content: string
}

export function MarkdownRenderer({ className, content }: MarkdownRendererProps) {
  return (
    <div
      className={[
        'space-y-4 break-words text-sm leading-7 text-ink [&_a]:font-semibold [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:rounded-control [&_blockquote]:bg-surface-subtle [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-surface-subtle [&_code]:px-1 [&_code]:py-0.5 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:leading-tight [&_h2]:text-xl [&_h2]:font-bold [&_h2]:leading-tight [&_h3]:text-lg [&_h3]:font-bold [&_h3]:leading-tight [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-control [&_pre]:bg-ink [&_pre]:p-4 [&_pre]:text-surface [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:bg-surface-subtle [&_th]:p-2 [&_ul]:list-disc [&_ul]:pl-5 [&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <ReactMarkdown
        rehypePlugins={[rehypeSanitize, rehypeKatex]}
        remarkPlugins={[remarkGfm, remarkMath]}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
