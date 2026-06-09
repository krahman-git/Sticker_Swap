import React, { useState, useEffect } from 'react'
import { useUser } from '../App'
import { getAllInventories, computeMatches } from '../lib/supabase'
import { STICKER_MAP } from '../data/stickers'

export default function Manifest() {
  const { user, allUsers } = useUser()
  const [inventories, setInventories] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterUser, setFilterUser] = useState(user.id)

  useEffect(() => {
    getAllInventories()
      .then(setInventories)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const allMatches = computeMatches(inventories, user.id, allUsers)

  // Build manifest: group sends by giver
  // For each giver, show all their sends to all receivers
  const byGiver = {}
  for (const m of allMatches) {
    if (!byGiver[m.giverId]) byGiver[m.giverId] = { name: m.giverName, sends: [] }
    byGiver[m.giverId].sends.push({ receiverId: m.receiverId, receiverName: m.receiverName, stickers: m.stickers })
  }

  // Find receiver's address
  const addressMap = {}
  for (const u of allUsers) addressMap[u.id] = u.address

  const giverList = Object.entries(byGiver)
    .filter(([id]) => filterUser === 'ALL' || id === filterUser)
    .sort(([, a], [, b]) => a.name.localeCompare(b.name))

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <div className="text-4xl mb-4 animate-spin">⚽</div>
        Building manifest...
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Shipping Manifest</h1>
          <p className="text-slate-400 text-sm">Who sends what to whom — with addresses.</p>
        </div>
        <div className="flex gap-2">
          <select
            value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
            className="bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none"
          >
            <option value="ALL">Everyone</option>
            {allUsers.map(u => (
              <option key={u.id} value={u.id}>{u.name === user.name ? `${u.name} (me)` : u.name}</option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            🖨️ Print
          </button>
        </div>
      </div>

      {giverList.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <div className="text-5xl mb-3">📭</div>
          <p>No swap matches found. Make sure everyone has marked their duplicates and wants in My Album.</p>
        </div>
      ) : (
        <div className="space-y-6 print:text-black print:bg-white">
          {giverList.map(([giverId, { name: giverName, sends }]) => (
            <div key={giverId} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden print:border-gray-300 print:rounded-none">
              <div className="bg-slate-700 px-5 py-3 print:bg-gray-100">
                <h2 className="text-white font-bold text-lg print:text-black">
                  📤 Sender: {giverName}
                </h2>
                {addressMap[giverId] && (
                  <p className="text-slate-300 text-sm mt-0.5 print:text-gray-600">
                    Return address: {addressMap[giverId]}
                  </p>
                )}
              </div>

              <div className="p-5 space-y-5">
                {sends.map((send, i) => (
                  <div key={i} className="border-l-2 border-blue-600 pl-4">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <h3 className="text-blue-300 font-semibold print:text-blue-700">
                          → To: {send.receiverName}
                        </h3>
                        {addressMap[send.receiverId] ? (
                          <p className="text-slate-300 text-sm mt-0.5 print:text-gray-600">
                            📬 {addressMap[send.receiverId]}
                          </p>
                        ) : (
                          <p className="text-yellow-500 text-sm mt-0.5">
                            ⚠️ No address on file — ask {send.receiverName} to add their address in Profile.
                          </p>
                        )}
                      </div>
                      <span className="bg-slate-700 text-slate-300 text-sm px-3 py-1 rounded-full whitespace-nowrap print:bg-gray-200 print:text-gray-700">
                        {send.stickers.length} sticker{send.stickers.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Sticker list */}
                    <div className="bg-slate-900 rounded-lg p-3 print:bg-gray-50 print:border print:border-gray-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-slate-400 print:text-gray-500">
                            <th className="text-left font-medium pr-4 py-0.5">Code</th>
                            <th className="text-left font-medium pr-4 py-0.5">Player</th>
                            <th className="text-left font-medium py-0.5">Team</th>
                          </tr>
                        </thead>
                        <tbody>
                          {send.stickers.map(code => {
                            const info = STICKER_MAP[code]
                            return (
                              <tr key={code} className="border-t border-slate-800 print:border-gray-100">
                                <td className="font-mono text-emerald-300 pr-4 py-0.5 print:text-green-700">{code}</td>
                                <td className="text-white pr-4 py-0.5 print:text-black">{info?.name || '—'}</td>
                                <td className="text-slate-400 py-0.5 print:text-gray-500">{info?.team || '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
