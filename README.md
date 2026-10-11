# Lubrication — Industrial Equipment PM & Lubrication Management

A professional, hierarchical application for managing equipment, components, lubrication points, running hours, and maintenance activities across multiple plants.

## Features

**Equipment Hierarchy:**
- Equipment → Components → Lubrication Points (3-level structure)
- Each level has status, criticality, and type tracking
- SAP integration ready (SAP Equipment Number field)

**Advanced Tracking:**
- 36 pre-seeded plant resources (KILN01, COALM01, etc.)
- Running hours tracking with cascade to linked equipment
- Running hours RPC function for automatic updates
- Component and lubrication point auto-suggestions

**Lubrication Management:**
- Lubricant master list with 5 pre-seeded lubricants
- Calendar interval tracking (months)
- Running hours interval tracking
- Special instructions per point
- Lubrication type classification (Oil/Grease/Aerosol)

**Work Orders & Activities:**
- Log service activities with quantity and UOM
- Status tracking (completed/pending)
- Technician assignment
- Complete activity history

**User Management:**
- Admin panel for user creation
- Per-user feature toggles:
  - assets_edit (Equipment/Components)
  - points_edit (Lubrication Points)
  - workorders_record (Log activities)
  - workorders_edit (Edit work orders)
  - inventory_edit (Inventory management)
- Role-based sidebar navigation
- Automatic role detection (Admin/Engineer/Technician)

**Reporting & Insights:**
- Dashboard with key metrics
- Running hours tracking page
- Oil analysis flag tracking
- Activity history
- Summary reports by equipment/component

## Quick Setup (5 minutes)

### 1. Supabase Project (2 min)
- Go to [supabase.com](https://supabase.com)
- Click "New project"
- Choose name, password, region
- Wait for deployment ✓

### 2. Create Database (1 min)
- In Supabase: **SQL Editor** → **New Query**
- Copy all of `db/schema.sql`
- Paste into SQL editor
- Click **Run** ✓

### 3. Get Your Credentials (30 sec)
- Supabase: **Settings** (bottom left) → **API**
- Copy: **Project URL** (the full URL)
- Copy: **anon public** key
- Save these!

### 4. Update Config (30 sec)
Edit `public/js/config.js`:
```javascript
window.LMS_CONFIG = {
  SUPABASE_URL: 'https://your-project.supabase.co',  // ← Paste Project URL
  SUPABASE_ANON_KEY: 'eyJhbGc...'                     // ← Paste anon key
};
```

### 5. Deploy (1 min)

**Option A: Vercel + GitHub**
```bash
git init
git add .
git commit -m "Initial"
git push -u origin main
```
Then connect repo to vercel.com

**Option B: Vercel CLI**
```bash
npm i -g vercel
cd (app folder)
vercel
```

✅ **Done!** Your app is live

## First User Setup

After deployment:

1. Go to your app URL
2. Click "Create account"
3. Sign up with email, password, name
4. You'll be logged in automatically ✓

### Make Yourself Admin (Optional)

If you want admin powers (add equipment, create users):

1. Go to Supabase → **SQL Editor** → **New Query**
2. Paste this (replace email with yours):
```sql
update profiles 
set is_admin = true 
where id = (
  select id from auth.users 
  where email = 'your-email@example.com'
);
```
3. Click **Run** ✓
4. Refresh the app
5. You'll see "Admin" in sidebar + extra buttons

## Features

- **Dashboard** — KPI cards, needs attention, activity feed
- **Equipment** — Manage equipment (admin: add new)
- **Schedule** — View lubrication schedules
- **Log service** — Record lubrication services
- **Oil analysis** — Track flagged samples
- **Reports** — Summary statistics
- **Admin** — Create users, manage access

## File Structure

```
lubrication-app/
├── public/
│   ├── index.html           ← Main app
│   ├── css/
│   │   └── style.css        ← All styling
│   └── js/
│       ├── config.js        ← ⚠️ UPDATE THIS FIRST
│       └── app.js           ← Application logic
├── db/
│   └── schema.sql           ← Run in Supabase first
└── README.md
```

## Design

- **Color:** Tan/brown (#C89456)
- **Layout:** Sidebar + main content
- **Responsive:** Mobile-friendly
- **No build step:** Pure HTML/CSS/JavaScript

## Technology Stack

- **Frontend:** HTML/CSS/JavaScript (no dependencies)
- **Database:** Supabase (PostgreSQL + Auth)
- **Hosting:** Vercel (free tier works)

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Blank white page | Open F12, check console errors. Verify config.js values. |
| Can't sign up | Check that your Supabase project is live |
| Can't add equipment (even as admin) | Make sure is_admin = true in profiles table |
| "Unknown database" error | Copy-paste Supabase URL/key again (check for spaces) |
| Password reset not working | Password must be at least 8 characters |

## Next Steps

1. **Test it:**
   - Sign up
   - Go to Equipment → Add test equipment
   - Go to Log service → Log a service
   - Check Dashboard → should show new data

2. **Customize:**
   - Change colors in `public/css/style.css` (--primary: #C89456)
   - Change company name in `public/index.html`
   - Add/remove fields in app.js

3. **Invite team:**
   - Admin → Create User
   - Send them the app URL
   - They sign up and start logging services

## Security Notes

- **Passwords:** Min 8 characters, hashed by Supabase
- **RLS enabled:** Users can only see data they should
- **Admin only:** Can add equipment, create users
- **No API key in frontend:** Using anon key (safe)

---

That's it! You have a complete, production-ready app. 🚀

Questions? Check the docs or your Supabase logs.
