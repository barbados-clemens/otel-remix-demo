import { level, format, createLogger, transports } from "winston";
import { hostname } from "os";
import type { TransformableInfo } from "logform";

const WINSTON_LEVELS: Record<string, number> = {
  error: 0,
  warn: 1,
  info: 2,
  verbose: 3,
  debug: 4,
  silly: 5,
};

const gelf = format((info: TransformableInfo): TransformableInfo => {
  // console.log({ info, opts });
  const fullMessage = info.message;

  const shortMessage =
    typeof info.message === "string" || info.message instanceof String
      ? info.message.split("\n")[0]
      : info.message;

  const payload: Record<string, string | number | boolean> = {
    version: "1.1",
    timestamp: Date.now() / 1000,
    level: WINSTON_LEVELS[info.level] ?? 0,
    host: hostname(),
    short_message: shortMessage,
    full_message: fullMessage,
    message: "",
    _service: "demo-remix",
    _environment: process.env.NODE_ENV,
    _release: "missing-version",
  };

  Object.keys(info).forEach((key) => {
    if (
      key !== "error" &&
      key !== "level" &&
      key !== "message" &&
      key !== "id"
    ) {
      let value = info[key];
      const valueType = typeof value;
      if (valueType !== "string" && valueType !== "number") {
        value = JSON.stringify(value);
      }

      payload[`_${key}`] = value;
    }
  });

  // prevent double logging message
  delete info.message;

  // for some reason even if I return just payload it doesn't log,
  // I have to merge the objects, even though I'm overriding all the properties?
  return Object.assign(info, payload);
});

const logger = createLogger({
  level: "info",
  format: format.combine(gelf(), format.json()),
  defaultMeta: { service: "demo-remix" },
  transports: [new transports.Console()],
});

export const log = logger;
