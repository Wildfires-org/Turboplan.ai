// Worker used by extract-doc.test.ts: same shape as the research agent's
// extraction worker (plain ESM, imports the parser, posts the result back).
import { parentPort, workerData } from "node:worker_threads";

import WordExtractor from "word-extractor";

const document = await new WordExtractor().extract(Buffer.from(workerData));
parentPort.postMessage(document.getBody());
