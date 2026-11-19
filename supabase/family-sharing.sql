drop function if exists public.register_family_member(text);

update storage.buckets
set file_size_limit = 10485760
where id = 'documents';

create table if not exists public.family_access_groups (
    family_id text primary key,
    owner_uid text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.family_access_memberships (
    family_id text not null
        references public.family_access_groups (family_id)
        on delete cascade,
    user_id text not null,
    primary key (family_id, user_id)
);

create table if not exists public.document_access (
    bucket_id text not null,
    object_name text not null,
    family_id text not null,
    owner_uid text not null,
    recipient_uid text not null,
    created_at timestamptz not null default now(),
    primary key (bucket_id, object_name, recipient_uid)
);

alter table public.family_access_groups enable row level security;
alter table public.family_access_memberships enable row level security;
alter table public.document_access enable row level security;

grant select on public.family_access_groups to public;
grant select on public.family_access_memberships to public;
grant select on public.document_access to public;

drop policy if exists "Family owners can read their access group"
    on public.family_access_groups;
create policy "Family owners can read their access group"
    on public.family_access_groups
    for select
    to public
    using (
        owner_uid = (select auth.jwt() ->> 'sub')
    );

drop policy if exists "Users can read their own family memberships"
    on public.family_access_memberships;
create policy "Users can read their own family memberships"
    on public.family_access_memberships
    for select
    to public
    using (
        user_id = (select auth.jwt() ->> 'sub')
        or exists (
            select 1
            from public.family_access_groups family
            where family.family_id = family_access_memberships.family_id
              and family.owner_uid = (select auth.jwt() ->> 'sub')
        )
    );

drop policy if exists "Users can read their document access grants"
    on public.document_access;
create policy "Users can read their document access grants"
    on public.document_access
    for select
    to public
    using (
        owner_uid = (select auth.jwt() ->> 'sub')
        or recipient_uid = (select auth.jwt() ->> 'sub')
    );

create or replace function public.sync_family_members(
    p_family_id text,
    p_member_ids text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    caller_uid text := auth.jwt() ->> 'sub';
    existing_owner_uid text;
begin
    if caller_uid is null
       or p_family_id is null
       or length(trim(p_family_id)) = 0
       or p_member_ids is null
       or cardinality(p_member_ids) = 0
       or not (caller_uid = any(p_member_ids))
       or exists (
           select 1
           from unnest(p_member_ids) as supplied(member_uid)
           where supplied.member_uid is null
              or length(trim(supplied.member_uid)) = 0
       ) then
        raise exception 'Invalid family membership synchronization request';
    end if;

    insert into public.family_access_groups (family_id, owner_uid)
    values (p_family_id, caller_uid)
    on conflict (family_id) do nothing;

    select owner_uid
      into existing_owner_uid
      from public.family_access_groups
     where family_id = p_family_id
     for update;

    if existing_owner_uid is distinct from caller_uid then
        raise exception 'Only the current family owner can synchronize family access';
    end if;

    delete from public.document_access
     where family_id = p_family_id
       and (
           not (recipient_uid = any(p_member_ids))
           or not (owner_uid = any(p_member_ids))
       );

    delete from public.family_access_memberships
     where family_id = p_family_id
       and not (user_id = any(p_member_ids));

    insert into public.family_access_memberships (family_id, user_id)
    select p_family_id, supplied.member_uid
      from (
          select distinct member_uid
            from unnest(p_member_ids) as supplied_members(member_uid)
      ) supplied
    on conflict (family_id, user_id) do nothing;
end;
$$;

create or replace function public.sync_family_members_from_firestore(
    p_family_id text,
    p_owner_uid text,
    p_member_ids text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    existing_owner_uid text;
begin
    if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
       or p_family_id is null
       or length(trim(p_family_id)) = 0
       or p_owner_uid is null
       or length(trim(p_owner_uid)) = 0
       or p_member_ids is null
       or cardinality(p_member_ids) = 0
       or not (p_owner_uid = any(p_member_ids))
       or exists (
           select 1
           from unnest(p_member_ids) as supplied(member_uid)
           where supplied.member_uid is null
              or length(trim(supplied.member_uid)) = 0
       ) then
        raise exception 'Invalid trusted family membership synchronization request';
    end if;

    insert into public.family_access_groups (family_id, owner_uid)
    values (p_family_id, p_owner_uid)
    on conflict (family_id) do nothing;

    select owner_uid
      into existing_owner_uid
      from public.family_access_groups
     where family_id = p_family_id
     for update;

    if existing_owner_uid is distinct from p_owner_uid then
        raise exception 'Family ownership must be synchronized by the current owner';
    end if;

    delete from public.document_access
     where family_id = p_family_id
       and (
           not (recipient_uid = any(p_member_ids))
           or not (owner_uid = any(p_member_ids))
       );

    delete from public.family_access_memberships
     where family_id = p_family_id
       and not (user_id = any(p_member_ids));

    insert into public.family_access_memberships (family_id, user_id)
    select p_family_id, supplied.member_uid
      from (
          select distinct member_uid
            from unnest(p_member_ids) as supplied_members(member_uid)
      ) supplied
    on conflict (family_id, user_id) do nothing;
end;
$$;

create or replace function public.leave_family_access(
    p_family_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    caller_uid text := auth.jwt() ->> 'sub';
begin
    if caller_uid is null or p_family_id is null then
        raise exception 'Invalid family leave request';
    end if;

    delete from public.family_access_memberships
     where family_id = p_family_id
       and user_id = caller_uid;

    delete from public.document_access
     where family_id = p_family_id
       and (recipient_uid = caller_uid or owner_uid = caller_uid);
end;
$$;

create or replace function public.delete_family_access_group(
    p_family_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    caller_uid text := auth.jwt() ->> 'sub';
    member_count bigint;
begin
    if caller_uid is null or p_family_id is null then
        raise exception 'Invalid family deletion request';
    end if;

    if not exists (
        select 1
          from public.family_access_groups family
         where family.family_id = p_family_id
           and family.owner_uid = caller_uid
    ) then
        raise exception 'Only the family owner can delete family access';
    end if;

    select count(*)
      into member_count
      from public.family_access_memberships membership
     where membership.family_id = p_family_id;

    if member_count <> 1
       or not exists (
           select 1
             from public.family_access_memberships membership
            where membership.family_id = p_family_id
              and membership.user_id = caller_uid
       ) then
        raise exception 'Family access can only be deleted by its sole member';
    end if;

    delete from public.document_access
     where family_id = p_family_id;
    delete from public.family_access_groups
     where family_id = p_family_id;
end;
$$;

create or replace function public.transfer_family_access_ownership(
    p_family_id text,
    p_new_owner_uid text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    caller_uid text := auth.jwt() ->> 'sub';
    current_owner_uid text;
begin
    if caller_uid is null
       or p_family_id is null
       or p_new_owner_uid is null
       or p_new_owner_uid = caller_uid then
        raise exception 'Invalid family ownership transfer request';
    end if;

    select owner_uid
      into current_owner_uid
      from public.family_access_groups
     where family_id = p_family_id;

    if current_owner_uid = p_new_owner_uid
       and exists (
           select 1
             from public.family_access_memberships membership
            where membership.family_id = p_family_id
              and membership.user_id = caller_uid
       ) then
        return;
    end if;

    if not exists (
        select 1
          from public.family_access_groups family
         where family.family_id = p_family_id
           and family.owner_uid = caller_uid
    ) or not exists (
        select 1
          from public.family_access_memberships membership
         where membership.family_id = p_family_id
           and membership.user_id = p_new_owner_uid
    ) then
        raise exception 'Only the current owner can transfer access to a current family member';
    end if;

    update public.family_access_groups
       set owner_uid = p_new_owner_uid
     where family_id = p_family_id;
end;
$$;

create or replace function public.sync_document_access(
    p_bucket_id text,
    p_object_name text,
    p_family_id text,
    p_recipient_ids text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    caller_uid text := auth.jwt() ->> 'sub';
begin
    if caller_uid is null
       or p_bucket_id is null
       or length(trim(p_bucket_id)) = 0
       or p_object_name is null
       or split_part(p_object_name, '/', 1) <> caller_uid
       or p_recipient_ids is null then
        raise exception 'Invalid document access synchronization request';
    end if;

    if cardinality(p_recipient_ids) > 0 then
        if p_family_id is null
           or exists (
               select 1
               from unnest(p_recipient_ids) as supplied(recipient_uid)
               where supplied.recipient_uid is null
                  or length(trim(supplied.recipient_uid)) = 0
                  or supplied.recipient_uid = caller_uid
           )
           or not exists (
               select 1
                 from public.family_access_memberships membership
                where membership.family_id = p_family_id
                  and membership.user_id = caller_uid
           )
           or exists (
               select 1
                 from unnest(p_recipient_ids) as supplied(recipient_uid)
                where not exists (
                    select 1
                      from public.family_access_memberships membership
                     where membership.family_id = p_family_id
                       and membership.user_id = supplied.recipient_uid
                )
           ) then
            raise exception 'The uploader and every recipient must be active members of the same family';
        end if;
    end if;

    delete from public.document_access
     where bucket_id = p_bucket_id
       and object_name = p_object_name
       and owner_uid = caller_uid;

    if cardinality(p_recipient_ids) > 0 then
        insert into public.document_access (
            bucket_id,
            object_name,
            family_id,
            owner_uid,
            recipient_uid
        )
        select
            p_bucket_id,
            p_object_name,
            p_family_id,
            caller_uid,
            recipient_uid
        from (
            select distinct recipient_uid
              from unnest(p_recipient_ids) as supplied(recipient_uid)
            ) recipients;
    end if;
end;
$$;

drop policy if exists "Family members can read explicitly shared documents"
    on storage.objects;
create policy "Family members can read explicitly shared documents"
    on storage.objects
    for select
    to public
    using (
        bucket_id = 'documents'
        and exists (
            select 1
              from public.document_access access
              join public.family_access_memberships membership
                on membership.family_id = access.family_id
               and membership.user_id = (select auth.jwt() ->> 'sub')
             where access.bucket_id = storage.objects.bucket_id
               and access.object_name = storage.objects.name
               and access.recipient_uid = (select auth.jwt() ->> 'sub')
        )
    );

revoke all on function public.sync_family_members(text, text[]) from public;
revoke all on function public.sync_family_members_from_firestore(text, text, text[]) from public, anon, authenticated;
revoke all on function public.leave_family_access(text) from public;
revoke all on function public.delete_family_access_group(text) from public;
revoke all on function public.transfer_family_access_ownership(text, text) from public;
revoke all on function public.sync_document_access(text, text, text, text[]) from public;

grant execute on function public.sync_family_members(text, text[]) to public;
grant execute on function public.sync_family_members_from_firestore(text, text, text[]) to service_role;
grant execute on function public.leave_family_access(text) to public;
grant execute on function public.delete_family_access_group(text) to public;
grant execute on function public.transfer_family_access_ownership(text, text) to public;
grant execute on function public.sync_document_access(text, text, text, text[]) to public;
