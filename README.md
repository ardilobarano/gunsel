# Günsel

**Turkish daily puzzle games, one set a day, played in the browser and installable as an app. Live at
[gunsel.app](https://gunsel.app).**

Günsel (Turkish for "of the day") is a platform of eight daily puzzle games in Turkish: every player gets the same puzzles
each day, with stats, streaks and results to share. It is a solo project, designed, built and run in production.

## The games

| Game | What it is |
| --- | --- |
| **Kelimesel** | Guess the word in six tries (3 to 8 letters, each length its own daily puzzle), from a 27,000-word list taken from the TDK dictionary. Also custom puzzles to send to a friend. |
| **Şarkısal** | Name the Turkish song from ever-longer clips of its opening (0.2 s up to 10 s), in All, Pop and Rap. |
| **Harf Peteği** | Make words from seven letters around a required centre letter; ranks up to "Kraliçe Arı". |
| **Karesel** | Name the film (or series) from its frames, from the least known frame to the most famous. |
| **Daha Az / Daha Çok** | Higher or lower across six categories: population, films, series, views, prices and trivia. |
| **Bağlamsal** | Sort sixteen words into four hidden groups of four. |
| **Haritasal** | Find the country (or Turkish province) from its silhouette, with the distance and direction of each guess. |
| **Renksel** | Recall the true colour of a part of a famous picture; scored by colour distance. |

## How it works

- **Answers stay on the server.** The day's puzzle is chosen on the server with a secret key, and every guess is checked
  through the API: the answer, and frames or clips not yet revealed, never reach the browser before they should. Progress
  in a puzzle travels in signed (HMAC) tokens, so the server needs no session and a tampered token is refused.
- **Content pipelines.** Scripts build each game's pools: the word lists from the TDK dictionary, a 14,000-song Turkish
  catalogue gathered from the Spotify API within its rate limits, film and series frames from TMDB (dropping any image
  that shows the title), country and province silhouettes from Natural Earth, and checkers that validate every pool
  before it ships.
- **Exact audio.** Song clips play through the Web Audio API, decoded in full and cut on the audio clock, so a 0.2 s clip
  is exactly 0.2 s on every device.
- **Accounts optional.** Stats and streaks live on the device; signing in with Google (Auth.js) keeps them across devices.
- **Design.** Two looks (Pop and Classic) with light and dark themes, a mobile-first layout, share cards and Open Graph
  images per game, and an installable PWA.

## Tech

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Prisma on Neon Postgres · Auth.js · framer-motion · Web Audio API
· deployed on Vercel from GitHub. About 24,000 lines of TypeScript.

## How it was built

I designed the games and the platform and directed their development with AI coding agents; every change was checked in
the browser across both looks and both themes before it went live. `CLAUDE.md` (in Turkish) is the project's working log:
the decisions, the measurements behind them and the rules the code follows.

## About this copy

This is a public showcase copy of the private repository that deploys gunsel.app, with a fresh history. It leaves out the
song clips and the song schedule (the clips are commercial recordings, and the schedule would spoil upcoming puzzles) and a
few cartoon-character pictures; everything else is the real code. Running it needs the environment variables listed in
`CLAUDE.md` (`.env.local`).

## Rights

Copyright © 2026 the author (github.com/ardilobarano). All rights reserved. Published to be read as a portfolio piece; no
licence to copy, modify, distribute or use it is granted. See [LICENSE](LICENSE). Song titles, films, series and other
names and data belong to their owners.
