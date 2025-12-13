/**
 * 가격 표시 공통 컴포넌트
 */
import React from 'react';
import { Typography, Box } from '@mui/material';
import { formatPrice } from '../../../utils/directStoreUtils';

/**
 * 가격 표시 컴포넌트
 * @param {Object} props
 * @param {number} props.price - 가격
 * @param {string} props.label - 라벨
 * @param {string} props.variant - Typography variant
 * @param {string} props.color - 색상
 * @param {boolean} props.bold - 굵게 표시 여부
 */
export const PriceDisplay = ({ 
  price, 
  label, 
  variant = 'body1', 
  color = 'text.primary',
  bold = false 
}) => {
  return (
    <Box>
      {label && (
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      )}
      <Typography 
        variant={variant} 
        color={color}
        fontWeight={bold ? 'bold' : 'normal'}
      >
        {formatPrice(price)}원
      </Typography>
    </Box>
  );
};

/**
 * 가격 비교 표시 컴포넌트 (부가유치/부가미유치)
 */
export const PriceComparison = ({ 
  priceWithAddon, 
  priceWithoutAddon,
  label = '구매가'
}) => {
  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      <PriceDisplay 
        price={priceWithAddon} 
        label={`${label} (부가유치)`}
        variant="h6"
        bold
      />
      <PriceDisplay 
        price={priceWithoutAddon} 
        label={`${label} (부가미유치)`}
        variant="h6"
        bold
      />
    </Box>
  );
};
