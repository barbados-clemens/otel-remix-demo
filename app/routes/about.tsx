import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { log } from "../logger.server";

export function loader() {
  log.info("loading about page", { message: "hi" });
  return json({ message: "hi" });
}

export default function AboutPage() {
  const { message } = useLoaderData<typeof loader>();

  return <div>{message} </div>;
}
