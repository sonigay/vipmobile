import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';

/**
 * Popup에 표시할 간단한 퀵비용 미리보기 컴포넌트
 */
const QuickCostPreview = ({ fromStoreId, toStoreId, fromStoreName, toStoreName, onQuickCostClick, refreshKey }) => {
  const [quickCostList, setQuickCostList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState([]);

  const loadFavorites = () => {
    const savedFavorites = localStorage.getItem('quick-cost-favorites');
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (err) {
        console.error('즐겨찾기 로드 실패:', err);
      }
    } else {
      setFavorites([]);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [refreshKey, fromStoreId, toStoreId]);

  useEffect(() => {
    if (!fromStoreId || !toStoreId) {
      setQuickCostList([]);
      return;
    }

    setQuickCostList([]);
    setLoading(true);

    const fetchQuickCost = async () => {
      try {
        const skipCache = refreshKey !== undefined && refreshKey !== null && refreshKey > 0;
        console.log('🔍 QuickCostPreview 조회 시작:', {
          fromStoreId,
          toStoreId,
          refreshKey,
          skipCache
        });

        const result = await api.getEstimatedQuickCost(fromStoreId, toStoreId, skipCache);

        console.log('🔍 QuickCostPreview 조회 결과:', {
          success: result.success,
          dataLength: result.data?.length || 0,
          data: result.data,
          error: result.error
        });

        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
          const sorted = [...result.data].sort((a, b) => a.averageCost - b.averageCost);
          setQuickCostList(sorted);
          console.log('✅ QuickCostPreview 데이터 설정 완료:', sorted[0]);
        } else {
          setQuickCostList([]);
          console.log('⚠️ QuickCostPreview 데이터 없음');
        }
      } catch (err) {
        console.error('❌ QuickCostPreview 조회 오류:', err);
        setQuickCostList([]);
      } finally {
        setLoading(false);
      }
    };

    fetchQuickCost();
  }, [fromStoreId, toStoreId, refreshKey]);

  const sortedForPreview = useMemo(() => {
    const list = [...quickCostList];
    return list.sort((a, b) => {
      const aKey = `${a.companyName}-${a.phoneNumber}`;
      const bKey = `${b.companyName}-${b.phoneNumber}`;
      const aFav = favorites.includes(aKey);
      const bFav = favorites.includes(bKey);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return a.averageCost - b.averageCost;
    });
  }, [quickCostList, favorites]);

  const topThree = sortedForPreview.slice(0, 3);

  if (!fromStoreId || !toStoreId) return null;

  const renderAddButton = (label = '다른 업체 등록') => (
    onQuickCostClick ? (
      <button
        onClick={() => {
          const fromStore = { id: fromStoreId, name: fromStoreName };
          const toStore = { id: toStoreId, name: toStoreName };
          onQuickCostClick(fromStore, toStore);
        }}
        style={{
          padding: '4px 10px',
          backgroundColor: '#1976d2',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 'bold',
          cursor: 'pointer',
          minWidth: '90px'
        }}
      >
        {label}
      </button>
    ) : null
  );

  const renderHeader = () => (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '6px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontSize: '16px' }}>🚚</span>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1976d2' }}>
          예상 퀵비용
        </span>
      </div>
      {renderAddButton()}
    </div>
  );

  if (loading) {
    return (
      <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        {renderHeader()}
        <div style={{ textAlign: 'center', padding: '6px 0' }}>
          <span style={{ fontSize: '12px', color: '#666' }}>퀵비용 조회 중...</span>
        </div>
      </div>
    );
  }

  if (!topThree.length) {
    return (
      <div style={{
        marginTop: '8px',
        padding: '8px',
        backgroundColor: '#fff3e0',
        borderRadius: '4px',
        border: '1px solid #ffb74d'
      }}>
        {renderHeader()}
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: '12px', color: '#e65100', fontWeight: 'bold', marginBottom: '4px' }}>
            등록된 퀵비용이 없습니다
          </div>
          <div style={{ fontSize: '11px', color: '#666' }}>
            새로운 업체 정보를 등록해주세요
          </div>
        </div>
      </div>
    );
  }

  const topThreeBoxes = topThree.map((item, index) => {
    const rank = index + 1;
    const isFavorite = favorites.includes(`${item.companyName}-${item.phoneNumber}`);
    return (
      <div
        key={`${item.companyName}-${item.phoneNumber}`}
        style={{
          flex: '1 1 30%',
          minWidth: '80px',
          backgroundColor: '#ffffff',
          border: '1px solid #bbdefb',
          borderRadius: '6px',
          padding: '6px',
          textAlign: 'center',
          boxShadow: '0 1px 2px rgba(25, 118, 210, 0.12)'
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1976d2', marginBottom: '2px' }}>
          {item.averageCost.toLocaleString()}원
        </div>
        <div style={{ fontSize: '10px', color: '#424242', marginBottom: '2px' }}>
          {item.companyName} ({item.entryCount}건)
        </div>
        <div style={{ fontSize: '10px', color: '#616161' }}>
          {rank}순위{isFavorite ? ' ⭐' : ''}
        </div>
      </div>
    );
  });

  return (
    <div style={{
      marginTop: '8px',
      padding: '8px',
      backgroundColor: '#e3f2fd',
      borderRadius: '4px',
      border: '1px solid #90caf9'
    }}>
      {renderHeader()}
      <div style={{ display: 'flex', gap: '6px', justifyContent: 'space-between' }}>
        {topThreeBoxes}
      </div>
    </div>
  );
};

export default QuickCostPreview;

