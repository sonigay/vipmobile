import React from 'react';
import './StoreList.css';
import { Typography, Paper } from '@mui/material';
import LocalMallIcon from '@mui/icons-material/LocalMall';
import LocationOnIcon from '@mui/icons-material/LocationOn';

const StoreList = ({ stores, selectedStore, onStoreSelect, selectedModel, selectedColor }) => {
  // 재고 수량 계산 함수
  const calculateInventory = (store) => {
    if (!store.inventory) return 0;
    
    // 모델과 색상 모두 선택되지 않은 경우: 총 재고
    if (!selectedModel) {
      return Object.entries(store.inventory).reduce((total, [model, colors]) => {
        return total + Object.values(colors).reduce((sum, quantity) => sum + quantity, 0);
      }, 0);
    }
    
    // 해당 모델의 재고가 없는 경우
    if (!store.inventory[selectedModel]) return 0;
    
    // 모델만 선택된 경우: 해당 모델의 전체 재고
    if (!selectedColor) {
      return Object.values(store.inventory[selectedModel]).reduce((sum, quantity) => sum + quantity, 0);
    }
    
    // 모델과 색상 모두 선택된 경우: 해당 모델/색상의 재고
    return store.inventory[selectedModel][selectedColor] || 0;
  };

  // 매장 정렬 함수
  const sortStores = (storeList) => {
    return [...storeList].sort((a, b) => {
      const inventoryA = calculateInventory(a);
      const inventoryB = calculateInventory(b);
      
      // 재고 있음/없음 비교 (재고 있는 매장이 우선)
      if ((inventoryA > 0) !== (inventoryB > 0)) {
        return inventoryB > 0 ? 1 : -1;
      }
      
      // 재고가 같은 경우 거리순 정렬
      return (a.distance || Infinity) - (b.distance || Infinity);
    });
  };

  // 빈 ID를 가진 매장 제외하고 정렬
  const validStores = stores.filter(store => store.id && store.id.trim() !== '');
  const sortedStores = sortStores(validStores);

  return (
    <div className="store-list-container">
      <Typography variant="h6" className="store-list-header">
        매장 목록 ({validStores.length}개)
      </Typography>
      
      {validStores.length === 0 ? (
        <Paper className="no-stores-message">
          <Typography variant="body1">
            표시할 매장이 없습니다.
          </Typography>
        </Paper>
      ) : (
        <div className="stores-grid">
          {sortedStores.map((store) => {
            const inventoryCount = calculateInventory(store);
            const hasInventory = inventoryCount > 0;
            // 매장 ID와 업체명을 조합하여 고유 키 생성
            const storeKey = `${store.id}_${store.name}`;
            
            return (
              <Paper 
                key={storeKey}
                className={`store-card ${hasInventory ? 'has-inventory' : ''} ${selectedStore?.id === store.id ? 'selected' : ''}`}
                onClick={() => onStoreSelect(store)}
              >
                <div className="store-card-content">
                  <Typography className="store-name" variant="subtitle1">
                    {store.name}
                  </Typography>
                  
                  <div className="store-info">
                    <div className="info-row">
                      <LocationOnIcon className="info-icon" />
                      <Typography variant="body2">
                        {store.distance?.toFixed(1)}km
                      </Typography>
                    </div>
                    
                    <div className="info-row">
                      <LocalMallIcon className="info-icon" />
                      <Typography 
                        variant="body2"
                        className={hasInventory ? 'inventory-available' : 'inventory-unavailable'}
                      >
                        재고: {inventoryCount}대
                        {selectedModel && (
                          <span className="model-info">
                            {selectedModel}{selectedColor ? ` - ${selectedColor}` : ' 전체'}
                          </span>
                        )}
                      </Typography>
                    </div>
                  </div>
                </div>
              </Paper>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StoreList; 