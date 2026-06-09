-- Panini Sticker Swap 2026 — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name    text UNIQUE NOT NULL,
  address text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sticker_inventory (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
  sticker_code    text NOT NULL,
  duplicate_count integer DEFAULT 0,
  wants           boolean DEFAULT false,
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(user_id, sticker_code)
);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_sticker_inventory_user_id ON sticker_inventory(user_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Everyone in the group can read everything; anyone can write their own rows.
-- This is a TRUSTED GROUP app — no per-user auth needed.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sticker_inventory ENABLE ROW LEVEL SECURITY;

-- Users: anyone can read all, anyone can insert/update
CREATE POLICY "Public read users"  ON users FOR SELECT USING (true);
CREATE POLICY "Anyone can insert users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update users" ON users FOR UPDATE USING (true);

-- Sticker inventory: anyone can read all, insert, update
CREATE POLICY "Public read inventory"  ON sticker_inventory FOR SELECT USING (true);
CREATE POLICY "Anyone can insert inventory" ON sticker_inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update inventory" ON sticker_inventory FOR UPDATE USING (true);
