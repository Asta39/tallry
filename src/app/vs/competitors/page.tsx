import type { Metadata } from "next";
import Link from "next/link";
import { ZenoFooter } from "@/components/ZenoFooter";

const TITLE = "Zeno vs Other Accounting Systems — Comparison for Kenyan Businesses";
const DESCRIPTION =
  "How Zeno compares to other accounting systems for Kenyan SMBs: one product instead of separate apps, automatic M-Pesa reconciliation, and simple one-time-plus-per-seat pricing instead of tiered monthly subscriptions.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/vs/competitors" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/vs/competitors" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

type Row = { label: string; zeno: string; others: string; zenoWins?: boolean };

// Compared against the established global accounting platforms sold in Kenya,
// without naming any one of them. Claims about "other systems" are kept
// general and hedged ("often", "usually") so they hold across that group —
// no fabricated numbers or features. Deliberately excludes KRA eTIMS: some
// of those platforms already have a live, certified integration and Zeno
// does not yet, so that row wouldn't favor Zeno — this page only makes
// claims that hold up.
const ROWS: Row[] = [
  {
    label: "Pricing model",
    zeno: "One-time setup fee + one-time fee per module, then a flat monthly fee per staff seat in KES.",
    others: "Tiered monthly subscriptions that climb with each plan, often billed in USD.",
    zenoWins: true,
  },
  {
    label: "What you're buying",
    zeno: "One product — Accounting, CRM, and Payroll together, pick the modules you need.",
    others: "Accounting, payroll, and CRM often sold as separate products that you connect yourself.",
    zenoWins: true,
  },
  {
    label: "M-Pesa payments",
    zeno: "STK push and bank statements matched to invoices and bills automatically.",
    others: "M-Pesa payments usually have to be confirmed manually against each invoice.",
    zenoWins: true,
  },
  {
    label: "Payroll",
    zeno: "PAYE, NSSF, SHIF, and the Housing Levy calculated automatically in the same product you invoice from.",
    others: "Kenyan statutory payroll often needs a separate product or add-on.",
    zenoWins: true,
  },
  {
    label: "Getting set up in Kenya",
    zeno: "Sign up directly — no local partner required.",
    others: "Kenya rollouts are commonly done through a local partner or reseller.",
    zenoWins: true,
  },
  {
    label: "Trial",
    zeno: "30 days, full access to every module.",
    others: "Typically a 14–30 day trial; some also offer a limited free plan for very small businesses.",
  },
];

export default function ZenoVsOtherSystemsPage() {
  return (
    <main className="w-full bg-white">
      <div className="max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
        <p className="text-[#0f766e] font-medium mb-3">Comparison</p>
        <h1 className="md:text-4xl sm:text-4xl text-3xl font-semibold text-gray-900 leading-[120%] mb-4">
          Zeno vs other systems
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Many accounting systems are solid, well-established global products. Here&apos;s where Zeno is
          built differently for a Kenyan business running accounting, CRM, and payroll together.
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-20">
        <div className="overflow-x-auto rounded-2xl border border-gray-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-5 py-4 text-sm font-semibold text-gray-500 w-1/5"></th>
                <th className="px-5 py-4 text-sm font-semibold text-gray-900">Zeno</th>
                <th className="px-5 py-4 text-sm font-semibold text-gray-900">Other systems</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-t border-gray-100">
                  <td className="px-5 py-4 text-sm font-medium text-gray-500 align-top">{row.label}</td>
                  <td className={`px-5 py-4 text-sm align-top ${row.zenoWins ? "text-gray-900 font-medium" : "text-gray-700"}`}>
                    {row.zeno}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600 align-top">{row.others}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-400 mt-4">
          &ldquo;Other systems&rdquo; describes the established global accounting platforms sold in Kenya in general,
          based on their public pricing and Kenya-market documentation at the time of writing; individual products
          differ. Some already have a certified KRA eTIMS integration; Zeno&apos;s is on our roadmap and not live
          yet — if that specific integration is what you need today, check that first.
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
