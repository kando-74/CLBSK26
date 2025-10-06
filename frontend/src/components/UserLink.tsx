import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { buildUserProfilePath } from '../utils/profileLinks'
import type { Player } from '../services/plays'

export function UserLink({ player, className }: { player: Player; className?: string }) {
  const trimmedAlias = player.alias.trim()

  if (!trimmedAlias) {
    return <span className={clsx('text-text-secondary/70', className)}>Anónimo</span>
  }

  return (
    <Link
      to={buildUserProfilePath(player.uid)}
      className={clsx('text-primary transition-colors hover:text-primary/80', className)}
    >
      {trimmedAlias}
    </Link>
  )
}
