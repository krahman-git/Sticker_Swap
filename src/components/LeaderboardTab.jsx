import React, { useState, useEffect } from 'react'
import { getAllInventories, getAllUsers } from '../lib/supabase'

const TOTAL = 992
const EXCLUDED_NAMES = ['hao', 'michelle']

const RANK_META = [
  { emoji: '🥇', label: 'Gold',   color: '#f59e0b', glow: '#f59e0b33', border: '#f59e0b55', bg: 'linear-gradient(135deg, #1e293b 0%, #1a2d1a 100%)' },
  { emoji: '🥈', label: 'Silver', color: '#94a3b8', glow: null,         border: '#334155',   bg: '#1e293b' },
  { emoji: '🥉', label: 'Bronze', color: '#a16207', glow: null,         border: '#334155',   bg: '#1e293b' },
]

function ProgressBar({ pct, color }) {
  return (
    <div className="w-full h-3 rounded-full bg-slate-700 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${(pct * 100).toFixed(1)}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }}
      />
    </div>
  )
}

export default function LeaderboardTab() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const [inventories, users] = await Promise.all([getAllInventories(), getAllUsers()])

      // Count wants=true rows per user
      const wantsCount = {}
      for (const row of inventories) {
        if (row.wants) {
          wantsCount[row.user_id] = (wantsCount[row.user_id] ?? 0) + 1
        }
      }

      // collected = 992 - wants_count (stickers not marked as want)
      const ranked = users
        .filter(u => !EXCLUDED_NAMES.includes(u.name.toLowerCase()))
        .map(u => ({
          id: u.id,
          name: u.name,
          collected: TOTAL - (wantsCount[u.id] ?? 0),
        }))
        .sort((a, b) => b.collected - a.collected)

      setPlayers(ranked)
      setRefreshedAt(new Date())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <div className="text-4xl mb-4 animate-spin">⚽</div>
        Loading leaderboard…
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Album Leaderboard</h1>
          <p className="text-slate-400 text-sm">
            Stickers collected out of {TOTAL.toLocaleString()}
            {refreshedAt && (
              <span className="ml-2 text-slate-600">· updated {refreshedAt.toLocaleTimeString()}</span>
            )}
          </p>
        </div>
        <button
          onClick={load}
          className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      <div className="space-y-3">
        {players.map((player, i) => {
          const meta = RANK_META[i] ?? { emoji: `#${i + 1}`, label: '', color: '#64748b', glow: null, border: '#334155', bg: '#1e293b' }
          const pct = player.collected / TOTAL

          return (
            <div
              key={player.id}
              className="rounded-xl p-5"
              style={{
                background: meta.bg,
                border: `1.5px solid ${meta.border}`,
                boxShadow: meta.glow ? `0 0 32px ${meta.glow}` : 'none',
              }}
            >
              <div className="flex items-center gap-4 mb-3">
                {/* Rank */}
                <span className="text-3xl leading-none w-10 text-center shrink-0">{meta.emoji}</span>

                {/* Name */}
                <span
                  className="flex-1 font-bold text-xl leading-none"
                  style={{ color: i === 0 ? meta.color : '#f1f5f9' }}
                >
                  {player.name}
                </span>

                {/* Stats */}
                <div className="text-right shrink-0">
                  <div className="font-bold text-xl leading-none" style={{ color: meta.color }}>
                    {player.collected.toLocaleString()}
                  </div>
                  <div className="text-slate-400 text-sm mt-1">{(pct * 100).toFixed(1)}%</div>
                </div>
              </div>

              <ProgressBar pct={pct} color={meta.color} />
            </div>
          )
        })}
      </div>

      <p className="text-center text-slate-600 text-xs mt-6">
        Collected = total stickers − wants · {TOTAL} total in album
      </p>
    </div>
  )
}
