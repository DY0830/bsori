-- Reliable collection workflow used by the driver screen.
-- The text status comparison avoids enum/output-name ambiguity in older deployments.
create or replace function public.advance_collection_assignment_v2(
  p_assignment_id uuid,
  p_actual_weight_kg numeric default null,
  p_collection_photo_path text default null,
  p_driver_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.collection_assignments%rowtype;
  v_status text;
  v_role text;
begin
  select a.* into v_assignment
  from public.collection_assignments a
  where a.id = p_assignment_id
  for update;

  if not found then
    raise exception '배차 정보를 찾을 수 없습니다.';
  end if;

  select r.status::text into v_status
  from public.waste_requests r
  where r.id = v_assignment.request_id
  for update;

  if v_status is null then
    raise exception '연결된 수거 요청을 찾을 수 없습니다.';
  end if;

  select p.role::text into v_role
  from public.profiles p
  where p.id = auth.uid() and p.is_active;

  if v_assignment.driver_id <> auth.uid()
    and coalesce(v_role, '') <> 'admin' then
    raise exception '이 배차를 변경할 권한이 없습니다.';
  end if;

  if v_status = 'assigned' then
    update public.collection_assignments
    set started_at = coalesce(started_at, now())
    where id = p_assignment_id;

    update public.waste_requests
    set status = 'collecting', updated_at = now()
    where id = v_assignment.request_id;

    insert into public.status_history(
      request_id, from_status, to_status, changed_by, note
    ) values (
      v_assignment.request_id,
      'assigned',
      'collecting',
      auth.uid(),
      '수거 운행 시작'
    );

    return jsonb_build_object(
      'stage', 'moving', 'request_status', 'collecting'
    );
  end if;

  if v_status = 'collecting' and v_assignment.arrived_at is null then
    update public.collection_assignments
    set arrived_at = now()
    where id = p_assignment_id;

    insert into public.status_history(
      request_id, from_status, to_status, changed_by, note
    ) values (
      v_assignment.request_id,
      'collecting',
      'collecting',
      auth.uid(),
      '수거지 도착'
    );

    return jsonb_build_object(
      'stage', 'arrived', 'request_status', 'collecting'
    );
  end if;

  if v_status = 'collecting' and v_assignment.arrived_at is not null then
    if p_actual_weight_kg is null or p_actual_weight_kg <= 0 then
      raise exception '실제 수거 중량을 입력해 주세요.';
    end if;

    update public.collection_assignments
    set collected_at = now(),
        actual_weight_kg = p_actual_weight_kg,
        collection_photo_path = nullif(trim(p_collection_photo_path), ''),
        driver_note = nullif(trim(p_driver_note), '')
    where id = p_assignment_id;

    update public.waste_requests
    set status = 'collected', updated_at = now()
    where id = v_assignment.request_id;

    insert into public.status_history(
      request_id, from_status, to_status, changed_by, note
    ) values (
      v_assignment.request_id,
      'collecting',
      'collected',
      auth.uid(),
      '수거 및 계량 완료'
    );

    return jsonb_build_object(
      'stage', 'completed', 'request_status', 'collected'
    );
  end if;

  raise exception
    '현재 요청 상태(%)에서는 다음 단계로 변경할 수 없습니다.',
    v_status;
end;
$$;

grant execute on function public.advance_collection_assignment_v2(
  uuid, numeric, text, text
) to authenticated;

select pg_notify('pgrst', 'reload schema');
