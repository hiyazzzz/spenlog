-- Add billing_start_day to cards table
ALTER TABLE cards ADD COLUMN IF NOT EXISTS billing_start_day integer;

-- Add card_id to savings_payments table for card payment tracking
ALTER TABLE savings_payments ADD COLUMN IF NOT EXISTS card_id uuid REFERENCES cards(id) ON DELETE CASCADE;

-- Add unique constraint for card payments (if not already exists)
-- Note: Run this only if the constraint doesn't exist yet
-- ALTER TABLE savings_payments ADD CONSTRAINT savings_payments_user_year_card_unique UNIQUE (user_id, year_month, card_id);
