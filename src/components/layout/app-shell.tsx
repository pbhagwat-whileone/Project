import { Sidebar } from "@/components/layout/sidebar";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative">
        <div className="absolute right-4 top-4">
          <ThemeSwitcher />
        </div>
        <div className="mx-auto max-w-7xl p-8">{children}</div>
      </main>
    </div>
  );
}
