/**
 * Discord Routes
 * Discord 관련 API 엔드포인트
 */

module.exports = function createDiscordRoutes(context) {
  const express = require('express');
  const router = express.Router();

  const { discordBot, sheetsClient, rateLimiter } = context;

  // Discord 이미지 URL 갱신 API
  router.get('/discord/refresh-image-url', async (req, res) => {
    res.set('Cache-Control', 'no-store'); // 캐시 방지
    try {
      const { threadId, messageId } = req.query;

      if (!threadId || !messageId) {
        return res.status(400).json({ error: 'threadId와 messageId가 필요합니다.' });
      }

      if (!discordBot.bot || !discordBot.LOGGING_ENABLED) {
        return res.status(503).json({ error: 'Discord 봇이 비활성화되어 있습니다.' });
      }

      // Discord에서 메시지 가져오기
      const channel = await discordBot.bot.channels.fetch(threadId);
      if (!channel) {
        return res.status(404).json({ error: '채널을 찾을 수 없습니다.' });
      }

      const message = await channel.messages.fetch(messageId);
      if (!message) {
        return res.status(404).json({ error: '메시지를 찾을 수 없습니다.' });
      }

      // 첨부 파일에서 이미지 URL 추출
      const imageUrl = message.attachments.first()?.url || null;

      if (!imageUrl) {
        return res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
      }

      res.json({
        success: true,
        imageUrl,
        threadId,
        messageId
      });
    } catch (error) {
      console.error('Discord 이미지 URL 갱신 실패:', error);
      res.status(500).json({ error: 'Discord 이미지 URL 갱신 실패' });
    }
  });


  // URL 유효성 검증 헬퍼 함수
  async function validateImageUrl(imageUrl, timeoutMs = 5000) {
    if (!imageUrl || !imageUrl.trim()) {
      return { valid: false, status: 'empty', error: 'URL이 없습니다.' };
    }

    const https = require('https');
    const http = require('http');

    return new Promise((resolve) => {
      try {
        const parsedUrl = new URL(imageUrl);
        const isHttps = parsedUrl.protocol === 'https:';
        const client = isHttps ? https : http;

        const options = {
          method: 'HEAD',
          timeout: timeoutMs,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ImageValidator/1.0)'
          }
        };

        const req = client.request(imageUrl, options, (res) => {
          const statusCode = res.statusCode;
          if (statusCode >= 200 && statusCode < 400) {
            resolve({ valid: true, status: 'valid', statusCode });
          } else if (statusCode === 404) {
            resolve({ valid: false, status: 'expired', error: '이미지가 만료되었습니다 (404)', statusCode });
          } else {
            resolve({ valid: false, status: 'error', error: `HTTP ${statusCode}`, statusCode });
          }
          res.destroy();
        });

        req.on('error', (error) => {
          if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            resolve({ valid: false, status: 'error', error: '연결 실패', code: error.code });
          } else if (error.code === 'ETIMEDOUT') {
            resolve({ valid: false, status: 'timeout', error: '요청 시간 초과', code: error.code });
          } else {
            resolve({ valid: false, status: 'error', error: error.message, code: error.code });
          }
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({ valid: false, status: 'timeout', error: '요청 시간 초과' });
        });

        req.setTimeout(timeoutMs);
        req.end();
      } catch (error) {
        resolve({ valid: false, status: 'error', error: error.message });
      }
    });
  }

  // Discord 이미지 모니터링 데이터 조회 API
  router.get('/discord/image-monitoring', async (req, res) => {
    try {
      // 캐시 방지 헤더 설정
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');

      const { type, validate } = req.query; // 'direct' 또는 'meeting', validate: 'true'면 URL 유효성 검증 수행
      const shouldValidate = validate === 'true';
      const SPREADSHEET_ID = sheetsClient.SPREADSHEET_ID;

      const monitoringData = {
        direct: {
          mobileImages: [],
          masterImages: [],
          storePhotos: []
        },
        meeting: {
          slides: []
        }
      };

      // 시트 데이터 가져오기 헬퍼 (Rate Limiter 사용)
      const getSheetData = async (range) => {
        const response = await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range
          })
        );
        return response.data.values || [];
      };

      // URL 유효성 검증 헬퍼 함수 (병렬 처리)
      async function validateImageUrls(items, maxConcurrent = 10) {
        if (!shouldValidate || items.length === 0) {
          return items.map(item => ({ ...item, urlStatus: 'unknown' }));
        }

        console.log(`🔍 [검증 시작] 총 ${items.length}개 항목 검증 중...`);

        const results = [];
        for (let i = 0; i < items.length; i += maxConcurrent) {
          const batch = items.slice(i, i + maxConcurrent);
          const batchResults = await Promise.all(
            batch.map(async (item) => {
              if (!item.imageUrl) {
                return { ...item, urlStatus: 'empty', urlValid: false };
              }
              const validation = await validateImageUrl(item.imageUrl);

              // 검증 실패 시 로그 출력 (처음 5개만)
              if (!validation.valid && results.length < 5) {
                console.log(`⚠️ [검증 실패] ${item.type || 'item'} (${item.modelName || item.storeName}): ${validation.status} - ${validation.error} (URL: ${item.imageUrl.substring(0, 50)}...)`);
              }
              // 검증 성공 로그 (샘플)
              if (validation.valid && results.length === 0) {
                console.log(`✅ [검증 성공 샘플] ${item.modelName || item.storeName}: ${validation.status} (URL: ${item.imageUrl.substring(0, 30)}...)`);
              }

              return {
                ...item,
                urlStatus: validation.status,
                urlValid: validation.valid,
                urlError: validation.error
              };
            })
          );
          results.push(...batchResults);
        }
        return results;
      }

      if (!type || type === 'direct') {
        console.log('📥 [조회] 직영점 시트 데이터 요청 시작');
        // 1. 직영점_모델이미지 조회
        const imageRowsPromise = getSheetData('직영점_모델이미지!A:K');

        // 2. 직영점_단말마스터 조회
        const masterRowsPromise = getSheetData('직영점_단말마스터!A:R');

        // 3. 직영점_매장사진 조회
        const storePhotoRowsPromise = getSheetData('직영점_매장사진!A:AH');

        const [imageValues, masterValues, storePhotoValues] = await Promise.all([
          imageRowsPromise,
          masterRowsPromise,
          storePhotoRowsPromise
        ]);

        console.log(`📥 [조회] 데이터 로드 완료. 모델: ${imageValues.length}행, 마스터: ${masterValues.length}행, 매장: ${storePhotoValues.length}행`);

        // 1. Mobile Images Processing
        const imageRows = imageValues.slice(1);
        const mobileImages = imageRows
          .filter(row => {
            const messageId = (row[8] || '').trim(); // I: Discord메시지ID
            const threadId = (row[10] || '').trim(); // K: Discord스레드ID
            return messageId && threadId;
          })
          .map(row => ({
            type: 'mobile-image', // 타입 명시
            carrier: (row[0] || '').trim(),
            modelId: (row[1] || '').trim(),
            modelName: (row[2] || '').trim(),
            petName: (row[3] || '').trim(),
            imageUrl: (row[5] || '').trim(),
            messageId: (row[8] || '').trim(),
            postId: (row[9] || '').trim(),
            threadId: (row[10] || '').trim()
          }));

        monitoringData.direct.mobileImages = await validateImageUrls(mobileImages);

        // 2. Master Images Processing
        const masterRows = masterValues.slice(1);
        const masterImages = masterRows
          .filter(row => {
            const messageId = (row[15] || '').trim(); // P: Discord메시지ID
            const threadId = (row[17] || '').trim(); // R: Discord스레드ID
            return messageId && threadId;
          })
          .map(row => ({
            type: 'master-image', // 타입 명시
            carrier: (row[0] || '').trim(),
            modelId: (row[1] || '').trim(),
            modelName: (row[2] || '').trim(),
            petName: (row[3] || '').trim(),
            imageUrl: (row[12] || '').trim(),
            messageId: (row[15] || '').trim(),
            postId: (row[16] || '').trim(),
            threadId: (row[17] || '').trim()
          }));

        monitoringData.direct.masterImages = await validateImageUrls(masterImages);

        // 3. Store Photos Processing
        const storePhotoRows = storePhotoValues.slice(1);
        const photoTypes = ['front', 'inside', 'outside', 'outside2', 'manager', 'staff1', 'staff2', 'staff3'];
        const photoTypeMap = {
          front: { url: 1, msgId: 2, postId: 3, threadId: 4 },
          inside: { url: 5, msgId: 6, postId: 7, threadId: 8 },
          outside: { url: 9, msgId: 10, postId: 11, threadId: 12 },
          outside2: { url: 13, msgId: 14, postId: 15, threadId: 16 },
          manager: { url: 17, msgId: 18, postId: 19, threadId: 20 },
          staff1: { url: 21, msgId: 22, postId: 23, threadId: 24 },
          staff2: { url: 25, msgId: 26, postId: 27, threadId: 28 },
          staff3: { url: 29, msgId: 30, postId: 31, threadId: 32 }
        };

        const storePhotos = [];
        storePhotoRows.forEach(row => {
          const storeName = (row[0] || '').trim();
          photoTypes.forEach(photoType => {
            const map = photoTypeMap[photoType];
            const messageId = (row[map.msgId] || '').trim();
            const threadId = (row[map.threadId] || '').trim();
            if (messageId && threadId) {
              storePhotos.push({
                type: 'store-photo', // 타입 명시
                storeName,
                photoType,
                imageUrl: (row[map.url] || '').trim(),
                messageId,
                postId: (row[map.postId] || '').trim(),
                threadId
              });
            }
          });
        });

        monitoringData.direct.storePhotos = await validateImageUrls(storePhotos);
      }

      res.json({
        success: true,
        data: monitoringData
      });

    } catch (error) {
      console.error('Discord 이미지 모니터링 데이터 조회 오류:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Discord 이미지 URL 갱신 공통 함수
  async function refreshDiscordImageUrl(threadId, messageId) {
    if (!context.discordBot.LOGGING_ENABLED || !context.discordBot.bot) {
      throw new Error('Discord 봇이 초기화되지 않았습니다.');
    }

    if (!context.discordBot.bot.isReady()) {
      throw new Error('Discord 봇이 준비되지 않았습니다.');
    }

    if (!threadId || !messageId) {
      throw new Error('threadId와 messageId가 필요합니다.');
    }

    try {
      const thread = await context.discordBot.bot.channels.fetch(threadId);
      if (!thread) {
        throw new Error('해당 스레드를 찾을 수 없습니다.');
      }

      const message = await thread.messages.fetch(messageId);
      if (!message) {
        throw new Error('해당 메시지를 찾을 수 없습니다.');
      }

      const attachment = message.attachments.first();
      if (!attachment) {
        throw new Error('첨부파일을 찾을 수 없습니다.');
      }

      return {
        imageUrl: attachment.url,
        messageId: message.id,
        threadId: thread.id
      };
    } catch (error) {
      console.error(`Discord 이미지 Refresh 실패 (Thread: ${threadId}, Msg: ${messageId}):`, error.message);
      throw error;
    }
  }

  // Snowflake ID 유효성 검사 (간소화)
  function isValidSnowflake(id) {
    return /^\d+$/.test(id);
  }

  // 헤더 정의 (directRoutes와 맞춤)
  const HEADERS_MOBILE_IMAGES = ['통신사', '모델ID', '모델명', '펫네임', '제조사', '이미지URL', '비고', '색상', 'Discord메시지ID', 'Discord포스트ID', 'Discord스레드ID'];
  const HEADERS_MOBILE_MASTER = ['통신사', '모델ID', '모델명', '펫네임', '출고가', '공시지원금', '출고가_수정일', '공시_수정일', '출고가_적용일', '공시_적용일', '순서', '단종여부', '이미지URL', '비고', '색상', 'Discord메시지ID', 'Discord포스트ID', 'Discord스레드ID'];
  const HEADERS_STORE_PHOTO = ['매장명', '전면_URL', '전면_MsgID', '전면_PostID', '전면_ThreadID', '내부_URL', '내부_MsgID', '내부_PostID', '내부_ThreadID', '외부_URL', '외부_MsgID', '외부_PostID', '외부_ThreadID', '외부2_URL', '외부2_MsgID', '외부2_PostID', '외부2_ThreadID', '점장_URL', '점장_MsgID', '점장_PostID', '점장_ThreadID', '직원1_URL', '직원1_MsgID', '직원1_PostID', '직원1_ThreadID', '직원2_URL', '직원2_MsgID', '직원2_PostID', '직원2_ThreadID', '직원3_URL', '직원3_MsgID', '직원3_PostID', '직원3_ThreadID', '업데이트일시'];


  // 배치 갱신 로직
  async function processBatchRefreshItems(items) {
    const results = [];

    // 배치 크기 제한: 한 번에 5개씩 처리 (Rate Limit 고려)
    const BATCH_SIZE = 5;
    const ITEM_DELAY_MS = 2000; // 항목 간 지연 (2초)
    const BATCH_DELAY_MS = 5000; // 배치 간 지연 (5초)
    const SPREADSHEET_ID = sheetsClient.SPREADSHEET_ID;

    // Rate Limiter 헬퍼
    const rateLimitedCall = (fn) => rateLimiter.execute(fn);

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

      console.log(`🔄 [배치 갱신] 배치 ${batchNumber} 처리 시작 (${batch.length}개 항목)`);

      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];

        // 첫 번째 항목이 아니면 지연 추가
        if (j > 0) {
          await new Promise(resolve => setTimeout(resolve, ITEM_DELAY_MS));
        }

        try {
          const { type, threadId, messageId } = item;

          if (!type || !threadId || !messageId) {
            throw new Error('type, threadId, messageId가 필요합니다.');
          }

          if (!isValidSnowflake(threadId) || !isValidSnowflake(messageId)) {
            throw new Error(`잘못된 Discord ID 형식입니다.`);
          }

          // 타입별 처리
          if (type === 'mobile-image') {
            const { carrier, modelId, modelName } = item;
            const refreshResult = await refreshDiscordImageUrl(threadId, messageId);
            const newImageUrl = refreshResult.imageUrl;

            // 시트 읽기 & 업데이트
            const imageResponse = await rateLimitedCall(() =>
              sheetsClient.sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: '직영점_모델이미지!A:K'
              })
            );

            const rows = (imageResponse.data.values || []).slice(1);

            // 모델명 정규화 함수 (삭제됨 - messageId 사용으로 불필요)

            // messageId로 행 찾기 (더 정확함)
            const targetMessageId = messageId.trim();
            const existingRowIndex = rows.findIndex(row => {
              const rowMessageId = (row[8] || '').trim(); // I: Discord메시지ID
              return rowMessageId === targetMessageId;
            });

            if (existingRowIndex === -1) {
              // fallback: 기존 로직 (carrier + modelId)
              console.warn(`[배치 갱신] messageId(${targetMessageId})로 행을 찾을 수 없어 modelId로 검색합니다.`);
              // ... 기존 로직 복원 생략, messageId가 없으면 업데이트 불가로 간주
              throw new Error(`시트에서 해당 messageId(${targetMessageId})를 가진 행을 찾을 수 없습니다.`);
            }

            const targetRow = existingRowIndex + 2;
            const oldImageUrl = (rows[existingRowIndex][5] || '');

            console.log(`📝 [갱신] 직영점_모델이미지 Row ${targetRow}: ${oldImageUrl.substring(0, 30)}... -> ${newImageUrl.substring(0, 30)}...`);

            await rateLimitedCall(() =>
              sheetsClient.sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `직영점_모델이미지!F${targetRow}`, // F: 이미지URL
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[newImageUrl]] }
              })
            );

            results.push({ success: true, imageUrl: newImageUrl, messageId: refreshResult.messageId, threadId: refreshResult.threadId, type, item });

          } else if (type === 'master-image') {
            const { carrier, modelId, modelName } = item;
            const refreshResult = await refreshDiscordImageUrl(threadId, messageId);
            const newImageUrl = refreshResult.imageUrl;

            const masterResponse = await rateLimitedCall(() =>
              sheetsClient.sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: '직영점_단말마스터!A:R'
              })
            );

            const rows = (masterResponse.data.values || []).slice(1);

            // messageId로 행 찾기
            const targetMessageId = messageId.trim();
            const existingRowIndex = rows.findIndex(row => {
              const rowMessageId = (row[15] || '').trim(); // P: Discord메시지ID
              return rowMessageId === targetMessageId;
            });

            if (existingRowIndex === -1) {
              throw new Error(`시트에서 해당 messageId(${targetMessageId})를 가진 행을 찾을 수 없습니다.`);
            }

            const targetRow = existingRowIndex + 2;
            const oldImageUrl = (rows[existingRowIndex][12] || '');

            console.log(`📝 [갱신] 직영점_단말마스터 Row ${targetRow}: ${oldImageUrl.substring(0, 30)}... -> ${newImageUrl.substring(0, 30)}...`);

            await rateLimitedCall(() =>
              sheetsClient.sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `직영점_단말마스터!M${targetRow}`, // M: 이미지URL
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[newImageUrl]] }
              })
            );

            results.push({ success: true, imageUrl: newImageUrl, messageId: refreshResult.messageId, threadId: refreshResult.threadId, type, item });

          } else if (type === 'store-photo') {
            const { storeName, photoType } = item;
            const refreshResult = await refreshDiscordImageUrl(threadId, messageId);
            const newImageUrl = refreshResult.imageUrl;

            const valuesResponse = await rateLimitedCall(() =>
              sheetsClient.sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: '직영점_매장사진!A:AH'
              })
            );
            const values = valuesResponse.data.values || [];

            // messageId로 행 찾기 (매장 사진은 한 행에 여러 이미지가 있으므로 조금 복잡)
            // 하지만 messageId는 유니크하므로 전체 행을 스캔하여 해당 messageId가 있는 열을 찾아야 함...
            // 기존에는 storeName으로 찾았음. 매장명은 유니크하다고 가정.
            // 여기서는 storeName + photoType으로 정확한 위치를 찾을 수 있음.

            const rowIndex = values.findIndex(row => row[0] === storeName);
            if (rowIndex === -1) {
              throw new Error(`매장(${storeName})을 찾을 수 없습니다.`);
            }

            // 컬럼 매핑
            const photoTypeMap = {
              front: { url: 1, msgId: 2 }, inside: { url: 5, msgId: 6 }, outside: { url: 9, msgId: 10 },
              outside2: { url: 13, msgId: 14 }, manager: { url: 17, msgId: 18 }, staff1: { url: 21, msgId: 22 },
              staff2: { url: 25, msgId: 26 }, staff3: { url: 29, msgId: 30 }
            };

            const map = photoTypeMap[photoType];
            if (!map) throw new Error(`알 수 없는 사진 타입: ${photoType}`);

            const targetRow = rowIndex + 1;
            const oldImageUrl = values[rowIndex][map.url] || '';

            console.log(`📝 [갱신] 직영점_매장사진 Row ${targetRow} (${storeName} ${photoType}): ${oldImageUrl.substring(0, 30)}... -> ${newImageUrl.substring(0, 30)}...`);

            // 컬럼 인덱스 -> 알파벳 변환
            const getColLetter = (idx) => {
              const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
              if (idx < 26) return letters[idx];
              return 'A' + letters[idx - 26];
            };

            const targetCol = getColLetter(map.url);

            // 이미지 URL 업데이트
            await rateLimitedCall(() =>
              sheetsClient.sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `직영점_매장사진!${targetCol}${targetRow}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[newImageUrl]] }
              })
            );

            // 업데이트 일시 업데이트 (AH 컬럼 = index 33)
            await rateLimitedCall(() =>
              sheetsClient.sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `직영점_매장사진!AH${targetRow}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[new Date().toISOString().replace('T', ' ').substring(0, 19)]] }
              })
            );

            results.push({ success: true, imageUrl: newImageUrl, messageId: refreshResult.messageId, threadId: refreshResult.threadId, type, item });

          } else {
            throw new Error(`알 수 없는 타입: ${type}`);
          }

        } catch (error) {
          console.error(`❌ [배치 갱신] 항목 처리 실패:`, error.message);
          results.push({ success: false, error: error.message, item });
        }
      }

      // 배치 간 지연
      if (i + BATCH_SIZE < items.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    return results;
  }

  // 일괄 URL 갱신 API
  router.post('/discord/batch-refresh-urls', express.json(), async (req, res) => {
    try {
      const { items } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'items 배열이 필요합니다.'
        });
      }

      const results = await processBatchRefreshItems(items);
      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      return res.json({
        success: true,
        total: results.length,
        successCount,
        failCount,
        results
      });
    } catch (error) {
      console.error('일괄 URL 갱신 오류:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
};
