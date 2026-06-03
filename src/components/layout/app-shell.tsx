import { Sidebar } from "@/components/layout/sidebar";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative flex flex-col">
        <header className="flex h-14 shrink-0 items-center justify-end border-b px-6 bg-background">
          <ThemeSwitcher />
        </header>
        <div className="mx-auto w-full max-w-7xl p-8">{children}</div>
      </main>
    </div>
  );
}
