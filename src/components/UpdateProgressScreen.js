import React, { useState, useEffect } from 'react';
import './UpdateProgressScreen.css';

const UpdateProgressScreen = ({ onUpdateComplete }) => {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const steps = [
    { name: '업데이트 확인 중...', duration: 1000 },
    { name: '캐시 정리 중...', duration: 1500 },
    { name: '새로운 파일 다운로드 중...', duration: 2000 },
    { name: '업데이트 적용 중...', duration: 1500 },
    { name: '업데이트 완료!', duration: 1000 }
  ];

  useEffect(() => {
    let currentProgress = 0;
    const totalSteps = steps.length;
    const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0);

    const updateProgress = () => {
      if (currentStep < totalSteps) {
        const step = steps[currentStep];
        
        // 현재 단계 진행률 계산
        const stepProgress = (Date.now() - stepStartTime) / step.duration;
        const currentStepProgress = Math.min(stepProgress, 1);
        
        // 전체 진행률 계산
        const completedStepsProgress = (currentStep / totalSteps) * 100;
        const currentStepContribution = (1 / totalSteps) * 100 * currentStepProgress;
        const totalProgress = completedStepsProgress + currentStepContribution;
        
        setProgress(Math.min(totalProgress, 100));

        if (currentStepProgress >= 1) {
          setCurrentStep(prev => prev + 1);
          stepStartTime = Date.now();
        }
      } else {
        // 모든 단계 완료
        setProgress(100);
        setIsComplete(true);
        
        // 완료 후 잠시 대기 후 콜백 호출
        setTimeout(() => {
          onUpdateComplete();
        }, 1500);
      }
    };

    let stepStartTime = Date.now();
    const interval = setInterval(updateProgress, 50);

    return () => clearInterval(interval);
  }, [currentStep, onUpdateComplete]);

  return (
    <div className="update-progress-screen">
      <div className="update-progress-container">
        <div className="update-logo">
          <img src="/logo192.png" alt="로고" />
        </div>
        
        <h2 className="update-title">업데이트 진행 중</h2>
        
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="progress-text">{Math.round(progress)}%</div>
        </div>
        
        <div className="current-step">
          {currentStep < steps.length ? steps[currentStep].name : '완료!'}
        </div>
        
        {isComplete && (
          <div className="completion-message">
            <div className="checkmark">✓</div>
            <p>업데이트가 성공적으로 완료되었습니다!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdateProgressScreen; 