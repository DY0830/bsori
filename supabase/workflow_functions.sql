-- B.SORI live collection and facility workflow functions.
-- Run after schema.sql and auth_and_storage.sql.

create or replace function public.assign_collection_request(
  p_request_id uuid,
  p_driver_id uuid,
  p_vehicle_id uuid,
  p_route_order integer default 1
)
returns public.collection_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.collection_assignments;
  v_request_status public.request_status;
begin
  if public.current_user_role() <> 'admin' then
    raise exception '관리자만 배차할 수 있습니다.';
  end if;

  select status into v_request_status
  from public.waste_requests
  where id = p_request_id
  for update;

  if v_request_status is null then
    raise exception '수거 요청을 찾을 수 없습니다.';
  end if;
  if v_request_status <> 'requested' then
    raise exception '접수 상태의 요청만 배차할 수 있습니다.';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_driver_id and role = 'driver' and is_active
  ) then
    raise exception '활성 수거기사를 찾을 수 없습니다.';
  end if;
  if not exists (
    select 1 from public.vehicles
    where id = p_vehicle_id and driver_id = p_driver_id
  ) then
    raise exception '선택한 차량과 수거기사가 일치하지 않습니다.';
  end if;

  insert into public.collection_assignments (
    request_id,
    driver_id,
    vehicle_id,
    route_order
  )
  values (
    p_request_id,
    p_driver_id,
    p_vehicle_id,
    greatest(coalesce(p_route_order, 1), 1)
  )
  returning * into v_assignment;

  update public.waste_requests
  set status = 'assigned', updated_at = now()
  where id = p_request_id;

  insert into public.status_history (
    request_id, from_status, to_status, changed_by, note
  )
  values (
    p_request_id, v_request_status, 'assigned', auth.uid(), '관리자 배차 완료'
  );

  return v_assignment;
end;
$$;

