-- Доказательство согласия у каждой заявки.
--
-- Закон № 195/2024, ст. 7 ч. 1: если обработка идёт на согласии, оператор обязан
-- СУМЕТЬ ДОКАЗАТЬ, что человек его дал. Галочка на странице ничего не доказывает —
-- доказательством является запись рядом с самой заявкой: факт, момент и та редакция
-- политики, которую человек видел в этот момент.
--
-- Выполнить один раз в SQL Editor проекта Supabase — ДО выката панели: поля согласия
-- уезжают вместе с новой сборкой, и без столбцов PostgREST ответит 400.
-- Если порядок всё же перепутали, страховка в собранных страницах повторит отправку
-- заявки без этих трёх полей, чтобы обращение человека не потерялось.

alter table public.site_leads add column if not exists consent        boolean;
alter table public.site_leads add column if not exists consent_at     timestamptz;
alter table public.site_leads add column if not exists policy_version text;

comment on column public.site_leads.consent        is 'Отмечена ли галочка согласия при отправке формы';
comment on column public.site_leads.consent_at     is 'Момент согласия (UTC), проставляет браузер отправителя';
comment on column public.site_leads.policy_version is 'Редакция политики конфиденциальности, действовавшая в момент согласия (scripts/site-privacy.mjs → POLICY_VERSION)';

-- Права не меняются: анонимной роли по-прежнему разрешена только вставка,
-- чтение и правка заявок остаются за service_role (кабинет).
