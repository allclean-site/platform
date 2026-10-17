// Публичные юридические страницы: политика конфиденциальности и страница про cookie,
// на румынском (корень сайта) и русском (/ru).
//
// Почему генератором, а не правкой зеркала: текст политики обязан описывать то, что сайт
// делает НА САМОМ ДЕЛЕ, и меняться в тот же день, когда меняется поведение. В коде его
// видно целиком, он проходит ревью и живёт рядом с правками, которые он описывает
// (scripts/site-privacy.mjs). Зеркало при этом остаётся снимком.
//
// Вёрстка намеренно повторяет разметку исходной страницы `.privacy` из зеркала — те же
// классы и тот же служебный атрибут, поэтому оформление заголовков и абзацев берётся из
// уже загруженного стиля страницы. Таблицам и спискам стилей в нём нет, им заданы свои.
import { POLICY_VERSION } from "./site-privacy.mjs";

const D = 'data-astro-cid-snxxa2ae=""';

export const OPERATOR = {
  legalNameRu: "«ALL CLEAN COMPANY» SRL",
  legalNameRo: "„ALL CLEAN COMPANY” SRL",
  idno: "1020600014361",
  addressRu: "мун. Кишинёв, ул. Месаджер, 7, MD-2069, Республика Молдова",
  addressRo: "mun. Chișinău, str. Mesager 7, MD-2069, Republica Moldova",
  phone: "+373 79 955 044",
  phoneLegal: "+373 79 444 496",
  email: "info@allclean.md",
};

// Надзорный орган — обязательная часть информирования (ст. 15). Проверено на
// datepersonale.md 30.08.2026.
const AUTH_RU = "Национальный центр по защите персональных данных Республики Молдова: MD-2004, мун. Кишинёв, ул. Сергей Лазо, 48, centru@datepersonale.md, +373 22 820 801, datepersonale.md";
const AUTH_RO = "Centrul Național pentru Protecția Datelor cu Caracter Personal al Republicii Moldova: MD-2004, mun. Chișinău, str. Serghei Lazo 48, centru@datepersonale.md, +373 22 820 801, datepersonale.md";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ── разметка ─────────────────────────────────────────────────────────────────────────
const TABLE_S = "width:100%;border-collapse:collapse;font-size:.93rem;min-width:420px";
const CELL_S = "border:1px solid #dde5f5;padding:9px 11px;text-align:left;vertical-align:top;line-height:1.6";
const HEAD_S = CELL_S + ";background:#f4f7fe;color:#0c2959;font-weight:600";

// В стиле зеркала у абзаца внутри .privacy-block нулевой отступ — там был один абзац на
// раздел. У нас их несколько, поэтому расстояние задаём сами.
const P_S = "line-height:1.75;margin:0 0 12px";

function renderBlock(b) {
  let h = "";
  if (b.h) h += `<h2 ${D}>${esc(b.h)}</h2>`;
  for (const p of b.p || []) h += `<p ${D} style="${P_S}">${p}</p>`;
  if (b.ul) h += `<ul ${D} style="margin:0 0 12px;padding-left:20px">${b.ul.map((x) => `<li ${D} style="line-height:1.7;margin-bottom:7px">${x}</li>`).join("")}</ul>`;
  if (b.table) {
    h += `<div ${D} style="overflow-x:auto;margin:6px 0 14px"><table ${D} style="${TABLE_S}">` +
      `<thead ${D}><tr ${D}>${b.table.head.map((c) => `<th ${D} style="${HEAD_S}">${esc(c)}</th>`).join("")}</tr></thead>` +
      `<tbody ${D}>${b.table.rows.map((r) => `<tr ${D}>${r.map((c) => `<td ${D} style="${CELL_S}">${c}</td>`).join("")}</tr>`).join("")}</tbody>` +
      `</table></div>`;
  }
  for (const p of b.p2 || []) h += `<p ${D} style="${P_S}">${p}</p>`;
  return `<div class="privacy-block" ${D}>${h}</div>`;
}

export function renderLegalMain({ title, updated, lead, blocks, footNote }) {
  const body = blocks.map(renderBlock).join("");
  return `<section class="section_hero-faq" ${D}> <div class="padding-global" ${D}> <div class="w-layout-blockcontainer container-large w-container" ${D}> ` +
    `<div class="privacy" ${D}> <h1 ${D}>${esc(title)}</h1> ` +
    (updated ? `<p class="privacy-upd" ${D}>${esc(updated)}</p> ` : "") +
    `<p ${D} style="font-size:1.05rem;line-height:1.75;margin:0 0 34px">${lead}</p>` +
    body +
    `<p ${D} style="margin-top:40px;padding-top:18px;border-top:1px solid #dde5f5;color:#6a7b9c;font-size:.9rem;line-height:1.8">${footNote}</p>` +
    `</div> </div> </div> </section>`;
}

const O = OPERATOR;

