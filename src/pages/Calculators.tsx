/**
 * Calculator library — grid of the client's saved calculators. Create a new one, open to edit, or
 * duplicate/delete. Each card shows a live starting price so the library reads at a glance. Built
 * here → reusable as a block that can be dropped anywhere on the site.
 */

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Calculator as CalcIcon, Copy, Trash2, Pencil, ListChecks } from "lucide-react";
import { loadCalcs, upsertCalc, removeCalc, duplicateCalc, newCalc, type CalcDoc } from "../calc/store";
import { priceText, initState } from "../engine/blocks/calculator/engine";
import "./calculators.css";

export function Calculators() {
  const nav = useNavigate();
  const [list, setList] = useState<CalcDoc[]>(() => loadCalcs());

  const create = () => {
    const c = newCalc();
    upsertCalc(c);
    nav(`/app/calculators/${c.id}`);
  };
  const dup = (c: CalcDoc) => setList(upsertCalc(duplicateCalc(c)));
  const del = (c: CalcDoc) => {
    if (window.confirm(`Удалить калькулятор «${c.name.ru}»?`)) setList(removeCalc(c.id));
  };

  return (
    <div className="calc-lib">
      <div className="calc-lib__head">
        <div>
          <h2 className="calc-lib__title">Библиотека калькуляторов</h2>
          <p className="muted">Соберите калькулятор из вопросов — потом добавляйте или заменяйте его в любом месте сайта.</p>
        </div>
        <button className="btn-primary" onClick={create}><Plus size={17} /> Новый калькулятор</button>
      </div>

      <div className="calc-lib__grid">
        {list.map((c) => (
          <CalcCard key={c.id} doc={c} onOpen={() => nav(`/app/calculators/${c.id}`)} onDup={() => dup(c)} onDel={() => del(c)} />
        ))}
        <button className="calc-card calc-card--add" onClick={create}>
          <Plus size={22} />
          <span>Создать калькулятор</span>
        </button>
      </div>
    </div>
  );
}

function CalcCard({ doc, onOpen, onDup, onDel }: { doc: CalcDoc; onOpen: () => void; onDup: () => void; onDel: () => void }) {
  const price = useMemo(() => {
    try { return priceText(doc.config, initState(doc.config), doc.fromWord); } catch { return "—"; }
  }, [doc]);
  const qn = doc.config.fields.length;
  return (
    <div className="calc-card" onClick={onOpen}>
      <div className="calc-card__top">
        <div className="calc-card__icon"><CalcIcon size={20} /></div>
        <div className="calc-card__acts" onClick={(e) => e.stopPropagation()}>
          <button className="calc-card__act" title="Открыть" onClick={onOpen}><Pencil size={15} /></button>
          <button className="calc-card__act" title="Дублировать" onClick={onDup}><Copy size={15} /></button>
          <button className="calc-card__act calc-card__act--danger" title="Удалить" onClick={onDel}><Trash2 size={15} /></button>
        </div>
      </div>
      <h3 className="calc-card__name">{doc.name.ru}</h3>
      <div className="calc-card__price">{price} <span className="calc-card__cur">{doc.config.currency}</span></div>
      <div className="calc-card__meta">
        <span className="calc-card__chip"><ListChecks size={13} /> {qn} {plural(qn, "вопрос", "вопроса", "вопросов")}</span>
        <span className="calc-card__chip">RU · RO</span>
      </div>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
