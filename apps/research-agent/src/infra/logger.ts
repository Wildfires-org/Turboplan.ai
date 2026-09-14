export type LogType =
  | "info"
  | "success"
  | "error"
  | "warning"
  | "security"
  | "agent"
  | "target-api"
  | "memory"
  | "deployment"
  | "server";

export type LogOptions = {
  runId?: string;
  customIcon?: string;
};

export type Logger = {
  log(message: string, type?: LogType, options?: LogOptions): void;
  error(message: string, err: unknown, options?: LogOptions): void;
};

const DEFAULT_ICONS: Record<LogType, string> = {
  info: "ℹ️",
  success: "✅",
  error: "❌",
  warning: "⚠️",
  security: "🛡️",
  agent: "🤖",
  "target-api": "📡",
  memory: "📚",
  deployment: "🚀",
  server: "🌐",
};

const ANSI_COLORS: Record<LogType, string> = {
  info: "\x1b[36m",
  success: "\x1b[32m",
  error: "\x1b[31m",
  warning: "\x1b[33m",
  security: "\x1b[35m",
  agent: "\x1b[34m",
  "target-api": "\x1b[36m",
  memory: "\x1b[34m",
  deployment: "\x1b[35m",
  server: "\x1b[32m",
};

const ANSI_RESET = "\x1b[0m";

export class ConsoleLogger implements Logger {
  private stackTraces: boolean;

  constructor() {
    this.stackTraces = process.env.LOG_STACK_TRACES !== "false";
  }

  log(message: string, type: LogType = "info", options?: LogOptions): void {
    const icon = options?.customIcon ?? DEFAULT_ICONS[type];
    const color = ANSI_COLORS[type];
    const prefix = options?.runId ? ` [${options.runId}]` : "";
    const formatted = `${color}${icon}${prefix} ${message}${ANSI_RESET}`;

    if (type === "error") {
      console.error(formatted);
    } else if (type === "warning") {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  error(message: string, err: unknown, options?: LogOptions): void {
    const errMsg = err instanceof Error ? err.message : String(err);
    const icon = options?.customIcon ?? DEFAULT_ICONS.error;
    const color = ANSI_COLORS.error;
    const prefix = options?.runId ? ` [${options.runId}]` : "";
    const formatted = `${color}${icon}${prefix} ${message}: ${errMsg}${ANSI_RESET}`;

    if (this.stackTraces) {
      console.error(formatted, err);
    } else {
      console.error(formatted);
    }
  }
}

let instance: Logger = new ConsoleLogger();

export const logger: Logger = {
  log(message: string, type?: LogType, options?: LogOptions): void {
    instance.log(message, type, options);
  },
  error(message: string, err: unknown, options?: LogOptions): void {
    instance.error(message, err, options);
  },
};
