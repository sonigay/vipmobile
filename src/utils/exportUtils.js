import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { saveAs } from 'file-saver';

// Excel 내보내기 함수들
export const exportToExcel = {
  // 영업사원별 배정 결과 내보내기
  salesAgentAssignment: (agents, assignments, settings) => {
    const workbook = XLSX.utils.book_new();
    
    // 영업사원별 배정 시트
    const agentData = agents.map(agent => {
      const assignment = assignments[agent.contactId];
      return {
        '영업사원명': agent.target,
        '사무실': agent.office || '미지정',
        '소속': agent.department || '미지정',
        '자격': agent.qualification || '미지정',
        '배정 수량': assignment ? assignment.quantity || 0 : 0,
        '배정 점수': assignment ? Math.round(assignment.score || 0) : 0,
        '배정 비율(%)': assignment ? Math.round((assignment.ratio || 0) * 100) : 0,
        '배정 모델': assignment && assignment.colors ? assignment.colors.join(', ') : '없음'
      };
    });
    
    const agentSheet = XLSX.utils.json_to_sheet(agentData);
    XLSX.utils.book_append_sheet(workbook, agentSheet, '영업사원별 배정');
    
    // 모델별 배정 요약 시트
    const modelData = Object.entries(settings.models || {}).map(([modelName, modelData]) => ({
      '모델명': modelName,
      '전체 수량': modelData.quantity,
      '배정 수량': Object.values(assignments).reduce((sum, assignment) => {
        return sum + (assignment.quantity || 0);
      }, 0),
      '색상': modelData.colors.join(', ')
    }));
    
    const modelSheet = XLSX.utils.json_to_sheet(modelData);
    XLSX.utils.book_append_sheet(workbook, modelSheet, '모델별 배정 요약');
    
    // 설정 정보 시트
    const settingsData = [
      { '항목': '회전율 비율', '값': `${settings.ratios.turnoverRate}%` },
      { '항목': '거래처수 비율', '값': `${settings.ratios.storeCount}%` },
      { '항목': '보유재고 비율', '값': `${settings.ratios.remainingInventory}%` },
      { '항목': '판매량 비율', '값': `${settings.ratios.salesVolume}%` }
    ];
    
    const settingsSheet = XLSX.utils.json_to_sheet(settingsData);
    XLSX.utils.book_append_sheet(workbook, settingsSheet, '배정 설정');
    
    // 파일 저장
    const fileName = `영업사원배정_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  },

  // 사무실별 배정 결과 내보내기
  officeAssignment: (officeStats, settings) => {
    const workbook = XLSX.utils.book_new();
    
    // 사무실별 요약 시트
    const officeData = Object.values(officeStats).map(office => ({
      '사무실': office.office,
      '영업사원 수': office.agentCount,
      '총 배정량': office.totalAssignment,
      '평균 배정량': office.agentCount > 0 ? Math.round(office.totalAssignment / office.agentCount) : 0
    }));
    
    const officeSheet = XLSX.utils.json_to_sheet(officeData);
    XLSX.utils.book_append_sheet(workbook, officeSheet, '사무실별 요약');
    
    // 사무실별 모델 상세 시트
    const modelData = [];
    Object.values(officeStats).forEach(office => {
      Object.values(office.models).forEach(model => {
        modelData.push({
          '사무실': office.office,
          '모델명': model.name,
          '전체 수량': model.totalQuantity,
          '배정 수량': model.assignedQuantity,
          '배정률(%)': model.totalQuantity > 0 ? Math.round((model.assignedQuantity / model.totalQuantity) * 100) : 0,
          '색상': model.colors.join(', ')
        });
      });
    });
    
    const modelSheet = XLSX.utils.json_to_sheet(modelData);
    XLSX.utils.book_append_sheet(workbook, modelSheet, '모델별 상세');
    
    // 파일 저장
    const fileName = `사무실배정_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  },

  // 소속별 배정 결과 내보내기
  departmentAssignment: (departmentStats, settings) => {
    const workbook = XLSX.utils.book_new();
    
    // 소속별 요약 시트
    const deptData = Object.values(departmentStats).map(dept => ({
      '소속': dept.department,
      '담당자 수': dept.agentCount,
      '총 배정량': dept.totalAssignment,
      '평균 배정량': dept.agentCount > 0 ? Math.round(dept.totalAssignment / dept.agentCount) : 0
    }));
    
    const deptSheet = XLSX.utils.json_to_sheet(deptData);
    XLSX.utils.book_append_sheet(workbook, deptSheet, '소속별 요약');
    
    // 소속별 모델 상세 시트
    const modelData = [];
    Object.values(departmentStats).forEach(dept => {
      Object.values(dept.models).forEach(model => {
        modelData.push({
          '소속': dept.department,
          '모델명': model.name,
          '전체 수량': model.totalQuantity,
          '배정 수량': model.assignedQuantity,
          '배정률(%)': model.totalQuantity > 0 ? Math.round((model.assignedQuantity / model.totalQuantity) * 100) : 0,
          '색상': model.colors.join(', ')
        });
      });
    });
    
    const modelSheet = XLSX.utils.json_to_sheet(modelData);
    XLSX.utils.book_append_sheet(workbook, modelSheet, '모델별 상세');
    
    // 파일 저장
    const fileName = `소속배정_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }
};

// PDF 내보내기 함수들
export const exportToPDF = {
  // 영업사원별 배정 결과 내보내기
  salesAgentAssignment: (agents, assignments, settings) => {
    const doc = new jsPDF();
    
    // 제목
    doc.setFontSize(20);
    doc.text('영업사원별 배정 결과', 20, 20);
    
    doc.setFontSize(12);
    doc.text(`생성일: ${new Date().toLocaleDateString('ko-KR')}`, 20, 30);
    
    // 요약 정보
    doc.setFontSize(14);
    doc.text('배정 요약', 20, 45);
    
    doc.setFontSize(10);
    const totalAgents = agents.length;
    const assignedAgents = Object.keys(assignments).length;
    const totalQuantity = Object.values(assignments).reduce((sum, assignment) => sum + (assignment.quantity || 0), 0);
    
    doc.text(`총 영업사원: ${totalAgents}명`, 20, 55);
    doc.text(`배정 대상: ${assignedAgents}명`, 20, 65);
    doc.text(`총 배정량: ${totalQuantity}개`, 20, 75);
    
    // 영업사원별 배정 테이블
    const tableData = agents.map(agent => {
      const assignment = assignments[agent.contactId];
      return [
        agent.target,
        agent.office || '미지정',
        agent.department || '미지정',
        assignment ? assignment.quantity || 0 : 0,
        assignment ? Math.round(assignment.score || 0) : 0,
        assignment ? Math.round((assignment.ratio || 0) * 100) : 0
      ];
    });
    
    doc.autoTable({
      startY: 90,
      head: [['영업사원명', '사무실', '소속', '배정량', '점수', '비율(%)']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [66, 139, 202] }
    });
    
    // 파일 저장
    const fileName = `영업사원배정_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  },

  // 사무실별 배정 결과 내보내기
  officeAssignment: (officeStats, settings) => {
    const doc = new jsPDF();
    
    // 제목
    doc.setFontSize(20);
    doc.text('사무실별 배정 결과', 20, 20);
    
    doc.setFontSize(12);
    doc.text(`생성일: ${new Date().toLocaleDateString('ko-KR')}`, 20, 30);
    
    // 사무실별 요약 테이블
    const summaryData = Object.values(officeStats).map(office => [
      office.office,
      office.agentCount,
      office.totalAssignment,
      office.agentCount > 0 ? Math.round(office.totalAssignment / office.agentCount) : 0
    ]);
    
    doc.autoTable({
      startY: 40,
      head: [['사무실', '영업사원 수', '총 배정량', '평균 배정량']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [66, 139, 202] }
    });
    
    // 모델별 상세 정보 (새 페이지)
    doc.addPage();
    doc.setFontSize(16);
    doc.text('모델별 배정 상세', 20, 20);
    
    const modelData = [];
    Object.values(officeStats).forEach(office => {
      Object.values(office.models).forEach(model => {
        modelData.push([
          office.office,
          model.name,
          model.totalQuantity,
          model.assignedQuantity,
          model.totalQuantity > 0 ? Math.round((model.assignedQuantity / model.totalQuantity) * 100) : 0
        ]);
      });
    });
    
    doc.autoTable({
      startY: 30,
      head: [['사무실', '모델명', '전체 수량', '배정 수량', '배정률(%)']],
      body: modelData,
      theme: 'grid',
      headStyles: { fillColor: [66, 139, 202] }
    });
    
    // 파일 저장
    const fileName = `사무실배정_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  },

  // 소속별 배정 결과 내보내기
  departmentAssignment: (departmentStats, settings) => {
    const doc = new jsPDF();
    
    // 제목
    doc.setFontSize(20);
    doc.text('소속별 배정 결과', 20, 20);
    
    doc.setFontSize(12);
    doc.text(`생성일: ${new Date().toLocaleDateString('ko-KR')}`, 20, 30);
    
    // 소속별 요약 테이블
    const summaryData = Object.values(departmentStats).map(dept => [
      dept.department,
      dept.agentCount,
      dept.totalAssignment,
      dept.agentCount > 0 ? Math.round(dept.totalAssignment / dept.agentCount) : 0
    ]);
    
    doc.autoTable({
      startY: 40,
      head: [['소속', '담당자 수', '총 배정량', '평균 배정량']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [66, 139, 202] }
    });
    
    // 모델별 상세 정보 (새 페이지)
    doc.addPage();
    doc.setFontSize(16);
    doc.text('모델별 배정 상세', 20, 20);
    
    const modelData = [];
    Object.values(departmentStats).forEach(dept => {
      Object.values(dept.models).forEach(model => {
        modelData.push([
          dept.department,
          model.name,
          model.totalQuantity,
          model.assignedQuantity,
          model.totalQuantity > 0 ? Math.round((model.assignedQuantity / model.totalQuantity) * 100) : 0
        ]);
      });
    });
    
    doc.autoTable({
      startY: 30,
      head: [['소속', '모델명', '전체 수량', '배정 수량', '배정률(%)']],
      body: modelData,
      theme: 'grid',
      headStyles: { fillColor: [66, 139, 202] }
    });
    
    // 파일 저장
    const fileName = `소속배정_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }
};

// CSV 내보내기 함수들
export const exportToCSV = {
  // 영업사원별 배정 결과 내보내기
  salesAgentAssignment: (agents, assignments, settings) => {
    const csvData = agents.map(agent => {
      const assignment = assignments[agent.contactId];
      return {
        '영업사원명': agent.target,
        '사무실': agent.office || '미지정',
        '소속': agent.department || '미지정',
        '자격': agent.qualification || '미지정',
        '배정 수량': assignment ? assignment.quantity || 0 : 0,
        '배정 점수': assignment ? Math.round(assignment.score || 0) : 0,
        '배정 비율(%)': assignment ? Math.round((assignment.ratio || 0) * 100) : 0,
        '배정 모델': assignment && assignment.colors ? assignment.colors.join(', ') : '없음'
      };
    });
    
    const csv = XLSX.utils.json_to_csv(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const fileName = `영업사원배정_${new Date().toISOString().split('T')[0]}.csv`;
    saveAs(blob, fileName);
  }
}; 