create or replace function public.advance_collection_assignment(
  p_assignment_id uuid,
  p_actual_weight_kg numeric default null,
  p_collection_photo_path text default null,
  p_driver_note text default null
)
returns table (stage text, request_status public.request_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.collection_assignments;
  v_status public.request_status;
begin
  select a.*
  into v_assignment
  from public.collection_assignments a
  where a.id = p_assignment_id
  for update;

  select r.status
  into v_status
  from public.waste_requests r
  where r.id = v_assignment.request_id
  for update;

  if v_assignment.id is null then
    raise exception '배차 정보를 찾을 수 없습니다.';
  end if;
  if v_assignment.driver_id <> auth.uid()
    and public.current_user_role() <> 'admin' then
    raise exception '이 배차를 변경할 권한이 없습니다.';
  end if;

  if v_status = 'assigned' then
    update public.collection_assignments
    set started_at = coalesce(started_at, now())
    where id = p_assignment_id;

    update public.waste_requests
    set status = 'collecting', updated_at = now()
    where id = v_assignment.request_id;

    insert into public.status_history (
      request_id, from_status, to_status, changed_by, note
    )
    values (
      v_assignment.request_id, v_status, 'collecting', auth.uid(), '수거 운행 시작'
    );

    return query select 'moving'::text, 'collecting'::public.request_status;
  elsif v_status = 'collecting' and v_assignment.arrived_at is null then
    update public.collection_assignments
    set arrived_at = now()
    where id = p_assignment_id;

    insert into public.status_history (
      request_id, from_status, to_status, changed_by, note
    )
    values (
      v_assignment.request_id, v_status, 'collecting', auth.uid(), '수거지 도착'
    );

    return query select 'arrived'::text, 'collecting'::public.request_status;
  elsif v_status = 'collecting' then
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

    insert into public.status_history (
      request_id, from_status, to_status, changed_by, note
    )
    values (
      v_assignment.request_id, v_status, 'collected', auth.uid(), '수거 및 계량 완료'
    );

    return query select 'completed'::text, 'collected'::public.request_status;
  end if;

  raise exception '현재 상태에서는 다음 단계로 변경할 수 없습니다.';
end;
$$;

create or replace function public.record_facility_receipt(
  p_request_id uuid,
  p_measured_weight_kg numeric,
  p_quality_status text,
  p_foreign_material_status text,
  p_scale_photo_path text,
  p_inspection_note text,
  p_processing_method text,
  p_processing_line text
)
returns public.facility_receipts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_facility_id uuid;
  v_status public.request_status;
  v_receipt public.facility_receipts;
begin
  select role, organization_id into v_role, v_facility_id
  from public.profiles
  where id = auth.uid() and is_active;

  if v_role not in ('facility', 'admin') then
    raise exception '자원화시설 또는 관리자 권한이 필요합니다.';
  end if;
  if v_role = 'admin' then
    select id into v_facility_id
    from public.organizations
    where organization_type = 'facility'
    order by created_at
    limit 1;
  end if;
  if v_facility_id is null then
    raise exception '자원화시설 정보를 찾을 수 없습니다.';
  end if;
  if p_measured_weight_kg is null or p_measured_weight_kg <= 0 then
    raise exception '실계량 중량을 입력해 주세요.';
  end if;

  select status into v_status
  from public.waste_requests
  where id = p_request_id
  for update;

  if v_status not in ('collected', 'in_transit') then
    raise exception '수거 완료된 요청만 반입할 수 있습니다.';
  end if;

  insert into public.facility_receipts (
    request_id,
    facility_id,
    inspected_by,
    measured_weight_kg,
    quality_status,
    foreign_material_status,
    scale_photo_path,
    inspection_note
  )
  values (
    p_request_id,
    v_facility_id,
    auth.uid(),
    p_measured_weight_kg,
    trim(p_quality_status),
    trim(p_foreign_material_status),
    nullif(trim(p_scale_photo_path), ''),
    nullif(trim(p_inspection_note), '')
  )
  returning * into v_receipt;

  insert into public.processing_results (
    receipt_id,
    processing_method,
    processing_line,
    input_weight_kg,
    started_at
  )
  values (
    v_receipt.id,
    trim(p_processing_method),
    nullif(trim(p_processing_line), ''),
    p_measured_weight_kg,
    now()
  );

  update public.waste_requests
  set status = 'processing', updated_at = now()
  where id = p_request_id;

  insert into public.status_history (
    request_id, from_status, to_status, changed_by, note
  )
  values (
    p_request_id, v_status, 'processing', auth.uid(), '시설 반입·검수 완료'
  );

  return v_receipt;
end;
$$;

create or replace function public.complete_processing_result(
  p_request_id uuid,
  p_output_weight_kg numeric,
  p_result_note text default null
)
returns public.processing_results
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_profile_org uuid;
  v_receipt public.facility_receipts;
  v_result public.processing_results;
  v_status public.request_status;
begin
  select role, organization_id into v_role, v_profile_org
  from public.profiles
  where id = auth.uid() and is_active;

  if v_role not in ('facility', 'admin') then
    raise exception '자원화시설 또는 관리자 권한이 필요합니다.';
  end if;
  if p_output_weight_kg is null or p_output_weight_kg < 0 then
    raise exception '처리 후 생산량을 입력해 주세요.';
  end if;

  select fr.*
  into v_receipt
  from public.facility_receipts fr
  where fr.request_id = p_request_id
  for update;

  select wr.status
  into v_status
  from public.waste_requests wr
  where wr.id = p_request_id
  for update;

  if v_receipt.id is null or v_status <> 'processing' then
    raise exception '처리 중인 반입 기록을 찾을 수 없습니다.';
  end if;
  if v_role = 'facility' and v_receipt.facility_id <> v_profile_org then
    raise exception '다른 시설의 처리 기록은 변경할 수 없습니다.';
  end if;

  update public.processing_results
  set output_weight_kg = p_output_weight_kg,
      completed_at = now(),
      result_note = nullif(trim(p_result_note), '')
  where receipt_id = v_receipt.id
  returning * into v_result;

  update public.waste_requests
  set status = 'completed', updated_at = now()
  where id = p_request_id;

  insert into public.status_history (
    request_id, from_status, to_status, changed_by, note
  )
  values (
    p_request_id, v_status, 'completed', auth.uid(), '자원화 처리 완료'
  );

  return v_result;
end;
$$;

grant execute on function public.assign_collection_request(
  uuid, uuid, uuid, integer
) to authenticated;
grant execute on function public.advance_collection_assignment(
  uuid, numeric, text, text
) to authenticated;
grant execute on function public.record_facility_receipt(
  uuid, numeric, text, text, text, text, text, text
) to authenticated;
grant execute on function public.complete_processing_result(
  uuid, numeric, text
) to authenticated;
