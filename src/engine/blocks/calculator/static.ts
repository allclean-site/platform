import type { BlockRenderContext } from "../../types";
import { esc } from "../../lib/html";
import type { CalculatorContent } from "./schema";
import { CALC_STRINGS } from "./schema";
import type { Field } from "./engine";

function fieldHtml(f: Field, L: "ru" | "ro"): string {
  const q = `<div class="calc__q" data-q>${esc(f.label[L])}</div>`;
  if (f.type === "number") {
    const def = f.default ?? f.min ?? 0;
    return (
      `<div class="calc__field" data-key="${esc(f.key)}" data-type="number">` +
      `<div class="calc__q">${esc(f.label[L])}: <b class="calc__num">${def}</b></div>` +
      `<input type="range" class="calc__range" min="${f.min ?? 0}" max="${f.max ?? 100}" step="${f.step ?? 1}" value="${def}">` +
      `</div>`
    );
  }
  const opts = (f.options || [])
    .map((o, i) => `<button type="button" class="calc__opt${f.type === "select" && i === 0 ? " on" : ""}" data-val="${esc(o.value)}">${esc(o.label[L])}${o.add ? `<em class="calc__badge">+${o.add}</em>` : ""}</button>`)
    .join("");
  return `<div class="calc__field" data-key="${esc(f.key)}" data-type="${f.type}">${q}<div class="calc__opts">${opts}</div></div>`;
}

/** Inline runtime — mirrors engine.ts compute()/priceText(). Keep in sync with engine.ts. */
function runtime(id: string, cfgJson: string, fromWord: string, currency: string): string {
  return (
    `(function(){var cfg=${cfgJson};var root=document.getElementById(${JSON.stringify(id)});if(!root)return;` +
    `var state={};cfg.fields.forEach(function(f){if(f.type==='select')state[f.key]=(f.options[0]||{}).value;else if(f.type==='number')state[f.key]=f.default!=null?f.default:(f.min||0);else state[f.key]=[];});` +
    `function vis(f){return !f.showIf||(f.showIf.in||[]).indexOf(state[f.showIf.field])>=0;}` +
    `function compute(){var total=cfg.base||0,mult=1,rates={};cfg.fields.forEach(function(f){if(vis(f)&&f.type==='select'&&f.affects){var o=(f.options||[]).find(function(x){return x.value===state[f.key];});if(o&&o.rate!=null)rates[f.affects]=o.rate;}});` +
    `cfg.fields.forEach(function(f){if(!vis(f))return;if(f.type==='select'){var o=(f.options||[]).find(function(x){return x.value===state[f.key];});if(!o)return;if(o.add)total+=o.add;if(o.mult!=null)mult*=o.mult;}else if(f.type==='number'){var per=f.perUnit!=null?f.perUnit:(f.perUnitFrom?(rates[f.perUnitFrom]||0):0);var cc=(Number(state[f.key])||0)*per;if(f.doubleIf&&(f.doubleIf.in||[]).indexOf(state[f.doubleIf.field])>=0)cc*=2;total+=cc;}else if(f.type==='multi'){(state[f.key]||[]).forEach(function(v){var o=(f.options||[]).find(function(x){return x.value===v;});if(o&&o.add)total+=o.add;});}});` +
    `total*=mult;if(cfg.minPrice)total=Math.max(total,cfg.minPrice);return total;}` +
    `function fmt(n){return Math.round(n).toLocaleString('ru-RU');}` +
    `function priceText(){var low=compute();if(cfg.showRange){var high=Math.round(low*(cfg.rangeUpRatio||1.25)/10)*10;return ${JSON.stringify(fromWord)}+' '+fmt(low)+'–'+fmt(high);}return fmt(low);}` +
    `function render(){var p=root.querySelector('.calc__price-val');if(p)p.textContent=priceText();root.querySelectorAll('.calc__field').forEach(function(fl){var f=cfg.fields.find(function(x){return x.key===fl.dataset.key;});fl.style.display=vis(f)?'':'none';});}` +
    `root.querySelectorAll('.calc__field').forEach(function(fl){var key=fl.dataset.key,type=fl.dataset.type;` +
    `if(type==='select'){fl.querySelectorAll('.calc__opt').forEach(function(b){b.addEventListener('click',function(){fl.querySelectorAll('.calc__opt').forEach(function(x){x.classList.remove('on');});b.classList.add('on');state[key]=b.dataset.val;render();});});}` +
    `else if(type==='multi'){fl.querySelectorAll('.calc__opt').forEach(function(b){b.addEventListener('click',function(){b.classList.toggle('on');state[key]=[].slice.call(fl.querySelectorAll('.calc__opt.on')).map(function(x){return x.dataset.val;});render();});});}` +
    `else if(type==='number'){var rng=fl.querySelector('.calc__range'),num=fl.querySelector('.calc__num');rng.addEventListener('input',function(){state[key]=Number(rng.value);if(num)num.textContent=rng.value;render();});}});` +
    `render();})();`
  );
}

export function renderCalculatorStatic(ctx: BlockRenderContext<CalculatorContent>): string {
  const c = ctx.block.content;
  const id = ctx.block.id;
  const L: "ru" | "ro" = c.locale === "ro" ? "ro" : "ru";
  const s = CALC_STRINGS[L];
  const fields = c.config.fields.map((f) => fieldHtml(f, L)).join("");
  const cfgJson = JSON.stringify(c.config).replace(/</g, "\\u003c");
  const script = runtime(id, cfgJson, c.fromWord, c.config.currency);
  return (
    `<section class="section calc-block" id="${esc(id)}"><div class="container calc__wrap">` +
    `<h2 class="section__heading">${esc(c.heading)}</h2>` +
    `<div class="calc__grid"><div class="calc__fields">${fields}</div>` +
    `<aside class="calc__side">` +
    `<div class="calc__price"><span class="calc__price-val">0</span> <span class="calc__cur">${esc(c.config.currency)}</span></div>` +
    `<p class="calc__note">${esc(s.note)}</p>` +
    `<a class="btn btn--primary calc__cta" href="#book">${esc(s.cta)}</a>` +
    `</aside></div></div>` +
    `<script>${script}</script></section>`
  );
}
