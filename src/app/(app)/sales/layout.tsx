import { ModuleGuard } from "@/components/ModuleGuard";

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGuard module="crm">{children}</ModuleGuard>;
}
