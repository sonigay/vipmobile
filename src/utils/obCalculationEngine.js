// OB 계산 엔진

export function initialInputs() {
  return {
    lines: [
      { lineId: 'L1', planName: '', planGroup: '', contractType: '지원금약정', deviceSupport: 0, addons: [] },
    ],
    household: {},
    existingBundleType: '', // 기존결합 상품명
    internetIncluded: '미포함' // 인터넷 포함여부
  };
}

export function useObCalculation(inputs, planData, discountData, segDiscountData) {
  const existing = computeExisting(inputs, planData, segDiscountData);
  const together = computeTogether(inputs, planData, segDiscountData);
  const diff = (existing.amount || 0) - (together.amount || 0);
  return { existing, together, diff };
}

// 기존결합 계산
function computeExisting(inputs, planData, segDiscountData) {
  const planByName = new Map((planData || []).map(p => [p.planName, p]));
  const lines = inputs?.lines || [];
  const memberCount = lines.length;
  
  const rows = lines.map((line, idx) => {
    const plan = planByName.get(line.planName) || { baseFee: 0, planGroup: '' };
    const baseFee = Number(plan.baseFee || 0);
    
    const discounts = [];
    
    // 선택약정할인 (기본료 * -0.25)
    if (line.contractType === '선택약정') {
      discounts.push({ name: '선택약정할인', amount: baseFee * -0.25 });
    }
    
    const totalDiscount = discounts.reduce((s, d) => s + (d.amount || 0), 0);
    const total = baseFee + totalDiscount;
    
    return {
      lineNo: idx + 1,
      planName: line.planName || '',
      planGroup: plan.planGroup || '',
      baseFee,
      contractType: line.contractType || '지원금약정',
      discounts,
      total
    };
  });
  
  // 기본료 합계
  const baseFeeSum = rows.reduce((s, r) => s + r.baseFee, 0);
  
  // 결합할인 계산 (상품별 로직)
  const bundleDiscount = calculateExistingBundleDiscount(
    inputs.existingBundleType,
    memberCount,
    baseFeeSum,
    inputs.internetIncluded,
    segDiscountData
  );
  
  const amount = rows.reduce((s, r) => s + r.total, 0) + bundleDiscount;
  
  return {
    amount,
    rows,
    bundleDiscount,
    breakdown: []
  };
}

// 투게더결합 계산
function computeTogether(inputs, planData, segDiscountData) {
  const planByName = new Map((planData || []).map(p => [p.planName, p]));
  const lines = inputs?.lines || [];
  const memberCount = lines.length;
  
  const rows = lines.map((line, idx) => {
    const plan = planByName.get(line.planName) || { baseFee: 0, planGroup: '' };
    const baseFee = Number(plan.baseFee || 0);
    
    const discounts = [];
    
    // 선택약정할인
    if (line.contractType === '선택약정') {
      discounts.push({ name: '선택약정할인', amount: baseFee * -0.25 });
    }
    
    const totalDiscount = discounts.reduce((s, d) => s + (d.amount || 0), 0);
    const total = baseFee + totalDiscount;
    
    return {
      lineNo: idx + 1,
      planName: line.planName || '',
      planGroup: plan.planGroup || '',
      baseFee,
      contractType: line.contractType || '지원금약정',
      discounts,
      total
    };
  });
  
  const baseFeeSum = rows.reduce((s, r) => s + r.baseFee, 0);
  
  // 프리미어약정할인 (투게더 전체에 적용)
  const premierDiscount = baseFeeSum >= 85000 ? -5250 : 0;
  
  // 투게더결합할인 (seg)할인 C2:D7에서 구성원 수로 조회)
  const togetherBundleDiscount = calculateTogetherBundleDiscount(memberCount, segDiscountData);
  
  const amount = rows.reduce((s, r) => s + r.total, 0) + premierDiscount + togetherBundleDiscount;
  
  return {
    amount,
    rows,
    premierDiscount,
    togetherBundleDiscount,
    breakdown: []
  };
}

// 기존결합 할인 계산
function calculateExistingBundleDiscount(bundleType, memberCount, baseFeeSum, internetIncluded, segData) {
  if (!bundleType || !segData) return 0;
  
  // seg)할인 데이터를 파싱 (C2:D7, C9:E15, C17:F27, C30:M37)
  const data = segData || [];
  
  // 가무사 무무선 (C9:E15, row 9-15 in sheet = index 8-14 in array)
  if (bundleType === '가무사 무무선') {
    const table = extractTable(data, 8, 2, 4); // C9:E15 = rows 8-14, cols C-E (2-4)
    if (baseFeeSum >= 48400) {
      return vlookup(memberCount, table, 1); // 2nd column (D)
    } else if (baseFeeSum > 0) {
      return vlookup(memberCount, table, 2); // 3rd column (E)
    }
  }
  
  // 참쉬운 결합 (C17:F27)
  if (bundleType === '참쉬운 결합') {
    const table = extractTable(data, 16, 2, 5); // C17:F27 = rows 16-26, cols C-F (2-5)
    if (baseFeeSum >= 80000) {
      return vlookup(memberCount, table, 3); // 4th column (F)
    } else if (baseFeeSum >= 62000) {
      return vlookup(memberCount, table, 2); // 3rd column (E)
    } else if (baseFeeSum < 62000) {
      return vlookup(memberCount, table, 1); // 2nd column (D)
    }
  }
  
  // 가무사 유무선 (C30:M37)
  if (bundleType === '가무사 유무선') {
    const table = extractTable(data, 29, 2, 12); // C30:M37 = rows 29-36, cols C-M (2-12)
    if (internetIncluded === '포함') {
      const discount = vlookup(memberCount, table, 2); // 3rd column (E)
      return discount / memberCount; // 인당 할인
    } else {
      const discount = vlookup(memberCount, table, 1); // 2nd column (D)
      return discount / memberCount;
    }
  }
  
  // 한방에YO
  if (bundleType === '한방에YO') {
    return baseFeeSum > 48400 ? -8800 : -5500;
  }
  
  return 0;
}

// 투게더결합 할인 계산
function calculateTogetherBundleDiscount(memberCount, segData) {
  if (!segData) return 0;
  const data = segData || [];
  // C2:D7 = rows 1-6, cols C-D (2-3)
  const table = extractTable(data, 1, 2, 3);
  return vlookup(memberCount, table, 1); // 2nd column (D)
}

// 헬퍼: 시트 데이터에서 특정 범위 추출
function extractTable(data, startRow, startCol, endCol) {
  const rows = [];
  for (let r = startRow; r < data.length && r < startRow + 20; r++) {
    const row = data[r] || [];
    const extracted = [];
    for (let c = startCol; c <= endCol; c++) {
      extracted.push(row[c] || '');
    }
    if (extracted.some(v => v !== '')) {
      rows.push(extracted);
    }
  }
  return rows;
}

// VLOOKUP 구현 (1열 기준으로 조회, colIndex는 0-based)
function vlookup(lookupValue, table, colIndex) {
  for (const row of table) {
    const key = Number(row[0]) || 0;
    if (key === lookupValue) {
      const val = row[colIndex] || 0;
      return typeof val === 'number' ? val : (Number((val + '').replace(/,/g, '')) || 0);
    }
  }
  return 0;
}


