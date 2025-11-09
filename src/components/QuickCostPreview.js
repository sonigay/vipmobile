import React, { useState, useEffect } from 'react';
import { api } from '../api';

/**
 * Popup에 표시할 간단한 퀵비용 미리보기 컴포넌트
 */
const QuickCostPreview = ({ fromStoreId, toStoreId, fromStoreName, toStoreName }) => {
  const [quickCostData, setQuickCostData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fromStoreId || !toStoreId) return;

    const fetchQuickCost = async () => {
      setLoading(true);
      try {
        const result = await api.getEstimatedQuickCost(fromStoreId, toStoreId);
        if (result.success && result.data && result.data.length > 0) {
          // 1순위 업체만 표시
          const sorted = [...result.data].sort((a, b) => a.averageCost - b.averageCost);
          setQuickCostData(sorted[0]);
        }
      } catch (err) {
        console.error('퀵비용 조회 오류:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuickCost();
  }, [fromStoreId, toStoreId]);

  if (!fromStoreId || !toStoreId) return null;

  if (loading) {
    return (
      <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px', textAlign: 'center' }}>
        <span style={{ fontSize: '12px', color: '#666' }}>퀵비용 조회 중...</span>
      </div>
    );
  }

  if (!quickCostData) return null;

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

