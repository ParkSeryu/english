-- Remove verbose/routine grammar explanations from lightweight memorization cards.
update public.expressions
set grammar_note = null
where grammar_note is not null
  and (
    char_length(grammar_note) > 80
    or grammar_note ~* '(현재시제|과거시제|미래시제|현재의\s*일반적인\s*사실|일반적인\s*사실|체질|문맥상|암기|원문\s*그대로|present tense|past tense|future tense|context)'
  );
