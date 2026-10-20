-- 0006_design.sql — Phase 4: mockup versions, customer approval, design lock.

-- Free revisions before the shop may charge (shown to staff and the customer).
alter table settings add column free_revisions int not null default 2 check (free_revisions >= 0);

-- No new mockups once the design is approved. A Super Admin unlock (with a reason) re-opens it.
create or replace function lock_mockup_insert() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from jobs where id = new.job_id and design_approved) then
    raise exception 'Design is locked. A Super Admin must unlock it with a reason.';
  end if;
  return new;
end $$;
create trigger mockups_lock_insert before insert on mockups
  for each row execute function lock_mockup_insert();

-- apply_transition now also handles customer actors and keeps mockup status in step.
drop function if exists apply_transition(uuid,text,text,uuid,text,text,text,boolean,boolean,boolean);

create or replace function apply_transition(
  p_job uuid, p_from text, p_to text, p_actor uuid,
  p_note text, p_reason text, p_photo text,
  p_waive boolean, p_unlock boolean, p_override boolean,
  p_actor_kind text default 'staff',
  p_approval jsonb default null          -- {typed_name, comment, image_path, ip} from the customer page
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_shop uuid; v_job_no text; v_section text; v_mock uuid; v_ip inet; v_name text;
begin
  -- Optimistic lock: only moves the job if it is still at p_from.
  update jobs set
    stage_key = p_to,
    prev_stage_key = case when p_to = 'ON_HOLD' then p_from
                          when p_from = 'ON_HOLD' then null
                          else prev_stage_key end,
    deposit_waived = deposit_waived or coalesce(p_waive, false),
    design_approved = case when p_to = 'DESIGN_APPROVED' then true
                           when coalesce(p_unlock, false) then false
                           else design_approved end,
    name_list_confirmed = case when p_to = 'NAME_LIST_CONFIRMED' then true
                               when coalesce(p_unlock, false) then false
                               else name_list_confirmed end,
    revision_count = revision_count + (case when p_to = 'REVISION_REQUESTED' then 1 else 0 end),
    closed_at = case when p_to in ('COLLECTED','DELIVERED','CANCELLED') then now() else closed_at end
  where id = p_job and stage_key = p_from
  returning shop_id, job_no into v_shop, v_job_no;
  if not found then return false; end if;

  insert into job_stage_events (shop_id, job_id, from_stage, to_stage, actor_id, actor_kind,
                                note, reason, photo_path, customer_visible)
  values (v_shop, p_job, p_from, p_to, p_actor, coalesce(p_actor_kind, 'staff'),
          p_note, p_reason, p_photo, p_reason is null);

  -- Mockup bookkeeping (jobs.design_approved is already updated above, so the lock trigger agrees).
  select id into v_mock from mockups where job_id = p_job order by version desc limit 1;
  if v_mock is not null then
    if p_to = 'MOCKUP_SENT' then
      update mockups set status = 'superseded'
        where job_id = p_job and id <> v_mock and status in ('draft','sent','revision_requested');
      update mockups set status = 'sent' where id = v_mock;
    elsif p_to = 'DESIGN_APPROVED' or p_to = 'REVISION_REQUESTED' then
      update mockups set status = (case when p_to = 'DESIGN_APPROVED' then 'approved'
                                        else 'revision_requested' end)::mockup_status
        where id = v_mock and status = 'sent';

      begin v_ip := (p_approval->>'ip')::inet; exception when others then v_ip := null; end;
      select full_name into v_name from profiles where id = p_actor;
      insert into approvals (shop_id, job_id, mockup_id, kind, typed_name, comment, image_path, ip)
      values (v_shop, p_job, v_mock,
              case when p_to = 'DESIGN_APPROVED' then 'approved' else 'revision_requested' end,
              coalesce(p_approval->>'typed_name', v_name),
              coalesce(p_approval->>'comment', case when p_approval is null then coalesce(p_note, 'Recorded by staff on behalf of the customer') end),
              p_approval->>'image_path', v_ip);
    end if;
  end if;
  if coalesce(p_unlock, false) then
    update mockups set status = 'superseded' where job_id = p_job and status = 'approved';
  end if;

  if coalesce(p_waive, false) then
    insert into audit_log (shop_id, actor_id, entity, entity_id, action, detail)
    values (v_shop, p_actor, 'job', p_job, 'deposit_waived', jsonb_build_object('reason', p_reason));
  end if;
  if coalesce(p_override, false) then
    insert into audit_log (shop_id, actor_id, entity, entity_id, action, detail)
    values (v_shop, p_actor, 'job', p_job, 'payment_override', jsonb_build_object('reason', p_reason));
  end if;
  if coalesce(p_unlock, false) then
    insert into audit_log (shop_id, actor_id, entity, entity_id, action, detail)
    values (v_shop, p_actor, 'job', p_job, 'design_unlocked', jsonb_build_object('reason', p_reason));
  end if;

  select section into v_section from stages where shop_id = v_shop and key = p_to;
  if v_section is not null and p_to not in ('COLLECTED','DELIVERED','CANCELLED') then
    insert into notifications (shop_id, section, job_id, title, body)
    values (v_shop, v_section, p_job, 'queue_landed', v_job_no);
  end if;
  return true;
end $$;

revoke execute on function apply_transition(uuid,text,text,uuid,text,text,text,boolean,boolean,boolean,text,jsonb)
  from public, anon, authenticated;
grant execute on function apply_transition(uuid,text,text,uuid,text,text,text,boolean,boolean,boolean,text,jsonb)
  to service_role;
