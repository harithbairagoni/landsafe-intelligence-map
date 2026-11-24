create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

create table public.landsafe_demo_parcels (
    id text primary key,
    survey text not null,
    plot text not null,
    village text not null,
    mandal text not null,
    district text not null,
    area text not null,
    bbox double precision[] not null check (
        cardinality(bbox) = 4 and bbox[1] < bbox[3] and bbox[2] < bbox[4]
    ),
    example text not null check (example in ('overlap', 'document', 'unknown')),
    geom extensions.geometry(Polygon, 4326) generated always as (
        extensions.st_makeenvelope(bbox[1], bbox[2], bbox[3], bbox[4], 4326)
    ) stored
);
comment on table public.landsafe_demo_parcels is 'Public, synthetic demonstration geometry only. Never import real records here.';
alter table public.landsafe_demo_parcels enable row level security;
revoke all on table public.landsafe_demo_parcels from anon, authenticated;
grant select (id, survey, plot, village, mandal, district, area, bbox, example)
    on table public.landsafe_demo_parcels to anon, authenticated;
create policy read_synthetic_parcels on public.landsafe_demo_parcels
    for select to anon, authenticated using (true);

insert into public.landsafe_demo_parcels (id, survey, plot, village, mandal, district, area, bbox, example)
values
    ('ls-042', '42/1', '12', 'Demo revenue village', 'Serilingampally', 'Ranga Reddy', '1,840 m²',
        array[78.32776,17.46715,78.32816,17.46753], 'overlap'),
    ('ls-043', '43/2', '14', 'Demo revenue village', 'Serilingampally', 'Ranga Reddy', '1,275 m²',
        array[78.32824,17.46722,78.32863,17.46752], 'document'),
    ('ls-044', '44', '18', 'Demo revenue village', 'Serilingampally', 'Ranga Reddy', '2,090 m²',
        array[78.32804,17.46670,78.32852,17.46708], 'unknown');
