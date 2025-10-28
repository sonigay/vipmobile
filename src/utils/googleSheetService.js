const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;
const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const API_URL = process.env.REACT_APP_API_URL;

export async function fetchGoogleSheetData() {
  try {
    // 서버 API에서 매장 데이터 가져오기
    const response = await fetch(`${API_URL}/api/stores`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const storesData = await response.json();

    // 매장 데이터 변환
    const stores = storesData.map(store => ({
      id: store.id,
      name: store.name,
      address: store.address,
      latitude: parseFloat(store.latitude || 0),
      longitude: parseFloat(store.longitude || 0),
      inventory: store.inventory || {}  // 재고 정보 포함
    }));

    // 재고 데이터 변환 (모든 모델과 색상 정보 수집)
    const inventory = [];
    const modelSet = new Set();
    const colorsByModel = new Map();

    // 모든 매장의 재고 정보를 순회하며 모델과 색상 정보 수집
    storesData.forEach(store => {
      if (store.inventory) {
        Object.entries(store.inventory).forEach(([model, colors]) => {
          modelSet.add(model);
          if (!colorsByModel.has(model)) {
            colorsByModel.set(model, new Set());
          }
          Object.entries(colors).forEach(([color, quantity]) => {
            colorsByModel.get(model).add(color);
            inventory.push({
              storeId: store.id,
              model,
              color,
              quantity: parseInt(quantity, 10) || 0
            });
          });
        });
      }
    });

    // 모델과 색상 정보를 정렬된 배열로 변환
    const models = Array.from(modelSet).sort();
    const colorsByModelMap = {};
    models.forEach(model => {
      colorsByModelMap[model] = Array.from(colorsByModel.get(model)).sort();
    });

    return {
      stores,
      inventory,
      models,
      colorsByModel: colorsByModelMap
    };
  } catch (error) {
    console.error('Failed to fetch data from server:', error);
    throw error;
  }
} 