import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { execFileSync } from "child_process";
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

  // Only allow hostnames/IPs made of characters valid in DNS names and IP
  // literals. This rejects shell metacharacters, spaces and option-like
  // arguments before the value is ever passed to a child process.
  if (host.length > 255 || !/^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(host)) {
    throw new Response("invalid host parameter", { status: 400 });
  }

  let output: string;
  try {
    // Pass arguments as an array (no shell) so the host value can never be
    // interpreted as additional commands.
    output = execFileSync("ping", ["-c", "1", "-W", "2", "--", host], {
      encoding: "utf8",
      timeout: 5000,
    });
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message: string };
    output = err.stdout || err.stderr || err.message;
  }

  return json({ host, reachable: /1 (packets )?received/.test(output), output });
}
