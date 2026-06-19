import React, { useState, useEffect, useCallback } from 'react'
import { useUser } from '../App'
import { getAllInventories, createSwapSession } from '../lib/supabase'
import { STICKER_MAP } from '../data/stickers'

// ── Allocation algorithm ──────────────────────────────────────────────────────
// For each sticker the sender has as a spare:
//   - Only one receiver wants it → auto-assign
//   - Multiple receivers want it, enough spares → assign to all
//   - Multiple receivers want it, not enough spares → contested:
//       balance totals first, randomize ties

function allocate(allInventories, senderId, receiverIds) {
  const byUser = {}
  for (const row of allInventories) {
    if (!byUser[row.user_id]) byUser[row.user_id] = { wants: new Set(), dupes: {} }
    if (row.wants) byUser[row.user_id].wants.add(row.sticker_code)
    if (row.duplicate_count > 0) byUser[row.user_id].dupes[row.sticker_code] = row.duplicate_count
  }

  const senderDupes = byUser[senderId]?.dupes ?? {}
  const alloc = {}
  const contested = new Set()
  for (const id of receiverIds) alloc[id] = []

  for (const [code, count] of Object.entries(senderDupes)) {
    const wanters = receiverIds.filter(id => byUser[id]?.wants.has(code))
    if (wanters.length === 0) continue

    if (count >= wanters.length) {
      // Enough spares for everyone who wants it
      for (const id of wanters) alloc[id].push(code)
    } else {
      // Contested — balance totals, randomize ties via shuffle
      contested.add(code)
      const shuffled = [...wanters].sort(() => Math.random() - 0.5)
      const sorted = shuffled.sort((a, b) => alloc[a].length - alloc[b].length)
      for (let i = 0; i < count; i++) {
        alloc[sorted[i % sorted.length]].push(code)
      }
    }
  }

  return { alloc, contested }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Pack() {
  const { user, allUsers } = useUser()
  const [inventories, setInventories]       = useState([])
  const [loading, setLoading]               = useState(true)
  const [selectedReceivers, setSelectedReceivers] = useState([])
  const [alloc, setAlloc]                   = useState({})
  const [contested, setContested]           = useState(new Set())
  const [confirmed, setConfirmed]           = useState({})  // receiverId → bool
  const [saving, setSaving]                 = useState({})  // receiverId → bool
  const [saveError, setSaveError]           = useState({})  // receiverId → string

  useEffect(() => {
    getAllInventories()
      .then(setInventories)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const otherUsers = allUsers.filter(u => u.id !== user.id)

  function toggleReceiver(id) {
    setSelectedReceivers(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
    // Reset confirmations when selection changes
    setConfirmed({})
    setSaveError({})
  }

  const runAlloc = useCallback(() => {
    if (selectedReceivers.length === 0) {
      setAlloc({})
      setContested(new Set())
      return
    }
    const result = allocate(inventories, user.id, selectedReceivers)
    setAlloc(result.alloc)
    setContested(result.contested)
  }, [selectedReceivers, inventories, user.id])

  useEffect(() => { runAlloc() }, [runAlloc])

  async function confirmSent(receiverId) {
    const stickers = alloc[receiverId] ?? []
    if (stickers.length === 0) return
    setSaving(s => ({ ...s, [receiverId]: true }))
    setSaveError(e => ({ ...e, [receiverId]: null }))
    try {
      await createSwapSession(user.id, receiverId, stickers)
      setConfirmed(c => ({ ...c, [receiverId]: true }))
    } catch {
      setSaveError(e => ({ ...e, [receiverId]: 'Failed to save. Try again.' }))
    } finally {
      setSaving(s => ({ ...s, [receiverId]: false }))
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <div className="text-4xl mb-4 animate-spin">⚽</div>
        Loading inventories…
      </div>
    )
  }

  const hasContested = contested.size > 0 && selectedReceivers.length > 1
  const allConfirmed = selectedReceivers.length > 0 && selectedReceivers.every(id => confirmed[id])

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-1">Pack Stickers</h1>
      <p className="text-slate-400 text-sm mb-6">
        Sending as <span className="text-emerald-400 font-medium">{user.name}</span>.
        Select who you're packing for, then confirm when the envelope is ready.
      </p>

      {/* Receiver selector */}
      <div className="mb-6">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Send to</p>
        <div className="flex flex-wrap gap-2">
          {otherUsers.map(u => {
            const sel = selectedReceivers.includes(u.id)
            return (
              <button
                key={u.id}
                onClick={() => toggleReceiver(u.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  sel ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {u.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Empty state */}
      {selectedReceivers.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <div className="text-5xl mb-3">📦</div>
          <p>Select who you're sending stickers to</p>
        </div>
      )}

      {/* All confirmed banner */}
      {allConfirmed && (
        <div className="bg-emerald-900/40 border border-emerald-700 rounded-xl px-4 py-3 mb-4 text-emerald-300 text-sm">
          ✓ All sends confirmed — Kazi will apply these to the database from the admin panel.
        </div>
      )}

      {/* Contested banner + re-roll */}
      {hasContested && !allConfirmed && (
        <div className="flex items-center justify-between bg-amber-900/40 border border-amber-700 rounded-xl px-4 py-3 mb-4">
          <p className="text-amber-300 text-sm">
            ⚡ <span className="font-medium">{contested.size}</span> sticker{contested.size !== 1 ? 's' : ''} randomly assigned between recipients
          </p>
          <button
            onClick={runAlloc}
            className="text-sm bg-amber-700 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors ml-4 shrink-0"
          >
            🎲 Re-roll
          </button>
        </div>
      )}

      {/* Per-receiver sections */}
      <div className="space-y-4">
        {selectedReceivers.map(receiverId => {
          const receiver   = allUsers.find(u => u.id === receiverId)
          const stickers   = alloc[receiverId] ?? []
          const isConfirmed = confirmed[receiverId]
          const isSaving   = saving[receiverId]
          const err        = saveError[receiverId]

          return (
            <div
              key={receiverId}
              className={`bg-slate-800 border rounded-xl overflow-hidden transition-colors ${
                isConfirmed ? 'border-emerald-700' : 'border-slate-700'
              }`}
            >
              {/* Section header */}
              <div className="bg-slate-700 px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-white font-semibold">→ {receiver?.name}</h2>
                  <p className="text-slate-400 text-xs">
                    {stickers.length} sticker{stickers.length !== 1 ? 's' : ''}
                  </p>
                </div>

                {isConfirmed ? (
                  <span className="text-emerald-400 text-sm font-medium shrink-0">✓ Confirmed</span>
                ) : (
                  <button
                    onClick={() => confirmSent(receiverId)}
                    disabled={isSaving || stickers.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
                  >
                    {isSaving ? '…' : 'Confirm Sent'}
                  </button>
                )}
              </div>

              {/* Body */}
              <div className="p-4">
                {isConfirmed && (
                  <div className="bg-emerald-900/30 border border-emerald-800 rounded-lg px-3 py-2 mb-3 text-emerald-300 text-sm">
                    Queued — waiting for Kazi to apply from admin panel.
                  </div>
                )}
                {err && (
                  <div className="bg-red-900/30 border border-red-800 rounded-lg px-3 py-2 mb-3 text-red-300 text-sm">
                    {err}
                  </div>
                )}

                {stickers.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-4">
                    No matches — {receiver?.name} doesn't need any of your spare stickers.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {stickers.map(code => {
                      const info = STICKER_MAP[code]
                      const isContested = contested.has(code)
                      return (
                        <div key={code} className="flex items-center gap-3 py-0.5">
                          <span className="font-mono text-xs text-emerald-400 bg-slate-900 rounded px-2 py-0.5 min-w-[56px] text-center shrink-0">
                            {code}
                          </span>
                          <span className="text-white text-sm flex-1 truncate">{info?.name ?? '—'}</span>
                          <span className="text-slate-500 text-xs shrink-0">{info?.team ?? '—'}</span>
                          {isContested && (
                            <span className="text-amber-400 text-xs shrink-0" title="Randomly assigned">⚡</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
