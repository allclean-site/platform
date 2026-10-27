/** Типы для markdown.js — общий разборщик тела статьи для кабинета и сборки сайта. */
export function markdownToHtml(md: string): string;
export function markdownToText(md: string): string;
export function sanitizeArticleHtml(html: string): string;
