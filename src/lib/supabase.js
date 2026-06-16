import { createClient } from '@supabase/supabase-js'

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
  const { data, error } = await supabase
    .from('sticker_inventory')
    .select('*, users(name)')
    .limit(10000)  // override default 1000-row cap
  if (error) throw error
  return data
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

      const canSend = Object.keys(giverDupes).filter(code => receiverWants.has(code))
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
