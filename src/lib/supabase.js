import { createClient } from '@supabase/supabase-js'
import { sortByAlbumOrder } from '../data/stickers'

// These values come from your Supabase project settings -> API
// They are safe to expose in client-side code (Row Level Security handles auth)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase env vars. Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── User helpers ─────────────────────────────────────────────────────────────

export async function getOrCreateUser(name) {
  // Try to find existing user
  let { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('name', name)
    .single()

  if (error && error.code === 'PGRST116') {
    // Not found — create them
    const { data: newUser, error: createErr } = await supabase
      .from('users')
      .insert({ name })
      .select()
      .single()
    if (createErr) throw createErr
    return newUser
  }
  if (error) throw error
  return data
}

export async function getAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('name')
  if (error) throw error
  return data
}

export async function updateUserAddress(userId, address) {
  const { error } = await supabase
    .from('users')
    .update({ address })
    .eq('id', userId)
  if (error) throw error
}

// ── Sticker inventory helpers ─────────────────────────────────────────────────

export async function getUserInventory(userId) {
  const { data, error } = await supabase
    .from('sticker_inventory')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  // Return as a map: { stickerCode: { duplicate_count, wants } }
  const map = {}
  for (const row of data) {
    map[row.sticker_code] = { duplicate_count: row.duplicate_count, wants: row.wants, id: row.id }
  }
  return map
}

export async function upsertStickerStatus(userId, stickerCode, duplicateCount, wants) {
  const { error } = await supabase
    .from('sticker_inventory')
    .upsert(
      {
        user_id: userId,
        sticker_code: stickerCode,
        duplicate_count: duplicateCount,
        wants: wants,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,sticker_code' }
    )
  if (error) throw error
}

export async function getAllInventories() {
  // Fetch all rows in pages of 1000 (Supabase server cap per request)
  const PAGE = 1000
  let all = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('sticker_inventory')
      .select('*, users(name)')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

// ── Swap session helpers ──────────────────────────────────────────────────────

export async function createSwapSession(senderId, receiverId, stickerCodes) {
  const { error } = await supabase
    .from('swap_sessions')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      sticker_codes: stickerCodes,
      status: 'confirmed_sent',
    })
  if (error) throw error
}

export async function getPendingSessions() {
  const { data, error } = await supabase
    .from('swap_sessions')
    .select('*')
    .eq('status', 'confirmed_sent')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getAppliedSessions() {
  const { data, error } = await supabase
    .from('swap_sessions')
    .select('*')
    .eq('status', 'applied')
    .order('applied_at', { ascending: false })
  if (error) throw error
  return data
}

export async function revertSwapSession(session) {
  const { id, sender_id, receiver_id, sticker_codes } = session

  // 1. Restore receiver's wants=true for these stickers
  for (const code of sticker_codes) {
    const { error } = await supabase
      .from('sticker_inventory')
      .upsert(
        { user_id: receiver_id, sticker_code: code, wants: true, duplicate_count: 0, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,sticker_code' }
      )
    if (error) throw error
  }

  // 2. Restore sender's duplicate counts (+1 each)
  const { data: senderRows, error: fetchErr } = await supabase
    .from('sticker_inventory')
    .select('*')
    .eq('user_id', sender_id)
    .in('sticker_code', sticker_codes)
  if (fetchErr) throw fetchErr

  const existingCodes = new Set(senderRows.map(r => r.sticker_code))

  for (const row of senderRows) {
    const { error } = await supabase
      .from('sticker_inventory')
      .update({ duplicate_count: row.duplicate_count + 1, updated_at: new Date().toISOString() })
      .eq('user_id', sender_id)
      .eq('sticker_code', row.sticker_code)
    if (error) throw error
  }

  // For stickers with no existing sender row, create one with duplicate_count=1
  const missing = sticker_codes.filter(c => !existingCodes.has(c))
  if (missing.length > 0) {
    const { error } = await supabase
      .from('sticker_inventory')
      .insert(missing.map(code => ({
        user_id: sender_id,
        sticker_code: code,
        duplicate_count: 1,
        wants: false,
        updated_at: new Date().toISOString(),
      })))
    if (error) throw error
  }

  // 3. Mark session as reverted
  const { error: sessionErr } = await supabase
    .from('swap_sessions')
    .update({ status: 'reverted', applied_at: new Date().toISOString() })
    .eq('id', id)
  if (sessionErr) throw sessionErr
}

export async function deleteSwapSession(id) {
  const { error } = await supabase
    .from('swap_sessions')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function applySwapSession(session) {
  const { id, sender_id, receiver_id, sticker_codes } = session

  // 1. Get sender's current inventory for these stickers
  const { data: senderRows, error: fetchErr } = await supabase
    .from('sticker_inventory')
    .select('*')
    .eq('user_id', sender_id)
    .in('sticker_code', sticker_codes)
  if (fetchErr) throw fetchErr

  // 2. Decrement sender's duplicate counts (min 0)
  for (const row of senderRows) {
    const newCount = Math.max(0, row.duplicate_count - 1)
    const { error } = await supabase
      .from('sticker_inventory')
      .update({ duplicate_count: newCount, updated_at: new Date().toISOString() })
      .eq('user_id', sender_id)
      .eq('sticker_code', row.sticker_code)
    if (error) throw error
  }

  // 3. Clear receiver's wants for these stickers
  const { error: wantsErr } = await supabase
    .from('sticker_inventory')
    .update({ wants: false, updated_at: new Date().toISOString() })
    .eq('user_id', receiver_id)
    .in('sticker_code', sticker_codes)
  if (wantsErr) throw wantsErr

  // 4. Mark session as applied
  const { error: sessionErr } = await supabase
    .from('swap_sessions')
    .update({ status: 'applied', applied_at: new Date().toISOString() })
    .eq('id', id)
  if (sessionErr) throw sessionErr
}

// ── Match helpers ─────────────────────────────────────────────────────────────

/**
 * Compute matches: pairs where userA wants sticker X and userB has it as a duplicate.
 * Returns array of { giver: userName, receiver: userName, stickers: [code, ...] }
 */
export function computeMatches(allInventories, currentUserId, allUsers) {
  // Group by user
  const byUser = {}
  for (const row of allInventories) {
    if (!byUser[row.user_id]) byUser[row.user_id] = { wants: new Set(), dupes: {} }
    if (row.wants) byUser[row.user_id].wants.add(row.sticker_code)
    if (row.duplicate_count > 0) byUser[row.user_id].dupes[row.sticker_code] = row.duplicate_count
  }

  const userMap = {}
  for (const u of allUsers) userMap[u.id] = u.name

  const matches = []
  const userIds = Object.keys(byUser)

  for (const giverId of userIds) {
    for (const receiverId of userIds) {
      if (giverId === receiverId) continue
      const giverDupes = byUser[giverId]?.dupes || {}
      const receiverWants = byUser[receiverId]?.wants || new Set()

      const canSend = sortByAlbumOrder(Object.keys(giverDupes).filter(code => receiverWants.has(code)))
      if (canSend.length > 0) {
        matches.push({
          giverId,
          receiverId,
          giverName: userMap[giverId] || giverId,
          receiverName: userMap[receiverId] || receiverId,
          stickers: canSend,
        })
      }
    }
  }

  return matches
}
