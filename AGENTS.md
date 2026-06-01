# Project Instructions

## Stack

- **Runtime:** Cloudflare Workers
- **Framework:** Hono (TypeScript)
- **Platform:** Shopify embedded app
- **Session storage:** Cloudflare KV

## UI: Polaris Web Components

All admin UI in this project **must** use Shopify Polaris web components. Do not use custom CSS, HTML elements, or other UI libraries for the admin interface.

### Setup

The app shell includes two script tags in the `<head>`:

```html
<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
<script src="https://cdn.shopify.com/shopifycloud/polaris.js"></script>
```

### Key rules

- Use `<s-page>` as the top-level layout component. It provides global padding, background color, and spacing.
- Use `<s-section>` for content areas within a page. It provides opinionated vertical spacing to children.
- Do **not** use custom CSS to style Polaris components. They have built-in styling that follows the Shopify admin design system.
- Do **not** use `<s-stack>` or `<s-grid>` as children of `<s-section>` unless building a complex layout — `<s-section>` provides default vertical spacing.
- Use `<s-banner>` for error/success/info messages (with `tone="critical"`, `tone="success"`, `tone="info"`).
- Use `<s-spinner>` for loading states.
- Use `<s-text>` for text content (`type="strong"` for bold, `color="subdued"` for secondary text).
- All user-facing strings injected into component HTML must be escaped to prevent XSS.

### Common components

| Component                                 | Use for                                                    |
| ----------------------------------------- | ---------------------------------------------------------- |
| `<s-page>`                                | Top-level page layout with heading                         |
| `<s-section>`                             | Content sections within a page                             |
| `<s-box>`                                 | Custom padding, background, border                         |
| `<s-text>`                                | Inline text with type/color variants                       |
| `<s-heading>`                             | Section headings (auto-sizes by nesting depth)             |
| `<s-banner>`                              | Alerts, errors, info messages                              |
| `<s-button>`                              | Actions (`variant="primary"`, `"secondary"`, `"tertiary"`) |
| `<s-spinner>`                             | Loading indicators                                         |
| `<s-table>`                               | Data tables                                                |
| `<s-unordered-list>` / `<s-ordered-list>` | Lists                                                      |
| `<s-badge>`                               | Status indicators                                          |
| `<s-modal>`                               | Dialogs                                                    |
| `<s-text-field>`                          | Text inputs                                                |
| `<s-select>`                              | Dropdowns                                                  |
| `<s-stack>`                               | Flex layout (inline/block with gap)                        |
| `<s-grid>`                                | Grid layout                                                |

### Scale system

Polaris uses a middle-out scale: `small-300` < `small-200` < `small` < `base` < `large` < `large-200` < `large-300`. This applies to `padding`, `gap`, `size`, etc.

### Validation

When generating Polaris web component code, use the `validate_component_codeblocks` MCP tool with `api: "polaris-app-home"` to check component names and props are valid.

### Reference

- Components: https://shopify.dev/docs/api/app-home
- Using Polaris web components: https://shopify.dev/docs/api/app-home/using-polaris-components
- Patterns: https://shopify.dev/docs/api/app-home/patterns

## Development

- Run `shopify app dev` to start (it launches Wrangler automatically via `shopify.web.toml`)
- Secrets are in `.dev.vars` (not committed)
- KV data is stored locally in `.wrangler/` during dev
