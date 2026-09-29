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
      `Вопросы о персональных данных, отзыв согласия и любые запросы из раздела 8 — на ${O.email} или по телефону ${O.phone}. Отвечает руководитель компании. Отдельный ответственный за защиту данных (DPO) не назначен: компания не является органом власти, не ведёт масштабного систематического наблюдения за людьми и не обрабатывает специальные категории данных в больших объёмах (ст. 37 Закона № 195/2024).`,
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
      ] },
      p2: [
        `Согласие даётся отметкой в поле рядом со ссылкой на эту политику. Оно добровольно: без него мы не примем заявку через сайт, но вы всегда можете просто позвонить. Согласие можно отозвать в любой момент письмом на ${O.email} — это не влияет на законность обработки, которая шла до отзыва.`,
        "Мы не рассылаем рекламу по собранным на сайте контактам и не передаём их для рекламы третьим лицам. Если такая рассылка когда-нибудь появится, для неё будет отдельная галочка и отдельная запись в этой политике.",
      ] },
    { h: "5. Кому передаются данные",
      p: ["Мы не продаём данные и не передаём их посторонним. Их видят только поставщики, без которых сайт не работает, и каждый действует по нашему поручению и в рамках договора."],
      table: { head: ["Кто", "Что делает", "Где", "Чем закрыта передача"], rows: [
        ["Vercel Inc.", "хостинг сайта и обработка отправленных форм", "США", "договор об обработке данных со стандартными договорными условиями (SCC), действует с момента принятия условий сервиса"],
        ["Supabase Inc.", "база заявок, хранилище присланных фотографий, а также отдача части изображений сайта — поэтому при обычном просмотре страниц ваш IP-адрес виден этому поставщику", "компания в США, сервер базы и хранилище — в Стокгольме, Швеция (Европейский союз)", "договор об обработке данных со стандартными договорными условиями (SCC)"],
        ["Telegram FZ-LLC", "мгновенное уведомление сотрудника о новой заявке", "ОАЭ", "договор об обработке с мессенджером невозможен — см. примечание ниже"],
        ["LeadGenium (A.I. „IVAN DĂNĂLACHE”)", "разработка и техническое сопровождение сайта", "Республика Молдова", "договор об обработке персональных данных между нами и подрядчиком"],
      ] },
      p2: [
        "Данные могут быть переданы государственным органам, если этого требует закон, — только в объёме требования и только по официальному запросу.",
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
    { h: "7. Cookie и память браузера", p: [
      "Сайт не ставит рекламных и аналитических cookie. На нём нет Google Analytics, нет пикселей социальных сетей, нет тепловых карт и записи сессий, нет рекламных сетей. Отдельного окна согласия на cookie нет ровно потому, что спрашивать не о чем.",
      'Подробности — на странице <a href="/ru/cookies">«Cookie и память браузера»</a>.',
    ] },
    { h: "8. Ваши права",
      p: ["По Закону № 195/2024 вы вправе:"],
      ul: [
        "узнать, какие ваши данные у нас есть, откуда они, зачем обрабатываются и кому передавались (ст. 15–16);",
        "исправить неточные данные (ст. 17);",
        "потребовать удаления, если данные больше не нужны для целей раздела 4 (ст. 18);",
        "потребовать ограничить обработку вместо удаления (ст. 19);",
        "получить свои данные в машиночитаемом виде или попросить передать их другому оператору (ст. 21);",
        "возразить против обработки, которая идёт на основании законного интереса (ст. 22);",
        "отозвать согласие в любой момент — так же просто, как оно было дано.",
      ],
      p2: [
        `Как воспользоваться: напишите на ${O.email} с того адреса или с указанием того номера телефона, с которого вы к нам обращались, — так мы поймём, что это вы. Копию удостоверения личности мы не просим: закон этого не требует, а лишний документ сам по себе был бы избыточным сбором данных.`,
        "Ответ бесплатный, срок — один месяц с получения запроса. Если запрос сложный, срок может быть продлён ещё на два месяца, и мы сообщим об этом в течение первого месяца.",
        `Если ответ вас не устроил, вы вправе подать жалобу в ${AUTH_RU}.`,
      ] },
    { h: "9. Как мы защищаем данные", ul: [
      "сайт работает только по HTTPS, соединение шифруется;",
      "заявки видят только сотрудники, которым это нужно для работы; вход в панель — по паролю;",
      "на страницах нет счётчиков, рекламных сетей и чужих шрифтов: стили, шрифты и скрипты лежат на нашем домене. Единственный внешний адрес, к которому обращается страница, — хранилище Supabase, откуда отдаётся часть изображений; это наш обработчик по договору из раздела 5;",
      "форма не отправляется без отмеченного согласия, а сама отметка сохраняется вместе с заявкой;",
      "фотографии помещений лежат в закрытом хранилище со случайными именами файлов и открываются только по ссылке с ограниченным сроком;",
      "при утечке, опасной для ваших прав, мы уведомляем Национальный центр в течение 72 часов, а вас — если риск для вас высокий.",
    ] },
    { h: "10. Чего мы не делаем", ul: [
      "не принимаем решений о вас автоматически и не занимаемся профилированием;",
      "не собираем специальные категории данных: о здоровье, вероисповедании, политических взглядах, биометрию;",
      "сайт не предназначен для детей, и мы сознательно не собираем данные лиц младше 16 лет; если такие данные попали к нам, напишите — удалим;",
      "не передаём данные для рекламы и не продаём их.",
    ] },
    { h: "11. Изменения политики", p: [
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
      `Întrebările privind datele cu caracter personal, retragerea consimțământului și orice cerere din secțiunea 8 — la ${O.email} sau la telefonul ${O.phone}. Răspunde administratorul companiei. Un responsabil cu protecția datelor (DPO) nu este desemnat: compania nu este autoritate publică, nu efectuează monitorizare sistematică pe scară largă și nu prelucrează categorii speciale de date la scară largă (art. 37 din Legea nr. 195/2024).`,
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
      ] },
      p2: [
        `Consimțământul se exprimă prin bifarea căsuței de lângă linkul către această politică. Este benevol: fără el nu putem primi cererea prin site, dar ne puteți oricând suna. Consimțământul poate fi retras oricând printr-un mesaj la ${O.email} — retragerea nu afectează legalitatea prelucrării de până la ea.`,
        "Nu trimitem publicitate la contactele colectate pe site și nu le transmitem terților în scop publicitar. Dacă va apărea vreodată o astfel de comunicare, ea va avea o căsuță separată și o mențiune separată în această politică.",
      ] },
    { h: "5. Cui sunt transmise datele",
      p: ["Nu vindem datele și nu le transmitem persoanelor străine. Le văd doar furnizorii fără de care site-ul nu funcționează, fiecare acționând la instrucțiunile noastre și în baza unui contract."],
      table: { head: ["Cine", "Ce face", "Unde", "Ce acoperă transferul"], rows: [
        ["Vercel Inc.", "găzduirea site-ului și procesarea formularelor trimise", "SUA", "acord de prelucrare a datelor cu clauze contractuale standard (SCC), în vigoare din momentul acceptării condițiilor serviciului"],
        ["Supabase Inc.", "baza de date a cererilor, stocarea fotografiilor trimise și livrarea unei părți din imaginile site-ului — de aceea la simpla vizitare adresa dvs. IP este vizibilă acestui furnizor", "compania este în SUA, iar serverul bazei și stocarea — la Stockholm, Suedia (Uniunea Europeană)", "acord de prelucrare a datelor cu clauze contractuale standard (SCC)"],
        ["Telegram FZ-LLC", "notificarea imediată a angajatului despre o cerere nouă", "EAU", "un acord de prelucrare cu mesageria nu este posibil — vezi nota de mai jos"],
        ["LeadGenium (A.I. „IVAN DĂNĂLACHE”)", "dezvoltarea și mentenanța tehnică a site-ului", "Republica Moldova", "acord de prelucrare a datelor cu caracter personal între noi și prestator"],
      ] },
      p2: [
        "Datele pot fi transmise autorităților publice dacă legea o cere — doar în volumul solicitat și doar în baza unei cereri oficiale.",
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
    { h: "7. Cookie și memoria browserului", p: [
      "Site-ul nu plasează cookie publicitare sau de analiză. Nu există Google Analytics, pixeli ai rețelelor sociale, hărți termice sau înregistrarea sesiunilor, nu există rețele publicitare. Nu există o fereastră separată de consimțământ pentru cookie tocmai pentru că nu avem ce întreba.",
      'Detalii — pe pagina <a href="/cookies">„Cookie și memoria browserului”</a>.',
    ] },
    { h: "8. Drepturile dvs.",
      p: ["Conform Legii nr. 195/2024 aveți dreptul:"],
      ul: [
        "să aflați ce date ale dvs. deținem, de unde provin, în ce scop sunt prelucrate și cui au fost transmise (art. 15–16);",
        "să corectați datele inexacte (art. 17);",
        "să cereți ștergerea, dacă datele nu mai sunt necesare pentru scopurile din secțiunea 4 (art. 18);",
        "să cereți restricționarea prelucrării în locul ștergerii (art. 19);",
        "să primiți datele într-un format care poate fi citit automat sau să cereți transmiterea lor altui operator (art. 21);",
        "să vă opuneți prelucrării întemeiate pe interesul legitim (art. 22);",
        "să retrageți consimțământul oricând — la fel de simplu cum a fost dat.",
      ],
      p2: [
        `Cum procedați: scrieți la ${O.email} de la adresa sau indicând numărul de telefon de la care ne-ați contactat — astfel înțelegem că sunteți dvs. Nu cerem copia actului de identitate: legea nu o impune, iar un document în plus ar fi el însuși o colectare excesivă de date.`,
        "Răspunsul este gratuit, termenul — o lună de la primirea cererii. Dacă cererea este complexă, termenul poate fi prelungit cu încă două luni, iar noi vă anunțăm despre aceasta în prima lună.",
        `Dacă răspunsul nu vă mulțumește, aveți dreptul să depuneți o plângere la ${AUTH_RO}.`,
      ] },
    { h: "9. Cum protejăm datele", ul: [
      "site-ul funcționează doar prin HTTPS, conexiunea este criptată;",
      "cererile sunt văzute doar de angajații cărora le sunt necesare pentru lucru; accesul în panou — cu parolă;",
      "pe pagini nu există contoare, rețele publicitare sau fonturi străine: stilurile, fonturile și scripturile se află pe domeniul nostru. Singura adresă externă la care se adresează pagina este stocarea Supabase, de unde este livrată o parte din imagini; acesta este prestatorul nostru conform contractului din secțiunea 5;",
      "formularul nu se trimite fără bifa de consimțământ, iar bifa se păstrează împreună cu cererea;",
      "fotografiile spațiilor se află într-o stocare închisă, cu nume de fișiere aleatorii, și se deschid doar printr-un link cu termen limitat;",
      "în caz de incident periculos pentru drepturile dvs. notificăm Centrul Național în 72 de ore, iar pe dvs. — dacă riscul pentru dvs. este ridicat.",
    ] },
    { h: "10. Ce nu facem", ul: [
      "nu luăm decizii automate despre dvs. și nu facem profilare;",
      "nu colectăm categorii speciale de date: despre sănătate, religie, opinii politice, date biometrice;",
      "site-ul nu este destinat copiilor și nu colectăm cu bună știință date ale persoanelor sub 16 ani; dacă astfel de date au ajuns la noi, scrieți-ne și le ștergem;",
      "nu transmitem datele în scop publicitar și nu le vindem.",
    ] },
    { h: "11. Modificarea politicii", p: [
      `Versiunea în vigoare — din ${POLICY_VERSION}. La schimbarea proceselor modificăm această pagină și numărul versiunii. Împreună cu fiecare cerere se păstrează versiunea valabilă în momentul trimiterii, astfel încât se vede întotdeauna cu ce anume ați fost de acord.`,
    ] },
  ],
};

// ── cookie ───────────────────────────────────────────────────────────────────────────
const cookiesRu = {
  slug: "/ru/cookies",
  lang: "ru",
  metaTitle: "Cookie и память браузера | All Clean Кишинёв",
  metaDesc: "Что сайт All Clean сохраняет в вашем браузере и что отправляет наружу. Счётчиков и рекламных cookie на сайте нет.",
  title: "Cookie и память браузера",
  lead: "Страница объясняет, что сайт сохраняет на вашем устройстве и что отправляет наружу. Дополняет политику конфиденциальности.",
  footNote: `<a href="/ru/privacy">Политика конфиденциальности</a> · ${O.legalNameRu} · IDNO ${O.idno} · ${O.addressRu}`,
  blocks: [
    { h: "Коротко", p: [
      "Сайт allclean.md не ставит cookie: ни рекламных, ни аналитических, ни «своих для удобства». Поэтому здесь нет окна «мы используем cookie» — спрашивать не о чем.",
      "Это не общая фраза, а проверяемое утверждение: откройте на любой странице инструменты разработчика (F12) → «Application» → «Cookies». Список будет пуст.",
    ] },
    { h: "Чего на сайте нет", ul: [
      "Google Analytics, Яндекс.Метрики и любых других счётчиков;",
      "пикселей Facebook, Instagram, TikTok и рекламных сетей;",
      "тепловых карт и записи действий посетителя;",
      "чужих шрифтов и библиотек: шрифты, стили и скрипты лежат на нашем домене;",
      "встроенных чужих карт, чатов и виджетов обратного звонка.",
    ] },
    { h: "Единственный внешний адрес", p: [
      "Часть изображений сайта отдаётся из хранилища Supabase — поставщика, который держит нашу базу заявок. Значит, при обычном просмотре страниц он видит ваш IP-адрес и модель браузера, как видит их любой сервер, отдающий картинку.",
      "Это не слежка и не аналитика: изображения не считают посетителей и не ставят cookie. Supabase — наш обработчик по договору, он перечислен в разделе 5 политики конфиденциальности. Больше ни к одному внешнему адресу страница не обращается.",
    ] },
    { h: "Что происходит, когда вы отправляете заявку", p: [
      'Только в этот момент данные покидают ваш браузер: заявка уходит на наш сервер и в базу заявок. Что именно передаётся, кому и на сколько — в <a href="/ru/privacy">политике конфиденциальности</a>, разделы 2, 5 и 6.',
      "Просмотр страниц заявкой не является: если вы ничего не отправляли, у нас остаётся только техническая запись хостинга (IP, браузер, адрес страницы, время), нужная для работы и защиты сайта.",
    ] },
    { h: "Как управлять cookie в браузере", p: [
      "Даже там, где сайты ставят cookie, последнее слово за вами: любой браузер умеет блокировать и удалять их — в Chrome это «Настройки → Конфиденциальность и безопасность → Файлы cookie», в Firefox «Настройки → Приватность и защита», в Safari «Настройки → Конфиденциальность».",
      "На работу allclean.md эти настройки не влияют: сайту нечего сохранять.",
    ] },
    { h: "Если что-то изменится", p: [
      "Появление счётчика, карты или чата означает появление cookie. В этот же день на сайте появится окно согласия с равными по заметности кнопками «Принять всё» и «Отклонить всё», скрипты перестанут запускаться до вашего ответа, а эта страница будет переписана. Обещание «мы ничего не ставим» имеет смысл, только пока оно проверяемо.",
      `Вопросы — на <a href="mailto:${O.email}">${O.email}</a>.`,
    ] },
  ],
};

const cookiesRo = {
  slug: "/cookies",
  lang: "ro",
  metaTitle: "Cookie și memoria browserului | All Clean Chișinău",
  metaDesc: "Ce salvează site-ul All Clean în browserul dvs. și ce trimite în exterior. Pe site nu există contoare și cookie publicitare.",
  title: "Cookie și memoria browserului",
  lead: "Pagina explică ce salvează site-ul pe dispozitivul dvs. și ce trimite în exterior. Completează politica de confidențialitate.",
  footNote: `<a href="/privacy">Politica de confidențialitate</a> · ${O.legalNameRo} · IDNO ${O.idno} · ${O.addressRo}`,
  blocks: [
    { h: "Pe scurt", p: [
      "Site-ul allclean.md nu plasează cookie: nici publicitare, nici de analiză, nici „proprii, pentru comoditate”. De aceea nu există fereastra „folosim cookie” — nu avem ce întreba.",
      "Aceasta nu este o frază generală, ci o afirmație verificabilă: deschideți pe orice pagină instrumentele pentru dezvoltatori (F12) → „Application” → „Cookies”. Lista va fi goală.",
    ] },
    { h: "Ce nu există pe site", ul: [
      "Google Analytics, Yandex.Metrica sau alte contoare;",
      "pixeli Facebook, Instagram, TikTok și rețele publicitare;",
      "hărți termice și înregistrarea acțiunilor vizitatorului;",
      "fonturi și biblioteci străine: fonturile, stilurile și scripturile se află pe domeniul nostru;",
      "hărți, chat-uri și widget-uri de apel invers încorporate de la terți.",
    ] },
    { h: "Singura adresă externă", p: [
      "O parte din imaginile site-ului este livrată din stocarea Supabase — furnizorul care găzduiește baza noastră de cereri. Astfel, la vizitarea obișnuită a paginilor el vede adresa dvs. IP și tipul browserului, așa cum le vede orice server care livrează o imagine.",
      "Aceasta nu este urmărire și nu este analiză: imaginile nu numără vizitatorii și nu plasează cookie. Supabase este prestatorul nostru conform contractului, enumerat în secțiunea 5 a politicii de confidențialitate. La nicio altă adresă externă pagina nu se adresează.",
    ] },
    { h: "Ce se întâmplă când trimiteți o cerere", p: [
      'Doar în acel moment datele părăsesc browserul dvs.: cererea ajunge pe serverul nostru și în baza de date a cererilor. Ce anume se transmite, cui și pentru cât timp — în <a href="/privacy">politica de confidențialitate</a>, secțiunile 2, 5 și 6.',
      "Simpla vizitare a paginilor nu este o cerere: dacă nu ați trimis nimic, la noi rămâne doar înregistrarea tehnică a găzduirii (IP, browser, adresa paginii, ora), necesară pentru funcționarea și protecția site-ului.",
    ] },
    { h: "Cum gestionați cookie în browser", p: [
      "Chiar și acolo unde site-urile plasează cookie, ultimul cuvânt vă aparține: orice browser le poate bloca și șterge — în Chrome „Setări → Confidențialitate și securitate → Cookie-uri”, în Firefox „Setări → Confidențialitate și securitate”, în Safari „Setări → Confidențialitate”.",
      "Aceste setări nu influențează funcționarea allclean.md: site-ul nu are ce salva.",
    ] },
    { h: "Dacă ceva se va schimba", p: [
      "Apariția unui contor, a unei hărți sau a unui chat înseamnă apariția cookie-urilor. În aceeași zi pe site va apărea fereastra de consimțământ cu butoane la fel de vizibile „Accept tot” și „Refuz tot”, scripturile nu se vor mai încărca până la răspunsul dvs., iar această pagină va fi rescrisă. Promisiunea „nu plasăm nimic” are sens doar cât timp este verificabilă.",
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
