-- REVIEW ONLY — NOT EXECUTED.
-- This file contains only the proposed order-system tables and index.
-- Dependencies: the API generates UUIDs in application code and supplies both timestamps.
-- Existing-object note: IF NOT EXISTS does not verify that a same-named object has this definition.
-- Rollback risk: order_idempotency_keys references orders with ON DELETE CASCADE.
-- Dropping either table after real orders exist loses order/idempotency data; retries may then create duplicates.
-- If rollback is ever separately authorized, preserve data and remove the idempotency table before orders.

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  item_type TEXT NOT NULL CHECK (item_type IN ('product', 'service')),
  item_name TEXT NOT NULL,
  item_category TEXT,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  company_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  urgency TEXT NOT NULL DEFAULT 'standard',
  preferred_timeline TEXT,
  budget TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewing', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS order_idempotency_keys (
  idempotency_key UUID PRIMARY KEY,
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC, id);
