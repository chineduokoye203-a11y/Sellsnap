---
trigger: always_on
---

# Rule: Design System

## Token Files Are the Source of Truth

The project has one token file. The agent must never modify them:

- `tokens/tokens.css` — all colour values, all font sizes, weights, line heights, and font families
- `tokens/design-tokens.tokens.json` — design token source
- `tokens/color-tokens.json` — colour token definitions

The token files export CSS custom properties (CSS variables) that are available globally.

## Mandatory: Use CSS Variables

The agent must never write hardcoded color values or typography values anywhere in this codebase. Use the CSS variables from tokens.

**Wrong:**
```css
color: #1a1a1a;
font-size: 16px;
font-family: 'Poppins', sans-serif;
background: #f5f5f5;
```

**Correct:**
```css
color: var(--color-on-background);
font-size: var(--typography-body-medium-font-size);
font-family: var(--typography-body-medium-font-family);
background: var(--color-surface);
```

Before writing any style value, check the token files. If a variable exists for what you need, use it. If it does not exist, ask before inventing a new value.

## Typography Tokens

Use these token variables for font sizes, weights, and families:

- Display: `typography-display-large`, `typography-display-medium`, `typography-display-small`
- Headline: `typography-headline-large`, `typography-headline-medium`, `typography-headline-small`
- Title: `typography-title-large`, `typography-title-medium`
- Label: `typography-label-small`
- Body: `typography-body-medium`

## Spacing Scale

Use multiples of 4px for all spacing (margin, padding, gap). Do not use arbitrary values.

Allowed: `4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`, `96px`, `128px`

## Border Radius

The product has a consistent border radius. Use these values only:

- Small elements (badges, tags): `4px`
- Buttons and inputs: `8px`
- Cards and modals: `12px`

## Styling Method

- All component styles use **CSS Modules** (`.module.css` files) with the design token variables.
- No inline `style={{}}` props except for truly dynamic values that cannot be expressed in CSS (e.g., a progress bar width driven by a number).
- Extract repeated patterns into reusable components, not custom CSS classes.

## Mobile-First

SellSnap users are primarily on mobile. Every component must be built mobile-first:

- Default styles target mobile (small screens).
- Use `@media (min-width: 768px)` to layer in desktop styles.
- Touch targets must be a minimum of 44px tall.
- The product checkout page (`/p/[slug]`) must be fully functional on a 375px viewport.

## Responsive Breakpoints

- Mobile: default (below 768px)
- Tablet: `@media (min-width: 768px)` (768px and above)
- Desktop: `@media (min-width: 1024px)` (1024px and above)