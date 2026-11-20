import { useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

/** Official chat.deepseek.com button (`ds-button` in main.dc093a796f.css). */
export type DsButtonVariant = 'outlined' | 'primary' | 'danger'
export type DsButtonSize = 'xs' | 's' | 'm' | 'l' | 'xl'

const TONE: Record<DsButtonVariant, string> = {
  outlined: 'ds-button--outlined ds-button--outlinedNeutral',
  primary: 'ds-button--filled ds-button--primary',
  danger: 'ds-button--outlined ds-button--error',
}

type DsButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: DsButtonVariant
  size?: DsButtonSize
}

export const DsButton = ({ variant = 'outlined', size = 'm', className, children, type = 'button', ...rest }: DsButtonProps) => (
  <button
    type={type}
    className={['ds-button', `ds-button--${size}`, 'ds-button--min-width', TONE[variant], className].filter(Boolean).join(' ')}
    {...rest}
  >
    <span className="ds-button__background" aria-hidden="true" />
    {variant === 'primary' ? null : <span className="ds-button__border" aria-hidden="true" />}
    <span className="ds-button__content">{children}</span>
  </button>
)

/** Hidden file input plus a real button. The button is the visible control. */
export const DsFileButton = ({
  accept,
  testId,
  children,
  onFile,
}: {
  accept?: string
  testId?: string
  children: ReactNode
  onFile: (file: File) => void
}) => {
  const input = useRef<HTMLInputElement>(null)
  return (
    <span className="ds-file">
      <input
        ref={input}
        className="ds-file-input"
        data-testid={testId}
        type="file"
        accept={accept}
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onFile(file)
        }}
      />
      <DsButton type="button" onClick={() => input.current?.click()}>{children}</DsButton>
    </span>
  )
}
