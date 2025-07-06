// 모델 및 색상 관리 유틸리티

// 전체 데이터에서 사용 가능한 모델과 색상 추출
export const extractAvailableModels = (data) => {
  const models = new Set();
  const colors = new Set();
  const modelColors = new Map(); // 모델별 사용 가능한 색상

  if (!data || !Array.isArray(data)) {
    console.log('extractAvailableModels: 데이터가 없거나 배열이 아님');
    return { models: [], colors: [], modelColors: new Map() };
  }

  console.log('extractAvailableModels: 데이터 처리 시작, 매장 수:', data.length);

  data.forEach((store, index) => {
    if (store.inventory) {
      console.log(`매장 ${index + 1} (${store.name || store.id}): inventory 존재`);
      
      // 각 카테고리별로 모델과 색상 추출
      Object.entries(store.inventory).forEach(([category, categoryData]) => {
        if (categoryData && typeof categoryData === 'object') {
          console.log(`  카테고리 ${category}:`, Object.keys(categoryData));
          
          Object.entries(categoryData).forEach(([model, modelData]) => {
            models.add(model);
            console.log(`    모델 추가: ${model}`);
            
            if (modelData && typeof modelData === 'object') {
              Object.entries(modelData).forEach(([status, statusData]) => {
                if (statusData && typeof statusData === 'object') {
                  Object.keys(statusData).forEach(color => {
                    colors.add(color);
                    
                    // 모델별 색상 매핑
                    if (!modelColors.has(model)) {
                      modelColors.set(model, new Set());
                    }
                    modelColors.get(model).add(color);
                    console.log(`      색상 추가: ${model} - ${color}`);
                  });
                }
              });
            }
          });
        }
      });
    } else {
      console.log(`매장 ${index + 1} (${store.name || store.id}): inventory 없음`);
    }
  });

  const result = {
    models: Array.from(models).sort(),
    colors: Array.from(colors).sort(),
    modelColors: new Map(
      Array.from(modelColors.entries()).map(([model, colorSet]) => [
        model, 
        Array.from(colorSet).sort()
      ])
    )
  };

  console.log('extractAvailableModels 결과:', result);
  return result;
};

// 특정 모델의 사용 가능한 색상 가져오기
export const getColorsForModel = (modelColors, model) => {
  return modelColors.get(model) || [];
};

// 모델과 색상의 유효성 검사
export const validateModelAndColor = (modelColors, model, color) => {
  const availableColors = modelColors.get(model);
  return availableColors && availableColors.includes(color);
};

// 카테고리별 모델 분류
export const categorizeModels = (data) => {
  const categories = {
    phones: new Set(),
    sims: new Set(),
    wearables: new Set(),
    smartDevices: new Set()
  };

  if (!data || !Array.isArray(data)) {
    return {
      phones: [],
      sims: [],
      wearables: [],
      smartDevices: []
    };
  }

  data.forEach(store => {
    if (store.inventory) {
      Object.entries(store.inventory).forEach(([category, categoryData]) => {
        if (categoryData && typeof categoryData === 'object') {
          Object.keys(categoryData).forEach(model => {
            if (categories[category]) {
              categories[category].add(model);
            }
          });
        }
      });
    }
  });

  return {
    phones: Array.from(categories.phones).sort(),
    sims: Array.from(categories.sims).sort(),
    wearables: Array.from(categories.wearables).sort(),
    smartDevices: Array.from(categories.smartDevices).sort()
  };
};

// 모델별 재고 현황 요약
export const getModelInventorySummary = (data, model, color = null) => {
  let totalQuantity = 0;
  let storeCount = 0;
  const stores = [];

  if (!data || !Array.isArray(data)) {
    return { totalQuantity: 0, storeCount: 0, stores: [], avgQuantity: 0, maxQuantity: 0 };
  }

  data.forEach(store => {
    if (store.inventory) {
      let storeQuantity = 0;
      
      Object.entries(store.inventory).forEach(([category, categoryData]) => {
        if (categoryData && categoryData[model]) {
          Object.entries(categoryData[model]).forEach(([status, statusData]) => {
            if (statusData) {
              if (color) {
                // 특정 색상의 수량
                const qty = statusData[color];
                if (typeof qty === 'object' && qty !== null && qty.quantity) {
                  storeQuantity += qty.quantity || 0;
                } else if (typeof qty === 'number') {
                  storeQuantity += qty || 0;
                }
              } else {
                // 모든 색상의 수량
                Object.values(statusData).forEach(qty => {
                  if (typeof qty === 'object' && qty !== null && qty.quantity) {
                    storeQuantity += qty.quantity || 0;
                  } else if (typeof qty === 'number') {
                    storeQuantity += qty || 0;
                  }
                });
              }
            }
          });
        }
      });

      if (storeQuantity > 0) {
        totalQuantity += storeQuantity;
        storeCount++;
        stores.push({
          id: store.id,
          name: store.name,
          quantity: storeQuantity
        });
      }
    }
  });

  // 평균 수량과 최대 수량 계산
  const avgQuantity = storeCount > 0 ? Math.round(totalQuantity / storeCount) : 0;
  const maxQuantity = stores.length > 0 ? Math.max(...stores.map(s => s.quantity)) : 0;

  return { totalQuantity, storeCount, stores, avgQuantity, maxQuantity };
}; 