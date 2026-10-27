/** Типы для blog-cards.mjs: карточку списка блога рисуют и сборка, и холст кабинета. */
export interface BlogCardArticle {
  locale: string;
  slug: string;
  title: string;
  cover_url?: string | null;
  cover_alt?: string | null;
  created_at?: string | null;
  publish_at?: string | null;
}
export declare function artPathOf(locale: string, slug: string): string;
export declare function blogCardHtml(a: BlogCardArticle, locale: string): string;
export declare function withBlogCards(html: string, cards: BlogCardArticle[], locale: string): string;
export interface RelatedArticle extends BlogCardArticle {
  status?: string | null;
  meta?: { service_page?: string; queue?: { service_page?: string } } | null;
}
export declare function serviceOfArticle(a: RelatedArticle): string;
export declare function relatedArticles(pagePath: string, locale: string, arts: RelatedArticle[]): RelatedArticle[];
export declare function withRelatedArticles(html: string, arts: RelatedArticle[], locale: string): string;
