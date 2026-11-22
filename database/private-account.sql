create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check (length(display_name)<=60),
 save_history boolean not null default true
);
create table public.user_books (
 user_id uuid references auth.users(id) on delete cascade, book_id text not null,
 shelf boolean not null, discovery text not null default '', primary key(user_id,book_id)
);
create table public.reading_progress (
 user_id uuid references auth.users(id) on delete cascade, book_id text not null,
 page integer not null check(page>=0), updated bigint not null, primary key(user_id,book_id)
);
create table public.search_history (
 user_id uuid references auth.users(id) on delete cascade, term text not null check(length(term) between 1 and 80),
 searched_at timestamptz not null default now(), primary key(user_id,term)
);
create table public.journal_entries (
 user_id uuid references auth.users(id) on delete cascade, id uuid not null, book_id text not null,
 data jsonb not null check(jsonb_typeof(data)='object'), primary key(user_id,id)
);
create table public.saved_excerpts (
 user_id uuid references auth.users(id) on delete cascade, id uuid not null, book_id text not null,
 data jsonb not null check(jsonb_typeof(data)='object'), primary key(user_id,id)
);
do $$ declare t text; begin
 foreach t in array array['profiles','user_books','reading_progress','search_history','saved_excerpts','journal_entries'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('create policy own_rows on public.%I for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()))',t);
 end loop;
end $$;
create function public.shoe_save_book(book text, pos integer, stamp bigint, membership boolean, origin_text text, importing boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
declare uid uuid := auth.uid();
begin
 if uid is null then raise exception 'authentication required'; end if;
 insert into public.reading_progress values(uid,book,pos,stamp)
 on conflict(user_id,book_id) do update set page=excluded.page,updated=excluded.updated
 where not importing and public.reading_progress.updated<=excluded.updated;
 if membership is not null then
 insert into public.user_books values(uid,book,membership,coalesce(origin_text,''))
 on conflict(user_id,book_id) do update set shelf=excluded.shelf,discovery=coalesce(nullif(excluded.discovery,''),public.user_books.discovery) where not importing;
 end if;
end $$;
create function public.shoe_search(q text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if coalesce((select save_history from public.profiles where user_id=auth.uid()),true) then
 insert into public.search_history(user_id,term) values(auth.uid(),q) on conflict(user_id,term) do update set searched_at=now();
 end if;
end $$;
revoke all on function public.shoe_search(text),public.shoe_save_book(text,integer,bigint,boolean,text,boolean) from public,anon;
grant execute on function public.shoe_search(text),public.shoe_save_book(text,integer,bigint,boolean,text,boolean) to authenticated;
