// Новые страницы услуг (15.10.2026): генеральная уборка, паркет, мрамор, линолеум, фасады,
// уборка после затопления — по одной на каждое направление рекламы и поиска.
//
//     node scripts/service-pages.mjs
//
// Каждая страница собирается из соседней страницы того же типа (её вёрстка, калькулятор,
// отзывы, блоки преимуществ), меняется только своё: шапка документа, первый экран, калькулятор
// (вариант по умолчанию), вопросы и разметка для поиска. Результат пишется в зеркало
// public/import/allclean и в _pages.json — дальше страница живёт как остальные: собирается
// build-site.mjs, попадает в карту сайта с hreflang и редактируется в кабинете.
// Повторный запуск перезаписывает свои страницы и ничего больше.
//
// Цены — ставки калькуляторов клиента: генеральная 45 лей/м², паркет 250, мрамор 180,
// линолеум 60. Фасады — как в FAQ страницы мойки окон. Затопление — без цены (после осмотра).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "public", "import", "allclean");
const SITE = "https://allclean.md";

const S = [
  {
    slug: "deep-cleaning", tpl: "home-cleaning", preselect: "general", serviceType: "Deep cleaning",
    ru: {
      title: "Генеральная уборка в Кишинёве — от 45 лей/м² | All Clean",
      desc: "Генеральная уборка квартир и домов в Кишинёве: кухня, санузлы, окна, люстры. От 45 лей/м², расчёт стоимости онлайн за минуту.",
      name: "Генеральная уборка квартир и домов в Кишинёве",
      h1: ["ГЕНЕРАЛЬНАЯ", "УБОРКА", "В КИШИНЁВЕ"],
      sub: "Квартиры и дома сверху донизу: кухня, санузлы, окна, люстры и места, до которых не доходят руки. От 45 лей/м².",
      calc: "Калькулятор генеральной уборки",
      faq: [
        ["Что входит в генеральную уборку?", "Всё, что в поддерживающей: полы, пыль на доступных поверхностях, кухня и санузел. К этому добавляются мойка окон, протирание люстр и светильников, глубокая чистка кухни и санузлов. На квартиру уходит до 7 часов."],
        ["Сколько стоит генеральная уборка в Кишинёве?", "От 45 лей за м². Итог зависит от площади, числа окон, этажа и дополнительных услуг: мойки холодильника и духовки, посуды, глажки. Сумму под вашу квартиру покажет калькулятор выше."],
        ["Чем генеральная уборка отличается от поддерживающей?", 'Поддерживающая уборка занимает 3–5 часов и держит дом в порядке между большими уборками. Генеральную заказывают раз в несколько месяцев, перед праздниками, после переезда или долгого отъезда. Подробнее — в <a href="{blog}">статье о двух видах уборки</a>.'],
        ["Нужно ли покупать средства?", "Нет. Клинеры привозят все средства и инвентарь. Средства безопасны для детей и животных."],
        ["Вы убираете частные дома и в пригородах?", "Да, делаем генеральную уборку квартир и частных домов в Кишинёве и пригородах."],
      ],
    },
    ro: {
      title: "Curățenie generală în Chișinău — de la 45 lei/m² | All Clean",
      desc: "Curățenie generală în apartamente și case din Chișinău: bucătărie, băi, geamuri, lustre. De la 45 lei/m², prețul calculat online într-un minut.",
      name: "Curățenie generală în apartamente și case din Chișinău",
      h1: ["CURĂȚENIE", "GENERALĂ", "ÎN CHIȘINĂU"],
      sub: "Apartamente și case de sus până jos: bucătărie, băi, geamuri, lustre și colțurile la care nu ajungeți. De la 45 lei/m².",
      calc: "Calculator curățenie generală",
      faq: [
        ["Ce include curățenia generală?", "Tot ce include curățenia de menținere: podele, praful de pe suprafețele accesibile, bucătăria și baia. În plus spălăm geamurile, ștergem lustrele și corpurile de iluminat, curățăm în profunzime bucătăria și băile. Pentru un apartament e nevoie de până la 7 ore."],
        ["Cât costă curățenia generală în Chișinău?", "De la 45 lei pe m². Suma depinde de suprafață, numărul de geamuri, etaj și serviciile suplimentare: spălarea frigiderului și a cuptorului, a vaselor, călcatul. Prețul pentru apartamentul dvs. îl arată calculatorul de mai sus."],
        ["Prin ce diferă curățenia generală de cea de menținere?", 'Curățenia de menținere durează 3–5 ore și păstrează ordinea între curățeniile mari. Cea generală se face o dată la câteva luni, înainte de sărbători, după mutare sau după o absență lungă. Detalii în <a href="{blog}">articolul despre cele două tipuri de curățenie</a>.'],
        ["Trebuie să cumpăr produse de curățenie?", "Nu. Echipa aduce toate produsele și inventarul. Produsele sunt sigure pentru copii și animale."],
        ["Faceți curățenie și în case private din suburbii?", "Da, facem curățenie generală în apartamente și case private din Chișinău și suburbii."],
      ],
    },
  },
  {
    slug: "parquet", tpl: "floor-restoration", preselect: "parquet", serviceType: "Parquet floor restoration",
    ru: {
      title: "Циклевка паркета в Кишинёве — от 250 лей/м² | All Clean",
      desc: "Циклевка, шлифовка и лакировка паркета в Кишинёве. Восстанавливаем старые и запущенные деревянные полы, лак в 1–3 слоя. Цена онлайн.",
      name: "Циклевка и реставрация паркета в Кишинёве",
      h1: ["ЦИКЛЕВКА", "ПАРКЕТА", "В КИШИНЁВЕ"],
      sub: "Шлифуем старый паркет и деревянные полы до чистого дерева и покрываем лаком в 1–3 слоя. От 250 лей/м².",
      calc: "Калькулятор реставрации паркета",
      faq: [
        ["Что входит в реставрацию паркета?", "Циклёвка, то есть шлифовка верхнего слоя вместе со старым лаком, грязью и царапинами, и покрытие лаком в 1–3 слоя. Число слоёв выбирается в калькуляторе."],
        ["Сколько стоит циклевка паркета в Кишинёве?", "От 250 лей за м² с одним слоем лака. Второй и третий слой и запущенное состояние пола увеличивают цену. Предварительную сумму покажет калькулятор, точную назовём после осмотра."],
        ["Сколько слоёв лака нужно?", "Обычно 1–3: чем больше слоёв, тем выше износостойкость и глубже блеск. В прихожей, коридоре и на кухне, где ходят больше всего, обычно выбирают 2–3 слоя."],
        ["Можно ли восстановить очень старый паркет?", "Да. Пол в среднем и запущенном состоянии требует больше работы, это учитывается в цене. В большинстве случаев паркет удаётся вернуть без замены."],
        ["Вы работаете с другими деревянными полами?", "Да, кроме паркета восстанавливаем массивную доску и другие деревянные полы в Кишинёве и пригородах. Пришлите фото пола в заявке, и мы скажем, что с ним можно сделать."],
      ],
    },
    ro: {
      title: "Restaurare parchet Chișinău — de la 250 lei/m² | All Clean",
      desc: "Rașchetare, șlefuire și lăcuire parchet în Chișinău. Restaurăm pardoseli din lemn vechi și uzate, lac în 1–3 straturi. Prețul online.",
      name: "Rașchetare și restaurare parchet în Chișinău",
      h1: ["RESTAURARE", "PARCHET", "ÎN CHIȘINĂU"],
      sub: "Șlefuim parchetul vechi și pardoselile din lemn până la lemnul curat și le acoperim cu lac în 1–3 straturi. De la 250 lei/m².",
      calc: "Calculator restaurare parchet",
      faq: [
        ["Ce include restaurarea parchetului?", "Rașchetarea, adică șlefuirea stratului de sus împreună cu lacul vechi, murdăria și zgârieturile, și acoperirea cu lac în 1–3 straturi. Numărul de straturi se alege în calculator."],
        ["Cât costă rașchetarea parchetului în Chișinău?", "De la 250 lei pe m² cu un strat de lac. Al doilea și al treilea strat și starea uzată a pardoselii măresc prețul. Suma estimativă o arată calculatorul, prețul exact îl spunem după vizionare."],
        ["Câte straturi de lac sunt necesare?", "De obicei 1–3: cu cât mai multe straturi, cu atât parchetul rezistă mai mult și strălucește mai adânc. Pentru hol, coridor și bucătărie, unde se circulă cel mai mult, se aleg de obicei 2–3 straturi."],
        ["Se poate restaura un parchet foarte vechi?", "Da. O pardoseală în stare medie sau neglijată cere mai multă muncă, iar asta se vede în preț. În majoritatea cazurilor parchetul poate fi readus fără înlocuire."],
        ["Lucrați și cu alte pardoseli din lemn?", "Da, pe lângă parchet restaurăm dușumele din lemn masiv și alte pardoseli din lemn în Chișinău și suburbii. Trimiteți o poză a pardoselii în cerere și vă spunem ce se poate face."],
      ],
    },
  },
  {
    slug: "marble", tpl: "floor-restoration", preselect: "marble", serviceType: "Marble floor polishing",
    ru: {
      title: "Полировка мрамора в Кишинёве — от 180 лей/м² | All Clean",
      desc: "Шлифовка и полировка мраморных полов в Кишинёве: убираем царапины и матовость, возвращаем блеск и защищаем камень от износа. Цена онлайн.",
      name: "Шлифовка и полировка мрамора в Кишинёве",
      h1: ["ПОЛИРОВКА", "МРАМОРА", "В КИШИНЁВЕ"],
      sub: "Шлифуем и полируем мраморные полы: убираем царапины и матовые следы, возвращаем блеск и защищаем от износа. От 180 лей/м².",
      calc: "Калькулятор полировки мрамора",
      faq: [
        ["Что входит в восстановление мрамора?", "Шлифовка поверхности, полировка до блеска и защитная обработка. Объём зависит от состояния: свежему полу хватает полировки, поцарапанному нужна шлифовка."],
        ["Сколько стоит полировка мрамора в Кишинёве?", "От 180 лей за м². Итог зависит от площади и состояния камня, запущенный пол обходится дороже. Предварительную цену покажет калькулятор, точную назовём после осмотра."],
        ["Можно ли убрать царапины и пятна?", "Неглубокие царапины и матовость уходят при шлифовке. Глубокие сколы и въевшиеся пятна оцениваем на месте или по фото, которое можно приложить к заявке."],
        ["Где вы полируете мрамор?", "В квартирах, домах, офисах и коммерческих помещениях Кишинёва и пригородов."],
        ["Как часто нужно полировать мраморный пол?", "Зависит от нагрузки: в прихожей и холле блеск уходит быстрее. Обычно полировку повторяют раз в один-два года, а между ними хватает регулярной уборки."],
      ],
    },
    ro: {
      title: "Polizare marmură în Chișinău — de la 180 lei/m² | All Clean",
      desc: "Șlefuire și polizare pardoseli din marmură în Chișinău: îndepărtăm zgârieturile și matitatea, redăm luciul și protejăm piatra. Prețul online.",
      name: "Șlefuire și polizare marmură în Chișinău",
      h1: ["POLIZARE", "MARMURĂ", "ÎN CHIȘINĂU"],
      sub: "Șlefuim și polizăm pardoselile din marmură: îndepărtăm zgârieturile și petele mate, redăm luciul și le protejăm de uzură. De la 180 lei/m².",
      calc: "Calculator polizare marmură",
      faq: [
        ["Ce include restaurarea marmurei?", "Șlefuirea suprafeței, polizarea până la luciu și tratamentul de protecție. Volumul depinde de stare: o pardoseală nouă are nevoie doar de polizare, una zgâriată și de șlefuire."],
        ["Cât costă polizarea marmurei în Chișinău?", "De la 180 lei pe m². Suma depinde de suprafață și de starea pietrei, o pardoseală neglijată costă mai mult. Prețul estimativ îl arată calculatorul, cel exact îl spunem după vizionare."],
        ["Se pot îndepărta zgârieturile și petele?", "Zgârieturile superficiale și matitatea dispar la șlefuire. Ciobiturile adânci și petele vechi le evaluăm la fața locului sau după o poză atașată la cerere."],
        ["Unde polizați marmura?", "În apartamente, case, birouri și spații comerciale din Chișinău și suburbii."],
        ["Cât de des trebuie polizată o pardoseală din marmură?", "Depinde de trafic: în hol luciul dispare mai repede. De obicei polizarea se repetă o dată la unu-doi ani, iar între ele ajunge curățenia obișnuită."],
      ],
    },
  },
  {
    slug: "linoleum", tpl: "floor-restoration", preselect: "linoleum", serviceType: "Linoleum and rubber floor cleaning",
    ru: {
      title: "Чистка линолеума и резиновых покрытий в Кишинёве | All Clean",
      desc: "Глубокая чистка линолеума и резиновых полов в Кишинёве, восстановление блеска и защитное покрытие. Квартиры, офисы, магазины. От 60 лей/м².",
      name: "Чистка и защита линолеума и резиновых покрытий в Кишинёве",
      h1: ["ЧИСТКА", "ЛИНОЛЕУМА", "В КИШИНЁВЕ"],
      sub: "Глубоко чистим линолеум и резиновые покрытия, возвращаем блеск и наносим защитный слой. От 60 лей/м².",
      calc: "Калькулятор чистки линолеума",
      faq: [
        ["Какие покрытия вы чистите?", "Бытовой и коммерческий линолеум, резиновые и ПВХ-покрытия в квартирах, офисах, магазинах и спортивных залах."],
        ["Зачем нужно защитное покрытие?", "Защитный слой закрывает поры покрытия: грязь меньше въедается, пол проще мыть, а блеск держится дольше."],
        ["Сколько стоит чистка линолеума?", "От 60 лей за м². Цена зависит от площади и состояния пола. Предварительную сумму покажет калькулятор выше."],
        ["Можно ли вернуть вид старому линолеуму?", "Въевшуюся грязь и потускнение убираем, блеск возвращаем. Порезы, вздутия и стёртый рисунок чистка не исправит, в таких случаях покрытие честнее заменить."],
        ["Можете работать в нерабочее время?", "Да, в офисах и магазинах подстраиваемся под график и можем работать рано утром или вечером."],
      ],
    },
    ro: {
      title: "Curățare linoleum și pardoseli din cauciuc | All Clean",
      desc: "Curățare profundă a linoleumului și a pardoselilor din cauciuc în Chișinău, redarea luciului și strat de protecție. De la 60 lei/m².",
      name: "Curățare și protecție linoleum și pardoseli din cauciuc în Chișinău",
      h1: ["CURĂȚARE", "LINOLEUM", "ÎN CHIȘINĂU"],
      sub: "Curățăm în profunzime linoleumul și pardoselile din cauciuc, redăm luciul și aplicăm un strat de protecție. De la 60 lei/m².",
      calc: "Calculator curățare linoleum",
      faq: [
        ["Ce pardoseli curățați?", "Linoleum casnic și comercial, pardoseli din cauciuc și PVC în apartamente, birouri, magazine și săli de sport."],
        ["La ce folosește stratul de protecție?", "Stratul de protecție închide porii pardoselii: murdăria pătrunde mai greu, podeaua se spală mai ușor, iar luciul ține mai mult."],
        ["Cât costă curățarea linoleumului?", "De la 60 lei pe m². Prețul depinde de suprafață și de starea pardoselii. Suma estimativă o arată calculatorul de mai sus."],
        ["Se poate reda aspectul unui linoleum vechi?", "Murdăria veche și matitatea le îndepărtăm, luciul îl redăm. Tăieturile, umflăturile și desenul șters nu dispar la curățare, în astfel de cazuri e mai cinstit să schimbați pardoseala."],
        ["Puteți lucra în afara orelor de program?", "Da, în birouri și magazine ne adaptăm la program și putem lucra dimineața devreme sau seara."],
      ],
    },
  },
  {
    slug: "facades", tpl: "windows", preselect: "facade", serviceType: "Facade cleaning",
    ru: {
      title: "Мойка фасадов и витрин в Кишинёве — цена | All Clean",
      desc: "Мойка стеклянных фасадов, витражей, витрин и фасадов Etalbond в Кишинёве. Работы на высоте, при необходимости с автовышкой. Бесплатный выезд на оценку.",
      name: "Мойка фасадов и витрин в Кишинёве",
      h1: ["МОЙКА", "ФАСАДОВ", "В КИШИНЁВЕ"],
      sub: "Стеклянные фасады, витражи, витрины магазинов и фасады Etalbond. Работаем на высоте, при необходимости с автовышкой.",
      calc: "Калькулятор мойки фасадов",
      faq: [
        ["Какие фасады вы моете?", "Стеклянные фасады и витражи, витрины магазинов, композитные фасады Etalbond."],
        ["Как вы моете на высоте?", "Используем специальное оборудование, при необходимости автовышку. Доступ и высота учитываются в цене."],
        ["Сколько стоит мойка фасада?", "Стеклянные фасады — от 35 лей/м², витражи — от 40 лей/м². Для больших площадей и регулярной мойки действуют скидки."],
        ["Нужен ли выезд для оценки?", "Да. Мы бесплатно выезжаем на объект и оцениваем объём работ."],
        ["Можно ли мыть фасад регулярно?", "Да, для магазинов и офисов моем фасады и витрины по согласованному графику. Чем чаще мойка, тем ниже цена за выезд."],
      ],
    },
    ro: {
      title: "Spălare fațade și vitrine în Chișinău — preț | All Clean",
      desc: "Spălare fațade din sticlă, vitralii, vitrine și fațade Etalbond în Chișinău. Lucrări la înălțime, la nevoie cu autoplatformă. Evaluare gratuită.",
      name: "Spălare fațade și vitrine în Chișinău",
      h1: ["SPĂLARE", "FAȚADE", "ÎN CHIȘINĂU"],
      sub: "Fațade din sticlă, vitralii, vitrine de magazin și fațade Etalbond. Lucrăm la înălțime, la nevoie cu autoplatformă.",
      calc: "Calculator spălare fațade",
      faq: [
        ["Ce fațade spălați?", "Fațade din sticlă și vitralii, vitrine de magazin, fațade compozite Etalbond."],
        ["Cum spălați la înălțime?", "Folosim echipament special, la nevoie autoplatformă. Accesul și înălțimea se iau în calcul la preț."],
        ["Cât costă spălarea unei fațade?", "Fațade din sticlă — de la 35 lei/m², vitralii — de la 40 lei/m². Pentru suprafețe mari și spălare regulată avem reduceri."],
        ["E nevoie de o deplasare pentru evaluare?", "Da. Venim gratuit la obiect și evaluăm volumul lucrărilor."],
        ["Se poate spăla fațada regulat?", "Da, pentru magazine și birouri spălăm fațadele și vitrinele după un grafic stabilit împreună. Cu cât mai des, cu atât mai mic prețul pe deplasare."],
      ],
    },
  },
  {
    slug: "flood-cleanup", tpl: "disinfection", serviceType: "Water damage cleanup", flood: true,
    ru: {
      title: "Уборка после затопления и прорыва канализации | All Clean",
      desc: "Срочная уборка и дезинфекция после затопления и прорыва канализации в Кишинёве: убираем грязь и нечистоты, моем, дезинфицируем, устраняем запах.",
      name: "Уборка и дезинфекция после затопления и прорыва канализации в Кишинёве",
      h1: ["УБОРКА", "ПОСЛЕ", "ЗАТОПЛЕНИЯ", "В КИШИНЁВЕ"],
      sub: "Убираем грязь и нечистоты после прорыва канализации или потопа, моем и дезинфицируем поверхности, помогаем убрать запах.",
      calc: "Заявка на уборку после затопления",
      faq: [
        ["Что вы делаете после прорыва канализации?", "Убираем грязь, нечистоты и мокрый мусор, моем полы, стены и мебель, дезинфицируем поверхности и помогаем устранить запах."],
        ["Вы ремонтируете канализацию?", "Нет. Сначала перекройте воду и вызовите сантехника или аварийную службу, чтобы остановить утечку. Мы приезжаем убирать последствия."],
        ["Как быстро вы приедете?", "Позвоните или напишите в WhatsApp: договоримся о самом раннем времени выезда."],
        ["Сколько стоит уборка после затопления?", "Цена зависит от площади, степени загрязнения и того, нужна ли дезинфекция. Назовём её после осмотра или по фото: приложите их к заявке или пришлите в мессенджер."],
        ["Опасны ли последствия для здоровья?", "Сточные воды содержат бактерии, поэтому после уборки нужна дезинфекция поверхностей, одной мойки мало. Детей и животных лучше не пускать в помещение до конца работ."],
      ],
      opts: { type: ["Объект", [["flat", "Квартира или дом"], ["basement", "Подвал"], ["office", "Офис или магазин"]]],
              level: ["Объём работ", [["wash", "Уборка и мойка"], ["disinfect", "Уборка и дезинфекция"], ["full", "Уборка, дезинфекция, удаление запаха"]]],
              freq: ["Срочность", [["urgent", "Срочно"], ["planned", "Можно запланировать"]]] },
      priceLabel: "Стоимость", noPrice: "после осмотра", note: "Цену назовём после осмотра или по фото.",
    },
    ro: {
      title: "Curățenie după inundație și avarie la canalizare | All Clean",
      desc: "Curățenie și dezinfectare urgentă după inundație și avarie la canalizare în Chișinău: îndepărtăm murdăria, spălăm, dezinfectăm, eliminăm mirosul.",
      name: "Curățenie și dezinfectare după inundație și avarie la canalizare în Chișinău",
      h1: ["CURĂȚENIE", "DUPĂ", "INUNDAȚIE", "ÎN CHIȘINĂU"],
      sub: "Îndepărtăm murdăria și apele uzate după o avarie la canalizare sau o inundație, spălăm și dezinfectăm suprafețele, ajutăm la eliminarea mirosului.",
      calc: "Cerere de curățenie după inundație",
      faq: [
        ["Ce faceți după o avarie la canalizare?", "Îndepărtăm murdăria, apele uzate și gunoiul ud, spălăm podelele, pereții și mobila, dezinfectăm suprafețele și ajutăm la eliminarea mirosului."],
        ["Reparați canalizarea?", "Nu. Mai întâi închideți apa și chemați un instalator sau serviciul de avarii, ca să opriți scurgerea. Noi venim să curățăm urmările."],
        ["Cât de repede veniți?", "Sunați sau scrieți pe WhatsApp: stabilim cel mai apropiat timp de deplasare."],
        ["Cât costă curățenia după inundație?", "Prețul depinde de suprafață, de gradul de murdărie și de nevoia de dezinfectare. Îl spunem după vizionare sau după poze: atașați-le la cerere sau trimiteți-le pe messenger."],
        ["Sunt urmările periculoase pentru sănătate?", "Apele uzate conțin bacterii, așa că după curățenie suprafețele trebuie dezinfectate, simpla spălare nu ajunge. Copiii și animalele e mai bine să nu intre în încăpere până la finalul lucrărilor."],
      ],
      opts: { type: ["Obiectul", [["flat", "Apartament sau casă"], ["basement", "Subsol"], ["office", "Birou sau magazin"]]],
              level: ["Volumul lucrărilor", [["wash", "Curățenie și spălare"], ["disinfect", "Curățenie și dezinfectare"], ["full", "Curățenie, dezinfectare, eliminarea mirosului"]]],
              freq: ["Urgența", [["urgent", "Urgent"], ["planned", "Se poate planifica"]]] },
      priceLabel: "Prețul", noPrice: "după vizionare", note: "Prețul îl spunem după vizionare sau după poze.",
    },
  },
];

