# Component Builder Skill

Load this skill whenever you are creating or modifying a React component in SellSnap. It tells you where the component goes, how it should be structured, and how to wire it up to the design system without reinventing anything.

## Before You Start

Read `.agent/rules/design-system.md` first. Components that do not follow the design system get rejected at review. This skill assumes you already know the tokens, the spacing scale, and the component primitives.

Then ask: does this component already exist? Search `components/` before adding a new one. Two slightly different `Button` components is how codebases rot.

## Where Components Live

```
components/
├── ui/                  primitives: Button, Input, Card, Badge, Avatar, etc.
├── product/             anything specific to the product domain (ProductCard, ProductImage, PriceTag)
├── dashboard/           anything that only exists inside the seller dashboard (OrdersTable, ProductList)
└── shared/              composites used across more than one domain (EmptyState, PageHeader)
```

If a component is used exactly once and it is complex, it can live next to the page that uses it in `app/.../_components/`. Promote it to `components/` when a second caller shows up.

## Component File Template

```tsx
// components/<folder>/<ComponentName>.tsx

import { ReactNode } from 'react';
import styles from './<ComponentName>.module.css';

type <ComponentName>Props = {
  // Props go here. Required props first, optional after.
  children?: ReactNode;
  className?: string;
};

export function <ComponentName>({ children, className }: <ComponentName>Props) {
  return (
    <div className={`${styles.root} ${className || ''}`}>
      {children}
    </div>
  );
}
```

```css
/* components/<folder>/<ComponentName>.module.css */

.root {
  /* Use tokens from tokens/tokens.css */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-4);
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
}
```

Notes:
- Named export, not default export. Default exports make renaming harder and break auto-imports.
- `className` prop is always accepted on components that render a single root element, concatenated so callers can extend styling without forking.
- Props type goes above the component, named `<ComponentName>Props`.
- Required props come before optional ones in the type definition.
- Each component has its own `.module.css` file using design tokens.

## Server vs. Client Components

Default to server components. A component becomes a client component only when it needs one of these:
- React state (`useState`, `useReducer`)
- Effects (`useEffect`, `useLayoutEffect`)
- Browser-only APIs (`window`, `document`, `localStorage`)
- Event handlers that are more than a simple link (`onClick`, `onChange`)
- Context consumption for interactivity

If you add `"use client"`, put it on the first line of the file. Do not add it defensively.

Keep the client boundary as low in the tree as possible. A page that is mostly static but has one interactive button should not be a client component; the button should be.

## Styling

All components use **CSS Modules** with design tokens from `tokens/tokens.css`.

**Wrong:**
```css
.card {
  background-color: #f5f5f5;
  padding: 16px;
  border-radius: 8px;
}
```

**Correct:**
```css
.card {
  background-color: var(--color-surface);
  padding: var(--spacing-4);
  border-radius: var(--radius-md);
}
```

Use CSS variables for all colors, typography, and spacing:
- Colors: `var(--color-primary)`, `var(--color-surface)`, `var(--color-on-surface)`
- Typography: `var(--typography-body-medium-font-size)`, `var(--typography-title-large-font-family)`
- Spacing: `var(--spacing-4)`, `var(--spacing-6)`, `var(--spacing-8)`

Never write hardcoded hex values. Always use the tokens.

## Variants

For components with variants (Button, Badge), use a variants pattern in the component:

```tsx
// components/ui/Button/Button.tsx
import { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: styles.variantPrimary,
  secondary: styles.variantSecondary,
  ghost: styles.variantGhost,
  danger: styles.variantDanger,
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
};

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  const classNames = [
    styles.button,
    variantClasses[variant],
    sizeClasses[size],
    className,
  ].filter(Boolean).join(' ');

  return (
    <button className={classNames} {...props}>
      {children}
    </button>
  );
}
```

```css
/* components/ui/Button/Button.module.css */

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--typography-body-medium-font-family);
  font-size: var(--typography-body-medium-font-size);
  transition: background-color 0.2s ease;
}

.variantPrimary {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}

.variantPrimary:hover {
  background-color: var(--color-primary-container);
}

.variantSecondary {
  background-color: var(--color-surface);
  color: var(--color-on-surface);
  border: 1px solid var(--color-outline);
}

.variantGhost {
  background-color: transparent;
  color: var(--color-on-surface);
}

.variantGhost:hover {
  background-color: var(--color-surface-variant);
}

.variantDanger {
  background-color: var(--color-error);
  color: var(--color-on-error);
}

.sizeSm {
  height: 36px;
  padding: 0 var(--spacing-3);
}

.sizeMd {
  height: 44px;
  padding: 0 var(--spacing-4);
}

.sizeLg {
  height: 48px;
  padding: 0 var(--spacing-6);
}
```

## Accessibility

Every interactive element needs a keyboard-reachable focus state. Add focus styles using CSS:

```css
.button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

Buttons without visible text need `aria-label`. Icon-only buttons are the most common offender. Do not let them ship without a label.

Form inputs need associated labels via `htmlFor`/`id`. Error messages are linked via `aria-describedby`.

Images need `alt`. Decorative images use `alt=""`. Do not omit the attribute.

## Props to Avoid

- Do not expose raw color props (`color="red"`). Use variants.
- Do not expose raw size values in pixels. Use the size variants.
- Do not accept arbitrary inline styles via a `style` prop unless there is a specific reason (like a dynamic value that cannot be expressed in CSS).

## Testing a New Component

If the component is a primitive (lives in `ui/`), verify manually:
- Default appearance
- Every variant
- Every size
- Disabled state (if applicable)
- Focus state (tab into it)
- Hover state
- On mobile viewport (Chrome DevTools at 360px wide)

Domain components (product, dashboard) can be reviewed in place on the relevant page.

## Common Mistakes

- Creating a new primitive when an existing one would work with a new variant. Extend, do not duplicate.
- Forgetting `className` prop on a component that might need to be laid out differently in different places.
- Making a component a client component because it was easier, when a server component would have worked.
- Using pixel values instead of the spacing scale. Use `var(--spacing-4)` not `16px`.
- Hardcoding colors instead of using design tokens.
- Adding complex logic inside the JSX. Extract to a named constant or helper above the return.