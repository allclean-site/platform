/**
 * First run in the site editor.
 *
 * The editor opened straight onto the client's own site with no explanation of what could be touched
 * or what happens when it is — everything (inline editing, the selection toolbar, per-device styling,
 * that edits go live only after publishing) had to be discovered by clicking and hoping. Shown once
 * per browser, and reachable any time from the "?" in the toolbar.
 */

import { Pencil, Type, Image as ImageIcon, Smartphone, Undo2, Rocket, X } from "lucide-react";
import { Dialog } from "../components/Dialog";

const SEEN = "leadgenium:editor:intro:v1";

/** True when this browser has never been shown the introduction. */
export function introUnseen(): boolean {
  try { return !localStorage.getItem(SEEN); } catch { return false; }
}
export function markIntroSeen(): void {
  try { localStorage.setItem(SEEN, "1"); } catch { /* private mode — it just shows again */ }
}

const STEPS = [
  { Icon: Pencil, title: "Текст", text: "Кликните по заголовку или абзацу прямо на странице и пишите. Правка сохраняется сама." },
  { Icon: Type, title: "Оформление", text: "Выделите часть текста — появится панель: жирный, курсив, цвет, ссылка." },
  { Icon: ImageIcon, title: "Фото и видео", text: "Кликните по картинке, затем справа «Заменить фото» — можно загрузить своё или взять из галереи." },
  { Icon: Smartphone, title: "Экраны", text: "Переключайте компьютер / планшет / телефон вверху: размеры и отступы настраиваются для каждого отдельно, текст и фото общие." },
  { Icon: Undo2, title: "Если что-то не так", text: "Ctrl + Z вернёт как было, а «Сбросить оформление» в панели справа — исходный вид элемента." },
  { Icon: Rocket, title: "Публикация", text: "Пока вы не нажали «Опубликовать», посетители видят прежний сайт. После публикации обновление занимает 1–2 минуты." },
];

export function EditorIntro({ onClose }: { onClose: () => void }) {
  const done = () => { markIntroSeen(); onClose(); };
  return (
    <Dialog label="Как редактировать сайт" onClose={done} className="intro__scrim" boxClassName="intro glass">
      <div className="intro__head">
        <div>
          <h2 className="intro__title">Редактируйте сайт прямо на странице</h2>
          <p className="intro__sub">Шесть вещей, которые стоит знать — займёт полминуты.</p>
        </div>
        <button className="intro__x" onClick={done} title="Закрыть" aria-label="Закрыть"><X size={18} /></button>
      </div>

      <ul className="intro__steps">
        {STEPS.map(({ Icon, title, text }) => (
          <li key={title} className="intro__step">
            <span className="intro__ic"><Icon size={17} /></span>
            <div>
              <b>{title}</b>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="intro__foot">
        <p className="intro__note">Эта подсказка всегда доступна по кнопке «?» в верхней панели.</p>
        <button className="intro__btn" onClick={done}>Начать</button>
      </div>
    </Dialog>
  );
}
