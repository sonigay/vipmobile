/**
 * Discord 이미지 URL 갱신 유틸리티
 * 이미지 로드 실패 시 자동으로 Discord에서 최신 URL을 가져와서 재시도
 */

import React from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

/**
 * Discord 이미지 URL 갱신
 * @param {string} threadId - Discord 스레드 ID
 * @param {string} messageId - Discord 메시지 ID
 * @returns {Promise<{success: boolean, imageUrl?: string, error?: string}>}
 */
export async function refreshDiscordImageUrl(threadId, messageId) {
  try {
    if (!threadId || !messageId) {
      return { success: false, error: 'threadId와 messageId가 필요합니다.' };
    }

    const response = await fetch(
      `${API_URL}/api/discord/refresh-image-url?threadId=${threadId}&messageId=${messageId}`
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: '알 수 없는 오류' }));
      return { success: false, error: errorData.error || 'URL 갱신 실패' };
    }

    const data = await response.json();
    return { success: true, imageUrl: data.imageUrl };
  } catch (error) {
    console.error('Discord URL 갱신 오류:', error);
    return { success: false, error: error.message || 'URL 갱신 중 오류 발생' };
  }
}

/**
 * 이미지 로드 (자동 갱신 포함)
 * @param {string} imageUrl - 초기 이미지 URL
 * @param {string} threadId - Discord 스레드 ID (선택)
 * @param {string} messageId - Discord 메시지 ID (선택)
 * @param {Function} onRefresh - 갱신 성공 시 콜백 (선택)
 * @returns {Promise<string>} 최종 이미지 URL
 */
export function loadImageWithRefresh(imageUrl, threadId = null, messageId = null, onRefresh = null) {
  return new Promise((resolve, reject) => {
    if (!imageUrl) {
      reject(new Error('이미지 URL이 없습니다.'));
      return;
    }

    // Discord URL이 아니거나 메시지 ID가 없으면 일반 로드
    const isDiscordUrl = imageUrl.includes('cdn.discordapp.com') || imageUrl.includes('media.discordapp.net');
    if (!isDiscordUrl || !threadId || !messageId) {
      const img = new Image();
      img.onload = () => resolve(img.src);
      img.onerror = () => reject(new Error('이미지 로드 실패'));
      img.src = imageUrl;
      return;
    }

    // Discord URL이고 메시지 ID가 있으면 자동 갱신 시도
    const img = new Image();
    
    // 1차 시도: 저장된 URL 사용
    img.src = imageUrl;
    
    img.onload = () => {
      resolve(img.src);
    };
    
    img.onerror = async () => {
      // URL 만료 감지 → 갱신 시도 (개발 환경에서만 로그)
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ [Discord 이미지] URL 만료 감지, 갱신 시도:', { threadId, messageId });
      }
      
      try {
        const refreshResult = await refreshDiscordImageUrl(threadId, messageId);
        
        if (refreshResult.success && refreshResult.imageUrl) {
          // 2차 시도: 갱신된 URL 사용 (개발 환경에서만 로그)
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ [Discord 이미지] URL 갱신 성공, 재시도:', refreshResult.imageUrl.substring(0, 100));
          }
          
          if (onRefresh) {
            onRefresh(refreshResult.imageUrl);
          }
          
          img.src = refreshResult.imageUrl;
          
          img.onload = () => resolve(img.src);
          img.onerror = () => reject(new Error('갱신된 URL로도 이미지 로드 실패'));
        } else {
          reject(new Error(refreshResult.error || 'URL 갱신 실패'));
        }
      } catch (error) {
        // 네트워크 에러 등은 조용히 처리 (개발 환경에서만 로그)
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ [Discord 이미지] URL 갱신 중 오류:', error);
        }
        reject(error);
      }
    };
  });
}

/**
 * React 컴포넌트용 이미지 로드 훅
 * @param {string} imageUrl - 초기 이미지 URL
 * @param {string} threadId - Discord 스레드 ID (선택)
 * @param {string} messageId - Discord 메시지 ID (선택)
 * @returns {[string, boolean, string]} [최종 URL, 로딩 중, 에러]
 */
export function useDiscordImage(imageUrl, threadId = null, messageId = null) {
  const [finalUrl, setFinalUrl] = React.useState(imageUrl);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (!imageUrl) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setFinalUrl(imageUrl);

    loadImageWithRefresh(imageUrl, threadId, messageId, (newUrl) => {
      setFinalUrl(newUrl);
    })
      .then((url) => {
        setFinalUrl(url);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [imageUrl, threadId, messageId]);

  return [finalUrl, loading, error];
}

/**
 * 이미지 엘리먼트에 자동 갱신 이벤트 핸들러 추가
 * @param {HTMLImageElement} imgElement - 이미지 엘리먼트
 * @param {string} threadId - Discord 스레드 ID
 * @param {string} messageId - Discord 메시지 ID
 * @param {Function} onRefresh - 갱신 성공 시 콜백
 */
export function attachDiscordImageRefreshHandler(imgElement, threadId, messageId, onRefresh = null) {
  if (!imgElement || !threadId || !messageId) {
    return;
  }

  const originalSrc = imgElement.src;
  const isDiscordUrl = originalSrc.includes('cdn.discordapp.com') || originalSrc.includes('media.discordapp.net');
  
  if (!isDiscordUrl) {
    return; // Discord URL이 아니면 처리하지 않음
  }

  const handleError = async () => {
    // 개발 환경에서만 로그 출력
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️ [Discord 이미지] 로드 실패, 갱신 시도:', { threadId, messageId });
    }
    
    try {
      const refreshResult = await refreshDiscordImageUrl(threadId, messageId);
      
      if (refreshResult.success && refreshResult.imageUrl) {
        // 개발 환경에서만 로그 출력
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ [Discord 이미지] URL 갱신 성공');
        }
        
        if (onRefresh) {
          onRefresh(refreshResult.imageUrl);
        }
        
        imgElement.src = refreshResult.imageUrl;
        imgElement.onerror = null; // 무한 루프 방지
      } else {
        // 갱신 실패는 조용히 처리 (개발 환경에서만 로그)
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ [Discord 이미지] URL 갱신 실패:', refreshResult.error);
        }
      }
    } catch (error) {
      // 네트워크 에러 등은 조용히 처리 (개발 환경에서만 로그)
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ [Discord 이미지] URL 갱신 중 오류:', error);
      }
    }
  };

  imgElement.addEventListener('error', handleError, { once: true });
}

