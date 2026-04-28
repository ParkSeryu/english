"use client";

import { useActionState, useMemo, useState } from "react";

import { createCardAction, updateCardAction } from "@/app/actions";
import { FieldError } from "@/components/FieldError";
import type { ActionState, StudyCard } from "@/lib/types";

const initialState: ActionState = { ok: false };

type CardFormProps = {
  card?: StudyCard;
};

export function CardForm({ card }: CardFormProps) {
  const action = useMemo(() => (card ? updateCardAction.bind(null, card.id) : createCardAction), [card]);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [examples, set예문] = useState(() => {
    const initial예문 = card?.examples.map((example) => example.example_text) ?? [""];
    return initial예문.length > 0 ? initial예문 : [""];
  });

  function updateExample(index: number, value: string) {
    set예문((current) => current.map((example, currentIndex) => (currentIndex === index ? value : example)));
  }

  function addExample() {
    set예문((current) => [...current, ""]);
  }

  function removeExample(index: number) {
    set예문((current) => (current.length === 1 ? current : current.filter((_, currentIndex) => currentIndex !== index)));
  }

  return (
    <form action={formAction} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
      <div>
        <label className="label" htmlFor="englishText">
          영어 문장 / 표현
        </label>
        <textarea
          id="englishText"
          name="englishText"
          defaultValue={card?.english_text}
          required
          rows={3}
          className="input min-h-28"
          placeholder="Could you elaborate on that?"
        />
        <FieldError messages={state.fieldErrors?.englishText} />
      </div>

      <div>
        <label className="label" htmlFor="koreanMeaning">
          한국어 뜻
        </label>
        <textarea
          id="koreanMeaning"
          name="koreanMeaning"
          defaultValue={card?.korean_meaning}
          required
          rows={3}
          className="input min-h-24"
          placeholder="그 부분을 좀 더 자세히 설명해 주실 수 있나요?"
        />
        <FieldError messages={state.fieldErrors?.koreanMeaning} />
      </div>

      <div>
        <label className="label" htmlFor="grammarNote">
          문법 / 이론 메모
        </label>
        <textarea
          id="grammarNote"
          name="grammarNote"
          defaultValue={card?.grammar_note}
          required
          rows={4}
          className="input min-h-28"
          placeholder="더 자세한 설명을 정중하게 요청할 때 쓰는 표현입니다."
        />
        <FieldError messages={state.fieldErrors?.grammarNote} />
      </div>

      <fieldset className="space-y-3">
        <legend className="label">예문</legend>
        {examples.map((example, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <label className="sr-only" htmlFor={`example-${index}`}>
              예문 {index + 1}
            </label>
            <textarea
              id={`example-${index}`}
              name="examples"
              value={example}
              onChange={(event) => updateExample(index, event.target.value)}
              required={index === 0}
              rows={2}
              className="input bg-white"
              placeholder="Could you elaborate on your plan for today?"
            />
            <div className="mt-2 flex justify-end">
              <button type="button" onClick={() => removeExample(index)} disabled={examples.length === 1} className="text-sm font-semibold text-slate-500 disabled:opacity-40">
                삭제
              </button>
            </div>
          </div>
        ))}
        <FieldError messages={state.fieldErrors?.examples} />
        <button type="button" onClick={addExample} className="btn-ghost w-full">
          예문 추가
        </button>
      </fieldset>

      {state.message ? <p className="rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700">{state.message}</p> : null}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "저장 중…" : card ? "변경사항 저장" : "카드 만들기"}
      </button>
    </form>
  );
}
