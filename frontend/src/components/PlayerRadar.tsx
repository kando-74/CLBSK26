import React, { useState, useMemo } from 'react'
import { MessageSquare, ToggleLeft, ToggleRight, User } from 'lucide-react'
import { useUsers, updateUserStatus, type UserProfile } from '../services/users'
import { useAuth } from './AuthProvider'
import { useTablesService } from '../services/tables'

export const PlayerRadar: React.FC = () => {
    const { users, loading } = useUsers()
    const { tables } = useTablesService()
    const { user } = useAuth()

    const [updating, setUpdating] = useState(false)
    const [myNote, setMyNote] = useState('')
    const [editingNote, setEditingNote] = useState(false)

    // Helper to find if a user is currently in a game
    const busyPlayerUids = useMemo(() => {
        const uids = new Set<string>()
        tables
            .filter(t => t.status === 'in-progress')
            .forEach(t => {
                t.currentPlayers.forEach(p => {
                    if (p.uid) uids.add(p.uid)
                })
            })
        return uids
    }, [tables])

    const availablePlayers = useMemo(() => {
        return users.filter((u: UserProfile) => {
            // Is busy?
            if (busyPlayerUids.has(u.uid)) return false

            // Manual mode check
            if (u.radarMode === 'manual') {
                return u.availableToPlay
            }

            // Auto mode check: always available if NOT busy
            return true
        })
    }, [users, busyPlayerUids])

    const myProfile = useMemo(() => {
        if (!user) return null
        return users.find(u => u.uid === user.uid)
    }, [users, user])

    const isAvailable = myProfile?.availableToPlay ?? false
    const currentNote = myProfile?.availabilityNote

    async function handleToggleAvailability() {
        if (!user) return
        setUpdating(true)
        try {
            // Toggle opposite of current state
            await updateUserStatus(user.uid, !isAvailable, currentNote)
        } finally {
            setUpdating(false)
        }
    }

    async function handleSaveNote() {
        if (!user) return
        setUpdating(true)
        try {
            await updateUserStatus(user.uid, true, myNote) // Saving note implies availability usually, or we keep current
            setEditingNote(false)
        } finally {
            setUpdating(false)
        }
    }

    if (loading) return null

    return (
        <div className="space-y-6">
            {/* My Status Control */}
            {user && (
                <div className="card p-4 bg-surface-elevation-1 border-primary/10">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <h3 className="font-semibold text-text-primary flex items-center gap-2">
                                <div
                                    className={`w-2.5 h-2.5 rounded-full ${isAvailable ? 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-text-disabled'}`}
                                />
                                Mi Estado: {isAvailable ? 'Disponible' : 'No disponible'}
                            </h3>

                            {!editingNote ? (
                                <div className="mt-2">
                                    {isAvailable && currentNote ? (
                                        <p className="text-sm text-text-primary italic">"{currentNote}"</p>
                                    ) : (
                                        <p className="text-sm text-text-secondary">
                                            {isAvailable ? 'Sin nota visible.' : 'No apareces en el radar.'}
                                        </p>
                                    )}

                                    {isAvailable && (
                                        <button
                                            onClick={() => {
                                                setMyNote(currentNote || '')
                                                setEditingNote(true)
                                            }}
                                            className="text-xs text-primary font-medium mt-1 hover:underline"
                                        >
                                            {currentNote ? 'Editar nota' : 'Añadir nota'}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="mt-2 flex gap-2">
                                    <input
                                        value={myNote}
                                        onChange={e => setMyNote(e.target.value)}
                                        placeholder="Ej. Busco partida de Ark Nova..."
                                        className="flex-1 text-sm bg-background/50 border border-primary/20 rounded-lg px-3 py-1 outline-none focus:border-primary"
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleSaveNote}
                                        disabled={updating}
                                        className="text-xs bg-primary text-white px-3 py-1 rounded-lg font-medium"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleToggleAvailability}
                            disabled={updating}
                            className={`transform transition-all active:scale-95 ${updating ? 'opacity-50' : ''}`}
                        >
                            {isAvailable ? (
                                <ToggleRight className="w-10 h-10 text-success" />
                            ) : (
                                <ToggleLeft className="w-10 h-10 text-text-disabled" />
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Radar List */}
            <div>
                <h3 className="section-title text-base mb-3 flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
                    </span>
                    Radar de Jugones ({availablePlayers.length})
                </h3>

                {availablePlayers.length === 0 ? (
                    <div className="text-center p-8 border-2 border-dashed border-text-disabled/20 rounded-xl">
                        <p className="text-text-secondary">No hay nadie buscando partida activamente ahora mismo.</p>
                        <p className="text-sm text-text-secondary/60 mt-1">¡Sé el primero!</p>
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        {availablePlayers.map((player: UserProfile) => (
                            <div key={player.uid} className="group card p-3 flex items-start gap-3 hover:border-primary/30 transition-colors">
                                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-surface-elevation-2 flex items-center justify-center border border-white/10">
                                    {player.avatarUrl ? (
                                        <img src={player.avatarUrl} alt={player.alias} className="h-full w-full object-cover" />
                                    ) : (
                                        <User className="h-5 w-5 text-text-secondary" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-semibold text-text-primary truncate">{player.alias}</h4>
                                        {/* Potential future feature: Invite button */}
                                    </div>
                                    {player.availabilityNote && (
                                        <div className="mt-1 flex items-start gap-1.5">
                                            <MessageSquare className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                                            <p className="text-sm text-text-secondary leading-snug line-clamp-2 italic">
                                                {player.availabilityNote}
                                            </p>
                                        </div>
                                    )}
                                    {player.interestTags && player.interestTags.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {player.interestTags.map((tag, i) => (
                                                <span key={i} className="text-[10px] px-2 py-0.5 bg-secondary/10 border border-secondary/20 rounded-full text-secondary font-medium capitalize">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {player.playStyleTags && player.playStyleTags.length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {player.playStyleTags.slice(0, 2).map((tag, i) => (
                                                <span key={i} className="text-[10px] px-1.5 py-0.5 bg-surface-elevation-2 rounded text-text-secondary">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
