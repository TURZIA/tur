# TUR — Complete Product Reconstruction Document

**Version**: Production (June 2026)
**Architecture**: Single-file PWA (index.html ~4200 lines)
**Language**: Norwegian Bokmål (nb)
**Stack**: HTML/CSS/JS + Supabase + Leaflet + OSRM

---

## PHASE 1 — PRODUCT DISCOVERY

### Product Category
Outdoor activity tracking Progressive Web Application (PWA) for organized walking/hiking challenges in Norway.

### Industry
Sports & Recreation / Community Health & Wellness / Event Management

### Business Model
Free-to-use community platform for monthly walking challenges. Organized by admins (event organizers) who create walking routes with checkpoints. Participants register visits at physical locations using GPS verification.

### Value Proposition
"Registrer besøk ved tursteder og delta i månedlig trekning" — Register visits at hiking spots and participate in monthly prize drawings.

### User Personas

| Persona | Description | Goals |
|---------|-------------|-------|
| **Super Admin** | Platform owner (ziadnasif77@gmail.com) | Manage all admins, view system status, generate reports across all admins, draw winners |
| **Admin** (Arrangør) | Event organizer with unique 6-char admin code | Create trips/checkpoints, manage participants, generate reports, draw monthly winners |
| **Runner** (Deltaker) | Walking challenge participant | Visit checkpoints, register position, view history, receive winner notifications |
| **Guest** | Unauthenticated visitor | Can only see login screen |

### Permission Model (RBAC)

| Capability | Super Admin | Admin | Runner |
|-----------|:-----------:|:-----:|:------:|
| View map + all checkpoints | ✓ | ✓ | ✓ |
| Register position at checkpoint | ✗ | ✓ | ✓ |
| View Historikk (history drawer) | ✗ | ✓ | ✓ |
| View Rapport screen | ✓ | ✓ | ✗ |
| View Sjekkpunkter screen | ✓ | ✓ | ✗ |
| View Deltakere screen | ✗ | ✓ | ✗ |
| View Admins screen | ✓ | ✗ | ✗ |
| View Status dashboard | ✓ | ✗ | ✗ |
| Create/delete trips | ✓ (all) | ✓ (own) | ✗ |
| Delete other admin's trips | ✓ | ✗ | ✗ |
| Draw monthly winner | ✓ | ✓ | ✗ |
| Download Excel report | ✓ | ✓ | ✗ |
| Send report via email | ✓ | ✓ | ✗ |
| Add/remove admins | ✓ | ✗ | ✗ |
| Add/remove runners | ✗ | ✓ | ✗ |
| Change admin link (Bytt arrangør) | ✗ | ✗ | ✓ |
| Red arrow navigation line | ✗ | ✓ | ✓ |
| Progress badge (X/Y) | ✓ | ✓ | ✓ |
| Compass widget | ✗ | ✓ | ✓ |

### Core Business Goals
1. Encourage outdoor walking/hiking through gamification
2. Monthly prize drawing to incentivize completing all checkpoints
3. Multi-admin platform allowing multiple organizers
4. GPS-verified check-ins to prevent fraud
5. Real-time progress tracking

### KPIs
- Number of registered participants
- Number of check-ins per period
- Completion rate (runners visiting all checkpoints)
- Active admins count
- Active trips/races count

### Product Boundaries
- Single-page HTML file (no build system, no bundler)
- No native mobile apps (PWA only)
- No payment system
- No social features (no messaging, no public profiles)
- No offline check-in sync (offline stores locally but requires online for Supabase)
- Norwegian market only (all UI in Norwegian Bokmål)

---

## PHASE 2 — COMPLETE UI REVERSE ENGINEERING

### Screen Inventory

