/**
 * Сообщение о заявке: что менеджер увидит в Telegram.
 *
 * Долго он видел только имя, телефон и «Калькулятор: carpet» — смета, ответы по шагам,
 * комментарий и фотографии уходили в базу, но в сообщение не попадали, потому что обработчик
 * читал совсем другие поля, чем присылал калькулятор. Эта проверка держит их вместе.
 *
 *   node scripts/check-notify-lead.mjs
 */
import { buildMessage } from "../api/notify-lead.js";
import assert from "node:assert/strict";

const изКалькулятора = {
  name: "Ион", locale: "ro", service: "Калькулятор: carpet",
  estimate: "1 250 MDL",
  selections: { "Suprafața": "35", "Servicii suplimentare": ["Transport", "Murdărie"] },
  comment: "Etajul 3, fără lift",
  photos: ["https://example.com/a.jpg", "javascript:alert(1)", "https://example.com/b.jpg"],
  source_url: "https://allclean.md/services/carpet",
};
const ro = buildMessage(изКалькулятора, "+373 79 955 044");

// Услуга названа по-румынски, а не слагом и не по-русски.
assert.match(ro, /Serviciu:<\/b> Calculator: Curățare covoare și mochetă/, "услуга не переведена");
assert.doesNotMatch(ro, /Калькулятор/, "русское слово на румынской заявке");
assert.doesNotMatch(ro, /: carpet/, "слаг просочился в сообщение");
// Смета, ответы, комментарий и фотографии на месте.
assert.match(ro, /Estimare:<\/b> 1 250 MDL/, "нет сметы");
assert.match(ro, /Suprafața:<\/b> 35/, "нет ответа по шагу");
assert.match(ro, /Servicii suplimentare:<\/b> Transport, Murdărie/, "список ответов не развёрнут");
assert.match(ro, /Comentariu:<\/b> Etajul 3, fără lift/, "нет комментария");
assert.match(ro, /Fotografii:<\/b> 2/, "не посчитаны фотографии");
assert.match(ro, /https:\/\/example\.com\/b\.jpg/, "нет ссылки на фотографию");
assert.doesNotMatch(ro, /javascript:/, "в сообщение попал не-HTTP адрес");

// Заявка из обычной формы записи: поля другие, ничего не потеряно и ничего не выдумано.
const сФормы = buildMessage({
  name: "Мария", locale: "ru", service: "Генеральная уборка",
  bedrooms: "2 комнаты", notes: "Домофон 12", source_url: "https://allclean.md/ru/book-cleaning",
}, "+373 79 955 044");
assert.match(сФормы, /Услуга:<\/b> Генеральная уборка/);
assert.match(сФормы, /Комнат:<\/b> 2 комнаты/);
assert.match(сФормы, /Комментарий:<\/b> Домофон 12/);
assert.doesNotMatch(сФормы, /Предварительно|Фотографии/, "появились поля, которых в заявке не было");

// Незнакомый слаг не теряется и не подменяется.
assert.match(buildMessage({ locale: "ru", service: "Калькулятор: балкон" }, "+373 79 955 044"),
  /Услуга:<\/b> Калькулятор: балкон/);

// Разметка Telegram не ломается чужими угловыми скобками.
assert.match(buildMessage({ locale: "ru", name: "<b>x</b>" }, "+373 79 955 044"), /&lt;b&gt;x&lt;\/b&gt;/);

console.log("[check-notify-lead] ок: калькулятор, форма записи, незнакомый слаг, экранирование");
