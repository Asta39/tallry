/**
 * Feature flags.
 *
 * eTIMS: the KRA electronic tax-invoice integration is fully built (see
 * src/lib/etims.ts, the TaxDevice interface, and the simulated device) but
 * DISABLED until a real OSCU/reseller integration is in place and we know
 * customers need it. While off:
 *   - issuing an invoice does NOT generate CU number / serial / QR
 *   - the eTIMS blocks on invoice views/PDFs don't render (they key off those
 *     fields, which stay null)
 * Nothing is deleted — flip ETIMS_ENABLED to true (or set ETIMS_ENABLED=true
 * in the environment) to switch the whole flow back on.
 */
export const ETIMS_ENABLED =
  process.env.ETIMS_ENABLED === "true" ? true : false; // default: off
