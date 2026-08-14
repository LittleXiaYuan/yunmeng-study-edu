import { RoleGuard } from "@/components/portal/role-guard";
import type { ReactNode } from "react";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return <RoleGuard role="student">{children}</RoleGuard>;
}
