/** Shared shapes reused across blocks. */

export interface CtaLink {
  label: string;
  href: string;
}

export interface Img {
  src: string;
  alt: string; // required by auto-SEO alt-enforcement
}

export interface NavLink {
  label: string;
  href: string;
}
