# SoiréeSource — Emerald Editorial Luxury Design Direction

## Purpose and source status

These are stakeholder-supplied visual references from the SoiréeSource second-meeting design discussion. They communicate visual character, not a request to clone another app or adopt fintech features. The implementation must adapt their language to an event-services marketplace on desktop and mobile. Preserve SoiréeSource's own identity, copy, logo, brand tagline, and role-specific workflows.

### Reference images

- `references/fintech-dark-light-ui.png`: six mobile concept screens, three dark and three light, showing luminous emerald header surfaces, nested rounded cards, outlined circular quick actions, glossy promotional panels, segmented chips, image-led smaller content cards, and compact navigation.
- `references/emerald-material-palette.png`: deep emerald / olive emerald / pale beige swatches on a tactile draped fabric background, suggesting elegant organic lighting and restrained luxury.

The palette image explicitly lists three foundation hex colors; the supporting colors below are **proposed**, not existing stakeholder-approved brand tokens.

## Style definition

**Emerald Editorial Luxury**: premium fintech-inspired information architecture + atmospheric emerald gradients + subtle glassmorphism + card-based modular layout + event-industry editorial imagery and typography.

Desired character: refined, immersive, trustworthy, welcoming, contemporary, premium, tactile, uncluttered, elegant, quiet confidence.

Avoid: crypto/banking metaphors, giant currency balances, excessive neon, generic neon-cyberpunk, heavily frosted unreadable text, glossy controls everywhere, fake metallic gold, copy-pasting the reference app's layouts, gradient overload, stock-dashboard sameness, tiny low-contrast text, arbitrary animation.

## Foundation color tokens

Source-derived swatches:
- Deep emerald: `#02110C` (primary dark canvas / immersive hero anchor).
- Olive emerald: `#1A422F` (secondary dark surface / primary deep brand green).
- Cream beige: `#F3EBD6` (source swatch, use only as occasional warm accent where appropriate; client wants a cooler silver impression overall).

Recommended silver-neutral refinements (subject to visual/contrast QA):
- Silver mist: `#E8EEEA`
- Pearl white: `#F5F7F4`
- Pure raised surface: `#FFFFFF`
- Midnight elevated surface: `#0B241B`
- Mid emerald surface: `#123124`
- Dark ink: `#102B20`
- Soft foliage text: `#64756D` (validate contrast)
- Emerald glow: `#21B987` (reserve for CTA glints, active state, or rare accent; never use as large unreadable text)
- Light border: `#D8E2DA`
- Dark border: `#345B49`

Use light/dark semantic CSS variables and separate gradient/elevation tokens. Preserve existing status semantics for success, error, warning, and disabled states, with accessible contrast. Do not use the original beige as the dominant base background if it reads yellow/gold.

## Visual rules

1. Atmospheric gradients should be concentrated in hero areas, featured modules, promotional/loyalty panels, and selective CTA surfaces. Body/background surfaces must remain stable and readable.
2. Soft glass is an **accent**: use translucent pill badges, overlay controls, or search chips where there is sufficient contrast and backdrop support. Provide opaque fallbacks and reduced translucency where needed.
3. Cards should have a consistent radius system, soft border, selective shadow, and content hierarchy. Do not nest three decorative card shells unless hierarchy requires it.
4. Typography pairs an elegant editorial display treatment for major headings with a highly readable sans-serif UI for controls, tables, booking information, and amounts. Avoid adding external paid font dependencies; prefer already-installed/system fonts.
5. Illustrative material texture (fabric-like lighting, aurora glow) should be rare and understated. CSS gradients are preferable to large downloaded textures where possible. Avoid using unlicensed third-party imagery.
6. Green is the brand color. Use silver-white/pearl as neutral relief. No metallic gold effects.
7. Space is a premium feature: consistent 4/8-point base rhythm, deliberate grouping, generous sections on desktop, compact but breathable mobile controls.
8. Interactions should be subtle (focus ring, short hover elevation, restrained button transition), and respect reduced-motion settings. Never add fake loading delays.
9. All important controls must have persistent labels or programmatically accessible names; color must not be the sole status cue.
10. Use UI animation only where it serves interaction; avoid conspicuous fintech neon animation for the event-business setting.

## Light/dark experience

