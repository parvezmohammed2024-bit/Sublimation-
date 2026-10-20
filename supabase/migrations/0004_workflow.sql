-- 0004_workflow.sql — Phase 3: stage changes only through apply_transition().
-- The app evaluates the business rules (src/lib/rules/workflow.ts) and then calls this function
-- with the service-role key. Normal logged-in users can no longer change stage or guard flags
-- directly, so the browser's Supabase key cannot be used to skip a guard.

-- Confirmed name lists land in the template team's queue (they start the template themselves).
update stages set section = 'template' where key = 'NAME_LIST_CONFIRMED';

drop policy if exists jobs_section_update on jobs;      -- section staff edit nothing directly
drop policy if exists stage_events_insert on job_stage_events;

-- Admins keep editing ordinary fields; stage and guard columns are not updatable by users.
revoke update on jobs from authenticated, anon;
grant update (sales_person, designer_id, priority, due_date, estimated_ready_date,
              subtotal, rush_fee, tax_amount, total, deposit_percent,
              design_brief, internal_notes, customer_notes)
  on jobs to authenticated;

create or replace function apply_transition(
  p_job uuid, p_from text, p_to text, p_actor uuid,
  p_note text, p_reason text, p_photo text,
  p_waive boolean, p_unlock boolean, p_override boolean
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_shop uuid; v_job_no text; v_section text;
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
  values (v_shop, p_job, p_from, p_to, p_actor, 'staff', p_note, p_reason, p_photo,
          p_reason is null);

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

  -- In-app notification for the section that now owns the job.
  -- title is a code ('queue_landed'); the UI translates it. body is the job number.
  select section into v_section from stages where shop_id = v_shop and key = p_to;
  if v_section is not null and p_to not in ('COLLECTED','DELIVERED','CANCELLED') then
    insert into notifications (shop_id, section, job_id, title, body)
    values (v_shop, v_section, p_job, 'queue_landed', v_job_no);
  end if;
  return true;
end $$;

revoke execute on function apply_transition(uuid,text,text,uuid,text,text,text,boolean,boolean,boolean)
  from public, anon, authenticated;
grant execute on function apply_transition(uuid,text,text,uuid,text,text,text,boolean,boolean,boolean)
  to service_role;
