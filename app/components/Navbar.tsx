import { Link, Form, useLocation } from "@remix-run/react";

function navClass(current: string, path: string) {
  const base = "rounded-md px-3 py-2 text-sm font-medium";
  return current.startsWith(path)
    ? `${base} bg-indigo-700 text-white`
    : `${base} text-indigo-100 hover:bg-indigo-500 hover:text-white`;
}

export default function Navbar({ user }: { user: any }) {
  const location = useLocation();
  const p = location.pathname;

  return (
    <nav className="bg-indigo-600">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="text-xl font-bold text-white tracking-tight">
              ExpenseFlow
            </Link>
            <Link to="/dashboard" className={navClass(p, "/dashboard")}>Dashboard</Link>
            <Link to="/expenses" className={navClass(p, "/expenses")}>Expenses</Link>
            {(user.role === "manager" || user.role === "admin") && (
              <Link to="/admin" className={navClass(p, "/admin")}>Admin</Link>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/profile" className={navClass(p, "/profile")}>
              {user.name}
            </Link>
            <Form method="post" action="/logout">
              <button
                type="submit"
                className="rounded-md px-3 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-500 hover:text-white"
              >
                Sign out
              </button>
            </Form>
          </div>
        </div>
      </div>
    </nav>
  );
}
