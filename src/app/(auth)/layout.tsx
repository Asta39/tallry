/** Full-screen centred wrapper for login, signup — no sidebar. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-ink-50)]">
      {children}
    </div>
  );
}
