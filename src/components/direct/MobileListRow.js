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
  Edit as EditIcon,
  Recommend as RecommendIcon,
  Star as StarIcon,
  Label as LabelIcon
} from '@mui/icons-material';
import { Checkbox } from '@mui/material';
import { HoverableTableRow } from './common/ModernTable';
import { debugLog } from '../../utils/debugLogger';

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
  onImageUploadClick,
  getSelectedTags,
  getDisplayValue
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
              
              let finalUrl = normalizedUrl;
              if (normalizedUrl.includes('?')) {
                const urlEndsWithAmpersand = normalizedUrl.endsWith('&');
                const urlEndsWithQuestion = normalizedUrl.endsWith('?');
                if (urlEndsWithAmpersand) {
                  finalUrl = `${normalizedUrl}_t=${Date.now()}`;
                } else if (urlEndsWithQuestion) {
                  finalUrl = `${normalizedUrl}_t=${Date.now()}`;
                } else {
                  finalUrl = `${normalizedUrl}&_t=${Date.now()}`;
                }
              } else {
                finalUrl = `${normalizedUrl}?_t=${Date.now()}`;
              }
              
              // 디버그 로그 (개발 환경에서만)
              debugLog('MobileListRow.js:imageSrc', '이미지 URL 처리', {
                originalUrl: row.image,
                normalizedUrl,
                finalUrl,
                modelId: row.id
              });
              
              return finalUrl;
            })() : undefined}
            onError={(e) => {
              if (e.target.dataset.gaveUp === 'true') {
                e.target.onerror = null;
                return;
              }
              e.target.dataset.gaveUp = 'true';
              e.target.src = '';
              e.target.onerror = null;
            }}
            sx={{ width: 60, height: 60, bgcolor: 'background.subtle' }}
          >
            <PhotoCameraIcon />
          </Avatar>
          <IconButton
            size="small"
            sx={{
              position: 'absolute',
              bottom: -8,
              right: -8,
              bgcolor: 'background.paper',
              boxShadow: 1,
              '&:hover': { bgcolor: 'primary.main', color: 'black' }
            }}
            onClick={() => onImageUploadClick(row.id)}
          >
            <EditIcon fontSize="small" />
          </IconButton>
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
        {getDisplayValue(row, 'publicSupport')?.toLocaleString() || 
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
            const displayValue = getDisplayValue(row, 'storeSupportWithAddon');
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
            const displayValue = getDisplayValue(row, 'storeSupportWithoutAddon');
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
            const displayValue = getDisplayValue(row, 'purchasePriceWithAddon');
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
            const displayValue = getDisplayValue(row, 'purchasePriceWithoutAddon');
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
    prevProps.row.image === nextProps.row.image &&
    prevProps.row.petName === nextProps.row.petName &&
    prevProps.row.model === nextProps.row.model &&
    prevProps.row.factoryPrice === nextProps.row.factoryPrice
  );
  return isEqual; // true면 리렌더링 안 함, false면 리렌더링 함
});
