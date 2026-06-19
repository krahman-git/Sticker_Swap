import React, { useState, useEffect } from 'react'
import { useUser } from '../App'
import { getPendingSessions, applySwapSession } from '../lib/supabase'
import { STICKER_MAP } from '../data/stickers'

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD

// ── Password gate ─────────────────────────────────────────────────────────────

function PasswordGate({ onAuth }) {
  const [pw, setPw]       = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem('adminAuth', 'true')
      onAuth()
    } else {
      setError(true)
      setPw('')
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-2xl font-bold text-white mb-1">Admin Panel</h1>
          <p className="text-slate-400 text-sm">Group swap session manager</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={pw}
            onChange={e => { setPw(e.target.value); setError(false) }}
            placeholder="Password"
            autoFocus
            className={`w-full bg-slate-800 text-white border rounded-xl px-4 py-3 focus:outline-none transition-colors ${
              error
                ? 'border-red-500 focus:border-red-400'
                : 'border-slate-600 focus:border-emerald-500'
            }`}
          />
          {error && (
            <p className="text-red-400 text-sm text-center">Wrong password</p>
          )}
          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-xl transition-colors"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Session card ──────────────────────────────────────────────────────────────

function SessionCard({ session, userMap, onApply }) {
  const [expanded, setExpanded]   = useState(false)
  const [applying, setApplying]   = useState(false)
  const [applied, setApplied]     = useState(false)
  const [error, setError]         = useState(null)

  const senderName   = userMap[session.sender_id]   ?? 'Unknown'
  const receiverName = userMap[session.receiver_id] ?? 'Unknown'
  const codes        = session.sticker_codes ?? []
  const when         = new Date(session.created_at).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  async function handleApply() {
    setApplying(true)
    setError(null)
    try {
      await applySwapSession(session)
      setApplied(true)
      setTimeout(() => onApply(session.id), 1200)
    } catch (e) {
      console.error(e)
      setError('Failed — check console and try again.')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className={`bg-slate-800 border rounded-xl overflow-hidden transition-colors ${
      applied ? 'border-emerald-700' : 'border-slate-700'
    }`}>
      {/* Header row */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-white font-medium">
            <span className="text-emerald-400">{senderName}</span>
            <span className="text-slate-400 mx-2">→</span>
            <span className="text-blue-400">{receiverName}</span>
            <span className="text-slate-400 ml-2 font-normal text-sm">
              · {codes.length} sticker{codes.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="text-slate-500 text-xs mt-0.5">{when}</div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-slate-400 hover:text-white text-sm px-2 shrink-0"
        >
          {expanded ? '▲' : '▼'}
        </button>

        {/* Apply / applied */}
        {applied ? (
          <span className="text-emerald-400 text-sm font-medium shrink-0">✓ Applied</span>
        ) : (
          <button
            onClick={handleApply}
            disabled={applying}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            {applying ? 'Applying…' : 'Apply'}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 pb-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Sticker list (expandable) */}
      {expanded && (
        <div className="border-t border-slate-700 px-4 py-3">
          <div className="space-y-1">
            {codes.map(code => {
              const info = STICKER_MAP[code]
              return (
                <div key={code} className="flex items-center gap-3 py-0.5">
                  <span className="font-mono text-xs text-emerald-400 bg-slate-900 rounded px-2 py-0.5 min-w-[56px] text-center shrink-0">
                    {code}
                  </span>
                  <span className="text-white text-sm flex-1 truncate">{info?.name ?? '—'}</span>
                  <span className="text-slate-500 text-xs shrink-0">{info?.team ?? '—'}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Admin() {
  const { allUsers }  = useUser()
  const [authed, setAuthed]     = useState(() => sessionStorage.getItem('adminAuth') === 'true')
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(false)

  const userMap = Object.fromEntries(allUsers.map(u => [u.id, u.name]))

  useEffect(() => {
    if (!authed) return
    setLoading(true)
    getPendingSessions()
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [authed])

  function handleSessionApplied(id) {
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  function handleLock() {
    sessionStorage.removeItem('adminAuth')
    setAuthed(false)
  }

  if (!authed) return <PasswordGate onAuth={() => setAuthed(true)} />

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Admin — Swap Sessions</h1>
          <p className="text-slate-400 text-sm">
            Apply confirmed sends to update everyone's albums.
          </p>
        </div>
        <button
          onClick={handleLock}
          className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
        >
          Lock 🔒
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center py-24 text-slate-400">
          <div className="text-4xl mb-4 animate-spin">⚽</div>
          Loading sessions…
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <div className="text-5xl mb-3">✅</div>
          <p>No pending sessions — all caught up!</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 mb-1">
            {sessions.length} pending session{sessions.length !== 1 ? 's' : ''}
          </p>
          {sessions.map(session => (
            <SessionCard
              key={session.id}
              session={session}
              userMap={userMap}
              onApply={handleSessionApplied}
            />
          ))}
        </div>
      )}
    </div>
  )
}
