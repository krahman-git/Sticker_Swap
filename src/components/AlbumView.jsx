import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useUser } from '../App'
import TEAMS, { INTRO_STICKERS } from '../data/stickers'
import { getUserInventory, upsertStickerStatus } from '../lib/supabase'

// Sticker state cycle: 0=neutral, -1=want, 1=1 spare, 2=2 spare, 3=3 spare+
function nextState(current) {
  if (current === 0) return -1   // neutral → want
  if (current === -1) return 1   // want → 1 spare
  if (current === 1) return 2    // 1 spare → 2 spare
  if (current === 2) return 3    // 2 spare → 3+ spare
  return 0                        // 3+ → neutral
}

function stateFromInventory(inv) {
  if (!inv) return 0
  if (inv.wants) return -1
  if (inv.duplicate_count > 0) return Math.min(inv.duplicate_count, 3)
  return 0
}

function inventoryFromState(state) {
  if (state === -1) return { wants: true, duplicate_count: 0 }
  if (state === 0)  return { wants: false, duplicate_count: 0 }
  return { wants: false, duplicate_count: state }
}

function StickerCard({ code, name, foil, photo, state, onClick, saving }) {
  const bgClass =
    state === -1 ? 'bg-red-900 border-red-500 ring-1 ring-red-500' :
    state >= 1   ? 'bg-emerald-900 border-emerald-500 ring-1 ring-emerald-500' :
                   'bg-slate-800 border-slate-600 hover:border-slate-400'

  const badge =
    state === -1 ? <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">?</span> :
    state === 1  ? <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">+1</span> :
    state === 2  ? <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">+2</span> :
    state === 3  ? <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">3+</span> :
    null

  return (
    <button
      onClick={onClick}
      disabled={saving}
      className={`relative border rounded-lg p-2 text-left transition-all cursor-pointer select-none ${bgClass} ${saving ? 'opacity-60' : ''}`}
    >
      {badge}
      <div className="text-xs text-slate-400 font-mono mb-0.5">{code}</div>
      <div className={`text-xs font-medium leading-tight ${state === -1 ? 'text-red-200' : state >= 1 ? 'text-emerald-200' : 'text-slate-300'}`}>
        {foil ? '✨ ' : ''}{photo ? '📸 ' : ''}{name}
      </div>
    </button>
  )
}

