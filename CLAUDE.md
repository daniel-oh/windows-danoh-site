# danoh.com — contributor guide

Short, practical orientation for anyone (human or AI) picking up this
repo. The site is a personal portfolio styled as a Win98 desktop, with
an MDX blog, AI-generated mini-apps, Stripe-backed tokens, a guestbook,
and a contact form.

---

## Mental model

The desktop at `/` is a real SPA: `components/OS.tsx` owns the shell
(taskbar, Start menu, global keyboard/mouse listeners). Icons on the
desktop launch "programs" — each is a React component under
`components/programs/*` rendered into a draggable/resizable `Window`.

Static pages sit alongside: `/blog`, `/blog/[slug]`, `/privacy`,
`/logout`, `/error`. They share the retro shell CSS under
`app/blog/blog.module.css` but are plain SSR Next.js routes — not
part of the OS.

State lives in Jotai atoms under `state/` (one concern per file):
`windowsListAtom` (open windows), `windowAtomFamily` (per-window
state), `settingsAtom`, `recycleBinAtom`, `fsManagerAtom` (the
in-browser virtual filesystem over IndexedDB / FileSystemAccess).

---

## Where common things live

| Task                                  | Path                                      |
| ------------------------------------- | ----------------------------------------- |
| Add a blog post                       | `content/blog/posts/<slug>.mdx` + add metadata to `content/blog/posts.ts` + `content/blog/posts-content.tsx` |
| Add a desktop program                 | `components/programs/<Name>.tsx`, wire into `components/WindowBody.tsx`, add a `type` to `state/window.tsx` |
| Add a Start-menu entry                | `components/OS.tsx` → `entries` array     |
| Add an AI endpoint                    | `app/api/<name>/route.ts` → call `checkAccess` + `costGuard` + `capture` |
| Change AI rate limits                 | `lib/api/costGuard.ts` (consts) + `.env` (`GLOBAL_AI_DAILY_CAP`) |
| Change per-program limits in dev      | `lib/apiGuard.ts` (`MAX_GENERATIONS_PER_HOUR`) |
| Adjust window-title-bar mobile sizes  | `app/globals.css` `@media (max-width: 768px)` |
| Send an admin email (e.g. guestbook) | `lib/notify.ts` (Resend wrapper)          |
| Add a front-end analytics event       | `posthog.capture(...)` in any client file |
| Add a server-side analytics event     | `captureServerEvent(name, props, req)` from `lib/capture.ts` |
| Gate a feature on a user flag         | `flags/flags.ts` + `flags/context.tsx`    |
| Append "Read more" attribution on copy| Wrap content in `<CopyAttribution url={...}>` (see `components/CopyAttribution.tsx`) |
| Add OG/Twitter to a new page          | Hoist `TITLE`/`DESCRIPTION`/`URL` consts; mirror across `metadata` + `openGraph` + `twitter`. Pattern lives in `app/blog/page.tsx`, `/privacy`, `/logout`, `/error` |
| Toggle analytics for a visitor        | `lib/analyticsOptOut.ts` flag — checked by `lib/CSPosthogProvider.tsx`; UI in `components/programs/Settings.tsx` |
| Catch chunk-load errors after deploy  | `components/ChunkReloadGuard.tsx` (mounted in `app/layout.tsx`) |

---

## Conventions

- **Styling**: CSS modules for structural layout, inline `style={{}}`
  for context-dependent values (dynamic colors, per-window dimensions).
  98.css supplies the retro chrome — don't override it, lean in.
- **Font sizing on mobile inputs**: `font-size: 16px` minimum to stop
  iOS from zoom-on-focus (already set in `globals.css`).
- **Commits**: imperative present tense, explain the *why*. Avoid
  em-dashes in user-facing copy (LLM smell — see prior commits).
- **Comments**: explain the reason, not the code. If a reader would
  ask "why this instead of the obvious thing?", that's the comment.
