import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { requireManager } from "~/auth.server";
import db from "~/db.server";

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireManager(request);
  const formData = await request.formData();
  const expenseId = formData.get("expense_id") as string;
  const action = formData.get("action") as string;

  if (!expenseId || !action) {
    return json({ error: "Missing parameters" }, { status: 400 });
  }

  const expense = db.prepare("SELECT * FROM expenses WHERE id = ?").get(expenseId) as any;
  if (!expense) {
    return json({ error: "Expense not found" }, { status: 404 });
  }

  if (expense.status !== "pending") {
    return json({ error: "Expense already processed" }, { status: 400 });
  }

  if (action === "approve") {
    db.prepare(
      "UPDATE expenses SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(user.id, expenseId);

    db.prepare("INSERT INTO reimbursements (expense_id, amount) VALUES (?, ?)").run(
      expenseId,
      expense.amount
    );

    return json({ success: true, message: "Expense approved and reimbursement created" });
  }

  if (action === "deny") {
    db.prepare(
      "UPDATE expenses SET status = 'denied', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(user.id, expenseId);

    return json({ success: true, message: "Expense denied" });
  }

  return json({ error: "Invalid action" }, { status: 400 });
}
