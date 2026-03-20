-- Add rating, size, and material_make columns to inward_items table
ALTER TABLE inward_items ADD COLUMN IF NOT EXISTS rating VARCHAR;
ALTER TABLE inward_items ADD COLUMN IF NOT EXISTS size VARCHAR;
ALTER TABLE inward_items ADD COLUMN IF NOT EXISTS material_make VARCHAR;
