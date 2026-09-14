// Manual diagnostic: confirms OpenRouter returns the exact per-call cost
// when usage accounting is enabled (the credit-metering basis).
// Run: cd packages/core/turboplan-ai && pnpm exec dotenv -e ../../../apps/server/.env -- npx tsx scripts/verify-usage-cost.ts
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

const main = async () => {
  const provider = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
  });
  const modelId =
    process.env.OPENROUTER_MODEL_LITE ?? "anthropic/claude-haiku-4.5";
  console.log("model:", modelId);
  const result = await generateText({
    model: provider(modelId, { usage: { include: true } }),
    prompt: "Reply with the single word: ok",
    abortSignal: AbortSignal.timeout(45_000),
  });
  const usage = (
    result.providerMetadata as
      | { openrouter?: { usage?: { cost?: number } } }
      | undefined
  )?.openrouter?.usage;
  console.log("text:", result.text.trim());
  console.log("openrouter usage:", JSON.stringify(usage));
  console.log("cost present:", typeof usage?.cost === "number");
};

main().catch((e) => {
  console.error("verify failed:", e?.message ?? e);
  process.exit(1);
});
