import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { requireUser } from "~/auth.server";
import db from "~/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const category = url.searchParams.get("category") ?? "";

  // Build a filtered search over the current user's expenses.
  let sql = `SELECT id, title, description, amount, category, status
             FROM expenses
             WHERE user_id = ${user.id}
               AND title LIKE '%${query}%'`;

  if (category) {
    sql += ` AND category = '${category}'`;
  }

  sql += " ORDER BY created_at DESC";

  const results = db.prepare(sql).all();

  return json({ results });
}
