# Figma Design Alignment Plan

**Source**: [Figma Frame 9:3 — Recall App (Inbox View)](https://www.figma.com/design/EoUOtRf7aeYEZd1Z783Z57/Recall?node-id=9-3)

## TL;DR

The Figma frame shows the desktop Inbox view. After comparing exact Figma specs against the current React/Tailwind implementation, there are ~16 discrepancies across layout dimensions, typography, colors, and missing UI elements. This plan details every delta and the steps to fix each one.

---

## Design Spec Comparison

### Colors

| Token | Figma | Current Implementation | Status |
|-------|-------|----------------------|--------|
| Page bg | `#fafafa` | `bg-neutral-50` | ✅ Match |
| Surfaces | `#ffffff` | `bg-white` | ✅ Match |
| Text primary | `#171717` | `text-neutral-900` | ✅ Match |
| Text secondary | `#525252` | `text-neutral-600` | ✅ Match |
| Text muted | `#737373` | `text-neutral-500` | ✅ Match |
| Count text | `#a1a1a1` | `text-neutral-400` | ✅ Match |
| Borders | `#e5e5e5` | `border-neutral-200` | ✅ Match |
| Subtle borders | `#f5f5f5` | `border-neutral-100` | ✅ Match |
| Nav active bg | `#f5f5f5` | `bg-neutral-100` | ✅ Match |
| Tag pill bg | `#f5f5f5` | `bg-neutral-100` (ItemRow), `bg-green-50` (TagChip) | ⚠️ Partial |
| Tag pill text | `#525252` | `text-neutral-600` (ItemRow), `text-green-700` (TagChip) | ⚠️ Partial |
| Dot separator | `#d4d4d4` 4×4px | `bg-neutral-300 w-1 h-1` | ✅ Match |
| Primary button bg | `#171717` | `bg-primary` = `#030213` | ❌ Mismatch |
| Avatar bg | `#e5e5e5` | `bg-indigo-100` | ❌ Mismatch |
| Avatar text | `#525252` | `text-indigo-700` | ❌ Mismatch |

### Typography

| Element | Figma | Current | Status |
|---------|-------|---------|--------|
| Logo "Recall" | Inter Bold 20px, tracking -0.95px, line-height 28px | `text-lg sm:text-xl font-bold tracking-tight` | ⚠️ Close (missing exact tracking) |
| Nav items | Inter Medium 14px, lh 20px, tracking -0.15px | `text-xs sm:text-sm font-medium` | ❌ Too small at base |
| Section headings | Inter SemiBold 12px, uppercase, tracking 0.6px, `#a1a1a1` | `text-xs font-semibold uppercase tracking-wider text-neutral-400` | ✅ Match |
| Item count (sidebar) | Inter Regular 12px, `#a1a1a1` | Not shown consistently | ⚠️ Partial |
| Page title | Inter SemiBold 20px, lh 28px, tracking -0.45px | `text-lg sm:text-xl md:text-2xl font-semibold` | ✅ Match at md |
| Item title | Inter SemiBold 16px, lh 24px, tracking -0.31px | `text-sm sm:text-base font-semibold` | ⚠️ Too small at base |
| Item excerpt | Inter Regular 14px, lh 20px, tracking -0.15px | `text-xs sm:text-sm text-neutral-500` | ⚠️ Too small at base |
| Item domain | Inter Medium 12px, `#737373` | `text-xs font-medium text-neutral-500` | ✅ Match |
| Item time | Inter Regular 12px, `#a1a1a1` | `text-xs text-neutral-400` | ✅ Match |
| Tag text | Inter Regular 12px, `#525252` | `text-xs text-neutral-600` | ✅ Match |
| Save URL button | Inter Medium 14px, white | `text-xs sm:text-sm` | ⚠️ Too small at base |
| Search placeholder | Inter Regular 14px, `rgba(23,23,23,0.5)` | N/A (missing) | ❌ Missing |

### Layout Dimensions

| Element | Figma | Current | Status |
|---------|-------|---------|--------|
| Sidebar width | 183px (inner), 256px (outer with border) | `w-56 sm:w-60 md:w-64` (224/240/256px) | ⚠️ Different approach |
| Sidebar header height | 76px, `pl-24px` | `p-4 sm:p-5 md:p-6` | ❌ Mismatch |
| Nav button height | 36px | auto (py-based) | ❌ Mismatch |
| Nav button padding | `px-12px gap-12px` | `px-2 sm:px-3 gap-2 sm:gap-3` | ❌ Mismatch |
| Nav button radius | 10px | `rounded-lg` (8px) | ❌ Mismatch |
| Nav icon size | 16×16 | `h-3.5 w-3.5 sm:h-4 sm:w-4` | ⚠️ Too small at base |
| Section gap | 32px | `space-y-6 sm:space-y-8` (24/32px) | ✅ Match at sm+ |
| Button gap (within section) | 4px | `space-y-0.5 sm:space-y-1` (2/4px) | ⚠️ Too small at base |
| Top bar height | 64px | auto | ❌ Missing fixed height |
| Top bar bg | `rgba(255,255,255,0.8)` translucent | `bg-white` opaque | ❌ Mismatch |
| Top bar padding | `px-24px` | `p-3 sm:p-4 md:p-6` | ⚠️ Different |
| Top bar border | `#e5e5e5` | `border-neutral-100` | ❌ Mismatch |
| Search input | `192×32px, bg-#f5f5f5, rounded-10px` | N/A (missing) | ❌ Missing |
| Filter icon button | `32×32px` | N/A (missing) | ❌ Missing |
| Save URL button | `h-32px px-12px rounded-10px bg-#171717 shadow` | `h-auto px-2.5 sm:px-4 rounded-lg` | ❌ Mismatch |
| Item row height | 109px | auto (py-based) | ⚠️ Different approach |
| Thumbnail size | 40×40 | `w-10 h-10 sm:w-12 sm:h-12` | ⚠️ Too large at sm+ |
| Thumbnail position | left 16px, top 20px | `px-3 sm:px-4` | ⚠️ Different |
| Thumbnail radius | 10px | `rounded-lg` (8px) | ❌ Mismatch |
| Content left offset | 72px (16px thumb + 16px gap + 40px thumb) | `gap-2 sm:gap-4` flex | ✅ Equivalent |
| User footer height | 73px, `pt-17px px-16px` | `p-3 sm:p-4` | ⚠️ Different |
| User avatar size | 24×24 | `w-7 h-7` (28px) | ❌ Mismatch |
| Tag pill height | 20px, `px-8px rounded-full` | `px-1.5 sm:px-2 py-0.5 rounded-full` | ⚠️ Close |

---

## Steps

### Step 1: Fix primary button color in theme

**File**: `src/web/src/styles/theme.css`

Change `--primary` from `#030213` to `#171717` (neutral-900) to match Figma's primary button background.

### Step 2: Fix sidebar header

**File**: `src/web/src/components/layout/Sidebar.tsx`

- Change header padding from `p-4 sm:p-5 md:p-6` to `pl-6 pt-6 pb-0`
- Add `tracking-[-0.95px]` to the logo text (currently `tracking-tight` = -0.025em ≈ -0.5px at 20px)

### Step 3: Fix nav button dimensions

**File**: `src/web/src/components/layout/Sidebar.tsx`

- Change nav item classes to `h-9 px-3 gap-3 rounded-[10px]` (exact 36px height, 12px padding, 12px gap, 10px radius)
- Change item spacing to `space-y-1` (4px)
- Change icon size to `h-4 w-4` (16px) everywhere — remove responsive `h-3.5 w-3.5` variants
- Change text to `text-sm font-medium` (14px) — remove responsive `text-xs` variant

### Step 4: Fix sidebar sections padding

**File**: `src/web/src/components/layout/Sidebar.tsx`

- Change nav area padding to `px-4` (16px) consistently
- Ensure section gap is `gap-8` (32px)

### Step 5: Fix user footer / avatar

**File**: `src/web/src/components/auth/UserDisplay.tsx`

- Change avatar from `w-7 h-7 bg-indigo-100` → `w-6 h-6 bg-neutral-200`
- Change avatar text from `text-xs font-semibold text-indigo-700` → `text-xs font-medium text-neutral-600`

**File**: `src/web/src/components/layout/Sidebar.tsx`

- Change footer padding to `px-4 pt-[17px]`
- Change footer user row height to `h-10` (40px)

### Step 6: Fix top bar (ItemsView header)

**File**: `src/web/src/features/items/components/ItemsView.tsx`

- Change header to `h-16 px-6 bg-white/80 backdrop-blur-sm border-b border-neutral-200`
- Remove the subtitle element (the "INBOX" uppercase text above the title)
- Fix title to `text-xl font-semibold tracking-[-0.45px]`
- Add count badge next to title: `bg-neutral-100 rounded-full h-6 px-2 text-sm font-medium text-neutral-400`

### Step 7: Add search input to top bar

**File**: `src/web/src/features/items/components/ItemsView.tsx`

Add a search input element:
- Container: `w-48 h-8 relative`
- Input: `w-full h-full bg-neutral-100 rounded-[10px] pl-9 pr-4 text-sm placeholder:text-neutral-900/50 border-0`
- Icon: Lucide `Search`, `w-4 h-4 absolute left-3 top-2 text-neutral-400`

### Step 8: Add filter button to top bar

**File**: `src/web/src/features/items/components/ItemsView.tsx`

Add a ghost icon button between search and Save URL:
- `h-8 w-8 p-2` with Lucide `SlidersHorizontal` icon

### Step 9: Fix Save URL button

**File**: `src/web/src/features/items/components/ItemsView.tsx` or `SaveUrlDialog.tsx`

- Change to `h-8 px-3 gap-2 rounded-[10px] bg-neutral-900 text-white text-sm font-medium shadow-sm`
- Ensure the `+` icon and "Save URL" text match Figma layout

### Step 10: Fix item row layout

**File**: `src/web/src/features/items/components/ItemRow.tsx`

- Change padding to `px-4 py-4`
- Fix thumbnail to exactly `w-10 h-10` (remove responsive `sm:w-12 sm:h-12`)
- Change thumbnail radius from `rounded-lg` to `rounded-[10px]`
- Fix content gap to `gap-4`

### Step 11: Fix item row typography

**File**: `src/web/src/features/items/components/ItemRow.tsx`

- Title: Change to `text-base font-semibold tracking-[-0.31px]` (remove responsive `text-sm`)
- Excerpt: Change to `text-sm text-neutral-500 tracking-[-0.15px]` (remove responsive `text-xs`)
- Domain: Keep `text-xs font-medium text-neutral-500` ✅
- Time: Keep `text-xs text-neutral-400` ✅

### Step 12: Fix star icon visibility

**File**: `src/web/src/features/items/components/ItemRow.tsx`

- Show a persistent `w-3 h-3` filled star icon inline next to the title for favorited items
- The Figma shows stars inline (not as hover-only actions)

### Step 13: Fix inline tag styling

**File**: `src/web/src/features/items/components/ItemRow.tsx`

- Tag pills: `bg-neutral-100 text-neutral-600 rounded-full h-5 px-2 text-xs`
- Ensure tags display with `#` prefix (Figma shows `#Productivity`, `#Business`, etc.)
- Gap between tags: `gap-2` (8px)

### Step 14: Fix TagChip component colors

**File**: `src/web/src/features/tags/components/TagChip.tsx`

- Change from `bg-green-50 text-green-700 hover:bg-green-100` to `bg-neutral-100 text-neutral-600 hover:bg-neutral-200`
- This aligns the detail panel's tag styling with the Figma neutral style

### Step 15: Fix section heading + button alignment

**File**: `src/web/src/features/collections/components/CollectionList.tsx` and `src/web/src/features/tags/components/TagList.tsx`

- Section heading: `Inter SemiBold 12px uppercase tracking-[0.6px] text-neutral-400` ✅ (already matches)
- "+" button: should be `w-3 h-3` (12px), positioned to the right of the heading with `justify-between`

### Step 16: Fix sidebar footer border

**File**: `src/web/src/components/layout/Sidebar.tsx`

- Change footer border from `border-neutral-100` to `border-neutral-100` (Figma `#f5f5f5` = neutral-100) ✅ already matches

---

## Component-to-File Mapping

| Component | File Path |
|-----------|-----------|
| Layout shell | `src/web/src/components/layout/Layout.tsx` |
| Sidebar | `src/web/src/components/layout/Sidebar.tsx` |
| UserDisplay | `src/web/src/components/auth/UserDisplay.tsx` |
| ItemsView | `src/web/src/features/items/components/ItemsView.tsx` |
| ItemRow | `src/web/src/features/items/components/ItemRow.tsx` |
| ItemDetail | `src/web/src/features/items/components/ItemDetail.tsx` |
| SaveUrlDialog | `src/web/src/features/items/components/SaveUrlDialog.tsx` |
| TagChip | `src/web/src/features/tags/components/TagChip.tsx` |
| CollectionList | `src/web/src/features/collections/components/CollectionList.tsx` |
| TagList | `src/web/src/features/tags/components/TagList.tsx` |
| Theme tokens | `src/web/src/styles/theme.css` |

---

## Verification

1. Run `cd src/web && npm run dev` and visually compare the running app side-by-side with the Figma screenshot
2. Use browser DevTools to measure exact pixel values for padding, font sizes, heights, and border radius
3. Run `cd src/web && npx vitest run` to ensure no test regressions
4. Spot-check responsive behavior at `sm` and `md` breakpoints — Figma design is desktop-only, so mobile adaptations should be preserved where they don't conflict

---

## Decisions

| Decision | Rationale |
|----------|-----------|
| Keep responsive breakpoints | Figma only shows desktop. Existing mobile-first classes should be kept but overridden at `md:` to match Figma exactly. |
| Search and filter are visual-only initially | These elements exist in Figma but need backend support. Add them as non-functional UI to match the design, then wire up in a subsequent spec. |
| Tags use neutral palette everywhere | Figma shows neutral gray pills. The green `TagChip` variant should be replaced with neutral styling to match. |
| Primary color becomes `#171717` | Figma uses neutral-900 for the primary CTA (Save URL). Aligning `--primary` with this ensures all primary buttons match. |
| Sidebar width remains responsive | The Figma inner sidebar is ~183px but the implementation uses responsive widths. At `md:` breakpoint (desktop), the 256px outer matches the Figma viewport split. |
