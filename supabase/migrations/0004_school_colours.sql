-- School colours: each school picks 0, 1 or 2 colours from the Simpliskool palette.
-- primary_color is the main colour (sidebars, headers, headings); secondary_color is the
-- second colour (buttons and highlights). Empty means "use the Simpliskool colours".
-- Every palette colour has at least 5:1 contrast with white text (WCAG AA).

alter table public.schools alter column primary_color drop not null;
alter table public.schools alter column primary_color drop default;
alter table public.schools alter column secondary_color drop not null;
alter table public.schools alter column secondary_color drop default;

-- Schools still on the old defaults have not chosen colours yet.
update public.schools set primary_color = null where upper(primary_color) = '#173B70';
update public.schools set secondary_color = null where upper(secondary_color) in ('#0F9D84', '#0F9D8A', '#0B7D6E');
update public.schools set primary_color = upper(primary_color), secondary_color = upper(secondary_color);

-- Anything else that is not in the palette is cleared, so the check below can be added.
update public.schools set primary_color = null
where primary_color is not null and primary_color not in (
  '#7A1F2B','#9F1239','#B42318','#BE185D','#9A3412','#7C2D12','#7A5300','#4D5B12','#1E6B3A','#047857',
  '#0E6BA8','#1D4ED8','#173B70','#3730A3','#5B2A86','#86198F','#A21CAF','#334155','#111827','#0B7D6E');
update public.schools set secondary_color = null
where secondary_color is not null and secondary_color not in (
  '#7A1F2B','#9F1239','#B42318','#BE185D','#9A3412','#7C2D12','#7A5300','#4D5B12','#1E6B3A','#047857',
  '#0E6BA8','#1D4ED8','#173B70','#3730A3','#5B2A86','#86198F','#A21CAF','#334155','#111827','#0B7D6E');

-- A second colour only makes sense once there is a main colour, and the two must differ.
update public.schools set primary_color = secondary_color, secondary_color = null
where primary_color is null and secondary_color is not null;
update public.schools set secondary_color = null where secondary_color = primary_color;

alter table public.schools add constraint schools_colours_in_palette check (
  (primary_color is null or primary_color in (
    '#7A1F2B','#9F1239','#B42318','#BE185D','#9A3412','#7C2D12','#7A5300','#4D5B12','#1E6B3A','#047857',
    '#0E6BA8','#1D4ED8','#173B70','#3730A3','#5B2A86','#86198F','#A21CAF','#334155','#111827','#0B7D6E'))
  and (secondary_color is null or secondary_color in (
    '#7A1F2B','#9F1239','#B42318','#BE185D','#9A3412','#7C2D12','#7A5300','#4D5B12','#1E6B3A','#047857',
    '#0E6BA8','#1D4ED8','#173B70','#3730A3','#5B2A86','#86198F','#A21CAF','#334155','#111827','#0B7D6E'))
  and (secondary_color is null or primary_color is not null)
  and (secondary_color is null or secondary_color <> primary_color)
);
