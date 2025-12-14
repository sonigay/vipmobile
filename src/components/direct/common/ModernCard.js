/**
 * 모던한 카드 컴포넌트
 * 새로운 디자인 시스템에 맞춘 카드 컴포넌트
 */
import React from 'react';
import { Card, CardContent, CardMedia, Box, Typography, Chip, Stack, alpha } from '@mui/material';
import { formatPrice } from '../../../utils/directStoreUtils';

/**
 * 모던한 제품 카드 컴포넌트
 * 
 * 주의: useTheme() hook 사용을 제거하여 초기화 순서 문제를 방지합니다.
 * 대신 sx prop의 함수형 theme을 사용합니다.
 */
export const ModernProductCard = ({
  product,
  onSelect,
  priceData,
  selectedPlanGroup,
  selectedOpeningType,
  loading = false,
  ...props
}) => {

  const currentPrice = priceData?.[selectedOpeningType] || {};
  const purchasePrice = currentPrice.purchasePrice || currentPrice.purchasePriceWithAddon || 0;

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: onSelect ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'visible',
        ...props.sx,
      }}
      onClick={onSelect}
      {...props}
    >
      {/* 이미지 영역 */}
      {product.image && (
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            paddingTop: '75%', // 4:3 비율
            overflow: 'hidden',
            backgroundColor: 'background.subtle',
          }}
        >
          <CardMedia
            component="img"
            image={product.image}
            alt={product.petName || product.model}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              transition: 'transform 0.3s ease',
              '&:hover': {
                transform: 'scale(1.05)',
              },
            }}
          />
          
          {/* 통신사 배지 */}
          {product.carrier && (
            <Chip
              label={product.carrier}
              size="small"
              sx={(theme) => ({
                position: 'absolute',
                top: 12,
                right: 12,
                backgroundColor: theme.carrierColors?.[product.carrier]?.primary || theme.palette.primary.main,
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.75rem',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              })}
            />
          )}

          {/* 태그 배지 */}
          <Stack
            direction="row"
            spacing={1}
            sx={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              flexWrap: 'wrap',
              gap: 0.5,
            }}
          >
            {product.isPremium && (
              <Chip
                label="프리미엄"
                size="small"
                color="primary"
                sx={{ fontSize: '0.7rem', height: 24 }}
              />
            )}
            {product.isPopular && (
              <Chip
                label="인기"
                size="small"
                color="secondary"
                sx={{ fontSize: '0.7rem', height: 24 }}
              />
            )}
            {product.isRecommended && (
              <Chip
                label="추천"
                size="small"
                sx={(theme) => ({
                  fontSize: '0.7rem',
                  height: 24,
                  background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`,
                  color: '#ffffff',
                })}
              />
            )}
          </Stack>
        </Box>
      )}

      <CardContent sx={{ flexGrow: 1, p: 2.5 }}>
        {/* 모델명 */}
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            mb: 0.5,
            color: 'text.primary',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {product.petName || product.model}
        </Typography>

        {/* 모델 코드 */}
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mb: 2,
            fontSize: '0.8125rem',
          }}
        >
          {product.model}
        </Typography>

        {/* 가격 정보 */}
        <Box
          sx={(theme) => ({
            mt: 'auto',
            pt: 2,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
          })}
        >
          {loading ? (
            <Typography variant="body2" color="text.secondary">
              가격 계산 중...
            </Typography>
          ) : (
            <>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={1}>
                <Typography variant="caption" color="text.secondary">
                  구매가
                </Typography>
                <Typography
                  variant="h6"
                  sx={(theme) => ({
                    fontWeight: 700,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  })}
                >
                  {formatPrice(purchasePrice)}원
                </Typography>
              </Stack>
              
              {currentPrice.publicSupport > 0 && (
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    이통사 지원금
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {formatPrice(currentPrice.publicSupport)}원
                  </Typography>
                </Stack>
              )}
            </>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

/**
 * 간소화된 카드 컴포넌트 (목록 뷰용)
 */
export const CompactProductCard = ({ product, onSelect, ...props }) => {
  return (
    <Card
      sx={(theme) => ({
        display: 'flex',
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        '&:hover': {
          backgroundColor: alpha(theme.palette.primary.main, 0.04),
        },
        ...props.sx,
      })}
      onClick={onSelect}
      {...props}
    >
      {product.image && (
        <Box
          sx={{
            width: 120,
            minWidth: 120,
            height: 120,
            position: 'relative',
            backgroundColor: 'background.subtle',
          }}
        >
          <CardMedia
            component="img"
            image={product.image}
            alt={product.petName || product.model}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              p: 1,
            }}
          />
        </Box>
      )}
      <CardContent sx={{ flex: 1, p: 2 }}>
        <Typography variant="h6" fontWeight={600} mb={0.5}>
          {product.petName || product.model}
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={1}>
          {product.model}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5}>
          {product.isPremium && <Chip label="프리미엄" size="small" color="primary" />}
          {product.isPopular && <Chip label="인기" size="small" color="secondary" />}
        </Stack>
      </CardContent>
    </Card>
  );
};
