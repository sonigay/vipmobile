/**
 * 모바일 목록 테이블 행 컴포넌트
 * MobileListTab에서 분리된 개별 행 컴포넌트
 */
import React, { memo } from 'react';
import {
  TableRow,
  TableCell,
  Button,
  Avatar,
  Typography,
  Box,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Autocomplete,
  TextField
} from '@mui/material';
import {
  PhotoCamera as PhotoCameraIcon,
  Recommend as RecommendIcon,
  Star as StarIcon,
  Label as LabelIcon
} from '@mui/icons-material';
import { Checkbox } from '@mui/material';
import { HoverableTableRow } from './common/ModernTable';
import { debugLog } from '../../utils/debugLogger';
import { getProxyImageUrl } from '../../api';
import { ImageUploadButton } from './common/ImageUploadButton';
import { attachDiscordImageRefreshHandler } from '../../utils/discordImageUtils';


const MobileListRowComponent = ({
  row,
  planGroups,
  openingTypes,
  selectedPlanGroup,
  selectedOpeningType,
  calculatedPrice,
  tagMenuAnchor,
  onRowClick,
  onTagMenuOpen,
  onTagMenuClose,
  onTagChange,
  onPlanGroupChange,
  onOpeningTypeChange,
  onImageUploadSuccess,
  getSelectedTags,
  getDisplayValue,
  isCustomerMode = false
}) => {
  // 구매가 계산 (메모이제이션을 위해 컴포넌트 내부에서 계산)
  const purchasePriceAddon = row.purchasePriceWithAddon ||
    (row.factoryPrice || 0) - (row.support || row.publicSupport || 0) - (row.storeSupport || 0);
  const purchasePriceNoAddon = row.purchasePriceWithoutAddon ||
    (row.factoryPrice || 0) - (row.support || row.publicSupport || 0) - (row.storeSupportNoAddon || 0);

  return (
    <HoverableTableRow
      key={row.id}
      onClick={() => onRowClick(row)}
    >
      {!isCustomerMode && (
        <TableCell align="center" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<LabelIcon />}
            onClick={(e) => onTagMenuOpen(e, row.id)}
            sx={{
              minWidth: 100,
              textTransform: 'none',
              fontSize: '0.75rem',
              py: 0.5
            }}
          >
            {getSelectedTags(row)}
          </Button>
          <Menu
            anchorEl={tagMenuAnchor[row.id]}
            open={Boolean(tagMenuAnchor[row.id])}
            onClose={() => onTagMenuClose(row.id)}
            onClick={(e) => e.stopPropagation()}
          >
            <MenuItem onClick={(e) => {
              e.stopPropagation();
              onTagChange(row.id, 'popular', !row.isPopular);
            }}>
              <ListItemIcon>
                <Checkbox
                  checked={row.isPopular || false}
                  size="small"
                />
              </ListItemIcon>
              <ListItemText>
                <Chip icon={<StarIcon />} label="인기" color="secondary" size="small" />
              </ListItemText>
            </MenuItem>
            <MenuItem onClick={(e) => {
              e.stopPropagation();
              onTagChange(row.id, 'recommend', !row.isRecommended);
            }}>
              <ListItemIcon>
                <Checkbox
                  checked={row.isRecommended || false}
                  size="small"
                />
              </ListItemIcon>
              <ListItemText>
                <Chip icon={<RecommendIcon />} label="추천" color="primary" size="small" />
              </ListItemText>
            </MenuItem>
            <MenuItem onClick={(e) => {
              e.stopPropagation();
              onTagChange(row.id, 'cheap', !row.isCheap);
            }}>
              <ListItemIcon>
                <Checkbox
                  checked={row.isCheap || false}
                  size="small"
                />
              </ListItemIcon>
              <ListItemText>
                <Chip label="저렴" color="success" size="small" />
              </ListItemText>
            </MenuItem>
            <MenuItem onClick={(e) => {
              e.stopPropagation();
              onTagChange(row.id, 'premium', !row.isPremium);
            }}>
              <ListItemIcon>
                <Checkbox
                  checked={row.isPremium || false}
                  size="small"
                />
              </ListItemIcon>
              <ListItemText>
                <Chip label="프리미엄" color="warning" size="small" />
              </ListItemText>
            </MenuItem>
            <MenuItem onClick={(e) => {
              e.stopPropagation();
              onTagChange(row.id, 'budget', !row.isBudget);
            }}>
              <ListItemIcon>
                <Checkbox
                  checked={row.isBudget || false}
                  size="small"
                />
              </ListItemIcon>
              <ListItemText>
                <Chip label="중저가" color="info" size="small" />
              </ListItemText>
            </MenuItem>
          </Menu>
        </TableCell>
      )}

      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
        <Box sx={{ position: 'relative', display: 'inline-block' }}>
          <Avatar
            variant="rounded"
            src={row.image ? (() => {
              let normalizedUrl = row.image;
              try {
                const urlObj = new URL(normalizedUrl);
                const pathParts = urlObj.pathname.split('/');
                const filename = pathParts[pathParts.length - 1];
                if (filename.includes('--')) {
                  const normalizedFilename = filename.replace(/--+/g, '-');
                  pathParts[pathParts.length - 1] = normalizedFilename;
                  urlObj.pathname = pathParts.join('/');
                  normalizedUrl = urlObj.toString();
                }
              } catch (e) {
                normalizedUrl = normalizedUrl.replace(/--+/g, '-');
              }

              // 🔥 핵심 수정: 회의모드와 동일하게 처리
              // getProxyImageUrl은 원본 URL을 그대로 반환하므로 추가 처리 불필요
              let finalUrl = getProxyImageUrl(normalizedUrl);

              // Discord CDN URL은 쿼리 파라미터를 포함해야 정상 작동
              // 타임스탬프 추가는 쿼리 파라미터가 이미 있는 경우에만 추가
              const isDiscordCdn = finalUrl.includes('cdn.discordapp.com') || finalUrl.includes('media.discordapp.net');
              if (isDiscordCdn && !finalUrl.includes('_t=')) {
                // 쿼리 파라미터가 있으면 &로 추가, 없으면 ?로 추가
                finalUrl = finalUrl.includes('?')
                  ? `${finalUrl}&_t=${Date.now()}`
                  : `${finalUrl}?_t=${Date.now()}`;
              }

              // 디버그 로그 (개발 환경에서만)
              debugLog('MobileListRow.js:imageSrc', '이미지 URL 처리', {
                originalUrl: row.image,
                normalizedUrl,
                finalUrl,
                modelId: row.id,
                isProxy: finalUrl.includes('/api/meetings/proxy-image')
              });

              return finalUrl;
            })() : undefined}
            onError={(e) => {
              // 🔥 핵심 수정: 이미지 로드 실패 처리 개선
              const retryCount = parseInt(e.target.dataset.retryCount || '0');

              // 최대 3번까지 재시도
              if (retryCount >= 3) {
                e.target.dataset.gaveUp = 'true';
                e.target.onerror = null;
                e.target.style.display = 'none';
                return;
              }

              const originalUrl = row.image;
              if (!originalUrl) {
                e.target.dataset.gaveUp = 'true';
                e.target.onerror = null;
                return;
              }

              // Discord 이미지이고 메시지 ID가 있으면 자동 갱신 시도
              const isDiscordUrl = originalUrl.includes('cdn.discordapp.com') || originalUrl.includes('media.discordapp.net');
              if (isDiscordUrl && row.discordThreadId && row.discordMessageId) {
                attachDiscordImageRefreshHandler(
                  e.target,
                  row.discordThreadId,
                  row.discordMessageId,
                  (newUrl) => {
                    // 갱신 성공 시 시트에 저장 (선택사항)
                    console.log('✅ [MobileListRow] Discord 이미지 URL 갱신 성공');
                  }
                );
                return;
              }

              // 🔥 핵심 수정: 프록시 실패 시 원본 URL로 폴백
              if (e.target.src.includes('/api/meetings/proxy-image')) {
                // 프록시 실패 → 원본 URL로 직접 시도
                e.target.src = originalUrl;
                e.target.dataset.retryCount = (retryCount + 1).toString();
                return;
              }

              // 원본 URL도 실패 → 프록시로 시도
              if (originalUrl &&
                (originalUrl.includes('cdn.discordapp.com') || originalUrl.includes('media.discordapp.net'))) {
                const proxyUrl = getProxyImageUrl(originalUrl);
                e.target.src = proxyUrl;
                e.target.dataset.retryCount = (retryCount + 1).toString();
                return;
              }

              // 모든 시도 실패
              e.target.dataset.gaveUp = 'true';
              e.target.onerror = null;
              e.target.style.display = 'none';

              if (process.env.NODE_ENV === 'development') {
                console.warn('⚠️ [MobileListRow] 이미지 로드 실패:', {
                  modelId: row.id,
                  modelName: row.model,
                  originalUrl: row.image,
                  attemptedUrl: e.target.src || 'N/A',
                  retryCount
                });
              }
            }}
            sx={{ width: 60, height: 60, bgcolor: 'background.subtle' }}
          >
            <PhotoCameraIcon />
          </Avatar>
          {!isCustomerMode && (
            <Box
              sx={{
                position: 'absolute',
                bottom: -8,
                right: -8
              }}
            >
              <ImageUploadButton
                modelId={row.model || row.id}
                carrier={row.carrier}
                modelName={row.model}
                petName={row.petName}
                onUploadSuccess={onImageUploadSuccess}
                size="small"
                sx={{
                  bgcolor: 'background.paper',
                  boxShadow: 1,
                  '&:hover': { bgcolor: 'primary.main', color: 'black' }
                }}
                tooltip="이미지 업로드"
              />
            </Box>
          )}
        </Box>
      </TableCell>

      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
        <Typography variant="body1" fontWeight="bold" sx={{ fontSize: '0.95rem' }}>
          {row.petName}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
          {row.model}
        </Typography>
      </TableCell>

      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
        <Autocomplete
          size="small"
          options={planGroups}
          value={selectedPlanGroup || null}
          onChange={(e, newValue) => onPlanGroupChange(row.id, newValue)}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="요금제군 선택"
              sx={{ minWidth: 100 }}
            />
          )}
          sx={{ minWidth: 120 }}
        />
      </TableCell>

      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
        <Autocomplete
          size="small"
          options={openingTypes}
          value={selectedOpeningType || null}
          onChange={(e, newValue) => onOpeningTypeChange(row.id, newValue)}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="유형 선택"
              sx={{ minWidth: 80 }}
            />
          )}
          sx={{ minWidth: 100 }}
        />
      </TableCell>

      <TableCell align="center">
        <Typography
          variant="body1"
          sx={{
            textDecoration: 'line-through',
            color: 'text.secondary'
          }}
        >
          {row.factoryPrice?.toLocaleString()}
        </Typography>
      </TableCell>

      <TableCell align="center" sx={{ color: 'info.main' }}>
        {getDisplayValue(row, 'publicSupport', selectedOpeningType)?.toLocaleString() ||
          row.publicSupport?.toLocaleString() ||
          row.support?.toLocaleString()}
      </TableCell>

      {/* 대리점 지원금 */}
      <TableCell align="center" sx={{ borderLeft: '1px solid rgba(81, 81, 81, 0.3)', width: '90px' }}>
        <Typography
          variant="body1"
          sx={{
            fontSize: '1.1rem',
            fontWeight: 'bold',
            color: 'info.main'
          }}
        >
          {(() => {
            const displayValue = getDisplayValue(row, 'storeSupportWithAddon', selectedOpeningType);
            const fallbackValue = row.storeSupport || row.storeSupportWithAddon;
            const finalValue = (displayValue !== undefined && displayValue !== null && displayValue !== 0)
              ? displayValue.toLocaleString()
              : (fallbackValue !== undefined && fallbackValue !== null ? fallbackValue.toLocaleString() : '-');
            return finalValue;
          })()}
        </Typography>
      </TableCell>

      <TableCell align="center" sx={{ width: '90px' }}>
        <Typography
          variant="body1"
          sx={{
            fontSize: '1.1rem',
            fontWeight: 'bold',
            color: 'warning.main'
          }}
        >
          {(() => {
            const displayValue = getDisplayValue(row, 'storeSupportWithoutAddon', selectedOpeningType);
            const fallbackValue = row.storeSupportNoAddon;
            const finalValue = (displayValue !== undefined && displayValue !== null && displayValue !== 0)
              ? displayValue.toLocaleString()
              : (fallbackValue !== undefined && fallbackValue !== null ? fallbackValue.toLocaleString() : '-');
            return finalValue;
          })()}
        </Typography>
      </TableCell>

      {/* 구매가 (할부원금) */}
      <TableCell align="center" sx={{ borderLeft: '1px solid rgba(81, 81, 81, 0.3)', bgcolor: 'rgba(212, 175, 55, 0.05)', width: '90px' }}>
        <Typography
          variant="body1"
          sx={{
            fontSize: '1.15rem',
            fontWeight: 'bold',
            color: 'primary.main'
          }}
        >
          {(() => {
            const displayValue = getDisplayValue(row, 'purchasePriceWithAddon', selectedOpeningType);
            const finalValue = displayValue !== undefined && displayValue !== null
              ? displayValue.toLocaleString()
              : purchasePriceAddon.toLocaleString();
            return finalValue;
          })()}
        </Typography>
      </TableCell>

      <TableCell align="center" sx={{ bgcolor: 'rgba(212, 175, 55, 0.05)', width: '90px' }}>
        <Typography
          variant="body1"
          sx={{
            fontSize: '1.15rem',
            fontWeight: 'bold',
            color: 'success.main'
          }}
        >
          {(() => {
            const displayValue = getDisplayValue(row, 'purchasePriceWithoutAddon', selectedOpeningType);
            const finalValue = displayValue !== undefined && displayValue !== null
              ? displayValue.toLocaleString()
              : purchasePriceNoAddon.toLocaleString();
            return finalValue;
          })()}
        </Typography>
      </TableCell>
    </HoverableTableRow>
  );
};

