// maybe we use react version? @grafana/faro-react
// https://github.com/grafana/faro-web-sdk/blob/main/demo/src/client/faro/initialize.ts
import { getWebInstrumentations, initializeFaro } from "@grafana/faro-web-sdk";
import { TracingInstrumentation } from "@grafana/faro-web-tracing";
import { faroEnv } from "./env";

const faro = initializeFaro({
  ...faroEnv,
  instrumentations: [
    // Mandatory, overwriting the instrumentations array would cause the default instrumentations to be omitted
    ...getWebInstrumentations({
      captureConsole: true,
    }),

    // Initialization of the tracing package.
    // This packages is optional because it increases the bundle size noticeably. Only add it if you want tracing data.
    new TracingInstrumentation(),
  ],
});

const OTEL = faro.api.getOTEL();

if (!OTEL) {
  throw new Error("Unable to init OTEL");
}

export const context = OTEL.context;
export const trace = OTEL.trace;
