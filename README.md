# Netrics

Film your run, say your stats out loud, and build a player profile. A basketball tracking app for recreational players.

**Try it:** https://zkfruitrollup-emily.github.io/netrics/ (open on a phone, then "Add to Home Screen")

## How it works

1. **Set up.** Choose solo or multi-player and your court.
2. **Film.** Prop your phone with the hoop in frame and record. Tap Highlight after a good play.
3. **Say your stats.** Record a voice memo, for example: "Five for eight at the rim. Left corner two of three. Six rebounds, and we won 21 to 18." You can also upload a memo, type it, or enter numbers by hand.
4. **Check and confirm.** Netrics transcribes the memo, flags anything unclear, and you correct it before it counts.
5. **See your game.** Recap, shot chart, insights, jump-to highlights, trends, personal bests and a shareable session card.

Automatic shot tracking with computer vision is not built yet. Voice logging stands in for it, and the session data model is ready for a tracker to fill in the same stats.

## Privacy

There is no account and no server. Sessions, video and memos are stored in the browser on the device. Speech is transcribed on the device with Whisper running in WebAssembly. The speech model (about 44 MB) downloads once from Hugging Face.

## Development

```bash
npm install
npm run dev
npm test
npm run build
```

Camera and microphone need HTTPS or localhost. Pushing to `main` builds and deploys to GitHub Pages.

| Path | What it does |
|---|---|
| `src/lib/parser.ts` | Turns a spoken memo into stats and flags |
| `src/lib/stats.ts` | Totals, points, heat bands, insights, personal bests |
| `src/lib/db.ts` | IndexedDB storage, with video saved in chunks while filming |
| `src/lib/whisper.worker.ts` | On-device speech to text |
| `src/screens/` | Onboarding, players, camera, memo, processing, recap, confirm, profile |

Type: [Alumni Sans](https://fonts.google.com/specimen/Alumni+Sans) and [Gantari](https://fonts.google.com/specimen/Gantari), self-hosted.
