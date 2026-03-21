import { AdminAppBar } from "@/components/layout/admin-app-bar";
import { AdminSidebar } from "@/components/layout/admin-sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-surface-muted">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminAppBar />
        <main className="flex-1 p-4 pt-4 md:p-6 md:pt-6">{children}</main>
      </div>
    </div>
  );
}
