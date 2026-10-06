# ReHook overview diagram

The README uses [`../assets/how-it-works.svg`](../assets/how-it-works.svg), a static overview of delivery and recovery. [`how-it-works.json`](how-it-works.json) preserves its Archify topology and initial validated layout. The static SVG enlarges typography, applies the ReHook palette, and removes viewer controls and background patterns for GitHub readability.

The overview deliberately groups durable retry/replay scheduling. Automatic retries use backoff; operator replay creates an immediately available outbox record. The expandable Mermaid map in the main README supplies the detailed component paths.

Source references:

- [`../../apps/api/src/services/webhook.service.ts`](../../apps/api/src/services/webhook.service.ts): registration and replay transactions.
- [`../../apps/api/src/services/outbox.service.ts`](../../apps/api/src/services/outbox.service.ts): queue publication.
- [`../../apps/api/src/workers/webhook.worker.ts`](../../apps/api/src/workers/webhook.worker.ts): circuit checks, signatures, attempts, retries, and dead states.

Validation and artifact hashes are recorded in [`validation.json`](validation.json). The Archify topology passed all nine showcase checks. The final static SVG was visually inspected and the README was rendered using GitHub's Markdown API. The temporary standalone HTML viewer exceeded desktop vertical containment; it is not a delivered README asset.
