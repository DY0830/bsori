-- B.SORI administrator-managed account onboarding and Storage policies.
-- Safe to run more than once after supabase/schema.sql.

create extension if not exists "pgcrypto";

create unique index if not exists organizations_name_unique_idx
  on public.organizations (lower(name));

insert into public.organizations (name, address, organization_type)
select '해원수산', '부산광역시 영도구 해양로 24', 'discharger'
where not exists (
  select 1 from public.organizations where lower(name) = lower('해원수산')
);

insert into public.organizations (name, address, organization_type)
select '부산자원운송', '부산광역시 중구 충장대로 11', 'driver'
where not exists (
  select 1 from public.organizations where lower(name) = lower('부산자원운송')
);

insert into public.organizations (name, address, organization_type)
select 'B.SORI 자원화센터', '부산광역시 강서구 녹산산단로 117', 'facility'
where not exists (
  select 1 from public.organizations where lower(name) = lower('B.SORI 자원화센터')
);

insert into public.organizations (name, address, organization_type)
select 'B.SORI 운영본부', '부산광역시 영도구 태종로 727', 'admin'
where not exists (
  select 1 from public.organizations where lower(name) = lower('B.SORI 운영본부')
);

create table if not exists public.account_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  phone text,
  role public.user_role not null,
  organization_id uuid not null references public.organizations(id),
  token_hash text not null unique,
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists account_invitations_email_idx
  on public.account_invitations (lower(email), created_at desc);

alter table public.account_invitations enable row level security;

drop policy if exists "admins manage invitations" on public.account_invitations;
create policy "admins manage invitations"
on public.account_invitations
for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "admin manages profiles" on public.profiles;
create policy "admin manages profiles"
on public.profiles
for update
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "vehicles visible by role" on public.vehicles;
create policy "vehicles visible by role"
on public.vehicles
for select
to authenticated
using (
  driver_id = auth.uid()
  or public.current_user_role() in ('admin', 'facility')
);

drop policy if exists "admin manages vehicles" on public.vehicles;
create policy "admin manages vehicles"
on public.vehicles
for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create or replace function public.bootstrap_first_admin(
  p_full_name text,
  p_phone text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile public.profiles;
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if exists (select 1 from public.profiles) then
    raise exception '초기 관리자 등록은 이미 완료되었습니다.';
  end if;

  select id into v_org_id
  from public.organizations
  where lower(name) = lower('B.SORI 운영본부')
  limit 1;

  insert into public.profiles (
    id, organization_id, role, full_name, phone
  )
  values (
    auth.uid(), v_org_id, 'admin', trim(p_full_name), nullif(trim(p_phone), '')
  )
  returning * into v_profile;

  return v_profile;
end;
$$;

create or replace function public.create_account_invitation(
  p_email text,
  p_full_name text,
  p_role public.user_role,
  p_organization_id uuid,
  p_phone text default null
)
returns table (invitation_id uuid, invite_token text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_token text;
  v_id uuid;
  v_org_role public.user_role;
begin
  if public.current_user_role() <> 'admin' then
    raise exception '관리자만 계정을 초대할 수 있습니다.';
  end if;

  select organization_type into v_org_role
  from public.organizations
  where id = p_organization_id;

  if v_org_role is null then
    raise exception '업체를 찾을 수 없습니다.';
  end if;

  if v_org_role <> p_role and p_role <> 'admin' then
    raise exception '업체 유형과 사용자 역할이 일치하지 않습니다.';
  end if;

  v_token := encode(gen_random_bytes(18), 'hex');

  insert into public.account_invitations (
    email,
    full_name,
    phone,
    role,
    organization_id,
    token_hash,
    created_by
  )
  values (
    lower(trim(p_email)),
    trim(p_full_name),
    nullif(trim(p_phone), ''),
    p_role,
    p_organization_id,
    encode(digest(v_token, 'sha256'), 'hex'),
    auth.uid()
  )
  returning id into v_id;

  return query select v_id, v_token;
end;
$$;

create or replace function public.accept_account_invitation(p_token text)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_invite public.account_invitations;
  v_profile public.profiles;
  v_email text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  select * into v_invite
  from public.account_invitations
  where token_hash = encode(digest(trim(p_token), 'sha256'), 'hex')
    and lower(email) = v_email
    and accepted_at is null
    and expires_at > now()
  limit 1;

  if v_invite.id is null then
    raise exception '초대 코드가 올바르지 않거나 만료되었습니다.';
  end if;

  insert into public.profiles (
    id,
    organization_id,
    role,
    full_name,
    phone
  )
  values (
    auth.uid(),
    v_invite.organization_id,
    v_invite.role,
    v_invite.full_name,
    v_invite.phone
  )
  on conflict (id) do update
    set organization_id = excluded.organization_id,
        role = excluded.role,
        full_name = excluded.full_name,
        phone = excluded.phone,
        is_active = true
  returning * into v_profile;

  update public.account_invitations
  set accepted_at = now(),
      accepted_by = auth.uid()
  where id = v_invite.id;

  return v_profile;
end;
$$;

grant execute on function public.bootstrap_first_admin(text, text)
  to authenticated;
grant execute on function public.create_account_invitation(
  text, text, public.user_role, uuid, text
) to authenticated;
grant execute on function public.accept_account_invitation(text)
  to authenticated;

drop policy if exists "waste photos upload by owner" on storage.objects;
create policy "waste photos upload by owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'waste-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.current_user_role() in ('discharger', 'admin')
);

drop policy if exists "waste photos read by workflow users" on storage.objects;
create policy "waste photos read by workflow users"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'waste-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.current_user_role() in ('admin', 'facility')
    or exists (
      select 1
      from public.waste_requests r
      join public.collection_assignments a on a.request_id = r.id
      where r.photo_path = name
        and a.driver_id = auth.uid()
    )
  )
);

drop policy if exists "waste photos manage by owner" on storage.objects;
create policy "waste photos manage by owner"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'waste-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.current_user_role() = 'admin'
  )
);

drop policy if exists "evidence upload by workflow users" on storage.objects;
create policy "evidence upload by workflow users"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.current_user_role() in ('driver', 'facility', 'admin')
);

drop policy if exists "evidence read authenticated" on storage.objects;
create policy "evidence read authenticated"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'evidence'
  and public.current_user_role() is not null
);

drop policy if exists "evidence manage by owner" on storage.objects;
create policy "evidence manage by owner"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'evidence'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.current_user_role() = 'admin'
  )
);
