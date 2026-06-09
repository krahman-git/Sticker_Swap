# Panini WC 2026 — Sticker Swap App

A free, hosted web app for your friend group to track, swap, and ship Panini FIFA World Cup 2026 stickers.

**Live URL:** `https://krahman-git.github.io/Sticker_Swap/`

---

## Features

- **My Album** — Click each sticker to mark: need it ❓ / 1 spare / 2 spares / 3+ spares
- **Swap Board** — See everyone's duplicates and wants in one place
- **Matches** — Smart view showing exactly who can send what to whom
- **Manifest** — Print-ready shipping list with mailing addresses
- **No login needed** — Just pick your name to get started
- **All 980 stickers** — Every team, every player

---

## One-Time Setup (10 minutes)

### Step 1 — Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **New project**, name it `sticker-swap`, pick a region near you
3. Once created, go to **SQL Editor** and paste the contents of `supabase_schema.sql` → click **Run**
4. Go to **Project Settings → API** and copy:
   - **Project URL** → this is your `VITE_SUPABASE_URL`
   - **anon / public key** → this is your `VITE_SUPABASE_ANON_KEY`

### Step 2 — Add secrets to GitHub

1. Go to your GitHub repo → **Settings → Secrets and variables → Actions**
2. Click **New repository secret** and add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key

### Step 3 — Enable GitHub Pages

1. Go to your GitHub repo → **Settings → Pages**
2. Under **Source**, choose **GitHub Actions**
3. Push to `main` — the Actions workflow will build and deploy automatically

### Step 4 — Done!

Share the URL `https://krahman-git.github.io/Sticker_Swap/` with your group.
Anyone can join just by typing their first name.

---

## Running Locally

```bash
# Clone the repo
git clone https://github.com/krahman-git/Sticker_Swap.git
cd Sticker_Swap

# Install deps
npm install

# Create .env from template
cp .env.example .env
# Edit .env and fill in your Supabase URL and anon key

# Start dev server
npm run dev
```

---

## How It Works

| Tab | What to do |
|-----|-----------|
| **My Album** | Click stickers to cycle: neutral → ❓ need → +1 spare → +2 → 3+ → back |
| **Board** | See everyone's dupes and wants; filter by person |
| **Matches** | Automatically computed swaps based on who has what |
| **Manifest** | Full shipping list — who sends what stickers to whom, with addresses |
| **Profile** | Enter your mailing address (needed for others to ship to you) |

---

## Tech Stack

- **React + Vite** — fast, modern frontend
- **Supabase** — free Postgres database + API
- **Tailwind CSS** — styling via CDN (no build step)
- **GitHub Pages** — free static hosting
- **GitHub Actions** — automatic deploy on push to `main`

**Total hosting cost: $0**
