"use client";

import * as React from "react";
import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------
// Transition Physics
// ----------------------------------------------------------------------
const SPRING_TRANSITION = "max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
const SMOOTH_HEIGHT_TRANSITION = "max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), height 0.15s ease-out";

// ----------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------
function MorphingText({ text }: { text: string }) {
  const [width, setWidth] = useState<number | "auto">("auto");
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (spanRef.current) {
      setWidth(spanRef.current.offsetWidth);
    }
  }, [text]);

  return (
    <span
      className="relative inline-flex items-center justify-center overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]"
      style={{ width }}
    >
      <span ref={spanRef} className="invisible whitespace-nowrap px-1">
        {text}
      </span>
      <span
        key={text}
        className="absolute inset-0 flex items-center justify-center whitespace-nowrap animate-in fade-in zoom-in-95 duration-300"
      >
        {text}
      </span>
    </span>
  );
}

/** Provider glyphs — we don't have authorized brand asset files to embed,
 *  so these are simple hand-drawn marks evocative of each provider's public
 *  identity (Gemini's colorful sparkle, Groq's bolt for fast inference)
 *  rather than a reproduction of their actual logo artwork. */
function ModelIcon({ model, className }: { model: string; className?: string }) {
  const gradientId = React.useId();

  if (model === "Gemini") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" className={className} aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="14" y2="14">
            <stop offset="0%" stopColor="#4285F4" />
            <stop offset="50%" stopColor="#9B72CB" />
            <stop offset="100%" stopColor="#D96570" />
          </linearGradient>
        </defs>
        <path d="M7 0C7 3.5 3.5 7 0 7C3.5 7 7 10.5 7 14C7 10.5 10.5 7 14 7C10.5 7 7 3.5 7 0Z" fill={`url(#${gradientId})`} />
      </svg>
    );
  }

  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={className} aria-hidden="true">
      <path d="M7.5 1L2.5 8H6.5L6 13L11.5 6H7.5L7.5 1Z" fill="#F55036" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 12V2M7 2L2.5 6.5M7 2L11.5 6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DynamicBarsIcon({ level }: { level: string }) {
  const isMediumOrHigh = level === "Medium" || level === "Max Effort";
  const isHigh = level === "Max Effort";

  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1.5" y="8" width="2.5" height="4.5" rx="1" fill="currentColor" className="transition-opacity duration-300" opacity={1} />
      <rect x="5.75" y="5" width="2.5" height="7.5" rx="1" fill="currentColor" className="transition-opacity duration-300" opacity={isMediumOrHigh ? 1 : 0.3} />
      <rect x="10" y="2" width="2.5" height="10.5" rx="1" fill="currentColor" className="transition-opacity duration-300" opacity={isHigh ? 1 : 0.3} />
    </svg>
  );
}

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

export interface PromptInputProps {
  onSubmit?: (value: string, meta: { model: string; effort: string }) => void;
  placeholder?: string;
  className?: string;
  models?: string[];
  efforts?: string[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  (
    {
      onSubmit,
      placeholder = "Ask anything",
      className,
      models = ["Groq", "Gemini"],
      efforts = ["Low", "Medium", "Max Effort"],
      defaultValue = "",
      value: controlledValue,
      onChange,
    },
    ref
  ) => {
    const [expanded, setExpanded] = useState(false);
    const [isSmoothResize, setIsSmoothResize] = useState(false);
    const [localValue, setLocalValue] = useState(defaultValue);
    const [selectedModel, setSelectedModel] = useState(models[0]);
    const [effortIndex, setEffortIndex] = useState(1);
    const [isModelSelectOpen, setIsModelSelectOpen] = useState(false);

    const [hoverStyle, setHoverStyle] = useState({ opacity: 0, transform: "translateY(0px) scale(0.95)", transition: "none" });
    const [containerHeight, setContainerHeight] = useState(116);
    const [textareaHeight, setTextareaHeight] = useState(68);
    const [isScrolling, setIsScrolling] = useState(false);

    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : localValue;
    const hasValue = value.trim() !== "";

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const internalContainerRef = useRef<HTMLDivElement>(null);
    const topFadeRef = useRef<HTMLDivElement>(null);
    const bottomFadeRef = useRef<HTMLDivElement>(null);

    const updateFades = () => {
      const el = textareaRef.current;
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (topFadeRef.current) {
        topFadeRef.current.style.opacity = Math.min(scrollTop / 20, 1).toString();
      }
      if (bottomFadeRef.current) {
        const bottomScroll = scrollHeight - clientHeight - scrollTop;
        bottomFadeRef.current.style.opacity = Math.min(Math.max(bottomScroll - 16, 0) / 10, 1).toString();
      }
    };

    const handleValueChange = useCallback((val: string) => {
      setIsSmoothResize(true);
      if (!isControlled) setLocalValue(val);
      onChange?.(val);
    }, [isControlled, onChange]);

    const expand = () => {
      setIsSmoothResize(false);
      setExpanded(true);
    };

    useEffect(() => {
      if (value.trim() !== "" && !expanded) {
        setIsSmoothResize(false);
        setExpanded(true);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, expanded]);

    useEffect(() => {
      if (expanded) {
        const timer = setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            const length = textareaRef.current.value.length;
            textareaRef.current.setSelectionRange(length, length);
          }
        }, 50);
        return () => clearTimeout(timer);
      }
    }, [expanded]);

