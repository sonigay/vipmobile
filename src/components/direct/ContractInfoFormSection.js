/**
 * 개통 정보 페이지 - 약정 및 할부 정보 섹션 컴포넌트
 * OpeningInfoPage에서 분리된 약정 및 할부 정보 폼 섹션
 */
import React from 'react';
import {
    Paper,
    Typography,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    RadioGroup,
    FormControlLabel,
    Radio
} from '@mui/material';
import { directStoreApiClient } from '../../api/directStoreApiClient';
import { debugLog } from '../../utils/debugLogger';

const ContractInfoFormSection = ({
    theme,
    formData,
    setFormData,
    selectedCarrier,
    initialData,
    selectedPlanGroup,
    planGroups,
    setPublicSupport
}) => {
    const handleContractTypeChange = async (newContractType) => {
        // 🔥 개선: 선택약정일 때 이통사지원금 0으로 설정하고 usePublicSupport를 false로
        if (newContractType === 'selected') {
            setPublicSupport(0);
            setFormData(prev => ({ ...prev, contractType: newContractType, usePublicSupport: false }));
        } else {
            // 일반약정으로 변경 시 usePublicSupport를 true로 설정
            setFormData(prev => ({ ...prev, contractType: newContractType, usePublicSupport: true }));
            // 일반약정으로 변경 시 이통사지원금 재계산
            if (formData.plan && (initialData?.id || initialData?.model)) {
                // planGroups에서 선택된 요금제 찾기
                const selectedPlan = planGroups.find(p => p.name === formData.plan);
                const planGroup = selectedPlan?.group || null;
                if (planGroup) {
                    try {
                        const openingTypeMap = {
                            'NEW': '010신규',
                            'MNP': 'MNP',
                            'CHANGE': '기변'
                        };
                        const openingType = openingTypeMap[formData.openingType] || '010신규';
                        
                        let modelId = initialData?.id;
                        let foundMobile = null;
                        if (!modelId && initialData?.model) {
                            try {
                                // 마스터 데이터 사용
                                const mobileList = await directStoreApiClient.getMobilesMaster(selectedCarrier);
                                foundMobile = mobileList.find(m => 
                                    m.model === initialData.model && 
                                    m.carrier === selectedCarrier
                                );
                                if (foundMobile) {
                                    modelId = foundMobile.modelId || foundMobile.id;
                                }
                            } catch (err) {
                                console.warn('모델 ID 찾기 실패:', err);
                            }
                        }
                        
                        if (modelId) {
                            // 마스터 가격 정책 조회
                            const pricingList = await directStoreApiClient.getMobilesPricing(selectedCarrier, {
                                modelId: modelId,
                                planGroup: planGroup,
                                openingType: openingType
                            });
                            
                            if (pricingList && pricingList.length > 0) {
                                const pricing = pricingList[0];
                                debugLog('ContractInfoFormSection.js', '일반약정 변경 시 이통사지원금 재계산', {
                                    contractType: 'standard',
                                    planGroup,
                                    openingType,
                                    publicSupport: pricing.publicSupport
                                }, 'debug-session', 'run1', 'B');
                                setPublicSupport(pricing.publicSupport || 0);
                            }
                        }
                    } catch (err) {
                        console.error('이통사지원금 계산 실패:', err);
                    }
                }
            }
        }
    };

    return (
        <Paper sx={{ p: 2, mb: 1.5, borderTop: `3px solid ${theme.primary}` }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>약정 및 할부 정보</Typography>
            <Grid container spacing={1.5}>
                <Grid item xs={12}>
                    <FormControl component="fieldset" fullWidth>
                        <Typography variant="subtitle2" gutterBottom>약정유형</Typography>
                        <RadioGroup
                            row
                            value={formData.contractType}
                            onChange={(e) => {
                                handleContractTypeChange(e.target.value);
                            }}
                        >
                            <FormControlLabel value="standard" control={<Radio />} label="일반약정" />
                            <FormControlLabel value="selected" control={<Radio />} label="선택약정" />
                        </RadioGroup>
                    </FormControl>
                </Grid>
                <Grid item xs={12}>
                    <FormControl fullWidth>
                        <InputLabel>할부 개월</InputLabel>
                        <Select
                            value={formData.installmentPeriod}
                            label="할부 개월"
                            onChange={(e) => setFormData({ ...formData, installmentPeriod: e.target.value })}
                        >
                            <MenuItem value={24}>24개월</MenuItem>
                            <MenuItem value={30}>30개월</MenuItem>
                            <MenuItem value={36}>36개월</MenuItem>
                            <MenuItem value={0}>일시불</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
            </Grid>
        </Paper>
    );
};

export default ContractInfoFormSection;
