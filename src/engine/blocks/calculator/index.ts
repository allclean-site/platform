import type { BlockDefinition } from "../../types";
import type { CalculatorContent } from "./schema";
import { calculatorDefaults } from "./schema";
import { renderCalculatorStatic } from "./static";
import { CalculatorPreview } from "./Preview";

export const calculatorBlock: BlockDefinition<CalculatorContent> = {
  type: "calculator",
  meta: { name: "Калькулятор", icon: "calculator", category: "content" },
  interactive: true,
  defaults: calculatorDefaults,
  renderStatic: renderCalculatorStatic,
  Preview: CalculatorPreview,
};

export type { CalculatorContent } from "./schema";
