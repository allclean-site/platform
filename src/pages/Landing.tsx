import React from "react";
import { Link } from "react-router-dom";
import {
  Server, LayoutTemplate, Users, BarChart3, Newspaper, Calculator, Bell, LifeBuoy, ArrowRight, ShieldCheck, Sparkles,
  Check, Minus,
} from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { Logo } from "../components/Logo";
import { PLANS } from "../lib/plans";
import "./landing.css";

const FEATURES = [
  { icon: Server, t: "Хостинг под ключ", d: "Размещение сайта и данных в ЕС, привязка домена, SSL. Всё на нас." },
  { icon: LayoutTemplate, t: "Редактор сайта", d: "Правьте контент поблочно. Вёрстка сама подстраивается под все экраны + авто-SEO." },
  { icon: Users, t: "CRM заявок", d: "Заявки, сделки, этапы и карточки клиентов — как в Bitrix24, но проще." },
  { icon: BarChart3, t: "Аналитика", d: "Данные Google Analytics в нашем дизайне и AI-отчёт с понятными советами." },
  { icon: Newspaper, t: "Блог", d: "Написали, добавили фото и alt — «Опубликовать». SEO и переводы автоматически." },
  { icon: Calculator, t: "Калькуляторы", d: "Меняйте поля, тарифы и услуги калькулятора прямо из кабинета." },
  { icon: Bell, t: "Уведомления", d: "О заявках и заказах — в платформе, на почту и в Telegram/WhatsApp." },
  { icon: LifeBuoy, t: "Поддержка", d: "Вопрос — и с вами тот, кто делал ваш сайт. Плюс подсказки в интерфейсе." },
];

export function Landing() {
  return (
    <div className="lp">
      <header className="lp__nav glass">
        <div className="container lp__navin">
          <Logo />
          <nav className="lp__links">
            <a href="#features">Возможности</a>
            <a href="#pricing">Тарифы</a>
          </nav>
          <div className="lp__navactions">
            <ThemeToggle />
            <Link to="/app" className="btn btn--primary btn--sm">Войти <ArrowRight size={16} /></Link>
          </div>
        </div>
      </header>

      <section className="lp__hero">
        <div className="lp__orb" aria-hidden />
        <div className="container lp__heroin">
          <span className="badge badge--soft lp__badge"><Sparkles size={14} /> Платформа для клиентов агентства</span>
          <h1 className="lp__h1">Весь ваш сайт и клиенты —<br /><span className="grad-text">в одном кабинете</span></h1>
          <p className="lp__sub">
            LeadGeniumCMS — хостинг, редактор сайта, CRM, аналитика, блог и калькуляторы.
            Вы управляете, мы отвечаем за размещение, скорость и SEO.
          </p>
          <div className="lp__herocta">
            <Link to="/app" className="btn btn--primary btn--lg">Войти в кабинет <ArrowRight size={18} /></Link>
            <a href="#features" className="btn btn--ghost btn--lg">Смотреть возможности</a>
          </div>
          <div className="lp__trust muted"><ShieldCheck size={16} /> Данные в ЕС · GDPR · выделенная база под проект</div>
        </div>
      </section>

      <section className="lp__features container" id="features">
        <div className="lp__sechead">
          <h2>Всё для сайта и заявок — в одном месте</h2>
          <p className="muted">Не набор разрозненных сервисов, а единый кабинет вашего проекта.</p>
        </div>
        <div className="lp__grid">
          {FEATURES.map((f) => (
            <div className="card feat" key={f.t}>
              <div className="feat__icon"><f.icon size={22} /></div>
              <h3>{f.t}</h3>
              <p className="muted">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp__pricing container" id="pricing">
        <div className="lp__sechead">
          <h2>Простые тарифы</h2>
          <p className="muted">Начните с бесплатных инструментов. Нужен хостинг, CRM и аналитика — переходите на PRO.</p>
        </div>
        <div className="lp__plans">
          {PLANS.map((p) => (
            <div className={"lp-plan" + (p.highlight ? " lp-plan--pro" : "")} key={p.id}>
              {p.highlight && <span className="lp-plan__tag">Популярный</span>}
              <h3 className="lp-plan__name">{p.name}</h3>
              <div className="lp-plan__price">{p.price} <span>{p.per}</span></div>
              <p className="lp-plan__tagline muted">{p.tagline}</p>
              <ul className="lp-plan__feats">
                {p.features.map((f) => (
                  <li key={f.t} className={f.on ? "on" : "off"}>
                    {f.on ? <Check size={16} /> : <Minus size={16} />} {f.t}
                  </li>
                ))}
              </ul>
              <Link to="/app" className={"btn btn--lg lp-plan__cta " + (p.highlight ? "btn--primary" : "btn--ghost")}>{p.cta}</Link>
            </div>
          ))}
        </div>
        <p className="muted lp__pricenote"><ShieldCheck size={15} /> Хостинг и домен можно оставить на своём — платформой пользуйтесь всё равно.</p>
      </section>

      <section className="lp__ctaband container" id="cta">
        <div className="lp__ctacard glass">
          <h2>Готовы управлять сайтом из одного кабинета?</h2>
          <p className="muted">Ваш проект уже может жить на LeadGeniumCMS — со всей аналитикой, заявками и блогом.</p>
          <Link to="/app" className="btn btn--primary btn--lg">Открыть кабинет <ArrowRight size={18} /></Link>
        </div>
      </section>

      <footer className="lp__footer">
        <div className="container lp__footin">
          <Logo size={22} />
          <span className="muted">© LeadGeniumCMS · Хостинг · CRM · Аналитика</span>
        </div>
      </footer>
    </div>
  );
}
