---
name: wishlist-workflow
description: Use for development, design, SEO content, image assets, pull requests, releases, and monetization work in the olya88lagun-coder/wishlist repository. Enforces the approved visual direction, evidence-based completion, focused Git branches, SEO quality, and safe verification. Do not use outside this repository.
---

# Wishlist workflow

Use this workflow for every material change in the Wishlist repository.

## Start with repository truth

1. Identify the current base branch, feature branch, open PRs, and deployment source before editing.
2. Read the relevant implementation and compare the branch with its intended base.
3. Treat the live site, screenshots, and user-approved images as visual references, not as proof of repository state.
4. Preserve unrelated user changes. Do not push directly to `master`.

## Preserve approved design

- Keep the approved premium cream-and-gold direction unless the user explicitly requests a redesign.
- Preserve the established layout of `/gifts/for-mom` when editing its content or assets.
- Prefer real semantic HTML for text, navigation, and buttons. A user-approved hero image may be used as a visual layer when exact fidelity is the stated goal.
- Check desktop and mobile behavior. Do not declare visual work complete without a real render or explicitly state when rendering was unavailable.

## Handle image assets safely

- Use the user's original binary asset when one was supplied. Do not silently replace it with a generated or low-resolution substitute.
- Store public assets under stable ASCII names such as `mom-2.png`.
- Before claiming an upload succeeded, verify the exact repository path, blob identity, and plausible file size.
- Verify every source reference after renaming. Remove obsolete images only after confirming they have no remaining references.
- Never embed large base64 or data-URI images in TypeScript, CSS, or article text.
- Optimize images only when the optimized result can be visually compared with the original.

## Build useful SEO pages

For SEO or content work, read [the quality checklist](references/quality-checklist.md) before editing.

- Write for a specific search intent and a real user decision.
- Avoid thin, duplicated, or keyword-stuffed pages.
- Keep titles, descriptions, canonical URLs, internal links, sitemap entries, robots rules, and structured data consistent.
- Keep private and account routes out of the search index.
- Give every article a useful next action connected to creating or sharing a wishlist.

## Work in focused changes

1. Create a narrowly named branch.
2. Keep one concern per PR whenever practical.
3. Inspect the final diff against the correct base.
4. Use an accurate Russian PR title and body that describe what actually changed.
5. Do not merge or deploy without the user's explicit request.

## Verify before reporting completion

- Run the smallest relevant checks, then typecheck, tests, and build when the local environment is available.
- Inspect changed paths and search for stale references, accidental data URIs, debug code, and unrelated edits.
- Treat a GitHub Actions job that fails before producing any steps as an infrastructure or quota signal, not proof that application code failed. Do not spam retries.
- Report separately:
  - what is committed;
  - what is verified;
  - what remains unverified;
  - whether the change is live.

## Definition of done

A task is done only when the requested files exist in the intended branch, references point to them, the final diff is focused, relevant checks were performed, and the user can clearly tell whether the result is merely in a PR or already deployed.