// ── политика конфиденциальности ──────────────────────────────────────────────────────
const privacyRu = {
  slug: "/ru/privacy",
  lang: "ru",
  metaTitle: "Политика конфиденциальности | All Clean Кишинёв",
  metaDesc: "Кто оператор, какие данные собирают формы All Clean, кому передаются, сколько хранятся и как их удалить. По Закону № 195/2024.",
  title: "Политика конфиденциальности",
  updated: `Редакция от ${POLICY_VERSION}`,
  lead: "Эта страница объясняет, какие данные оставляет о себе посетитель allclean.md, зачем они нам, кому передаются и как их удалить. Написана по Закону Республики Молдова № 195/2024 о защите персональных данных.",
  footNote: `${O.legalNameRu} · IDNO ${O.idno} · ${O.addressRu} · <a href="mailto:${O.email}">${O.email}</a> · <a href="tel:+37379955044">${O.phone}</a>`,
  blocks: [
    { h: "1. Кто обрабатывает ваши данные", p: [
      `Оператор персональных данных — ${O.legalNameRu}, IDNO ${O.idno}, ${O.addressRu}. Сайт allclean.md принадлежит этой компании и работает под маркой «All Clean».`,
      `Вопросы о персональных данных, отзыв согласия и любые запросы из раздела 9 — на ${O.email} или по телефону ${O.phone}. Отвечает руководитель компании. Отдельный ответственный за защиту данных (DPO) не назначен: компания не является органом власти, не ведёт масштабного систематического наблюдения за людьми и не обрабатывает специальные категории данных в больших объёмах (ст. 37 Закона № 195/2024).`,
    ] },
    { h: "2. Какие данные мы собираем",
      p: ["Мы не собираем ничего, кроме того, что вы сами вводите в форму, и технических записей, без которых сайт не может работать."],
      table: { head: ["Откуда", "Что именно"], rows: [
        ["Форма «Запись на уборку»", "имя, номер телефона, тип услуги, число комнат, ваш комментарий, язык страницы и адрес страницы, с которой отправлена заявка; вместе с ними — отметка о согласии, момент отправки и редакция этой политики"],
        ["Калькулятор стоимости", "имя, номер телефона, выбранные параметры уборки, предварительная сумма, комментарий и — по вашему желанию — до шести фотографий помещения; там же отметка о согласии, момент отправки и редакция политики"],
        ["Журналы хостинга", "IP-адрес, тип браузера, запрошенный адрес, дата и время — записываются автоматически на стороне хостинга для работы и защиты сайта"],
      ] } },
    { h: "3. Фотографии помещений", p: [
      "Фотографии в калькуляторе — дело добровольное. Для части услуг (например, мойки фасада) без снимка невозможно назвать даже примерную цену, и тогда мы просим его отдельно.",
      "Просим снимать только сами помещения и поверхности, которые нужно убрать. Пожалуйста, не фотографируйте людей, документы, экраны с личными данными и ценные вещи: всё, что попадёт в кадр, станет частью заявки. Снимки лежат в закрытом хранилище поставщика из раздела 5 — открыть их можно только по ссылке с ограниченным сроком, которую выдаёт наш сервер сотруднику, — и удаляются вместе с заявкой в сроки раздела 6.",
    ] },
    { h: "4. Зачем и на каком основании",
      table: { head: ["Цель", "Основание (ст. 6 Закона № 195/2024)"], rows: [
        ["Связаться с вами, уточнить детали, рассчитать и согласовать стоимость уборки", "ваше согласие (п. a) и меры, предпринимаемые по вашей просьбе до заключения договора (п. b)"],
        ["Оказать заказанную услугу и вести расчёты по ней", "исполнение договора (п. b)"],
        ["Хранить первичные документы по оказанным услугам", "исполнение обязанности, предусмотренной законом (п. c) — бухгалтерское и налоговое законодательство"],
        ["Работоспособность и защита сайта: журналы, защита от перебора и спама", "законный интерес оператора (п. f) — сайт должен работать и не быть каналом для злоупотреблений"],
        ["Понять, какие объявления Google Ads приводят заявки (тег Google Ads и его cookie)", "ваше согласие (п. a) — кнопка «Принять» в окне cookie; без него тег не загружается"],
      ] },
      p2: [
        `Согласие даётся отметкой в поле рядом со ссылкой на эту политику. Оно добровольно: без него мы не примем заявку через сайт, но вы всегда можете просто позвонить. Согласие можно отозвать в любой момент письмом на ${O.email} — это не влияет на законность обработки, которая шла до отзыва.`,
        "Обязаны ли вы давать данные. Нет: ни закон, ни договор не требуют от вас заполнять форму. Имя и телефон нужны только для того, чтобы мы могли ответить и назвать цену, — без них заявка через сайт не отправится. Никаких других последствий отказ не влечёт: вы можете просто позвонить нам или написать на почту.",
        "Мы не рассылаем рекламу по собранным на сайте контактам и не передаём их для рекламы третьим лицам. Если такая рассылка когда-нибудь появится, для неё будет отдельная галочка и отдельная запись в этой политике.",
      ] },
    { h: "5. Кому передаются данные",
      p: ["Мы не продаём данные и не передаём их посторонним. Их видят только поставщики, без которых сайт не работает, и каждый действует по нашему поручению и в рамках договора."],
      table: { head: ["Кто", "Что делает", "Где", "Чем закрыта передача"], rows: [
        ["Vercel Inc.", "хостинг сайта и обработка отправленных форм", "США", "договор об обработке данных со стандартными договорными условиями (SCC), действует с момента принятия условий сервиса"],
        ["Supabase Inc.", "база заявок, хранилище присланных фотографий, а также отдача части изображений сайта — поэтому при обычном просмотре страниц ваш IP-адрес виден этому поставщику", "компания в США, сервер базы и хранилище — в Стокгольме, Швеция (Европейский союз)", "договор об обработке данных со стандартными договорными условиями (SCC)"],
        ["Telegram FZ-LLC", "мгновенное уведомление сотрудника о новой заявке", "ОАЭ", "договор об обработке с мессенджером невозможен — см. примечание ниже"],
        ["Google Ireland Ltd. / Google LLC", "реклама в поиске Google и подсчёт заявок, которые она приносит; получает данные о визите (IP, браузер, адрес страницы, метку клика по объявлению) только после вашего согласия в окне cookie", "Ирландия (Европейский союз) и США", "условия Google о защите данных для рекламы со стандартными договорными условиями (SCC)"],
        ["LeadGenium (A.I. „IVAN DĂNĂLACHE”)", "разработка и техническое сопровождение сайта", "Республика Молдова", "договор об обработке персональных данных между нами и подрядчиком"],
      ] },
      p2: [
        "Данные могут быть переданы государственным органам, если этого требует закон, — только в объёме требования и только по официальному запросу.",
        "О передаче за пределы Молдовы. Решения Национального центра о достаточном уровне защиты данных в США и ОАЭ на дату этой редакции нет. Поэтому передача опирается на стандартные договорные условия, включённые в договоры об обработке с Vercel, Supabase и Google (ст. 46 Закона № 195/2024); копию этих условий можно запросить у нас письмом на " + O.email + ", мы храним их у себя. Для Telegram таких гарантий не существует — именно поэтому персональные данные из уведомлений и убираются.",
        "Примечание о Telegram. Уведомление о заявке приходит сотруднику в мессенджер, чтобы вам ответили быстро. Это передача данных в страну, с сервисом которой нельзя заключить договор об обработке, поэтому мы переводим уведомления на канал без персональных данных: в сообщении останется только факт «пришла новая заявка», а сама заявка будет открываться в защищённой панели.",
      ] },
    { h: "6. Сколько храним",
      table: { head: ["Что", "Срок"], rows: [
        ["Заявка, по которой не было заказа", "1 год с последнего обращения, затем удаляется"],
        ["Данные по оказанной услуге", "3 года с окончания работ — общий срок исковой давности"],
        ["Первичные бухгалтерские документы", "срок, установленный законодательством о бухгалтерском учёте и архивах"],
        ["Фотографии помещений", "удаляются вместе с заявкой, к которой относятся"],
        ["Журналы хостинга", "несколько недель, срок задаёт хостинг"],
        ["Отметка о согласии: факт, момент, редакция политики", "столько же, сколько сама заявка, — это доказательство того, что согласие было"],
      ] } },
    { h: "7. Переходы на сторонние сервисы", p: [
      "На страницах есть кнопки «написать в WhatsApp» и «написать в Telegram», а в подвале — ссылки на наши страницы в социальных сетях. Пока вы на них не нажали, браузер к этим сервисам не обращается и ничего им о вас не сообщает.",
      "Как только вы нажали, вы оказываетесь в чужом сервисе, и дальше действуют его правила: он видит ваш номер или учётную запись и ведёт свои записи. Мы на это повлиять не можем и отвечаем только за то, что вы напишете нам в переписке, — на такие обращения распространяются разделы 4 и 6 этой политики.",
    ] },
    { h: "8. Cookie и память браузера", p: [
      "Единственные необязательные cookie на сайте — тега Google Ads: по ним видно, какое объявление привело заявку. Тег загружается только после того, как вы нажмёте «Принять» в окне cookie. Если нажать «Отклонить» или ничего не нажимать, он не загружается, и Google о визите ничего не узнаёт. Аналитики, пикселей социальных сетей, тепловых карт и записи сессий на сайте нет.",
      'Подробности — на странице <a href="/ru/cookies">«Cookie и память браузера»</a>.',
    ] },
    { h: "9. Ваши права",
      p: ["По Закону № 195/2024 вы вправе:"],
      ul: [
        "узнать, какие ваши данные у нас есть, откуда они, зачем обрабатываются и кому передавались, и получить их копию (ст. 15);",
        "исправить неточные и дополнить неполные данные (ст. 16);",
        "потребовать удаления, если данные больше не нужны для целей раздела 4 (ст. 17);",
        "потребовать ограничить обработку вместо удаления (ст. 18);",
        "получить свои данные в машиночитаемом виде или попросить передать их другому оператору (ст. 20);",
        "возразить против обработки, которая идёт на основании законного интереса (ст. 21);",
        "отозвать согласие в любой момент — так же просто, как оно было дано.",
      ],
      p2: [
        `Как воспользоваться: напишите на ${O.email} с того адреса или с указанием того номера телефона, с которого вы к нам обращались, — так мы поймём, что это вы. Копию удостоверения личности мы не просим: закон этого не требует, а лишний документ сам по себе был бы избыточным сбором данных.`,
        "Ответ бесплатный, срок — один месяц с получения запроса. Если запрос сложный, срок может быть продлён ещё на два месяца, и мы сообщим об этом в течение первого месяца.",
        `Если ответ вас не устроил или мы не приняли мер по вашему запросу, вы вправе подать жалобу в ${AUTH_RU} и обратиться в суд.`,
      ] },
    { h: "10. Как мы защищаем данные", ul: [
      "сайт работает только по HTTPS, соединение шифруется;",
      "заявки видят только сотрудники, которым это нужно для работы; вход в панель — по паролю;",
      "на страницах нет счётчиков, рекламных сетей и чужих шрифтов: стили, шрифты и скрипты лежат на нашем домене. Единственный внешний адрес, к которому обращается страница, — хранилище Supabase, откуда отдаётся часть изображений; это наш обработчик по договору из раздела 5;",
      "форма не отправляется без отмеченного согласия, а сама отметка сохраняется вместе с заявкой;",
      "фотографии помещений лежат в закрытом хранилище со случайными именами файлов и открываются только по ссылке с ограниченным сроком;",
      "при утечке, опасной для ваших прав, мы уведомляем Национальный центр в течение 72 часов, а вас — если риск для вас высокий.",
    ] },
    { h: "11. Чего мы не делаем", ul: [
      "не принимаем решений о вас автоматически и не занимаемся профилированием;",
      "не собираем специальные категории данных: о здоровье, вероисповедании, политических взглядах, биометрию;",
      "сайт не предназначен для детей: по ст. 8 Закона № 195/2024 ребёнок может дать согласие сам с 14 лет, за младших это делает законный представитель. Мы сознательно не собираем данные детей; если такие данные попали к нам, напишите — удалим;",
      "не передаём данные для рекламы и не продаём их.",
    ] },
    { h: "12. Изменения политики", p: [
      `Действующая редакция — от ${POLICY_VERSION}. При изменении процессов мы правим эту страницу и меняем номер редакции. Вместе с каждой заявкой сохраняется та редакция, которая действовала в момент отправки, поэтому всегда видно, на что именно вы соглашались.`,
    ] },
  ],
};

