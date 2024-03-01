import {trace} from "@opentelemetry/api";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { log } from "../logger.server";


export async function loader() {

  const tracer = trace.getTracer('demo-remix');
  const s = tracer.startSpan('about-page-loader');
  s.setAttribute('message', 'hi');
  log.info("loading about page", { message: "hi" });
  s.addEvent('event running', Date.now());
  await new Promise((resolve) => setTimeout(resolve, 1000));
  s.end();
  return json({ message: "hi" });
}

export default function AboutPage() {
  const { message } = useLoaderData<typeof loader>();

  return <div>{message} </div>;
}