- Light: pearl/silver backgrounds, white cards, dark evergreen type, soft emerald accents, atmospheric emerald hero/featured highlights.
- Dark: nearly-black emerald foundation, distinct raised forest surfaces, mint-emerald controlled glow, silver-white primary type, subdued borders.
- System: detect OS preference; retain user override and prevent hydration/theme mismatch where possible.
- Both modes must be independently designed. Do not merely invert all the light colors.

## Sitewide UI component targets

- `AppShell`: consistent global page background, container widths, vertical rhythm.
- `Header/Nav`: distinctive SoiréeSource logo treatment, clean desktop nav, real responsive mobile navigation; theme switch integrated accessibly.
- `HeroSection`: layered emerald atmospheric treatment, headline, trustworthy service-search CTA, editorial event visuals.
- `ServiceCard`: image-forward crop, category, title, price, rating/trust data when real, concise metadata and readable CTA.
- `ProviderCard`: cover image, profile/trust state, location, service overview and clear CTA.
- `SearchAndFilter`: structured search bar and compact, clearly selected filter chips; mobile clear/filter action; real state.
- `CategoryShortcut`: compact circular icon or short card, consistent icon language, accessible touch targets.
- `Featured/Bundles`: premium high-contrast hero card plus smaller image-led modules; restrained mint green.
- `BookingSummary`: legible hierarchy for subtotal, discount, included service fee, supplier net, total and mock-payment disclaimer.
- `DashboardStats`: quick scan, role-specific data, no imitation of fake investment wallet. Customers see celebrations/bookings, providers see schedule/service metrics, admins see marketplace operational metrics.
- `BookingTimeline`: clear status, date, provider commitments, deadline state, cancellation flow, messaging link, and verification flow.
- `Messaging`: conversation panel with subtle role distinctions, accessible input, safe mobile sizing.
- `Support/Appeals`: calm, trustworthy forms and moderation status, not overly decorative.
- `Skeleton/Empty/Error`: preserve current helpful SoiréeSource tone; coordinate with token system.

## Layout adaptations

**Desktop (1440+):** max-width content grids, generous whitespace, editorial hero split with image or illustration, aligned filter/sidebar and content, meaningful dashboard columns, no giant mobile phone-like card spanning screen.

**Tablet (768):** 2-column where content permits, collapsing sidebars, appropriate navigation treatment, responsive typography.

**Mobile (390):** single-column hierarchy, compact but legible app shell, touch targets >=44 CSS px where practicable, no persistent table overflow, context-appropriate fixed/bottom nav only if it improves actual use. Do not copy the reference's banking tabs.

## Non-negotiable constraints

- Preserve the existing payment/escrow simulation disclaimers; no actual financial transactions.
- Preserve all role permissions and server-side validation.
- Preserve existing URL structure and schema semantics unless migrations are justified.
- Preserve PostgreSQL batching, existing caching and invalidation, and live availability checks.
- Avoid external paid services and large new dependencies.
- No production deployment/merge without review.

## Design QA

Check major public, customer, provider and admin routes in light/dark/system at 1440px, 768px and 390px. Capture representative before/after screenshots for route parity, use axe where available, check focus indicators/contrast/keyboard navigation, assert theme persistence and hydration stability, and compare key performance baselines where measurable. Run isolated real-PostgreSQL business and Playwright suites. Maintain a route-and-theme coverage matrix with pass/fail counts and honest gaps.

## Future feature priorities alongside redesign

1. Bundle messaging E2E validation, participant isolation, moderation/reporting and documented retention.
2. Full accessibility + visual and hydration regression QA.
3. Pre-expiry reminders and reliable cron deployment design, constrained by hosting cadence.
4. Cancellations/dispute status and messaging polishing with simulated-only liabilities.
5. Loyalty XP presentation and birthday/voucher eligibility behind provisional/off-by-default economic flags.
6. Separate simulated 50% deposit demo UX and integrity tests; do not silently convert production checkout.
7. Private evidence storage and camera QR scanning only with secure technical/financial design and explicit feature gating.
8. Performance regression measurement and safe preview/CI environment isolation.

## Acceptance definition

A design-system implementation is only complete when the new brand language is applied consistently across major public/authenticated routes and genuinely looks like this design direction in both light and dark themes. A theme switch alone does not count. Automated screenshots and representative visual review are mandatory.