    useEffect(() => {
      if (!textareaRef.current) return;
      const el = textareaRef.current;

      const currentHeight = el.style.height;
      el.style.transition = 'none';
      el.style.height = "0px";
      const scrollHeight = el.scrollHeight;
      el.style.height = currentHeight;
      void el.offsetHeight;
      el.style.transition = '';

      const newHeight = Math.max(68, Math.min(scrollHeight, 160));
      el.style.height = `${newHeight}px`;

      setTextareaHeight(newHeight);
      setIsScrolling(scrollHeight > 160);

      setTimeout(updateFades, 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, expanded]);

    useEffect(() => {
      setContainerHeight(Math.max(116, textareaHeight + 48));
      setTimeout(updateFades, 0);
    }, [textareaHeight]);

    useEffect(() => {
      if (!isModelSelectOpen) return;
      const handleOutsideClick = (e: MouseEvent) => {
        if (internalContainerRef.current && !internalContainerRef.current.contains(e.target as Node)) {
          setIsModelSelectOpen(false);
        }
      };
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, [isModelSelectOpen]);

    const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
      if (internalContainerRef.current && internalContainerRef.current.contains(e.relatedTarget as Node)) return;
      if (value.trim() === "") {
        setIsSmoothResize(false);
        setExpanded(false);
        setIsModelSelectOpen(false);
      }
    };

    const handleSubmit = () => {
      if (value.trim() === "") return;
      setIsSmoothResize(false);
      onSubmit?.(value, { model: selectedModel, effort: efforts[effortIndex] });
      handleValueChange("");
      setExpanded(false);
      setIsModelSelectOpen(false);
    };

    const cycleEffort = (e: React.MouseEvent) => {
      e.stopPropagation();
      setEffortIndex((prev) => (prev + 1) % efforts.length);
    };

    return (
      <div
        ref={(node) => {
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
          // @ts-ignore
          internalContainerRef.current = node;
        }}
        onBlur={handleBlur}
        className={cn("relative flex flex-col w-full", className)}
        style={{
          maxWidth: expanded ? 480 : 320,
          transition: isSmoothResize ? "max-width 0.15s ease-out" : "max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        }}
      >
        {/* Main Input Card */}
        <div
          onMouseDown={(e) => {
            const isTextarea = e.target === textareaRef.current;
            if (expanded && !isTextarea) {
              e.preventDefault();
              textareaRef.current?.focus();
            }
          }}
          style={{
            borderRadius: 24,
            height: expanded ? containerHeight : 48,
            transition: isSmoothResize ? SMOOTH_HEIGHT_TRANSITION : SPRING_TRANSITION,
            overflow: expanded ? "visible" : "hidden",
          }}
          className={cn(
            "relative w-full border border-border bg-card shadow-sm focus-within:border-ring/40 focus-within:ring-1 focus-within:ring-ring/20 hover:border-border/80 z-10",
            expanded ? "cursor-text" : "cursor-default"
          )}
        >
          <style dangerouslySetInnerHTML={{ __html: `
            .prompt-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; background: transparent; }
            .prompt-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .prompt-scrollbar::-webkit-scrollbar-thumb { background: transparent; border-radius: 4px; }
            .prompt-scrollbar:hover::-webkit-scrollbar-thumb { background: hsl(var(--muted-foreground) / 0.3); }
          `}} />

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => handleValueChange(e.target.value)}
            onScroll={updateFades}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
              if (e.key === "Escape" && value.trim() === "") {
                setIsSmoothResize(false);
                setExpanded(false);
                setIsModelSelectOpen(false);
              }
            }}
            placeholder={placeholder}
            aria-label="Prompt"
            style={{
              transition: isSmoothResize
                ? "height 0.15s ease-out"
                : "opacity 0.3s ease-out, transform 0.3s ease-out, height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
            }}
            className={cn(
              "prompt-scrollbar absolute top-0 inset-x-0 z-[1] w-full resize-none bg-transparent pl-4 pr-12 py-3.5 text-sm leading-[22px] text-foreground outline-none placeholder:font-medium placeholder:text-muted-foreground/80 cursor-text",
              expanded ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-1 pointer-events-none",
              isScrolling ? "overflow-y-auto" : "overflow-y-hidden"
            )}
          />

          <div
            ref={topFadeRef}
            className="absolute left-4 right-12 top-0 z-[2] h-8 bg-gradient-to-b from-card via-card/90 to-transparent pointer-events-none"
          />
          <div
            ref={bottomFadeRef}
            className="absolute left-4 right-12 z-[2] h-8 bg-gradient-to-t from-card via-card/90 to-transparent pointer-events-none"
            style={{
              opacity: 0,
              top: `${textareaHeight - 32}px`,
              transition: isSmoothResize ? "top 0.15s ease-out" : "top 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
            }}
          />

          <button
            type="button"
            onClick={expand}
            style={{ transition: isSmoothResize ? "none" : "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)" }}
            className={cn(
              "absolute inset-x-0 top-0 z-[1] cursor-text pl-4 pr-12 py-[15px] text-left text-sm font-medium leading-[17px] text-muted-foreground/80 outline-none",
              !expanded ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-105 translate-y-1 pointer-events-none"
            )}
            aria-label="Open prompt input"
          >
            {placeholder}
          </button>

          {/* Bottom Actions Wrapper */}
          <div
            className={cn(
              "absolute bottom-2 left-3 right-12 z-[10] flex items-center gap-0 transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]",
              expanded ? "opacity-100 blur-0 translate-y-0 pointer-events-auto" : "opacity-0 blur-sm translate-y-2 pointer-events-none"
            )}
          >
            <div className="relative">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsModelSelectOpen((prev) => !prev);
                }}
                className={cn(
                  "group flex items-center gap-1 rounded-full px-2 py-1 text-foreground/50 transition-all duration-200 outline-none hover:bg-accent/60 hover:text-foreground cursor-default",
                  isModelSelectOpen ? "bg-accent/60 text-foreground" : ""
                )}
                aria-label={`Select model. Current: ${selectedModel}`}
              >
                <ModelIcon model={selectedModel} className="size-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
                <span className="text-xs font-semibold select-none transition-colors">
                  <MorphingText text={selectedModel} />
                </span>
              </button>

              <div
                style={{ transformOrigin: "bottom left" }}
                onMouseLeave={() => {
                  setHoverStyle((prev) => ({
                    ...prev, opacity: 0, transform: prev.transform.replace("scale(1)", "scale(0.95)"), transition: "opacity 0.2s ease-in, transform 0.2s ease-out",
                  }));
                }}
                className={cn(
                  "absolute bottom-full left-0 mb-2.5 z-50 w-40 rounded-2xl border border-border bg-card/95 p-1 shadow-xl backdrop-blur-md flex flex-col gap-0.5 transition-all duration-400 cursor-default",
                  isModelSelectOpen
                    ? "opacity-100 scale-100 translate-y-0 pointer-events-auto ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                    : "opacity-0 scale-95 translate-y-3 pointer-events-none ease-[cubic-bezier(0.175,0.885,0.32,1.275)]"
                )}
              >
                <div className="relative flex flex-col gap-0.5">
                  <div style={hoverStyle} className="absolute left-0 right-0 top-0 h-8 -z-10 rounded-xl bg-accent pointer-events-none" />
                  {models.map((model, idx) => (
                    <button
                      key={model}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => {
                        setHoverStyle((prev) => ({
                          opacity: 1, transform: `translateY(${idx * 34}px) scale(1)`,
                          transition: prev.opacity === 0 ? "opacity 0.15s ease-out" : "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.15s ease",
                        }));
                      }}
                      onClick={(e) => { e.stopPropagation(); setSelectedModel(model); setIsModelSelectOpen(false); }}
                      className="group relative flex h-8 w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs font-medium text-foreground/80 outline-none active:scale-[0.98] cursor-default"
                    >
                      <span className="flex items-center gap-2">
                        <ModelIcon model={model} className="size-3.5 opacity-85 group-hover:opacity-100 transition-opacity" />
                        {model}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button" onMouseDown={(e) => e.preventDefault()} onClick={cycleEffort}
              className="group flex items-center gap-1 rounded-full px-2 py-1 text-foreground/50 transition-all duration-200 hover:bg-accent/60 hover:text-foreground outline-none cursor-default"
            >
              <DynamicBarsIcon level={efforts[effortIndex]} />
              <span className="text-xs font-semibold select-none transition-colors"><MorphingText text={efforts[effortIndex]} /></span>
            </button>
          </div>

          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={handleSubmit}
            disabled={!hasValue}
            aria-label="Send prompt"
            style={{ borderRadius: 9999 }}
            className="absolute right-2 bottom-2 z-[10] flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground transition-all duration-300 hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-default disabled:opacity-40 disabled:pointer-events-none"
          >
            <ArrowUpIcon />
          </button>
        </div>
      </div>
    );
  }
);

PromptInput.displayName = "PromptInput";
