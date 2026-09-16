/**
 * Banco inteiro do Autochat.
 *
 * Roda na primeira abertura do painel (tela /configurar) e pode rodar de
 * novo sem estragar nada: tudo e "if not exists" ou "create or replace".
 * Quando o sistema ganhar tabela ou coluna nova, acrescente aqui, sempre
 * no mesmo estilo, e suba ESQUEMA_VERSAO.
 *
 * Fica num .ts, e nao num .sql solto, para ir junto no pacote da Vercel.
 */

export const ESQUEMA_VERSAO = 2

export const ESQUEMA = `
create extension if not exists pgcrypto;
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------- acesso ao painel (1 linha so) ----------
create table if not exists painel_acesso (
  id          int primary key default 1 check (id = 1),
  nome        text not null,
  email       text not null,
  senha_hash  text not null,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists instalacao (
  id              int primary key default 1 check (id = 1),
  esquema_versao  int not null,
  endereco        text,
  atualizado_em   timestamptz not null default now()
);

-- ---------- chaves do aplicativo da Meta (1 linha so) ----------
-- Coladas pelo dono no Assistente da Meta. Instagram e Facebook tem ID e
-- segredo diferentes, mesmo no mesmo app.
create table if not exists meta_app (
  id                  int primary key default 1 check (id = 1),
  ig_app_id           text,
  ig_app_secret       text,
  fb_app_id           text,
  fb_app_secret       text,
  fb_login_config_id  text,
  atualizado_em       timestamptz not null default now()
);

-- ---------- conta do Instagram conectada (1 linha so) ----------
create table if not exists ig_account (
  id                 int primary key default 1 check (id = 1),
  ig_user_id         text not null,
  username           text,
  access_token       text not null,
  token_expires_at   timestamptz,
  webhook_subscribed boolean not null default false,
  connected_at       timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ---------- Pagina do Facebook conectada (1 linha so) ----------
create table if not exists fb_page (
  id                 int primary key default 1 check (id = 1),
  page_id            text not null,
  name               text,
  access_token       text not null,
  webhook_subscribed boolean not null default false,
  connected_at       timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ---------- automacoes ----------
create table if not exists automations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  keywords            text[] not null default '{}',
  match_mode          text not null default 'contains'
                        check (match_mode in ('contains','exact')),
  media_id            text,
  comment_reply_text  text,
  dm_text             text not null default '',
  button_label        text,
  button_url          text,
  once_per_user       boolean not null default true,
  active              boolean not null default true,
  sent_count          int not null default 0,
  steps               jsonb not null default '[]'::jsonb,
  channels            text[] not null default array['instagram'],
  fb_post_id          text,
  fb_steps            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'automations_channels_validos') then
    alter table automations add constraint automations_channels_validos
      check (cardinality(channels) > 0 and channels <@ array['instagram','facebook']);
  end if;
end $$;

create index if not exists automations_active_idx on automations (active) where active;

-- ---------- contatos ----------
create table if not exists contacts (
  ig_user_id     text primary key,
  username       text,
  name           text,
  channel        text not null default 'instagram' check (channel in ('instagram','facebook')),
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  dm_count       int not null default 0
);

-- ---------- fila de envio ----------
create table if not exists send_queue (
  id              uuid primary key default gen_random_uuid(),
  automation_id   uuid references automations(id) on delete cascade,
  recipient_id    text not null,
  comment_id      text,
  media_id        text,
  kind            text not null default 'private_reply'
                    check (kind in ('private_reply','dm')),
  status          text not null default 'pending'
                    check (status in ('pending','sending','sent','failed','skipped')),
  attempts        int not null default 0,
  last_error      text,
  step_index      int not null default 0,
  cycle           int not null default 1,
  channel         text not null default 'instagram' check (channel in ('instagram','facebook')),
  scheduled_for   timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);

-- TRAVA 1: o mesmo comentario nunca entra na fila duas vezes.
create unique index if not exists send_queue_comment_uniq
  on send_queue (comment_id) where comment_id is not null;

-- TRAVA 2: no mesmo ciclo e canal, a mesma etapa nao sai duas vezes para a
-- mesma pessoa. Comentario novo abre ciclo novo.
create unique index if not exists send_queue_step_canal_uniq
  on send_queue (channel, automation_id, recipient_id, step_index, cycle);

create index if not exists send_queue_pending_idx
  on send_queue (status, scheduled_for) where status = 'pending';

create index if not exists send_queue_sent_at_idx
  on send_queue (sent_at) where status = 'sent';

-- ---------- registro de eventos ----------
create table if not exists event_log (
  id          bigserial primary key,
  level       text not null default 'info' check (level in ('info','warn','error')),
  source      text not null,
  message     text,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists event_log_created_idx on event_log (created_at desc);

-- ---------- links rastreaveis ----------
create table if not exists links (
  code           text primary key,
  automation_id  uuid references automations(id) on delete cascade,
  step_index     int  not null default 0,
  recipient_id   text,
  url            text not null,
  channel        text not null default 'instagram' check (channel in ('instagram','facebook')),
  created_at     timestamptz not null default now()
);

create index if not exists links_automation_idx on links (automation_id, created_at desc);

create table if not exists link_clicks (
  id          bigserial primary key,
  code        text references links(code) on delete cascade,
  clicked_at  timestamptz not null default now(),
  user_agent  text
);

create index if not exists link_clicks_code_idx on link_clicks (code);
create index if not exists link_clicks_at_idx   on link_clicks (clicked_at desc);

-- ---------- seguidores por dia ----------
create table if not exists follower_snapshots (
  day          date primary key,
  followers    int  not null,
  captured_at  timestamptz not null default now()
);

-- ---------- seguranca ----------
-- RLS ligado e nenhuma policy: pela chave publica ninguem le nada.
-- So a chave de servico, usada apenas no servidor, enxerga as tabelas.
alter table painel_acesso      enable row level security;
alter table instalacao         enable row level security;
alter table meta_app           enable row level security;
alter table ig_account         enable row level security;
alter table fb_page            enable row level security;
alter table automations        enable row level security;
alter table contacts           enable row level security;
alter table send_queue         enable row level security;
alter table event_log          enable row level security;
alter table links              enable row level security;
alter table link_clicks        enable row level security;
alter table follower_snapshots enable row level security;

-- Projeto novo pode nascer sem expor tabelas: a chave de servico ignora RLS,
-- mas nao ignora GRANT.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ---------- updated_at automatico ----------
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists automations_touch on automations;
create trigger automations_touch before update on automations
  for each row execute function touch_updated_at();

drop trigger if exists ig_account_touch on ig_account;
create trigger ig_account_touch before update on ig_account
  for each row execute function touch_updated_at();

-- ---------- contadores ----------
create or replace function bump_counters(p_automation uuid, p_contact text)
returns void language sql as $$
  update automations set sent_count = sent_count + 1 where id = p_automation;
  update contacts set dm_count = dm_count + 1, last_seen_at = now() where ig_user_id = p_contact;
$$;

-- ---------- limpeza do registro ----------
-- So o event_log e limpo. O send_queue e a trava anti-duplicata: nao apagar.
create or replace function limpar_event_log()
returns void language plpgsql security definer set search_path = public as $$
declare apagadas int;
begin
  delete from event_log where created_at < now() - interval '30 days';
  get diagnostics apagadas = row_count;
  if apagadas > 0 then
    insert into event_log (level, source, message, payload)
    values ('info','limpeza','event_log limpo',
            jsonb_build_object('linhas_apagadas', apagadas, 'retencao_dias', 30));
  end if;
end $$;

-- ---------- metricas do painel ----------
create or replace function dashboard_metricas(
  p_dias integer default 7,
  p_automation uuid default null,
  p_canal text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  ini timestamptz := now() - make_interval(days => greatest(p_dias, 1));
  res jsonb;
begin
  select jsonb_build_object(
    'periodo', jsonb_build_object('dias', p_dias, 'inicio', ini, 'fim', now(), 'canal', p_canal),

    'comentarios', (
      select jsonb_build_object(
        'recebidos', count(*) filter (where message = 'comentario recebido'),
        'sem_automacao', count(*) filter (where message = 'nenhuma automacao casou com o comentario'),
        'follow_ok', count(*) filter (where message = 'follow confirmado'),
        'follow_bloqueado', count(*) filter (where message = 'bloqueado: ainda nao segue')
      )
      from event_log
      where created_at >= ini
        and (p_canal is null
          or (p_canal = 'instagram' and source = 'webhook')
          or (p_canal = 'facebook' and source = 'facebook'))
    ),

    'envios', (
      select jsonb_build_object(
        'enviados',  count(*) filter (where status = 'sent'),
        'falhados',  count(*) filter (where status = 'failed'),
        'pulados',   count(*) filter (where status = 'skipped'),
        'pendentes', count(*) filter (where status = 'pending'),
        'pessoas',   count(distinct recipient_id) filter (where status = 'sent')
      )
      from send_queue
      where created_at >= ini
        and (p_automation is null or automation_id = p_automation)
        and (p_canal is null or channel = p_canal)
    ),

    'funil', coalesce((
      select jsonb_agg(x order by x->>'etapa')
      from (
        select jsonb_build_object('etapa', step_index, 'pessoas', count(distinct recipient_id), 'envios', count(*)) as x
        from send_queue
        where created_at >= ini and status = 'sent'
          and (p_automation is null or automation_id = p_automation)
          and (p_canal is null or channel = p_canal)
        group by step_index
      ) f
    ), '[]'::jsonb),

    'cliques', (
      select jsonb_build_object(
        'total',   count(c.id),
        'pessoas', count(distinct l.recipient_id) filter (where c.id is not null),
        'links_enviados', count(distinct l.code)
      )
      from links l
      left join link_clicks c on c.code = l.code and c.clicked_at >= ini
      where l.created_at >= ini
        and (p_automation is null or l.automation_id = p_automation)
        and (p_canal is null or l.channel = p_canal)
    ),

    'cliques_por_etapa', coalesce((
      select jsonb_agg(x order by x->>'etapa')
      from (
        select jsonb_build_object(
          'etapa', l.step_index,
          'cliques', count(c.id),
          'pessoas', count(distinct l.recipient_id) filter (where c.id is not null)
        ) as x
        from links l
        left join link_clicks c on c.code = l.code
        where l.created_at >= ini
          and (p_automation is null or l.automation_id = p_automation)
          and (p_canal is null or l.channel = p_canal)
        group by l.step_index
      ) g
    ), '[]'::jsonb),

    'contatos', (
      select jsonb_build_object('novos', count(*) filter (where first_seen_at >= ini), 'total', count(*))
      from contacts where (p_canal is null or channel = p_canal)
    ),

    'seguidores', (
      select jsonb_build_object(
        'serie', coalesce(jsonb_agg(jsonb_build_object('dia', day, 'total', followers) order by day), '[]'::jsonb),
        'inicio', min(followers),
        'fim', max(followers),
        'ganho', coalesce(
          (select followers from follower_snapshots where day >= ini::date order by day desc limit 1) -
          (select followers from follower_snapshots where day >= ini::date order by day asc  limit 1), 0)
      )
      from follower_snapshots where day >= ini::date
    ),

    'por_dia', coalesce((
      select jsonb_agg(x order by x->>'dia')
      from (
        select jsonb_build_object(
          'dia', d::date,
          'enviados', (
            select count(*) from send_queue s
            where s.status = 'sent' and s.sent_at::date = d::date
              and (p_automation is null or s.automation_id = p_automation)
              and (p_canal is null or s.channel = p_canal)
          ),
          'cliques', (
            select count(*) from link_clicks c
            join links l on l.code = c.code
            where c.clicked_at::date = d::date
              and (p_automation is null or l.automation_id = p_automation)
              and (p_canal is null or l.channel = p_canal)
          ),
          'contatos', (
            select count(*) from contacts ct
            where ct.first_seen_at::date = d::date and (p_canal is null or ct.channel = p_canal)
          )
        ) as x
        from generate_series(ini::date, now()::date, interval '1 day') d
      ) p
    ), '[]'::jsonb)
  ) into res;
  return res;
end $function$;

revoke all on function dashboard_metricas(integer, uuid, text) from public, anon, authenticated;
grant execute on function dashboard_metricas(integer, uuid, text) to service_role;
`

/** Tarefas agendadas. Refeitas a cada configuracao (endereco ou segredo podem mudar). */
export function tarefasAgendadas(endereco: string, segredo: string) {
  const chamar = (rota: string) => `
    select net.http_post(
      url     := '${endereco}/api/cron/${rota}',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer ${segredo}"}'::jsonb,
      timeout_milliseconds := 20000
    );`
  return [
    // A fila e esvaziada a cada 15 s; o teto por hora e que protege a conta.
    { nome: 'drenar-fila-dm', quando: '15 seconds', comando: chamar('drain') },
    // Token do Instagram dura 60 dias; renova quando faltam 20 ou menos.
    { nome: 'renovar-token-ig', quando: '0 5 * * *', comando: chamar('refresh-token') },
    // Uma leitura de seguidores por dia para o grafico da aba Dados.
    { nome: 'ler-seguidores', quando: '0 6 * * *', comando: chamar('followers') },
    { nome: 'limpar-event-log', quando: '0 4 * * 0', comando: 'select limpar_event_log();' },
  ]
}
