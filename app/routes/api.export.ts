import type { LoaderFunctionArgs } from "@remix-run/node";
import { requireUser } from "~/auth.server";
import db from "~/db.server";

function escapeCSVField(val: any): string {
  if (val === null || val === undefined) {
    return "";
  }
  let str = String(val);
  if (/^[=\+\-@]/.test(str)) {
    str = "'" + str;
  }
  return str.replace(/"/g, '""');
}

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
    const title = escapeCSVField(exp.title);
    const desc = escapeCSVField(exp.description);
    const category = escapeCSVField(exp.category);
    const status = escapeCSVField(exp.status);
    const submitter = escapeCSVField(exp.submitter_name);
    const email = escapeCSVField(exp.submitter_email);
    csv += `${exp.id},"${title}","${desc}",${exp.amount},"${category}","${status}","${submitter}","${email}","${exp.created_at}"\n`;
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="expenses_export_${Date.now()}.csv"`,
    },
  });
}
