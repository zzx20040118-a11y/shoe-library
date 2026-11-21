CREATE INDEX atlas_shared_anchor ON atlas_records (json_extract(value,'$.anchor')) WHERE json_extract(value,'$.shared') = 1;
