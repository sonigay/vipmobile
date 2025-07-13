// 매장 데이터와 재고 데이터를 로컬 파일에서 관리

// 매장 데이터 가져오기 함수
export async function fetchStoreData() {
  try {
    // 실제 서버 API 엔드포인트로 변경 예정
    const response = await fetch('/data/stores.json');
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const stores = await response.json();
    return stores;
  } catch (error) {
    console.error('매장 데이터 가져오기 실패:', error);
    alert('매장 데이터를 불러오는데 실패했습니다. 새로고침 해주세요.');
    return [];
  }
}

// 재고 데이터 가져오기 함수
export async function fetchInventoryData() {
  try {
    // 실제 서버 API 엔드포인트로 변경 예정
    const response = await fetch('/data/inventory.json');
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const inventory = await response.json();
    return inventory;
  } catch (error) {
    console.error('재고 데이터 가져오기 실패:', error);
    alert('재고 데이터를 불러오는데 실패했습니다.');
    return [];
  }
}