const privacyRo = {
  slug: "/privacy",
  lang: "ro",
  metaTitle: "Politica de confidențialitate | All Clean Chișinău",
  metaDesc: "Cine este operatorul, ce date colectează formularele All Clean, cui sunt transmise, cât se păstrează și cum pot fi șterse. Conform Legii nr. 195/2024.",
  title: "Politica de confidențialitate",
  updated: `Versiunea din ${POLICY_VERSION}`,
  lead: "Această pagină explică ce date lasă despre sine vizitatorul allclean.md, de ce ne sunt necesare, cui sunt transmise și cum pot fi șterse. Este redactată conform Legii Republicii Moldova nr. 195/2024 privind protecția datelor cu caracter personal.",
  footNote: `${O.legalNameRo} · IDNO ${O.idno} · ${O.addressRo} · <a href="mailto:${O.email}">${O.email}</a> · <a href="tel:+37379955044">${O.phone}</a>`,
  blocks: [
    { h: "1. Cine prelucrează datele dvs.", p: [
      `Operatorul de date cu caracter personal este ${O.legalNameRo}, IDNO ${O.idno}, ${O.addressRo}. Site-ul allclean.md aparține acestei companii și funcționează sub marca „All Clean”.`,
      `Întrebările privind datele cu caracter personal, retragerea consimțământului și orice cerere din secțiunea 9 — la ${O.email} sau la telefonul ${O.phone}. Răspunde administratorul companiei. Un responsabil cu protecția datelor (DPO) nu este desemnat: compania nu este autoritate publică, nu efectuează monitorizare sistematică pe scară largă și nu prelucrează categorii speciale de date la scară largă (art. 37 din Legea nr. 195/2024).`,
    ] },
    { h: "2. Ce date colectăm",
      p: ["Nu colectăm nimic în afară de ceea ce introduceți dvs. în formular și de înregistrările tehnice fără de care site-ul nu poate funcționa."],
      table: { head: ["De unde", "Ce anume"], rows: [
        ["Formularul „Programare”", "numele, numărul de telefon, tipul serviciului, numărul de camere, comentariul dvs., limba paginii și adresa paginii de pe care a fost trimisă cererea; alături — marca consimțământului, momentul trimiterii și versiunea acestei politici"],
        ["Calculatorul de cost", "numele, numărul de telefon, parametrii selectați, suma estimativă, comentariul și — la dorința dvs. — până la șase fotografii ale spațiului; tot acolo marca consimțământului, momentul trimiterii și versiunea politicii"],
        ["Jurnalele găzduirii", "adresa IP, tipul browserului, adresa solicitată, data și ora — se înregistrează automat la furnizorul de găzduire pentru funcționarea și protecția site-ului"],
      ] } },
    { h: "3. Fotografiile spațiilor", p: [
      "Fotografiile din calculator sunt opționale. Pentru unele servicii (de exemplu, spălarea fațadei) fără o imagine nu putem indica nici măcar un preț aproximativ, și atunci o cerem separat.",
      "Vă rugăm să fotografiați doar spațiile și suprafețele care trebuie curățate. Nu fotografiați persoane, documente, ecrane cu date personale sau obiecte de valoare: tot ce intră în cadru devine parte a cererii. Imaginile se află într-o stocare închisă a furnizorului din secțiunea 5 — pot fi deschise doar printr-un link cu termen limitat, emis de serverul nostru pentru angajat — și se șterg împreună cu cererea, în termenele din secțiunea 6.",
    ] },
    { h: "4. În ce scop și în ce temei",
      table: { head: ["Scopul", "Temeiul (art. 6 din Legea nr. 195/2024)"], rows: [
        ["Să vă contactăm, să clarificăm detaliile, să calculăm și să convenim costul curățeniei", "consimțământul dvs. (lit. a) și măsurile luate la cererea dvs. înainte de încheierea contractului (lit. b)"],
        ["Să prestăm serviciul comandat și să efectuăm decontările", "executarea contractului (lit. b)"],
        ["Să păstrăm documentele primare privind serviciile prestate", "îndeplinirea unei obligații legale (lit. c) — legislația contabilă și fiscală"],
        ["Funcționarea și securitatea site-ului: jurnale, protecție împotriva abuzurilor și spamului", "interesul legitim al operatorului (lit. f)"],
        ["Să înțelegem ce anunțuri Google Ads aduc cereri (eticheta Google Ads și cookie-urile ei)", "consimțământul dvs. (lit. a) — butonul „Accept” din fereastra cookie; fără el eticheta nu se încarcă"],
      ] },
      p2: [
        `Consimțământul se exprimă prin bifarea căsuței de lângă linkul către această politică. Este benevol: fără el nu putem primi cererea prin site, dar ne puteți oricând suna. Consimțământul poate fi retras oricând printr-un mesaj la ${O.email} — retragerea nu afectează legalitatea prelucrării de până la ea.`,
        "Sunteți obligat să furnizați datele? Nu: nici legea, nici un contract nu vă obligă să completați formularul. Numele și telefonul ne sunt necesare doar ca să vă putem răspunde și indica prețul — fără ele cererea nu poate fi trimisă prin site. Refuzul nu are alte consecințe: ne puteți pur și simplu suna sau scrie pe e-mail.",
        "Nu trimitem publicitate la contactele colectate pe site și nu le transmitem terților în scop publicitar. Dacă va apărea vreodată o astfel de comunicare, ea va avea o căsuță separată și o mențiune separată în această politică.",
      ] },
    { h: "5. Cui sunt transmise datele",
      p: ["Nu vindem datele și nu le transmitem persoanelor străine. Le văd doar furnizorii fără de care site-ul nu funcționează, fiecare acționând la instrucțiunile noastre și în baza unui contract."],
      table: { head: ["Cine", "Ce face", "Unde", "Ce acoperă transferul"], rows: [
        ["Vercel Inc.", "găzduirea site-ului și procesarea formularelor trimise", "SUA", "acord de prelucrare a datelor cu clauze contractuale standard (SCC), în vigoare din momentul acceptării condițiilor serviciului"],
        ["Supabase Inc.", "baza de date a cererilor, stocarea fotografiilor trimise și livrarea unei părți din imaginile site-ului — de aceea la simpla vizitare adresa dvs. IP este vizibilă acestui furnizor", "compania este în SUA, iar serverul bazei și stocarea — la Stockholm, Suedia (Uniunea Europeană)", "acord de prelucrare a datelor cu clauze contractuale standard (SCC)"],
        ["Telegram FZ-LLC", "notificarea imediată a angajatului despre o cerere nouă", "EAU", "un acord de prelucrare cu mesageria nu este posibil — vezi nota de mai jos"],
        ["Google Ireland Ltd. / Google LLC", "publicitate în căutarea Google și numărarea cererilor pe care le aduce; primește datele vizitei (IP, browser, adresa paginii, eticheta clicului pe anunț) doar după consimțământul dvs. în fereastra cookie", "Irlanda (Uniunea Europeană) și SUA", "condițiile Google privind protecția datelor pentru publicitate (Google Ads Data Processing Terms) cu clauze contractuale standard (SCC)"],
        ["LeadGenium (A.I. „IVAN DĂNĂLACHE”)", "dezvoltarea și mentenanța tehnică a site-ului", "Republica Moldova", "acord de prelucrare a datelor cu caracter personal între noi și prestator"],
      ] },
      p2: [
        "Datele pot fi transmise autorităților publice dacă legea o cere — doar în volumul solicitat și doar în baza unei cereri oficiale.",
        "Despre transferul în afara Moldovei. La data acestei versiuni nu există o decizie a Centrului Național privind caracterul adecvat al nivelului de protecție în SUA și în EAU. De aceea transferul se întemeiază pe clauzele contractuale standard incluse în acordurile de prelucrare cu Vercel, Supabase și Google (art. 46 din Legea nr. 195/2024); o copie a acestor clauze poate fi cerută de la noi printr-un mesaj la " + O.email + ", le păstrăm la sediu. Pentru Telegram astfel de garanții nu există — tocmai de aceea datele cu caracter personal sunt scoase din notificări.",
        "Notă despre Telegram. Notificarea despre cerere ajunge la angajat în mesagerie, ca să vi se răspundă repede. Acesta este un transfer într-o țară cu al cărei serviciu nu poate fi încheiat un acord de prelucrare, de aceea mutăm notificările pe un canal fără date cu caracter personal: în mesaj va rămâne doar faptul „a sosit o cerere nouă”, iar cererea se va deschide în panoul protejat.",
      ] },
    { h: "6. Cât timp păstrăm",
      table: { head: ["Ce", "Termen"], rows: [
        ["Cerere fără comandă ulterioară", "1 an de la ultima adresare, apoi se șterge"],
        ["Datele privind serviciul prestat", "3 ani de la finalizarea lucrărilor — termenul general de prescripție"],
        ["Documentele contabile primare", "termenul stabilit de legislația contabilă și de arhivă"],
        ["Fotografiile spațiilor", "se șterg împreună cu cererea la care se referă"],
        ["Jurnalele găzduirii", "câteva săptămâni, termenul este stabilit de furnizor"],
        ["Marca consimțământului: fapt, moment, versiunea politicii", "cât și cererea — este dovada că a existat consimțământ"],
      ] } },
    { h: "7. Trecerea la servicii terțe", p: [
      "Pe pagini există butoanele „scrie pe WhatsApp” și „scrie pe Telegram”, iar în subsol — linkuri către paginile noastre din rețelele sociale. Până când nu le apăsați, browserul nu se adresează acestor servicii și nu le comunică nimic despre dvs.",
      "De îndată ce le apăsați, ajungeți într-un serviciu străin, unde se aplică regulile lui: el vă vede numărul sau contul și ține propriile evidențe. Noi nu putem influența acest lucru și răspundem doar pentru ceea ce ne scrieți în corespondență — acestor mesaje li se aplică secțiunile 4 și 6 din această politică.",
    ] },
    { h: "8. Cookie și memoria browserului", p: [
      "Singurele cookie neobligatorii de pe site sunt cele ale etichetei Google Ads: din ele se vede ce anunț a adus o cerere. Eticheta se încarcă doar după ce apăsați „Accept” în fereastra cookie. Dacă apăsați „Refuz” sau nu apăsați nimic, ea nu se încarcă, iar Google nu află nimic despre vizită. Analize, pixeli ai rețelelor sociale, hărți termice și înregistrarea sesiunilor nu există pe site.",
      'Detalii — pe pagina <a href="/cookies">„Cookie și memoria browserului”</a>.',
    ] },
    { h: "9. Drepturile dvs.",
      p: ["Conform Legii nr. 195/2024 aveți dreptul:"],
      ul: [
        "să aflați ce date ale dvs. deținem, de unde provin, în ce scop sunt prelucrate și cui au fost transmise, și să primiți o copie (art. 15);",
        "să corectați datele inexacte și să completați datele incomplete (art. 16);",
        "să cereți ștergerea, dacă datele nu mai sunt necesare pentru scopurile din secțiunea 4 (art. 17);",
        "să cereți restricționarea prelucrării în locul ștergerii (art. 18);",
        "să primiți datele într-un format care poate fi citit automat sau să cereți transmiterea lor altui operator (art. 20);",
        "să vă opuneți prelucrării întemeiate pe interesul legitim (art. 21);",
        "să retrageți consimțământul oricând — la fel de simplu cum a fost dat.",
      ],
      p2: [
        `Cum procedați: scrieți la ${O.email} de la adresa sau indicând numărul de telefon de la care ne-ați contactat — astfel înțelegem că sunteți dvs. Nu cerem copia actului de identitate: legea nu o impune, iar un document în plus ar fi el însuși o colectare excesivă de date.`,
        "Răspunsul este gratuit, termenul — o lună de la primirea cererii. Dacă cererea este complexă, termenul poate fi prelungit cu încă două luni, iar noi vă anunțăm despre aceasta în prima lună.",
        `Dacă răspunsul nu vă mulțumește sau nu am luat măsuri la cererea dvs., aveți dreptul să depuneți o plângere la ${AUTH_RO} și să vă adresați instanței de judecată.`,
      ] },
    { h: "10. Cum protejăm datele", ul: [
      "site-ul funcționează doar prin HTTPS, conexiunea este criptată;",
      "cererile sunt văzute doar de angajații cărora le sunt necesare pentru lucru; accesul în panou — cu parolă;",
      "pe pagini nu există contoare, rețele publicitare sau fonturi străine: stilurile, fonturile și scripturile se află pe domeniul nostru. Singura adresă externă la care se adresează pagina este stocarea Supabase, de unde este livrată o parte din imagini; acesta este prestatorul nostru conform contractului din secțiunea 5;",
      "formularul nu se trimite fără bifa de consimțământ, iar bifa se păstrează împreună cu cererea;",
      "fotografiile spațiilor se află într-o stocare închisă, cu nume de fișiere aleatorii, și se deschid doar printr-un link cu termen limitat;",
      "în caz de incident periculos pentru drepturile dvs. notificăm Centrul Național în 72 de ore, iar pe dvs. — dacă riscul pentru dvs. este ridicat.",
    ] },
    { h: "11. Ce nu facem", ul: [
      "nu luăm decizii automate despre dvs. și nu facem profilare;",
      "nu colectăm categorii speciale de date: despre sănătate, religie, opinii politice, date biometrice;",
      "site-ul nu este destinat copiilor: conform art. 8 din Legea nr. 195/2024 copilul își poate da singur consimțământul de la 14 ani, iar pentru cei mai mici o face reprezentantul legal. Nu colectăm cu bună știință date ale copiilor; dacă astfel de date au ajuns la noi, scrieți-ne și le ștergem;",
      "nu transmitem datele în scop publicitar și nu le vindem.",
    ] },
    { h: "12. Modificarea politicii", p: [
      `Versiunea în vigoare — din ${POLICY_VERSION}. La schimbarea proceselor modificăm această pagină și numărul versiunii. Împreună cu fiecare cerere se păstrează versiunea valabilă în momentul trimiterii, astfel încât se vede întotdeauna cu ce anume ați fost de acord.`,
    ] },
  ],
};

