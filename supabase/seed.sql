-- seed.sql — demo data. Run AFTER the migrations. Safe to run once on an empty database.
-- Staff logins: create users in Supabase Auth first, then see README "Create your first users".

insert into shops (id, name) values ('00000000-0000-0000-0000-000000000001', 'Demo Sublimation Shop');

insert into settings (shop_id, shop_profile, bank_details, job_prefix, default_deposit_percent,
                      default_lead_time_days, quote_validity_days, terms)
values ('00000000-0000-0000-0000-000000000001',
  '{"name":"Demo Sublimation Shop","address":"Shah Alam, Selangor","phone":"+60123456789"}',
  '{"bank":"Maybank","account_no":"0000 0000 0000","account_name":"Demo Sublimation Shop"}',
  'SB', 50, 14, 30, 'Goods sold are not refundable. Quotation valid for 30 days.');

-- Stages (mirrors DEFAULT_STAGES in src/lib/rules/stages.ts)
insert into stages (shop_id, key, position, section, label_en, label_ms, customer_label_en, customer_label_ms, is_terminal) values
 ('00000000-0000-0000-0000-000000000001','QUOTATION_DRAFT',0,'sales','Quotation draft','Draf sebut harga','Quotation','Sebut harga',false),
 ('00000000-0000-0000-0000-000000000001','QUOTATION_SENT',1,'sales','Quotation sent','Sebut harga dihantar','Quotation','Sebut harga',false),
 ('00000000-0000-0000-0000-000000000001','CONFIRMED',2,'design','Confirmed','Disahkan','Order confirmed','Tempahan disahkan',false),
 ('00000000-0000-0000-0000-000000000001','DESIGNING',3,'design','Designing','Sedang reka','Design','Reka bentuk',false),
 ('00000000-0000-0000-0000-000000000001','MOCKUP_SENT',4,'design','Mockup sent','Mockup dihantar','Design','Reka bentuk',false),
 ('00000000-0000-0000-0000-000000000001','REVISION_REQUESTED',null,'design','Revision requested','Semakan diminta','Design','Reka bentuk',false),
 ('00000000-0000-0000-0000-000000000001','DESIGN_APPROVED',5,'design','Design approved','Reka bentuk diluluskan','Design approved','Reka bentuk diluluskan',false),
 ('00000000-0000-0000-0000-000000000001','AWAITING_NAME_LIST',6,'sales','Awaiting name list','Menunggu senarai nama','Name list','Senarai nama',false),
 ('00000000-0000-0000-0000-000000000001','NAME_LIST_CONFIRMED',7,'template','Name list confirmed','Senarai nama disahkan','Name list','Senarai nama',false),
 ('00000000-0000-0000-0000-000000000001','TEMPLATE',8,'template','Template / pattern','Templat / corak','Preparing production','Menyediakan pengeluaran',false),
 ('00000000-0000-0000-0000-000000000001','PRINTING',9,'printing','Printing','Mencetak','Printing','Pencetakan',false),
 ('00000000-0000-0000-0000-000000000001','HEAT_PRESS',10,'printing','Heat press','Heat press','Printing','Pencetakan',false),
 ('00000000-0000-0000-0000-000000000001','CUTTING',11,'sewing','Cutting','Memotong','Sewing','Jahitan',false),
 ('00000000-0000-0000-0000-000000000001','SEWING',12,'sewing','Sewing','Menjahit','Sewing','Jahitan',false),
 ('00000000-0000-0000-0000-000000000001','QC',13,'qc','Quality check','Semakan kualiti','Quality check','Semakan kualiti',false),
 ('00000000-0000-0000-0000-000000000001','QC_FAILED',null,'qc','QC failed','QC gagal','Quality check','Semakan kualiti',false),
 ('00000000-0000-0000-0000-000000000001','REWORK',null,'sewing','Rework','Kerja semula','Quality check','Semakan kualiti',false),
 ('00000000-0000-0000-0000-000000000001','PACKING',14,'dispatch','Packing','Pembungkusan','Packing','Pembungkusan',false),
 ('00000000-0000-0000-0000-000000000001','READY_FOR_COLLECTION',15,'dispatch','Ready for collection','Sedia untuk diambil','Ready','Sedia',false),
 ('00000000-0000-0000-0000-000000000001','COLLECTED',16,'dispatch','Collected','Telah diambil','Collected','Telah diambil',true),
 ('00000000-0000-0000-0000-000000000001','DELIVERED',16,'dispatch','Delivered','Telah dihantar','Delivered','Telah dihantar',true),
 ('00000000-0000-0000-0000-000000000001','ON_HOLD',null,'sales','On hold','Ditangguhkan','On hold','Ditangguhkan',false),
 ('00000000-0000-0000-0000-000000000001','CANCELLED',null,'sales','Cancelled','Dibatalkan','Cancelled','Dibatalkan',true);

