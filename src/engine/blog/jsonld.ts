/**
 * Article + FAQPage JSON-LD graph — ported from cms-leadgenium ArticleEditor.buildJsonLd.
 *
 * Emitted into the article page's <head> via `page.meta.schema`, so the existing
 * static renderer serializes it with the rest of the auto-SEO head.
 */

import type { Article } from "./types";

export interface ArticleJsonLdContext {
  /** Absolute canonical URL of this article page. */
  url: string;
  /** Organization/brand name for author + publisher. */
  brand: string;
}

export function buildArticleJsonLd(a: Article, ctx: ArticleJsonLdContext): Record<string, unknown> {
  const now = new Date().toISOString();
  const images = [a.coverUrl, a.image2Url].filter(Boolean) as string[];

  const graph: Record<string, unknown>[] = [
    {
      "@type": "Article",
      headline: a.seoTitle || a.title,
      description: a.seoDescription || a.excerpt || "",
      ...(images.length ? { image: images } : {}),
      inLanguage: a.locale,
      datePublished: a.datePublished || now,
      dateModified: a.dateModified || now,
      author: { "@type": a.author ? "Person" : "Organization", name: a.author || ctx.brand },
      publisher: { "@type": "Organization", name: ctx.brand },
      mainEntityOfPage: { "@type": "WebPage", "@id": ctx.url },
    },
  ];

  const faq = a.meta?.faq;
  if (Array.isArray(faq) && faq.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}
