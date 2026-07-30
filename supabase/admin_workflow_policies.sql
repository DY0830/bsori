-- Allow an administrator to register a waste request on behalf of a
-- discharger while preserving the same ownership checks used for normal users.

drop policy if exists "discharger creates own requests"
on public.waste_requests;

create policy "discharger or admin creates requests"
on public.waste_requests
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    (
      public.current_user_role() = 'discharger'
      and organization_id = (
        select organization_id
        from public.profiles
        where id = auth.uid()
      )
    )
    or
    (
      public.current_user_role() = 'admin'
      and exists (
        select 1
        from public.organizations
        where id = organization_id
          and organization_type = 'discharger'
      )
    )
  )
);
