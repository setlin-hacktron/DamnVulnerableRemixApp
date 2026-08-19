import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { execSync } from "child_process";
import { requireUser } from "~/auth.server";

// Lightweight reachability probe used by the expenses receipt-import UI to
// tell the user whether a receipt host is reachable before they paste a URL.
export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);

  const url = new URL(request.url);
  const host = url.searchParams.get("host");

  if (!host) {
    throw new Response("host parameter required", { status: 400 });
  }

  let output: string;
  try {
    output = execSync(`ping -c 1 -W 2 ${host}`, { encoding: "utf8", timeout: 5000 });
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message: string };
    output = err.stdout || err.stderr || err.message;
  }

  return json({ host, reachable: /1 (packets )?received/.test(output), output });
}
