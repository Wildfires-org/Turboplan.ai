import pino, {
  Logger,
  TransportMultiOptions,
  TransportPipelineOptions,
  TransportSingleOptions,
} from "pino";

interface ILoggerOptions {
  name: string;
  level: string;
  transport?:
    | TransportSingleOptions
    | TransportMultiOptions
    | TransportPipelineOptions;
}

export function getLogger(name: string): Logger {
  const options: ILoggerOptions = {
    name,
    level: process.env.LOGLEVEL || "debug",
  };

  return pino(options);
}
