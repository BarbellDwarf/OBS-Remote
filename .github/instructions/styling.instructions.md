---
applyTo:
  - "**/*.css"
  - "**/styles/**"
---

# Styling Instructions for OBS Remote Control

These instructions apply specifically to CSS files and styling-related changes.

## Color Palette

Always use CSS variables defined in `:root`:

```css
/* Primary colors */
--primary-blue: #0084ff;
--success-green: #28a745;
--danger-red: #dc3545;
--warning-yellow: #ffc107;

/* Background colors */
--bg-darkest: #141414;
--bg-dark: #1e1e1e;
--bg-panel: #252525;
--border-color: #3a3a3a;

/* Text colors */
--text-primary: #e8e8e8;
--text-secondary: #a0a0a0;
```

## Naming Conventions

- Use **kebab-case** for all class names (e.g., `.audio-mixer`, `.scene-list-item`)
- Use BEM-like naming for component variants:
  - Block: `.audio-slider`
  - Element: `.audio-slider__track`
  - Modifier: `.audio-slider--muted`

## Layout Guidelines

- Use **flexbox** for one-dimensional layouts
- Use **grid** for two-dimensional layouts
- Avoid fixed pixel widths where possible
- Use `min-width`, `max-width` for responsive design
- Maintain consistent spacing using multiples of 4px (8px, 12px, 16px, 24px)

## Transitions and Animations

- Add smooth transitions for interactive elements:
  ```css
  transition: all 0.2s ease;
  ```
- Use `transform` for animations (better performance than `left`/`top`)
- Keep animations subtle and professional
- Use consistent timing functions: `ease`, `ease-in-out`

## Dark Theme Consistency

- All backgrounds should be dark shades
- Text should have high contrast (at least 4.5:1)
- Interactive elements should have clear hover/active states
- Maintain visual hierarchy with subtle brightness differences

## Responsive Design

- Test at minimum width: 800px
- Use media queries for major breakpoints:
  ```css
  @media (max-width: 1200px) { /* ... */ }
  @media (max-width: 900px) { /* ... */ }
  ```
- Consider window resizing (common in Electron apps)

## Component Styling Patterns

### Buttons
```css
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
```

### Lists
```css
.list-item {
  padding: 12px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.list-item:hover {
  background-color: var(--bg-panel);
}

.list-item.active {
  background-color: var(--primary-blue);
  color: white;
}
```

### Inputs and Controls
```css
input, select {
  background-color: var(--bg-dark);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 8px 12px;
  border-radius: 4px;
}

input:focus, select:focus {
  outline: none;
  border-color: var(--primary-blue);
}
```

## Accessibility

- Ensure all interactive elements have `:focus` styles
- Use appropriate `cursor` values:
  - `pointer` for buttons and links
  - `text` for text inputs
  - `default` for non-interactive elements
- Maintain sufficient color contrast
- Support keyboard navigation styling

## Performance Considerations

- Use `will-change` sparingly for animated elements
- Avoid expensive properties in animations (box-shadow, filter)
- Use `transform` and `opacity` for animations
- Minimize repaints and reflows

## Common Patterns to Follow

### Status Indicators
```css
.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.status-indicator.connected { background-color: var(--success-green); }
.status-indicator.error { background-color: var(--danger-red); }
```

### Loading States
```css
.loading {
  opacity: 0.6;
  pointer-events: none;
  position: relative;
}
```

### Disabled States
```css
.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}
```

## What NOT to Do

- ❌ Don't use inline styles in HTML
- ❌ Don't use `!important` unless absolutely necessary
- ❌ Don't use absolute positioning for layout (use flexbox/grid)
- ❌ Don't use light colors for backgrounds
- ❌ Don't use very bright colors (keep it professional)
- ❌ Don't create overly complex selectors
- ❌ Don't use vendor-specific prefixes (Electron handles this)

## Testing Styling Changes

1. Test at different window sizes
2. Check all interactive states (hover, active, focus, disabled)
3. Verify color contrast for accessibility
4. Test with different content lengths
5. Check in both connected and disconnected states

## Organization

Keep CSS organized by sections:
1. CSS Variables (`:root`)
2. Base styles (html, body)
3. Layout containers
4. Header/navigation
5. Main content areas
6. Sidebar components
7. Buttons and controls
8. Form elements
9. Utility classes
10. Responsive overrides

Add section comments:
```css
/* ==================== AUDIO MIXER ==================== */
```

## Resources

- [CSS Flexbox Guide](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)
- [CSS Grid Guide](https://css-tricks.com/snippets/css/complete-guide-grid/)
- [Color Contrast Checker](https://webaim.org/resources/contrastchecker/)
