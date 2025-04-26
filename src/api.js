const API_URL = process.env.REACT_APP_API_URL;

export async function fetchData() {
  try {
    const response = await fetch(`${API_URL}/api/stores`);
    const data = await response.json();
    
    console.log('\n=== 서버 응답 데이터 전체 구조 ===');
    console.log('매장 데이터 예시:', data[0]);

    // inventory 필드를 phoneData로 변환
    const processedData = data.map(store => {
      // inventory 데이터를 phoneData 배열로 변환
      let phoneData = [];
      
      if (store.inventory && typeof store.inventory === 'object') {
        // 각 모델에 대해
        Object.entries(store.inventory).forEach(([model, colorData]) => {
          // 각 색상에 대해
          if (typeof colorData === 'object' && colorData !== null) {
            Object.entries(colorData).forEach(([color, quantity]) => {
              // quantity가 있는 경우에만 추가
              if (quantity && quantity > 0) {
                phoneData.push({
                  N: store.name,    // 매장명
                  F: model,         // 모델명
                  G: color,         // 색상
                  quantity: Number(quantity)  // 수량
                });
              }
            });
          }
        });
      }

      if (store.name === "승텔레콤(인천부평)") {
        console.log('\n=== 승텔레콤 매장 데이터 변환 ===');
        console.log('원본 데이터:', {
          매장명: store.name,
          inventory: store.inventory
        });
        console.log('변환된 phoneData:', phoneData);
        console.log('phoneData 항목 수:', phoneData.length);
      }

      // phoneCount 계산 (모든 모델의 수량 합계)
      const phoneCount = phoneData.reduce((sum, item) => sum + (item.quantity || 0), 0);

      return {
        ...store,
        phoneData,
        phoneCount,
        hasInventory: phoneCount > 0
      };
    });

    // 재고 현황 요약
    console.log('\n=== 재고 현황 요약 ===');
    const summary = processedData
      .filter(store => store.phoneCount > 0)
      .map(store => ({
        매장명: store.name,
        재고수량: store.phoneCount,
        재고상세: store.phoneData.map(item => ({
          모델명: item.F,
          색상: item.G,
          수량: item.quantity
        }))
      }));
    
    console.log(JSON.stringify(summary, null, 2));

    return { success: true, data: processedData };
  } catch (error) {
    console.error('데이터 가져오기 오류:', error);
    console.error('에러 상세:', {
      메시지: error.message,
      스택: error.stack
    });
    return { success: false, error };
  }
}

export async function fetchModels() {
  try {
    console.log('모델 데이터 요청 시작');
    const response = await fetch(`${API_URL}/api/models`);
    const data = await response.json();
    
    console.log('서버로부터 받은 모델 데이터:', data);

    // 이미 정리된 모델/색상 데이터를 그대로 사용
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching models:', error);
    return { success: false, error };
  }
}

/**
 * 대리점 정보를 가져오는 함수
 * @returns {Promise<Array>} 대리점 정보 배열
 */
export const fetchAgentData = async () => {
  try {
    const response = await fetch(`${API_URL}/api/agents`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch agent data');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching agent data:', error);
    return [];
  }
}; 