insert into fabrics (shop_id, name, gsm, is_polyester) values
 ('00000000-0000-0000-0000-000000000001','Microfiber Interlock',160,true),
 ('00000000-0000-0000-0000-000000000001','Eyelet',null,true),
 ('00000000-0000-0000-0000-000000000001','Honeycomb',null,true),
 ('00000000-0000-0000-0000-000000000001','Jacquard',null,true),
 ('00000000-0000-0000-0000-000000000001','Spandex / Lycra',null,true),
 ('00000000-0000-0000-0000-000000000001','Dri-fit',null,true),
 ('00000000-0000-0000-0000-000000000001','Cotton-feel polyester',null,true),
 ('00000000-0000-0000-0000-000000000001','100% Cotton',180,false);

insert into garment_types (shop_id, name, is_garment) values
 ('00000000-0000-0000-0000-000000000001','Round neck jersey',true),
 ('00000000-0000-0000-0000-000000000001','V-neck jersey',true),
 ('00000000-0000-0000-0000-000000000001','Collar / polo jersey',true),
 ('00000000-0000-0000-0000-000000000001','Muslimah jersey (long sleeve)',true),
 ('00000000-0000-0000-0000-000000000001','Esports jersey',true),
 ('00000000-0000-0000-0000-000000000001','Cycling jersey',true),
 ('00000000-0000-0000-0000-000000000001','Rash guard',true),
 ('00000000-0000-0000-0000-000000000001','Shorts',true),
 ('00000000-0000-0000-0000-000000000001','Hoodie',true),
 ('00000000-0000-0000-0000-000000000001','Lanyard',false),
 ('00000000-0000-0000-0000-000000000001','Banner / flag',false);

-- Demo quantity price tiers (RM per piece, in sen). Edit to match your real price list.
update garment_types set price_tiers = '[{"minQty":1,"priceSen":7500},{"minQty":20,"priceSen":6500},{"minQty":50,"priceSen":5800},{"minQty":100,"priceSen":5200}]'
  where name in ('Round neck jersey','V-neck jersey','Esports jersey','Cycling jersey');
update garment_types set price_tiers = '[{"minQty":1,"priceSen":8500},{"minQty":20,"priceSen":7500},{"minQty":50,"priceSen":6800}]'
  where name in ('Collar / polo jersey','Muslimah jersey (long sleeve)');

insert into collar_types (shop_id, name) values
 ('00000000-0000-0000-0000-000000000001','Round neck'),
 ('00000000-0000-0000-0000-000000000001','V-neck'),
 ('00000000-0000-0000-0000-000000000001','Polo collar'),
 ('00000000-0000-0000-0000-000000000001','Mandarin collar');

insert into size_charts (shop_id, name, sizes) values
 ('00000000-0000-0000-0000-000000000001','Adult',  array['2XS','XS','S','M','L','XL','2XL','3XL','4XL','5XL']),
 ('00000000-0000-0000-0000-000000000001','Kids',   array['16','18','20','22','24','26','28']);

