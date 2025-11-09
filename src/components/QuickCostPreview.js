import React, { useState, useEffect } from 'react';
import { api } from '../api';

/**
 * Popup에 표시할 간단한 퀵비용 미리보기 컴포넌트
 */
const QuickCostPreview = ({ fromStoreId, toStoreId, fromStoreName, toStoreName, onQuickCostClick, refreshKey }) => {
  const [quickCostData, setQuickCostData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fromStoreId || !toStoreId) return;

      const fetchQuickCost = async () => {
        setLoading(true);
        try {
          // refreshKey이 변경되면 캐시를 무시하고 새로 조회
          const skipCache = refreshKey !== undefined && refreshKey !== null;
          const result = await api.getEstimatedQuickCost(fromStoreId, toStoreId, skipCache);
          if (result.success && result.data && result.data.length > 0) {
            // 1순위 업체만 표시
            const sorted = [...result.data].sort((a, b) => a.averageCost - b.averageCost);
            setQuickCostData(sorted[0]);
          } else {
            // 데이터가 없으면 null로 설정
            setQuickCostData(null);
          }
        } catch (err) {
          console.error('퀵비용 조회 오류:', err);
          setQuickCostData(null);
        } finally {
          setLoading(false);
        }
      };

    fetchQuickCost();
  }, [fromStoreId, toStoreId, refreshKey]);

  if (!fromStoreId || !toStoreId) return null;

  if (loading) {
    return (
      <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px', textAlign: 'center' }}>
        <span style={{ fontSize: '12px', color: '#666' }}>퀵비용 조회 중...</span>
      </div>
    );
  }

  // 데이터가 없을 때 안내 메시지 및 등록 버튼 표시
  if (!quickCostData) {
    return (
      <div style={{ 
        marginTop: '8px', 
        padding: '8px', 
        backgroundColor: '#fff3e0', 
        borderRadius: '4px',
        border: '1px solid #ffb74d',
        textAlign: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '16px', marginRight: '4px' }}>📝</span>
          <span style={{ fontSize: '12px', color: '#e65100', fontWeight: 'bold' }}>
            등록된 퀵비용이 없습니다
          </span>
        </div>
        <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>
          퀵비등록 버튼을 눌러 등록해주세요
        </div>
        {onQuickCostClick && (
          <button 
            onClick={() => {
              const fromStore = { id: fromStoreId, name: fromStoreName };
              const toStore = { id: toStoreId, name: toStoreName };
              onQuickCostClick(fromStore, toStore);
            }}
            style={{
              padding: '6px 12px',
              backgroundColor: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
              minWidth: '80px'
            }}
          >
            퀵비등록
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ 
      marginTop: '8px', 
      padding: '8px', 
      backgroundColor: '#e3f2fd', 
      borderRadius: '4px',
      border: '1px solid #90caf9'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '16px', marginRight: '4px' }}>🚚</span>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1976d2' }}>
          예상 퀵비용
        </span>
      </div>
      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1976d2', marginBottom: '2px' }}>
        {quickCostData.averageCost.toLocaleString()}원
      </div>
      <div style={{ fontSize: '11px', color: '#666' }}>
        {quickCostData.companyName} ({quickCostData.entryCount}건)
      </div>
    </div>
  );
};

export default QuickCostPreview;

