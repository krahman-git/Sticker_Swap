import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useUser } from '../App'
import { STICKER_MAP } from '../data/stickers'
import { getUserInventory, upsertStickerStatus } from '../lib/supabase'

// Same cycle logic as AlbumView
function nextState(current) {
  if (current === 0)  return -1
  if (current === -1) return 1
  if (current === 1)  return 2
  if (current === 2)  return 3
  return 0
}

function stateFromInventory(inv) {
  if (!inv) return 0
  if (inv.wants) return -1
  if (inv.duplicate_count > 0) return Math.min(inv.duplicate_count, 3)
  return 0
}

function StatusBadge({ state, onClick, saving }) {
  const configs = {
    '-1': { label: '❓ Need',    bg: 'bg-red-600 hover:bg-red-500',     text: 'text-white' },
    '0':  { label: '○ Not set', bg: 'bg-slate-600 hover:bg-slate-500',  text: 'text-slate-300' },
    '1':  { label: '+1 spare',  bg: 'bg-emerald-600 hover:bg-emerald-500', text: 'text-white' },
    '2':  { label: '+2 spare',  bg: 'bg-emerald-600 hover:bg-emerald-500', text: 'text-white' },
    '3':  { label: '3+ spare',  bg: 'bg-emerald-700 hover:bg-emerald-600', text: 'text-white' },
  }
  const cfg = configs[String(state)] ?? configs['0']

  return (
    <button
      onClick={onClick}
      disabled={saving}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${cfg.bg} ${cfg.text} ${saving ? 'opacity-50' : ''}`}
    >
      {saving ? '...' : cfg.label}
    </button>
  )
}

// Build a flat searchable array once (outside component, computed at module load)
const ALL_STICKERS = Object.values(STICKER_MAP)

export default function Search() {
  const { user } = useUser()
  const [query, setQuery]       = useState('')
  const [states, setStates]     = useState({})   // code → -1|0|1|2|3
  const [saving, setSaving]     = useState({})   // code → bool
  const [loadingInv, setLoadingInv] = useState(true)
  const inputRef  = useRef(null)
  const saveTimer = useRef({})

  // Load this user's inventory once on mount
  useEffect(() => {
    getUserInventory(user.id)
      .then(inv => {
        const s = {}
        for (const [code, data] of Object.entries(inv)) {
          s[code] = stateFromInventory(data)
        }
        setStates(s)
      })
      .catch(console.error)
      .finally(() => setLoadingInv(false))
  }, [user.id])

  // Autofocus input
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleClick = useCallback((code) => {
    setStates(prev => {
      const newState = nextState(prev[code] ?? 0)
      const wants = newState === -1
      const duplicate_count = newState > 0 ? newState : 0

      clearTimeout(saveTimer.current[code])
      saveTimer.current[code] = setTimeout(async () => {
        setSaving(s => ({ ...s, [code]: true }))
        try {
          await upsertStickerStatus(user.id, code, duplicate_count, wants)
        } catch (e) {
          console.error('Save failed', e)
        } finally {
          setSaving(s => ({ ...s, [code]: false }))
        }
      }, 800)

      return { ...prev, [code]: newState }
    })
  }, [user.id])

  // Filter stickers
  const q = query.trim().toLowerCase()
  const results = q.length === 0 ? [] : ALL_STICKERS.filter(s =>
    s.code.toLowerCase().includes(q) ||
    s.name.toLowerCase().includes(q) ||
    s.team.toLowerCase().includes(q) ||
    s.teamCode?.toLowerCase().includes(q)
  ).slice(0, 20)

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-1">Search Stickers</h1>
      <p className="text-slate-400 text-sm mb-5">
        Find any sticker by player name, team, or code. Tap the status to update it.
      </p>

      {/* Search input */}
      <div className="relative mb-6">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="e.g. Messi, Argentina, ARG7…"
          className="w-full bg-slate-800 text-white placeholder-slate-500 border border-slate-600 rounded-xl pl-11 pr-4 py-3.5 text-base focus:outline-none focus:border-emerald-500 transition-colors"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); inputRef.current?.focus() }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* Results */}
      {loadingInv ? (
        <div className="text-center py-12 text-slate-400">
          <div className="text-3xl mb-3 animate-spin">⚽</div>
          Loading your album…
        </div>
      ) : q.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <div className="text-5xl mb-3">🔍</div>
          <p>Start typing to find a sticker</p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <div className="text-5xl mb-3">😕</div>
          <p>No stickers match <span className="text-white">"{query}"</span></p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 mb-3">
            {results.length} result{results.length !== 1 ? 's' : ''}
            {ALL_STICKERS.filter(s =>
              s.code.toLowerCase().includes(q) ||
              s.name.toLowerCase().includes(q) ||
              s.team.toLowerCase().includes(q) ||
              s.teamCode?.toLowerCase().includes(q)
            ).length > 20 ? ' (showing first 20)' : ''}
          </p>
          {results.map(s => {
            const state = states[s.code] ?? 0
            return (
              <div
                key={s.code}
                className="flex items-center gap-4 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl px-4 py-3 transition-colors"
              >
                {/* Code chip */}
                <span className="font-mono text-sm text-emerald-400 bg-slate-900 rounded-lg px-2 py-1 min-w-[56px] text-center shrink-0">
                  {s.code}
                </span>

                {/* Name + team */}
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">
                    {s.foil ? '✨ ' : ''}{s.photo ? '📸 ' : ''}{s.name}
                  </div>
                  <div className="text-slate-400 text-xs">{s.team}</div>
                </div>

                {/* Status badge */}
                <StatusBadge
                  state={state}
                  onClick={() => handleClick(s.code)}
                  saving={saving[s.code]}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
