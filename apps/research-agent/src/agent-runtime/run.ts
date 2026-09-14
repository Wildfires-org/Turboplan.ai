import { createInterface } from "node:readline";
import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";

import { AsyncQueue } from "./async-queue";
import { getAgentRuntimeEnv } from "./env";
import {
  log,
  stringifyToolResult,
  summarizeToolInput,
  truncate,
} from "./logging";
import { ensureClaudeHomeFiles, ensureRuntimePath } from "./sandbox-setup";
import { parseWireMessage, toSdkUserMessage } from "./wire-protocol";

/**
 * Main entrypoint for the agent running inside a sandbox (Modal or local).
 *
 * Flow:
 * 1. Prepares the environment (PATH, Claude config files).
 * 2. Reads the first message from stdin (wire protocol) — must be a "start" message with a prompt.
 * 3. Starts a Claude Agent SDK session (`query()`) with a restricted set of tools.
 * 4. In parallel:
 *    - Pumps subsequent messages from stdin into an AsyncQueue, consumed by the SDK.
 *    - Iterates over the SDK response stream and logs progress (turns, tools, costs).
 * 5. On completion, writes the result to stdout as JSON.
 */
async function main(): Promise<void> {
  // Ensure PATH includes tool binaries and ~/.claude/ has the required config files
  ensureRuntimePath();
  ensureClaudeHomeFiles();

  const env = getAgentRuntimeEnv();

  // `rl` (readline interface) — reads stdin line by line.
  // The run manager sends messages in JSON-per-line format (wire protocol),
  // and rl parses the byte stream into individual lines.
  // crlfDelay: Infinity treats \r\n as a single line separator.
  const rl = createInterface({
    input: process.stdin,
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  // Convert readline to an async iterator for manual control over when we read
  // the next line (first line = start message, rest = runtime messages).
  const lineIterator = rl[Symbol.asyncIterator]();

  // The first message must be a "start" type — it contains the prompt to execute
  const firstMessageResult = await lineIterator.next();
  if (firstMessageResult.done) {
    process.stderr.write("No input provided on stdin");
    process.exit(1);
  }
  const firstMessage = parseWireMessage(firstMessageResult.value);
  if (!firstMessage || firstMessage.type !== "start") {
    process.stderr.write("First input message must be a start message");
    process.exit(1);
  }
  const prompt = firstMessage.prompt.trim();
  if (!prompt) {
    process.stderr.write("Start prompt cannot be empty");
    process.exit(1);
  }

  const maxTurns = 80;

  // Firecrawl MCP is only wired when an API key is present — otherwise the server
  // would fail to spawn. When absent, the agent still has WebFetch/WebSearch and
  // the curl-based Firecrawl fallback documented in the workspace instructions.
  const firecrawlEnabled = env.FIRECRAWL_API_KEY.length > 0;

  // The sandboxed agent has a restricted toolset — it can run commands and search
  // the web, but cannot directly edit files (the sandbox is ephemeral and the
  // output is text, not file changes).
  const allowedTools = [
    "Bash",
    "WebFetch",
    "WebSearch",
    "Skill",
    "ToolSearch",
    "EnterPlanMode",
    ...(firecrawlEnabled ? ["mcp__firecrawl__firecrawl_scrape"] : []),
  ];

  // Discovery is done with WebSearch (firecrawl_search returns low-quality
  // keyword matches for these gov/project queries). Firecrawl is scrape-only.
  // allowedTools is not restrictive under dontAsk, so block search explicitly.
  const disallowedTools = [
    "Write",
    "Edit",
    "Read",
    "Glob",
    "Grep",
    "mcp__firecrawl__firecrawl_search",
    // No sub-agents: the agent was spawning Task("Explore") to read files it
    // could just `cat`, costing a full subagent (~50s) per run for nothing.
    "Task",
    "TaskOutput",
  ];

  // Start a Claude Agent SDK session — returns an async iterable stream
  // of messages (system/init, assistant turns, result).
  const stream = query({
    prompt,
    options: {
      cwd: env.AGENT_CWD,
      model: env.CLAUDE_MODEL,
      settingSources: ["project"],
      allowedTools,
      disallowedTools,
      maxTurns,
      mcpServers: firecrawlEnabled
        ? {
            firecrawl: {
              type: "stdio",
              // Modal: use the binary preinstalled in the sandbox image (no
              // per-run download). Local dev: npx fetches it on demand so devs
              // don't need a global install — only FIRECRAWL_API_KEY in .env.
              command: env.AGENT_LOCAL ? "npx" : "firecrawl-mcp",
              args: env.AGENT_LOCAL ? ["-y", "firecrawl-mcp@3.20.4"] : [],
              env: { FIRECRAWL_API_KEY: env.FIRECRAWL_API_KEY },
            },
          }
        : {},
      permissionMode: "dontAsk",
      debug: env.DEBUG_CLAUDE_AGENT_SDK,
      stderr: (data) => {
        process.stderr.write(`[claude-sdk] ${data}`);
      },
    },
  });

  // AsyncQueue bridges stdin and the SDK — the run manager can send additional
  // messages during the session (e.g. abort), which reach the SDK via streamInput().
  const queue = new AsyncQueue<SDKUserMessage>();
  const streamInputPromise = stream
    .streamInput(queue)
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      log(`streamInput error: ${message}`);
    });

  // "Stdin pump" — reads subsequent lines from stdin in the background (after the
  // initial "start"), parses them from wire protocol, and pushes them into the queue
  // for the SDK to consume. This enables the run manager to inject user context
  // mid-run (e.g. via the /add-context endpoint). When stdin closes, closes the queue.
  const stdinPump = (async () => {
    for await (const line of lineIterator) {
      const wireMessage = parseWireMessage(line);
      if (!wireMessage || wireMessage.type === "start") continue;
      queue.push(toSdkUserMessage(env.RUN_ID, wireMessage));
      log(`injected runtime message (${wireMessage.type})`);
    }
    queue.close();
  })();

  const emitProgress = (role: string, content: string): void => {
    process.stdout.write(
      `${JSON.stringify({ type: "progress", role, content })}\n`,
    );
  };

  const emitResult = (result: string): void => {
    process.stdout.write(`${JSON.stringify({ type: "result", result })}\n`);
  };

  const emitError = (msg: string, status: number): void => {
    process.stdout.write(`${JSON.stringify({ type: "error", msg, status })}\n`);
  };

  let result = "";
  let turnCount = 0;
  let lastApiErrorStatus: number | null = null;
  const startTime = Date.now();
  // Maps tool_use id → tool name so tool-result messages can be labeled.
  const toolNamesById = new Map<string, string>();

  // Main loop — iterate over the Claude Agent SDK response stream
  for await (const msg of stream) {
    switch (msg.type) {
      case "system": {
        if (msg.subtype === "init") {
          const skillsInfo = msg.skills?.length
            ? ` | skills: ${msg.skills.join(", ")}`
            : "";
          // Provider visibility: ANTHROPIC_BASE_URL is only set when traffic is
          // routed through OpenRouter (see infra/model-provider.ts).
          const provider = process.env.ANTHROPIC_BASE_URL?.includes(
            "openrouter",
          )
            ? "openrouter"
            : "anthropic";
          log(
            `init | model=${msg.model} | provider=${provider} | tools: ${msg.tools.join(", ")}${skillsInfo}`,
          );
        }
        if (msg.subtype === "api_retry") {
          lastApiErrorStatus = msg.error_status;
          log(
            `API retry ${msg.attempt}/${msg.max_retries} | status=${msg.error_status} | ${msg.error}`,
          );
        }
        break;
      }

      case "assistant": {
        turnCount++;
        const content = msg.message.content;

        // Extract first text block for turn summary
        const textBlock = content.find(
          (b: { type: string }) => b.type === "text",
        ) as { type: "text"; text: string } | undefined;
        const summary = textBlock ? truncate(textBlock.text, 500) : "(no text)";
        log(`turn ${turnCount}/${maxTurns} | ${summary}`);

        // Emit full content array (text, tool_use, tool_results) for persistence
        emitProgress("assistant", JSON.stringify(content));

        // Log each tool_use block
        for (const block of content) {
          if (block.type === "tool_use") {
            toolNamesById.set(block.id, block.name);
            const inputSummary = summarizeToolInput(block.name, block.input);
            log(
              `  tool: ${block.name}${inputSummary ? `("${inputSummary}")` : ""}`,
            );
          }
        }
        break;
      }

      // Tool results arrive as "user" messages. Log what each tool returned
      // (WebSearch hits, the content firecrawl_scrape pulled) so the Fly logs
      // show what the agent actually found, not just what it called.
      case "user": {
        const userContent = msg.message.content;
        if (Array.isArray(userContent)) {
          for (const block of userContent) {
            if (block.type !== "tool_result") {
              continue;
            }
            const resultBlock = block as {
              tool_use_id: string;
              content: unknown;
              is_error?: boolean;
            };
            const name = toolNamesById.get(resultBlock.tool_use_id) ?? "tool";
            const flag = resultBlock.is_error ? " [error]" : "";
            const text = stringifyToolResult(resultBlock.content);
            log(`  ⤷ ${name} result${flag}: ${truncate(text, 600)}`);
          }
        }
        break;
      }

      case "result": {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        if (msg.subtype === "success") {
          result = msg.result;
          log(
            `done | ${msg.num_turns} turns | ${elapsed}s | $${msg.total_cost_usd.toFixed(4)}`,
          );
        } else {
          const errorMsg = msg.errors?.[0] ?? msg.subtype;
          const errorStatus =
            msg.subtype === "error_during_execution"
              ? (lastApiErrorStatus ?? 500)
              : 500;
          emitError(errorMsg, errorStatus);
          log(`error | ${msg.subtype} | ${msg.num_turns} turns | ${elapsed}s`);
        }
        break;
      }
    }
  }
  queue.close();
  rl.close();
  await Promise.allSettled([stdinPump, streamInputPromise]);

  emitResult(result);
}

main().catch((error) => {
  const msg = error instanceof Error ? error.message : String(error);
  process.stdout.write(
    `${JSON.stringify({ type: "error", msg, status: 500 })}\n`,
  );
  process.stderr.write(
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  process.exit(1);
});
