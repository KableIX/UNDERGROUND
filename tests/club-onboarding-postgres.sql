-- Run on a disposable, migrated PostgreSQL database with Supabase auth roles.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('91000000-0000-4000-8000-000000000001','founder@example.test',now()),
 ('91000000-0000-4000-8000-000000000002','lead@example.test',now()),
 ('91000000-0000-4000-8000-000000000003','driver@example.test',now()),
 ('91000000-0000-4000-8000-000000000004','stranger@example.test',now());
insert into public.members(auth_user_id,member_number,display_name,is_founder)
 values('91000000-0000-4000-8000-000000000001','981000','QA founder',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
select public.grant_club_access('LEAD@example.test');
select public.grant_club_access('lead@example.test');
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000004',true);
do $$begin
 begin perform public.activate_club_invitee();raise exception 'uninvited activation succeeded';
 exception when others then if sqlerrm<>'No active invitation for this email' then raise;end if;end;
end$$;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',true);
select public.activate_club_invitee();
select public.activate_club_invitee();
do $$declare h jsonb:=public.my_club_hub(); t uuid; c uuid;begin
 if jsonb_array_length(h->'invites')<>1 then raise exception 'duplicate/missing grant';end if;
 t:=(h#>>'{invites,0,id}')::uuid;
 c:=public.answer_club_access(t,true,'Coast Club','Monterey','CC');
 if public.answer_club_access(t,true)<>c then raise exception 'retry changed club';end if;
 if public.my_club_hub()#>>'{clubs,0,role}'<>'owner' then raise exception 'missing owner';end if;
 perform public.grant_club_access('driver@example.test',c);
 begin perform public.grant_club_access('stranger@example.test');raise exception 'unauthorized lead grant';exception when others then if sqlerrm<>'Club grant permission required' then raise;end if;end;
end$$;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000003',true);
select public.activate_club_invitee();
do $$begin
 begin perform public.answer_club_access((public.my_club_hub()#>>'{invites,0,id}')::uuid,true);
 raise exception 'unverified join succeeded';exception when others then if sqlerrm<>'Vehicle verification required' then raise;end if;end;
end$$;
reset role;
-- Verified fixture creation must emulate the trusted service-role claim.
select set_config('request.jwt.claim.role','service_role',true);
insert into public.vehicles(owner_member_id,year,make,model,color,verification_status) values(public.current_member_id(),2010,'Audi','R8','black','verified');
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select public.answer_club_access((public.my_club_hub()#>>'{invites,0,id}')::uuid,true);
do $$begin
 if jsonb_array_length(public.my_club_hub()#>'{clubs,0,roster}')<>2 or public.my_club_hub()#>>'{clubs,0,role}'<>'member' then raise exception 'wrong driver roster';end if;
 begin perform public.grant_club_access('stranger@example.test',(public.my_club_hub()#>>'{clubs,0,id}')::uuid);
 raise exception 'nonofficer invite';exception when others then if sqlerrm<>'Club officer required' then raise;end if;end;
end$$;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',true);
do $$begin if jsonb_array_length(public.my_club_hub()#>'{clubs,0,roster}')<>2 then raise exception 'wrong owner roster';end if;end$$;
rollback;
