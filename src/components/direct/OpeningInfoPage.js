import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
    Autocomplete,
    useMediaQuery,
    useTheme
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    Print as PrintIcon,
    CheckCircle as CheckCircleIcon,
    Calculate as CalculateIcon,
    Add as AddIcon,
    Remove as RemoveIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import { directStoreApi } from '../../api/directStoreApi';
import { directStoreApiClient } from '../../api/directStoreApiClient';
import {
    calculateInstallmentFee,
    calculatePlanFee,
    calculateTotalMonthlyFee,
    calculateInstallmentPrincipalWithAddon,
    // 🔥 수정: 부가미유치 기준 제거
    // calculateInstallmentPrincipalWithoutAddon,
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
    const muiTheme = useTheme();
    const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
    const [selectedCarrier, setSelectedCarrier] = useState(initialData?.carrier || 'SK');
    const theme = CARRIER_THEMES[selectedCarrier] || CARRIER_THEMES['SK'];
    // 🔥 읽기 전용 모드: 고객모드에서 구매내역 상세정보 (판매일보 조회)
    const isReadOnly = mode === 'customer' && saveToSheet === 'sales';
    const [isSaving, setIsSaving] = useState(false);
    const [planGroups, setPlanGroups] = useState([]); // 요금제 그룹 목록
    const [selectedPlanGroup, setSelectedPlanGroup] = useState('');
    const [planBasicFee, setPlanBasicFee] = useState(0);
    // 🔥 개선: 통합된 선택 항목 관리 (부가서비스 + 보험상품)
    const [availableAddons, setAvailableAddons] = useState([]); // 선택 가능한 모든 부가서비스 목록 (incentive, deduction, description, url 정보 포함)
    const [availableInsurances, setAvailableInsurances] = useState([]); // 선택 가능한 모든 보험상품 목록 (incentive, deduction, description, url 정보 포함)
    const [selectedItems, setSelectedItems] = useState([]); // 사용자가 선택한 부가서비스/보험상품 배열 (통합 관리)
    const [agreementChecked, setAgreementChecked] = useState(false); // 동의 체크박스 상태
    const [baseMargin, setBaseMargin] = useState(0); // 정책설정에서 가져온 기본 마진
    const [preApprovalMark, setPreApprovalMark] = useState(null); // 사전승낙서 마크
    const [policySettings, setPolicySettings] = useState(null); // 🔥 정책 설정 전체 저장

    // 🔥 로딩 상태 관리 (항목별)
    const [loadingPlanGroups, setLoadingPlanGroups] = useState(true); // 요금제 그룹 로딩
    const [loadingAddonsAndInsurances, setLoadingAddonsAndInsurances] = useState(true); // 부가서비스/보험상품 로딩
    const [loadingSupportAmounts, setLoadingSupportAmounts] = useState(true); // 이통사지원금/대리점추가지원금 로딩

    // 단말/지원금 기본값 정리 (휴대폰목록/오늘의휴대폰에서 전달된 데이터 사용)
    const factoryPrice = initialData?.factoryPrice || 0;
    // 🔥 개선: publicSupport를 state로 변경하여 요금제군/개통유형 변경 시 업데이트 가능하도록
    const [publicSupport, setPublicSupport] = useState(
        initialData?.publicSupport || initialData?.이통사지원금 || initialData?.support || 0
    ); // 이통사 지원금
    const [storeSupportWithAddon, setStoreSupportWithAddon] = useState(
        // 🔥 수정: 저장된 대리점추가지원금을 우선적으로 사용 (790000 같은 값이 저장되어 있으면 그대로 사용)
        initialData?.storeSupport || initialData?.대리점추가지원금 || initialData?.storeSupportWithAddon || 0
    ); // 부가유치시 대리점추가지원금
    // 🔥 수정: 부가미유치 기준 제거 (부가서비스 선택/삭제 시 동적 계산으로 대체)
    const [additionalStoreSupport, setAdditionalStoreSupport] = useState(
        initialData?.additionalStoreSupport !== undefined && initialData?.additionalStoreSupport !== null
            ? initialData.additionalStoreSupport
            : (initialData?.대리점추가지원금직접입력 !== undefined && initialData?.대리점추가지원금직접입력 !== null
                ? initialData.대리점추가지원금직접입력
                : null)
    ); // 대리점추가지원금 직접입력 추가금액

    // 적용일시 상태 관리 (날짜, 시, 분)
    const getInitialDateTime = () => {
        // 🔥 수정: soldAt, 판매일시 필드 모두 확인
        const soldAtValue = initialData?.soldAt || initialData?.판매일시 || initialData?.saleDateTime;
        if (soldAtValue) {
            const date = new Date(soldAtValue);
            // 🔥 수정: UTC 시간을 그대로 사용 (시트에 저장된 UTC 시간)
            // 예: 2026-01-12T05:12:00.000Z → 05시 12분으로 표시
            return {
                date: date.toISOString().split('T')[0], // YYYY-MM-DD
                hour: date.getUTCHours().toString().padStart(2, '0'), // UTC 시간 사용
                minute: date.getUTCMinutes().toString().padStart(2, '0') // UTC 분 사용
            };
        }
        const now = new Date();
        return {
            date: now.toISOString().split('T')[0],
            hour: now.getHours().toString().padStart(2, '0'),
            minute: now.getMinutes().toString().padStart(2, '0')
        };
    };
    const [appliedDateTime, setAppliedDateTime] = useState(getInitialDateTime());

    // openingType 변환은 유틸리티 함수 사용

    // 🔥 개선: openingType 변환 함수 (한글 필드명도 처리)
    const getOpeningType = () => {
        const openingTypeValue = initialData?.openingType || initialData?.개통유형 || '';
        if (!openingTypeValue) return 'NEW';
        // 한글 값 처리
        if (openingTypeValue === '신규' || openingTypeValue === '010신규' || openingTypeValue === 'NEW') return 'NEW';
        if (openingTypeValue === '번호이동' || openingTypeValue === 'MNP') return 'MNP';
        if (openingTypeValue === '기기변경' || openingTypeValue === '기변' || openingTypeValue === 'CHANGE') return 'CHANGE';
        // 영문 값 처리
        return convertOpeningType(openingTypeValue);
    };

    // 🔥 개선: contractType 변환 함수 (한글 필드명도 처리)
    const getContractType = () => {
        const contractTypeValue = initialData?.contractType || initialData?.contract || initialData?.약정 || '';
        if (!contractTypeValue) return 'standard';
        // 한글 값 처리
        if (contractTypeValue === '선택약정' || contractTypeValue === 'selected') return 'selected';
        if (contractTypeValue === '일반약정' || contractTypeValue === 'standard') return 'standard';
        // 영문 값 처리
        return contractTypeValue === 'selected' ? 'selected' : 'standard';
    };

    // 🔥 개선: paymentType 변환 함수 (한글 필드명도 처리)
    const getPaymentType = () => {
        const paymentTypeValue = initialData?.paymentType || initialData?.installmentType || initialData?.할부구분 || '';
        if (!paymentTypeValue) return 'installment';
        // 한글 값 처리
        if (paymentTypeValue === '할부' || paymentTypeValue === 'installment') return 'installment';
        if (paymentTypeValue === '현금' || paymentTypeValue === 'cash') return 'cash';
        // 영문 값 처리
        return paymentTypeValue === 'cash' ? 'cash' : 'installment';
    };

    const [formData, setFormData] = useState({
        customerName: initialData?.customerName || initialData?.고객명 || '',
        customerContact: (initialData?.customerContact || initialData?.CTN || initialData?.ctn || initialData?.연락처 || '').toString(), // 🔥 수정: 문자열로 변환하여 앞의 0 유지
        customerBirth: '',
        openingType: getOpeningType(), // 🔥 수정: 한글 필드명도 처리
        prevCarrier: initialData?.prevCarrier || initialData?.전통신사 || '',
        contractType: getContractType(), // 🔥 수정: 한글 필드명도 처리
        installmentPeriod: initialData?.installmentPeriod || initialData?.할부개월 || 24,
        plan: initialData?.plan || initialData?.요금제 || '', // 요금제명
        paymentType: getPaymentType(), // 🔥 수정: 한글 필드명도 처리
        withAddon: initialData?.withAddon !== undefined ? initialData.withAddon : true, // 부가유치 여부 (true: 부가유치, false: 미유치)
        usePublicSupport: initialData?.usePublicSupport !== undefined ? initialData.usePublicSupport : true, // 이통사지원금 사용 여부
        lgPremier: initialData?.lgPremier !== undefined ? Boolean(initialData.lgPremier) : (initialData?.프리미어약정 === 'Y' || initialData?.프리미어약정 === true || false), // 🔥 수정: 한글 필드명도 처리, Boolean 변환
        cashPrice: initialData?.cashPrice || 0, // 현금가
        depositAccount: initialData?.depositAccount || '', // 입금계좌
        // 단말기/유심 정보 - 🔥 수정: 한글 필드명도 확인
        deviceColor: initialData?.deviceColor || initialData?.color || initialData?.색상 || '',
        deviceSerial: initialData?.deviceSerial || initialData?.단말일련번호 || '',
        simModel: initialData?.simModel || initialData?.usimModel || initialData?.유심모델명 || '',
        simSerial: initialData?.simSerial || initialData?.usimSerial || initialData?.유심일련번호 || '',
        // POS코드
        posCode: initialData?.posCode || ''
    });

    // 요금제 그룹 로드 (마스터 데이터 사용)
    useEffect(() => {
        const loadPlanGroups = async () => {
            setLoadingPlanGroups(true);
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
                    let initialPlan = null;

                    // 🔥 수정: 1순위: initialData.planGroup으로 정확히 매칭 (시세표에서 전달한 요금제군 우선)
                    if (initialData?.planGroup) {
                        const foundPlan = formattedPlans.find(p =>
                            p.group === initialData.planGroup
                        );
                        if (foundPlan) {
                            initialPlan = foundPlan;
                        }
                    }

                    // 2순위: initialData.plan이 있으면 정확히 매칭
                    if (!initialPlan && initialData?.plan) {
                        const foundPlan = formattedPlans.find(p =>
                            p.name === initialData.plan ||
                            p.planName === initialData.plan ||
                            p.name.includes(initialData.plan)
                        );
                        if (foundPlan) {
                            initialPlan = foundPlan;
                        }
                    }

                    // 3순위: 기본값 (첫 번째 요금제)
                    if (!initialPlan && formattedPlans.length > 0) {
                        initialPlan = formattedPlans[0];
                    }

                    if (initialPlan) {
                        setSelectedPlanGroup(initialPlan.name);
                        setPlanBasicFee(initialPlan.basicFee);
                        setFormData(prev => ({ ...prev, plan: initialPlan.name }));
                        // 🔥 수정: LG 통신사이고 85군 이상 요금제면 lgPremier 자동 체크
                        if (selectedCarrier === 'LG' && initialPlan.group) {
                            const groupNumber = parseInt(initialPlan.group.replace('군', '')) || 0;
                            if (groupNumber >= 85) {
                                setFormData(prev => ({ ...prev, lgPremier: true }));
                            }
                        }
                    }
                } else {
                    console.warn('요금제 마스터 데이터가 비어있습니다.');
                    setPlanGroups([]);
                }
            } catch (err) {
                console.error('요금제 그룹 로드 실패:', err);
                // 에러 처리 (필요시 Mock 데이터 등으로 폴백)
                setPlanGroups([]);
            } finally {
                setLoadingPlanGroups(false);
            }
        };
        loadPlanGroups();
    }, [selectedCarrier, initialData?.planGroup, initialData?.plan]);

    // 필수 부가서비스 및 보험상품 로드 함수 (재사용 가능하도록 분리)
    const loadAvailableItems = useCallback(async (forceRefresh = false) => {
        setLoadingAddonsAndInsurances(true);
        try {
            // 🔥 수정: 새로고침 버튼 클릭 시 캐시 무시하고 실제 데이터 다시 로드
            const policySettings = await directStoreApiClient.getPolicySettings(selectedCarrier, forceRefresh);
            const initialSelectedItems = [];

            // 🔥 정책 설정 전체 저장
            setPolicySettings(policySettings);

            // 마진 설정 값 저장
            if (policySettings.success && policySettings.margin?.baseMargin != null) {
                setBaseMargin(Number(policySettings.margin.baseMargin) || 0);
            } else {
                setBaseMargin(0);
            }

            if (policySettings.success && policySettings.addon?.list) {
                // 모든 부가서비스 목록 저장 (incentive, deduction, description, url 정보 포함)
                const allAddons = policySettings.addon.list.map(addon => ({
                    name: addon.name,
                    monthlyFee: addon.fee || 0,
                    incentive: addon.incentive || 0,
                    deduction: addon.deduction || 0,
                    description: addon.description || '',
                    url: addon.url || '',
                    type: 'addon'
                }));
                setAvailableAddons(allAddons);

                // 🔥 초기값: 정책설정에 있는 모든 부가서비스를 초기 선택
                // initialData에 이미 선택된 부가서비스가 있으면 그것을 우선 사용
                if (initialData?.additionalServices || initialData?.addons) {
                    const savedAddonNames = (initialData.additionalServices || initialData.addons || '')
                        .split(',')
                        .map(name => name.trim())
                        .filter(name => name);

                    // 저장된 부가서비스 이름과 매칭되는 항목만 선택
                    const savedAddons = allAddons.filter(addon =>
                        savedAddonNames.includes(addon.name)
                    );
                    initialSelectedItems.push(...savedAddons);
                } else {
                    // 새로 입력하는 경우: 정책설정에 있는 모든 부가서비스를 초기 선택
                    initialSelectedItems.push(...allAddons);
                }
            } else {
                setAvailableAddons([]);
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
                    matchingInsurance = flipFoldInsurances.find(insurance => {
                        const minPrice = insurance.minPrice || 0;
                        const maxPrice = insurance.maxPrice || 9999999;
                        return factoryPrice >= minPrice && factoryPrice <= maxPrice;
                    }) || flipFoldInsurances[0];
                } else {
                    const baseList = normalInsurances.length > 0 ? normalInsurances : insuranceList;
                    matchingInsurance = baseList.find(insurance => {
                        const minPrice = insurance.minPrice || 0;
                        const maxPrice = insurance.maxPrice || 9999999;
                        return factoryPrice >= minPrice && factoryPrice <= maxPrice;
                    });
                }

                // 모든 보험상품 목록 저장 (incentive, deduction, description, url 정보 포함)
                // 플립/폴드 모델일 때는 플립/폴드 보험상품만, 아닐 때는 일반 보험상품만 표시
                const allInsurances = insuranceList
                    .filter(insurance => {
                        // 출고가 범위 체크
                        const minPrice = insurance.minPrice || 0;
                        const maxPrice = insurance.maxPrice || 9999999;
                        const isPriceMatch = factoryPrice >= minPrice && factoryPrice <= maxPrice;

                        if (!isPriceMatch) return false;

                        // 보험상품 이름 확인
                        const insuranceName = (insurance.name || '').toString().toLowerCase();
                        const isFlipFoldInsurance = flipFoldKeywords.some(keyword =>
                            insuranceName.includes(keyword.toLowerCase())
                        );

                        // 플립/폴드 모델일 때는 플립/폴드 보험상품만, 아닐 때는 일반 보험상품만
                        if (isFlipFoldModel) {
                            // 플립/폴드 모델: 플립/폴드 보험상품만 포함
                            if (!isFlipFoldInsurance) {
                                return false; // 일반 보험상품 제외
                            }
                        } else {
                            // 일반 모델: 일반 보험상품만 포함
                            if (isFlipFoldInsurance) {
                                return false; // 플립/폴드 보험상품 제외
                            }
                        }

                        return true;
                    })
                    .map(insurance => ({
                        name: insurance.name,
                        monthlyFee: insurance.fee || 0,
                        incentive: insurance.incentive || 0,
                        deduction: insurance.deduction || 0,
                        description: insurance.description || '',
                        url: insurance.url || '',
                        type: 'insurance'
                    }));
                setAvailableInsurances(allInsurances);

                // 🔥 초기값: 정책설정에 있는 보험상품 중 출고가에 맞는 항목을 초기 선택
                // initialData에 이미 선택된 보험상품이 있으면 그것을 우선 사용
                if (initialData?.additionalServices || initialData?.addons) {
                    const savedItemNames = (initialData.additionalServices || initialData.addons || '')
                        .split(',')
                        .map(name => name.trim())
                        .filter(name => name);

                    // 저장된 보험상품 이름과 매칭되는 항목만 선택
                    const savedInsurances = allInsurances.filter(insurance =>
                        savedItemNames.includes(insurance.name)
                    );
                    initialSelectedItems.push(...savedInsurances);
                } else {
                    // 새로 입력하는 경우: 기존 로직대로 플립/폴드는 해당 상품, 그 외는 일반 보험을 선택
                    // matchingInsurance가 있으면 그것을 선택, 없으면 첫 번째 보험상품 선택
                    if (matchingInsurance) {
                        const matchedInsurance = allInsurances.find(ins => ins.name === matchingInsurance.name);
                        if (matchedInsurance) {
                            initialSelectedItems.push(matchedInsurance);
                        } else if (allInsurances.length > 0) {
                            // 매칭되는 보험상품이 없으면 첫 번째 보험상품 선택
                            initialSelectedItems.push(allInsurances[0]);
                        }
                    } else if (allInsurances.length > 0) {
                        // matchingInsurance가 없어도 보험상품이 있으면 첫 번째 보험상품 선택
                        initialSelectedItems.push(allInsurances[0]);
                    }
                }
            } else {
                setAvailableInsurances([]);
            }

            // 초기 선택 항목 설정
            setSelectedItems(initialSelectedItems);
        } catch (err) {
            console.error('부가서비스/보험상품 로드 실패:', err);
            setSelectedItems([]);
        } finally {
            setLoadingAddonsAndInsurances(false);
        }
    }, [selectedCarrier, factoryPrice, initialData?.petName, initialData?.model, initialData?.additionalServices, initialData?.addons, formData.openingType]);

    // 필수 부가서비스 및 보험상품 로드 (정책설정에서 가져오기)
    // 🔥 수정: 가입유형 변경 시에도 부가서비스 목록을 다시 로드하여 selectedItems 재설정
    useEffect(() => {
        loadAvailableItems();
    }, [loadAvailableItems]);

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
            // 🔥 수정: 부가서비스 로딩이 완료될 때까지 대기
            // 부가서비스 목록이 로드되지 않았으면 대기 (초기 로드 시 부가서비스 정보가 필요함)
            // 단, 정책 자체가 없어서 availableAddons/Insurances가 0일 수도 있으므로 loadingAddonsAndInsurances 상태를 함께 체크
            if (loadingAddonsAndInsurances) {
                return;
            }

            // 필수 데이터 체크
            if (!initialData?.planGroup || !initialData?.openingType || !planGroups.length || !initialData?.id) {
                // 데이터가 부족하면 로딩 종료
                setLoadingSupportAmounts(false);
                return;
            }

            setLoadingSupportAmounts(true);

            // 🔥 수정: planGroup에 해당하는 plan 정확히 매칭 (시세표에서 전달한 요금제군 우선)
            const foundPlan = planGroups.find(p =>
                p.group === initialData.planGroup
            );

            if (!foundPlan) {
                // 매칭 실패 시 에러 로그 및 로딩 상태 해제
                console.warn('요금제군 매칭 실패:', {
                    requestedPlanGroup: initialData.planGroup,
                    availablePlanGroups: planGroups.map(p => p.group)
                });
                setLoadingSupportAmounts(false);
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

                const openingType = openingTypeMap[formData.openingType] || openingTypeMap[initialData.openingType] || '010신규';
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

                    const baseStoreSupport = pricing.storeSupportWithAddon || 0;
                    setStoreSupportWithAddon(baseStoreSupport);

                    // 일반약정이면 usePublicSupport를 true로 설정
                    if (formData.contractType === 'standard') {
                        setFormData(prev => ({ ...prev, usePublicSupport: true }));
                    }
                }
            } catch (err) {
                console.error('초기 대리점지원금 계산 실패:', err);
            } finally {
                setLoadingSupportAmounts(false);
            }
        };

        calculateInitialPrice();
    }, [initialData?.planGroup, formData.openingType, planGroups, selectedCarrier, initialData?.id, loadingAddonsAndInsurances]);

    // 🔥 개선: 선택된 부가서비스/보험상품에 따른 대리점지원금 계산
    // 계산 로직:
    // - 초기값: storeSupportWithAddon (모든 항목이 유치된 상태, 예: 130,000원)
    // - 부가서비스 제거 시: 해당 항목의 incentive + deduction을 모두 차감
    //   예: incentive=30,000, deduction=10,000인 경우
    //   - 유치 시: 130,000원
    //   - 제거 시: 130,000 - 30,000 - 10,000 = 90,000원 (차액 40,000원)
    // 🔥 수정: 저장된 대리점추가지원금을 초기값으로 사용하고, 부가서비스 선택 변경 시에만 재계산
    const savedStoreSupport = initialData?.storeSupport || initialData?.대리점추가지원금;
    const hasSavedStoreSupport = savedStoreSupport !== undefined && savedStoreSupport !== null && savedStoreSupport !== 0;

    // 초기 로드 시 부가서비스 선택 상태 추적 (저장된 값과 일치하는지 확인)
    const initialSelectedItemsRef = useRef(null);
    const isInitialLoadRef = useRef(true);

    // 초기 로드 완료 여부 확인 (부가서비스 목록이 로드되고 selectedItems가 설정된 후)
    useEffect(() => {
        // 🔥 수정: 부가서비스 로딩이 완료되고 selectedItems가 설정된 후에만 initialSelectedItemsRef 설정
        // 가입유형 변경 후에도 새로운 selectedItems가 설정되면 initialSelectedItemsRef를 재설정해야 함
        if ((availableAddons.length > 0 || availableInsurances.length > 0) && !loadingAddonsAndInsurances) {
            // 🔥 수정: isInitialLoadRef가 true이거나 initialSelectedItemsRef가 null일 때 설정
            // 가입유형 변경 시 initialSelectedItemsRef가 null로 리셋되므로, 다시 설정해야 함
            // 🔥 중요: selectedItems가 변경되었을 때만 설정 (가입유형 변경 후 loadAvailableItems가 실행되어 selectedItems가 재설정된 경우)
            if ((isInitialLoadRef.current || initialSelectedItemsRef.current === null) && selectedItems.length >= 0) {
                // 🔥 수정: selectedItems의 깊은 복사 및 디버그 로그 추가
                const previousCount = initialSelectedItemsRef.current?.length || 0;
                const previousNames = initialSelectedItemsRef.current?.map(i => i.name).sort().join(',') || '';
                const currentNames = selectedItems.map(i => i.name).sort().join(',');

                // 🔥 수정: selectedItems가 실제로 변경되었을 때만 설정 (무한 루프 방지)
                if (previousNames !== currentNames || previousCount !== selectedItems.length || initialSelectedItemsRef.current === null) {
                    initialSelectedItemsRef.current = selectedItems.map(item => ({ ...item }));
                    isInitialLoadRef.current = false;
                    console.log('[OpeningInfoPage] initialSelectedItemsRef 설정:', {
                        openingType: formData.openingType,
                        previousCount,
                        currentCount: initialSelectedItemsRef.current.length,
                        previousNames,
                        currentNames,
                        items: initialSelectedItemsRef.current.map(i => ({ name: i.name, incentive: i.incentive, deduction: i.deduction }))
                    });
                }
            }
        }
    }, [selectedItems, availableAddons.length, availableInsurances.length, loadingAddonsAndInsurances, formData.openingType]);

    // 부가서비스 선택이 변경되었는지 확인
    const hasItemsChanged = useMemo(() => {
        if (!initialSelectedItemsRef.current) return false;
        if (selectedItems.length !== initialSelectedItemsRef.current.length) return true;
        const currentNames = selectedItems.map(item => item.name).sort();
        const initialNames = initialSelectedItemsRef.current.map(item => item.name).sort();
        return JSON.stringify(currentNames) !== JSON.stringify(initialNames);
    }, [selectedItems]);

    // 🔥 수정: 가입유형 변경 감지 및 savedStoreSupport 무효화
    const previousOpeningTypeRef = useRef(formData.openingType);
    const openingTypeChangedRef = useRef(false);
    useEffect(() => {
        // 가입유형이 변경되었는지 확인
        if (previousOpeningTypeRef.current !== formData.openingType && previousOpeningTypeRef.current !== undefined) {
            // 가입유형 변경 시 저장된 값 무효화 (이전 가입유형의 값이므로)
            // initialSelectedItemsRef를 리셋하여 새로운 가입유형에 맞는 부가서비스 선택 상태로 재설정
            console.log('[OpeningInfoPage] 가입유형 변경 감지:', {
                previous: previousOpeningTypeRef.current,
                current: formData.openingType
            });
            initialSelectedItemsRef.current = null;
            isInitialLoadRef.current = true;
            openingTypeChangedRef.current = true;
            previousOpeningTypeRef.current = formData.openingType;
            // 🔥 수정: 가입유형 변경 시 selectedItems도 초기화하여 loadAvailableItems가 다시 실행되도록 함
            // loadAvailableItems는 selectedItems가 변경되면 다시 실행되므로, 여기서는 초기화만 함
        } else if (previousOpeningTypeRef.current === undefined) {
            // 초기 로드 시
            previousOpeningTypeRef.current = formData.openingType;
        }
    }, [formData.openingType]);

    // 🔥 조건 기반 정책 필터링
    const conditionalPolicies = useMemo(() => {
        if (!policySettings?.success || !policySettings?.special?.list) {
            return [];
        }

        return policySettings.special.list
            .filter(policy => policy.isActive && policy.policyType === 'conditional')
            .map(policy => {
                try {
                    const conditionsJson = typeof policy.conditionsJson === 'string'
                        ? JSON.parse(policy.conditionsJson)
                        : policy.conditionsJson || {};

                    if (conditionsJson.type === 'conditional' && conditionsJson.conditions) {
                        return {
                            name: policy.name,
                            conditions: conditionsJson.conditions || []
                        };
                    }
                } catch (e) {
                    console.warn('정책 조건 JSON 파싱 실패:', e);
                }
                return null;
            })
            .filter(Boolean);
    }, [policySettings]);

    // 🔥 조건 기반 정책 적용 함수 (minStoreSupport 제외)
    const calculateConditionalPolicies = useMemo(() => {
        let totalAmount = 0;

        conditionalPolicies.forEach(policy => {
            policy.conditions.forEach(condition => {
                // 🔥 minStoreSupport가 있는 조건은 여기서 제외 (나중에 별도로 처리)
                if (condition.minStoreSupport) {
                    return; // minStoreSupport가 있으면 여기서는 계산하지 않음
                }

                // 모델 매칭
                const modelMatch = (condition.models || []).length === 0 ||
                    condition.models.some(model =>
                        initialData?.model === model ||
                        initialData?.petName === model ||
                        (initialData?.model || '').includes(model) ||
                        (initialData?.petName || '').includes(model)
                    );

                // 개통유형 매칭
                const openingTypeMatch = (condition.openingTypes || []).length === 0 ||
                    condition.openingTypes.includes(formData.openingType) ||
                    condition.openingTypes.includes(convertOpeningType(formData.openingType));

                // 요금제군 매칭
                const planGroupMatch = (condition.planGroups || []).length === 0 ||
                    condition.planGroups.includes(selectedPlanGroup) ||
                    condition.planGroups.includes(initialData?.planGroup);

                // 약정유형 매칭
                const contractTypeMatch = !condition.contractType ||
                    condition.contractType === formData.contractType;

                // 모든 조건이 일치하면 적용 (minStoreSupport 없는 조건만)
                if (modelMatch && openingTypeMatch && planGroupMatch && contractTypeMatch) {
                    totalAmount += condition.amount || 0;
                }
            });
        });

        return totalAmount;
    }, [
        conditionalPolicies,
        formData.openingType,
        formData.contractType,
        selectedPlanGroup,
        initialData?.model,
        initialData?.petName,
        initialData?.planGroup
    ]);

    const calculateDynamicStoreSupport = useMemo(() => {
        // 🔥 수정: 부가서비스가 로드되지 않았거나 initialSelectedItemsRef가 설정되지 않았으면 storeSupportWithAddon 그대로 반환
        // 부가서비스 로딩이 완료되지 않았으면 계산하지 않고 기본값 반환
        // 🔥 수정: 가입유형 변경 후 initialSelectedItemsRef가 null이면 계산하지 않고 기본값 반환
        if (loadingAddonsAndInsurances || initialSelectedItemsRef.current === null) {
            // 부가서비스 로딩 중이거나 초기 선택 항목이 설정되지 않았으면 storeSupportWithAddon 그대로 사용
            const baseValue = Number(storeSupportWithAddon) || 0;
            const additionalAmount = additionalStoreSupport !== null && additionalStoreSupport !== undefined ? Number(additionalStoreSupport) : 0;
            return {
                current: Math.max(0, baseValue + additionalAmount),
                withAddon: Math.max(0, baseValue + additionalAmount)
            };
        }

        // 🔥 수정: 가입유형이 변경되었으면 저장된 값 무시하고 최신 storeSupportWithAddon 사용
        const shouldUseSavedValue = hasSavedStoreSupport &&
            !openingTypeChangedRef.current &&
            (!hasItemsChanged || isInitialLoadRef.current);

        // 🔥 핵심: 저장된 값이 있고 초기 로드 상태이거나 부가서비스 선택이 변경되지 않았다면 저장된 값을 그대로 사용
        if (shouldUseSavedValue) {
            const additionalAmount = additionalStoreSupport !== null && additionalStoreSupport !== undefined ? Number(additionalStoreSupport) : 0;
            const savedValue = Number(savedStoreSupport) + additionalAmount;
            return {
                current: Math.max(0, savedValue),
                withAddon: Math.max(0, savedValue)
                // 🔥 수정: 부가미유치 기준 제거 (withoutAddon 필드 제거)
            };
        }

        // 🔥 핵심 로직: 저장된 대리점추가지원금이 있으면 그 값을 기준으로 계산
        // 저장된 값이 있으면 (예: 790000) 그 값을 기준으로 선택/해제에 따른 차이만 반영
        // 저장된 값이 없으면 storeSupportWithAddon을 기준으로 계산
        const baseStoreSupport = hasSavedStoreSupport
            ? Number(savedStoreSupport)
            : (Number(storeSupportWithAddon) || 0);

        // 🔥 수정: 저장된 값은 초기 선택된 항목(예: 보험 1개)의 incentive/deduction이 이미 포함된 값
        // 따라서 초기 선택된 항목의 incentive/deduction을 빼고, 현재 선택된 항목의 incentive/deduction을 더해야 함
        // 예: 저장된 값 790000 (보험 1개만 유치, 보험 incentive 40000 포함)
        //     초기 선택: 보험 1개 (incentive 40000)
        //     현재 선택: 보험 1개 + 부가서비스 1개 (incentive 40000 + 30000, deduction -10000)
        //     유치 시: incentive + |deduction| = 30000 + 10000 = 40000 증가
        //     = 790000 - 40000 + (40000 + 30000 + 10000) = 790000 + 30000 + 10000 = 830000
        const initialSelectedIncentive = (initialSelectedItemsRef.current || []).reduce((sum, item) => sum + (Number(item.incentive) || 0), 0);
        // 🔥 수정: deduction이 음수이므로, 유치 시에는 절댓값을 더해야 함 (미유치 시 차감이므로 유치 시에는 더함)
        const initialSelectedDeduction = (initialSelectedItemsRef.current || []).reduce((sum, item) => {
            const deduction = Number(item.deduction) || 0;
            return sum + Math.abs(deduction); // 유치 시에는 절댓값을 더함
        }, 0);

        const selectedIncentive = selectedItems.reduce((sum, item) => sum + (Number(item.incentive) || 0), 0);
        // 🔥 수정: deduction이 음수이므로, 유치 시에는 절댓값을 더해야 함
        const selectedDeduction = selectedItems.reduce((sum, item) => {
            const deduction = Number(item.deduction) || 0;
            return sum + Math.abs(deduction); // 유치 시에는 절댓값을 더함
        }, 0);

        // 🔥 수정: 저장된 값에서 초기 선택 항목의 incentive/deduction을 빼고, 현재 선택 항목의 incentive/deduction을 더함
        // 🔥 디버그: 계산 과정 로그 (개발 환경에서만)
        if (process.env.NODE_ENV === 'development') {
            console.log('[OpeningInfoPage] calculateDynamicStoreSupport 계산:', {
                baseStoreSupport,
                initialSelectedIncentive,
                initialSelectedDeduction,
                selectedIncentive,
                selectedDeduction,
                initialSelectedItems: initialSelectedItemsRef.current?.map(i => ({ name: i.name, incentive: i.incentive, deduction: i.deduction })),
                selectedItems: selectedItems.map(i => ({ name: i.name, incentive: i.incentive, deduction: i.deduction })),
                calculation: `${baseStoreSupport} - ${initialSelectedIncentive} - ${initialSelectedDeduction} + ${selectedIncentive} + ${selectedDeduction}`
            });
        }
        const finalStoreSupport = baseStoreSupport - initialSelectedIncentive - initialSelectedDeduction + selectedIncentive + selectedDeduction;

        // 직접입력 추가금액 반영 (음수도 허용)
        const additionalAmount = additionalStoreSupport !== null && additionalStoreSupport !== undefined ? Number(additionalStoreSupport) : 0;

        // 🔥 조건 기반 정책 적용 (minStoreSupport 제외)
        let conditionalPolicyAmount = calculateConditionalPolicies;

        // 🔥 minStoreSupport 조건이 있는 정책은 별도로 체크
        conditionalPolicies.forEach(policy => {
            policy.conditions.forEach(condition => {
                if (condition.minStoreSupport) {
                    // 이미 계산된 대리점추가지원금과 비교
                    const currentStoreSupport = finalStoreSupport + additionalAmount + conditionalPolicyAmount;
                    if (currentStoreSupport >= condition.minStoreSupport) {
                        // 조건 매칭 체크
                        const modelMatch = (condition.models || []).length === 0 ||
                            condition.models.some(model =>
                                initialData?.model === model ||
                                initialData?.petName === model ||
                                (initialData?.model || '').includes(model) ||
                                (initialData?.petName || '').includes(model)
                            );
                        const openingTypeMatch = (condition.openingTypes || []).length === 0 ||
                            condition.openingTypes.includes(formData.openingType) ||
                            condition.openingTypes.includes(convertOpeningType(formData.openingType));
                        const planGroupMatch = (condition.planGroups || []).length === 0 ||
                            condition.planGroups.includes(selectedPlanGroup) ||
                            condition.planGroups.includes(initialData?.planGroup);
                        const contractTypeMatch = !condition.contractType ||
                            condition.contractType === formData.contractType;

                        if (modelMatch && openingTypeMatch && planGroupMatch && contractTypeMatch) {
                            conditionalPolicyAmount += condition.amount || 0;
                        }
                    }
                }
            });
        });

        const finalWithPolicies = Math.max(0, finalStoreSupport + additionalAmount + conditionalPolicyAmount);

        return {
            // 현재 선택된 상태에 따른 하나의 대리점추가지원금 (직접입력 추가금액 + 조건정책 포함)
            current: finalWithPolicies,
            // 참고용 (UI 표시용)
            withAddon: Math.max(0, (Number(storeSupportWithAddon) || 0) + additionalAmount + conditionalPolicyAmount)
        };
        // 🔥 수정: formData.openingType 의존성 추가 (가입유형 변경 시 재계산)
        // 🔥 수정: storeSupportWithoutAddon 의존성 제거
        // 🔥 수정: loadingAddonsAndInsurances 의존성 추가 (부가서비스 로딩 완료 후 재계산)
        // 🔥 추가: 조건 기반 정책 의존성 추가
    }, [selectedItems, availableAddons, availableInsurances, storeSupportWithAddon, additionalStoreSupport, hasSavedStoreSupport, savedStoreSupport, hasItemsChanged, formData.openingType, loadingAddonsAndInsurances, calculateConditionalPolicies, conditionalPolicies, formData.contractType, selectedPlanGroup, initialData?.model, initialData?.petName, initialData?.planGroup]);

    // 🔥 추가: 일반약정 대리점추가지원금 표시 전용 함수 (표시만 수정, 저장 및 마진 계산에는 사용하지 않음)
    // 일반약정일 때: min(대리점추가지원금, 출고가 - 이통사지원금)
    // 선택약정일 때: 그대로 표시
    const calculateDisplayAgentSupportPrice = useMemo(() => {
        const dynamicSupport = calculateDynamicStoreSupport.current;

        // 선택약정이면 그대로 표시
        if (formData.contractType === 'selected') {
            return dynamicSupport;
        }

        // 일반약정일 때 차액 제한
        // 출고가 - 이통사지원금이 대리점추가지원금보다 작으면 차액만큼만 표시
        if (factoryPrice > publicSupport) {
            const difference = factoryPrice - publicSupport;
            return Math.min(dynamicSupport, difference);
        }

        return 0;
    }, [calculateDynamicStoreSupport, formData.contractType, factoryPrice, publicSupport]);

    // 🔥 수정: 저장된 할부원금을 초기값으로 사용하고, 부가서비스 선택 변경 시에만 재계산
    const savedInstallmentPrincipal = initialData?.installmentPrincipal || initialData?.할부원금;
    const hasSavedInstallmentPrincipal = savedInstallmentPrincipal !== undefined && savedInstallmentPrincipal !== null && savedInstallmentPrincipal !== 0;

    // 계산 로직 (계산 엔진 사용)
    // 🔥 개선: 선택된 부가서비스에 따라 하나의 대리점추가지원금만 사용
    const getCurrentInstallmentPrincipal = () => {
        // 🔥 핵심: 저장된 값이 있고 초기 로드 상태이거나 부가서비스 선택이 변경되지 않았다면 저장된 값을 그대로 사용
        if (hasSavedInstallmentPrincipal && (!hasItemsChanged || isInitialLoadRef.current)) {
            return Number(savedInstallmentPrincipal);
        }

        const support = formData.usePublicSupport ? publicSupport : 0;
        // 🔥 수정: 부가미유치 기준 제거, 부가서비스 선택 여부와 관계없이 동적 계산된 대리점추가지원금 사용
        const dynamicStoreSupport = calculateDynamicStoreSupport.current;
        // 부가서비스 선택/삭제에 따라 동적으로 계산된 대리점추가지원금 사용
        return calculateInstallmentPrincipalWithAddon(factoryPrice, support, dynamicStoreSupport, formData.usePublicSupport);
    };

    // 현금가 계산 함수
    const getCashPrice = () => {
        const principal = getCurrentInstallmentPrincipal();
        return calculateCashPrice(principal, formData.cashPrice);
    };

    // 🔥 개선: 선택된 항목이 하나라도 있으면 withAddon을 true로 자동 설정
    useEffect(() => {
        const hasSelectedItems = selectedItems.length > 0;
        // 현재 값과 다를 때만 업데이트 (무한 루프 방지)
        setFormData(prev => {
            if (prev.withAddon !== hasSelectedItems) {
                return { ...prev, withAddon: hasSelectedItems };
            }
            return prev; // 동일하면 이전 객체 반환
        });
    }, [selectedItems.length]);

    // 계산된 값들을 메모이제이션하여 불필요한 재계산 방지
    // 🔥 개선: selectedItems 변경 시 할부원금 재계산되도록 useMemo 사용
    // 🔥 수정: 저장된 값이 있으면 초기 로드 시 그대로 사용하고, 부가서비스 선택 변경 시에만 재계산
    const installmentPrincipal = useMemo(() => {
        return getCurrentInstallmentPrincipal();
    }, [selectedItems.length, formData.usePublicSupport, factoryPrice, publicSupport, calculateDynamicStoreSupport, hasSavedInstallmentPrincipal, savedInstallmentPrincipal, hasItemsChanged]);

    const installmentFeeResult = useMemo(() => {
        return calculateInstallmentFee(installmentPrincipal, formData.installmentPeriod);
    }, [installmentPrincipal, formData.installmentPeriod]);

    const planFeeResult = useMemo(() => {
        return calculatePlanFee(planBasicFee, formData.contractType, selectedCarrier, formData.lgPremier);
    }, [planBasicFee, formData.contractType, selectedCarrier, formData.lgPremier]);

    // 🔥 개선: 선택된 항목들의 월 요금 합계
    const addonsFeeResult = useMemo(() => {
        return selectedItems.reduce((sum, item) => sum + (item.monthlyFee || 0), 0);
    }, [selectedItems]);

    const totalMonthlyFeeResult = useMemo(() => {
        return calculateTotalMonthlyFee(
            formData.paymentType,
            installmentPrincipal,
            formData.installmentPeriod,
            planFeeResult,
            addonsFeeResult
        );
    }, [formData.paymentType, installmentPrincipal, formData.installmentPeriod, planFeeResult, addonsFeeResult]);

    const cashPriceResult = useMemo(() => {
        return calculateCashPrice(installmentPrincipal, formData.cashPrice);
    }, [installmentPrincipal, formData.cashPrice]);

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
                soldAt: (() => {
                    // 적용일시를 ISO 문자열로 변환
                    const { date, hour, minute } = appliedDateTime;
                    if (date && hour !== undefined && minute !== undefined) {
                        // 🔥 수정: 사용자가 입력한 시간을 그대로 UTC로 저장
                        // 예: 1월 12일 14시 12분 → 2026-01-12T14:12:00.000Z
                        // 로컬 시간대 오프셋을 고려하지 않고 입력한 시간을 그대로 UTC로 저장
                        const h = String(hour).padStart(2, '0');
                        const m = String(minute).padStart(2, '0');
                        return `${date}T${h}:${m}:00.000Z`;
                    }
                    // 기본값: 현재 시점
                    return new Date().toISOString();
                })(),
                customerName: formData.customerName,
                customerContact: String(formData.customerContact || ''), // 🔥 수정: CTN을 문자열로 명시적 변환하여 앞의 0 유지
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
                addons: selectedItems.map(a => a.name).join(', ') || '', // 부가서비스
                // 금액 정보
                factoryPrice: factoryPrice || 0, // 출고가
                publicSupport: formData.usePublicSupport ? publicSupport : 0, // 이통사지원금
                // 🔥 개선: 선택된 부가서비스에 따라 하나의 대리점추가지원금만 저장
                storeSupport: calculateDynamicStoreSupport.current, // 대리점추가지원금 (현재 선택된 상태에 따른 값)
                // 하위 호환을 위한 필드 (기존 API 호환성 유지)
                storeSupportWithAddon: calculateDynamicStoreSupport.current,
                // 🔥 수정: 부가미유치 기준 제거 (storeSupportNoAddon, storeSupportWithoutAddon 제거)
                // 마진 계산
                // 구매가 = 출고가 - 이통사지원금 - 대리점추가지원금
                // - 구매가가 0원 이상이면 정책설정 마진(baseMargin)
                // - 구매가가 0원 미만(마이너스)이면 그 절대값을 마진으로 사용
                // - 대리점추가지원금 직접입력이 음수면 그 절대값만큼 마진에 추가
                // - 대리점추가지원금 직접입력이 양수면 그 값만큼 마진에서 차감
                margin: (() => {
                    const appliedPublicSupport = formData.usePublicSupport ? publicSupport : 0;
                    // 🔥 개선: 선택된 부가서비스에 따라 하나의 대리점추가지원금만 사용
                    const appliedStoreSupport = calculateDynamicStoreSupport.current;
                    const purchasePrice = factoryPrice - appliedPublicSupport - appliedStoreSupport;

                    if (isNaN(purchasePrice)) return 0;

                    // 기본 마진 계산
                    let calculatedMargin = 0;
                    if (purchasePrice >= 0) {
                        calculatedMargin = baseMargin || 0;
                    } else {
                        calculatedMargin = Math.abs(purchasePrice);
                    }

                    // 🔥 대리점추가지원금 직접입력 반영
                    // 음수면 그 절대값만큼 마진에 추가, 양수면 그 값만큼 마진에서 차감
                    // 예: 직접입력 -40,000원 → 마진 +40,000원
                    // 예: 직접입력 +30,000원 → 마진 -30,000원
                    if (additionalStoreSupport !== null && additionalStoreSupport !== undefined && additionalStoreSupport !== 0) {
                        if (additionalStoreSupport < 0) {
                            // 음수: 마진에 추가
                            calculatedMargin += Math.abs(additionalStoreSupport);
                        } else {
                            // 양수: 마진에서 차감
                            calculatedMargin = Math.max(0, calculatedMargin - additionalStoreSupport);
                        }
                    }

                    return calculatedMargin;
                })(),
                // 할부원금 저장 (현재 선택된 상태에 따른 값)
                installmentPrincipal: getCurrentInstallmentPrincipal(),
                // LG 프리미어 약정 적용
                lgPremier: formData.lgPremier || false,
                // 계산된 값들 (참고용, 시트에는 저장 안 됨)
                installmentPrincipalWithAddon: calculateInstallmentPrincipalWithAddon(factoryPrice, publicSupport, calculateDynamicStoreSupport.current, formData.usePublicSupport),
                // 🔥 수정: 부가미유치 기준 제거 (installmentPrincipalWithoutAddon 제거)
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
                    ctn: (formData.customerContact || customerInfo?.ctn || '').toString(), // 🔥 수정: 폼 입력을 우선적으로 사용
                    name: formData.customerName || customerInfo?.name || '',               // 🔥 수정: 폼 입력을 우선적으로 사용
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
                    additionalServices: selectedItems.map(a => a.name).join(', ') || '',
                    factoryPrice: factoryPrice || 0,
                    carrierSupport: formData.usePublicSupport ? publicSupport : 0,
                    // 🔥 개선: 선택된 부가서비스에 따라 하나의 대리점추가지원금만 저장
                    dealerSupport: calculateDynamicStoreSupport.current, // 대리점추가지원금 (현재 선택된 상태에 따른 값, 직접입력 추가금액 포함)
                    additionalStoreSupport: additionalStoreSupport !== null && additionalStoreSupport !== undefined ? additionalStoreSupport : 0, // 대리점추가지원금 직접입력 추가금액 (음수 허용)
                    // 하위 호환을 위한 필드
                    dealerSupportWithAdd: formData.withAddon ? calculateDynamicStoreSupport.current : 0,
                    // 🔥 수정: 부가미유치 기준 제거 (dealerSupportWithoutAdd 제거)
                    // 선택매장 정보 추가
                    storeName: currentStore?.name || '',
                    storePhone: currentStore?.phone || currentStore?.storePhone || '',
                    storeAddress: currentStore?.address || '',
                    storeBankInfo: currentStore?.accountInfo || '',
                    // 🔥 추가: 익명 고객 추적 및 기기 정보
                    deviceInfo: window.navigator.userAgent,
                    isAnonymous: customerInfo?.isFirstPurchaseAdmin || false
                };

                const { customerAPI } = await import('../../api');

                // 수정 모드인지 확인 (purchaseQueueId가 있으면 수정 모드)
                // initialData.id는 상품 ID일 수 있으므로 purchaseQueueId를 별도로 확인
                const purchaseQueueId = initialData?.purchaseQueueId;
                if (purchaseQueueId) {
                    // purchaseQueueId가 명시적으로 전달된 경우에만 수정 모드
                    await customerAPI.updatePurchaseQueue(purchaseQueueId, purchaseQueueData);
                    alert('구매 대기가 수정되었습니다.');
                } else {
                    // 새로 등록
                    await customerAPI.addToPurchaseQueue(purchaseQueueData);
                    alert('구매 대기가 등록되었습니다.');
                }
            } else {
                // 판매일보 시트에 저장 (직영점모드)
                // 수정 모드인지 확인
                // initialData.id는 상품(모델) ID일 수 있으므로 판매일보 ID를 명확히 구분
                // 판매일보 ID는 'sales-'로 시작하는 ID이거나 '번호' 필드에 있는 경우만 사용
                const salesReportId = initialData?.번호 ||
                    (initialData?.id && initialData.id.toString().startsWith('sales-') ? initialData.id : null);

                if (salesReportId) {
                    // 판매일보 수정 모드
                    await directStoreApiClient.updateSalesReport(salesReportId, saveData);
                    alert('개통 정보가 수정되었습니다.');
                } else {
                    // 판매일보 생성 모드
                    await directStoreApiClient.createSalesReport(saveData);
                    alert('개통 정보가 저장되었습니다.');
                }
            }

            if (onBack) onBack();
        } catch (error) {
            console.error('저장 실패:', error);
            console.error('에러 상세:', {
                message: error.message,
                stack: error.stack,
                response: error.response,
                data: error.response?.data
            });

            // 더 구체적인 에러 메시지 제공
            let errorMessage = '저장에 실패했습니다.';
            if (error.response?.data?.error) {
                errorMessage = `저장에 실패했습니다.\n사유: ${error.response.data.error}`;
            } else if (error.message) {
                errorMessage = `저장에 실패했습니다.\n사유: ${error.message}`;
            }

            alert(errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Box className={`print-root mode-${mode}`} sx={{
            p: { xs: 1, sm: 2, md: 3 },
            height: '100%',
            overflow: 'auto',
            bgcolor: theme.bg,
            '& .MuiTypography-root': {
                wordBreak: 'keep-all', // 단어 단위로 줄바꿈
                overflowWrap: 'break-word' // 긴 단어는 강제 줄바꿈
            }
        }}>
            {/* 인쇄용 스타일 (WYSIWYG: 화면 그대로 출력) */}
            <style>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 5mm; /* 최소 여백 확보 */
                    }

                    /* 기본 설정: 모든 부모 요소의 높이 제한 해제 & 배경색 강제 출력 */
                    html, body, #root, .App {
                        height: auto !important;
                        min-height: 100% !important;
                        overflow: visible !important;
                        background-color: white !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    /* 인쇄 불필요 요소 숨김 */
                    .no-print, 
                    .MuiIconButton-root, 
                    header, 
                    nav,
                    .MuiDialog-container {
                        display: none !important;
                    }
                    
                    /* 인쇄 전용 요소 표시 */
                    .print-only {
                        display: block !important;
                    }

                    /* 메인 컨테이너 설정 */
                    .print-root {
                        /* 
                           인쇄 시 데스크탑 뷰(2단 컬럼) 강제 유지 및 A4 너비에 자동으로 맞춤
                           - width: 100%로 설정하여 브라우저가 자동으로 용지 너비에 맞춰 늘림
                           - zoom: 0.60으로 폰트 크기와 세로 간격 유지
                        */
                        width: 100% !important;
                        min-width: 100% !important;
                        max-width: 100% !important;
                        
                        /* A4 용지 한 장에 넣기 위해 축소 비율 더 낮춤 */
                        zoom: 0.60; 
                        
                        /* 높이 제한 해제 */
                        height: auto !important;
                        min-height: 100% !important;
                        overflow: visible !important;
                        
                        /* 배경 및 여백 설정 - 컨테이너 내부 여백 최소화 */
                        background-color: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        
                        /* 폰트 및 줄간격 전역 축소 */
                        font-family: "Noto Sans KR", sans-serif !important;
                        line-height: 1.1 !important;
                        
                        /* 페이지 나눔 방지 노력 */
                        page-break-inside: avoid;
                    }

                    /* 인쇄 시 내부 간격 축소 (한 장에 담기 위해) */
                    .print-root .MuiGrid-root {
                        margin-top: 0 !important;
                        margin-bottom: 0 !important;
                    }
                    
                    .print-root .MuiBox-root {
                        padding-top: 4px !important;
                        padding-bottom: 4px !important;
                    }

                    /* 스크롤바 강제 숨김 (모든 요소) */
                    * {
                        -webkit-overflow-scrolling: touch !important;
                        overflow: visible !important; 
                    }
                    
                    /* 스크롤바 영역 자체를 제거 */
                    ::-webkit-scrollbar {
                        display: none !important;
                        width: 0 !important;
                        height: 0 !important;
                    }
                    
                    /* Firefox 호환 */
                    html, body {
                        scrollbar-width: none !important;
                    }

                    /* Grid Item 강제 배치 (화면과 동일하게) & 간격 축소 */
                    .print-root .MuiGrid-container > .MuiGrid-item.MuiGrid-grid-md-6 {
                        flex-basis: 50% !important;
                        max-width: 50% !important;
                        width: 50% !important;
                        padding-top: 2px !important; /* 상단 여백 극한 축소 */
                        padding-bottom: 2px !important; /* 하단 여백 극한 축소 */
                    }
                    
                    /* 모든 Grid Item 간격 축소 */
                    .print-root .MuiGrid-item {
                        padding-top: 2px !important;
                        padding-bottom: 2px !important;
                    }

                    /* 입력 필드 높이 및 여백 강제 축소 */
                    .print-root .MuiTextField-root,
                    .print-root .MuiFormControl-root {
                        margin-bottom: 2px !important;
                        margin-top: 0 !important;
                    }

                    /* Input 내부 패딩 축소 (Dense보다 더 좁게) */
                    .print-root .MuiInputBase-root {
                        min-height: 28px !important; /* 최소 높이 더 줄임 */
                        font-size: 0.8rem !important;
                        line-height: 1.1 !important;
                    }
                    .print-root .MuiInputBase-input {
                        padding: 2px 6px !important; /* 내부 패딩 최소화 */
                    }
                    .print-root .MuiInputLabel-root {
                        transform: translate(12px, 4px) scale(0.9) !important; /* 라벨 위치/크기 조정 */
                        font-size: 0.8rem !important;
                    }
                    .print-root .MuiInputLabel-shrink {
                        transform: translate(12px, -6px) scale(0.7) !important; /* 슈링크 라벨 위치 조정 */
                    }
                    
                    /* 제목 및 텍스트 여백 축소 */
                    .print-root .MuiTypography-h6 {
                        font-size: 0.95rem !important;
                        margin-bottom: 2px !important;
                        min-height: auto !important;
                        line-height: 1.2 !important;
                    }
                    .print-root .MuiTypography-body2 {
                        font-size: 0.75rem !important;
                        line-height: 1.2 !important;
                    }

                    .calculation-details .MuiTypography-root {
                        font-size: 0.8rem !important;
                        line-height: 1.3 !important;
                    }
                    
                    /* 구분선 여백 제거 */
                    .print-root .MuiDivider-root {
                        margin-top: 2px !important;
                        margin-bottom: 2px !important;
                    }

                    /* Paper 그림자 제거 및 테두리 단순화 */
                    .MuiPaper-root {
                        box-shadow: none !important;
                        border: 1px solid #ddd !important;
                        padding: 6px !important; /* 내부 패딩 축소 */
                        margin-bottom: 4px !important; /* 외부 여백 축소 */
                    }
                    
                    /* 안내문구 박스 (agreement-box) 압축 */
                    .print-area.agreement-box {
                        padding: 6px !important;
                        margin-bottom: 4px !important;
                        border-radius: 4px !important;
                    }
                    .print-area.agreement-box .MuiTypography-body2 {
                         font-size: 0.7rem !important;
                         margin-bottom: 0 !important;
                    }
                    .print-area.agreement-box .MuiStack-root {
                        gap: 2px !important;
                    }
                    .print-area.agreement-box .MuiFormControlLabel-root {
                        margin-right: 0 !important;
                        margin-left: -4px !important;
                    }
                    .print-area.agreement-box .MuiCheckbox-root {
                        padding: 2px !important;
                    }
                }
            `}</style>



            {/* 헤더 */}
            <Box className="no-print" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <IconButton onClick={onBack} sx={{ mr: 2 }}>
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.primary, fontSize: { xs: '1.25rem', sm: '1.5rem', md: '2rem' } }}>
                    {isReadOnly ? `${selectedCarrier} 구매내역 상세정보` : `${selectedCarrier} 개통정보를 입력해주세요`}
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Button
                    variant="outlined"
                    startIcon={<PrintIcon />}
                    sx={{
                        mr: isReadOnly ? 0 : 2,
                        borderColor: theme.primary,
                        color: theme.primary,
                        fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem' },
                        px: { xs: 1, sm: 2 }
                    }}
                    onClick={handlePrint}
                >
                    인쇄하기
                </Button>
                {!isReadOnly && (
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={<CheckCircleIcon />}
                        sx={{
                            bgcolor: theme.primary,
                            '&:hover': { bgcolor: theme.primary },
                            fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem' },
                            px: { xs: 1, sm: 2 }
                        }}
                        onClick={handleComplete}
                        disabled={isSaving || !agreementChecked}
                    >
                        {isSaving ? <CircularProgress size={24} color="inherit" /> : '입력완료'}
                    </Button>
                )}
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
                    {mode === 'customer' && !isReadOnly && (
                        <>
                            <Typography variant="body2" color="error" sx={{ fontWeight: 600, mt: 1 }}>
                                • 대기자가 많을수 있으니 빠른 개통업무를 위해 입력된정보를 인쇄해서 방문해주세요
                            </Typography>
                            <Typography variant="body2" color="error" sx={{ fontWeight: 600 }}>
                                • 휴대폰정책상 매일 매시간 정책변동이 있을수 있어 개통방문시 개통순간 가격을 확인해주세요
                            </Typography>
                        </>
                    )}
                    {/* 읽기 전용 모드에서는 체크박스 제거하고 안내문구로 강조 */}
                    {isReadOnly ? (
                        <Alert severity="warning" sx={{ mt: 1, fontWeight: 'bold' }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                ⚠️ 미유지되어 계약을 위반할 시 할부금액을 조정해 청구됩니다.
                            </Typography>
                        </Alert>
                    ) : (
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
                    )}
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
                <Grid container spacing={{ xs: 1, sm: 1.5, md: 2 }}>
                    {/* 왼쪽: 통신사 정보, 가입 정보, 약정 및 할부 정보, 요금정보, 금액종합안내 */}
                    <Grid item xs={12} md={6}>
                        {/* 매장 정보 표시 (고객모드/직영점모드 공통) */}
                        {(mode === 'customer' ? selectedStore : loggedInStore) && (
                            <Paper sx={{ p: { xs: 1, sm: 1.5 }, mb: { xs: 1, sm: 1.5 }, borderTop: `3px solid ${theme.primary}`, bgcolor: theme.bg }}>
                                <Typography variant="h6" gutterBottom sx={{
                                    fontWeight: 'bold',
                                    color: theme.primary,
                                    fontSize: { xs: '1rem', sm: '1.25rem', md: '1.5rem' }
                                }}>
                                    매장 정보
                                </Typography>
                                <Grid container spacing={{ xs: 1, sm: 2 }}>
                                    {/* 왼쪽 컬럼: 기본 정보 */}
                                    <Grid item xs={12} md={6}>
                                        <Stack spacing={0.5}>
                                            <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, lineHeight: 1.5 }}>
                                                <strong>업체명:</strong> {(mode === 'customer' ? selectedStore : loggedInStore)?.name || ''}
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, lineHeight: 1.5 }}>
                                                <strong>연락처:</strong> {(mode === 'customer' ? selectedStore : loggedInStore)?.phone || (mode === 'customer' ? selectedStore : loggedInStore)?.storePhone || ''}
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, lineHeight: 1.5 }}>
                                                <strong>주소:</strong> {(mode === 'customer' ? selectedStore : loggedInStore)?.address || ''}
                                            </Typography>
                                            {(mode === 'customer' ? selectedStore : loggedInStore)?.accountInfo && (
                                                <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, lineHeight: 1.5 }}>
                                                    <strong>계좌정보:</strong> {(mode === 'customer' ? selectedStore : loggedInStore)?.accountInfo}
                                                </Typography>
                                            )}
                                        </Stack>
                                    </Grid>
                                    {/* 오른쪽 컬럼: 사전승낙서 마크 */}
                                    <Grid item xs={12} md={6}>
                                        {preApprovalMark ? (
                                            <Box sx={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'flex-end',
                                                justifyContent: 'flex-start',
                                                textAlign: 'right',
                                                '@media print': {
                                                    display: 'block',
                                                    pageBreakInside: 'avoid'
                                                }
                                            }}>
                                                <Typography variant="body2" sx={{
                                                    mb: 0.5,
                                                    fontWeight: 'bold',
                                                    '@media print': {
                                                        fontSize: '0.875rem',
                                                        mb: 0.25
                                                    }
                                                }}>
                                                    사전승낙서 마크:
                                                </Typography>
                                                <Box
                                                    dangerouslySetInnerHTML={{ __html: preApprovalMark }}
                                                    sx={{
                                                        display: 'flex',
                                                        justifyContent: 'flex-end',
                                                        '@media print': {
                                                            '& img': {
                                                                maxWidth: '100%',
                                                                height: 'auto',
                                                                pageBreakInside: 'avoid'
                                                            }
                                                        }
                                                    }}
                                                />
                                            </Box>
                                        ) : (
                                            <Box sx={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'flex-end',
                                                justifyContent: 'flex-start',
                                                textAlign: 'right'
                                            }}>
                                                <Typography variant="body2" sx={{
                                                    color: 'text.secondary',
                                                    fontStyle: 'italic'
                                                }}>
                                                    사전승낙서 마크 없음
                                                </Typography>
                                            </Box>
                                        )}
                                    </Grid>
                                </Grid>
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
                        <Paper className="plan-info-section" sx={{ p: { xs: 1, sm: 1.5, md: 2 }, mb: { xs: 1, sm: 1.5 }, borderTop: `3px solid ${theme.primary}` }}>
                            <Typography variant="h6" gutterBottom sx={{
                                fontWeight: 'bold',
                                fontSize: { xs: '1rem', sm: '1.25rem', md: '1.5rem' }
                            }}>요금정보</Typography>
                            <Grid container spacing={{ xs: 1, sm: 1.5 }}>
                                <Grid item xs={12}>
                                    <Autocomplete
                                        options={planGroups}
                                        getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                                        value={planGroups.find(p => p.name === formData.plan) || null}
                                        loading={loadingPlanGroups}
                                        disabled={loadingPlanGroups}
                                        onChange={async (event, newValue) => {
                                            if (newValue) {
                                                setFormData({ ...formData, plan: newValue.name });
                                                setSelectedPlanGroup(newValue.name);
                                                setPlanBasicFee(newValue.basicFee || 0);
                                                // 🔥 수정: LG 통신사이고 85군 이상 요금제면 lgPremier 자동 체크, 미만이면 해제
                                                if (selectedCarrier === 'LG' && newValue.group) {
                                                    const groupNumber = parseInt(newValue.group.replace('군', '')) || 0;
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        lgPremier: groupNumber >= 85
                                                    }));
                                                }

                                                // 요금제군 추출하여 대리점추가지원금 자동 계산
                                                const planGroup = newValue.group || newValue.name;
                                                if (planGroup && (initialData?.id || initialData?.model)) {
                                                    setLoadingSupportAmounts(true);
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
                                                                    storeSupportWithAddon: pricing.storeSupportWithAddon
                                                                }, 'debug-session', 'run1', 'C');
                                                                setPublicSupport(pricing.publicSupport || 0);
                                                                setStoreSupportWithAddon(pricing.storeSupportWithAddon || 0);
                                                                // 🔥 수정: 부가미유치 기준 제거 (setStoreSupportWithoutAddon 호출 제거)
                                                            }
                                                        }
                                                    } catch (err) {
                                                        console.error('대리점추가지원금 계산 실패:', err);
                                                    } finally {
                                                        setLoadingSupportAmounts(false);
                                                    }
                                                }
                                            } else {
                                                setFormData({ ...formData, plan: '' });
                                                setSelectedPlanGroup('');
                                                setPlanBasicFee(0);
                                                // 초기값으로 복원 - 🔥 수정: 한글 필드명도 확인
                                                setPublicSupport(initialData?.publicSupport || initialData?.이통사지원금 || initialData?.support || 0);
                                                setStoreSupportWithAddon(initialData?.storeSupport || initialData?.storeSupportWithAddon || initialData?.대리점추가지원금 || 0);
                                                // 🔥 수정: 부가미유치 기준 제거 (setStoreSupportWithoutAddon 호출 제거)
                                            }
                                        }}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="요금제 선택"
                                                placeholder={loadingPlanGroups ? "요금제 목록을 불러오는 중..." : "요금제명을 입력하세요"}
                                                InputProps={{
                                                    ...params.InputProps,
                                                    endAdornment: (
                                                        <>
                                                            {loadingPlanGroups ? <CircularProgress color="inherit" size={20} /> : null}
                                                            {params.InputProps.endAdornment}
                                                        </>
                                                    ),
                                                }}
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
                                                value={loadingPlanGroups ? '로딩 중...' : (() => {
                                                    const selectedPlan = planGroups.find(p => p.name === formData.plan);
                                                    return selectedPlan?.group || 'N/A';
                                                })()}
                                                InputProps={{
                                                    readOnly: true,
                                                    endAdornment: loadingPlanGroups ? <CircularProgress size={20} /> : null
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6} sx={{ '@media print': { flexBasis: '50%', maxWidth: '50%' } }}>
                                            <TextField
                                                label="기본료"
                                                fullWidth
                                                value={loadingPlanGroups ? '로딩 중...' : planBasicFee.toLocaleString()}
                                                InputProps={{
                                                    readOnly: true,
                                                    endAdornment: loadingPlanGroups ? <CircularProgress size={20} /> : null
                                                }}
                                            />
                                        </Grid>
                                        {formData.contractType === 'selected' && (
                                            <Grid item xs={12}>
                                                <Alert severity="info">
                                                    선택약정 할인: -{Math.floor(planBasicFee * 0.25).toLocaleString()}원
                                                </Alert>
                                            </Grid>
                                        )}
                                        {/* 🔥 수정: 85군 이상 모든 요금제군에 LG 프리미어 약정 체크박스 표시 */}
                                        {selectedCarrier === 'LG' && (() => {
                                            // 🔥 수정: selectedPlanGroup이 "요금제명(115군)" 형식이므로 괄호 안의 숫자를 추출
                                            // 예: "요금제명(115군)" → 115, "115군" → 115
                                            let groupNumber = 0;
                                            if (selectedPlanGroup) {
                                                // 괄호 안의 숫자 추출 (예: "요금제명(115군)" → "115군")
                                                const match = selectedPlanGroup.match(/\((\d+)군\)/);
                                                if (match) {
                                                    groupNumber = parseInt(match[1]);
                                                } else {
                                                    // 괄호가 없으면 직접 파싱 (예: "115군")
                                                    groupNumber = parseInt(selectedPlanGroup.replace('군', '')) || 0;
                                                }
                                            }
                                            return groupNumber >= 85;
                                        })() && (
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
                                        {/* 부가서비스 및 보험 적용시 금액 변경 */}
                                        <Grid item xs={12}>
                                            <Divider sx={{ my: 1 }} />
                                            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                                                부가서비스 및 보험 적용시 금액 변경
                                            </Typography>

                                            {loadingAddonsAndInsurances ? (
                                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 3 }}>
                                                    <CircularProgress size={24} />
                                                    <Typography variant="body2" sx={{ ml: 2, color: 'text.secondary' }}>
                                                        부가서비스 및 보험상품 목록을 불러오는 중...
                                                    </Typography>
                                                </Box>
                                            ) : (
                                                <>
                                                    {/* 선택 가능한 항목 목록 (부가서비스 + 보험상품) */}
                                                    <Box sx={{ mb: 2 }}>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                                                                선택 가능한 항목
                                                            </Typography>
                                                            <Button
                                                                size="small"
                                                                startIcon={<RefreshIcon />}
                                                                onClick={() => loadAvailableItems(true)}
                                                                disabled={loadingAddonsAndInsurances}
                                                                sx={{ minWidth: 'auto', px: 1 }}
                                                            >
                                                                새로고침
                                                            </Button>
                                                        </Box>
                                                        {loadingAddonsAndInsurances ? (
                                                            <Box sx={{ py: 2, textAlign: 'center' }}>
                                                                <CircularProgress size={24} />
                                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                                                    부가서비스 및 보험상품을 불러오는 중...
                                                                </Typography>
                                                            </Box>
                                                        ) : [...availableAddons, ...availableInsurances].length === 0 ? (
                                                            <Box sx={{ py: 2, textAlign: 'center' }}>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    선택 가능한 항목이 없습니다.
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                                                    정책 설정에서 부가서비스 및 보험상품을 등록해주세요.
                                                                </Typography>
                                                            </Box>
                                                        ) : (
                                                            <Stack spacing={1}>
                                                                {[...availableAddons, ...availableInsurances]
                                                                    .filter(item => !selectedItems.some(selected => selected.name === item.name))
                                                                    .map((item) => (
                                                                        <Paper key={item.name} variant="outlined" sx={{ p: 1.5 }}>
                                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                <Box sx={{ flex: 1 }}>
                                                                                    <Typography variant="body2" fontWeight="bold">
                                                                                        {item.name}
                                                                                    </Typography>
                                                                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                                                                        월 요금: {item.monthlyFee.toLocaleString()}원
                                                                                        {item.incentive > 0 && ` | 유치시 +${item.incentive.toLocaleString()}원`}
                                                                                        {item.deduction > 0 && ` | 미유치시 -${item.deduction.toLocaleString()}원`}
                                                                                    </Typography>
                                                                                    {item.description && (
                                                                                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, fontSize: '0.75rem' }}>
                                                                                            {item.description}
                                                                                        </Typography>
                                                                                    )}
                                                                                </Box>
                                                                                <IconButton
                                                                                    color="primary"
                                                                                    onClick={() => {
                                                                                        setSelectedItems(prev => [...prev, item]);
                                                                                    }}
                                                                                    sx={{ ml: 1 }}
                                                                                >
                                                                                    <AddIcon />
                                                                                </IconButton>
                                                                            </Box>
                                                                        </Paper>
                                                                    ))}
                                                            </Stack>
                                                        )}
                                                    </Box>

                                                    {/* 선택된 항목 목록 */}
                                                    {selectedItems.length > 0 && (
                                                        <Box>
                                                            <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold', color: 'primary.main' }}>
                                                                선택된 항목
                                                            </Typography>
                                                            <Stack spacing={1}>
                                                                {selectedItems.map((item) => (
                                                                    <Paper key={item.name} variant="outlined" sx={{ p: 1.5, bgcolor: 'action.selected' }}>
                                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                            <Box sx={{ flex: 1 }}>
                                                                                <Typography variant="body2" fontWeight="bold">
                                                                                    {item.name}
                                                                                </Typography>
                                                                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                                                                    월 요금: {item.monthlyFee.toLocaleString()}원
                                                                                    {item.incentive > 0 && ` | 유치시 +${item.incentive.toLocaleString()}원`}
                                                                                    {item.deduction > 0 && ` | 미유치시 -${item.deduction.toLocaleString()}원`}
                                                                                </Typography>
                                                                            </Box>
                                                                            <IconButton
                                                                                color="error"
                                                                                onClick={() => {
                                                                                    setSelectedItems(prev => prev.filter(selected => selected.name !== item.name));
                                                                                }}
                                                                                sx={{ ml: 1 }}
                                                                            >
                                                                                <RemoveIcon />
                                                                            </IconButton>
                                                                        </Box>
                                                                    </Paper>
                                                                ))}
                                                            </Stack>
                                                        </Box>
                                                    )}
                                                </>
                                            )}
                                        </Grid>
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
                                    <Typography variant="body2">
                                        {loadingSupportAmounts ? (
                                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                                <CircularProgress size={14} />
                                                <span>로딩 중...</span>
                                            </Box>
                                        ) : (
                                            `-${publicSupport.toLocaleString()}원`
                                        )}
                                    </Typography>
                                </Stack>
                            )}
                            <Stack direction="row" justifyContent="space-between" mb={1}>
                                <Typography variant="body2">
                                    대리점추가지원금
                                </Typography>
                                <Typography variant="body2">
                                    {loadingSupportAmounts ? (
                                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                            <CircularProgress size={14} />
                                            <span>로딩 중...</span>
                                        </Box>
                                    ) : (
                                        // 🔥 수정: 일반약정일 때 차액만큼만 표시 (표시 전용)
                                        `-${calculateDisplayAgentSupportPrice.toLocaleString()}원`
                                    )}
                                </Typography>
                            </Stack>
                            {formData.paymentType === 'installment' && (
                                <Stack direction="row" justifyContent="space-between" mb={2}>
                                    <Typography variant="body2" fontWeight="bold">할부원금</Typography>
                                    <Typography variant="body2" fontWeight="bold" sx={{ color: '#ffd700' }}>
                                        {loadingSupportAmounts ? (
                                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                                <CircularProgress size={14} />
                                                <span>로딩 중...</span>
                                            </Box>
                                        ) : (
                                            `${getCurrentInstallmentPrincipal().toLocaleString()}원`
                                        )}
                                    </Typography>
                                </Stack>
                            )}
                            {formData.paymentType === 'cash' && (
                                <Stack direction="row" justifyContent="space-between" mb={2}>
                                    <Typography variant="body2" fontWeight="bold">현금가</Typography>
                                    <Typography variant="body2" fontWeight="bold" sx={{ color: '#ffd700' }}>
                                        {loadingSupportAmounts ? (
                                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                                <CircularProgress size={14} />
                                                <span>로딩 중...</span>
                                            </Box>
                                        ) : (
                                            `${getCashPrice().toLocaleString()}원`
                                        )}
                                    </Typography>
                                </Stack>
                            )}

                            <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', my: 2 }} />

                            {/* 요금 금액 */}
                            <Typography variant="subtitle2" sx={{ mb: 1, color: '#ffd700' }}>요금 금액</Typography>
                            <Stack direction="row" justifyContent="space-between" mb={1}>
                                <Typography variant="body2">기본료</Typography>
                                <Typography variant="body2">
                                    {loadingPlanGroups ? (
                                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                            <CircularProgress size={14} />
                                            <span>로딩 중...</span>
                                        </Box>
                                    ) : (
                                        `${planBasicFee.toLocaleString()}원`
                                    )}
                                </Typography>
                            </Stack>
                            {formData.contractType === 'selected' && (
                                <Stack direction="row" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2">선택약정 할인</Typography>
                                    <Typography variant="body2" color="error">
                                        -{Math.floor(planBasicFee * 0.25).toLocaleString()}원
                                    </Typography>
                                </Stack>
                            )}
                            {selectedCarrier === 'LG' && formData.lgPremier && (() => {
                                // 🔥 수정: 요금제군 기준으로 판단 (planBasicFee >= 85000 조건 제거)
                                // 요금제군이 85군 이상이면 표시 (체크박스 표시 조건과 동일)
                                // 🔥 수정: selectedPlanGroup이 "요금제명(115군)" 형식이므로 괄호 안의 숫자를 추출
                                let groupNumber = 0;
                                if (selectedPlanGroup) {
                                    // 괄호 안의 숫자 추출 (예: "요금제명(115군)" → "115군")
                                    const match = selectedPlanGroup.match(/\((\d+)군\)/);
                                    if (match) {
                                        groupNumber = parseInt(match[1]);
                                    } else {
                                        // 괄호가 없으면 직접 파싱 (예: "115군")
                                        groupNumber = parseInt(selectedPlanGroup.replace('군', '')) || 0;
                                    }
                                }
                                return groupNumber >= 85;
                            })() && (
                                    <Stack direction="row" justifyContent="space-between" mb={1}>
                                        <Typography variant="body2">LG 프리미어 할인</Typography>
                                        <Typography variant="body2" color="error">-5,250원</Typography>
                                    </Stack>
                                )}
                            {selectedItems.length > 0 && (
                                <Stack direction="row" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2">부가서비스 및 보험</Typography>
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
                            {selectedItems.length > 0 && (
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
                                    <Divider sx={{ my: 1 }} />
                                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
                                        적용일시
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <TextField
                                        label="날짜"
                                        fullWidth
                                        type="date"
                                        value={appliedDateTime.date}
                                        onChange={(e) => setAppliedDateTime({ ...appliedDateTime, date: e.target.value })}
                                        InputLabelProps={{
                                            shrink: true,
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <FormControl fullWidth>
                                        <InputLabel>시</InputLabel>
                                        <Select
                                            value={appliedDateTime.hour}
                                            label="시"
                                            onChange={(e) => setAppliedDateTime({ ...appliedDateTime, hour: e.target.value })}
                                        >
                                            {Array.from({ length: 24 }, (_, i) => (
                                                <MenuItem key={i} value={i.toString().padStart(2, '0')}>
                                                    {i.toString().padStart(2, '0')}시
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <FormControl fullWidth>
                                        <InputLabel>분</InputLabel>
                                        <Select
                                            value={appliedDateTime.minute}
                                            label="분"
                                            onChange={(e) => setAppliedDateTime({ ...appliedDateTime, minute: e.target.value })}
                                        >
                                            {Array.from({ length: 60 }, (_, i) => (
                                                <MenuItem key={i} value={i.toString().padStart(2, '0')}>
                                                    {i.toString().padStart(2, '0')}분
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12}>
                                    <Alert severity="info" sx={{ mt: 1, mb: 1 }}>
                                        <Typography variant="body2">
                                            유심값 7,700원은 첫달 한달만 추가되어 청구됩니다
                                        </Typography>
                                    </Alert>
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
                                        value={loadingSupportAmounts ? '로딩 중...' : (formData.usePublicSupport ? publicSupport.toLocaleString() : '0')}
                                        InputProps={{
                                            readOnly: true,
                                            endAdornment: loadingSupportAmounts ? <CircularProgress size={20} /> : null
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        label="대리점추가지원금"
                                        fullWidth
                                        // 🔥 수정: 일반약정일 때 차액만큼만 표시 (표시 전용)
                                        value={loadingSupportAmounts ? '로딩 중...' : calculateDisplayAgentSupportPrice.toLocaleString()}
                                        InputProps={{
                                            readOnly: true,
                                            endAdornment: loadingSupportAmounts ? <CircularProgress size={20} /> : null
                                        }}
                                        helperText={loadingSupportAmounts ? "지원금 정보를 불러오는 중..." : `선택된 부가서비스: ${selectedItems.length}개${additionalStoreSupport !== null && additionalStoreSupport !== undefined && additionalStoreSupport !== 0 ? `, 직접입력: ${additionalStoreSupport > 0 ? '+' : ''}${additionalStoreSupport.toLocaleString()}원` : ''}`}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        label="대리점추가지원금 직접입력"
                                        fullWidth
                                        type="number"
                                        disabled={mode === 'customer'}
                                        value={additionalStoreSupport !== null && additionalStoreSupport !== undefined ? additionalStoreSupport : ''}
                                        onChange={(e) => {
                                            const inputValue = e.target.value;
                                            // 빈 문자열이면 null로 설정
                                            if (inputValue === '') {
                                                setAdditionalStoreSupport(null);
                                                return;
                                            }
                                            // '-'만 입력된 경우는 허용 (음수 입력 중)
                                            if (inputValue === '-') {
                                                setAdditionalStoreSupport(null);
                                                return;
                                            }
                                            const value = parseFloat(inputValue);
                                            // NaN이 아니면 (양수, 음수 모두 허용)
                                            if (!isNaN(value)) {
                                                setAdditionalStoreSupport(value);
                                            }
                                        }}
                                        InputProps={{
                                            endAdornment: <Typography variant="body2" sx={{ mr: 1 }}>원</Typography>
                                        }}
                                        helperText={mode === 'customer' ? '고객모드에서는 입력할 수 없습니다' : '추가 금액을 입력하면 대리점추가지원금과 할부원금에 자동 반영됩니다 (음수 입력 가능)'}
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        label="할부원금"
                                        fullWidth
                                        value={loadingSupportAmounts ? '로딩 중...' : getCurrentInstallmentPrincipal().toLocaleString()}
                                        InputProps={{
                                            readOnly: true,
                                            endAdornment: loadingSupportAmounts ? <CircularProgress size={20} /> : null
                                        }}
                                        sx={{ input: { fontWeight: 'bold', color: theme.primary } }}
                                        helperText={loadingSupportAmounts ? "계산 중..." : `부가서비스 선택 여부에 따라 자동 계산`}
                                    />
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
                                            <Grid item xs={12} className="calculation-details">
                                                <Paper sx={{ p: 2, mt: 1, bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider' }}>
                                                    <Typography variant="caption" component="pre" sx={{
                                                        whiteSpace: 'pre-wrap',
                                                        fontFamily: 'monospace',
                                                        fontSize: '0.85rem',
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
