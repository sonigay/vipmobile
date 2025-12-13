/**
 * 개통 정보 페이지 - 가입 정보 섹션 컴포넌트
 * OpeningInfoPage에서 분리된 가입 정보 폼 섹션
 */
import React from 'react';
import {
    Paper,
    Typography,
    Grid,
    TextField,
    FormControl,
    RadioGroup,
    FormControlLabel,
    Radio
} from '@mui/material';
import { directStoreApiClient } from '../../api/directStoreApiClient';
import { debugLog } from '../../utils/debugLogger';

const OpeningInfoFormSection = ({
    theme,
    formData,
    setFormData,
    selectedCarrier,
    initialData,
    selectedPlanGroup,
    planGroups,
    setPublicSupport,
    setStoreSupportWithAddon,
    setStoreSupportWithoutAddon
}) => {
    const handleOpeningTypeChange = async (newOpeningType) => {
        setFormData({ ...formData, openingType: newOpeningType });
        
        // 요금제가 선택되어 있으면 대리점추가지원금 재계산
        if (formData.plan && selectedPlanGroup) {
            const planGroup = planGroups.find(p => p.name === formData.plan)?.group || selectedPlanGroup;
            if (planGroup && (initialData?.id || initialData?.model)) {
                try {
                    const openingTypeMap = {
                        'NEW': '010신규',
                        'MNP': 'MNP',
                        'CHANGE': '기변'
                    };
                    const openingType = openingTypeMap[newOpeningType] || '010신규';
                    
                    // 모델 ID가 없으면 모델명과 통신사로 생성 (임시)
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
                        // 🔥 개선: modelName 전달 (휴대폰목록 페이지와 동일하게)
                        const modelName = initialData?.model || foundMobile?.model || null;
                        const result = await directStoreApiClient.calculateMobilePrice(
                            modelId,
                            planGroup,
                            openingType,
                            selectedCarrier,
                            modelName
                        );
                        
                        if (result.success) {
                            // 🔥 개선: 이통사지원금도 업데이트
                            debugLog('OpeningInfoFormSection.js', '가입유형 변경 시 이통사지원금 업데이트', {
                                openingType: newOpeningType,
                                planGroup,
                                publicSupport: result.publicSupport,
                                storeSupportWithAddon: result.storeSupportWithAddon,
                                storeSupportWithoutAddon: result.storeSupportWithoutAddon
                            }, 'debug-session', 'run1', 'A');
                            setPublicSupport(result.publicSupport || 0);
                            setStoreSupportWithAddon(result.storeSupportWithAddon || 0);
                            setStoreSupportWithoutAddon(result.storeSupportWithoutAddon || 0);
                        }
                    }
                } catch (err) {
                    console.error('대리점추가지원금 계산 실패:', err);
                }
            }
        }
    };

    return (
        <Paper sx={{ p: 2, mb: 1.5, borderTop: `3px solid ${theme.primary}` }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>가입 정보</Typography>
            <Grid container spacing={1.5}>
                <Grid item xs={12} sm={6}>
                    <TextField
                        label="고객명"
                        fullWidth
                        value={formData.customerName}
                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        label="연락처"
                        fullWidth
                        value={formData.customerContact}
                        onChange={(e) => setFormData({ ...formData, customerContact: e.target.value })}
                    />
                </Grid>
                <Grid item xs={12}>
                    <FormControl component="fieldset" className="print-inline-group" sx={{ '@media print': { display: 'inline-block', mr: 2, verticalAlign: 'top' } }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ '@media print': { display: 'inline', mr: 1, mb: 0 } }}>가입유형</Typography>
                        <RadioGroup
                            row
                            value={formData.openingType}
                            onChange={(e) => handleOpeningTypeChange(e.target.value)}
                        >
                            <FormControlLabel value="NEW" control={<Radio />} label="신규가입" />
                            <FormControlLabel value="MNP" control={<Radio />} label="번호이동" />
                            <FormControlLabel value="CHANGE" control={<Radio />} label="기기변경" />
                        </RadioGroup>
                    </FormControl>
                </Grid>
                {formData.openingType === 'MNP' && (
                    <Grid item xs={12}>
                        <TextField
                            label="전통신사"
                            fullWidth
                            value={formData.prevCarrier}
                            onChange={(e) => setFormData({ ...formData, prevCarrier: e.target.value })}
                            placeholder="SK, KT, LG 중 선택"
                        />
                    </Grid>
                )}
            </Grid>
        </Paper>
    );
};

export default OpeningInfoFormSection;
