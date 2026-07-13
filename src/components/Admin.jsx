import React, { useState, useEffect } from 'react'
import { useUser } from '../App'
import { getPendingSessions, applySwapSession, deleteSwapSession, getAppliedSessions, revertSwapSession } from '../lib/supabase'
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

function SessionCard({ session, userMap, onApply, onDelete }) {
  const [expanded, setExpanded]   = useState(false)
  const [applying, setApplying]   = useState(false)
  const [applied, setApplied]     = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError]         = useState(null)

  const senderName   = userMap[session.sender_id]   ?? 'Unknown'
  const receiverName = userMap[session.receiver_id] ?? 'Unknown'
  const codes        = session.sticker_codes ?? []
  const when         = new Date(session.created_at).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteSwapSession(session.id)
      onDelete(session.id)
    } catch (e) {
      console.error(e)
      setError('Delete failed — try again.')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

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

        {/* Apply / applied / delete */}
        {applied ? (
          <span className="text-emerald-400 text-sm font-medium shrink-0">✓ Applied</span>
        ) : confirmDelete ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-slate-400 text-xs">Sure?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            >
              {deleting ? '…' : 'Yes, delete'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-slate-400 hover:text-white text-xs px-2 py-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-slate-500 hover:text-red-400 text-sm px-2 py-2 transition-colors"
              title="Delete session"
            >
              🗑
            </button>
            <button
              onClick={handleApply}
              disabled={applying}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {applying ? 'Applying…' : 'Apply'}
            </button>
          </div>
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

// ── History card (applied sessions with revert) ───────────────────────────────

function HistoryCard({ session, userMap, onReverted }) {
  const [expanded, setExpanded]     = useState(false)
  const [confirm, setConfirm]       = useState(false)
  const [acting, setActing]         = useState(false)
  const [localStatus, setLocalStatus] = useState(session.status) // 'applied' | 'reverted'
  const [error, setError]           = useState(null)

  const isReverted = localStatus === 'reverted'

  const senderName   = userMap[session.sender_id]   ?? 'Unknown'
  const receiverName = userMap[session.receiver_id] ?? 'Unknown'
  const codes        = session.sticker_codes ?? []
  const when = new Date(session.applied_at ?? session.created_at).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  async function handleAction() {
    setActing(true)
    setError(null)
    try {
      if (isReverted) {
        // Re-apply: use the existing applySwapSession logic
        await applySwapSession({ ...session, status: 'reverted' })
        setLocalStatus('applied')
      } else {
        await revertSwapSession(session)
        setLocalStatus('reverted')
      }
      setConfirm(false)
    } catch (e) {
      console.error(e)
      setError(`${isReverted ? 'Re-apply' : 'Revert'} failed — check console.`)
    } finally {
      setActing(false)
    }
  }

  const borderColor = isReverted ? 'border-amber-800' : 'border-slate-700'
  const actionLabel = isReverted ? '↺ Re-apply' : '↩ Revert'
  const confirmText = isReverted ? 'Re-apply this?' : 'Undo this?'
  const confirmBtnClass = isReverted
    ? 'bg-emerald-600 hover:bg-emerald-500'
    : 'bg-amber-600 hover:bg-amber-500'
  const confirmBtnLabel = isReverted
    ? (acting ? '…' : 'Yes, re-apply')
    : (acting ? '…' : 'Yes, revert')

  return (
    <div className={`bg-slate-800 border rounded-xl overflow-hidden transition-colors ${borderColor}`}>
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-white font-medium flex items-center flex-wrap gap-1">
            <span className="text-emerald-400">{senderName}</span>
            <span className="text-slate-400 mx-1">→</span>
            <span className="text-blue-400">{receiverName}</span>
            <span className="text-slate-400 font-normal text-sm">
              · {codes.length} sticker{codes.length !== 1 ? 's' : ''}
            </span>
            {isReverted && (
              <span className="text-amber-500 text-xs font-medium bg-amber-900/30 px-2 py-0.5 rounded-full">
                reverted
              </span>
            )}
          </div>
          <div className="text-slate-500 text-xs mt-0.5">{when}</div>
        </div>

        <button
          onClick={() => setExpanded(e => !e)}
          className="text-slate-400 hover:text-white text-sm px-2 shrink-0"
        >
          {expanded ? '▲' : '▼'}
        </button>

        {confirm ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-slate-400 text-xs">{confirmText}</span>
            <button
              onClick={handleAction}
              disabled={acting}
              className={`${confirmBtnClass} disabled:opacity-40 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors`}
            >
              {confirmBtnLabel}
            </button>
            <button
              onClick={() => setConfirm(false)}
              className="text-slate-400 hover:text-white text-xs px-2 py-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors shrink-0 ${
              isReverted
                ? 'bg-slate-700 hover:bg-emerald-700 text-slate-300 hover:text-white'
                : 'bg-slate-700 hover:bg-amber-700 text-slate-300 hover:text-white'
            }`}
          >
            {actionLabel}
          </button>
        )}
      </div>

      {error && (
        <div className="px-4 pb-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

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
  const { allUsers }    = useUser()
  const [authed, setAuthed]       = useState(() => sessionStorage.getItem('adminAuth') === 'true')
  const [sessions, setSessions]   = useState([])
  const [history, setHistory]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [historyFilter, setHistoryFilter] = useState('')
  const [showHistory, setShowHistory]     = useState(false)

  const userMap = Object.fromEntries(allUsers.map(u => [u.id, u.name]))

  useEffect(() => {
    if (!authed) return
    setLoading(true)
    Promise.all([getPendingSessions(), getAppliedSessions()])
      .then(([pending, applied]) => {
        setSessions(pending)
        setHistory(applied)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [authed])

  function handleSessionApplied(id) {
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  function handleReverted(id) {
    setHistory(prev => prev.filter(s => s.id !== id))
  }

  function handleLock() {
    sessionStorage.removeItem('adminAuth')
    setAuthed(false)
  }

  const filteredHistory = historyFilter.trim()
    ? history.filter(s => {
        const q = historyFilter.toLowerCase()
        return (
          (userMap[s.sender_id]   ?? '').toLowerCase().includes(q) ||
          (userMap[s.receiver_id] ?? '').toLowerCase().includes(q)
        )
      })
    : history

  if (!authed) return <PasswordGate onAuth={() => setAuthed(true)} />

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Admin — Swap Sessions</h1>
          <p className="text-slate-400 text-sm">Apply confirmed sends or revert past ones.</p>
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
      ) : (
        <>
          {/* ── Pending ── */}
          <div className="mb-8">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-3">
              Pending · {sessions.length}
            </p>
            {sessions.length === 0 ? (
              <div className="text-center py-10 text-slate-500 border border-dashed border-slate-700 rounded-xl">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-sm">No pending sessions — all caught up!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map(session => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    userMap={userMap}
                    onApply={handleSessionApplied}
                    onDelete={handleSessionApplied}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── History ── */}
          <div>
            <button
              onClick={() => setShowHistory(h => !h)}
              className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium uppercase tracking-wide transition-colors mb-3"
            >
              <span className={`transition-transform ${showHistory ? 'rotate-90' : ''}`}>▶</span>
              History · {history.length} session{history.length !== 1 ? 's' : ''}
            </button>

            {showHistory && (
              <>
                <input
                  type="text"
                  value={historyFilter}
                  onChange={e => setHistoryFilter(e.target.value)}
                  placeholder="Filter by name (e.g. EeWah, Kazi)…"
                  className="w-full bg-slate-800 text-white placeholder-slate-500 border border-slate-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 mb-3"
                />
                {filteredHistory.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    No sessions match "{historyFilter}"
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredHistory.map(session => (
                      <HistoryCard
                        key={session.id}
                        session={session}
                        userMap={userMap}
                        onReverted={handleReverted}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
