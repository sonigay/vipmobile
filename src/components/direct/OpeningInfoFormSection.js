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
    setStoreSupportWithAddon
    // 🔥 수정: 부가미유치 기준 제거 (setStoreSupportWithoutAddon prop 제거)
}) => {
    const handleOpeningTypeChange = async (newOpeningType) => {
        setFormData({ ...formData, openingType: newOpeningType });

        // 요금제가 선택되어 있으면 대리점추가지원금 재계산
        // 요금제가 없어도 initialData에 planGroup이 있으면 사용
        const selectedPlan = formData.plan ? planGroups.find(p => p.name === formData.plan) : null;
        const planGroup = selectedPlan?.group || null;
        
        if ((planGroup || initialData?.planGroup) && (initialData?.id || initialData?.model)) {
            const targetPlanGroup = planGroup || initialData.planGroup;
                try {
                    const openingTypeMap = {
                        'NEW': '010신규',
                        'MNP': 'MNP',
                        'CHANGE': '기변'
                    };
                    const openingType = openingTypeMap[newOpeningType] || '010신규';

                    // 모델 ID가 없으면 마스터 단말 데이터에서 조회
                    let modelId = initialData?.id;
                    if (!modelId && initialData?.model) {
                        try {
                            const mobiles = await directStoreApiClient.getMobilesMaster(selectedCarrier);
                            const foundMobile = mobiles.find(m =>
                                (m.model === initialData.model || m.petName === initialData.model) &&
                                m.carrier === selectedCarrier
                            );
                            if (foundMobile) {
                                modelId = foundMobile.id || foundMobile.model;
                            }
                        } catch (err) {
                            console.warn('모델 ID 찾기 실패 (마스터 기준):', err);
                        }
                    }

                    if (modelId) {
                        // 모델명은 로깅용으로만 사용하거나 생략 가능
                        // 마스터 가격 정책 조회
                        const pricingList = await directStoreApiClient.getMobilesPricing(selectedCarrier, {
                            modelId: modelId,
                            planGroup: targetPlanGroup,
                            openingType: openingType
                        });

                        // 결과가 있으면 업데이트
                        if (pricingList && pricingList.length > 0) {
                            const pricing = pricingList[0];

                            debugLog('OpeningInfoFormSection.js', '가입유형 변경 시 이통사지원금 업데이트', {
                                openingType: newOpeningType,
                                planGroup: targetPlanGroup,
                                publicSupport: pricing.publicSupport,
                                storeSupportWithAddon: pricing.storeSupportWithAddon
                                // 🔥 수정: 부가미유치 기준 제거 (storeSupportWithoutAddon 제거)
                            }, 'debug-session', 'run1', 'A');

                            setPublicSupport(pricing.publicSupport || 0);
                            setStoreSupportWithAddon(pricing.storeSupportWithAddon || 0);
                            // 🔥 수정: 부가미유치 기준 제거 (setStoreSupportWithoutAddon 호출 제거)
                        }
                    }
                } catch (err) {
                    console.error('대리점추가지원금 조회 실패:', err);
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
                    <FormControl component="fieldset" fullWidth>
                        <Typography variant="subtitle2" gutterBottom>가입유형</Typography>
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
