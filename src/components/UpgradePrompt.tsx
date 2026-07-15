import Link from "next/link";
import { ReactNode } from "react";

export function UpgradePrompt({ 
  children, 
  isLocked, 
  featureName, 
  description 
}: { 
  children: ReactNode; 
  isLocked: boolean; 
  featureName: string; 
  description?: string;
}) {
  if (!isLocked) return <>{children}</>;

  return (
    <div className="relative min-h-[500px] h-full flex-1 flex flex-col w-full">
      <div className="flex-1 blur-sm opacity-50 pointer-events-none select-none overflow-hidden" aria-hidden="true">
        {children}
      </div>
      
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40 backdrop-blur-md p-4 rounded-2xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-[var(--color-ink-100)] p-8 text-center relative overflow-hidden">
          {/* Decorative background elements matching pricing page */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-[var(--color-brand)]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[var(--color-accent-500)]/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10">
            <div className="w-16 h-16 bg-[var(--color-brand)]/10 text-[var(--color-brand)] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-[var(--color-brand)]/20">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            
            <h3 className="text-2xl font-bold text-[var(--color-ink-900)] tracking-tight">
              Unlock {featureName}
            </h3>
            
            <p className="mt-3 text-[15px] text-[var(--color-ink-600)] leading-relaxed">
              {description || `Your current plan doesn't include access to ${featureName}. Upgrade your plan to unlock this and many other powerful features.`}
            </p>
            
            <div className="mt-8">
              <Link 
                href="/settings/billing"
                className="inline-flex w-full items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-[var(--color-brand)] to-[var(--color-accent-500)] text-white font-semibold rounded-xl hover:opacity-90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                View Plans & Upgrade
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
