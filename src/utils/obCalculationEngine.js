// OB 계산 엔진(초기 골격)

export function initialInputs() {
  return {
    lines: [
      { lineId: 'L1', planName: '', planGroup: '', segmentCode: '', contractType: '', deviceSupport: 0, addons: [] },
    ],
    household: {}
  };
}

export function useObCalculation(inputs, planData, discountData) {
  // 간단 합산 로직(placeholder): baseFee 합 + 할인 0 처리
  const existing = computeScenario(inputs, planData, discountData, 'existing');
  const together = computeScenario(inputs, planData, discountData, 'together');
  const diff = (existing.amount || 0) - (together.amount || 0);
  return { existing, together, diff };
}

function computeScenario(inputs, planData, discountData, scenarioType) {
  const planByName = new Map((planData || []).map(p => [p.planName, p]));
  const rows = (inputs?.lines || []).map((line, idx) => {
    const plan = planByName.get(line.planName) || { baseFee: 0, planGroup: line.planGroup || '' };
    const base = Number(plan.baseFee || 0);
    // TODO: 할인 로직은 다음 단계에서 반영
    const discounts = [];
    const totalDiscount = discounts.reduce((s, d) => s + (d.amount || 0), 0);
    const total = base + totalDiscount;
    return {
      lineNo: idx + 1,
      planName: line.planName || '',
      planGroup: plan.planGroup || line.planGroup || '',
      baseFee: base,
      discounts,
      total
    };
  });
  const amount = rows.reduce((s, r) => s + (r.total || 0), 0);
  return { amount, rows, breakdown: [] };
}