const BLOG = { ru: "/ru/blog/generalnaya-i-podderzhivayushchaya-uborka-chem-otlichayutsya",
               ro: "/blog/curatenia-generala-si-cea-de-mentinere-care-sunt-diferentele" };
const HOME = { ru: "Главная", ro: "Acasă" }, SERVICES = { ru: "Услуги", ro: "Servicii" };

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (s) => esc(s).replace(/"/g, "&quot;");
const plain = (s) => String(s).replace(/<[^>]+>/g, "");
const path = (lang, slug) => (lang === "ru" ? "/ru" : "") + "/services/" + slug;
const fileOf = (lang, slug) => (lang === "ru" ? "ru__" : "") + "services__" + slug;
const idOf = (lang, slug) => path(lang, slug).slice(1) + "/index.html";

/** Конец элемента, открытого в `start`, по балансу тегов `tag`. */
function end(html, start, tag = "div") {
  const re = new RegExp(`<(\\/?)${tag}\\b[^>]*>`, "g");
  re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(html))) { depth += m[1] ? -1 : 1; if (!depth) return re.lastIndex; }
  throw new Error("незакрытый " + tag);
}
function must(html, needle, what) {
  const i = html.indexOf(needle);
  if (i < 0) throw new Error(`не найден якорь «${what}»`);
  return i;
}
function sub(html, re, to, what) {
  if (!re.test(html)) throw new Error(`не найден якорь «${what}»`);
  return html.replace(re, to);
}

