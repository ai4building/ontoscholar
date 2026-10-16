import { Outlet, Link, useLocation } from "react-router-dom";
import { FlaskConical, Library, ClipboardCheck, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "知识库", icon: Library },
  { to: "/review", label: "审核队列", icon: ClipboardCheck },
  { to: "/chat", label: "SciencePal 对话", icon: MessageSquare },
];

export default function AppShell() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
              <FlaskConical className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <h1 className="text-sm font-semibold tracking-tight">OntoScholar</h1>
              <p className="text-[11px] text-muted-foreground">以本体为契约的科研知识工程</p>
            </div>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition",
                  pathname === to
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}