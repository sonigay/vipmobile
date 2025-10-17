// OB 계산 엔진

export function initialInputs() {
  return {
    existingLines: [
      { lineId: 'E1', customerName: '', planName: '', planGroup: '', contractType: '지원금약정', deviceSupport: 0, addons: [] },
    ],
    togetherLines: [
      { lineId: 'T1', customerName: '', planName: '', planGroup: '', contractType: '지원금약정', deviceSupport: 0, addons: [] },
    ],
    existingBundleType: '', // 기존결합 상품명
    internetIncluded: '미포함', // 인터넷 포함여부 (가무사 유무선용)
    internetSpeed: '', // 인터넷 속도 (100M, 500M, 1G)
    hasInternet: false // 인터넷 회선 포함 여부
  };
}

export function useObCalculation(inputs, planData, discountData, segDiscountData) {
  const existing = computeExisting(
    inputs.existingLines, 
    inputs.existingBundleType, 
    inputs.internetIncluded,
    inputs.internetSpeed,
    inputs.hasInternet,
    planData, 
    segDiscountData
  );
  const together = computeTogether(
    inputs.togetherLines, 
    inputs.internetSpeed,
    inputs.hasInternet,
    planData, 
    segDiscountData
  );
  const diff = (existing.amount || 0) - (together.amount || 0);
  return { existing, together, diff };
}

// 기존결합 계산
function computeExisting(lines, existingBundleType, internetIncluded, internetSpeed, hasInternet, planData, segDiscountData) {
  const planByName = new Map((planData || []).map(p => [p.planName, p]));
  const memberCount = (lines || []).length;
  
  // 먼저 기본료 합계 계산
  let baseFeeSum = 0;
  const tempRows = (lines || []).map((line, idx) => {
    const plan = planByName.get(line.planName) || { baseFee: 0, planGroup: '' };
    const baseFee = Number(plan.baseFee || 0);
    baseFeeSum += baseFee;
    return { line, plan, baseFee, idx };
  });
  
  // 결합할인 계산 (회선당 할인액)
  const perLineBundleDiscount = calculateExistingBundleDiscount(
    existingBundleType,
    memberCount,
    baseFeeSum,
    internetIncluded,
    segDiscountData
  );
  
  const totalBundleDiscount = perLineBundleDiscount * memberCount;
  
  console.log('[OB CALC] Existing Bundle Discount:', {
    bundleType: existingBundleType,
    memberCount,
    baseFeeSum,
    internetIncluded,
    perLineBundleDiscount,
    totalBundleDiscount,
    hasSegData: !!segDiscountData
  });
  
  const rows = tempRows.map(({ line, plan, baseFee, idx }) => {
    const discounts = [];
    
    // 선택약정할인 (기본료 * -0.25)
    if (line.contractType === '선택약정') {
      discounts.push({ name: '선택약정할인', amount: baseFee * -0.25 });
    }
    
    // 프리미어약정할인 (회선별, 85,000원 이상만)
    if (baseFee >= 85000) {
      discounts.push({ name: '프리미어약정할인', amount: -5250 });
    }
    
    // 결합할인 (회선별 분배)
    if (perLineBundleDiscount !== 0) {
      discounts.push({ name: '결합할인', amount: perLineBundleDiscount });
    }
    
    const totalDiscount = discounts.reduce((s, d) => s + (d.amount || 0), 0);
    const total = baseFee + totalDiscount;
    
    return {
      lineNo: idx + 1,
      customerName: line.customerName || '',
      planName: line.planName || '',
      planGroup: plan.planGroup || '',
      baseFee,
      contractType: line.contractType || '지원금약정',
      discounts,
      total
    };
  });
  
  // 인터넷 할인 계산
  const internetDiscount = hasInternet ? calculateInternetDiscount(
    existingBundleType,
    memberCount,
    baseFeeSum,
    internetIncluded,
    internetSpeed,
    segDiscountData
  ) : 0;
  
  const amount = rows.reduce((s, r) => s + r.total, 0) + internetDiscount;
  
  return {
    amount,
    rows,
    bundleDiscount: totalBundleDiscount,
    internetDiscount,
    breakdown: []
  };
}

