import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { requireUserId } from "~/lib/session.server";

const run = promisify(exec);

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const host = new URL(request.url).searchParams.get("host") ?? "";
  const { stdout } = await run("traceroute -m 5 " + host, { timeout: 20000 });
  return json({ output: stdout });
}
