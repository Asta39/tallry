import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">← Tallry</Link>
        </div>
        <article className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-10 prose-sm leading-relaxed text-[14px] text-gray-800 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:mb-1 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-2 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_li]:my-1">
          {children}
        </article>
        <div className="text-center text-[11px] text-gray-400 mt-6 space-x-3">
          <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-gray-600">Terms of Service</Link>
        </div>
      </div>
    </div>
  );
}
