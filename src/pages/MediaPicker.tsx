/**
 * Media picker — the "add photo/video" dialog used when replacing media in the editor. Two ways in
 * (as the client asked): «Загрузить с устройства/ПК» (file) and «Из галереи» (the media library). Plus
 * a «Корзина» to restore deleted assets. Selecting an asset returns its url + type to the caller.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Image as ImageIcon, Video as VideoIcon, Trash2, RotateCcw, X, Loader2, Play, Undo2 } from "lucide-react";
import {
  activeMedia, trashedMedia, uploadMediaFile, trashMedia, restoreMedia, purgeMedia,
  type MediaAsset, type MediaType,
} from "../editor/media";
import { storageConfigured } from "../editor/image";
import "./media-picker.css";

type Accept = "image" | "video" | "both";
type Tab = "upload" | "gallery" | "trash";

export function MediaPicker({
  tenant, accept = "image", onPick, onClose,
}: {
  tenant: string;
  accept?: Accept;
  onPick: (url: string, type: MediaType) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("gallery");
  const [rev, force] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bad, setBad] = useState<Set<string>>(new Set()); // assets that fail to load / are icons → hidden
  const fileRef = useRef<HTMLInputElement>(null);
  const bump = () => force((x) => x + 1);
  const markBad = (id: string) => setBad((s) => (s.has(id) ? s : new Set(s).add(id)));

  // Esc closes the picker.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const wants = (t: MediaType) => accept === "both" || accept === t;
  const ok = (id: string) => !bad.has(id);
  const gallery = useMemo(() => activeMedia(tenant).filter((m) => wants(m.type)), [tenant, rev, accept]).filter((m) => ok(m.id));
  const trash = useMemo(() => trashedMedia(tenant).filter((m) => wants(m.type)), [tenant, rev, accept]).filter((m) => ok(m.id));

  const acceptAttr = accept === "video" ? "video/*" : accept === "both" ? "image/*,video/*" : "image/*";

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.type.startsWith("video/") && !storageConfigured()) {
      setError("Загрузка видео требует подключённого хранилища (Настройки → Интеграции → Хранилище). Фото работают всегда.");
      return;
    }
    setUploading(true);
    const asset = await uploadMediaFile(tenant, file);
    setUploading(false);
    if (!asset) { setError("Не удалось загрузить файл. Попробуйте ещё раз."); return; }
    onPick(asset.url, asset.type);
  };

  const del = (id: string) => { trashMedia(tenant, id); bump(); };
  const restore = (id: string) => { restoreMedia(tenant, id); bump(); };
  const purge = (id: string) => { if (confirm("Удалить навсегда? Это действие необратимо.")) { purgeMedia(tenant, id); bump(); } };

  return (
    <div className="mp__scrim" onClick={onClose}>
      <div className="mp glass" onClick={(e) => e.stopPropagation()}>
        <div className="mp__head">
          <span className="mp__title">{accept === "video" ? "Видео" : accept === "both" ? "Фото и видео" : "Фото"}</span>
          <div className="mp__tabs">
            <button className={"mp__tab" + (tab === "upload" ? " on" : "")} onClick={() => setTab("upload")}><Upload size={14} /> Загрузить</button>
            <button className={"mp__tab" + (tab === "gallery" ? " on" : "")} onClick={() => setTab("gallery")}><ImageIcon size={14} /> Галерея{gallery.length ? ` · ${gallery.length}` : ""}</button>
            <button className={"mp__tab" + (tab === "trash" ? " on" : "")} onClick={() => setTab("trash")}><Trash2 size={14} /> Корзина{trash.length ? ` · ${trash.length}` : ""}</button>
          </div>
          <button className="mp__x" onClick={onClose} title="Закрыть"><X size={18} /></button>
        </div>

        <input ref={fileRef} type="file" accept={acceptAttr} hidden onChange={(e) => onFile(e.target.files?.[0])} />

        {error && <div className="mp__error">{error}</div>}

        {tab === "upload" && (
          <div className="mp__upload">
            <button className="mp__drop" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <><Loader2 size={26} className="mp__spin" /><b>Загружаю…</b></>
                : <><Upload size={26} /><b>Выбрать файл с устройства или ПК</b>
                  <span className="muted">{accept === "video" ? "видео" : accept === "both" ? "фото или видео" : "фото"} · перетащите или нажмите</span></>}
            </button>
            {accept !== "image" && !storageConfigured() && (
              <p className="mp__note">Для видео нужно подключить хранилище (Настройки → Интеграции). Фото загружаются без настройки.</p>
            )}
          </div>
        )}

        {tab === "gallery" && (
          gallery.length === 0 ? (
            <div className="mp__empty">
              <ImageIcon size={30} />
              <p>Галерея пуста. Загрузите файл — он появится здесь и его можно будет использовать снова.</p>
              <button className="mp__btn" onClick={() => setTab("upload")}><Upload size={15} /> Загрузить</button>
            </div>
          ) : (
            <div className="mp__grid">
              {gallery.map((m) => (
                <MediaCard key={m.id} m={m} onBad={markBad} onClick={() => onPick(m.url, m.type)}
                  action={<button className="mp__card-btn" title="В корзину" onClick={(e) => { e.stopPropagation(); del(m.id); }}><Trash2 size={14} /></button>} />
              ))}
            </div>
          )
        )}

        {tab === "trash" && (
          trash.length === 0 ? (
            <div className="mp__empty"><Trash2 size={30} /><p>Корзина пуста. Удалённые из галереи фото и видео появляются здесь, их можно восстановить.</p></div>
          ) : (
            <div className="mp__grid">
              {trash.map((m) => (
                <MediaCard key={m.id} m={m} dim onBad={markBad}
                  action={
                    <>
                      <button className="mp__card-btn" title="Восстановить" onClick={(e) => { e.stopPropagation(); restore(m.id); }}><RotateCcw size={14} /></button>
                      <button className="mp__card-btn mp__card-btn--danger" title="Удалить навсегда" onClick={(e) => { e.stopPropagation(); purge(m.id); }}><X size={14} /></button>
                    </>
                  } />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function MediaCard({ m, onClick, action, dim, onBad }: { m: MediaAsset; onClick?: () => void; action?: React.ReactNode; dim?: boolean; onBad?: (id: string) => void }) {
  return (
    <div className={"mp__card" + (dim ? " is-dim" : "") + (onClick ? " is-pick" : "")} onClick={onClick} title={m.name}>
      <div className="mp__thumb">
        {m.type === "video"
          ? <><video src={m.url} muted preload="metadata" onError={() => onBad?.(m.id)} /><span className="mp__play"><Play size={16} /></span></>
          : <img src={m.url} alt={m.name} loading="lazy" onError={() => onBad?.(m.id)}
              onLoad={(e) => { if (e.currentTarget.naturalWidth > 0 && e.currentTarget.naturalWidth < 120) onBad?.(m.id); }} />}
        <span className="mp__type">{m.type === "video" ? <VideoIcon size={12} /> : <ImageIcon size={12} />}</span>
      </div>
      <div className="mp__card-foot">
        <span className="mp__name">{m.name}</span>
        <div className="mp__card-actions">{action}</div>
      </div>
    </div>
  );
}

/** Small "восстановить из галереи" hint button — reused by the inspector so the client discovers the
 *  gallery as the recovery path after deleting media. */
export function GalleryHintButton({ onClick }: { onClick: () => void }) {
  return <button className="mp__hintbtn" onClick={onClick}><Undo2 size={13} /> Вернуть из галереи</button>;
}
