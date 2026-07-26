/** Block registry — lookup from a block's `type` to its definition.
 *  Adding a new block = implement its module and register it here. */

import type { BlockDefinition } from "../types";
import { navbarBlock } from "./navbar";
import { heroBlock } from "./hero";
import { servicesBlock } from "./services";
import { featuresBlock } from "./features";
import { testimonialsBlock } from "./testimonials";
import { stepsBlock } from "./steps";
import { faqBlock } from "./faq";
import { ctaBlock } from "./cta";
import { footerBlock } from "./footer";
import { canvasBlock } from "./canvas";
import { calculatorBlock } from "./calculator";
import { blogListBlock } from "./blog-list";
import { articleBlock } from "./article";
import { sectionBlock } from "./section";

const ALL: BlockDefinition<any>[] = [
  sectionBlock,
  navbarBlock,
  heroBlock,
  servicesBlock,
  featuresBlock,
  testimonialsBlock,
  stepsBlock,
  faqBlock,
  calculatorBlock,
  blogListBlock,
  articleBlock,
  ctaBlock,
  canvasBlock,
  footerBlock,
];

const REGISTRY: Record<string, BlockDefinition<any>> = Object.fromEntries(
  ALL.map((b) => [b.type, b])
);

export function getBlockDef(type: string): BlockDefinition<any> {
  const def = REGISTRY[type];
  if (!def) throw new Error(`Unknown block type: "${type}"`);
  return def;
}

export function listBlockDefs(): BlockDefinition<any>[] {
  return ALL;
}
