const { Resource } = require("@opentelemetry/resources");
const {
  NodeTracerProvider,
  SimpleSpanProcessor,
  ConsoleSpanExporter,
  BatchSpanProcessor,
} = require("@opentelemetry/sdk-trace-node");

const {
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} = require("@opentelemetry/semantic-conventions");
const {
  OTLPTraceExporter,
} = require("@opentelemetry/exporter-trace-otlp-grpc");
const { W3CTraceContextPropagator } = require("@opentelemetry/core");
const { registerInstrumentations } = require("@opentelemetry/instrumentation");
const { HttpInstrumentation } = require("@opentelemetry/instrumentation-http");
const {
  ExpressInstrumentation,
} = require("@opentelemetry/instrumentation-express");
const {
  MongoDBInstrumentation,
} = require("@opentelemetry/instrumentation-mongodb");
const {
  WinstonInstrumentation,
} = require("@opentelemetry/instrumentation-winston");

const faroEnv = {
  url: "https://faro-collector-prod-us-east-0.grafana.net/collect/36f7682940d9377b64573fd5484918da",
  app: {
    environment: "local",
    name: "demo-remix",
    version: "missing-version",
  },
};

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
