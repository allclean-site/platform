/**
 * Hero block — faithful port of AllClean's real Webflow markup (Hero.astro + ContactTiles.astro).
 * Emits the exact `.section_hero-home` structure so the Sparkles design system styles it identically.
 * One shared `heroInner()` feeds both renderStatic (export) and Preview (dangerouslySetInnerHTML) → parity.
 * Editable content lives in the JSON `content`; the Webflow chrome (SVGs, wrappers) is fixed.
 */

import React from "react";
import type { BlockDefinition, BlockRenderContext } from "../types";
import { esc } from "../lib/html";

/** Public Supabase storage base for the client's uploaded icons (same as the real site). */
const STORAGE = "https://hbdjboimxqwkzxntidzt.supabase.co/storage/v1/object/public";

export interface HeroContent {
  /** The animated H1 words; the last one is joined with `city` on its own line. */
  words: string[];
  city: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
  googleRating: string;   // "4.9 в Google"
  facebookRating: string; // "4.8 на Facebook"
  phone: string;          // "+373 79 955 044"
  video: { poster: string; mp4: string; webm: string };
}

const defaults = (): HeroContent => ({
  words: ["УБОРКА", "ДЛЯ", "ЗАНЯТЫХ", "ЛЮДЕЙ", "В"],
  city: "КИШИНЁВЕ",
  primary: { label: "Записаться на уборку", href: "/book-cleaning" },
  secondary: { label: "Смотреть цены", href: "/pricing" },
  googleRating: "4.9 в Google",
  facebookRating: "4.8 на Facebook",
  phone: "+373 79 955 044",
  video: { poster: "/video/hero-poster.jpg", mp4: "/video/hero.mp4", webm: "/video/hero.webm" },
});

const tel = (phone: string) => `tel:${phone.replace(/[^\d]/g, "")}`;

/** The arrow icon used inside both hero CTAs. */
const ARROW = `<div button-icon-right="" class="icon-wrap_button"><div class="wrap_icon-btn"><div class="icon_button w-embed"><svg width="100%" height="100%" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.33337 8.00016H12.6667M12.6667 8.00016L8.00004 3.3335M12.6667 8.00016L8.00004 12.6668" stroke="currentColor" stroke-width="var(--_❇️-icon---icon-stroke)" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div></div>`;

/** The 4 contact tiles shown under the hero (Позвонить / WhatsApp / Viber / Telegram). */
function contactTiles(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  const tile = (href: string, icon: string, label: string) =>
    `<a href="${esc(href)}" class="book_support-item w-inline-block"><div class="icon-wrap_feature"><div class="icon-feature w-embed">${icon}</div></div><div class="text-wrap_support-tile"><div class="heading-style-h5">${esc(label)}</div><div>${esc(phone)}</div></div></a>`;
  const phoneSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 32 32" fill="none"><path d="M18.444 22.0907C18.7193 22.2172 19.0296 22.246 19.3236 22.1726C19.6175 22.0992 19.8777 21.9278 20.0613 21.6867L20.5346 21.0667C20.783 20.7355 21.1051 20.4667 21.4754 20.2815C21.8457 20.0964 22.254 20 22.668 20H26.668C27.3752 20 28.0535 20.281 28.5536 20.7811C29.0537 21.2812 29.3346 21.9594 29.3346 22.6667V26.6667C29.3346 27.3739 29.0537 28.0522 28.5536 28.5523C28.0535 29.0524 27.3752 29.3334 26.668 29.3334C20.3028 29.3334 14.1983 26.8048 9.69741 22.3039C5.19653 17.803 2.66797 11.6985 2.66797 5.33335C2.66797 4.62611 2.94892 3.94783 3.44902 3.44774C3.94911 2.94764 4.62739 2.66669 5.33464 2.66669H9.33464C10.0419 2.66669 10.7202 2.94764 11.2203 3.44774C11.7203 3.94783 12.0013 4.62611 12.0013 5.33335V9.33335C12.0013 9.74734 11.9049 10.1556 11.7198 10.5259C11.5346 10.8962 11.2658 11.2183 10.9346 11.4667L10.3106 11.9347C10.0659 12.1216 9.89333 12.3875 9.82236 12.6872C9.75138 12.9868 9.78635 13.3019 9.9213 13.5787C11.7435 17.2798 14.7405 20.2731 18.444 22.0907Z" stroke="currentColor" stroke-width="var(--_❇️-icon---icon-stroke)" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
  const img = (file: string, alt: string) => `<img src="${STORAGE}/article-images/allclean/site/${file}" alt="${esc(alt)}" style="width: 100%; height: 100%; object-fit: contain;" />`;
  return (
    `<div scale-boxes="" class="w-layout-grid grid_support">` +
    tile(`tel:${digits}`, phoneSvg, "Позвонить") +
    tile(`https://api.whatsapp.com/send?phone=${digits}`, img("1783062470768-6ebuvv.svg", "WhatsApp"), "WhatsApp") +
    tile(`viber://add?number=${digits}`, img("1783062481538-ws9cs0.svg", "Viber"), "Viber") +
    tile(`https://t.me/${digits}`, img("1783062489527-cdamm6.svg", "Telegram"), "Telegram") +
    `</div>`
  );
}