-- Customers
insert into customers (id, shop_id, name, organisation, type, phone_e164, credit_terms) values
 ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000001','Ahmad Faizal','Kelab Bola Sepak Taman Maju','club','+60123450001',false),
 ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-000000000001','Cikgu Norliza','SK Seri Impian','school','+60123450002',false),
 ('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-000000000001','Tan Wei Ming','Apex Logistics Sdn Bhd','corporate','+60123450003',true),
 ('00000000-0000-0000-0000-0000000000c4','00000000-0000-0000-0000-000000000001','Hafiz Rahman','Team Rimau Esports','club','+60123450004',false);

-- 10 demo jobs spread across the pipeline. Job numbers are fixed for the demo.
insert into jobs (shop_id, job_no, customer_id, stage_key, priority, due_date, total, design_approved, name_list_confirmed, deposit_waived) values
 ('00000000-0000-0000-0000-000000000001','SB-2610-0001','00000000-0000-0000-0000-0000000000c1','QUOTATION_SENT','normal', current_date + 30, 1500.00, false, false, false),
 ('00000000-0000-0000-0000-000000000001','SB-2610-0002','00000000-0000-0000-0000-0000000000c2','CONFIRMED','normal',       current_date + 28,  2400.00, false, false, false),
 ('00000000-0000-0000-0000-000000000001','SB-2610-0003','00000000-0000-0000-0000-0000000000c3','DESIGNING','normal',       current_date + 25,  3600.00, false, false, false),
 ('00000000-0000-0000-0000-000000000001','SB-2610-0004','00000000-0000-0000-0000-0000000000c4','MOCKUP_SENT','rush',       current_date + 14,  1800.00, false, false, false),
 ('00000000-0000-0000-0000-000000000001','SB-2610-0005','00000000-0000-0000-0000-0000000000c1','DESIGN_APPROVED','normal',  current_date + 21,  1500.00, true,  false, false),
 ('00000000-0000-0000-0000-000000000001','SB-2610-0006','00000000-0000-0000-0000-0000000000c2','TEMPLATE','normal',        current_date + 15,  2400.00, true,  true,  false),
 ('00000000-0000-0000-0000-000000000001','SB-2610-0007','00000000-0000-0000-0000-0000000000c3','PRINTING','normal',        current_date + 10,  3600.00, true,  true,  false),
 ('00000000-0000-0000-0000-000000000001','SB-2610-0008','00000000-0000-0000-0000-0000000000c4','SEWING','rush',            current_date + 3,   1800.00, true,  true,  false),
 ('00000000-0000-0000-0000-000000000001','SB-2610-0009','00000000-0000-0000-0000-0000000000c1','QC','normal',             current_date - 1,   1500.00, true,  true,  false),
 ('00000000-0000-0000-0000-000000000001','SB-2610-0010','00000000-0000-0000-0000-0000000000c2','READY_FOR_COLLECTION','normal', current_date + 2, 2400.00, true, true, false);

-- Next real job in period 2610 will be SB-2610-0011.
insert into job_counters (shop_id, period, last_no)
  values ('00000000-0000-0000-0000-000000000001', '2610', 10) on conflict do nothing;

-- One line item per job (22 / 30 / 48 pcs etc.)
insert into job_items (shop_id, job_id, garment_type_id, fabric_id, sleeve, cutting, qty, unit_price)
select j.shop_id, j.id,
       (select id from garment_types where name = 'Round neck jersey'),
       (select id from fabrics where name = 'Microfiber Interlock'),
       'short', 'regular',
       greatest(10, (j.total / 60)::int), 60.00
from jobs j;

-- Payments: deposits on confirmed jobs; the ready job is still short of full payment (amber).
insert into payments (shop_id, job_id, amount, method, reference)
select j.shop_id, j.id, j.total / 2, 'bank_transfer', 'DEMO-DEP-' || j.job_no
from jobs j where j.stage_key not in ('QUOTATION_SENT');

update payments set amount = amount + 300
where job_id = (select id from jobs where job_no = 'SB-2610-0009');

-- Starting history so the demo timelines are not empty.
insert into job_stage_events (shop_id, job_id, from_stage, to_stage, note, customer_visible)
select shop_id, id, null, stage_key, 'Demo data', false from jobs;
