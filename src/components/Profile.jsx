import React, { useState } from 'react'
import { useUser } from '../App'
import { updateUserAddress } from '../lib/supabase'

export default function Profile({ onUserUpdate }) {
  const { user, allUsers } = useUser()
  const [address, setAddress] = useState(user.address || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await updateUserAddress(user.id, address.trim())
      onUserUpdate({ ...user, address: address.trim() })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError('Failed to save. Check your connection.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-white mb-5">Profile — {user.name}</h1>

      {/* Address form */}
      <div className="bg-slate-800 rounded-xl p-5 mb-6">
        <h2 className="text-white font-semibold mb-1">Mailing Address</h2>
        <p className="text-slate-400 text-sm mb-4">
          Used on the Manifest so others know where to send stickers. Only group members can see this.
        </p>
        <form onSubmit={handleSave}>
          <textarea
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder={"John Smith\n123 Main St\nBoston, MA 02101"}
            rows={4}
            className="w-full bg-slate-700 text-white placeholder-slate-500 border border-slate-600 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 resize-none font-mono text-sm"
          />
          <div className="flex items-center gap-3 mt-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-5 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Address'}
            </button>
            {saved && <span className="text-emerald-400 text-sm">✓ Saved!</span>}
            {error && <span className="text-red-400 text-sm">{error}</span>}
          </div>
        </form>
      </div>

      {/* Group members */}
      <div className="bg-slate-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-3">Group Members ({allUsers.length})</h2>
        <div className="space-y-2">
          {allUsers.map(u => (
            <div key={u.id} className="flex items-start justify-between gap-3 py-2 border-b border-slate-700 last:border-0">
              <div>
                <span className="text-white font-medium">
                  {u.name}
                  {u.id === user.id && <span className="text-emerald-400 text-xs ml-2">(you)</span>}
                </span>
                {u.address ? (
                  <p className="text-slate-400 text-xs mt-0.5 font-mono whitespace-pre-line">{u.address}</p>
                ) : (
                  <p className="text-yellow-600 text-xs mt-0.5">No address yet</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How to use hint */}
      <div className="mt-6 bg-slate-800 rounded-xl p-4 border border-slate-700">
        <h3 className="text-slate-300 font-medium mb-2">How to use this app</h3>
        <ol className="text-slate-400 text-sm space-y-1 list-decimal list-inside">
          <li><strong className="text-white">My Album</strong> — click stickers to mark what you need (❓) or have spare (+1/+2/3+)</li>
          <li><strong className="text-white">Board</strong> — see everyone's duplicates and needs at a glance</li>
          <li><strong className="text-white">Matches</strong> — smart view showing who can send what to whom</li>
          <li><strong className="text-white">Manifest</strong> — print-ready shipping list with addresses</li>
          <li>Share the app URL with anyone who wants to join — they just pick their name!</li>
        </ol>
      </div>
    </div>
  )
}
