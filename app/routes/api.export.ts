import type { LoaderFunctionArgs } from "@remix-run/node";
import { requireUser } from "~/auth.server";
import db from "~/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);

  const expenses = db
    .prepare(
      `SELECT e.*, u.name as submitter_name, u.email as submitter_email
       FROM expenses e
       JOIN users u ON e.user_id = u.id
       ORDER BY e.created_at DESC`
    )
    .all() as any[];

  let csv = "ID,Title,Description,Amount,Category,Status,Submitter,Email,Date\n";
  for (const exp of expenses) {
    const desc = (exp.description || "").replace(/"/g, '""');
    const title = exp.title.replace(/"/g, '""');
    csv += `${exp.id},"${title}","${desc}",${exp.amount},${exp.category},${exp.status},"${exp.submitter_name}","${exp.submitter_email}",${exp.created_at}\n`;
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="expenses_export_${Date.now()}.csv"`,
    },
  });
}
