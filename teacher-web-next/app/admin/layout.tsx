import { RoleGuard } from "@/components/portal/role-guard";
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RoleGuard role="admin">{children}</RoleGuard>;
}