function head(prefix, svc, lang, t) {
  const url = SITE + path(lang, svc.slug);
  const ru = SITE + path("ru", svc.slug), ro = SITE + path("ro", svc.slug);
  let h = prefix;
  h = sub(h, /<title>[\s\S]*?<\/title>/, `<title>${esc(t.title)}</title>`, "title");
  h = sub(h, /(name="description" content=")[^"]*/, `$1${attr(t.desc)}`, "description");
  h = sub(h, /(rel="canonical" href=")[^"]*/, `$1${url}`, "canonical");
  h = sub(h, /(hreflang="ru-MD" href=")[^"]*/, `$1${ru}`, "hreflang ru");
  h = sub(h, /(hreflang="ro-MD" href=")[^"]*/, `$1${ro}`, "hreflang ro");
  h = sub(h, /(hreflang="x-default" href=")[^"]*/, `$1${ro}`, "hreflang x");
  for (const k of ["og:title", "twitter:title"]) h = sub(h, new RegExp(`((?:property|name)="${k}" content=")[^"]*`), `$1${attr(t.title)}`, k);
  for (const k of ["og:description", "twitter:description"]) h = sub(h, new RegExp(`((?:property|name)="${k}" content=")[^"]*`), `$1${attr(t.desc)}`, k);
  h = sub(h, /(property="og:url" content=")[^"]*/, `$1${url}`, "og:url");
  // Разметка услуги: Service + FAQPage + BreadcrumbList — блок с @graph.
  h = sub(h, /(<script type="application\/ld\+json">)(\{"@context":"https:\/\/schema\.org","@graph"[\s\S]*?)(<\/script>)/, (m, open, json, close) => {
    const g = JSON.parse(json)["@graph"];
    const service = g.find((x) => x["@type"] === "Service");
    const graph = [
      { ...service, name: t.name, description: plain(t.desc), serviceType: svc.serviceType, url },
      { "@type": "FAQPage", mainEntity: t.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: plain(a.replace("{blog}", "")) } })) },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: HOME[lang], item: SITE + (lang === "ru" ? "/ru" : "/") },
        { "@type": "ListItem", position: 2, name: SERVICES[lang], item: SITE + (lang === "ru" ? "/ru" : "") + "/services" },
        { "@type": "ListItem", position: 3, name: t.name, item: url },
      ] },
    ];
    return open + JSON.stringify({ "@context": "https://schema.org", "@graph": graph }) + close;
  }, "ld+json @graph");
  return h;
}

