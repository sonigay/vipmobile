import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    TextField,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    RadioGroup,
    FormControlLabel,
    Radio,
    Checkbox,
    Button,
    Divider,
    Stack,
    IconButton,
    CircularProgress,
    Alert,
    Autocomplete
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    Print as PrintIcon,
    CheckCircle as CheckCircleIcon,
    Calculate as CalculateIcon
} from '@mui/icons-material';
import { directStoreApi } from '../../api/directStoreApi';
import { directStoreApiClient } from '../../api/directStoreApiClient';
import {
    calculateInstallmentFee,
    calculatePlanFee,
    calculateRequiredAddonsFee,
    calculateTotalMonthlyFee,
    calculateInstallmentPrincipalWithAddon,
    calculateInstallmentPrincipalWithoutAddon,
    calculateCashPrice
} from '../../utils/directStoreCalculationEngine';
import { CARRIER_THEMES, convertOpeningType } from '../../utils/directStoreUtils';
import { debugLog } from '../../utils/debugLogger';
import OpeningInfoFormSection from './OpeningInfoFormSection';
import ContractInfoFormSection from './ContractInfoFormSection';

const OpeningInfoPage = ({ 
    initialData, 
    onBack, 
    loggedInStore,
    mode = 'directStore', // 'customer' | 'directStore' | 'management'
    customerInfo = null, // 고객모드일 때 로그인한 고객 정보
    selectedStore = null, // 고객모드일 때 선택한 매장 정보
    saveToSheet = 'salesReport' // 'purchaseQueue' | 'salesReport'
}) => {
    const [selectedCarrier, setSelectedCarrier] = useState(initialData?.carrier || 'SK');
    const theme = CARRIER_THEMES[selectedCarrier] || CARRIER_THEMES['SK'];
    const [isSaving, setIsSaving] = useState(false);
    const [planGroups, setPlanGroups] = useState([]); // 요금제 그룹 목록
    const [selectedPlanGroup, setSelectedPlanGroup] = useState('');
    const [planBasicFee, setPlanBasicFee] = useState(0);
    const [requiredAddons, setRequiredAddons] = useState([]); // 필수 부가서비스 목록
    const [addonIncentiveList, setAddonIncentiveList] = useState([]); // 부가유치 시 유치되는 부가서비스 목록
    const [insuranceIncentiveList, setInsuranceIncentiveList] = useState([]); // 부가유치 시 유치되는 보험상품 목록
    const [agreementChecked, setAgreementChecked] = useState(false); // 동의 체크박스 상태
    const [baseMargin, setBaseMargin] = useState(0); // 정책설정에서 가져온 기본 마진
    const [preApprovalMark, setPreApprovalMark] = useState(null); // 사전승낙서 마크

    // 단말/지원금 기본값 정리 (휴대폰목록/오늘의휴대폰에서 전달된 데이터 사용)
    const factoryPrice = initialData?.factoryPrice || 0;
    // 🔥 개선: publicSupport를 state로 변경하여 요금제군/개통유형 변경 시 업데이트 가능하도록
    const [publicSupport, setPublicSupport] = useState(initialData?.publicSupport || initialData?.support || 0); // 이통사 지원금
    const [storeSupportWithAddon, setStoreSupportWithAddon] = useState(initialData?.storeSupport || 0); // 부가유치시 대리점추가지원금
    const [storeSupportWithoutAddon, setStoreSupportWithoutAddon] = useState(initialData?.storeSupportNoAddon || 0); // 부가미유치시 대리점추가지원금

    // openingType 변환은 유틸리티 함수 사용

    const [formData, setFormData] = useState({
        customerName: initialData?.customerName || '',
        customerContact: initialData?.customerContact || '',
        customerBirth: '',
        openingType: convertOpeningType(initialData?.openingType) || 'NEW', // NEW, MNP, CHANGE
        prevCarrier: initialData?.prevCarrier || '',
        contractType: initialData?.contractType || 'standard', // standard | selected (선택약정)
        installmentPeriod: initialData?.installmentPeriod || 24,
        plan: initialData?.plan || '', // 요금제명
        paymentType: initialData?.paymentType || 'installment', // installment | cash
        withAddon: initialData?.withAddon !== undefined ? initialData.withAddon : true, // 부가유치 여부 (true: 부가유치, false: 미유치)
        usePublicSupport: initialData?.usePublicSupport !== undefined ? initialData.usePublicSupport : true, // 이통사지원금 사용 여부
        lgPremier: initialData?.lgPremier || false, // LG 프리미어 약정 적용 여부
        cashPrice: initialData?.cashPrice || 0, // 현금가
        depositAccount: initialData?.depositAccount || '', // 입금계좌
        // 단말기/유심 정보
        deviceColor: initialData?.deviceColor || '',
        deviceSerial: initialData?.deviceSerial || '',
        simModel: initialData?.simModel || '',
        simSerial: initialData?.simSerial || '',
        // POS코드
        posCode: initialData?.posCode || ''
    });

    // 요금제 그룹 로드 (마스터 데이터 사용)
    useEffect(() => {
        const loadPlanGroups = async () => {
            try {
                // 마스터 데이터 API 호출
                const plans = await directStoreApiClient.getPlansMaster(selectedCarrier);

                if (plans && plans.length > 0) {
                    // 데이터 변환 (프론트엔드 형식에 맞게)
                    // Master Data Fields: planName, planGroup, basicFee
                    const formattedPlans = plans.map(p => ({
                        name: `${p.planName}(${p.planGroup})`,
                        planName: p.planName,
                        group: p.planGroup, // 서버는 planGroup 필드를 반환
                        basicFee: Number(p.basicFee)
                    }));

                    setPlanGroups(formattedPlans);

                    // 초기값 설정
                    let initialPlan = formattedPlans[0];
                    
                    // 1순위: initialData.plan이 있으면 정확히 매칭
                    if (initialData?.plan) {
                        const foundPlan = formattedPlans.find(p => 
                            p.name === initialData.plan || 
                            p.planName === initialData.plan ||
                            p.name.includes(initialData.plan)
                        );
                        if (foundPlan) {
                            initialPlan = foundPlan;
                        }
                    }
                    
                    // 2순위: initialData.planGroup으로 찾기
                    if (!initialPlan && initialData?.planGroup) {
                        const foundPlan = formattedPlans.find(p =>
                            p.group === initialData.planGroup ||
                            p.name.includes(initialData.planGroup)
                        );
                        if (foundPlan) {
                            initialPlan = foundPlan;
                        }
                    }

                    if (initialPlan) {
                        setSelectedPlanGroup(initialPlan.name);
                        setPlanBasicFee(initialPlan.basicFee);
                        setFormData(prev => ({ ...prev, plan: initialPlan.name }));
                    }
                } else {
                    console.warn('요금제 마스터 데이터가 비어있습니다.');
                    setPlanGroups([]);
                }
            } catch (err) {
                console.error('요금제 그룹 로드 실패:', err);
                // 에러 처리 (필요시 Mock 데이터 등으로 폴백)
            }
        };
        loadPlanGroups();
    }, [selectedCarrier, initialData?.planGroup, initialData?.plan]);

    // 필수 부가서비스 및 보험상품 로드 (정책설정에서 가져오기)
    useEffect(() => {
        const loadRequiredAddons = async () => {
            try {
                const policySettings = await directStoreApi.getPolicySettings(selectedCarrier);
                const required = [];
                const addonIncentives = [];
                const insuranceIncentives = [];

                // 마진 설정 값 저장
                if (policySettings.success && policySettings.margin?.baseMargin != null) {
                    setBaseMargin(Number(policySettings.margin.baseMargin) || 0);
                } else {
                    // 설정된 마진 금액이 없으면 0원으로 처리
                    setBaseMargin(0);
                }

                if (policySettings.success && policySettings.addon?.list) {
                    // 미유치차감금액이 있는 부가서비스를 필수 부가서비스로 간주
                    const addonList = policySettings.addon.list
                        .filter(addon => addon.deduction > 0)
                        .map(addon => ({
                            name: addon.name,
                            monthlyFee: addon.fee || 0,
                            type: 'addon'
                        }));
                    required.push(...addonList);

                    // 부가유치 시 유치되는 부가서비스 (incentive가 있는 항목)
                    const incentiveAddons = policySettings.addon.list
                        .filter(addon => addon.incentive > 0)
                        .map(addon => addon.name);
                    setAddonIncentiveList(incentiveAddons);
                }

                // 보험상품: 출고가 및 모델 유형(플립/폴드 여부)에 맞는 보험상품 찾기
                if (policySettings.success && policySettings.insurance?.list && factoryPrice > 0) {
                    const insuranceList = policySettings.insurance.list || [];

                    // 현재 단말이 플립/폴드 계열인지 여부 (펫네임/모델명 기준)
                    const modelNameForCheck = (initialData?.petName || initialData?.model || '').toString();
                    const lowerModelName = modelNameForCheck.toLowerCase();
                    const flipFoldKeywords = ['플립', '폴드', 'flip', 'fold'];
                    const isFlipFoldModel = flipFoldKeywords.some(keyword =>
                        lowerModelName.includes(keyword.toLowerCase())
                    );

                    // 보험상품 중 이름에 플립/폴드 관련 키워드가 포함된 상품
                    const flipFoldInsurances = insuranceList.filter(item => {
                        const name = (item.name || '').toString().toLowerCase();
                        return flipFoldKeywords.some(keyword =>
                            name.includes(keyword.toLowerCase())
                        );
                    });

                    // 일반 보험상품 (플립/폴드 전용 상품 제외)
                    const normalInsurances = insuranceList.filter(item => !flipFoldInsurances.includes(item));

                    let matchingInsurance = null;

                    if (selectedCarrier === 'LG' && isFlipFoldModel && flipFoldInsurances.length > 0) {
                        // LG + 플립/폴드 단말인 경우 → "폰교체 패스 플립/폴드" 상품 우선 사용
                        matchingInsurance = flipFoldInsurances.find(insurance => {
                            const minPrice = insurance.minPrice || 0;
                            const maxPrice = insurance.maxPrice || 9999999;
                            return factoryPrice >= minPrice && factoryPrice <= maxPrice;
                        }) || flipFoldInsurances[0];
                    } else {
                        // 그 외 모델들은 플립/폴드 전용 상품을 제외한 나머지 보험상품에서 출고가로 매칭
                        const baseList = normalInsurances.length > 0 ? normalInsurances : insuranceList;
                        matchingInsurance = baseList.find(insurance => {
                            const minPrice = insurance.minPrice || 0;
                            const maxPrice = insurance.maxPrice || 9999999;
                            return factoryPrice >= minPrice && factoryPrice <= maxPrice;
                        });
                    }

                    if (matchingInsurance) {
                        required.push({
                            name: matchingInsurance.name,
                            monthlyFee: matchingInsurance.fee || 0,
                            type: 'insurance'
                        });

                        // 부가유치 시 유치되는 보험상품 (incentive가 있는 경우)
                        if (matchingInsurance.incentive > 0) {
                            setInsuranceIncentiveList([matchingInsurance.name]);
                        }
                    }
                }

                if (required.length > 0) {
                    setRequiredAddons(required);
                } else {
                    // 정책설정이 없으면 Mock 데이터 사용
                    setRequiredAddons([
                        { name: '우주패스', monthlyFee: 9900, type: 'addon' },
                        { name: 'V컬러링', monthlyFee: 3300, type: 'addon' }
                    ]);
                }
            } catch (err) {
                console.error('필수 부가서비스 로드 실패:', err);
                // 에러 시 Mock 데이터 사용
                setRequiredAddons([
                    { name: '우주패스', monthlyFee: 9900, type: 'addon' },
                    { name: 'V컬러링', monthlyFee: 3300, type: 'addon' }
                ]);
            }
        };
        loadRequiredAddons();
    }, [selectedCarrier, factoryPrice]);

    // 사전승낙서 마크 로드
    useEffect(() => {
        const loadPreApprovalMark = async () => {
            const currentStore = mode === 'customer' ? selectedStore : loggedInStore;
            if (!currentStore?.name) {
                setPreApprovalMark(null);
                return;
            }

            try {
                const { customerAPI } = await import('../../api');
                const mark = await customerAPI.getPreApprovalMark(currentStore.name);
                setPreApprovalMark(mark?.url || null);
            } catch (error) {
                console.error('사전승낙서 마크 로드 실패:', error);
                setPreApprovalMark(null);
            }
        };
        loadPreApprovalMark();
    }, [mode, selectedStore, loggedInStore]);

    // initialData에서 planGroup과 openingType이 전달된 경우 대리점지원금 자동 계산 (마스터 데이터 사용)
    useEffect(() => {
        const calculateInitialPrice = async () => {
            if (!initialData?.planGroup || !initialData?.openingType || !planGroups.length || !initialData?.id) {
                return;
            }

            // planGroup에 해당하는 plan 찾기
            const foundPlan = planGroups.find(p =>
                p.group === initialData.planGroup ||
                p.name.includes(initialData.planGroup)
            );

            if (!foundPlan) {
                return;
            }

            try {
                const openingTypeMap = {
                    '010신규': '010신규',
                    'NEW': '010신규',
                    'MNP': 'MNP',
                    '기변': '기변',
                    'CHANGE': '기변'
                };
                const openingType = openingTypeMap[initialData.openingType] || '010신규';
                const modelId = initialData.id;

                // 마스터 가격 정책 조회
                const pricingList = await directStoreApiClient.getMobilesPricing(selectedCarrier, {
                    modelId: modelId,
                    planGroup: foundPlan.group,
                    openingType: openingType
                });

                if (pricingList && pricingList.length > 0) {
                    const pricing = pricingList[0];

                    // 값 업데이트
                    setPublicSupport(pricing.publicSupport || initialData?.publicSupport || 0);
                    setStoreSupportWithAddon(pricing.storeSupportWithAddon || 0);
                    setStoreSupportWithoutAddon(pricing.storeSupportWithoutAddon || 0);

                    // 일반약정이면 usePublicSupport를 true로 설정
                    if (formData.contractType === 'standard') {
                        setFormData(prev => ({ ...prev, usePublicSupport: true }));
                    }
                }
            } catch (err) {
                console.error('초기 대리점지원금 계산 실패:', err);
            }
        };

        calculateInitialPrice();
    }, [initialData?.planGroup, initialData?.openingType, planGroups, selectedCarrier, initialData?.id, formData.contractType]);

    // 계산 로직 (계산 엔진 사용)
    const getCurrentInstallmentPrincipal = () => {
        const support = formData.usePublicSupport ? publicSupport : 0;
        return formData.withAddon
            ? calculateInstallmentPrincipalWithAddon(factoryPrice, support, storeSupportWithAddon, formData.usePublicSupport)
            : calculateInstallmentPrincipalWithoutAddon(factoryPrice, support, storeSupportWithoutAddon, formData.usePublicSupport);
    };

    // 현금가 계산 함수
    const getCashPrice = () => {
        const principal = getCurrentInstallmentPrincipal();
        return calculateCashPrice(principal, formData.cashPrice);
    };

    // 계산된 값들을 메모이제이션하여 불필요한 재계산 방지
    const installmentPrincipal = getCurrentInstallmentPrincipal();
    const installmentFeeResult = calculateInstallmentFee(installmentPrincipal, formData.installmentPeriod);
    const planFeeResult = calculatePlanFee(planBasicFee, formData.contractType, selectedCarrier, formData.lgPremier);
    const addonsFeeResult = calculateRequiredAddonsFee(requiredAddons);
    const totalMonthlyFeeResult = calculateTotalMonthlyFee(
        formData.paymentType,
        installmentPrincipal,
        formData.installmentPeriod,
        planFeeResult,
        addonsFeeResult
    );
    const cashPriceResult = calculateCashPrice(installmentPrincipal, formData.cashPrice);

    const handlePrint = () => {
        window.print();
    };

    const handleComplete = async () => {
        try {
            // 동의 체크박스 검증
            if (!agreementChecked) {
                alert('동의사항에 체크되지 않았습니다. 해당 내용을 고객님께 정확히 안내하고 동의체크해주세요.');
                return;
            }

            setIsSaving(true);

            // 필수 데이터 검증
            if (!formData.customerName || !formData.customerContact) {
                alert('고객명과 연락처를 입력해주세요.');
                setIsSaving(false);
                return;
            }

            if (!formData.plan) {
                alert('요금제를 선택해주세요.');
                setIsSaving(false);
                return;
            }

            // 현재 매장 정보 결정 (고객모드 vs 직영점모드)
            const currentStore = mode === 'customer' ? selectedStore : loggedInStore;

            // 판매일보/구매대기 시트 구조에 맞는 데이터 구성
            const saveData = {
                // 기본 정보
                posCode: formData.posCode || currentStore?.id || '',
                company: currentStore?.name || '',
                storeName: currentStore?.name || '',
                storeId: currentStore?.id || '',
                soldAt: new Date().toISOString(),
                customerName: formData.customerName,
                customerContact: formData.customerContact, // CTN (연락처)
                carrier: selectedCarrier,
                model: initialData?.model || '', // 단말기모델명
                color: formData.deviceColor || '', // 색상
                deviceSerial: formData.deviceSerial || '', // 단말일련번호
                usimModel: formData.simModel || '', // 유심모델명
                usimSerial: formData.simSerial || '', // 유심일련번호
                openingType: formData.openingType, // 개통유형 (NEW, MNP, CHANGE)
                prevCarrier: formData.openingType === 'MNP' ? (formData.prevCarrier || '') : '', // 전통신사
                installmentType: formData.paymentType === 'installment' ? '할부' : formData.paymentType === 'cash' ? '현금' : '', // 할부구분
                installmentPeriod: formData.installmentPeriod || 24, // 할부개월
                contractType: formData.contractType === 'selected' ? '선택약정' : '일반약정', // 약정 (한글로 변환)
                contract: formData.contractType === 'selected' ? '선택약정' : '일반약정', // 약정 (하위 호환, 한글로 변환)
                plan: formData.plan || '', // 요금제
                addons: requiredAddons.map(a => a.name).join(', ') || '', // 부가서비스
                // 금액 정보
                factoryPrice: factoryPrice || 0, // 출고가
                publicSupport: formData.usePublicSupport ? publicSupport : 0, // 이통사지원금
                storeSupportWithAddon: formData.withAddon ? storeSupportWithAddon : 0, // 대리점추가지원금(부가유치)
                storeSupportNoAddon: !formData.withAddon ? storeSupportWithoutAddon : 0, // 대리점추가지원금(부가미유치)
                storeSupportWithoutAddon: !formData.withAddon ? storeSupportWithoutAddon : 0, // 하위 호환
                // 마진 계산
                // 구매가 = 출고가 - 이통사지원금 - 대리점추가지원금
                // - 구매가가 0원 이상이면 정책설정 마진(baseMargin)
                // - 구매가가 0원 미만(마이너스)이면 그 절대값을 마진으로 사용
                margin: (() => {
                    const appliedPublicSupport = formData.usePublicSupport ? publicSupport : 0;
                    const appliedStoreSupport = formData.withAddon ? storeSupportWithAddon : storeSupportWithoutAddon;
                    const purchasePrice = factoryPrice - appliedPublicSupport - appliedStoreSupport;

                    if (isNaN(purchasePrice)) return 0;
                    if (purchasePrice >= 0) {
                        return baseMargin || 0;
                    }
                    return Math.abs(purchasePrice);
                })(),
                // 계산된 값들 (참고용, 시트에는 저장 안 됨)
                installmentPrincipalWithAddon: calculateInstallmentPrincipalWithAddon(factoryPrice, publicSupport, storeSupportWithAddon, formData.usePublicSupport),
                installmentPrincipalWithoutAddon: calculateInstallmentPrincipalWithoutAddon(factoryPrice, publicSupport, storeSupportWithoutAddon, formData.usePublicSupport),
                installmentFee: installmentFeeResult,
                planFee: planFeeResult,
                requiredAddonsFee: addonsFeeResult,
                totalMonthlyFee: totalMonthlyFeeResult,
                cashPrice: formData.paymentType === 'cash' ? cashPriceResult : 0,
                depositAccount: formData.paymentType === 'cash' ? formData.depositAccount : '',
                status: '개통대기' // 초기 상태
            };

            console.log('저장할 데이터:', saveData);

            // 저장 대상에 따라 다른 API 호출
            if (saveToSheet === 'purchaseQueue') {
                // 구매대기 시트에 저장 (고객모드)
                // 개통유형 변환 (NEW/MNP/CHANGE -> 신규/번호이동/기기변경)
                const openingTypeMap = {
                    'NEW': '신규',
                    'MNP': '번호이동',
                    'CHANGE': '기기변경'
                };
                const activationType = openingTypeMap[formData.openingType] || '신규';
                
                const purchaseQueueData = {
                    ctn: customerInfo?.ctn || formData.customerContact,
                    name: customerInfo?.name || formData.customerName,
                    carrier: selectedCarrier,
                    model: initialData?.model || '',
                    color: formData.deviceColor || '',
                    deviceSerial: formData.deviceSerial || '',
                    usimModel: formData.simModel || '',
                    usimSerial: formData.simSerial || '',
                    activationType: activationType,
                    oldCarrier: formData.openingType === 'MNP' ? (formData.prevCarrier || '') : '',
                    installmentType: formData.paymentType === 'installment' ? '할부' : formData.paymentType === 'cash' ? '현금' : '',
                    installmentMonths: formData.installmentPeriod || 24,
                    contractType: formData.contractType === 'selected' ? '선택약정' : '일반약정',
                    plan: formData.plan || '',
                    additionalServices: requiredAddons.map(a => a.name).join(', ') || '',
                    factoryPrice: factoryPrice || 0,
                    carrierSupport: formData.usePublicSupport ? publicSupport : 0,
                    dealerSupportWithAdd: formData.withAddon ? storeSupportWithAddon : 0,
                    dealerSupportWithoutAdd: !formData.withAddon ? storeSupportWithoutAddon : 0,
                    // 선택매장 정보 추가
                    storeName: currentStore?.name || '',
                    storePhone: currentStore?.phone || currentStore?.storePhone || '',
                    storeAddress: currentStore?.address || '',
                    storeBankInfo: currentStore?.accountInfo || ''
                };
                
                const { customerAPI } = await import('../../api');
                
                // 수정 모드인지 확인 (initialData에 id가 있으면 수정 모드)
                if (initialData?.id) {
                    await customerAPI.updatePurchaseQueue(initialData.id, purchaseQueueData);
                    alert('구매 대기가 수정되었습니다.');
                } else {
                    await customerAPI.addToPurchaseQueue(purchaseQueueData);
                    alert('구매 대기가 등록되었습니다.');
                }
            } else {
                // 판매일보 시트에 저장 (직영점모드)
                // 수정 모드인지 확인
                if (initialData?.id || initialData?.번호) {
                    const rowId = initialData.id || initialData.번호;
                    await directStoreApiClient.updateSalesReport(rowId, saveData);
                    alert('개통 정보가 수정되었습니다.');
                } else {
                    await directStoreApiClient.createSalesReport(saveData);
                    alert('개통 정보가 저장되었습니다.');
                }
            }
            
            if (onBack) onBack();
        } catch (error) {
            console.error('저장 실패:', error);
            alert('저장에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Box className="print-root" sx={{ p: 3, height: '100%', overflow: 'auto', bgcolor: theme.bg }}>
            {/* 인쇄용 스타일 (레이아웃 그대로 출력) */}
            <style>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 5mm;
                    }

                    /* HTML/Body: 배경색 출력 강제 및 높이 제한 해제 */
                    html, body {
                        height: auto !important;
                        overflow: visible !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    /* 상단 헤더 숨김 */
                    .no-print {
                        display: none !important;
                    }

                    /* 전체 래퍼: 내용이 A4 한 장에 들어오도록 축소 (Zoom/Scale) */
                    .opening-wrapper, .print-root {
                        height: auto !important;
                        overflow: visible !important;
                        position: relative !important;
                        padding: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        
                        /* 핵심: 화면을 70%~75% 수준으로 축소하여 한 장에 맞춤 */
                        zoom: 0.70; 
                    }

                    /* 여백 미세 조정 (디자인 유지하되 불필요한 공백 제거) */
                    .agreement-box {
                        margin-bottom: 5px !important;
                        padding: 5px !important;
                        page-break-after: avoid !important;
                    }

                    .print-only {
                        margin-bottom: 10px !important;
                        display: block !important;
                    }
                    
                    /* 제목 폰트 크기 약간 조정 (너무 크면 공간 차지하므로) */
                    .print-only .MuiTypography-root {
                        font-size: 24px !important; 
                        font-weight: bold !important;
                    }

                    /* Grid 레이아웃 강제 2단 (50:50) 유지 */
                    .print-area > .MuiGrid-container {
                        display: flex !important;
                        flex-wrap: wrap !important;
                        width: 100% !important;
                        margin: 0 !important;
                        gap: 10px !important;
                    }

                    /* 메인 좌우 컬럼 강제 50% */
                    .print-area > .MuiGrid-container > .MuiGrid-item {
                        flex-basis: calc(50% - 5px) !important;
                        max-width: calc(50% - 5px) !important;
                        width: calc(50% - 5px) !important;
                        padding: 0 !important;
                        box-sizing: border-box !important;
                    }

                    /* Paper 컴포넌트: 그림자 제거, 테두리는 유지 */
                    .print-root .MuiPaper-root {
                        box-shadow: none !important;
                        border: 1px solid #e0e0e0 !important;
                        padding: 10px !important;
                        margin-bottom: 10px !important;
                        page-break-inside: avoid !important;
                    }

                    /* 내부 Grid item들도 2단 배치 필요한 경우 강제 */
                    .print-root .MuiPaper-root .MuiGrid-container > .MuiGrid-item[class*="grid-xs-12"][class*="grid-sm-6"] {
                        flex-basis: 50% !important;
                        max-width: 50% !important;
                    }
                    
                    /* 요금정보 섹션 내부 배치 */
                    .plan-info-section .MuiGrid-container > .MuiGrid-item[class*="grid-xs-12"]:nth-child(2),
                    .plan-info-section .MuiGrid-container > .MuiGrid-item[class*="grid-xs-12"]:nth-child(3) {
                         flex-basis: 50% !important;
                         max-width: 50% !important;
                    }

                    /* 입력 필드 높이 약간 줄임 */
                    .print-root .MuiInputBase-root {
                        min-height: 40px !important;
                        height: 40px !important;
                    }
                    
                    /* 계산 로직 상세 텍스트 등 불필요한 정보 숨김 */
                    .calculation-details {
                        display: none !important;
                    }

                    /* 스크롤바 숨김 */
                    ::-webkit-scrollbar {
                        display: none;
                    }
                }
            `}</style>

            {/* 헤더 */}
            <Box className="no-print" sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                <IconButton onClick={onBack} sx={{ mr: 2 }}>
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.primary }}>
                    {selectedCarrier} 개통정보를 입력해주세요
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Button
                    variant="outlined"
                    startIcon={<PrintIcon />}
                    sx={{ mr: 2, borderColor: theme.primary, color: theme.primary }}
                    onClick={handlePrint}
                >
                    인쇄하기
                </Button>
                <Button
                    variant="contained"
                    size="large"
                    startIcon={<CheckCircleIcon />}
                    sx={{ bgcolor: theme.primary, '&:hover': { bgcolor: theme.primary } }}
                    onClick={handleComplete}
                    disabled={isSaving || !agreementChecked}
                >
                    {isSaving ? <CircularProgress size={24} color="inherit" /> : '입력완료'}
                </Button>
            </Box>

            {/* 안내문구 및 동의 체크박스 */}
            <Box className="print-area agreement-box" sx={{ mb: 3, p: 2, bgcolor: 'rgba(0, 0, 0, 0.02)', borderRadius: 2, border: `1px solid ${theme.primary}20` }}>
                <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                        • 요금제는 183일 유지조건
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        • 부가서비스는 93일 유지조건
                    </Typography>
                    {/* 고객모드 전용 안내문구 */}
                    {mode === 'customer' && (
                        <>
                            <Typography variant="body2" color="error" sx={{ fontWeight: 600, mt: 1 }}>
                                • 대기자가 많을수 있으니 빠른 개통업무를 위해 입력된정보를 인쇄해서 방문해주세요
                            </Typography>
                            <Typography variant="body2" color="error" sx={{ fontWeight: 600 }}>
                                • 휴대폰정책상 매일 매시간 정책변동이 있을수 있어 개통방문시 개통순간 가격을 확인해주세요
                            </Typography>
                        </>
                    )}
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={agreementChecked}
                                onChange={(e) => setAgreementChecked(e.target.checked)}
                                sx={{ color: theme.primary }}
                            />
                        }
                        label={
                            <Typography variant="body2" color="text.primary">
                                미유지되어 계약을 위반할 시 할부금액을 조정해 청구됨에 동의합니다.
                            </Typography>
                        }
                    />
                </Stack>
            </Box>

            {/* 인쇄용 제목 */}
            <Box className="print-only" sx={{ display: 'none', '@media print': { display: 'block', mb: 1 } }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: theme.primary, textAlign: 'center' }}>
                    {selectedCarrier} 개통정보
                </Typography>
            </Box>

            <div className="print-area">
                <style>{`
                    @media print {
                        .print-only {
                            display: block !important;
                        }
                    }
                `}</style>
                <Grid container spacing={1}>
                    {/* 왼쪽: 통신사 정보, 가입 정보, 약정 및 할부 정보, 요금정보, 금액종합안내 */}
                    <Grid item xs={12} md={6}>
                        {/* 매장 정보 표시 (고객모드/직영점모드 공통) */}
                        {(mode === 'customer' ? selectedStore : loggedInStore) && (
                            <Paper sx={{ p: 1.5, mb: 1.5, borderTop: `3px solid ${theme.primary}`, bgcolor: theme.bg }}>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: theme.primary }}>
                                    매장 정보
                                </Typography>
                                <Stack spacing={1}>
                                    <Typography variant="body2">
                                        <strong>업체명:</strong> {(mode === 'customer' ? selectedStore : loggedInStore)?.name || ''}
                                    </Typography>
                                    <Typography variant="body2">
                                        <strong>연락처:</strong> {(mode === 'customer' ? selectedStore : loggedInStore)?.phone || (mode === 'customer' ? selectedStore : loggedInStore)?.storePhone || ''}
                                    </Typography>
                                    <Typography variant="body2">
                                        <strong>주소:</strong> {(mode === 'customer' ? selectedStore : loggedInStore)?.address || ''}
                                    </Typography>
                                    {(mode === 'customer' ? selectedStore : loggedInStore)?.accountInfo && (
                                        <Typography variant="body2">
                                            <strong>계좌정보:</strong> {(mode === 'customer' ? selectedStore : loggedInStore)?.accountInfo}
                                        </Typography>
                                    )}
                                    {preApprovalMark && (
                                        <Box sx={{ mt: 1 }}>
                                            <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 'bold' }}>
                                                사전승낙서 마크:
                                            </Typography>
                                            <Box dangerouslySetInnerHTML={{ __html: preApprovalMark }} />
                                        </Box>
                                    )}
                                </Stack>
                            </Paper>
                        )}

                        {/* 통신사 정보 박스 */}
                        <Paper sx={{ p: 1.5, mb: 1.5, borderTop: `3px solid ${theme.primary}`, bgcolor: theme.bg }}>
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: theme.primary, '@media print': { display: 'inline', mr: 2, mb: 0 } }}>
                                통신사 정보 {selectedCarrier} {selectedCarrier === 'SK' ? 'T' : selectedCarrier === 'KT' ? 'U+' : 'U+'}
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 'bold', color: theme.primary, '@media print': { display: 'none' } }}>
                                {selectedCarrier}
                            </Typography>
                        </Paper>

                        {/* 가입 정보 */}
                        <OpeningInfoFormSection
                            theme={theme}
                            formData={formData}
                            setFormData={setFormData}
                            selectedCarrier={selectedCarrier}
                            initialData={initialData}
                            selectedPlanGroup={selectedPlanGroup}
                            planGroups={planGroups}
                            setPublicSupport={setPublicSupport}
                            setStoreSupportWithAddon={setStoreSupportWithAddon}
                            setStoreSupportWithoutAddon={setStoreSupportWithoutAddon}
                        />

                        {/* 약정 및 할부 정보 */}
                        <ContractInfoFormSection
                            theme={theme}
                            formData={formData}
                            setFormData={setFormData}
                            selectedCarrier={selectedCarrier}
                            initialData={initialData}
                            selectedPlanGroup={selectedPlanGroup}
                            planGroups={planGroups}
                            setPublicSupport={setPublicSupport}
                        />

                        {/* 요금정보 */}
                        <Paper className="plan-info-section" sx={{ p: 2, mb: 1.5, borderTop: `3px solid ${theme.primary}` }}>
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>요금정보</Typography>
                            <Grid container spacing={1.5}>
                                <Grid item xs={12}>
                                    <Autocomplete
                                        options={planGroups}
                                        getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                                        value={planGroups.find(p => p.name === formData.plan) || null}
                                        onChange={async (event, newValue) => {
                                            if (newValue) {
                                                setFormData({ ...formData, plan: newValue.name });
                                                setSelectedPlanGroup(newValue.name);
                                                setPlanBasicFee(newValue.basicFee || 0);

                                                // 요금제군 추출하여 대리점추가지원금 자동 계산
                                                const planGroup = newValue.group || newValue.name;
                                                if (planGroup && (initialData?.id || initialData?.model)) {
                                                    try {
                                                        const openingTypeMap = {
                                                            'NEW': '010신규',
                                                            'MNP': 'MNP',
                                                            'CHANGE': '기변'
                                                        };
                                                        const openingType = openingTypeMap[formData.openingType] || '010신규';

                                                        // 모델 ID가 없으면 모델명과 통신사로 생성 (임시)
                                                        let modelId = initialData?.id;
                                                        let foundMobile = null; // 🔥 개선: 스코프 문제 해결을 위해 블록 밖에서 선언
                                                        if (!modelId && initialData?.model) {
                                                            // 마스터 데이터에서 해당 모델 찾기
                                                            try {
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
                                                                // 🔥 개선: 이통사지원금도 업데이트
                                                                debugLog('OpeningInfoPage.js:1292', '요금제 변경 시 이통사지원금 업데이트', {
                                                                    plan: newValue.name,
                                                                    planGroup,
                                                                    openingType,
                                                                    publicSupport: pricing.publicSupport,
                                                                    storeSupportWithAddon: pricing.storeSupportWithAddon,
                                                                    storeSupportWithoutAddon: pricing.storeSupportWithoutAddon
                                                                }, 'debug-session', 'run1', 'C');
                                                                setPublicSupport(pricing.publicSupport || 0);
                                                                setStoreSupportWithAddon(pricing.storeSupportWithAddon || 0);
                                                                setStoreSupportWithoutAddon(pricing.storeSupportWithoutAddon || 0);
                                                            }
                                                        }
                                                    } catch (err) {
                                                        console.error('대리점추가지원금 계산 실패:', err);
                                                    }
                                                }
                                            } else {
                                                setFormData({ ...formData, plan: '' });
                                                setSelectedPlanGroup('');
                                                setPlanBasicFee(0);
                                                // 초기값으로 복원
                                                setPublicSupport(initialData?.publicSupport || initialData?.support || 0);
                                                setStoreSupportWithAddon(initialData?.storeSupport || 0);
                                                setStoreSupportWithoutAddon(initialData?.storeSupportNoAddon || 0);
                                            }
                                        }}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="요금제 선택"
                                                placeholder="요금제명을 입력하세요"
                                            />
                                        )}
                                        filterOptions={(options, { inputValue }) => {
                                            return options.filter(option =>
                                                option.name.toLowerCase().includes(inputValue.toLowerCase())
                                            );
                                        }}
                                        noOptionsText="검색 결과가 없습니다"
                                    />
                                </Grid>
                                {formData.plan && (
                                    <>
                                        <Grid item xs={12} sm={6} sx={{ '@media print': { flexBasis: '50%', maxWidth: '50%' } }}>
                                            <TextField
                                                label="요금제군"
                                                fullWidth
                                                value={(() => {
                                                    const selectedPlan = planGroups.find(p => p.name === formData.plan);
                                                    return selectedPlan?.group || 'N/A';
                                                })()}
                                                InputProps={{ readOnly: true }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6} sx={{ '@media print': { flexBasis: '50%', maxWidth: '50%' } }}>
                                            <TextField
                                                label="기본료"
                                                fullWidth
                                                value={planBasicFee.toLocaleString()}
                                                InputProps={{ readOnly: true }}
                                            />
                                        </Grid>
                                        {formData.contractType === 'selected' && (
                                            <Grid item xs={12}>
                                                <Alert severity="info">
                                                    선택약정 할인: -{Math.floor(planBasicFee * 0.25).toLocaleString()}원
                                                </Alert>
                                            </Grid>
                                        )}
                                        {selectedCarrier === 'LG' && planBasicFee >= 85000 && (
                                            <Grid item xs={12}>
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={formData.lgPremier}
                                                            onChange={(e) => setFormData({ ...formData, lgPremier: e.target.checked })}
                                                        />
                                                    }
                                                    label="LG 프리미어 약정 적용"
                                                />
                                                {formData.lgPremier && (
                                                    <Typography variant="body2" color="error" sx={{ ml: 4 }}>
                                                        -5,250원
                                                    </Typography>
                                                )}
                                            </Grid>
                                        )}
                                        {requiredAddons.length > 0 && (
                                            <Grid item xs={12}>
                                                <Divider sx={{ my: 1 }} />
                                                <Typography variant="subtitle2" gutterBottom>필수 부가서비스</Typography>
                                                {requiredAddons.map((addon, idx) => (
                                                    <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                        <Typography variant="body2">{addon.name}</Typography>
                                                        <Typography variant="body2" color="primary">
                                                            +{addon.monthlyFee.toLocaleString()}원
                                                        </Typography>
                                                    </Box>
                                                ))}
                                            </Grid>
                                        )}
                                    </>
                                )}
                            </Grid>
                        </Paper>

                        {/* 금액종합안내 */}
                        <Paper sx={{ p: 2, bgcolor: '#333', color: '#fff', mb: 1.5 }}>
                            <Typography variant="h6" gutterBottom sx={{ color: '#ffd700', fontWeight: 'bold' }}>
                                금액종합안내
                            </Typography>
                            <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', mb: 2 }} />

                            {/* 단말기 금액 */}
                            <Typography variant="subtitle2" sx={{ mb: 1, color: '#ffd700' }}>단말기 금액</Typography>
                            <Stack direction="row" justifyContent="space-between" mb={1}>
                                <Typography variant="body2">출고가</Typography>
                                <Typography variant="body2">{factoryPrice.toLocaleString()}원</Typography>
                            </Stack>
                            {formData.usePublicSupport && (
                                <Stack direction="row" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2">이통사 지원금</Typography>
                                    <Typography variant="body2">-{publicSupport.toLocaleString()}원</Typography>
                                </Stack>
                            )}
                            <Stack direction="row" justifyContent="space-between" mb={1}>
                                <Typography variant="body2">
                                    대리점추가지원금 ({formData.withAddon ? '부가유치' : '부가미유치'})
                                </Typography>
                                <Typography variant="body2">
                                    -{(formData.withAddon ? storeSupportWithAddon : storeSupportWithoutAddon).toLocaleString()}원
                                </Typography>
                            </Stack>
                            {formData.paymentType === 'installment' && (
                                <Stack direction="row" justifyContent="space-between" mb={2}>
                                    <Typography variant="body2" fontWeight="bold">할부원금</Typography>
                                    <Typography variant="body2" fontWeight="bold" sx={{ color: '#ffd700' }}>
                                        {getCurrentInstallmentPrincipal().toLocaleString()}원
                                    </Typography>
                                </Stack>
                            )}
                            {formData.paymentType === 'cash' && (
                                <Stack direction="row" justifyContent="space-between" mb={2}>
                                    <Typography variant="body2" fontWeight="bold">현금가</Typography>
                                    <Typography variant="body2" fontWeight="bold" sx={{ color: '#ffd700' }}>
                                        {getCashPrice().toLocaleString()}원
                                    </Typography>
                                </Stack>
                            )}

                            <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', my: 2 }} />

                            {/* 요금 금액 */}
                            <Typography variant="subtitle2" sx={{ mb: 1, color: '#ffd700' }}>요금 금액</Typography>
                            <Stack direction="row" justifyContent="space-between" mb={1}>
                                <Typography variant="body2">기본료</Typography>
                                <Typography variant="body2">{planBasicFee.toLocaleString()}원</Typography>
                            </Stack>
                            {formData.contractType === 'selected' && (
                                <Stack direction="row" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2">선택약정 할인</Typography>
                                    <Typography variant="body2" color="error">
                                        -{Math.floor(planBasicFee * 0.25).toLocaleString()}원
                                    </Typography>
                                </Stack>
                            )}
                            {selectedCarrier === 'LG' && formData.lgPremier && planBasicFee >= 85000 && (
                                <Stack direction="row" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2">LG 프리미어 할인</Typography>
                                    <Typography variant="body2" color="error">-5,250원</Typography>
                                </Stack>
                            )}
                            {requiredAddons.length > 0 && (
                                <Stack direction="row" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2">필수 부가서비스</Typography>
                                    <Typography variant="body2" color="primary">
                                        +{addonsFeeResult.toLocaleString()}원
                                    </Typography>
                                </Stack>
                            )}

                            <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', my: 2 }} />

                            {/* 최종 합계 */}
                            <Stack direction="row" justifyContent="space-between" mb={1}>
                                <Typography variant="body1">월 할부금</Typography>
                                <Typography variant="body1">
                                    {formData.paymentType === 'installment'
                                        ? installmentFeeResult.monthly.toLocaleString()
                                        : '0'}원
                                </Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between" mb={2}>
                                <Typography variant="body1">월 기본료</Typography>
                                <Typography variant="body1">{planFeeResult.toLocaleString()}원</Typography>
                            </Stack>
                            {requiredAddons.length > 0 && (
                                <Stack direction="row" justifyContent="space-between" mb={2}>
                                    <Typography variant="body1">월 부가서비스</Typography>
                                    <Typography variant="body1">{addonsFeeResult.toLocaleString()}원</Typography>
                                </Stack>
                            )}

                            <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', mb: 2 }} />

                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="h5" fontWeight="bold">최종 월 납부금</Typography>
                                <Typography variant="h4" fontWeight="bold" sx={{ color: '#ffd700' }}>
                                    {totalMonthlyFeeResult.toLocaleString()}원
                                </Typography>
                            </Stack>
                        </Paper>
                    </Grid>

                    {/* 오른쪽: 단말기유심 정보 및 금액안내 */}
                    <Grid item xs={12} md={6}>
                        {/* 단말기유심 정보 및 금액안내 */}
                        <Paper sx={{ p: 2, borderTop: `3px solid ${theme.primary}` }}>
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>단말기유심 정보 및 금액안내</Typography>
                            <Grid container spacing={1.5}>
                                <Grid item xs={12}>
                                    <TextField
                                        label="모델명"
                                        fullWidth
                                        value={initialData?.model || ''}
                                        InputProps={{ readOnly: true }}
                                        variant="filled"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label="색상"
                                        fullWidth
                                        value={formData.deviceColor}
                                        onChange={(e) => setFormData({ ...formData, deviceColor: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label="단말일련번호"
                                        fullWidth
                                        value={formData.deviceSerial}
                                        onChange={(e) => setFormData({ ...formData, deviceSerial: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label="유심모델명"
                                        fullWidth
                                        value={formData.simModel}
                                        onChange={(e) => setFormData({ ...formData, simModel: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label="유심일련번호"
                                        fullWidth
                                        value={formData.simSerial}
                                        onChange={(e) => setFormData({ ...formData, simSerial: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <Divider sx={{ my: 2 }} />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        label="출고가"
                                        fullWidth
                                        value={factoryPrice.toLocaleString()}
                                        InputProps={{ readOnly: true }}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        label="이통사 지원금"
                                        fullWidth
                                        value={formData.usePublicSupport ? publicSupport.toLocaleString() : '0'}
                                        InputProps={{ readOnly: true }}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        label="대리점추가지원금 (부가유치)"
                                        fullWidth
                                        value={storeSupportWithAddon.toLocaleString()}
                                        InputProps={{ readOnly: true }}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        label="대리점추가지원금 (부가미유치)"
                                        fullWidth
                                        value={storeSupportWithoutAddon.toLocaleString()}
                                        InputProps={{ readOnly: true }}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        label="할부원금 (부가유치)"
                                        fullWidth
                                        value={(() => {
                                            const support = formData.usePublicSupport ? publicSupport : 0;
                                            const principal = calculateInstallmentPrincipalWithAddon(factoryPrice, support, storeSupportWithAddon, formData.usePublicSupport);
                                            return isNaN(principal) ? 0 : principal;
                                        })().toLocaleString()}
                                        InputProps={{ readOnly: true }}
                                        sx={{ input: { fontWeight: 'bold', color: theme.primary } }}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        label="할부원금 (부가미유치)"
                                        fullWidth
                                        value={(() => {
                                            const support = formData.usePublicSupport ? publicSupport : 0;
                                            const principal = calculateInstallmentPrincipalWithoutAddon(factoryPrice, support, storeSupportWithoutAddon, formData.usePublicSupport);
                                            return isNaN(principal) ? 0 : principal;
                                        })().toLocaleString()}
                                        InputProps={{ readOnly: true }}
                                        sx={{ input: { fontWeight: 'bold', color: theme.primary } }}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <FormControl component="fieldset" className="print-inline-group" sx={{ '@media print': { display: 'inline-block', mr: 2, verticalAlign: 'top' } }}>
                                        <Typography variant="subtitle2" gutterBottom sx={{ '@media print': { display: 'inline', mr: 1, mb: 0 } }}>부가서비스 유치 여부</Typography>
                                        <RadioGroup
                                            row
                                            value={formData.withAddon ? 'with' : 'without'}
                                            onChange={(e) => setFormData({ ...formData, withAddon: e.target.value === 'with' })}
                                        >
                                            <FormControlLabel value="with" control={<Radio />} label="부가유치" />
                                            <FormControlLabel value="without" control={<Radio />} label="부가미유치" />
                                        </RadioGroup>
                                        {/* 유치되는 부가서비스/보험상품 항목명 표기 */}
                                        {formData.withAddon && (addonIncentiveList.length > 0 || insuranceIncentiveList.length > 0) && (
                                            <Typography variant="caption" color="text.secondary" sx={{ ml: 2, fontSize: '0.75rem', '@media print': { ml: 1, display: 'inline' } }}>
                                                ({[...addonIncentiveList, ...insuranceIncentiveList].join(', ')})
                                            </Typography>
                                        )}
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12}>
                                    <FormControl component="fieldset" className="print-inline-group" sx={{ '@media print': { display: 'inline-block', mr: 2, verticalAlign: 'top' } }}>
                                        <Typography variant="subtitle2" gutterBottom sx={{ '@media print': { display: 'inline', mr: 1, mb: 0 } }}>할부/현금 선택</Typography>
                                        <RadioGroup
                                            row
                                            value={formData.paymentType}
                                            onChange={(e) => setFormData({ ...formData, paymentType: e.target.value })}
                                        >
                                            <FormControlLabel value="installment" control={<Radio />} label="할부" />
                                            <FormControlLabel value="cash" control={<Radio />} label="현금" />
                                        </RadioGroup>
                                    </FormControl>
                                </Grid>
                                {formData.paymentType === 'installment' && (
                                    <>
                                        <Grid item xs={12}>
                                            <Divider sx={{ my: 1 }} />
                                        </Grid>
                                        <Grid item xs={12}>
                                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                                                할부 상세 내역
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={12}>
                                            <TextField
                                                label="총 할부원금"
                                                fullWidth
                                                value={installmentPrincipal.toLocaleString()}
                                                InputProps={{ readOnly: true }}
                                                helperText={`부가${formData.withAddon ? '유치' : '미유치'} 기준`}
                                                sx={{
                                                    '& .MuiInputBase-input': {
                                                        fontWeight: 'bold',
                                                        color: theme.primary
                                                    }
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={6}>
                                            <TextField
                                                label="월 납부할부금"
                                                fullWidth
                                                value={installmentFeeResult.monthlyPrincipal?.toLocaleString() || '0'}
                                                InputProps={{ readOnly: true }}
                                                helperText="원금 부분 (평균값)"
                                            />
                                        </Grid>
                                        <Grid item xs={6}>
                                            <TextField
                                                label="월 할부수수료"
                                                fullWidth
                                                value={installmentFeeResult.monthlyFee?.toLocaleString() || '0'}
                                                InputProps={{ readOnly: true }}
                                                helperText="이자 부분 (평균값)"
                                            />
                                        </Grid>
                                        <Grid item xs={12}>
                                            <TextField
                                                label="월 납입금"
                                                fullWidth
                                                value={installmentFeeResult.monthly.toLocaleString()}
                                                InputProps={{ readOnly: true }}
                                                helperText="월 납부할부금 + 월 할부수수료"
                                                sx={{
                                                    '& .MuiInputBase-input': {
                                                        fontWeight: 'bold',
                                                        color: 'primary.main'
                                                    }
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={6}>
                                            <TextField
                                                label="총 할부수수료"
                                                fullWidth
                                                value={installmentFeeResult.total.toLocaleString()}
                                                InputProps={{ readOnly: true }}
                                                helperText="전체 기간 이자 합계"
                                            />
                                        </Grid>
                                        <Grid item xs={6}>
                                            <TextField
                                                label="총 납입금액"
                                                fullWidth
                                                value={(installmentPrincipal + installmentFeeResult.total).toLocaleString()}
                                                InputProps={{ readOnly: true }}
                                                helperText="할부원금 + 총 할부수수료"
                                            />
                                        </Grid>
                                        {installmentFeeResult.calculation && (
                                            <Grid item xs={12}>
                                                <Paper sx={{ p: 2, mt: 1, bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider' }}>
                                                    <Typography variant="caption" component="pre" sx={{
                                                        whiteSpace: 'pre-wrap',
                                                        fontFamily: 'monospace',
                                                        fontSize: '0.75rem',
                                                        lineHeight: 1.6
                                                    }}>
                                                        {installmentFeeResult.calculation}
                                                    </Typography>
                                                </Paper>
                                            </Grid>
                                        )}
                                    </>
                                )}
                                {formData.paymentType === 'cash' && (
                                    <>
                                        <Grid item xs={12}>
                                            <Divider sx={{ my: 1 }} />
                                        </Grid>
                                        <Grid item xs={6}>
                                            <TextField
                                                label="현금가"
                                                fullWidth
                                                type="number"
                                                value={getCashPrice()}
                                                onChange={(e) => {
                                                    const price = parseInt(e.target.value) || 0;
                                                    setFormData({ ...formData, cashPrice: price });
                                                }}
                                                disabled={getCurrentInstallmentPrincipal() > 0}
                                            />
                                        </Grid>
                                        <Grid item xs={6}>
                                            <TextField
                                                label="입금계좌"
                                                fullWidth
                                                value={formData.depositAccount}
                                                onChange={(e) => setFormData({ ...formData, depositAccount: e.target.value })}
                                            />
                                        </Grid>
                                    </>
                                )}
                            </Grid>
                        </Paper>
                    </Grid>
                </Grid>
            </div>
        </Box>
    );
};

export default OpeningInfoPage;
