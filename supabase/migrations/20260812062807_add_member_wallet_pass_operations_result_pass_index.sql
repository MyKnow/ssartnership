create index if not exists member_wallet_pass_operations_result_pass_idx
  on public.member_wallet_pass_operations(result_pass_id)
  where result_pass_id is not null;
