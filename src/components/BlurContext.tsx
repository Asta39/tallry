"use client";

import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "blur-money";

const BlurContext = createContext<{ blurred: boolean; toggle: () => void }>({
  blurred: false,
  toggle: () => {},
});

/** App-wide privacy blur for every KPI/money figure (.money-lg/.tnum) —
 *  dashboard, invoices, quotes, bills, expenses, banking, wherever. One
 *  shared toggle, persisted per-browser, so it stays blurred across page
 *  navigations and reloads until switched off. */
export function BlurProvider({ children }: { children: React.ReactNode }) {
  const [blurred, setBlurred] = useState(false);

  useEffect(() => {
    setBlurred(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function toggle() {
    setBlurred((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return <BlurContext.Provider value={{ blurred, toggle }}>{children}</BlurContext.Provider>;
}

export function useBlur() {
  return useContext(BlurContext);
}
