# Wishlist quality checklist

Read the relevant sections before changing SEO pages, visual assets, or preparing a release.

## SEO page

- One clear primary intent and a useful Russian-language answer.
- Unique `title`, description, H1, introduction, and body content.
- Canonical URL matches the public route.
- Page is present in the sitemap only when it is intended for indexing.
- Account, login, personal list, Telegram, and other private routes remain `noindex`.
- Structured data reflects visible page content; do not add unsupported review or rating markup.
- Breadcrumbs and internal links work.
- Images have descriptive alt text and appropriate responsive sizing.
- CTA leads naturally to gift selection, wishlist creation, or sharing.
- No duplicated paragraphs, placeholder copy, keyword stuffing, or embedded data URIs.

## Visual change

- Compare with the latest user-approved reference.
- Confirm the asset exists in the target branch.
- Confirm path, format, and plausible file size.
- Check cropping at desktop and mobile widths.
- Check text legibility, focus states, keyboard access, and contrast.
- Remove superseded assets only after searching for remaining references.

## Pull request

- Base branch is intentional.
- Diff contains only the requested concern.
- No secrets, temporary uploads, generated junk, or unrelated workflow changes.
- Typecheck, tests, and production build were run when possible.
- CI failure is diagnosed from job steps instead of inferred from its red status.
- PR title and description state the actual result and any verification limitation.
- The final report distinguishes committed, merged, deployed, and visually verified states.

## Monetization guardrails

- User value and organic traffic come before aggressive monetization.
- Affiliate redirects keep measurable click tracking and a clear disclosure.
- Do not add deceptive recommendations or rank products only by commission.
- Validate paid themes or premium features with demand signals before building them.
- Treat group gifting and payments as a later phase requiring legal, payment, refund, and fraud review.
