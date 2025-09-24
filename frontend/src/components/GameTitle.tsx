import { clsx } from 'clsx'
import { resolveGameCover } from '../utils/gameCovers'
import type { HTMLAttributes, ReactNode } from 'react'

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
  const resolvedCover = resolveGameCover(name, coverUrl)
  const coverSizeClass = COVER_SIZES[size]
  const resolvedTextClass = textClassName ?? TEXT_DEFAULTS[size]

  return (
    <span className={clsx('inline-flex items-center gap-3', className)} {...rest}>
      <img
        src={resolvedCover}
        alt={`Portada de ${name}`}
        className={clsx('flex-shrink-0 rounded-xl object-cover shadow-sm', coverSizeClass, coverClassName)}
        loading="lazy"
      />
      <span className="flex flex-col gap-1">
        <span className={clsx('font-semibold text-text-primary', resolvedTextClass)}>{name}</span>
        {children}
      </span>
    </span>
  )
}