function hero(html, svc, lang, t, oldH1) {
  const lines = t.h1.map((l) => `<div class="heading-style-h1">${esc(l).replace(/ /g, "&nbsp;")}</div>`).join("");
  html = sub(html, /(<h1 id="" class="heading_hero-home">)[\s\S]*?(<\/h1>)/, `$1 ${lines} $2`, "h1");
  html = sub(html, /(<h2 class="text-size-large margin-0 hero-home_sub">)[\s\S]*?(<\/h2>)/, `$1${esc(t.sub)}$2`, "подзаголовок");
  // У иконок мессенджеров в первом экране alt = заголовок страницы (scripts/fix-seo.mjs).
  return html.split(`alt="${oldH1}"`).join(`alt="${attr(t.h1.join(" "))}"`);
}

function faq(html, lang, t) {
  const blockStart = must(html, 'class="faq-block svc-faq"', "faq-block");
  const open = html.lastIndexOf("<div", blockStart);
  const close = end(html, open);
  const inner0 = html.indexOf(">", open) + 1;
  const itemStart = must(html.slice(inner0), '<div class="expandable-single"', "вопрос") + inner0;
  const item = html.slice(itemStart, end(html, itemStart));
  const items = t.faq.map(([q, a]) => item
    .replace(/(<div class="text-size-large text_body-bold"[^>]*>)[\s\S]*?(<\/div>)/, `$1${esc(q)}$2`)
    .replace(/(<p class="faq-paragraph"[^>]*>)[\s\S]*?(<\/p>)/, `$1${a.replace("{blog}", BLOG[lang])}$2`)).join("");
  return html.slice(0, inner0) + " " + items + " " + html.slice(close - "</div>".length);
}

