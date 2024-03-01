/**
 * By default, Remix will handle hydrating your app on the client for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.client
 */

import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

// import { trace, context } from "./init-web-otel";

// const defaultTracer = trace.getTracer("default");
// const span = defaultTracer?.startSpan("entry.client");

// context.with(trace.setSpan(context.active(), span), () => {
// console.log("starting");
startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
});
// });
