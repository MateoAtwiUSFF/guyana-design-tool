# Guyana cost research (November 2026)

These are the starting values in `src/estimator/settings.ts`. Change them on the admin page (`/admin`).

**Exchange rate:** US$1 = G$208.50. That is the Guyana Revenue Authority (GRA) customs rate from 1 Nov 2026. Bank of Guyana and market rates were G$208.8–209.6 through mid-2026.

Guyana publishes no construction-cost index, and no hardware store posts public price lists. The best local source found is a line-item estimate from BackHome Developments: a 2,852 sq ft two-storey house in Golden Grove, priced in May 2026 at G$20,574 per sq ft (https://backhomedevelopments.com/cost-to-build-house-guyana/). The builder now quotes G$28,000–32,000 per sq ft. Values marked **US-adj** are US prices plus 30–50% for import, so they have the lowest confidence. **Check them against quotes from Gafoors and National Hardware.**

| Setting | Default (USD) | Basis | Confidence |
|---|---|---|---|
| Slab material / labour per sq ft | 6 / 3.5 | US-adj; a full block-house foundation in the BackHome estimate is US$27–36/sq ft | low |
| Footing material / labour per lft | 15 / 8 | US-adj | low |
| Fibre cement board, per sq ft | 1.5 mat / 1.5 lab | 8 mm 4x8 sheet US$31–46 (US-adj) | low |
| Hardie plank | 2.5 / 2.5 | installed US$5.8–9.6/sq ft (US-adj) | low |
| Plywood | 1.3 / 1 | 1/2" sheet US$34–48 (US-adj) | low |
| Plaster over cement board | 2.2 / 2.5 | installed US$3.4–6.2/sq ft | low |
| Vinyl siding | 2.8 / 2 | material US$2.2–3.8/sq ft | low |
| Zinc / galvalume roof | 2.2 / 1.5 | BackHome: whole roof about US$9.6–12.5/sq ft including framing | low–med |
| Window material per sq ft of opening / install each | 10 / 100 | BackHome: casement about US$103 material + US$129 install | med |
| Exterior / interior door material, install each | 550 / 140, 90 | BackHome: average door US$570 installed | med |
| Drywall | 0.45 / 1.5 | 1/2" sheet G$1,800–2,500 | low–med |
| Paint per sq ft of wall | 0.6 / 1.0 | Torginol emulsion G$7,595/gal; labour worked out from BackHome | med |
| Insulation | 1.0 / 0.6 | rarely used in Guyana; US-adj | low |
| Floor tile | 2.5 / 4 | BackHome tile material G$410/sq ft | med |
| Bathroom set, kitchen | 1,500+900, 6,000+1,500 | US-adj; BackHome large kitchen US$15,350 | low |
| Electrical per sq ft of floor | 7 / 5 | BackHome about US$11–12.5 | med |
| Plumbing per sq ft of floor | 4.5 / 3.5 | BackHome about US$7.7–8.6 | med |
| Water tank + pump; septic + soakaway | 9,200; 8,600 | BackHome | med |

Labour day rates (guyanadirectory, 2026): carpenter or mason G$8,000–15,000, labourer G$4,000–7,000, legal minimum G$2,776.

Sanity check, whole house: standard spec G$28,000–32,000 per sq ft (US$134–153). Government turnkey housing is about G$11,500 per sq ft.
