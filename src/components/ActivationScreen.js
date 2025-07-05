import React, { useState, useEffect } from 'react';
import { 
  fetchCurrentMonthData, 
  fetchPreviousMonthData, 
  generateStoreActivationComparison,
  filterActivationByAgent,
  calculateActivationStats,
  calculateAgentStats
} from '../utils/activationService';
import './FilterPanel.css';

const ActivationScreen = ({ userInfo, onBack }) => {
  const [activeTab, setActiveTab] = useState('store');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentMonthData, setCurrentMonthData] = useState([]);
  const [previousMonthData, setPreviousMonthData] = useState([]);
  const [storeComparisonData, setStoreComparisonData] = useState({});
  const [filteredData, setFilteredData] = useState({});
  const [storeStats, setStoreStats] = useState({});
  const [agentStats, setAgentStats] = useState({});

  // 데이터 로드
  useEffect(() => {
    loadActivationData();
  }, []);

  // 담당자 필터링 적용
  useEffect(() => {
    if (userInfo && userInfo.userType === 'agent' && userInfo.targetName) {
      const filtered = filterActivationByAgent(storeComparisonData, userInfo.targetName);
      setFilteredData(filtered);
    } else {
      setFilteredData(storeComparisonData);
    }
  }, [storeComparisonData, userInfo]);

  const loadActivationData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('개통실적 데이터 로딩 시작...');
      
      // 당월 및 전월 데이터 병렬 로드
      const [currentData, previousData] = await Promise.all([
        fetchCurrentMonthData(),
        fetchPreviousMonthData()
      ]);

      setCurrentMonthData(currentData);
      setPreviousMonthData(previousData);

      // 매장별 비교 데이터 생성
      const comparisonData = generateStoreActivationComparison(currentData, previousData);
      setStoreComparisonData(comparisonData);

      // 통계 데이터 생성
      const storeStatsData = calculateActivationStats(currentData);
      const agentStatsData = calculateAgentStats(currentData);
      
      setStoreStats(storeStatsData);
      setAgentStats(agentStatsData);

      console.log('개통실적 데이터 로딩 완료');
    } catch (err) {
      console.error('개통실적 데이터 로딩 실패:', err);
      setError('개통실적 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '날짜 없음';
    return dateStr;
  };

  const formatTime = (hour, minute) => {
    if (!hour || !minute) return '시간 없음';
    return `${hour}:${minute}`;
  };

  const getComparisonColor = (current, previous) => {
    if (current > previous) return '#4CAF50'; // 초록색 (증가)
    if (current < previous) return '#F44336'; // 빨간색 (감소)
    return '#FF9800'; // 주황색 (동일)
  };

  const getComparisonIcon = (current, previous) => {
    if (current > previous) return '↗️';
    if (current < previous) return '↘️';
    return '→';
  };

  // 매장별 탭 렌더링
  const renderStoreTab = () => {
    const dataToShow = userInfo?.userType === 'agent' ? filteredData : storeComparisonData;
    const stores = Object.values(dataToShow);

    if (stores.length === 0) {
      return (
        <div className="no-data">
          <p>표시할 개통실적 데이터가 없습니다.</p>
          {userInfo?.userType === 'agent' && (
            <p>담당 매장의 개통실적이 없거나 담당자 정보가 일치하지 않습니다.</p>
          )}
        </div>
      );
    }

    return (
      <div className="store-list">
        {stores.map((store, index) => (
          <div key={index} className="store-item">
            <div className="store-header">
              <h3>{store.storeName}</h3>
              <div className="store-comparison">
                <span className="current-count">{store.currentMonth}개</span>
                <span className="comparison-arrow" style={{ color: getComparisonColor(store.currentMonth, store.previousMonth) }}>
                  {getComparisonIcon(store.currentMonth, store.previousMonth)}
                </span>
                <span className="previous-count">{store.previousMonth}개</span>
              </div>
            </div>
            
            <div className="store-details">
              <div className="detail-section">
                <h4>담당자</h4>
                <div className="agent-list">
                  {store.agents.map((agent, idx) => (
                    <span key={idx} className="agent-tag">{agent}</span>
                  ))}
                </div>
              </div>
              
              <div className="detail-section">
                <h4>모델별 실적</h4>
                <div className="model-list">
                  {Object.entries(store.models).map(([model, count]) => (
                    <div key={model} className="model-item">
                      <span className="model-name">{model}</span>
                      <span className="model-count">{count}개</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="detail-section">
                <h4>기준일</h4>
                <p>당월 마지막 개통일: {store.lastActivationDate.toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 담당자별 탭 렌더링
  const renderAgentTab = () => {
    const agents = Object.values(agentStats);
    
    if (agents.length === 0) {
      return (
        <div className="no-data">
          <p>표시할 담당자 개통실적 데이터가 없습니다.</p>
        </div>
      );
    }

    return (
      <div className="agent-list">
        {agents.map((agent, index) => (
          <div key={index} className="agent-item">
            <div className="agent-header">
              <h3>{agent.agentName}</h3>
              <span className="total-count">총 {agent.totalCount}개</span>
            </div>
            
            <div className="agent-details">
              <div className="detail-section">
                <h4>매장별 실적</h4>
                <div className="store-breakdown">
                  {Object.entries(agent.stores).map(([store, count]) => (
                    <div key={store} className="store-breakdown-item">
                      <span className="store-name">{store}</span>
                      <span className="store-count">{count}개</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="detail-section">
                <h4>개통 상세 내역</h4>
                <div className="activation-details">
                  {agent.details.slice(0, 10).map((detail, idx) => (
                    <div key={idx} className="activation-item">
                      <div className="activation-info">
                        <span className="activation-date">{formatDate(detail.date)}</span>
                        <span className="activation-time">{formatTime(detail.time.split(':')[0], detail.time.split(':')[1])}</span>
                        <span className="activation-store">{detail.store}</span>
                      </div>
                      <div className="activation-product">
                        <span className="activation-model">{detail.model}</span>
                        <span className="activation-color">{detail.color}</span>
                      </div>
                    </div>
                  ))}
                  {agent.details.length > 10 && (
                    <p className="more-details">... 외 {agent.details.length - 10}개 더</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 지도 탭 렌더링 (지도 컴포넌트와 연동)
  const renderMapTab = () => {
    const dataToShow = userInfo?.userType === 'agent' ? filteredData : storeComparisonData;
    const stores = Object.values(dataToShow);

    if (stores.length === 0) {
      return (
        <div className="no-data">
          <p>지도에 표시할 개통실적 데이터가 없습니다.</p>
        </div>
      );
    }

    return (
      <div className="map-info">
        <div className="map-legend">
          <h3>지도 범례</h3>
                     <div className="legend-item">
             <span className="legend-color increase">●</span>
             <span>당월 &gt; 전월 (증가)</span>
           </div>
           <div className="legend-item">
             <span className="legend-color decrease">●</span>
             <span>당월 &lt; 전월 (감소)</span>
           </div>
          <div className="legend-item">
            <span className="legend-color same">●</span>
            <span>당월 = 전월 (동일)</span>
          </div>
        </div>
        
        <div className="map-stores">
          <h3>표시될 매장 ({stores.length}개)</h3>
          <div className="store-summary">
            {stores.map((store, index) => (
              <div key={index} className="store-summary-item">
                <span className="store-name">{store.storeName}</span>
                <span className="store-counts">
                  {store.currentMonth}개 / {store.previousMonth}개
                </span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="map-note">
          <p>※ 지도에서 매장 마커를 클릭하면 상세 개통실적을 확인할 수 있습니다.</p>
          <p>※ 당월 마지막 개통일 기준으로 전월과 비교됩니다.</p>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>개통실적 데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
        <button onClick={loadActivationData} className="retry-button">
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="activation-screen">
      <div className="activation-header">
        <button onClick={onBack} className="back-button">
          ← 뒤로가기
        </button>
        <h1>담당개통확인</h1>
        <div className="user-info">
          {userInfo?.userType === 'agent' ? (
            <span className="agent-badge">관리자: {userInfo.targetName}</span>
          ) : (
            <span className="store-badge">일반 사용자</span>
          )}
        </div>
      </div>

      <div className="activation-tabs">
        <button 
          className={`tab-button ${activeTab === 'store' ? 'active' : ''}`}
          onClick={() => setActiveTab('store')}
        >
          매장별
        </button>
        <button 
          className={`tab-button ${activeTab === 'agent' ? 'active' : ''}`}
          onClick={() => setActiveTab('agent')}
        >
          담당자별
        </button>
        <button 
          className={`tab-button ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => setActiveTab('map')}
        >
          지도
        </button>
      </div>

      <div className="activation-content">
        {activeTab === 'store' && renderStoreTab()}
        {activeTab === 'agent' && renderAgentTab()}
        {activeTab === 'map' && renderMapTab()}
      </div>

      <div className="activation-footer">
        <button onClick={loadActivationData} className="refresh-button">
          데이터 새로고침
        </button>
        <div className="data-info">
          <p>당월 데이터: {currentMonthData.length}개 레코드</p>
          <p>전월 데이터: {previousMonthData.length}개 레코드</p>
        </div>
      </div>
    </div>
  );
};

export default ActivationScreen; 