// 투게더결합 계산
function computeTogether(lines, internetSpeed, hasInternet, planData, segDiscountData) {
  const planByName = new Map((planData || []).map(p => [p.planName, p]));
  const memberCount = (lines || []).length;
  
  let totalPremierDiscount = 0;
  
  // 투게더결합할인 계산 (회선당 할인액)
  const perLineTogetherDiscount = calculateTogetherBundleDiscount(memberCount, segDiscountData);
  const totalTogetherBundleDiscount = perLineTogetherDiscount * memberCount;
  
  console.log('[OB CALC] Together Bundle Discount:', {
    memberCount,
    perLineTogetherDiscount,
    totalTogetherBundleDiscount,
    hasSegData: !!segDiscountData
  });
  
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
    
    // 투게더결합할인 (회선별 분배)
    if (perLineTogetherDiscount !== 0) {
      discounts.push({ name: '투게더할인', amount: perLineTogetherDiscount });
    }
    
    const totalDiscount = discounts.reduce((s, d) => s + (d.amount || 0), 0);
    const total = baseFee + totalDiscount;
    
    return {
      lineNo: idx + 1,
      customerName: line.customerName || '',
      planName: line.planName || '',
      planGroup: plan.planGroup || '',
      baseFee,
      contractType: line.contractType || '지원금약정',
      discounts,
      total
    };
  });
  
  // 투게더 인터넷 할인
  const internetDiscount = hasInternet ? calculateTogetherInternetDiscount(internetSpeed) : 0;
  
  const amount = rows.reduce((s, r) => s + r.total, 0) + internetDiscount;
  
  return {
    amount,
    rows,
    premierDiscount: totalPremierDiscount,
    togetherBundleDiscount: totalTogetherBundleDiscount,
    internetDiscount,
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

// 참쉬운 결합 인터넷 할인 계산
function calculateChamSweInternetDiscount(internetSpeed) {
  // seg)할인 Row 23-26: 100M/-5500, 500M/-9900, 1G/-13200
  const discountMap = {
    '100M': -5500,
    '500M': -9900,
    '1G': -13200,
    '1기가': -13200
  };
  return discountMap[internetSpeed] || 0;
}

// 가무사 유무선 인터넷 할인 계산
function calculateGamusaInternetDiscount(memberCount, baseFeeSum, internetIncluded, internetSpeed, segData) {
  if (!segData || !Array.isArray(segData)) return 0;
  
  // seg)할인 Row 31-36 (idx 31-36): 가무사 유무선 인터넷 할인
  // 65890원 기준, 포함/미포함, 인터넷 속도, 회선수에 따라
  const is65890Above = baseFeeSum >= 65890;
  
  // Row 31: 헤더, Row 32-36: 미포함/포함 데이터
  // Col H(7)=1명, I(8)=2명, J(9)=3명, K(10)=4명, L(11)=5명
  
  let targetRow = -1;
  const speedMap = { '100M': 0, '500M': 1, '1기가': 2, '1G': 2 };
  const speedOffset = speedMap[internetSpeed] !== undefined ? speedMap[internetSpeed] : -1;
  
  if (speedOffset === -1) return 0;
  
  if (internetIncluded === '포함') {
    targetRow = 34 + speedOffset; // Row 34-36 (포함)
  } else {
    targetRow = 31 + speedOffset; // Row 31-33 (미포함)
  }
  
  if (targetRow < 0 || targetRow >= segData.length) return 0;
  
  const row = segData[targetRow] || [];
  const memberColIndex = 7 + (memberCount - 1); // H=7(1명), I=8(2명)...
  
  if (memberColIndex >= row.length) return 0;
  
  return parseNumber(row[memberColIndex]);
}

// 기존결합 인터넷 할인 통합
function calculateInternetDiscount(bundleType, memberCount, baseFeeSum, internetIncluded, internetSpeed, segData) {
  if (!internetSpeed) return 0;
  
  if (bundleType === '참쉬운 결합') {
    return calculateChamSweInternetDiscount(internetSpeed);
  }
  
  if (bundleType === '가무사 유무선') {
    return calculateGamusaInternetDiscount(memberCount, baseFeeSum, internetIncluded, internetSpeed, segData);
  }
  
  return 0;
}

// 투게더 인터넷 할인
function calculateTogetherInternetDiscount(internetSpeed) {
  // 500M: -11000, 1G: -11000
  if (internetSpeed === '500M' || internetSpeed === '1G' || internetSpeed === '1기가') {
    return -11000;
  }
  return 0;
}


