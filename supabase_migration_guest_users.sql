-- ============================================================
-- 게스트(익명) 저장 실패(409, FK 23503 expenses_user_id_fkey) 영구 수정
-- 원인: 익명 Auth 유저에 대응하는 public.users 행이 없어서
--       expenses/accounts/cards/fixed_costs/categories 등 모든 insert가
--       외래키(user_id -> users.id) 위반으로 실패함.
-- 해결: auth.users 생성 시 public.users 행을 자동 생성하는 트리거 +
--       이미 존재하는(행 없는) 유저 백필.
-- Supabase 대시보드 > SQL Editor에 붙여넣고 실행.
-- ============================================================

-- 1) 신규 가입(익명 포함) 시 public.users 행 자동 생성 트리거
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 익명 게스트는 email이 없으므로(users.email NOT NULL) placeholder를 넣는다.
  insert into public.users (id, email)
  values (new.id, coalesce(new.email, new.id || '@guest.spenlog.app'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) 백필: public.users 행이 없는 기존 auth 유저(게스트 포함) 채우기
insert into public.users (id, email)
select u.id, coalesce(u.email, u.id || '@guest.spenlog.app')
from auth.users u
left join public.users p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
