/**
 * Blog data model — ported from cms-leadgenium's `articles` table shape.
 *
 * An Article is a content record (NOT a block). On publish each article is expanded
 * into a first-class `Page` (an `article` block wrapped in the normal page pipeline),
 * so it reuses the whole auto-SEO/hreflang/sitemap machinery for free. Translations of
 * the same article share a `group` (like Page.group), so RU/RO get hreflang alternates.
 *
 * See cms-leadgenium/src/pages/ArticleEditor.tsx for the original AI-SEO flow this mirrors.
 */

export type Locale = string; // "ru" | "ro" | ...

/** One question/answer pair — becomes FAQPage JSON-LD and a rendered accordion. */
export interface ArticleFaq {
  question: string;
  answer: string;
}

/** AI-SEO metadata derived on publish (locally or via the /api/translate adapter). */
export interface ArticleMeta {
  faq?: ArticleFaq[];
  takeaways?: string[];
  tags?: string[];
}

/**
 * A blog article. `title` + `body` (Markdown) are authored; the rest is enrichment
 * (slug, excerpt, seo_title/description, meta) produced by {@link enrichArticle}.
 */
export interface Article {
  id: string;
  /** Links translations of the same article across locales. */
  group: string;
  locale: Locale;
  slug: string;
  title: string;
  /** Markdown source. */
  body: string;
  excerpt?: string;
  seoTitle?: string;
  seoDescription?: string;
  coverUrl?: string;
  coverAlt?: string;
  image2Url?: string;
  image2Alt?: string;
  meta?: ArticleMeta;
  status: "draft" | "published";
  /** Author shown in the byline + Article JSON-LD (E-E-A-T). */
  author?: string;
  datePublished?: string; // ISO
  dateModified?: string; // ISO
  /** true when produced by translateArticle (shows a subtle "auto-translated" note). */
  autoTranslated?: boolean;
  sourceLocale?: Locale;
}

/** What a raw, just-authored article carries before enrichment. */
export interface DraftArticle {
  id?: string;
  group?: string;
  locale: Locale;
  title: string;
  body: string;
  coverUrl?: string;
  coverAlt?: string;
  image2Url?: string;
  image2Alt?: string;
  author?: string;
  datePublished?: string;
  /** Explicit FAQ/takeaways/tags. When set, they win over auto-extraction from the body. */
  faq?: ArticleFaq[];
  takeaways?: string[];
  tags?: string[];
}

/** A card shown in the blog-list block (denormalized snapshot of an article). */
export interface ArticleCard {
  slug: string;
  locale: Locale;
  title: string;
  excerpt: string;
  coverUrl?: string;
  coverAlt?: string;
  date?: string;
  tag?: string;
}
