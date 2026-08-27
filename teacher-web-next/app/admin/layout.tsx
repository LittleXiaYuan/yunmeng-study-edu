import { Suspense, type ReactNode } from "react";
import { RoleGuard } from "@/components/portal/role-guard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <RoleGuard role="admin">{children}</RoleGuard>
    </Suspense>
  );
}
