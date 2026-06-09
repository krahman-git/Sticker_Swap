import React, { useState, useEffect } from 'react'
import { useUser } from '../App'
import { getAllInventories, computeMatches } from '../lib/supabase'
import { STICKER_MAP } from '../data/stickers'

export default function Matches() {
  const { user, allUsers } = useUser()
  const [inventories, setInventories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllInventories()
      .then(setInventories)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const allMatches = computeMatches(inventories, user.id, allUsers)

  // Matches involving me: I send to someone, or someone sends to me
  const iSend = allMatches.filter(m => m.giverId === user.id)
  const iReceive = allMatches.filter(m => m.receiverId === user.id)

  // All other matches (for everyone else to coordinate)
  const otherMatches = allMatches.filter(m => m.giverId !== user.id && m.receiverId !== user.id)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <div className="text-4xl mb-4 animate-spin">⚽</div>
        Computing matches...
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-2">Swap Matches</h1>
      <p className="text-slate-400 text-sm mb-5">
        These are all possible swaps based on who has what and who needs what.
        Use this to decide who sends to whom before printing the Manifest.
      </p>

      {/* My sends */}
      <section className="mb-6">
        <h2 className="text-emerald-400 font-semibold mb-3">📤 Stickers I can send</h2>
        {iSend.length === 0 ? (
          <div className="bg-slate-800 rounded-xl p-4 text-slate-500 text-sm">
            You haven't marked any duplicates yet — head to My Album and mark stickers you have spare.
          </div>
        ) : (
          <div className="space-y-3">
            {iSend.map((m, i) => (
              <MatchCard key={i} match={m} perspective="send" currentUser={user} />
            ))}
          </div>
        )}
      </section>

      {/* My receives */}
      <section className="mb-6">
        <h2 className="text-red-400 font-semibold mb-3">📥 Stickers I can receive</h2>
        {iReceive.length === 0 ? (
          <div className="bg-slate-800 rounded-xl p-4 text-slate-500 text-sm">
            You haven't marked any wants yet — or nobody has your needed stickers as spares.
          </div>
        ) : (
          <div className="space-y-3">
            {iReceive.map((m, i) => (
              <MatchCard key={i} match={m} perspective="receive" currentUser={user} />
            ))}
          </div>
        )}
      </section>

      {/* Other group matches */}
      {otherMatches.length > 0 && (
        <section>
          <h2 className="text-slate-400 font-semibold mb-3">👥 Other group matches</h2>
          <div className="space-y-3">
            {otherMatches.map((m, i) => (
              <MatchCard key={i} match={m} perspective="other" currentUser={user} />
            ))}
          </div>
        </section>
      )}

      {allMatches.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <div className="text-5xl mb-3">🔍</div>
          <p>No matches yet — everyone needs to mark their wants and duplicates in My Album first!</p>
        </div>
      )}
    </div>
  )
}

function MatchCard({ match, perspective, currentUser }) {
  const [expanded, setExpanded] = useState(false)

  const borderColor =
    perspective === 'send' ? 'border-emerald-800' :
    perspective === 'receive' ? 'border-red-800' :
    'border-slate-700'

  const headerBg =
    perspective === 'send' ? 'bg-emerald-900/40' :
    perspective === 'receive' ? 'bg-red-900/40' :
    'bg-slate-800'

  return (
    <div className={`bg-slate-800 rounded-xl border ${borderColor} overflow-hidden`}>
      <button
        className={`w-full text-left px-4 py-3 flex items-center justify-between ${headerBg} hover:opacity-90 transition-opacity`}
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <span className="text-white font-medium">
            <span className="text-emerald-400">{match.giverName}</span>
            <span className="text-slate-400 mx-2">→</span>
            <span className="text-blue-400">{match.receiverName}</span>
          </span>
          <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">
            {match.stickers.length} sticker{match.stickers.length > 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-slate-400 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 py-3 border-t border-slate-700">
          <div className="flex flex-wrap gap-1.5">
            {match.stickers.map(code => {
              const info = STICKER_MAP[code]
              return (
                <div key={code} className="bg-slate-700 rounded-lg px-2 py-1">
                  <span className="text-emerald-300 font-mono text-xs">{code}</span>
                  {info && (
                    <span className="text-slate-300 text-xs ml-1">
                      {info.name}
                      <span className="text-slate-500 ml-1">({info.team})</span>
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
