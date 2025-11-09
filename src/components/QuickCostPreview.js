import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';

/**
 * Popup에 표시할 간단한 퀵비용 미리보기 컴포넌트
 */
const QuickCostPreview = ({ fromStoreId, toStoreId, fromStoreName, toStoreName, onQuickCostClick, refreshKey }) => {
  const [quickCostList, setQuickCostList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    const savedFavorites = localStorage.getItem('quick-cost-favorites');
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (err) {
        console.error('즐겨찾기 로드 실패:', err);
      }
    }
  }, []);

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
  const bestCompany = topThree[0] || null;

  if (!fromStoreId || !toStoreId) return null;

  if (loading) {
    return (
      <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px', textAlign: 'center' }}>
        <span style={{ fontSize: '12px', color: '#666' }}>퀵비용 조회 중...</span>
      </div>
    );
  }

  const renderAddButton = (label = '다른 업체 등록') => (
    onQuickCostClick ? (
      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={() => {
            const fromStore = { id: fromStoreId, name: fromStoreName };
            const toStore = { id: toStoreId, name: toStoreName };
            onQuickCostClick(fromStore, toStore);
          }}
          style={{
            padding: '6px 12px',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
            minWidth: '100px'
          }}
        >
          {label}
        </button>
      </div>
    ) : null
  );

  if (!bestCompany) {
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
        {renderAddButton('퀵비등록')}
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
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '16px', marginRight: '4px' }}>🚚</span>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1976d2' }}>
          예상 퀵비용
        </span>
      </div>
      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1976d2', marginBottom: '2px' }}>
        {bestCompany.averageCost.toLocaleString()}원
      </div>
      <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>
        {bestCompany.companyName} ({bestCompany.entryCount}건)
      </div>

      {topThree.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '6px',
          justifyContent: 'space-between',
          flexWrap: 'wrap'
        }}>
          {topThree.map((item, index) => {
            const rank = index + 1;
            const isFavorite = favorites.includes(`${item.companyName}-${item.phoneNumber}`);
            return (
              <div
                key={`${item.companyName}-${item.phoneNumber}`}
                style={{
                  flex: '1 1 30%',
                  minWidth: '80px',
                  backgroundColor: rank === 1 ? '#fff' : '#f5f5f5',
                  border: rank === 1 ? '1px solid #1976d2' : '1px solid #e0e0e0',
                  borderRadius: '6px',
                  padding: '6px',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1976d2' }}>
                  {item.averageCost.toLocaleString()}원
                </div>
                <div style={{ fontSize: '11px', color: '#424242', marginTop: '2px' }}>
                  {item.companyName}
                </div>
                <div style={{ fontSize: '10px', color: '#9e9e9e', marginTop: '2px' }}>
                  {rank}순위{isFavorite ? ' ⭐' : ''}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {renderAddButton()}
    </div>
  );
};

export default QuickCostPreview;

