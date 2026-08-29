import { ModuleGuard } from "@/components/ModuleGuard";

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGuard module="accounting">{children}</ModuleGuard>;
}
