import type { Metadata } from "next";
import Link from "next/link";
import { ZenoFooter } from "@/components/ZenoFooter";

const TITLE = "Zeno vs Zoho Books — Accounting Software Comparison for Kenyan Businesses";
const DESCRIPTION =
  "How Zeno compares to Zoho Books for Kenyan SMBs: one product vs. separate apps, automatic M-Pesa reconciliation, and simple one-time-plus-per-seat pricing instead of tiered monthly subscriptions.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/vs/competitors" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/vs/competitors" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

type Row = { label: string; zeno: string; zoho: string; zenoWins?: boolean };

// Every claim below is checked against Zoho Books' own public pricing page
// and Kenya-market coverage at the time of writing — no fabricated numbers
// or features. Deliberately excludes KRA eTIMS: Zoho Books has a live,
// certified OSCU integration in Kenya and Zeno does not yet, so that row
// would favor Zoho, not Zeno — this page only makes claims that hold up.
const ROWS: Row[] = [
  {
    label: "Pricing model",
    zeno: "One-time setup fee + one-time fee per module, then a flat monthly fee per staff seat in KES.",
    zoho: "Tiered monthly subscription, roughly $20–$275/month depending on plan, billed in USD.",
    zenoWins: true,
  },
  {
    label: "What you're buying",
    zeno: "One product — Accounting, CRM, and Payroll together, pick the modules you need.",
    zoho: "Separate products (Zoho Books, Zoho Payroll, Zoho CRM) that you connect yourself.",
    zenoWins: true,
  },
  {
    label: "M-Pesa payments",
    zeno: "STK push and bank statements matched to invoices and bills automatically.",
    zoho: "M-Pesa payments need to be confirmed manually against each invoice.",
    zenoWins: true,
  },
  {
    label: "Payroll",
    zeno: "PAYE, NSSF, SHIF, and the Housing Levy calculated automatically in the same product you invoice from.",
    zoho: "Payroll runs through a separate Zoho product.",
    zenoWins: true,
  },
  {
    label: "Getting set up in Kenya",
    zeno: "Sign up directly — no local partner required.",
    zoho: "Kenya rollouts are commonly done through an authorized local Zoho partner.",
    zenoWins: true,
  },
  {
    label: "Trial",
    zeno: "30 days, full access to every module.",
    zoho: "14-day trial, plus a free plan for very small businesses under a revenue threshold.",
  },
];

export default function ZenoVsZohoBooksPage() {
  return (
    <main className="w-full bg-white">
      <div className="max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
        <p className="text-[#0f766e] font-medium mb-3">Comparison</p>
        <h1 className="md:text-4xl sm:text-4xl text-3xl font-semibold text-gray-900 leading-[120%] mb-4">
          Zeno vs Zoho Books
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Zoho Books is a solid, well-established global product. Here&apos;s where Zeno is built
          differently for a Kenyan business running accounting, CRM, and payroll together.
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-20">
        <div className="overflow-x-auto rounded-2xl border border-gray-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-5 py-4 text-sm font-semibold text-gray-500 w-1/5"></th>
                <th className="px-5 py-4 text-sm font-semibold text-gray-900">Zeno</th>
                <th className="px-5 py-4 text-sm font-semibold text-gray-900">Zoho Books</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-t border-gray-100">
                  <td className="px-5 py-4 text-sm font-medium text-gray-500 align-top">{row.label}</td>
                  <td className={`px-5 py-4 text-sm align-top ${row.zenoWins ? "text-gray-900 font-medium" : "text-gray-700"}`}>
                    {row.zeno}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600 align-top">{row.zoho}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-400 mt-4">
          Zoho Books details current as of publication, based on Zoho&apos;s own public pricing and Kenya-market
          documentation. Zoho Books has its own certified KRA eTIMS integration; Zeno&apos;s is on our roadmap and
          not live yet — if that specific integration is what you need today, Zoho Books already has it.
        </p>

        <div className="mt-12 text-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center h-14 px-8 rounded-full border-4 shadow-sm shadow-black border-black bg-gradient-to-t from-neutral-900 via-neutral-800 to-neutral-900 text-white text-lg font-semibold"
          >
            Start your 30-day free trial
          </Link>
          <p className="text-sm text-gray-500 mt-4">
            Or see <Link href="/#pricing" className="text-[#0f766e] hover:underline">full pricing</Link> and{" "}
            <Link href="/#faq" className="text-[#0f766e] hover:underline">frequently asked questions</Link>.
          </p>
        </div>
      </div>

      <ZenoFooter />
    </main>
  );
}
