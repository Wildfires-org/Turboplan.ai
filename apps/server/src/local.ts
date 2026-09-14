/**
 * This file is meant to run local development through node (see package.json scripts), it's main purpose is to simulate Vercel environment.
 * Whenever runtime fails on Vercel, you can use this to reproduce the issue on very similar environment.
 * */

import "./instrument.js";

import { serve } from "@hono/node-server";

import { getApiEnv } from "@wildfires-org/turboplan-env";

import app from "./index.js";

const ENV = getApiEnv();

serve(
  {
    fetch: app.fetch,
    port: Number(ENV.PORT) || 3001,
  },
  (info) => {
    console.log(`Server running on http://localhost:${info.port}`);
  },
);
