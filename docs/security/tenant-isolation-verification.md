# Tenant isolation verification plan

Issue: #9

The MVP security boundary is `store_id`. UI filtering is never authorization.

## Required automated scenarios

Run these against a disposable Supabase project/branch before #9 can close.

1. User A creates Merchant A + Store A.
2. User B creates Merchant B + Store B.
3. User A can select/update Store A.
4. User A cannot select/update/delete Store B by guessing its UUID.
5. User B cannot select Merchant A.
6. User B cannot insert a membership into Store A.
7. A store owner can read their own membership row.
8. Unauthenticated callers cannot read merchant-private store/member data.
9. Creating Store A automatically creates exactly one owner membership.
10. Changing a client-supplied `merchant_id` to another merchant fails at the database policy boundary.

## Public storefront warning

Do not add anonymous `select` policies directly to the private merchant tables just to make storefront pages work.

Issue #6 should introduce a dedicated public projection/view or narrowly scoped read path that exposes only published storefront fields.

## Secret handling

The browser may receive only:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Never expose a Supabase service-role key or any future Meta access token in Vite/client environment variables.

## Status

The repository contains the schema/RLS foundation and browser auth adapter. Automated negative tests still require a real disposable Supabase project/branch, so #9 remains open.
