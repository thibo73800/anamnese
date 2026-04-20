import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

type Props = {
  children: string
  className?: string
}

export function Markdown({ children, className }: Props) {
  return (
    <div
      className={cn(
        'space-y-3 leading-relaxed text-foreground/90',
        '[&_p]:leading-relaxed',
        '[&_strong]:font-semibold [&_strong]:text-foreground',
        '[&_em]:italic',
        '[&_ul]:ml-4 [&_ul]:list-disc [&_ul]:space-y-1',
        '[&_ol]:ml-4 [&_ol]:list-decimal [&_ol]:space-y-1',
        '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
        '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm',
        '[&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
        '[&_h1]:text-lg [&_h1]:font-semibold',
        '[&_h2]:text-base [&_h2]:font-semibold',
        '[&_h3]:text-sm [&_h3]:font-semibold',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}
