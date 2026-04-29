-- Keep memorization cards lightweight: retire stored nuance/structure paragraphs.
update public.expressions
set nuance_note = null,
    structure_note = null
where nuance_note is not null
   or structure_note is not null;
