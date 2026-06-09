import React, { useState, useEffect } from 'react'
import { useUser } from '../App'
import { getAllInventories } from '../lib/supabase'
import { STICKER_MAP } from '../data/stickers'

export default function SwapBoard() {
  const { user, allUsers } = useUser()
  const [inventories, setInventories] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('who-has')  // 'who-has' or 'who-wants'
  const [selectedUser, setSelectedUser] = useState('ALL')

  useEffect(() => {
    getAllInventories()
      .then(setInventories)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Build per-user maps
  const userMap = {}
  for (const u of allUsers) userMap[u.id] = u.name

  // Stickers I want vs what others have available
  const myWants = new Set(
    inventories
      .filter(r => r.user_id === user.id && r.wants)
      .map(r => r.sticker_code)
  )

  // Stickers I have spare vs what others want
  const myDupes = new Set(
    inventories
      .filter(r => r.user_id === user.id && r.duplicate_count > 0)
      .map(r => r.sticker_code)
  )

  // Group other users' dupes by user
  const otherDupes = {}  // userId -> [sticker_code]
  const otherWants = {}  // userId -> [sticker_code]

  for (const row of inventories) {
    if (row.user_id === user.id) continue
    if (row.duplicate_count > 0) {
      if (!otherDupes[row.user_id]) otherDupes[row.user_id] = []
      otherDupes[row.user_id].push(row.sticker_code)
    }
    if (row.wants) {
      if (!otherWants[row.user_id]) otherWants[row.user_id] = []
      otherWants[row.user_id].push(row.sticker_code)
    }
  }

  // "Who has stickers I want?"
  const theyHaveWhatIWant = Object.entries(otherDupes)
    .map(([uid, codes]) => ({
      userId: uid,
      name: userMap[uid] || uid,
      stickers: codes.filter(c => myWants.has(c))
    }))
    .filter(r => r.stickers.length > 0)
    .sort((a, b) => b.stickers.length - a.stickers.length)

  // "Who wants stickers I have?"
  const theyWantWhatIHave = Object.entries(otherWants)
    .map(([uid, codes]) => ({
      userId: uid,
      name: userMap[uid] || uid,
      stickers: codes.filter(c => myDupes.has(c))
    }))
    .filter(r => r.stickers.length > 0)
    .sort((a, b) => b.stickers.length - a.stickers.length)

  // All dupes from everyone
  const allDupesGrouped = Object.entries(otherDupes).map(([uid, codes]) => ({
    userId: uid,
    name: userMap[uid] || uid,
    stickers: codes,
  }))

  // All wants from everyone
  const allWantsGrouped = Object.entries(otherWants).map(([uid, codes]) => ({
    userId: uid,
    name: userMap[uid] || uid,
    stickers: codes,
  }))

  const displayUsers = (viewMode === 'who-has' ? allDupesGrouped : allWantsGrouped)
    .filter(r => selectedUser === 'ALL' || r.userId === selectedUser)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <div className="text-4xl mb-4 animate-spin">⚽</div>
        Loading the board...
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-5">Swap Board</h1>

      {/* My actionable summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-800 rounded-xl p-4 border border-red-900">
          <h3 className="text-red-400 font-semibold mb-2">🎯 People who have stickers I need</h3>
          {theyHaveWhatIWant.length === 0 ? (
            <p className="text-slate-500 text-sm">No matches yet — mark stickers you want in My Album.</p>
          ) : (
            theyHaveWhatIWant.map(r => (
              <div key={r.userId} className="mb-2">
                <span className="text-white font-medium">{r.name}</span>
                <span className="text-slate-400 text-sm ml-2">has {r.stickers.length} sticker{r.stickers.length > 1 ? 's' : ''} I need</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {r.stickers.map(c => (
                    <span key={c} className="bg-red-900 text-red-300 text-xs px-2 py-0.5 rounded font-mono">{c}</span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="bg-slate-800 rounded-xl p-4 border border-emerald-900">
          <h3 className="text-emerald-400 font-semibold mb-2">📤 People who want stickers I have</h3>
          {theyWantWhatIHave.length === 0 ? (
            <p className="text-slate-500 text-sm">No matches yet — mark your duplicates in My Album.</p>
          ) : (
            theyWantWhatIHave.map(r => (
              <div key={r.userId} className="mb-2">
                <span className="text-white font-medium">{r.name}</span>
                <span className="text-slate-400 text-sm ml-2">wants {r.stickers.length} sticker{r.stickers.length > 1 ? 's' : ''} I have</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {r.stickers.map(c => (
                    <span key={c} className="bg-emerald-900 text-emerald-300 text-xs px-2 py-0.5 rounded font-mono">{c}</span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Full board */}
      <div className="bg-slate-800 rounded-xl p-4">
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode('who-has')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'who-has' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
              Everyone's Duplicates
            </button>
            <button
              onClick={() => setViewMode('who-wants')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'who-wants' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
              Everyone's Wants
            </button>
          </div>
          <select
            value={selectedUser}
            onChange={e => setSelectedUser(e.target.value)}
            className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none"
          >
            <option value="ALL">All people</option>
            {allUsers.filter(u => u.id !== user.id).map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        {displayUsers.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">
            Nobody has updated their {viewMode === 'who-has' ? 'duplicates' : 'wants'} yet.
          </p>
        ) : (
          displayUsers.map(group => (
            <div key={group.userId} className="mb-5">
              <h3 className="text-white font-semibold mb-2">{group.name}</h3>
              <div className="flex flex-wrap gap-1.5">
                {group.stickers.map(code => {
                  const info = STICKER_MAP[code]
                  return (
                    <span
                      key={code}
                      title={info ? `${info.name} (${info.team})` : code}
                      className={`text-xs px-2 py-1 rounded font-mono cursor-default ${
                        viewMode === 'who-has'
                          ? 'bg-emerald-900 text-emerald-300 hover:bg-emerald-800'
                          : 'bg-red-900 text-red-300 hover:bg-red-800'
                      }`}
                    >
                      {code}
                    </span>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
