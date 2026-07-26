/** Sites module — list of the client's sites. Opening one launches the in-cabinet editor. */

import React from "react";
import { Link } from "react-router-dom";
import { Globe, Pencil, ExternalLink } from "lucide-react";
import "./sites.css";

const SITES = [
  { id: "allclean", name: "AllClean", domain: "allclean.md", pages: 38, locales: "RU · RO", status: "Опубликован" },
];

export function Sites() {
  return (
    <div className="sites">
      <div className="sites__grid">
        {SITES.map((s) => (
          <div key={s.id} className="site-card card">
            <div className="site-card__top">
              <span className="site-card__mark"><Globe size={20} /></span>
              <span className="badge badge--soft">{s.status}</span>
            </div>
            <h3 className="site-card__name">{s.name}</h3>
            <a className="site-card__domain" href={`https://${s.domain}`} target="_blank" rel="noopener">
              {s.domain} <ExternalLink size={13} />
            </a>
            <div className="site-card__meta">
              <span>{s.pages} страниц</span><span>·</span><span>{s.locales}</span>
            </div>
            <Link to={`/app/sites/${s.id}`} className="site-card__edit">
              <Pencil size={15} /> Редактировать
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
