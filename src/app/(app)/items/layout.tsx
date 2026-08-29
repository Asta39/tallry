import { ModuleGuard } from "@/components/ModuleGuard";

export default function ItemsLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGuard module="crm">{children}</ModuleGuard>;
}
