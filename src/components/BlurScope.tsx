"use client";

import { useBlur } from "@/components/BlurContext";

/** Wraps the app's page content so every .money-lg/.tnum figure inside
 *  respects the shared blur toggle — see BlurContext/BlurToggleSwitch. */
export function BlurScope({ children }: { children: React.ReactNode }) {
  const { blurred } = useBlur();
  return (
    <div className="blur-scope contents" data-blurred={blurred ? "1" : "0"}>
      {children}
    </div>
  );
}
