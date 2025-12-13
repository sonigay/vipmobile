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
        setFormData({ ...formData, contractType: newContractType });
        
        // 🔥 개선: 선택약정일 때 이통사지원금 0으로 설정
        if (newContractType === 'selected') {
            setPublicSupport(0);
        } else {
            // 일반약정으로 변경 시 이통사지원금 재계산
            if (formData.plan && selectedPlanGroup && (initialData?.id || initialData?.model)) {
                const planGroup = planGroups.find(p => p.name === formData.plan)?.group || selectedPlanGroup;
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
                                const mobileList = await directStoreApiClient.getMobileList(selectedCarrier);
                                foundMobile = mobileList.find(m => 
                                    m.model === initialData.model && 
                                    m.carrier === selectedCarrier
                                );
                                if (foundMobile) {
                                    modelId = foundMobile.id;
                                }
                            } catch (err) {
                                console.warn('모델 ID 찾기 실패:', err);
                            }
                        }
                        
                        if (modelId) {
                            const modelName = initialData?.model || foundMobile?.model || null;
                            const result = await directStoreApiClient.calculateMobilePrice(
                                modelId,
                                planGroup,
                                openingType,
                                selectedCarrier,
                                modelName
                            );
                            
                            if (result.success) {
                                debugLog('ContractInfoFormSection.js', '일반약정 변경 시 이통사지원금 재계산', {
                                    contractType: 'standard',
                                    planGroup,
                                    openingType,
                                    publicSupport: result.publicSupport
                                }, 'debug-session', 'run1', 'B');
                                setPublicSupport(result.publicSupport || 0);
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
                    <FormControl component="fieldset" className="print-inline-group" sx={{ '@media print': { display: 'inline-block', mr: 2, verticalAlign: 'top' } }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ '@media print': { display: 'inline', mr: 1, mb: 0 } }}>약정유형</Typography>
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