/** Inner HTML of the hero section (shared by both renderers). */
export function heroInner(c: HeroContent): string {
  const headWords =
    c.words.slice(0, -1).map((w) => `<div class="heading-style-h1">${esc(w)}</div>`).join("") +
    `<div class="heading-style-h1">${esc(c.words[c.words.length - 1] ?? "")} ${esc(c.city)}</div>`;
  const cta = (href: string, label: string, secondary: boolean) => {
    const variant = secondary ? " w-variant-1ff8d96e-78cc-eac8-de90-206ecdaded5f" : "";
    const bg = secondary ? ` class="btn-bg w-variant-1ff8d96e-78cc-eac8-de90-206ecdaded5f"` : ` class="btn-bg"`;
    return (
      `<a href="${esc(href)}" button="" data-wf--cta-primary--variant="${secondary ? "secondary" : "primary"}" class="cta_primary${variant} w-inline-block">` +
      `<div class="button_text-mask">${ARROW}<div button-text="" class="text-button">${esc(label)}</div></div>` +
      `<div button-bg=""${bg}></div></a>`
    );
  };
  return (
    `<div class="padding-global"><div class="w-layout-blockcontainer container-large w-container"><div class="master_hero-home">` +
    `<div style="opacity:1" class="left_hero-home">` +
    `<div class="hero-home_top-tile"><div class="button-group_book">` +
    `<a href="https://google.com" target="_blank" class="link_book-social w-inline-block"><div class="icon-wrap_book-social base"><div class="icon-book-social w-embed"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.0742 9.18518V12.1481C14.0742 13.3997 13.0889 14.6666 11.2054 14.6666H8.77439C5.16825 14.6666 2.16632 11.9322 1.94039 8.44132C1.81452 6.50225 2.50559 4.66019 3.88132 3.28265C5.17445 1.98779 6.97759 1.33325 8.80752 1.33325H12.6666C13.0348 1.33325 13.3333 1.63172 13.3333 1.99992V3.33325C13.3333 3.70139 13.0348 3.99992 12.6666 3.99992H8.73872C7.70679 3.99985 6.68065 4.33319 5.91625 5.02645C4.99085 5.86565 4.52125 7.03392 4.60112 8.26878C4.73685 10.3609 6.56985 11.9999 8.77432 11.9999C8.77432 11.9999 9.96665 11.9965 10.7469 11.9914C11.1133 11.9891 11.4075 11.6912 11.4075 11.3247V9.99992C11.4075 9.63172 11.109 9.33325 10.7408 9.33325H8.66659C8.29839 9.33325 7.99992 9.03472 7.99992 8.66658V7.33325C7.99992 6.96505 8.29839 6.66658 8.66659 6.66658H11.5556C12.9465 6.66658 14.0742 7.79425 14.0742 9.18518Z" fill="#537FDD"/></svg></div></div><div class="button-social-book"><div class="label-large">${esc(c.googleRating)}</div></div></a>` +
    `<a href="https://google.com" target="_blank" class="link_book-social w-inline-block"><div class="icon-wrap_book-social base"><div class="icon-book-social w-embed"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_44363_2430)"><path d="M8.08573 5.77609C8.66184 5.77609 9.18994 5.95213 9.62203 6.25619C10.1341 5.8241 11.0623 5.68007 11.8625 5.08796C13.9269 3.56766 11.8465 0.0309609 6.61344 0.943141C2.75668 1.61527 4.43701 5.03995 5.78127 7.02434C6.26137 6.27219 7.12554 5.77609 8.08573 5.77609Z" fill="#DC0000"/><path d="M5.33413 8.51263C5.33413 8.44862 5.33413 8.3686 5.35013 8.30459C4.694 8.09655 4.10189 7.3284 3.17371 6.92832C0.821243 5.88811 -1.19515 9.47282 2.21352 13.5376C4.72601 16.5302 6.83843 13.3936 7.87863 11.2492C6.45435 11.1371 5.33413 9.95291 5.33413 8.51263Z" fill="#DC0000"/><path d="M10.5365 7.29639C10.7285 7.66446 10.8245 8.08054 10.8245 8.51263C10.8245 9.61684 10.1684 10.577 9.22422 11.0091C9.35224 11.6812 9.00017 12.5454 9.1122 13.5376C9.38425 16.0821 13.4971 16.0501 15.3214 11.0731C16.6497 7.42441 12.9209 7.13635 10.5365 7.29639Z" fill="#DC0000"/><path d="M9.92757 8.51262C9.92757 7.48841 9.09541 6.65625 8.07121 6.65625C7.04701 6.65625 6.21484 7.48841 6.21484 8.51262C6.21484 9.53682 7.04701 10.369 8.07121 10.369C9.09541 10.369 9.92757 9.53682 9.92757 8.51262Z" fill="#DC0000"/></g><defs><clipPath id="clip0_44363_2430"><rect width="16" height="16" fill="white"/></clipPath></defs></svg></div></div><div class="button-social-book"><div class="label-large"><strong>${esc(c.facebookRating)}</strong></div></div></a>` +
    `</div><h1 class="heading_hero-home">${headWords}</h1></div>` +
    `<div class="button-group_left">${cta(c.primary.href, c.primary.label, false)}${cta(c.secondary.href, c.secondary.label, true)}</div>` +
    `</div>` +
    `<div data-poster-url="${esc(c.video.poster)}" data-autoplay="true" data-loop="true" data-wf-ignore="true" style="opacity:1" class="video_hero-home w-background-video w-background-video-atom">` +
    `<video autoplay="" loop="" preload="metadata" poster="${esc(c.video.poster)}" style="background-image: url(&quot;${esc(c.video.poster)}&quot;);" muted="" playsinline="" data-wf-ignore="true" data-object-fit="cover">` +
    `<source src="${esc(c.video.mp4)}" data-wf-ignore="true" /><source src="${esc(c.video.webm)}" data-wf-ignore="true" /></video></div>` +
    `</div>` +
    contactTiles(c.phone) +
    `</div></div>`
  );
}

const renderStatic = (ctx: BlockRenderContext<HeroContent>): string =>
  `<section class="section_hero-home" id="${esc(ctx.block.id)}">${heroInner(ctx.block.content)}</section>`;

const Preview = ({ ctx }: { ctx: BlockRenderContext<HeroContent> }) => (
  <section className="section_hero-home" id={ctx.block.id} dangerouslySetInnerHTML={{ __html: heroInner(ctx.block.content) }} />
);

export const heroBlock: BlockDefinition<HeroContent> = {
  type: "hero",
  meta: { name: "Hero", icon: "layout-template", category: "headers" },
  defaults,
  renderStatic,
  Preview,
};