// ── cookie ───────────────────────────────────────────────────────────────────────────
const cookiesRu = {
  slug: "/ru/cookies",
  lang: "ru",
  metaTitle: "Cookie и память браузера | All Clean Кишинёв",
  metaDesc: "Что сайт All Clean сохраняет в вашем браузере: без согласия — ничего, с согласием — cookie тега Google Ads. Как изменить выбор.",
  title: "Cookie и память браузера",
  lead: "Страница объясняет, что сайт сохраняет на вашем устройстве и что отправляет наружу. Дополняет политику конфиденциальности.",
  footNote: `<a href="/ru/privacy">Политика конфиденциальности</a> · ${O.legalNameRu} · IDNO ${O.idno} · ${O.addressRu}`,
  blocks: [
    { h: "Коротко", p: [
      "Без вашего согласия сайт allclean.md не ставит cookie и не подключает сторонние скрипты. Единственное, что может появиться с вашего согласия, — тег Google Ads: по нему видно, какое рекламное объявление привело заявку.",
      "При первом визите внизу страницы появляется окно с двумя одинаковыми кнопками: «Принять» и «Отклонить». Пока вы не нажали «Принять», тег не загружается.",
      'Выбор можно изменить в любой момент: <button type="button" onclick="window.lgConsentOpen&&window.lgConsentOpen()" style="margin-top:6px;padding:12px 22px;border:0;border-radius:12px;background:#0c2959;color:#fff;font-weight:700;cursor:pointer">Изменить выбор cookie</button>',
    ] },
    { h: "Что ставится после «Принять»",
      table: { head: ["Cookie", "Кто ставит", "Зачем", "Срок"], rows: [
        ["_gcl_au", "Google Ads, на allclean.md", "связать визит с кликом по объявлению", "90 дней"],
        ["_gcl_aw", "Google Ads, на allclean.md", "хранит метку клика по объявлению (gclid), если вы пришли по рекламе", "90 дней"],
        ["IDE, test_cookie и подобные", "Google, на своих доменах (doubleclick.net, google.com)", "подсчёт рекламных конверсий на стороне Google", "по правилам Google, обычно до 13 месяцев"],
      ] },
      p2: ["Тег сообщает Google о визите и о странице «Спасибо» после заявки. Имя, телефон и текст заявки в Google не передаются. Персонализированную рекламу (ремаркетинг) мы не включаем."] },
    { h: "Что хранится без согласия", p: [
      "Только сам ваш выбор: запись lg_consent в памяти браузера (localStorage) — «принято» или «отклонено» и дата. Без неё окно появлялось бы на каждой странице. Через 12 месяцев запись устаревает, и окно появится снова.",
      "Часть изображений сайта отдаётся из хранилища Supabase — поставщика, который держит нашу базу заявок. Он видит ваш IP-адрес и модель браузера, как любой сервер, отдающий картинку, но не ставит cookie и не считает посетителей.",
    ] },
    { h: "Чего на сайте нет", ul: [
      "Google Analytics, Яндекс.Метрики и любых других счётчиков;",
      "пикселей Facebook, Instagram, TikTok;",
      "тепловых карт и записи действий посетителя;",
      "чужих шрифтов и библиотек: шрифты, стили и скрипты лежат на нашем домене;",
      "встроенных чужих карт, чатов и виджетов обратного звонка.",
    ] },
    { h: "Что происходит, когда вы отправляете заявку", p: [
      'Заявка уходит на наш сервер и в базу заявок. Что именно передаётся, кому и на сколько — в <a href="/ru/privacy">политике конфиденциальности</a>, разделы 2, 5 и 6. Если вы пришли по рекламе, в адресе страницы, который сохраняется с заявкой, есть метка клика (gclid): по ней мы видим, какое объявление сработало.',
    ] },
    { h: "Как отозвать согласие", p: [
      "Нажмите «Изменить выбор cookie» выше и выберите «Отклонить»: тег перестанет загружаться, а его cookie на allclean.md удалятся. Cookie на доменах Google удаляются в настройках браузера: в Chrome «Настройки → Конфиденциальность и безопасность → Файлы cookie», в Firefox «Настройки → Приватность и защита», в Safari «Настройки → Конфиденциальность».",
      `Вопросы — на <a href="mailto:${O.email}">${O.email}</a>.`,
    ] },
  ],
};

