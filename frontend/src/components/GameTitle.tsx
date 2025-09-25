import { clsx } from 'clsx'
import { resolveGameCover } from '../utils/gameCovers'
import { useId, type HTMLAttributes, type ReactNode } from 'react'

type GameTitleSize = 'sm' | 'md' | 'lg'

const COVER_SIZES: Record<GameTitleSize, string> = {
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-20 w-20',
}

const TEXT_DEFAULTS: Record<GameTitleSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
}

interface GameTitleProps extends HTMLAttributes<HTMLSpanElement> {
  name: string
  coverUrl?: string
  size?: GameTitleSize
  textClassName?: string
  coverClassName?: string
  children?: ReactNode
}

export function GameTitle({
  name,
  coverUrl,
  size = 'md',
  className,
  textClassName,
  coverClassName,
  children,
  ...rest
}: GameTitleProps) {
  const generatedLabelId = useId()
  const { 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, ...spanProps } = rest
  const shouldGenerateLabel = !ariaLabel && !ariaLabelledBy
  const labelledByProps = ariaLabelledBy
    ? { 'aria-labelledby': ariaLabelledBy }
    : shouldGenerateLabel
      ? { 'aria-labelledby': generatedLabelId }
      : {}

  const resolvedCover = resolveGameCover(name, coverUrl)
  const coverSizeClass = COVER_SIZES[size]
  const resolvedTextClass = textClassName ?? TEXT_DEFAULTS[size]

  return (
    <span
      className={clsx('inline-flex items-center gap-3', className)}
      aria-label={ariaLabel}
      {...labelledByProps}
      {...spanProps}
    >
      <img
        src={resolvedCover}
        alt={`Portada de ${name}`}
        className={clsx('flex-shrink-0 rounded-xl object-cover shadow-sm', coverSizeClass, coverClassName)}
        loading="lazy"
      />
      <span className="flex flex-col gap-1">
        <span
          className={clsx('font-semibold text-text-primary', resolvedTextClass)}
          id={shouldGenerateLabel ? generatedLabelId : undefined}
        >
          {name}
        </span>
        {children}
      </span>
    </span>
  )
}
