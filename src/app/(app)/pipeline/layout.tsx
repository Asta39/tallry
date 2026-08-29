import { ModuleGuard } from "@/components/ModuleGuard";

export default function PipelineLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGuard module="crm">{children}</ModuleGuard>;
}
