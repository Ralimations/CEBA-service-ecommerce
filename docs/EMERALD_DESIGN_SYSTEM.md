# SoiréeSource — Emerald Editorial Luxury

**Status:** Implemented as a reviewable branch direction; final brand-token approval remains with stakeholders.

## Brand identity

Emerald Editorial Luxury translates the supplied mobile dashboard and material palette into an event-services marketplace. It combines quiet editorial headings, event photography, modular rounded surfaces, and restrained emerald atmosphere. The product continues to show real services, providers, packages, booking states, and operational data; it does not borrow financial-dashboard language or decorative metrics.

The existing SoiréeSource logo, name, and “Make it a moment” positioning remain in use. Existing event imagery is reused. The supplied reference images remain in the design pack and are not copied into public runtime assets.

## Source and selected colors

| Token | Value | Use |
|---|---|---|
| Deep emerald | `#02110C` | Dark canvas and hero gradient anchor |
| Olive emerald | `#1A422F` | Core brand and primary dark surface |
| Cream beige | `#F3EBD6` | Source swatch only; not a dominant interface color |
| Silver mist | `#E8EEEA` | Sunken neutral surface |
| Pearl background | `#F2F5F2` | Light canvas |
| Soft ivory | `#F5F7F4` | Light relief and copy support |
| Elevated white | `#FFFFFF` | Light cards and controls |
| Dark raised surface | `#0B241B` | Dark cards |
| Forest surface | `#123124` | Dark elevated panels |
| Dark text | `#102B20` | Light theme foreground |
| Muted text | `#52665C` | Light theme secondary copy |
| Emerald glow | `#21B987` | Rare accent in gradients; not small text |
| Light border | `#D8E2DA` | Light dividers and card edges |
| Dark border | `#345B49` | Dark dividers and card edges |

The active CSS tokens are semantic custom properties in `app/globals.css`: background/foreground, surface/raised/sunken/hover, primary/accent, muted foreground, borders, input, focus, status, disabled, overlay/backdrop, shadows, glass, hero gradient, and featured gradient. Legacy project aliases resolve to these tokens so older route components share the palette without duplicating page-specific colors.

## Theme behavior

- **Light:** pearl silver canvas, white surfaces, evergreen type, emerald active states.
- **Dark:** `#02110C` canvas, forest surfaces, silver-white type, mint accents and restrained radial light.
- **System:** the no-flash bootstrap resolves the operating-system color scheme before the page paints and follows system changes while the saved preference is `system`.
- The header control cycles system → light → dark → system and persists to `localStorage` under `soiree-source-theme`.

## Typography and spacing

Display headings use the installed system stack with Georgia for selective editorial emphasis. Functional UI uses Inter when present, then Aptos/Segoe UI/Arial. No external font download was added. The base spacing rhythm remains 4/8px; cards and sections have extra breathing room on desktop while mobile controls retain a compact single-column flow.

## Header options from the meeting PDF

The current header is **logo + SoiréeSource + “Make it a moment.”** A second low-risk option for review is **logo + SoiréeSource** with no tagline. The current mark remains in use; these are two lockup suggestions, not a request to replace or redraw the logo.

## Radius and surface hierarchy

| Element | Radius |
|---|---:|
| Inputs and compact controls | 10–12px |
| Standard panels and cards | 16–20px |
| Feature cards and bundle modules | 22–28px |
| Hero | 24–32px |
| Chips and badges | Full pill |

Shadows are limited to raised cards, search, and featured areas. The glass token is used on the hero trust note only; body text remains opaque. The hero and curated bundle area carry most of the atmospheric gradients. Ordinary cards use a clear neutral surface.

## Component inventory

Existing reusable `Header`, `Sidebar`, `ServiceCard`, `BundleCard`, `BookingCard`, `Panel`, `Metrics`, `Heading`, `Status`, and form components inherit the semantic system. The homepage uses live category data and real service/provider/bundle cards. Existing browse filters, role navigation, booking forms, simulation notices, message membership checks, and admin confirmation flows are unchanged. Booking-linked messages now include a participant report action and a focused admin report queue.

## Accessibility decisions

- Inputs retain persistent labels, visible focus styles, and a minimum 44px control height.
- Status meaning remains textual; role and event actions are not represented by color alone.
- System preference and manual theme selection are keyboard-accessible through the existing button.
- Reduced-motion rules remain active; the new surfaces use no animated gradients.
- Light and dark semantic text values are selected for strong contrast. RC1's axe-core WCAG 2.2 AA scan found zero violations across 39 public, customer, provider, and admin routes in both themes. Manual keyboard, dialog, and assistive-technology review remains.
- The test browser is now launched with extensions disabled to investigate the historical `caret-color: transparent` hydration mismatch. The post-change result is recorded in the completion report.
