import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { requireUser } from "~/auth.server";
import path from "path";
import fs from "fs";

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const receiptUrl = formData.get("url") as string;

  if (!receiptUrl) {
    return json({ error: "URL is required" }, { status: 400 });
  }

  try {
    const response = await fetch(receiptUrl);
    if (!response.ok) {
      return json({ error: "Failed to fetch receipt from URL" }, { status: 400 });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const ext = receiptUrl.split(".").pop()?.split("?")[0] || "pdf";
    const filename = `imported_${user.id}_${Date.now()}.${ext}`;
    const filePath = path.join(process.cwd(), "data", "receipts", filename);

    fs.writeFileSync(filePath, buffer);

    return json({ success: true, filename });
  } catch {
    return json({ error: "Could not fetch receipt from the provided URL" }, { status: 400 });
  }
}