export default function AlbumView() {
  const { user } = useUser()
  const [inventory, setInventory] = useState({})  // code -> { wants, duplicate_count }
  const [states, setStates] = useState({})         // code -> -1|0|1|2|3
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})          // code -> bool
  const [selectedTeam, setSelectedTeam] = useState('ALL')
  const [filter, setFilter] = useState('ALL')       // ALL | WANT | HAVE
  const [search, setSearch] = useState('')
  const [stats, setStats] = useState({ wants: 0, dupes: 0 })

  // Queue for debounced saves
  const saveQueue = useRef({})
  const saveTimer = useRef({})

  useEffect(() => {
    setLoading(true)
    getUserInventory(user.id)
      .then(inv => {
        setInventory(inv)
        const s = {}
        for (const [code, data] of Object.entries(inv)) {
          s[code] = stateFromInventory(data)
        }
        setStates(s)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user.id])

  // Recalculate stats
  useEffect(() => {
    let wants = 0, dupes = 0
    for (const v of Object.values(states)) {
      if (v === -1) wants++
      else if (v >= 1) dupes++
    }
    setStats({ wants, dupes })
  }, [states])

  const handleClick = useCallback((code) => {
    setStates(prev => {
      const newState = nextState(prev[code] ?? 0)
      const { wants, duplicate_count } = inventoryFromState(newState)

      // Debounce DB writes: wait 800ms after last click on same code
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

  // Build team list for dropdown
  const teamOptions = ['ALL', 'INTRO', ...TEAMS.map(t => t.code)]

  // Build sticker list to show
  let allStickerGroups = []
  if (selectedTeam === 'ALL' || selectedTeam === 'INTRO') {
    allStickerGroups.push({
      label: 'Intro / Special',
      code: 'INTRO',
      stickers: INTRO_STICKERS.map(s => ({ code: s.code, name: s.name, foil: s.foil }))
    })
  }
  for (const team of TEAMS) {
    if (selectedTeam === 'ALL' || selectedTeam === team.code) {
      allStickerGroups.push({
        label: `${team.name} (${team.code})`,
        code: team.code,
        stickers: team.stickers.map(s => ({
          code: `${team.code}${s.n}`,
          name: s.name,
          foil: s.foil,
          photo: s.photo,
        }))
      })
    }
  }

  // Apply filter and search
  allStickerGroups = allStickerGroups.map(group => ({
    ...group,
    stickers: group.stickers.filter(s => {
      const st = states[s.code] ?? 0
      if (filter === 'WANT' && st !== -1) return false
      if (filter === 'HAVE' && st < 1) return false
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.code.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  })).filter(g => g.stickers.length > 0)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <div className="text-4xl mb-4 animate-spin">⚽</div>
        Loading your album...
      </div>
    )
  }

  return (
    <div>
      {/* Stats bar */}
      <div className="flex gap-4 mb-5 p-4 bg-slate-800 rounded-xl">
        <div className="flex-1 text-center">
          <div className="text-2xl font-bold text-red-400">{stats.wants}</div>
          <div className="text-xs text-slate-400">Stickers I need</div>
        </div>
        <div className="w-px bg-slate-700" />
        <div className="flex-1 text-center">
          <div className="text-2xl font-bold text-emerald-400">{stats.dupes}</div>
          <div className="text-xs text-slate-400">Duplicates to swap</div>
        </div>
        <div className="w-px bg-slate-700" />
        <div className="flex-1 text-center">
          <div className="text-2xl font-bold text-white">{980 - stats.wants}</div>
          <div className="text-xs text-slate-400">/ 980 total</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mb-4 text-xs flex-wrap">
        <span className="text-slate-400">Click a sticker to cycle:</span>
        <span className="text-slate-400">○ Neutral</span>
        <span className="text-red-400">→ ❓ Need it</span>
        <span className="text-emerald-400">→ +1 spare → +2 → 3+</span>
        <span className="text-slate-400">→ back to neutral</span>
      </div>

      {/* Controls */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {/* Team selector */}
        <select
          value={selectedTeam}
          onChange={e => setSelectedTeam(e.target.value)}
          className="bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-emerald-500"
        >
          {teamOptions.map(code => {
            const team = TEAMS.find(t => t.code === code)
            return (
              <option key={code} value={code}>
                {code === 'ALL' ? 'All Teams' : code === 'INTRO' ? 'Intro / Special' : `${team?.name} (${code})`}
              </option>
            )
          })}
        </select>

        {/* Filter buttons */}
        {['ALL', 'WANT', 'HAVE'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? f === 'WANT' ? 'bg-red-600 text-white' : f === 'HAVE' ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {f === 'ALL' ? 'Show All' : f === 'WANT' ? '❓ Need' : '✅ Have spare'}
          </button>
        ))}

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search player..."
          className="bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-emerald-500 flex-1 min-w-32"
        />
      </div>

      {/* Sticker groups */}
      {allStickerGroups.length === 0 ? (
        <div className="text-center text-slate-400 py-16">No stickers match this filter.</div>
      ) : (
        allStickerGroups.map(group => (
          <div key={group.code} className="mb-6">
            <h2 className="text-white font-semibold text-sm mb-2 uppercase tracking-wide border-b border-slate-700 pb-1">
              {group.label}
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
              {group.stickers.map(s => (
                <StickerCard
                  key={s.code}
                  code={s.code}
                  name={s.name}
                  foil={s.foil}
                  photo={s.photo}
                  state={states[s.code] ?? 0}
                  onClick={() => handleClick(s.code)}
                  saving={saving[s.code]}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
