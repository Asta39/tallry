import { ModuleGuard } from "@/components/ModuleGuard";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGuard module="accounting">{children}</ModuleGuard>;
}