#### SCR-001: Splash Screen
- **Purpose**: Loading indicator while app initializes
- **ID**: `#splashLoader`
- **Entry**: On page load
- **Exit**: Removed after auth check completes (~350ms fade)
- **Widget**: SVG spinner (green circle animation)
- **Layout**: Full-screen centered, white background (#F5F7FA)

#### SCR-002: Login Screen
- **Purpose**: Authentication entry point
- **ID**: `#loginScreen`
- **Entry**: App start (no session), sign out
- **Exit**: Successful login/signup → Main Screen
- **Layout**: Centered card on split gradient background (green top / light bottom)
- **Sub-forms**:

  **SCR-002a: Sign In Form** (`#signinBox`)
  - Fields: E-post (email input), Passord (password input)
  - Buttons: "Logg inn" (green), "Registrer deg her" (link), "Glemt passord?" (link)
  - Loading state: "Logger inn…" text
  - Validation: Both fields required; Supabase error messages shown as toast
  - Enter key on password field triggers login

  **SCR-002b: Sign Up Form** (`#signupBox`, initially hidden)
  - Fields: Ditt navn (text), E-post (email), Passord (password), Deltakerkode (text, conditionally shown)
  - Buttons: "Opprett konto" (green), "Logg inn her" (link)
  - Loading state: "Oppretter konto…" text
  - Validation: Name ≥2 chars, email required, password ≥6 chars, admin code validated against `admins` table
  - Smart behavior: If email matches an admin in `admins` table, the deltakerkode field auto-hides (onBlur check)
  - Email confirmation: If Supabase requires email confirmation, shows success toast and switches to login form

  **SCR-002c: Reset Password Form** (`#resetBox`, initially hidden)
  - Fields: E-post (email)
  - Buttons: "Send tilbakestillingslenke" (green), "← Tilbake til innlogging" (link)
  - Result message: Success (green) or error (red) inline
  - Validation: Checks if email exists in runners, admins, or is super admin before sending reset

#### SCR-003: Reset Password Screen
- **Purpose**: Set new password after email reset link
- **ID**: `#resetPasswordScreen`
- **Entry**: URL hash contains `type=recovery` or `#reset`
- **Exit**: Successful password update → Login Screen (2s delay)
- **Layout**: Same gradient background as login
- **Fields**: Nytt passord, Bekreft passord
- **Button**: "Lagre nytt passord" (green)
- **Validation**: Password ≥6 chars, passwords must match

#### SCR-004: Main Screen (Map)
- **Purpose**: Primary interface — interactive map with checkpoints and GPS tracking
- **ID**: `#mainScreen`
- **Entry**: Successful authentication
- **Exit**: Navigate to other screens via header buttons
- **Layout**: Vertical flex — Header → GPS Bar → Map → Register Button

  **Header** (`.app-header`):
  - Row 1: "TUR" label + progress badge (X/Y) | Runner name + "Ikke deg?" logout link
  - Row 2: Navigation buttons (conditional visibility):
    - "Historikk" — all users except super admin
    - "Status" — super admin only
    - "Rapport" — admins only
    - "Sjekkpunkter" — admins only
    - "Deltakere" — admins only (not super admin)
    - "Admins" — super admin only
  - Style: Green gradient background, white text, frosted-glass buttons

  **GPS Bar** (`#gpsBar`):
  - Three states: green (GPS OK ±Xm), yellow (GPS svak/unøyaktig), red (GPS nektet/utilgjengelig)
  - Animated pulsing dot in yellow state
  - Text shows accuracy in meters

  **Map Container** (`#mapContainer`):
  - Leaflet 1.9.4 map with OpenStreetMap tiles
  - Checkpoint markers: Green circles (unvisited), Red circles (visited today)
  - Blue circle: User's current GPS position (60fps smooth animation)
  - Red dashed line: OSRM route to nearest unregistered checkpoint
  - Red arrow head: Direction indicator at end of route line
  - Pulsing animation on nearest checkpoint when within range
  - Compass widget (top-right): Points toward nearest unregistered checkpoint
  - Map legend (bottom-left): Green=Sted, Red=Besøkt, Blue=Din posisjon, Yellow=Turrute, Red line=Neste sted
  - Zoom controls (+/−) from Leaflet

  **Register Button** (`#registerBtn`):
  - States:
    - Gray: "Henter posisjon…" (initial)
    - Gray: "X m fra nærmeste punkt" (too far)
    - Gray: "✓ Name — allerede registrert" (already done today)
    - Gray: "Ingen steder lagt til ennå" (no checkpoints)
    - Green: "Registrer posisjon" (within 20m of unvisited checkpoint)
  - Click: Gets high-accuracy GPS, validates distance, saves check-in to Supabase
  - Loading state: Spinner inside button, button disabled
  - Hidden for super admin

#### SCR-005: History Drawer (Historikk)
- **Purpose**: Show runner's check-in history grouped by trip
- **ID**: `#historyDrawer`
- **Type**: Left-side slide-in drawer (85vw, max 360px)
- **Overlay**: `#drawerOverlay` — semi-transparent black
- **Entry**: Click "Historikk" button
- **Exit**: Click ✕, click overlay, or navigate away

  **Content**:
  - Header: "Historikk" title + close button
  - Runner info: Name, admin code (if admin), total registrations count, prize count
  - "Bytt arrangør" button (runners only, not admins)
  - History entries: Grouped by race, ordered newest first
    - Each entry: Checkpoint name, race name, date, time
    - Winner badge: Purple "Vinner" label if race was won
    - Green dot (normal) or purple dot (won)
  - Empty state: "Ingen registreringer ennå"
  - Loading state: "Laster historikk…"

#### SCR-006: Status Drawer (super admin only)
- **Purpose**: System dashboard with key metrics
- **ID**: `#statusDrawer`
- **Type**: Bottom sheet (70vh max, rounded top corners)
- **Entry**: Click "Status" button (super admin only)
- **Exit**: Click ✕ or overlay

  **Content**: 2x2 grid of metric cards
  - Sjekkpunkter (green) — total checkpoint count
  - Admins (blue) — active admin count
  - Deltakere (purple) — total runner count
  - Løp/aktive (amber) — active race count

#### SCR-007: Rapport Screen
- **Purpose**: Generate reports, download Excel, send email, draw monthly winner
- **ID**: `#rapportScreen`
- **Entry**: Click "Rapport" button (admins only)
- **Exit**: "← Tilbake" → Main Screen

  **Content**:
  - Admin selector (super admin only): Dropdown of all admins
  - Race selector (conditional): Dropdown "-- Alle turer --" + all races for selected admin
  - Date range: Fra dato / Til dato (date inputs, defaults to 1st of month → today)
  - Result area: Success (green) or error (red) message
  - Leaderboard table: Rank, Name, Checkpoints (X/Y), Total time
  - Buttons:
    - "Last ned Excel-rapport" (green) — generates and downloads XLSX
    - "Send til e-post" (blue) — sends HTML table via EmailJS + downloads XLSX
  - Monthly Drawing section:
    - Description text
    - "Trekk vinner" button (purple gradient)
    - Winner result card: Purple gradient background, winner name, qualification details
    - Duplicate prevention: Shows existing winner if already drawn for month

#### SCR-008: Sjekkpunkter Screen (Checkpoint Admin)
- **Purpose**: View all active checkpoints across all races
- **ID**: `#cpAdminScreen`
- **Entry**: Click "Sjekkpunkter" button (admins only)
- **Exit**: "← Tilbake" → Main Screen

  **Content**:
  - Header with "+ Ny tur" button
  - List of all active races with their checkpoints
  - Each race: Card with header (race name, admin email for super admin)
  - Each checkpoint: Order number, name, coordinates (lat, lng to 6 decimal places)
  - Empty state: "Ingen aktive turer."
  - Error state: "Feil ved lasting."

#### SCR-009: Administrer turer Screen (Race Management)
- **Purpose**: Create new trips and manage existing ones
- **ID**: `#cpNewRaceScreen`
- **Entry**: Click "+ Ny tur" button on Sjekkpunkter screen
- **Exit**: "← Tilbake" → Sjekkpunkter Screen

  **Content**:
  - New trip form:
    - Turnavn (text input)
    - Arrangørkode field (super admin only) — which admin owns this trip
    - "Velg sted på kartet" button → opens map picker
    - Selected location display
    - "+ Opprett tur" button (green)
  - Existing trips list (collapsible):
    - Each race: Header with name + arrow toggle
    - Expanded: Destination info (📍 icon, name, coordinates)
    - "Slett tur" button (red outline) — only shown if user owns the race or is super admin
    - Server-side delete guard: Verifies ownership before deleting

#### SCR-010: Deltakere Screen (Participants)
- **Purpose**: Manage participants linked to the admin
- **ID**: `#løpereScreen`
- **Entry**: Click "Deltakere" button (admin only, not super admin)
- **Exit**: "← Tilbake" → Main Screen

  **Content**:
  - Participant count header ("X deltakere")
  - "Del kode" button → toggles share panel:
    - Admin code display (large, letter-spaced)
    - "Kopier invitasjonslenke" button (uses Web Share API or clipboard)
  - Add participant by email:
    - Email input + "+ Legg til" button
    - Validation: Can't add self, checks runner exists, checks not already linked
  - Participant list:
    - Each: Name, email, "Fjern" (remove) button
  - Empty state: "Ingen deltakere koblet til deg ennå."

#### SCR-011: Admins Screen (Super Admin)
- **Purpose**: Add and manage admin accounts
- **ID**: `#superAdminScreen`
- **Entry**: Click "Admins" button (super admin only)
- **Exit**: "← Tilbake" → Main Screen

  **Content**:
  - Admin list: Each with admin code, email, deactivate (✕) button
  - Add new admin form:
    - Email input
    - "Legg til admin" button (green)
    - Result message: Success with generated code, or error
  - Deactivation: Soft-delete (is_active=false), confirms before deactivating
  - Reactivation: If email was previously deactivated, reactivates with same code

#### SCR-012: Map Picker Overlay
- **Purpose**: Select geographic coordinates on an interactive map
- **ID**: `#mapPickerOverlay`
- **Type**: Full-screen overlay (z-index: 10000)
- **Entry**: Click "Velg sted på kartet" when creating a trip
- **Exit**: "✕ Avbryt" or "✓ Bekreft"

  **Content**:
  - Full-screen Leaflet map with OSM tiles
  - Draggable marker for location selection
  - Search bar with debounced input (400ms):
    - Primary: Kartverket GeoNorge API (Norwegian place names)
    - Fallback: Nominatim OpenStreetMap search
    - Results list: Name, type, municipality, county
    - Click result → map zooms to location, marker moves
  - Coordinate display (bottom center): "lat, lng" in dark pill
  - Tap map → marker moves to tapped location

#### SCR-013: GPS Overlay
- **Purpose**: Guide user to enable GPS permissions
- **ID**: `#gpsOverlay`
- **Type**: Full-screen dark overlay
- **Entry**: GPS permission denied (on mobile)
- **Exit**: "Jeg har aktivert det — prøv igjen" button

  **Content**: Device-specific instructions
  - iOS: Settings → Privacy → Location Services → Safari
  - Android: Lock icon → Permissions → Location → Allow
  - Desktop: Lock icon → Location → Allow

#### SCR-014: Link Admin Popup
- **Purpose**: Connect runner to an admin/organizer
- **ID**: `#linkAdminOverlay`
- **Type**: Centered modal dialog
- **Entry**: Runner has no admin link after login
- **Exit**: Successful code entry

  **Content**:
  - Title: "Koble til arrangør"
  - Description explaining the code requirement
  - Deltakerkode input (uppercase, 6 chars)
  - "Koble til" button (green)
  - Error messages inline

### Global UI Elements

#### Offline Banner (`#offlineBanner`)
- Yellow bar at top: "📵 Ingen internettforbindelse — data lagres lokalt"
- Shown/hidden based on `navigator.onLine`

#### Toast Notifications (`#toastContainer`)
- Bottom-center, stacked
- Types: Success (green), Error (red), Warning (amber)
- Auto-dismiss (default 3.5s, configurable up to 10s)
- Slide-up entry animation

#### iOS Install Banner (`#iosBanner`)
- Bottom bar: "📲 Legg til på hjemskjermen: trykk Del ⎋ → Legg til på hjemskjermen"
- Shown after 3s on iOS Safari (not standalone), dismissible, remembered in localStorage

#### Android Install Button (`#androidInstallBtn`)
- Floating button (bottom-right): "📲 Installer app"
- Uses `beforeinstallprompt` event
- Green gradient, rounded pill shape

#### Pull-to-Refresh
- Touch-drag from header area triggers refresh
- Visual indicator: Green bar sliding down with "↓ Dra ned…" / "↓ Slipp for å oppdatere"
- Threshold: 70px drag distance

---

## PHASE 3 — USER JOURNEY MAPPING

### Journey 1: New Runner Registration
1. Open app → Splash screen → Login screen
2. Click "Registrer deg her" → Sign up form
3. Enter name, email, password, deltakerkode (participant code from organizer)
4. Submit → Supabase auth signup
5. **Branch A** (email confirmation required): Toast "Sjekk e-posten din…" → back to login
6. **Branch B** (auto-confirmed): Save runner to DB → Main screen
7. If no admin code entered → Link Admin Popup appears

### Journey 2: Returning Runner Login
1. Open app → Splash screen → Auto-login from session
2. OR: Login screen → Enter email/password → Main screen
3. Load checkpoints from all active races → Display on map
4. Load previous registrations → Mark today's check-ins as red
5. Start GPS tracking → Update blue dot position

### Journey 3: Checkpoint Visit
1. Walk to a checkpoint location
2. At 50m: Proximity alert (vibration + toast "X m til [Name]")
3. At 20m: Button turns green "Registrer posisjon", nearest checkpoint pulses
4. Tap register button → GPS verification → Save check-in to Supabase
5. Checkpoint turns red, progress badge updates, toast "Registrert! — [Name]"
6. If all checkpoints done today: Celebration toast "Gratulerer! 🎉"

### Journey 4: Admin Creates a Trip
1. Login as admin → Main screen with admin buttons visible
2. Click "Sjekkpunkter" → Checkpoint admin screen
3. Click "+ Ny tur" → Race management screen
4. Enter trip name, click "Velg sted på kartet"
5. Map picker opens → Search or tap to select location
6. Confirm → Coordinates populated
7. Click "+ Opprett tur" → Race + first checkpoint created in Supabase
8. Trip appears in list, checkpoint visible on map for all users

### Journey 5: Monthly Winner Drawing
1. Admin opens Rapport screen
2. Select date range (defaults to current month)
3. Click "Trekk vinner"
4. System checks: Existing winner? → Show and stop
5. Fetch all check-ins in period → Count unique checkpoints per runner
6. Filter eligible runners (visited ALL checkpoints)
7. Random selection → Save to `winners` table
8. Winner result displayed with purple card
9. Winner receives real-time notification (toast + vibration pattern)
10. Winner's history shows "Vinner" badge

### Journey 6: Password Reset
1. Click "Glemt passord?" on login screen
2. Enter email → System checks if email exists in runners/admins
3. If found: Send reset email via Supabase Auth
4. User clicks email link → App detects `type=recovery` hash
5. Show Reset Password screen → Enter new password twice
6. Submit → Update password → Redirect to login (2s delay)

### Journey 7: Runner Changes Admin
1. Open Historikk drawer
2. Click "Bytt arrangør" button
3. System clears current admin link in DB
4. Link Admin Popup appears
5. Enter new deltakerkode
6. Validated → Runner linked to new admin

### Journey 8: Super Admin Workflow
1. Login as super admin
2. Main screen: No register button, no historikk, no compass/arrow
3. "Status" → System dashboard (4 metric cards)
4. "Rapport" → Select admin → Select race → Generate report / Draw winner
5. "Sjekkpunkter" → View all checkpoints from all admins
6. "Admins" → Add/remove admin accounts

### Edge Cases & Failure Flows
- **GPS denied (mobile)**: GPS overlay with device-specific instructions
- **GPS denied (desktop)**: Toast warning, no overlay (GPS optional on desktop)
- **Offline**: Yellow banner, check-in saved locally, toast "📵 Offline — lagret lokalt"
- **Already registered**: Gray button "✓ [Name] — allerede registrert"
- **Too far from checkpoint**: Gray button "[X] m fra nærmeste punkt"
- **No active trips**: Gray button "Venter på at arrangøren starter en tur"
- **Invalid admin code (signup)**: Error toast "Ugyldig deltakerkode"
- **Admin deactivated while runner is linked**: Real-time notification, runner prompted to relink
- **Duplicate winner draw**: Shows existing winner, prevents re-draw
- **Expired reset link**: Shows message "Lenken er utløpt. Send en ny tilbakestillingslenke."
- **Session expired in another tab**: `onAuthStateChange` SIGNED_OUT → back to login

---

## PHASE 4 — FEATURE INVENTORY

### Core Features

| # | Feature | Purpose | Business Value |
|---|---------|---------|---------------|
| F1 | GPS-verified check-in | Register visit at checkpoint within 20m | Core gamification mechanic |
| F2 | Interactive map | Show checkpoints, user position, navigation | Primary user interface |
| F3 | OSRM route navigation | Red dashed line to nearest unvisited checkpoint | User guidance |
| F4 | Compass widget | Directional arrow toward nearest checkpoint | Mobile navigation aid |
| F5 | Progress badge | X/Y counter in header | Progress awareness |
| F6 | Monthly winner drawing | Random selection from eligible participants | Incentive/gamification |
| F7 | Multi-admin architecture | Multiple organizers create independent trips | Scalability |
| F8 | Real-time updates | Supabase Realtime for live data sync | Collaborative experience |
| F9 | Report generation | Excel download + email reports | Admin analytics |
| F10 | Leaderboard | Ranked participant table by completion | Competition motivation |

### Secondary Features

| # | Feature | Purpose |
|---|---------|---------|
| F11 | Proximity alerts | Vibration + toast at 50m from checkpoint |
| F12 | Snap-to-road | Align route display to actual walking paths |
| F13 | Smooth position animation | 60fps interpolated blue dot movement |
| F14 | Adaptive GPS smoothing | EMA filter with accuracy-based alpha |
| F15 | Pull-to-refresh | Drag header to refresh data |
| F16 | Checkpoint pulsing | Visual animation when near a checkpoint |
| F17 | PWA install prompts | iOS banner + Android install button |
| F18 | Auto-update detection | ETag/Last-Modified check on page load |
| F19 | Winner notification | Real-time toast + vibration for winners |
| F20 | History with winner badges | Purple "Vinner" label in history drawer |

### Admin Features

| # | Feature | Purpose |
|---|---------|---------|
| F21 | Trip CRUD | Create/delete trips with map picker |
| F22 | Participant management | Add/remove runners by email or share code |
| F23 | Admin management | Super admin adds/deactivates admins |
| F24 | System status dashboard | Metric cards for super admin |
| F25 | Email reports | Send HTML report via EmailJS |
| F26 | Race deletion restriction | Admin can only delete own races; super admin deletes all |

### Hidden/Internal Features

| # | Feature | Location |
|---|---------|----------|
| F27 | Admin code auto-detection | Signup form hides code field for admin emails |
| F28 | Previous admin reactivation | Runner's old admin re-linked if reactivated |
| F29 | Race route caching | localStorage with coordinate fingerprint key |
| F30 | Track recording | User path saved to localStorage (800 points max) |
| F31 | Cooldown system | 1-hour cooldown per checkpoint (localStorage) |
| F32 | Duplicate winner prevention | UNIQUE constraint + code 23505 handling |
| F33 | Best recent position | Uses most accurate GPS reading from last 10s |

---

## PHASE 5 — DATA MODEL RECONSTRUCTION

### Entity Relationship Diagram (Textual)

```
admins 1──∞ races 1──∞ checkpoints
  │                       │
  │                       │
  │      runners ∞──∞ check_ins
  │        │
  └────────┘ (via admin_code = runners.race_id)

winners (standalone, references admin_code)
```

### Table: `admins`

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | UUID | PK, auto | Primary key |
| email | TEXT | NOT NULL, UNIQUE | Admin email address |
| admin_code | VARCHAR(6) | NOT NULL, UNIQUE | 6-char alphanumeric code (ABCDEFGHJKLMNPQRSTUVWXYZ23456789) |
| is_active | BOOLEAN | DEFAULT true | Soft delete flag |
| created_at | TIMESTAMPTZ | DEFAULT now() | Creation timestamp |

### Table: `races`

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | SERIAL | PK | Auto-increment primary key |
| race_id | TEXT | NOT NULL, UNIQUE | Format: `{admin_code}_{4-char-random}` |
| admin_code | VARCHAR(6) | FK → admins.admin_code | Owning admin |
| name | TEXT | NOT NULL | Trip/race display name |
| is_active | BOOLEAN | DEFAULT true | Soft delete flag |
| is_current | BOOLEAN | DEFAULT false | Currently active for the admin's runners |
| created_at | TIMESTAMPTZ | DEFAULT now() | Creation timestamp |

### Table: `checkpoints`

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | UUID/SERIAL | PK | Primary key |
| race_id | TEXT | FK → races.race_id | Parent race |
| cp_order | INTEGER | NOT NULL | Sequential order within race |
| name | TEXT | NOT NULL | Checkpoint display name |
| lat | DOUBLE PRECISION | NOT NULL | Latitude (WGS84) |
| lng | DOUBLE PRECISION | NOT NULL | Longitude (WGS84) |

### Table: `runners`

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | UUID | PK | Supabase Auth user ID |
| name | TEXT | | Display name |
| email | TEXT | | Email address |
| race_id | VARCHAR(6) | NULLABLE | Current admin_code link |
| prev_race_id | VARCHAR(6) | NULLABLE | Previous admin_code (for reactivation) |
| created_at | TIMESTAMPTZ | | Creation timestamp |

### Table: `check_ins`

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | UUID/SERIAL | PK | Primary key |
| runner_id | UUID | FK → runners.id | Who checked in |
| runner_name | TEXT | | Denormalized runner name |
| checkpoint_name | TEXT | | Denormalized checkpoint name |
| checkpoint_order | INTEGER | | Checkpoint order number |
| lat_recorded | DOUBLE PRECISION | | GPS latitude at check-in |
| lng_recorded | DOUBLE PRECISION | | GPS longitude at check-in |
| accuracy_meters | DOUBLE PRECISION | | GPS accuracy in meters |
| elapsed_seconds | INTEGER | NULLABLE | Seconds since last check-in |
| timestamp | TIMESTAMPTZ | NOT NULL | Check-in timestamp |
| race_id | TEXT | FK → races.race_id | Which race this check-in belongs to |

### Table: `winners`

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | UUID/SERIAL | PK | Primary key |
| winner_name | TEXT | NOT NULL | Winner's display name |
| winner_id | UUID | NULLABLE | Winner's runner UUID |
| admin_code | VARCHAR(6) | NOT NULL | Which admin drew this winner |
| race_ids | TEXT[] | | Array of race_ids the winner completed |
| month | INTEGER | NOT NULL | Month number (1-12) |
| year | INTEGER | NOT NULL | Year |
| period_from | TIMESTAMPTZ | | Drawing period start |
| period_to | TIMESTAMPTZ | | Drawing period end |
| drawn_at | TIMESTAMPTZ | | When the drawing occurred |

**UNIQUE constraint**: `(month, year, admin_code)` — prevents duplicate drawings per month per admin. Error code 23505 caught in application.

### Business Rules (Data)
1. `doneCheckpoints` uses compound key `"raceId_order"` to prevent collisions across races
2. Only today's check-ins count as "done" for map coloring
3. Runners can only check in to their own admin's active race (`currentUser.raceId`)
4. All checkpoints from ALL active races are visible to ALL users on the map
5. A runner's `race_id` links to an `admin_code` (not a `race_id`) — it means "this runner belongs to this admin"
6. Checkpoint cooldown: 1 hour per checkpoint (localStorage, not server-enforced)

---

## PHASE 6 — API RECONSTRUCTION

### Supabase Client Configuration

```
URL:      https://lbzvvcggisehfasvxmcm.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIs... (JWT, role=anon)
```

### Authentication Endpoints (via Supabase Auth)

| Operation | Method | Description |
|-----------|--------|-------------|
| Sign In | `sbClient.auth.signInWithPassword({email, password})` | Email/password login |
| Sign Up | `sbClient.auth.signUp({email, password, options: {data: {full_name}}})` | New account creation |
| Sign Out | `sbClient.auth.signOut()` | Session termination |
| Get Session | `sbClient.auth.getSession()` | Check existing session |
| Reset Password | `sbClient.auth.resetPasswordForEmail(email, {redirectTo})` | Send reset email |
| Update Password | `sbClient.auth.updateUser({password})` | Set new password |
| Auth State Change | `sbClient.auth.onAuthStateChange(callback)` | Listen for auth events |

### Database Operations (via Supabase JS Client)

#### Reads

| Operation | Table | Filters | Used By |
|-----------|-------|---------|---------|
| Load all active races | `races` | `is_active=true` | `loadCheckpointsFromSupabase` |
| Load checkpoints for races | `checkpoints` | `race_id IN (activeIds)`, order by `cp_order` | `loadCheckpointsFromSupabase` |
| Fetch runner history | `check_ins` | `runner_id=X`, order by `timestamp` | Map coloring, History drawer |
| Fetch all runner history | `check_ins` | `runner_id=X`, order by `timestamp` | History drawer |
| Fetch last check-in | `check_ins` | `runner_id=X, race_id=Y`, limit 1 | Elapsed time calculation |
| Fetch report data | `check_ins` | Date range + race/admin filter | Report generation |
| Load admin list | `admins` | `is_active=true`, order by `created_at` | Super admin screen |
| Load runner list | `runners` | `race_id=adminCode`, order by `name` | Deltakere screen |
| Check existing winner | `winners` | `month=X, year=Y, admin_code=Z` | Duplicate prevention |
| Load winner history | `winners` | `winner_id=X OR winner_name=Y` | Winner notification |
| System counts | All tables | `count: 'exact', head: true` | Status dashboard |
| Resolve runner on login | `runners` | `id=userId` | `onAuthSuccess` |
| Resolve admin on login | `admins` | `email=userEmail, is_active=true` | `onAuthSuccess` |
| Check admin code validity | `admins` | `admin_code=X, is_active=true` | Signup, Link admin |

#### Writes

| Operation | Table | Data | Used By |
|-----------|-------|------|---------|
| Save runner | `runners` | `{id, name, email, race_id}` | Signup, first login |
| Update runner | `runners` | `{name, email}` | Login (existing runner) |
| Save check-in | `check_ins` | Full check-in record | Registration |
| Create race | `races` | `{admin_code, race_id, name}` | Trip creation |
| Create checkpoint | `checkpoints` | `{race_id, cp_order, name, lat, lng}` | Trip creation |
| Delete checkpoints | `checkpoints` | Where `race_id=X` | Trip deletion |
| Deactivate race | `races` | `{is_active: false, is_current: false}` | Trip deletion |
| Activate race | `races` | Set `is_current` for admin's races | Race activation |
| Add admin | `admins` | `{email, admin_code, is_active: true}` | Super admin |
| Deactivate admin | `admins` | `{is_active: false}` | Super admin |
| Reactivate admin | `admins` | `{is_active: true}` | Super admin |
| Link runner to admin | `runners` | `{race_id: code}` | Link admin popup |
| Remove runner from admin | `runners` | `{race_id: null, prev_race_id: old}` | Deltakere screen |
| Save winner | `winners` | Full winner record | Drawing |

### Realtime Subscriptions

Channel name: `live-updates`

| Table | Event | Filter | Handler |
|-------|-------|--------|---------|
| `check_ins` | INSERT | `runner_id=eq.{userId}` | Mark checkpoint done, refresh drawer |
| `checkpoints` | INSERT | (none) | Reload checkpoints + rebuild markers |
| `checkpoints` | DELETE | (none) | Reload checkpoints + rebuild markers |
| `races` | UPDATE | (none) | Full refresh for runners; refresh UI for admins |
| `runners` | * | (none) | Refresh Deltakere screen (admins only) |
| `winners` | INSERT | (none) | Notify winner (toast + vibration) |
| `admins` | UPDATE | (none) | Notify runner if admin deactivated |

### External APIs

| API | Purpose | URL Pattern |
|-----|---------|-------------|
| OSRM Foot Routing | Walking route between points | `https://routing.openstreetmap.de/routed-foot/route/v1/foot/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson` |
| OSRM Car Routing | Driving route (shorter distance fallback) | `https://routing.openstreetmap.de/routed-car/route/v1/driving/...` |
| OSRM Nearest | Snap checkpoint to nearest road | `https://routing.openstreetmap.de/routed-foot/nearest/v1/foot/{lng},{lat}` |
| Kartverket GeoNorge | Norwegian place name search | `https://ws.geonorge.no/stedsnavn/v1/navn?sok={query}&fuzzy=true` |
| Nominatim OSM | Geocoding fallback | `https://nominatim.openstreetmap.org/search?q={query}&countrycodes=no` |
| EmailJS | Send report emails | Via `emailjs.send()` SDK |

### EmailJS Configuration
```
Service:    service_mf2avgt
Template:   template_64ke7fc
Public Key: VrIDl9-cEJGl6LTAY
```

---

## PHASE 7 — APPLICATION ARCHITECTURE

### Architecture Pattern
**Single-Page Application (SPA)** — No framework, vanilla JavaScript with procedural architecture.

### Module Map (Logical Sections in index.html)

```
├── CSS (~670 lines)
│   ├── CSS Variables / Design Tokens
│   ├── Screen layouts
│   ├── Component styles
│   └── Animation keyframes
│
├── HTML (~380 lines)
│   ├── Splash loader
│   ├── Offline banner
│   ├── Login screen (3 sub-forms)
│   ├── Reset password screen
│   ├── Main screen (header + map + button)
│   ├── Super admin screen
│   ├── Checkpoint admin screen
│   ├── Løpere screen
│   ├── New race screen
│   ├── Rapport screen
│   ├── History drawer
│   ├── Status drawer
│   ├── Link admin popup
│   ├── GPS overlay
│   ├── Toast container
│   ├── iOS banner
│   ├── Android install button
│   └── Map picker overlay
│
├── JavaScript (~3550 lines)
│   ├── CONFIG — Constants and configuration
│   ├── GLOBALS — State variables
│   ├── PWA — Manifest injection
│   ├── SUPABASE — Client init + CRUD operations
│   ├── LOCAL STORAGE — Persistence helpers
│   ├── NAVIGATION — Screen switching
│   ├── TOAST — Notification system
│   ├── GPS BAR — Status indicator
│   ├── GPS OVERLAY — Permission instructions
│   ├── MAP INIT — Leaflet setup
│   ├── MAP MARKERS — Checkpoint rendering
│   ├── MAP POSITION — Blue dot + animation
│   ├── MAP ARROW — Route to nearest checkpoint
│   ├── COMPASS WIDGET — Directional compass
│   ├── DISTANCE — Haversine formula
│   ├── HISTORY DRAWER — Check-in history
│   ├── REGISTRATION — Check-in logic
│   ├── AUTH — Login/signup/signout
│   ├── REALTIME — Supabase subscriptions
│   ├── RAPPORT — Reports + leaderboard + winner
│   ├── SUPER ADMIN — Admin CRUD
│   ├── CHECKPOINT ADMIN — Trip/checkpoint management
│   ├── RUNNERS — Participant management
│   ├── PWA SETUP — iOS banner, Android install, pull-to-refresh
│   ├── INIT — DOMContentLoaded bootstrap
│   ├── MAP PICKER — Location selection overlay
│   └── AUTO-UPDATE — ETag version check
```

### State Management
- **Global variables** (`let`/`const` at module scope)
- **localStorage** for persistence (track, cooldowns, winner seen, iOS banner dismissed)
- **sessionStorage** for app version ETag
- **Supabase Auth session** for authentication state
- **No framework state management** (no Redux, no stores)

### Key Global State Variables

| Variable | Type | Purpose |
|----------|------|---------|
| `sbClient` | Object | Supabase client instance |
| `currentUser` | Object | `{id, name, email, adminCode, raceId}` |
| `leafletMap` | L.Map | Leaflet map instance |
| `positionMarker` | L.CircleMarker | User's blue GPS dot |
| `cpMarkers` | Object | `{key: L.CircleMarker}` checkpoint markers |
| `doneCheckpoints` | Set | Compound keys `"raceId_order"` of completed checkpoints |
| `CONFIG.CHECKPOINTS` | Array | Currently loaded checkpoints `[{id, order, name, lat, lng, raceId, snapLat?, snapLng?}]` |
| `trackPoints` | Array | GPS track `[[lat,lng],...]` |
| `smoothedPos` | Object | EMA-smoothed `{lat, lng}` |
| `bestRecentPos` | Object | Most accurate reading from last 10s |
| `realtimeChannel` | Object | Supabase Realtime channel |
| `arrowLine` | L.Polyline | Red route line to nearest checkpoint |
| `_compassHeading` | Number | Device orientation in degrees |

### Dependency Graph

```
Supabase JS v2 (CDN) ─── Auth, Database, Realtime
Leaflet 1.9.4 (CDN) ──── Map rendering, markers, polylines
XLSX 0.18.5 (CDN) ─────── Excel file generation
EmailJS Browser 4 (CDN) ─ Email report delivery
Google Fonts (CDN) ────── Inter font family
OSRM (external) ────────── Route calculation
Kartverket (external) ──── Norwegian place search
Nominatim (external) ───── Geocoding fallback
```

---

## PHASE 8 — CODE STRUCTURE RECONSTRUCTION

### File System

```
/tur/
├── index.html      # Entire application (~4200 lines, ~170KB)
├── logo.png        # App logo/icon (128x128, used in login + PWA)
└── .gitignore      # Git ignore rules
```

### Naming Conventions
- **Functions**: camelCase (`loadCheckpointsFromSupabase`, `renderAdminList`)
- **Private/internal**: underscore prefix (`_doneKey`, `_fetchOsrmRoute`, `_clearArrow`)
- **Constants**: UPPER_SNAKE_CASE (`CONFIG`, `COOLDOWN_MS`, `LS_TRACK`)
- **DOM IDs**: camelCase (`loginScreen`, `registerBtn`, `gpsBar`)
- **CSS classes**: kebab-case (`app-header`, `gps-bar`, `btn-green`)
- **CSS variables**: kebab-case with `--` prefix (`--green`, `--shadow-sm`)
- **LocalStorage keys**: snake_case with prefix (`loypesjekk_log`, `raceRoute_v2`)

### Design System

#### Color Palette
| Token | Hex | Usage |
|-------|-----|-------|
| `--green` | #0EA371 | Primary brand, buttons, accents |
| `--green-dk` | #0B7D57 | Dark variant, gradients |
| `--green-lt` | #E6F9F3 | Light backgrounds |
| `--red` | #EF4444 | Errors, delete buttons, visited checkpoints |
| `--amber` | #C9A800 | Warnings, route lines |
| `--bg` | #F5F7FA | Page background |
| `--surface` | #FFFFFF | Card backgrounds |
| `--text` | #0D1117 | Primary text |
| `--text-2` | #374151 | Secondary text |
| `--muted` | #6B7280 | Tertiary text |
| Purple | #6D28D9 / #8B5CF6 | Winner drawing feature |
| Blue | #3B82F6 | User position, email button |
| Red (arrow) | #FF6B6B | Navigation arrow/route |

#### Typography
- Font: Inter (400, 500, 600, 700, 800) with system fallbacks
- Base size: 16px, line-height: 1.5
- Weights used: 400 (body), 600 (labels), 700 (headings), 800 (numbers/emphasis)

#### Spacing & Radius
- `--radius`: 14px (cards)
- `--radius-sm`: 10px (buttons, inputs)
- Safe area insets respected via CSS `env()`

#### Shadows
- `--shadow-sm`: Subtle card shadow
- `--shadow-md`: Medium elevation
- `--shadow-lg`: High elevation (modals, login box)

#### Buttons
- `.btn`: 52px min-height, 100% width, 700 weight
- `.btn-green`: Green gradient with shadow, scale(0.97) on active
- `.btn-gray`: Gray background, disabled appearance
- `.btn-blue`: Blue gradient (email button)
- `:disabled`: 50% opacity, no-cursor

#### Animations
- `pulse`: GPS yellow dot pulsing (1.4s infinite)
- `spin`: Spinner rotation (0.7s linear infinite)
- `cp-expand`: Checkpoint pulse ring expansion (1.8s ease-out infinite)
- Position marker: 60fps lerp interpolation (ANIM_LERP = 0.18)

---

## PHASE 9 — SECURITY AUDIT

### Authentication
- **Provider**: Supabase Auth (email/password)
- **Session**: JWT stored by Supabase client (localStorage)
- **Password requirements**: Minimum 6 characters (client-side + Supabase default)
- **Password reset**: Email-based with Supabase `resetPasswordForEmail`
- **Email confirmation**: Supported (configurable in Supabase Dashboard)

### Authorization
- **Model**: Role-Based Access Control (RBAC) with 3 levels
- **Implementation**: Client-side UI hiding + Supabase Row Level Security (RLS)
- **Super admin identification**: Hardcoded email comparison (`CONFIG.ADMIN_EMAIL`)
- **Admin identification**: Email lookup in `admins` table
- **Runner identification**: Presence in `runners` table

### Identified Security Considerations

| # | Area | Finding | Severity | Confidence |
|---|------|---------|----------|------------|
| S1 | Credentials in source | Supabase URL + anon key in client code | LOW | 100% — Anon key is designed to be public; RLS policies enforce access |
| S2 | EmailJS keys in source | Service/template/public keys exposed | LOW | 100% — EmailJS public key is designed for client use |
| S3 | Super admin hardcoded | `CONFIG.ADMIN_EMAIL` in source code | MEDIUM | 100% — Anyone can see who the super admin is |
| S4 | Client-side permission checks | Admin buttons hidden via `style.display` | MEDIUM | 100% — RLS must enforce server-side; UI hiding is convenience only |
| S5 | Delete race guard | Client-side ownership check in `deleteRace()` | MEDIUM | 100% — Should also be enforced by RLS policy |
| S6 | No rate limiting on check-ins | Only client-side 1h cooldown | LOW | 95% — Supabase may have rate limits configured |
| S7 | XSS protection | `escHtml()` used for user-generated content | LOW | 95% — Consistent usage observed |
| S8 | No CSRF | SPA with JWT auth (no cookies for auth) | NONE | 100% — JWT-based auth is inherently CSRF-resistant |

### Data Privacy
- GPS coordinates recorded with each check-in
- Email addresses stored in runners and admins tables
- No explicit GDPR consent flow visible
- No data deletion feature for users
- Winner names publicly visible to admins

---

## PHASE 10 — PERFORMANCE

### Optimization Strategies Used
1. **60fps position animation**: RequestAnimationFrame with lerp interpolation
2. **Adaptive GPS smoothing**: EMA filter with accuracy-dependent alpha (0.25–0.7)
3. **Nearest checkpoint caching**: `_nearestCache` avoids recalculation when position unchanged
4. **Route caching**: OSRM routes cached in localStorage with coordinate fingerprint
5. **OSRM debouncing**: 200ms debounce + 30m movement threshold before refetch
6. **Parallel API calls**: `Promise.all` for concurrent route fetching (foot + car)
7. **Track point throttling**: Only add to track if moved ≥2m
8. **Track save throttling**: 5s debounce on localStorage writes
9. **Track trimming**: Maximum 800 points stored
10. **Parallel login queries**: Admin + runner lookups run concurrently
11. **Lazy checkpoint loading**: Loaded only after successful auth

### Potential Performance Issues
- **Single HTML file (170KB)**: No code splitting, entire app loaded at once
- **Snap-to-road on load**: Parallel OSRM requests for ALL checkpoints on every load
- **No image lazy loading**: Map tiles handled by Leaflet (efficient)
- **No service worker**: No offline caching of static assets
- **LocalStorage usage**: Multiple reads/writes per GPS update cycle

### Startup Sequence
1. DOM loads → `init()` fires
2. Inject PWA manifest
3. Initialize Supabase client
4. Setup pull-to-refresh, offline banner, iOS banner, Android install
5. Wire up all event listeners
6. Check URL hash for recovery/reset flows
7. Check existing session → auto-login if valid
8. Remove splash loader (350ms animation)
9. On auth success: Load checkpoints → Init map → Load history → Start GPS → Start Realtime

---

## PHASE 11 — UX ANALYSIS

### Strengths
- **Clean, modern visual design**: Consistent green palette, rounded corners, appropriate shadows
- **Mobile-first**: Safe area insets, touch target sizing (min 48px), viewport meta tags
- **Progressive disclosure**: Admin features hidden from regular users
- **Immediate feedback**: GPS status bar, proximity alerts, registration confirmation
- **Accessibility of map**: Tooltips on markers, legend explaining colors
- **Smooth animations**: No jarring transitions, 60fps position updates

### Accessibility Concerns
- **No ARIA labels** on interactive elements
- **No skip navigation** links
- **Color-only differentiation** for checkpoint status (green vs red) — colorblind users may struggle
- **No keyboard navigation** support beyond native browser behavior
- **No screen reader considerations** for map interactions
- **Small font sizes**: 0.72rem (11.5px) used for some labels — below WCAG minimum
- **Touch targets**: Most buttons meet 48px minimum, but some link-style buttons are smaller

### Responsive Design
- **Viewport**: `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no`
- **Layout**: Flexbox-based, full-height screens with `100dvh`
- **Max widths**: Login box 380px, history drawer min(85vw, 360px), toast min(92vw, 420px)
- **No landscape-specific layout** — works but not optimized

---

## PHASE 12 — BUSINESS RULE DISCOVERY

### Check-in Rules
1. Runner must be within 20m of checkpoint (`MAX_DISTANCE_METERS`)
2. Runner must have an active race link (`currentUser.raceId`)
3. Same checkpoint can only be registered once per day (per race)
4. Client-side 1-hour cooldown per checkpoint (localStorage)
5. GPS accuracy must be reasonable (>50m readings ignored unless no prior position)
6. Uses best reading from last 10 seconds for registration (not instantaneous GPS)

### Winner Drawing Rules
1. One winner per month per admin (`UNIQUE(month, year, admin_code)`)
2. Only runners who visited ALL checkpoints in the period are eligible
3. Random selection from eligible pool
4. Winner receives real-time notification (toast + vibration pattern: 200-100-200-100-400ms)
5. Winner notification also checked on login (for offline users)
6. Winner badge displayed in history drawer

### Admin/Runner Linking
1. Runner provides admin code during signup or via Link Admin popup
2. Runner's `race_id` field stores the admin_code (not a race_id — naming inconsistency)
3. When admin is deactivated, runner's link is cleared + `prev_race_id` preserved
4. If admin is reactivated, runner's link is automatically restored on next login
5. Runner can manually change admin via "Bytt arrangør" button

### Race/Trip Rules
1. Each race belongs to one admin (via `admin_code`)
2. A race can be active or inactive (`is_active`)
3. One race per admin can be "current" (`is_current`) — determines which race runners check into
4. All checkpoints from ALL active races are visible to ALL users
5. Check-ins are recorded under the runner's own admin's current race
6. Admin can only delete their own races; super admin can delete any race
7. Deleting a race: Removes all checkpoints + sets `is_active=false, is_current=false`

### Admin Code Generation
- Character set: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (excludes I, O, 0, 1 for readability)
- Length: 6 characters
- Uniqueness verified against database before insertion

---

## PHASE 13 — HIDDEN FEATURE DISCOVERY

### Auto-Update Mechanism (line 3986–3999)
On every page load, performs a HEAD request to its own URL. Compares ETag/Last-Modified with sessionStorage. If changed, forces `window.location.reload(true)`. This ensures users always get the latest version without manual cache clearing.

### Race Route Drawing (disabled, line 3598)
`drawRaceRoute()` is implemented but immediately returns. The full OSRM-based route drawing between sequential checkpoints exists in `_drawRaceRouteInner()` but is disabled. The route would be drawn as amber (#C9A800) dashed lines, cached in localStorage with coordinate-based fingerprinting.

### Coordinate Parsing (line 3157–3182)
Supports multiple coordinate formats:
- Google Maps long URLs: `@lat,lng`
- Query parameters: `?q=lat,lng` or `?ll=lat,lng`
- Decimal: `59.9510 10.7732`
- DMS: `59°57'03.5"N 10°46'23.7"E`

### Previous Admin Recovery (line 2436–2444)
If a runner's admin was deactivated (clearing `race_id`), the old code is saved in `prev_race_id`. On next login, if the old admin has been reactivated, the link is automatically restored — invisible to the user.

### Admin Email Auto-Detection (line 3784–3789)
During signup, when the email field loses focus, the app checks if that email is registered as an admin. If so, the "Deltakerkode" field is automatically hidden — admins don't need a participant code.

### Map Legend Items
- "Neste sted" (red line) legend item is hidden for super admin
- "Turrute" (yellow route) legend item still visible but route drawing is disabled

### Pending Refresh System (line 1120–1141)
A deferred refresh mechanism: Realtime events set `_pendingRefresh = true`. The actual refresh (`_doFullRefresh`) only triggers on the next user interaction (touch/click), avoiding expensive refreshes while the user isn't looking.

### Best Recent Position (line 1478–1481)
Instead of using the instantaneous GPS reading for check-in, the system keeps the most accurate reading from the last 10 seconds. This prevents GPS drift causing false distance calculations at the moment of registration.

---

## PHASE 14 — MOBILE RECONSTRUCTION RECOMMENDATION

### Recommended Native Stack

| Platform | Framework | Justification |
|----------|-----------|---------------|
| Cross-platform | React Native or Flutter | Single codebase for iOS + Android; map SDK available |
| State Management | Zustand (RN) / Riverpod (Flutter) | Lightweight, suitable for app complexity |
| Map | react-native-maps / google_maps_flutter | Native performance for GPS + map interaction |
| Backend | Keep Supabase | Already integrated, Supabase has native SDKs |

### Key Migration Considerations
1. **GPS background tracking**: Native apps can track in background (PWA cannot)
2. **Push notifications**: Replace Realtime toasts with FCM/APNs push notifications
3. **Offline sync**: Native SQLite with Supabase offline sync
4. **Biometric auth**: TouchID/FaceID for quick login
5. **Deep links**: `tur://join/{adminCode}` for invitation links

---

## PHASE 15 — TEST ENGINEERING

### Recommended Test Cases

#### Unit Tests
- `haversineMeters()`: Known coordinate pairs → expected distances
- `_doneKey()`: Compound key generation
- `_isDone()`: Set membership check
- `parseCoordsFromText()`: All format variants (Google Maps, decimal, DMS)
- `formatElapsed()`: Various second values → formatted strings
- `escHtml()`: XSS prevention (angle brackets, ampersands)
- `genAdminCode()`: Length=6, valid characters only
- `findNearestCheckpoint()`: Multiple checkpoints → correct nearest

#### Integration Tests
- Login flow → session creation → main screen display
- Sign up → runner creation in DB → admin code validation
- Check-in → Supabase insert → checkpoint marker color change
- Winner drawing → duplicate prevention → notification
- Admin CRUD → realtime propagation to other clients
- Race creation → checkpoint creation → map update

#### E2E Test Scenarios
- Complete runner journey: Register → Login → Visit checkpoint → Check history
- Admin journey: Login → Create trip → Add checkpoint → Draw winner
- Super admin: Add admin → Create trip under admin → Generate report
- Offline scenario: Disconnect → attempt check-in → verify local storage
- Multi-device: Runner checks in → admin sees update in real-time

---

## PHASE 16 — DEVOPS

### Current Deployment
- **Hosting**: GitHub Pages (static file serving from repository)
- **CI/CD**: Manual git push (no automated pipeline)
- **Branch strategy**: Feature branches (`claude/focused-albattani-g9qctk`) merged to default
- **Monitoring**: None (no crash reporting, no analytics)
- **Logging**: `console.warn`/`console.error` only (browser console)

### Recommended Infrastructure
1. **CDN**: Cloudflare or Vercel for edge caching + HTTPS
2. **Monitoring**: Sentry for error tracking
3. **Analytics**: Plausible or PostHog for privacy-friendly analytics
4. **Uptime**: UptimeRobot for availability monitoring
5. **Supabase monitoring**: Built-in dashboard for DB performance

---

## PHASE 17 — COMPLETE DOCUMENTATION INDEX

This document serves as the comprehensive reconstruction specification for the TUR application. It covers:

- [x] Software Requirements Specification (Phases 1, 4, 12)
- [x] Product Requirements Document (Phases 1, 3)
- [x] Functional Specification (Phases 2, 3, 4)
- [x] Technical Specification (Phases 5, 6, 7, 8)
- [x] Architecture Decision Records (Phase 7)
- [x] API Documentation (Phase 6)
- [x] Database Documentation (Phase 5)
- [x] UI Documentation (Phase 2)
- [x] UX Documentation (Phase 11)
- [x] Security Documentation (Phase 9)
- [x] Performance Documentation (Phase 10)
- [x] Mobile Migration Guide (Phase 14)
- [x] Test Engineering Plan (Phase 15)
- [x] DevOps Documentation (Phase 16)

---

## PHASE 18 — VISUAL MAPS

### Application Map (Screen Navigation)

```
                    ┌─────────────────┐
                    │   Splash Screen  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
               ┌────│   Login Screen   │────┐
               │    └────────┬────────┘    │
               │             │             │
      ┌────────▼───────┐     │     ┌───────▼────────┐
      │  Sign Up Form   │     │     │  Reset Form     │
      └────────┬───────┘     │     └───────┬────────┘
               │             │             │
               └─────────────▼─────────────┘
                             │
                    ┌────────▼────────┐
                    │   Main Screen    │
                    │   (Map + GPS)    │
                    └──┬──┬──┬──┬──┬──┘
                       │  │  │  │  │
          ┌────────────┘  │  │  │  └─────────────┐
          │               │  │  │                 │
   ┌──────▼─────┐  ┌─────▼──▼──▼─────┐   ┌──────▼──────┐
   │  Historikk  │  │    Rapport      │   │   Admins     │
   │  (Drawer)   │  │    Screen       │   │   Screen     │
   └─────────────┘  └────────────────┘   └─────────────┘
                       │          │
              ┌────────┘    ┌─────┘
              │             │
   ┌──────────▼──┐  ┌──────▼──────┐
   │ Sjekkpunkter │  │  Deltakere   │
   │   Screen     │  │   Screen     │
   └──────┬───────┘  └─────────────┘
          │
   ┌──────▼───────┐     ┌──────────────┐
   │  Adm. turer   │────▶│  Map Picker   │
   │   Screen      │     │  (Overlay)    │
   └───────────────┘     └──────────────┘
```

### Permission Matrix

```
Feature              Super Admin    Admin    Runner
─────────────────────────────────────────────────
Login                    ✓            ✓        ✓
Map View                 ✓            ✓        ✓
GPS Tracking             ✗            ✓        ✓
Register Check-in        ✗            ✓        ✓
View History             ✗            ✓        ✓
Change Admin Link        ✗            ✗        ✓
View Reports             ✓            ✓        ✗
Download Excel           ✓            ✓        ✗
Email Report             ✓            ✓        ✗
Draw Winner              ✓            ✓        ✗
View Checkpoints         ✓            ✓        ✗
Create/Delete Trips      ✓(all)       ✓(own)   ✗
Manage Participants      ✗            ✓        ✗
Manage Admins            ✓            ✗        ✗
System Status            ✓            ✗        ✗
Red Navigation Arrow     ✗            ✓        ✓
Compass Widget           ✗            ✓        ✓
Progress Badge           ✓            ✓        ✓
Receive Win Notification ✗            ✓        ✓
```

---

## PHASE 19 — CONFIDENCE ANALYSIS

| Assumption | Confidence | Evidence | Risk if Wrong |
|-----------|-----------|---------|---------------|
| Supabase is the only backend | 99% | All data operations use sbClient; no other API calls besides OSRM/Kartverket/Nominatim | Different backend would need different integration |
| RLS policies exist on Supabase | 85% | Client uses anon key; security depends on RLS; winners table had specific policy issues noted in session history | If no RLS, any user could read/write all data |
| `runners.race_id` stores admin_code not race_id | 99% | Code clearly shows `race_id: adminCode` in multiple places; naming is misleading | Data model misunderstanding would cause incorrect runner-admin linking |
| Only one checkpoint per trip | 90% | `createRace` creates exactly one checkpoint; `_loadRaceDestination` uses `limit(1)` | If multiple checkpoints per trip exist, admin UI doesn't fully support it |
| Winners table has UNIQUE(month, year, admin_code) | 95% | Error code 23505 explicitly caught; duplicate check before insert | Without constraint, duplicate winners could be drawn |
| No server-side validation of check-in distance | 80% | No RLS policy visible that checks GPS distance; only client-side 20m check | Users could forge check-ins via API |
| App is hosted on GitHub Pages | 75% | Single static HTML file + logo.png; no server-side code; GitHub repo structure | Different hosting would need different deployment |
| No service worker exists | 99% | No SW registration in code; no sw.js file in repo | If SW existed elsewhere, caching behavior would differ |
| EmailJS sends to super admin email only | 90% | Template sends to `currentUser.email` which is the admin's email | Template configuration could differ |
| The 20m distance threshold is intentional | 95% | `MAX_DISTANCE_METERS: 20` in CONFIG with comment about "race day" | Changing threshold affects fraud prevention vs. usability |

---

*Document generated: June 2026*
*Source: Complete analysis of /home/user/tur/index.html (4200 lines, 170KB)*
*Confidence: This document captures >95% of all application behavior, with remaining uncertainty in Supabase-side configuration (RLS policies, triggers, functions) which are not visible from client code.*
