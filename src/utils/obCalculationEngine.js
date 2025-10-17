// OB 계산 엔진

export function initialInputs() {
  return {
    existingLines: [
      { lineId: 'E1', planName: '', planGroup: '', contractType: '지원금약정', deviceSupport: 0, addons: [] },
    ],
    togetherLines: [
      { lineId: 'T1', planName: '', planGroup: '', contractType: '지원금약정', deviceSupport: 0, addons: [] },
    ],
    existingBundleType: '', // 기존결합 상품명
    internetIncluded: '미포함' // 인터넷 포함여부
  };
}

export function useObCalculation(inputs, planData, discountData, segDiscountData) {
  const existing = computeExisting(inputs.existingLines, inputs.existingBundleType, inputs.internetIncluded, planData, segDiscountData);
  const together = computeTogether(inputs.togetherLines, planData, segDiscountData);
  const diff = (existing.amount || 0) - (together.amount || 0);
  return { existing, together, diff };
}

// 기존결합 계산
function computeExisting(lines, existingBundleType, internetIncluded, planData, segDiscountData) {
  const planByName = new Map((planData || []).map(p => [p.planName, p]));
  const memberCount = (lines || []).length;
  
  const rows = (lines || []).map((line, idx) => {
    const plan = planByName.get(line.planName) || { baseFee: 0, planGroup: '' };
    const baseFee = Number(plan.baseFee || 0);
    
    const discounts = [];
    
    // 선택약정할인 (기본료 * -0.25)
    if (line.contractType === '선택약정') {
      discounts.push({ name: '선택약정할인', amount: baseFee * -0.25 });
    }
    
    // 프리미어약정할인 (회선별, 85,000원 이상만)
    if (baseFee >= 85000) {
      discounts.push({ name: '프리미어약정할인', amount: -5250 });
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
    existingBundleType,
    memberCount,
    baseFeeSum,
    internetIncluded,
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
function computeTogether(lines, planData, segDiscountData) {
  const planByName = new Map((planData || []).map(p => [p.planName, p]));
  const memberCount = (lines || []).length;
  
  let totalPremierDiscount = 0;
  
  const rows = (lines || []).map((line, idx) => {
    const plan = planByName.get(line.planName) || { baseFee: 0, planGroup: '' };
    const baseFee = Number(plan.baseFee || 0);
    
    const discounts = [];
    
    // 선택약정할인
    if (line.contractType === '선택약정') {
      discounts.push({ name: '선택약정할인', amount: baseFee * -0.25 });
    }
    
    // 프리미어약정할인 (회선별, 85,000원 이상만)
    if (baseFee >= 85000) {
      discounts.push({ name: '프리미어약정할인', amount: -5250 });
      totalPremierDiscount += -5250;
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
  
  // 투게더결합할인 (seg)할인 C2:D7에서 구성원 수로 조회)
  const togetherBundleDiscount = calculateTogetherBundleDiscount(memberCount, segDiscountData);
  
  const amount = rows.reduce((s, r) => s + r.total, 0) + togetherBundleDiscount;
  
  return {
    amount,
    rows,
    premierDiscount: totalPremierDiscount,
    togetherBundleDiscount,
    breakdown: []
  };
}

// 기존결합 할인 계산
function calculateExistingBundleDiscount(bundleType, memberCount, baseFeeSum, internetIncluded, segData) {
  if (!bundleType || !segData || !Array.isArray(segData)) return 0;
  
  // seg)할인 시트 구조:
  // Row 9-14(idx 9-14): 가무사 무무선 - C(인원수) D(48400원↑) E(22000~48400)
  // Row 18-22(idx 18-22): 참쉬운 결합 - C(인원수) D(69000↓) E(69000↑) F(88000↑)
  // Row 31-36(idx 31-36): 가무사 유무선 - C(인원수) D(미포함) E(포함)
  
  // 가무사 무무선
  if (bundleType === '가무사 무무선') {
    for (let i = 10; i <= 14; i++) {
      const row = segData[i] || [];
      const personCount = Number(row[2]) || 0;
      if (personCount === memberCount) {
        if (baseFeeSum >= 48400) {
          return parseNumber(row[3]); // D열: 48400원↑
        } else if (baseFeeSum > 0) {
          return parseNumber(row[4]); // E열: 22000~48400
        }
      }
    }
  }
  
  // 참쉬운 결합
  if (bundleType === '참쉬운 결합') {
    for (let i = 19; i <= 22; i++) {
      const row = segData[i] || [];
      const personCount = Number(row[2]) || 0;
      if (personCount === memberCount) {
        if (baseFeeSum >= 88000) {
          return parseNumber(row[5]); // F열: 88000↑
        } else if (baseFeeSum >= 69000) {
          return parseNumber(row[4]); // E열: 69000↑
        } else {
          return parseNumber(row[3]); // D열: 69000↓
        }
      }
    }
  }
  
  // 가무사 유무선
  if (bundleType === '가무사 유무선') {
    for (let i = 32; i <= 36; i++) {
      const row = segData[i] || [];
      const personCount = Number(row[2]) || 0;
      if (personCount === memberCount) {
        if (internetIncluded === '포함') {
          return parseNumber(row[4]); // E열: 포함
        } else {
          return parseNumber(row[3]); // D열: 미포함
        }
      }
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
  if (!segData || !Array.isArray(segData)) return 0;
  // seg)할인 시트 구조:
  // Row 1(idx 1): 헤더 ['', '', '투게더', '할인금액', ...]
  // Row 2-6(idx 2-6): 1~5명 데이터
  // Col C(idx 2): 인원수, Col D(idx 3): 할인금액
  
  for (let i = 2; i < Math.min(segData.length, 7); i++) {
    const row = segData[i] || [];
    const personCount = Number(row[2]) || 0;
    if (personCount === memberCount) {
      const discount = row[3] || '0';
      return parseNumber(discount);
    }
  }
  return 0;
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
      return parseNumber(val);
    }
  }
  return 0;
}

// 숫자 파싱 헬퍼
function parseNumber(val) {
  if (typeof val === 'number') return val;
  const str = (val + '').replace(/,/g, '').replace(/\s/g, '').trim();
  return Number(str) || 0;
}


