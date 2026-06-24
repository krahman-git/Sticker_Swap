import React, { useState, useEffect, createContext, useContext } from 'react'
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { getOrCreateUser, getAllUsers } from './lib/supabase'
import AlbumView from './components/AlbumView'
import SwapBoard from './components/SwapBoard'
import Matches from './components/Matches'
import Manifest from './components/Manifest'
import Profile from './components/Profile'
import Search from './components/Search'
import Pack from './components/Pack'
import Admin from './components/Admin'

// ── User Context ──────────────────────────────────────────────────────────────
export const UserContext = createContext(null)
export const useUser = () => useContext(UserContext)

// ── Name Picker ───────────────────────────────────────────────────────────────
function NamePicker({ onSelect }) {
  const [members, setMembers] = useState([])
  const [custom, setCustom] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getAllUsers().then(users => setMembers(users.map(u => u.name))).catch(console.error)
  }, [])

  async function handleSelect(name) {
    const trimmed = name.trim()
    if (!trimmed) return
    setLoading(true)
    setError('')
    try {
      const user = await getOrCreateUser(trimmed)
      localStorage.setItem('stickerSwapUser', JSON.stringify(user))
      onSelect(user)
    } catch (e) {
      setError('Could not connect. Check your internet and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">⚽</div>
          <h1 className="text-3xl font-bold text-white mb-2">Panini WC 2026</h1>
          <p className="text-slate-400">Sticker Swap — who are you?</p>
        </div>

        {/* Members from DB */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {members.map(name => (
            <button
              key={name}
              onClick={() => handleSelect(name)}
              disabled={loading}
              className="bg-slate-700 hover:bg-emerald-600 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50 text-lg"
            >
              {name}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-slate-700" />
          <span className="text-slate-500 text-sm">or join as</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>

        {/* Custom name */}
        <div className="flex gap-2">
          <input
            type="text"
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSelect(custom)}
            placeholder="Your first name..."
            className="flex-1 bg-slate-800 text-white placeholder-slate-500 border border-slate-600 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={() => handleSelect(custom)}
            disabled={loading || !custom.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-5 rounded-xl transition-colors disabled:opacity-40"
          >
            {loading ? '...' : 'Go'}
          </button>
        </div>

        {error && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}
      </div>
    </div>
  )
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function Nav({ user, onSwitch }) {
  const navClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'
    }`

  return (
    <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
        <span className="text-white font-semibold text-sm">⚽ Sticker Swap</span>
        <div className="flex gap-1 overflow-x-auto">
          <NavLink to="/album" className={navClass}>My Album</NavLink>
          <NavLink to="/search" className={navClass}>Search</NavLink>
          <NavLink to="/board" className={navClass}>Board</NavLink>
          <NavLink to="/matches" className={navClass}>Matches</NavLink>
          <NavLink to="/pack" className={navClass}>Pack</NavLink>
          <NavLink to="/manifest" className={navClass}>Manifest</NavLink>
          <NavLink to="/profile" className={navClass}>
            <span className="text-emerald-400">{user.name}</span>
          </NavLink>
        </div>
        <button
          onClick={onSwitch}
          className="text-slate-500 hover:text-slate-300 text-xs ml-2 whitespace-nowrap"
        >
          Switch user
        </button>
      </div>
    </nav>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null)
  const [allUsers, setAllUsers] = useState([])

  // Restore session from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('stickerSwapUser')
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch {}
    }
  }, [])

  // Load all users whenever current user changes
  useEffect(() => {
    if (user) {
      getAllUsers().then(setAllUsers).catch(console.error)
    }
  }, [user])

  function handleSwitch() {
    localStorage.removeItem('stickerSwapUser')
    setUser(null)
  }

  function handleUserUpdate(updated) {
    setUser(updated)
    localStorage.setItem('stickerSwapUser', JSON.stringify(updated))
    setAllUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
  }

  if (!user) {
    return <NamePicker onSelect={u => { setUser(u); localStorage.setItem('stickerSwapUser', JSON.stringify(u)) }} />
  }

  return (
    <UserContext.Provider value={{ user, allUsers, refreshUsers: () => getAllUsers().then(setAllUsers), onUserUpdate: handleUserUpdate }}>
      <HashRouter>
        <div className="min-h-screen bg-slate-900 text-white">
          <Nav user={user} onSwitch={handleSwitch} />
          <main className="max-w-5xl mx-auto px-4 py-6">
            <Routes>
              <Route path="/" element={<Navigate to="/album" replace />} />
              <Route path="/album" element={<AlbumView />} />
              <Route path="/search" element={<Search />} />
              <Route path="/board" element={<SwapBoard />} />
              <Route path="/matches" element={<Matches />} />
              <Route path="/pack" element={<Pack />} />
              <Route path="/manifest" element={<Manifest />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/profile" element={<Profile onUserUpdate={handleUserUpdate} />} />
            </Routes>
          </main>
        </div>
      </HashRouter>
    </UserContext.Provider>
  )
}