/** Вариант по умолчанию калькулятора: первым в списке и в карточках первого шага. */
function preselect(html, value) {
  const cfgRe = /(<script type="application\/json"[^>]*>)([\s\S]*?)(<\/script>)/;
  html = sub(html, cfgRe, (m, a, json, c) => {
    const cfg = JSON.parse(json);
    const f = cfg.fields[0];
    const i = f.options.findIndex((o) => o.value === value);
    if (i < 0) throw new Error("нет варианта " + value);
    f.options.unshift(...f.options.splice(i, 1));
    return a + JSON.stringify(cfg) + c;
  }, "конфиг калькулятора");
  const cardsAt = must(html, 'class="calc-cards"', "карточки калькулятора");
  const open = html.lastIndexOf("<div", cardsAt), close = end(html, open);
  const box = html.slice(open, close);
  const buttons = [...box.matchAll(/<button type="button" class="calc-card(?: on)?" data-val="([^"]+)"[\s\S]*?<\/button>/g)];
  const first = buttons.find((b) => b[1] === value);
  if (!first) throw new Error("нет карточки " + value);
  const ordered = [first, ...buttons.filter((b) => b !== first)]
    .map((b, i) => b[0].replace(/class="calc-card(?: on)?"/, i ? 'class="calc-card"' : 'class="calc-card on"')).join("");
  const boxOut = box.slice(0, buttons[0].index) + ordered + box.slice(buttons[buttons.length - 1].index + buttons[buttons.length - 1][0].length);
  return html.slice(0, open) + boxOut + html.slice(close);
}

