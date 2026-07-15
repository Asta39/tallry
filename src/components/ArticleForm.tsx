"use client";

import { useState, useTransition } from "react";
import { saveArticleAction } from "@/lib/actions";
import { useRouter } from "next/navigation";

export function ArticleForm({
  article,
}: {
  article: { id: number; title: string; content: string; published: boolean } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(article?.title || "");
  const [content, setContent] = useState(article?.content || "");
  const [published, setPublished] = useState(article?.published || false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required.");
      return;
    }

    start(async () => {
      try {
        const res = await saveArticleAction(article?.id || null, title, content, published);
        if (res.error) setError(res.error);
        else {
          router.push("/settings/knowledge-base");
        }
      } catch (err: any) {
        setError(err.message || "An error occurred");
      }
    });
  };

  return (
    <div className="card p-6">
      <div className="space-y-5">
        <div>
          <label className="block text-[13px] font-semibold text-[var(--color-ink-900)] mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., How to read your invoice"
            className="w-full px-3 py-2 border border-[var(--color-ink-200)] rounded-lg text-[13.5px] focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-[var(--color-ink-900)] mb-1">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write the article content here. You can use markdown..."
            rows={12}
            className="w-full px-3 py-2 border border-[var(--color-ink-200)] rounded-lg text-[13.5px] focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="published"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="rounded border-[var(--color-ink-300)] text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
          />
          <label htmlFor="published" className="text-[13px] font-medium text-[var(--color-ink-800)]">
            Publish to Client Portal
          </label>
        </div>

        {error && <div className="text-[13px] text-[var(--color-bad)] font-medium bg-[var(--color-bad)]/10 p-3 rounded-lg">{error}</div>}

        <div className="pt-2 flex justify-end gap-3">
          <button
            onClick={() => router.push("/settings/knowledge-base")}
            className="px-4 py-2 border border-[var(--color-ink-200)] text-[var(--color-ink-700)] text-[13px] font-medium rounded-lg hover:bg-[var(--color-ink-50)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={pending}
            className="px-5 py-2 bg-[var(--color-brand)] text-white text-[13px] font-bold rounded-lg shadow-sm hover:opacity-90 transition-all disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save Article"}
          </button>
        </div>
      </div>
    </div>
  );
}
