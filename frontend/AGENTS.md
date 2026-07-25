<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Architecture rules 

It is a mobile first application. we do not need hover effect, or anything web-only related.

use i18n for all copy text. no exception. Use next-intl
use shadcn for components. add components
use tailwindcss for style.

composite = smart components, aggregation de components 
compoents = atoms, molecules and generally dump components
folders pour components complex avec plusieurs files. index.tsx pour le complex component
do not collocate components with pages: every components are in components/

Limit prop drilling. use a context manager if needed (zustand or something else)


# Web3 rules

On utilise permissionless.js. check la doc lorsque que tu as un doute d'implementation. https://docs.pimlico.io/

On utilise wagmi (sans la wallet connection du coup) pour read les contract et permissionless pour write.

# Performance
prefer not using useeffect when possible. find smarter, better more performant alternative and make sure any useeffect is 100% necessary
Images => nextjs <Image> tag

# Typescript
dont use `any` type
prefer using `type` over `interface` unless really needed

# Design rules 

Make sure to respect mobile app design rules. Elements must be big enough

we use vaul for drawers.
dont use modal, dont use dialogs.

we use motion for animations

No custom swipe gestures. iOS and Android both provide system-level back gestures — don't reimplement them. Back navigation = back button only (`ScreenLayout` with `back` prop).

Dont add border when not necessary.
Make every color a variable. I want to be able to change theme really easily in one place.

## Reusable primitives (use these, don't reimplement)

- Error boundaries → `<ErrorPage>` from `components/ui/error-page.tsx`
- Auth page headers → `<PageHeader>` from `components/ui/page-header.tsx`
- Settings rows → `<SettingsMenuItem>` from `components/settings/settings-menu-item.tsx`
- Haptics → `haptic()` from `lib/haptics.ts` — only API to use, do NOT use `use-haptic.ts` (deleted)

<!-- END:nextjs-agent-rules -->

