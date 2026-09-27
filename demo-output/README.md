# ReHook full product demo

`rehook-full-demo.mp4` is a separate 2:18 captioned demonstration, 1920×1080 at 30 fps. The existing `brag-output/brag.mp4` is the separate 20-second intro/showcase and was not changed by this task.

## Chapters

- 00:00 — Opening and demo context
- 00:06 — Isolated empty dashboard and endpoint registration
- 00:17 — Configure, dispatch, inspect payload and successful signed delivery
- 00:42 — Controlled HTTP 500 failure, automatic retries, exhausted attempt budget
- 01:07 — DLQ inspection, restore the receiver, replay, successful recovery
- 01:25 — API signing-secret rotation and verification of both HMAC signatures
- 01:44 — Six-event outage, circuit-open attempt log
- 01:57 — Cooldown completed, batch replay and final nine delivered events
- 02:12 — Closing result

## What is real

All app footage was captured from the running ReHook UI with its real API, worker, PostgreSQL and Redis in an isolated `rehookdemo` Compose project. The Python receiver on port 4010 deliberately returns HTTP 200 or 500 and verifies actual HMAC signatures. No UI values were mocked or painted into the footage. Source screenshots and timing metadata are in `capture/`; event and receiver evidence is retained alongside this file.

Receiver mode changes, rotation and the six-event outage submission were performed through local APIs offscreen and explicitly labeled in the captions. Waiting between recorded sequences was edited out. The circuit uses its actual default 30-second cooldown. Nine of nine delivered is the observed result in this controlled run, not a performance or reliability guarantee. The app's existing “Zero-Loss” badge is product UI, not a benchmark established by this video.

The signing keys shown are disposable local demo keys. The API-key label in the app header is the app's existing display label; this isolated stack uses `demo-local-only`. The retry form says “Max Retries,” but its API value is a maximum total attempt budget, which the captions describe accurately. The current UI's V1/V2 descriptions do not substitute for receiver verification; both actual signatures are shown as valid.

## Source and reproduction

- `composition/` — editable HyperFrames composition with scene files, video, music and media manifest
- `storyboard.json` — exact chapter captions and time ranges
- `prepare.py` — assembles real browser frames into the source video
- `build-composition.py` — writes the editable caption/chapter composition
- `compose.yaml`, `receiver.py` — isolated demo infrastructure
- `qa/` — composition snapshots for visual inspection

Render with HyperFrames 0.8.80 from `composition/`:

```sh
npx hyperframes@0.8.80 check
npx hyperframes@0.8.80 render --quality delivery --fps 30 --output ../rehook-full-demo.mp4
```

Music reuses the existing project's `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`, attenuated and faded in/out. There is no spoken narration; all instructions are on-screen captions.