- **Error boundaries**:
  - `app/error.tsx` — segment-level, shown when a page crashes.
  - `app/global-error.tsx` — root-level, shown when the layout crashes.
  - `app/error/page.tsx` — the real `/error` route (OAuth failure target).
  All three share the retro-terminal aesthetic via `error.module.css`
  and `logout.module.css`.

---

## Security posture

| Layer                      | Mechanism                                      |
| -------------------------- | ---------------------------------------------- |
| CSP                        | Enforced via `next.config.mjs` (see `CSP` const) |
| AI cost ceiling (prod)     | `lib/api/costGuard.ts` (per-IP, per-visitor, global daily) |
| AI access gate (local)     | `lib/apiGuard.ts` (invite codes, session cookie) |
| Guestbook spam             | honeypot + min-elapsed + rate limits + AI moderation |
| Contact form spam          | honeypot + URL count cap + rate limits         |
| Email header injection     | `lib/notify.ts` strips CR/LF from subject / reply_to |
| Client chunk-load recovery | `components/ChunkReloadGuard.tsx` (single reload per 10s) |
| Client error telemetry     | `app/global-error.tsx` → `posthog.capture("client_error", …)` |
| Server rate-limit telemetry| `lib/api/costGuard.ts` → `captureServerEvent("cost_guard_hit")` |
| Visitor opt-out of analytics | `lib/analyticsOptOut.ts` (localStorage flag; respected at PostHog init + can be toggled live from Settings) |
| Plain-language disclosure  | `app/privacy/page.tsx` (linked from Start menu → Help → Privacy) |
| Copy-paste attribution     | `components/CopyAttribution.tsx` — appends "Read more at danoh.com/…" to clipboard on selections ≥ 40 chars; opt-out via `<pre>` or `data-no-copy-attribution` |

All in-memory rate limit buckets live in `lib/api/rateLimit.ts` with an
opportunistic sweep so they don't leak in a long-running container.

---

## Deploy flow

```
git push origin main
  → GitHub Actions builds + pushes Docker image (dddd4444/danoh-site:latest)
  → Watchtower on the server polls every ~5 min and rolls
  → OR force-pull: ssh intelliyap@178.156.146.97 \
       "cd /opt/stacks/danoh-portfolio && \
        sudo docker compose pull web && \
        sudo docker compose up -d --force-recreate web"
```

Common chore: after a deploy, any open browser tab will see stale
chunks on next navigation. `ChunkReloadGuard` handles this
automatically; no manual intervention needed unless the visitor
also has a broken cache.

---

## Running locally

```
npm i
cp .env.example .env   # flip NEXT_PUBLIC_LOCAL_MODE=true
npm run dev
```

In local mode:
- Supabase auth is bypassed — `getUser()` returns `null`.
- `checkAccess` gates on an `ACCESS_CODE` env var (optional) + a
  `DATABASE_URL` for tracking sessions.
- `costGuard` does NOT run (it's prod-only).
- PostHog + Plausible + Resend are all no-ops without their env keys.

---

## Things to be careful about

- **Server actions + onClick**: Next.js's `redirect()` only auto-
  dispatches from a form's `formAction`. If you call a server action
  from a bare click handler, you'll need to force navigation
  client-side. See `confirmLogout` in `components/OS.tsx` for the
  pattern.
- **Rive embeds**: `rive.reset({autoplay: true})` synchronously fires
  the `stop` event. If you listen for `stop` to loop one-shots, use
  the unsubscribe-before-reset pattern in `components/mdx/RiveInner.tsx`
  or you'll stack-overflow on unmount.
- **`fsManagerAtom`**: an async atom. The `useAtom(fsManagerAtom)`
  call at the top of `OS.tsx` is a deliberate eager subscription to
  start the IndexedDB chain early — don't remove it.
- **Em-dashes in user-facing copy**: intentionally avoided (signals
  LLM-generated text). Use `·`, `:`, `,`, or periods instead.