const cookiesRo = {
  slug: "/cookies",
  lang: "ro",
  metaTitle: "Cookie și memoria browserului | All Clean Chișinău",
  metaDesc: "Ce salvează site-ul All Clean în browserul dvs.: fără consimțământ — nimic, cu consimțământ — cookie-urile etichetei Google Ads.",
  title: "Cookie și memoria browserului",
  lead: "Pagina explică ce salvează site-ul pe dispozitivul dvs. și ce trimite în exterior. Completează politica de confidențialitate.",
  footNote: `<a href="/privacy">Politica de confidențialitate</a> · ${O.legalNameRo} · IDNO ${O.idno} · ${O.addressRo}`,
  blocks: [
    { h: "Pe scurt", p: [
      "Fără consimțământul dvs. site-ul allclean.md nu plasează cookie și nu încarcă scripturi terțe. Singurul lucru care poate apărea cu acordul dvs. este eticheta Google Ads: din ea se vede ce anunț publicitar a adus o cerere.",
      "La prima vizită, în partea de jos a paginii apare o fereastră cu două butoane la fel: „Accept” și „Refuz”. Până nu apăsați „Accept”, eticheta nu se încarcă.",
      'Alegerea poate fi schimbată oricând: <button type="button" onclick="window.lgConsentOpen&&window.lgConsentOpen()" style="margin-top:6px;padding:12px 22px;border:0;border-radius:12px;background:#0c2959;color:#fff;font-weight:700;cursor:pointer">Schimbați alegerea cookie</button>',
    ] },
    { h: "Ce se plasează după „Accept”",
      table: { head: ["Cookie", "Cine îl plasează", "Pentru ce", "Durata"], rows: [
        ["_gcl_au", "Google Ads, pe allclean.md", "leagă vizita de clicul pe anunț", "90 de zile"],
        ["_gcl_aw", "Google Ads, pe allclean.md", "păstrează eticheta clicului pe anunț (gclid), dacă ați venit din reclamă", "90 de zile"],
        ["IDE, test_cookie și altele asemenea", "Google, pe domeniile sale (doubleclick.net, google.com)", "numărarea conversiilor publicitare la Google", "după regulile Google, de obicei până la 13 luni"],
      ] },
      p2: ["Eticheta îi comunică lui Google vizita și pagina „Mulțumim” după cerere. Numele, telefonul și textul cererii nu sunt transmise lui Google. Publicitatea personalizată (remarketing) nu o activăm."] },
    { h: "Ce se păstrează fără consimțământ", p: [
      "Doar alegerea dvs.: înregistrarea lg_consent în memoria browserului (localStorage) — „acceptat” sau „refuzat” și data. Fără ea fereastra ar apărea pe fiecare pagină. După 12 luni înregistrarea expiră și fereastra apare din nou.",
      "O parte din imaginile site-ului este livrată din stocarea Supabase — furnizorul care găzduiește baza noastră de cereri. El vede adresa dvs. IP și tipul browserului, ca orice server care livrează o imagine, dar nu plasează cookie și nu numără vizitatorii.",
    ] },
    { h: "Ce nu există pe site", ul: [
      "Google Analytics, Yandex.Metrica sau alte contoare;",
      "pixeli Facebook, Instagram, TikTok;",
      "hărți termice și înregistrarea acțiunilor vizitatorului;",
      "fonturi și biblioteci străine: fonturile, stilurile și scripturile se află pe domeniul nostru;",
      "hărți, chat-uri și widget-uri de apel invers încorporate de la terți.",
    ] },
    { h: "Ce se întâmplă când trimiteți o cerere", p: [
      'Cererea ajunge pe serverul nostru și în baza de date a cererilor. Ce anume se transmite, cui și pentru cât timp — în <a href="/privacy">politica de confidențialitate</a>, secțiunile 2, 5 și 6. Dacă ați venit din reclamă, adresa paginii, păstrată împreună cu cererea, conține eticheta clicului (gclid): din ea vedem ce anunț a funcționat.',
    ] },
    { h: "Cum vă retrageți consimțământul", p: [
      "Apăsați „Schimbați alegerea cookie” de mai sus și alegeți „Refuz”: eticheta nu se mai încarcă, iar cookie-urile ei de pe allclean.md se șterg. Cookie-urile de pe domeniile Google se șterg din setările browserului: în Chrome „Setări → Confidențialitate și securitate → Cookie-uri”, în Firefox „Setări → Confidențialitate și securitate”, în Safari „Setări → Confidențialitate”.",
      `Întrebări — la <a href="mailto:${O.email}">${O.email}</a>.`,
    ] },
  ],
};

/** Четыре страницы: политика и cookie на двух языках. Пары для hreflang — по `group`. */
export const LEGAL_PAGES = [
  { ...privacyRo, group: "privacy", pair: "/ru/privacy" },
  { ...privacyRu, group: "privacy", pair: "/privacy" },
  { ...cookiesRo, group: "cookies", pair: "/ru/cookies" },
  { ...cookiesRu, group: "cookies", pair: "/cookies" },
];
