import { Resource } from "@opentelemetry/resources";
const faroEnv = {
  url: "https://faro-collector-prod-us-east-0.grafana.net/collect/36f7682940d9377b64573fd5484918da",
  app: {
    environment: "local",
    name: "demo-remix",
    version: "missing-version",
  },
};

import { context, trace } from "@opentelemetry/api";
import {
  BatchSpanProcessor, ConsoleSpanExporter,
  NodeTracerProvider, SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-node";
import {
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { MongoDBInstrumentation } from "@opentelemetry/instrumentation-mongodb";
import { WinstonInstrumentation } from "@opentelemetry/instrumentation-winston";

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { createRequestHandler } from "@remix-run/express";
import { broadcastDevReady, installGlobals } from "@remix-run/node";
import compression from "compression";
import express from "express";
import morgan from "morgan";
import sourceMapSupport from "source-map-support";
import {collectDefaultMetrics} from "prom-client";

initOtel();
initMetrics();

await initApp();

function initOtel() {
  const provider = new NodeTracerProvider({
    resource: Resource.default().merge(
        new Resource({
          [SEMRESATTRS_SERVICE_NAME]: faroEnv.app.name,
          [SEMRESATTRS_SERVICE_VERSION]: faroEnv.app.version,
          [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: faroEnv.app.environment,
        })
    ),
  });

  provider.addSpanProcessor(
      new BatchSpanProcessor(
          new OTLPTraceExporter({
            url: "https://tempo-prod-04-prod-us-east-0.grafana.net/tempo",
            headers: {
              Authorization: `Basic ${btoa(
                  "821172:glc_eyJvIjoiMTA2NTIyNyIsIm4iOiJzdGFjay04NjkwNzQtaGwtcmVhZC10ZXN0X3Rva2VuIiwiayI6IkxWc20xOWFYMjVFOG1ZYjkwWTE1aUQwbCIsIm0iOnsiciI6InByb2QtdXMtZWFzdC0wIn19"
              )}`,
            },
          })
      )
  );
  provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));

  provider.register({
    propagator: new W3CTraceContextPropagator(),
  });

  registerInstrumentations({
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new WinstonInstrumentation(),
      new MongoDBInstrumentation(),
    ],
  });
}
function initLogger() {

}
function initMetrics() {
  collectDefaultMetrics()
}


async function initApp() {


  sourceMapSupport.install({
    retrieveSourceMap: function (source) {
      const match = source.startsWith("file://");
      if (match) {
        const filePath = url.fileURLToPath(source);
        const sourceMapPath = `${filePath}.map`;
        if (fs.existsSync(sourceMapPath)) {
          return {
            url: source,
            map: fs.readFileSync(sourceMapPath, "utf8"),
          };
        }
      }
      return null;
    },
  });
  installGlobals();

  /** @typedef {import('@remix-run/node').ServerBuild} ServerBuild */

  const BUILD_PATH = path.resolve("build/index.js");
  const VERSION_PATH = path.resolve("build/version.txt");

  const initialBuild = await reimportServer();
  const remixHandler =
      process.env.NODE_ENV === "development"
          ? await createDevRequestHandler(initialBuild)
          : createRequestHandler({build: initialBuild});

  const app = express();

  app.use(compression());

// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
  app.disable("x-powered-by");

// Remix fingerprints its assets so we can cache forever.
  app.use(
      "/build",
      express.static("public/build", {immutable: true, maxAge: "1y"})
  );

// Everything else (like favicon.ico) is cached for an hour. You may want to be
// more aggressive with this caching.
  app.use(express.static("public", {maxAge: "1h"}));

  app.use(morgan("tiny"));

  app.all("*", (...args) => {
    const s = trace.getTracer(faroEnv.app.name, faroEnv.app.version);

    const span = s.startSpan("remixHandler");

    span.addEvent("startingRequest");
    span.setAttribute("testValue", true);

    const r = remixHandler(...args);

    span.end();
    return r;
  });

  const port = process.env.PORT || 4202;
  app.listen(port, async () => {
    console.log(`Express server listening at http://localhost:${port}`);

    if (process.env.NODE_ENV === "development") {
      broadcastDevReady(initialBuild);
    }
  });

  /**
   * @returns {Promise<ServerBuild>}
   */
  async function reimportServer() {
    const stat = fs.statSync(BUILD_PATH);

    // convert build path to URL for Windows compatibility with dynamic `import`
    const BUILD_URL = url.pathToFileURL(BUILD_PATH).href;

    // use a timestamp query parameter to bust the import cache
    return import(BUILD_URL + "?t=" + stat.mtimeMs);
  }

  /**
   * @param {ServerBuild} initialBuild
   * @returns {Promise<import('@remix-run/express').RequestHandler>}
   */
  async function createDevRequestHandler(initialBuild) {
    let build = initialBuild;

    async function handleServerUpdate() {
      // 1. re-import the server build
      build = await reimportServer();
      // 2. tell Remix that this app server is now up-to-date and ready
      broadcastDevReady(build);
    }

    const chokidar = await import("chokidar");
    chokidar
        .watch(VERSION_PATH, {ignoreInitial: true})
        .on("add", handleServerUpdate)
        .on("change", handleServerUpdate);

    // wrap request handler to make sure its recreated with the latest build for every request
    return async (req, res, next) => {
      try {
        return createRequestHandler({
          build,
          mode: "development",
        })(req, res, next);
      } catch (error) {
        next(error);
      }
    };
  }
}