// React.memo로 메모이제이션하여 불필요한 리렌더링 방지
export const MobileListRow = memo(MobileListRowComponent, (prevProps, nextProps) => {
  // 주요 props 비교 - true를 반환하면 리렌더링 안 함, false를 반환하면 리렌더링 함
  // 🔥 개선: image URL 변경을 정확히 감지하도록 개선
  const imageChanged = prevProps.row.image !== nextProps.row.image;

  const isEqual = (
    prevProps.row.id === nextProps.row.id &&
    prevProps.selectedPlanGroup === nextProps.selectedPlanGroup &&
    prevProps.selectedOpeningType === nextProps.selectedOpeningType &&
    prevProps.calculatedPrice === nextProps.calculatedPrice &&
    prevProps.tagMenuAnchor[prevProps.row.id] === nextProps.tagMenuAnchor[nextProps.row.id] &&
    prevProps.row.isPopular === nextProps.row.isPopular &&
    prevProps.row.isRecommended === nextProps.row.isRecommended &&
    prevProps.row.isCheap === nextProps.row.isCheap &&
    prevProps.row.isPremium === nextProps.row.isPremium &&
    prevProps.row.isBudget === nextProps.row.isBudget &&
    !imageChanged && // 🔥 개선: image 변경 감지 (변경되면 리렌더링)
    prevProps.row.petName === nextProps.row.petName &&
    prevProps.row.model === nextProps.row.model &&
    prevProps.row.factoryPrice === nextProps.row.factoryPrice
  );
  return isEqual; // true면 리렌더링 안 함, false면 리렌더링 함
});
