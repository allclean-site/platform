-- Доказательство согласия у каждой заявки.
--
-- Закон № 195/2024, ст. 7 ч. 1: если обработка идёт на согласии, оператор обязан
-- СУМЕТЬ ДОКАЗАТЬ, что человек его дал. Галочка на странице ничего не доказывает —
-- доказательством является запись рядом с самой заявкой: факт, момент и та редакция
-- политики, которую человек видел в этот момент.
--
-- Применить один раз в SQL Editor проекта Supabase (клиентский проект AllClean),
-- затем не забыть выполнить и на агентском инстансе, если сайт временно смотрит туда.
-- До применения сайт продолжает работать: клиентский код повторяет вставку без
-- этих столбцов, если база их ещё не знает.

alter table public.site_leads add column if not exists consent        boolean;
alter table public.site_leads add column if not exists consent_at     timestamptz;
alter table public.site_leads add column if not exists policy_version text;

comment on column public.site_leads.consent        is 'Отмечена ли галочка согласия при отправке формы';
comment on column public.site_leads.consent_at     is 'Момент согласия (UTC), проставляет браузер отправителя';
comment on column public.site_leads.policy_version is 'Редакция политики конфиденциальности, действовавшая в момент согласия (src/lib/legal.ts → POLICY_VERSION)';

-- Права не меняются: анонимной роли по-прежнему разрешена только вставка,
-- чтение и правка заявок остаются за service_role (кабинет).
