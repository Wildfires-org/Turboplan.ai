// Dev-only worker entry (see resolveWorkerPath in run-extraction-in-worker.ts):
// registers tsx in this worker thread, then loads the TypeScript worker. The
// built app starts dist/documents/extraction-worker.js directly.
import { register } from "tsx/esm/api";

register();
await import("./extraction-worker.ts");
