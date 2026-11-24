# guyana-design-tool
design tool for designing a house or commercial building then estimating the framing cost

Objectives:

Mobile
- easy to use on mobile to draw a house in a 2D view then rotate around in 3D and have pleasant 3D views. Place windows, doors, bathrooms, bedrooms, staging the interior
- automatic roof design tool: simple gable (overhang parameter), hip roof (overhang parameter), flat roof (parapet parameter)
- select exterior finishes and colors

Desktop
- easy to use desktop version
- advanced desktop version that allows complex roof designs

Outcomes:
- Show framing labor and material, foundation material and labor, and other material and labor
- estimated cost of framing walls allow admin to change all these settings in a custom admin page
- All 16" OC
- Single story structures 25' and under are 20 ga 3 5/8" studs for walls
- Two story structures are 18 ga 3 5/8" studs
- Three story structures are BTB 6" 18 ga studs first floor, and single 6" studs second and third floor
- Four story structures are dependent on engineering don't give a cost
- framing labor is 80% of framing cost estimated
- floor framing
- spans of under 15' can be joists $3 per sqft USD material only - floors and flat roofs only.
- spans over 15' are trusses $8 per sqft USD including material and assembly labor - all roof types
- spans over 25' are trusses $10 per sqft USD including material and assembly labor - all roof types
- spans over 32' are trusses $12 per sqft USD including material and assembly labor - all roof types
- estimate the other costs based on selections such as siding (cement board, plywood, hardie, etc.

User accounts:
- don't force login
- create a main website for general marketing
- create a subdomain web app with the above
- ask for login to save work
- simple facebook login
- easy to share on facebook
- flyaround video export on tiktok and facebook
- shareable designs

- Goal is to make this app also educational
- Share links to guyanaframe.com and US Frame Factory youtube videos


---

## Status (build 1)

Built so far: the design app (`design.guyanaframe.com`), the estimator, and the admin page. The marketing site is the existing guyanaframe.com (`US-Frame-Factory/fsg-website`).

| Area | State |
|---|---|
| 2D drawing (mobile + desktop): house rectangle, outside/inside walls, windows, doors, rooms, furniture, drag to edit, undo/redo, pinch zoom | done |
| 3D view: walls with real openings, floors, staged rooms and furniture, gable / hip / flat (parapet) roofs, raised house on piers, look inside each floor | done |
| Exterior finishes and colours | done |
| Estimate in GYD: framing, foundation, other; each split into material and labour, with an explanation per line and a steel parts list | done |
| Admin page `/admin`: every number, in USD with the GYD equivalent | done (saved in the browser; see below) |
| Share link (no login), Facebook / WhatsApp share, fly-around video (MP4 where the browser supports it) | done |
| Learn panel: framing basics, US Frame Factory videos, links to guyanaframe.com | done |
| Facebook login, saving designs to an account, server-side admin settings | next: needs a Supabase project |
| Advanced desktop roof designer (complex roofs) | later |

## Working on it

```bash
npm install
npm run dev        # http://localhost:5173  (admin: /admin)
npm test           # estimator tests
npm run build
```

## How the estimate works

All rules live in `src/estimator/`; all numbers live in `src/estimator/settings.ts` and are editable on `/admin`.

- **Steel parts** use the USFF ERP's pricing method: price per lft = (lb/ft × coil $/lb ÷ yield + lb/ft × overhead + roll-forming labour) ÷ (1 − margin). Weights come from the ERP's profile table. The steel price per gauge is set on the admin page.
- **Walls**: studs at 16" OC plus top and bottom track. Each window or door gets 2 / 3 / 4 studs per side (1 / 2 / 3 stories), a box header (2 studs + 2 tracks of the wall's size and gauge), cripples above and below, and a sill track. Corners and tees get extra studs. Waste is added.
- **Stud rules**: single story up to 25 ft wide uses 20 ga 3-5/8"; two story uses 18 ga 3-5/8"; three story uses 6" 18 ga, back-to-back on the first floor. Four or more stories, or walls taller than the 9 ft limit, show "needs engineering" and no price.
- **Framing labour** = 80% of the framing material.
- **Floors / roofs**: spans up to 15 ft use joists at $3/sq ft (material only; floors and flat roofs). Longer spans use trusses at $8 (to 25 ft) / $10 (to 32 ft) / $12 (over 32 ft), including material and assembly. A span exactly on a limit takes the lower rate. Pitched roofs always use trusses.
- **Other costs** (foundation, siding, roofing, windows, doors, drywall, paint, insulation, tile, electrical, plumbing, bathrooms, kitchen, water tank, septic) start from the Guyana research in `docs/cost-research.md`.
