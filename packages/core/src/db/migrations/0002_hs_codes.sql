create table hs_codes (
  code        text primary key,
  level       smallint not null check (level in (0, 2, 4, 6)),
  parent_code text,
  title_ar    text not null,
  title_en    text not null,
  embedding   vector(1024)
);
create index hs_codes_level_idx on hs_codes (level);
create index hs_codes_embedding_idx on hs_codes using hnsw (embedding vector_cosine_ops);
