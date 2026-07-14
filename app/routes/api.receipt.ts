import type { LoaderFunctionArgs } from "@remix-run/node";
import { requireUser } from "~/auth.server";
import path from "path";
import fs from "fs";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);

  const url = new URL(request.url);
  const file = url.searchParams.get("file");

  if (!file) {
    throw new Response("File parameter required", { status: 400 });
  }

  const baseDir = path.resolve(process.cwd(), "data", "receipts");
  const filePath = path.resolve(baseDir, file);

  if (!filePath.startsWith(baseDir + path.sep)) {
    throw new Response("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    throw new Response("Receipt not found", { status: 404 });
  }

  const content = fs.readFileSync(filePath);
  const ext = path.extname(file).toLowerCase();

  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
  };

  return new Response(content, {
    headers: {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${path.basename(file)}"`,
    },
  });
}
