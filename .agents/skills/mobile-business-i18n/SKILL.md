---
name: mobile-business-i18n
description: Enforces internationalization for mobile business UI copy in Expo/Tamagui code. Use when adding or editing product text, labels, placeholders, accessibility labels, dialogs, and toasts in `apps/mobile`.
version: 1.0.0
license: MIT
---

# Mobile Business I18n

Apply this skill whenever product-facing copy is added or changed in `apps/mobile`.

## Required Workflow

1. Add or update translation keys in:
   - `packages/business/i18n/en.json`
   - `packages/business/i18n/zh-CN.json`
   - `packages/business/i18n/zh-TW.json`
2. Use `useTranslation()` and `t("...")` in UI code.
3. Replace hardcoded copy in:
   - JSX text nodes
   - `placeholder`
   - `accessibilityLabel`
   - dialog/action labels
4. Keep key naming scoped by feature (for example `Home.*`, `Auth.*`, `AI.*`).
5. Run lint check on changed files and fix missing/unused keys.

## Rules

- Never ship new hardcoded product copy in `.tsx` business screens.
- Debug logs and developer-only comments can stay non-i18n.
- Prefer reusing existing keys before creating new ones.
- When keys are missing in one locale, add them in all locales in the same change.

## Suggested Key Pattern

```txt
<Feature>.<purpose>
Home.selectTheme
Home.changeLanguage
Auth.alreadyHaveAccount
```

## Done Criteria

- No new hardcoded UI copy in edited mobile business files.
- All new copy resolves through `t(...)`.
- Three locales stay in sync for the new keys.
