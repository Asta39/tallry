import { ModuleGuard } from "@/components/ModuleGuard";

export default function RecurringLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGuard module="accounting">{children}</ModuleGuard>;
}
