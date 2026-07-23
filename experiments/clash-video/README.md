# Clash video experiment (SHELVED — 22 Jul 2026)

Remotion template that renders a coverage-contrast post as a 1080x1920 Reel:
intro hook → blue pane (outlet A headline, word-by-word reveal synced to VO)
→ red pane (outlet B) → SAME STORY pill → tagline outro. Demo rendered with
macOS `say` voiceover; production would use a proper TTS (~1-2¢/video).

Owner verdict: format works once, then it's wallpaper — templated video has
fixed choreography with a subtle payoff, so episode 2 is meaningless. Shelved
until one of two triggers:
  1. the owner wants to be the voice/face (automation becomes b-roll around a human), or
  2. community rating volume makes "readers rated this framing" content possible.

To rebuild: `npm i` here, regenerate VO with `say`, adjust src/timing.json to
the clip durations (afinfo), then `npx remotion render src/index.ts Clash out.mp4`.
