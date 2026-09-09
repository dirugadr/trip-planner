-- Payment methods (reference table) and a link from expenses.

CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT
);

ALTER TABLE expenses ADD COLUMN payment_method_id TEXT REFERENCES payment_methods(id);

CREATE INDEX IF NOT EXISTS idx_expenses_payment_method_id ON expenses(payment_method_id);
