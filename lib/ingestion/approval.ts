const explicitKoreanApprovalPatterns = [
  /^(이대로\s*)?(앱에\s*)?(저장|저장해|저장해줘|저장해\s*줘)(요)?$/,
  /^(이대로\s*)?앱에\s*(넣어|넣어줘|추가해|추가해줘|등록해|등록해줘)(요)?$/,
  /^(이대로\s*)?(추가|추가해|추가해줘|등록|등록해|등록해줘)(요)?$/,
  /^(최종\s*)?(승인|승인해|승인할게)(요)?$/
];

const explicitEnglishApprovalPatterns = [
  /^(save|save this|save it)$/,
  /^(add|add this|add it)( to (the )?app)?$/,
  /^(insert|insert this|insert it)( into (the )?app)?$/,
  /^(approved|approve|approve this)$/
];

const negativeOrRevisionPattern = /(하지마|하지\s*마|말고|아직|나중에|수정|바꿔|고쳐|추가 설명|설명.*추가|예문.*(쉽|바꿔|추가)|\?|아닌가|don't|do not|not yet|later|revise|change|fix|edit)/i;

function normalizeApprovalText(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.!?。！？~…]+$/g, "")
    .replace(/\s+/g, " ");
}

export function isExplicitLessonSaveApproval(text: string) {
  const normalized = normalizeApprovalText(text);
  if (!normalized) return false;
  if (negativeOrRevisionPattern.test(normalized)) return false;

  return [...explicitKoreanApprovalPatterns, ...explicitEnglishApprovalPatterns].some((pattern) => pattern.test(normalized));
}
