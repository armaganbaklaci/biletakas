create or replace function public.calculate_transaction_pricing(base_amount numeric)
returns table (
  buyer_total_amount numeric,
  service_fee numeric,
  platform_commission numeric,
  seller_payout_amount numeric
)
language sql
stable
set search_path = public
as $$
  select
    round(coalesce(base_amount, 0) + 15, 2) as buyer_total_amount,
    15.00::numeric as service_fee,
    round(coalesce(base_amount, 0) * 0.05, 2) as platform_commission,
    round(coalesce(base_amount, 0) - (coalesce(base_amount, 0) * 0.05), 2) as seller_payout_amount;
$$;

create or replace function public.create_transaction_on_offer_accept()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.listings%rowtype;
  v_pricing record;
begin
  if new.status = 'accepted' and (old.status is distinct from 'accepted') then
    select * into v_listing from public.listings where id = new.listing_id;
    if not found then
      raise exception 'Listing not found for offer %', new.id;
    end if;

    select * into v_pricing
    from public.calculate_transaction_pricing(v_listing.price);

    insert into public.transactions (
      offer_id, listing_id, buyer_id, seller_id, amount,
      transaction_code, payment_method, payment_status, ticket_status,
      completion_status, buyer_total_amount, service_fee,
      platform_commission, seller_payout_amount, payout_status
    ) values (
      new.id, new.listing_id, new.buyer_id, v_listing.seller_id, new.amount,
      '', 'IBAN', 'waiting_payment', 'waiting_ticket_upload',
      'pending', v_pricing.buyer_total_amount, v_pricing.service_fee,
      v_pricing.platform_commission, v_pricing.seller_payout_amount, 'pending'
    )
    on conflict (offer_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists offers_create_transaction on public.offers;

create trigger offers_create_transaction
  after update on public.offers
  for each row execute function public.create_transaction_on_offer_accept();

update public.transactions
set
  buyer_total_amount = round(coalesce(l.price, amount) + 15, 2),
  service_fee = 15.00,
  platform_commission = round(coalesce(l.price, amount) * 0.05, 2),
  seller_payout_amount = round(coalesce(l.price, amount) - (coalesce(l.price, amount) * 0.05), 2),
  payout_status = coalesce(payout_status, 'pending')
from public.listings l
where public.transactions.listing_id = l.id;

update public.transactions
set
  buyer_total_amount = round(coalesce(amount, 0) + 15, 2),
  service_fee = 15.00,
  platform_commission = round(coalesce(amount, 0) * 0.05, 2),
  seller_payout_amount = round(coalesce(amount, 0) - (coalesce(amount, 0) * 0.05), 2),
  payout_status = coalesce(payout_status, 'pending')
where id not in (
  select t.id
  from public.transactions t
  join public.listings l on l.id = t.listing_id
);