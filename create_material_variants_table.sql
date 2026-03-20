-- Create material_variants table
CREATE TABLE IF NOT EXISTS material_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL,
    rating TEXT,
    size TEXT,
    material_make TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials (id),
    UNIQUE (material_id, rating, size, material_make)
);

-- Add material_variant_id to inward_items table
ALTER TABLE inward_items ADD COLUMN material_variant_id INTEGER REFERENCES material_variants(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_material_variants_material_id ON material_variants(material_id);
CREATE INDEX IF NOT EXISTS idx_inward_items_variant_id ON inward_items(material_variant_id);