/** Затопление: калькулятор дезинфекции с другими вариантами и без цены («после осмотра»). */
function floodCalc(html, lang, t, svc) {
  html = sub(html, /(<script type="application\/json"[^>]*>)([\s\S]*?)(<\/script>)/, (m, a, json, c) => {
    const cfg = JSON.parse(json);
    for (const f of cfg.fields) {
      const o = t.opts[f.key];
      if (f.key === "area") Object.assign(f, { min: 5, step: 5, default: 50 });
      if (!o) continue;
      // Без ставок и доплат: цену называют после осмотра, в окне выбора не должно быть «+1 000 MDL».
      f.label = { ro: svc.ro.opts[f.key][0], ru: svc.ru.opts[f.key][0] };
      f.options = o[1].map(([value], i) => ({ value, label: { ro: svc.ro.opts[f.key][1][i][1], ru: svc.ru.opts[f.key][1][i][1] } }));
      delete f.affects;
    }
    cfg.minPrice = 0;
    cfg.noPrice = t.noPrice;
    return a + JSON.stringify(cfg) + c;
  }, "конфиг калькулятора");
  // Карточки первого шага (тип объекта) и названия плиток — статичная разметка.
  const typeOld = ["food", "cold", "storage"];
  t.opts.type[1].forEach(([value, label], i) => {
    html = sub(html, new RegExp(`(data-val=")${typeOld[i]}("[\\s\\S]*?<span class="calc-card-label"[^>]*>)[\\s\\S]*?(<\\/span>)`), `$1${value}$2${esc(label)}$3`, "карточка " + typeOld[i]);
  });
  html = sub(html, /(<h3 class="calc-step-title"[^>]*>)[^<]*(<\/h3>)/, `$1${esc(t.opts.type[0])}$2`, "шаг 1");
  html = sub(html, /(<span class="calc-tile-name"[^>]*>)[^<]*(<\/span>)([\s\S]*?<span class="calc-tile-name"[^>]*>)[^<]*(<\/span>)/,
    `$1${esc(t.opts.level[0])}$2$3${esc(t.opts.freq[0])}$4`, "плитки");
  html = sub(html, /(<div class="calc-side-label"[^>]*>)[^<]*(<\/div>)/, `$1${esc(t.priceLabel)}$2`, "подпись цены");
  html = sub(html, /(<span id="calc-price"[^>]*>)[^<]*(<\/span>)/, `$1${esc(t.noPrice)}$2`, "цена");
  html = sub(html, /\s*<span class="calc-cur"[^>]*>MDL<\/span>/, "", "валюта");
  html = sub(html, /(<p class="calc-side-note"[^>]*>)[^<]*(<\/p>)/, `$1${esc(t.note)}$2`, "примечание");
  html = sub(html, /function priceText\(\) \{/, "function priceText() { if (cfg.noPrice) return cfg.noPrice;", "priceText");
  html = sub(html, /estimate: compute\(\) \+ ' MDL'/, "estimate: priceText()", "смета в заявке");
  return html;
}

function calc(html, svc, lang, t) {
  html = sub(html, /(<div class="calc-head"[^>]*><h2[^>]*>)[^<]*(<\/h2>)/, `$1${esc(t.calc)}$2`, "заголовок калькулятора");
  html = sub(html, /const slug = "[^"]*";/, `const slug = "${svc.slug}";`, "слаг калькулятора");
  if (svc.flood) return floodCalc(html, lang, t, svc);
  return svc.preselect ? preselect(html, svc.preselect) : html;
}

function build() {
  const idxPath = join(DIR, "_pages.json");
  const idx = JSON.parse(readFileSync(idxPath, "utf8"));
  const made = [];
  for (const svc of S) {
    for (const lang of ["ro", "ru"]) {
      const t = svc[lang];
      const tplFile = fileOf(lang, svc.tpl);
      const page = JSON.parse(readFileSync(join(DIR, tplFile + ".json"), "utf8"));
      const tplEntry = idx.pages.find((p) => p.file === tplFile);
      const oldH1 = (page.blocks.find((b) => b.id === "sec-0").content.html.match(/alt="([^"]+)"/) || [])[1] || "";
      const pair = path(lang === "ru" ? "ro" : "ru", svc.slug);
      Object.assign(page, {
        id: idOf(lang, svc.slug), slug: path(lang, svc.slug), group: path("ru", svc.slug),
        meta: { title: t.title, description: t.desc },
        prefix: head(page.prefix, svc, lang, t),
      });
      for (const b of page.blocks) {
        let h = b.content.html;
        // Переключатель языка ведёт на пару этой страницы, а не шаблона (он есть в шапке
        // и в мобильном меню, которое лежит в блоке подвала).
        if (b.id === "sec-header" || b.id === "sec-footer") {
          h = sub(h, /(<a[^>]*href=")[^"]*("[^>]*class="[^"]*lang-toggle)/g, `$1${pair}$2`, "переключатель языка");
        }
        if (b.id === "sec-0") h = hero(h, svc, lang, t, oldH1);
        if (b.id === "sec-0" && svc.flood) {
          h = sub(h, /(href="#calc-section"[\s\S]*?<div button-text="" class="text-button">)[^<]*(<\/div>)/, `$1 ${lang === "ru" ? "Оставить заявку" : "Lăsați o cerere"} $2`, "кнопка заявки");
        }
        if (b.id === "sec-3") h = calc(h, svc, lang, t);
        if (b.id === "sec-6") h = faq(h, lang, t);
        b.content = { ...b.content, html: h };
      }
      writeFileSync(join(DIR, fileOf(lang, svc.slug) + ".json"), JSON.stringify(page));
      const entry = { ...tplEntry, id: page.id, file: fileOf(lang, svc.slug), slug: page.slug, group: page.group, title: t.title };
      const at = idx.pages.findIndex((p) => p.id === entry.id);
      if (at >= 0) idx.pages[at] = entry; else idx.pages.push(entry);
      made.push(page.slug);
    }
  }
  writeFileSync(idxPath, JSON.stringify(idx, null, 2) + "\n");
  console.log(`[service-pages] ${made.length} страниц: ${made.join(" ")}`);
  links(idx);
}

// ── Перелинковка существующих страниц ──────────────────────────────────────────────────
// Новые страницы должны получать ссылки с близких по теме: без них поиск считает их
// второстепенными. Всё идемпотентно: повторный запуск ничего не удваивает.
const a = (href, text) => `<a href="${href}">${text}</a>`;
const LINKS = {
  // Реставрация полов → паркет, линолеум, мрамор (первый экран).
  "services__floor-restoration": [["sec-0", "Restaurare parchet, linoleum și&nbsp;marmură.",
    `Restaurare ${a("/services/parquet", "parchet")}, ${a("/services/linoleum", "linoleum")} și&nbsp;${a("/services/marble", "marmură")}.`]],
  "ru__services__floor-restoration": [["sec-0", "Реставрация паркета, линолеума и&nbsp;мрамора.",
    `Реставрация ${a("/ru/services/parquet", "паркета")}, ${a("/ru/services/linoleum", "линолеума")} и&nbsp;${a("/ru/services/marble", "мрамора")}.`]],
  // Мойка окон → фасады (ответ про цены).
  "services__windows": [["sec-6", "fațade din&nbsp;sticlă&nbsp;— de&nbsp;la&nbsp;35&nbsp;lei/m².",
    `fațade din&nbsp;sticlă&nbsp;— de&nbsp;la&nbsp;35&nbsp;lei/m² (detalii pe&nbsp;pagina ${a("/services/facades", "spălare fațade")}).`]],
  "ru__services__windows": [["sec-6", "стеклянные фасады&nbsp;— от&nbsp;35&nbsp;лей/м².",
    `стеклянные фасады&nbsp;— от&nbsp;35&nbsp;лей/м² (подробнее на&nbsp;странице ${a("/ru/services/facades", "мойки фасадов")}).`]],
  // Уборка квартир → генеральная (ответ «что входит»).
  "services__home-cleaning": [["sec-6", "Curățenia generală (până la&nbsp;7&nbsp;ore)",
    `${a("/services/deep-cleaning", "Curățenia generală")} (până la&nbsp;7&nbsp;ore)`]],
  "ru__services__home-cleaning": [["sec-6", "Генеральная уборка (до&nbsp;7&nbsp;часов)",
    `${a("/ru/services/deep-cleaning", "Генеральная уборка")} (до&nbsp;7&nbsp;часов)`]],
};

function links(idx) {
  let n = 0;
  for (const entry of idx.pages) {
    const file = join(DIR, entry.file + ".json");
    const page = JSON.parse(readFileSync(file, "utf8"));
    let changed = false;
    for (const b of page.blocks) {
      let h = b.content.html;
      // Пункт меню «Генеральная уборка» вёл на общую страницу уборки квартир.
      if (b.id === "sec-header") {
        h = h.replace(/<a\b([^>]*?)href="(\/ru)?\/services\/home-cleaning"([^>]*)>([\s\S]*?)<\/a>/g, (m, pre, ru, post, inner) =>
          /Генеральная уборка|Curățenie generală/.test(inner) ? `<a${pre}href="${ru || ""}/services/deep-cleaning"${post}>${inner}</a>` : m);
      }
      for (const [block, from, to] of LINKS[entry.file] || []) {
        if (b.id !== block || h.includes(to)) continue;
        if (!h.includes(from)) throw new Error(`перелинковка: нет якоря в ${entry.file} ${block}`);
        h = h.replace(from, to);
      }
      if (TRUST_PAGES.test(entry.file) && h.includes('class="faq-block')) h = appendFaq(h, TRUST[entry.lang]);
      if (h !== b.content.html) { b.content = { ...b.content, html: h }; changed = true; }
    }
    if (changed) { writeFileSync(file, JSON.stringify(page)); n++; }
  }
  console.log(`[service-pages] перелинковка: ${n} страниц`);
}

// ── Гарантия и часы работы на посадочных ──────────────────────────────────────────────
// Реклама обещает переуборку за 24 часа, работу с 8 до 21 и бесплатный перенос. По правилам
// Google обещание должно быть видно на странице, куда ведёт объявление, а было только на /faq.
// Формулировки — клиента, со страницы вопросов. Главная тоже посадочная (общие группы).
const TRUST_PAGES = /^(ru__)?services__|^(index|ru)$/;
export const TRUST = {
  ru: [
    ["Что если меня не устроит качество уборки?", "Свяжитесь с нами в течение 24 часов — бесплатно отправим клинера повторно, без лишних вопросов."],
    ["Когда вы работаете и можно ли перенести визит?", "Работаем ежедневно с 8:00 до 21:00. Перенести или отменить запись можно бесплатно не позднее чем за 24 часа до визита."],
  ],
  ro: [
    ["Ce fac dacă nu sunt mulțumit de calitatea curățeniei?", "Contactați-ne în 24 de ore — trimitem gratuit un curățător din nou, fără întrebări."],
    ["Când lucrați și pot reprograma vizita?", "Lucrăm zilnic între 8:00 și 21:00. Puteți reprograma sau anula gratuit cu cel puțin 24 de ore înainte de vizită."],
  ],
};

/** Дописать вопросы в конец списка FAQ по образцу первого вопроса; уже имеющиеся пропустить. */
export function appendFaq(html, items) {
  const at = html.indexOf('class="faq-block');
  const open = html.lastIndexOf("<div", at), close = end(html, open);
  const first = html.indexOf('<div class="expandable-single', open);
  if (first < 0 || first > close) return html;
  // Образец без служебных атрибутов редактора: холст расставит свои.
  const tpl = html.slice(first, end(html, first)).replace(/\s(?:data-lg-[a-z0-9-]+|contenteditable|spellcheck)="[^"]*"/g, "");
  const text = html.slice(open, close).replace(/<[^>]+>|&nbsp;/g, " ").replace(/\s+/g, " ");
  const add = items.filter(([q]) => !text.includes(q)).map(([q, a]) => tpl
    .replace(/(<div class="text-size-large text_body-bold"[^>]*>)[\s\S]*?(<\/div>)/, `$1${esc(q)}$2`)
    .replace(/(<p class="faq-paragraph"[^>]*>)[\s\S]*?(<\/p>)/, `$1${esc(a)}$2`)).join("");
  if (!add) return html;
  const inner = close - "</div>".length;
  return html.slice(0, inner) + add + html.slice(inner);
}

if (process.argv[1] && process.argv[1].endsWith("service-pages.mjs")) build();
