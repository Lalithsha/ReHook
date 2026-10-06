# README visual sources

- `rehook-banner.svg`: original vector wordmark and decorative loop, created for the README. It contains no performance claims.
- `delivery-dashboard.png`: unchanged capture from the recorded local demo at 128 seconds. Shows nine delivered events and an empty dead-letter queue.
- `failed-delivery-inspection.png`: unchanged capture at 63 seconds. Shows an exhausted three-attempt budget and the retained HTTP 500 response.
- `signature-rotation.png`: unchanged capture at 99 seconds. Shows HTTP 200 and receiver verification of both signing keys.

The screenshots come from the real ReHook UI, not generated interface mockups. Their caption bars are part of the original demo. Credentials and receiver addresses shown are disposable local demo values.

The original recording is in `demo-output/rehook-full-demo.mp4`. Selected API evidence is preserved in [`../evidence/recorded-demo.json`](../evidence/recorded-demo.json).

- `how-it-works.svg`: static, readable event-journey diagram derived from [`../diagrams/how-it-works.json`](../diagrams/how-it-works.json). Main steps use plain-language headings and technical subtitles; arrows show delivery and recovery paths.
