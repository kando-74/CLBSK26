import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { buildUserProfilePath } from '../utils/profileLinks'

export function UserLink({ name, className }: { name: string; className?: string }) {
  const trimmed = name.trim()

  if (!trimmed) {
    return <span className={clsx('text-text-secondary/70', className)}>Anónimo</span>
  }

  return (
    <Link
      to={buildUserProfilePath(trimmed)}
      className={clsx('text-primary transition-colors hover:text-primary/80', className)}
    >
      {trimmed}
    </Link>
  )
}
