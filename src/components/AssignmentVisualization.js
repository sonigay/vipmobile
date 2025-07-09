import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Button
} from '@mui/material';
import {
  Print as PrintIcon
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

// 색상 팔레트
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

function AssignmentVisualization({ assignmentData, agents }) {
  if (!assignmentData) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          배정 데이터가 없습니다.
        </Typography>
      </Box>
    );
  }

  // 인쇄 기능
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    
    const currentDate = new Date().toLocaleDateString('ko-KR');
    const currentTime = new Date().toLocaleTimeString('ko-KR');
    
    const printContent = `
      <html>
        <head>
          <title>배정 결과 시각화</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .chart-section { margin: 30px 0; page-break-inside: avoid; }
            .chart-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #333; }
            .summary-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .summary-table th, .summary-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            .summary-table th { background-color: #f2f2f2; font-weight: bold; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>배정 결과 시각화 보고서</h1>
            <p>출력일시: ${currentDate} ${currentTime}</p>
          </div>

          <div class="chart-section">
            <div class="chart-title">📊 모델별 배정 현황</div>
            <table class="summary-table">
              <thead>
                <tr>
                  <th>모델명</th>
                  <th>전체 수량</th>
                  <th>배정 수량</th>
                  <th>미배정 수량</th>
                  <th>배정률</th>
                </tr>
              </thead>
              <tbody>
                ${Object.values(assignmentData.models || {}).map(model => `
                  <tr>
                    <td>${model.name}</td>
                    <td>${model.totalQuantity}개</td>
                    <td>${model.assignedQuantity}개</td>
                    <td>${model.totalQuantity - model.assignedQuantity}개</td>
                    <td>${model.totalQuantity > 0 ? Math.round((model.assignedQuantity / model.totalQuantity) * 100) : 0}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="chart-section">
            <div class="chart-title">🏢 사무실별 배정 현황</div>
            <table class="summary-table">
              <thead>
                <tr>
                  <th>사무실</th>
                  <th>영업사원 수</th>
                  <th>총 배정량</th>
                  <th>평균 배정량</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(assignmentData.offices || {}).map(([officeName, officeData]) => `
                  <tr>
                    <td>${officeName}</td>
                    <td>${officeData.agentCount}명</td>
                    <td><strong>${officeData.totalQuantity}개</strong></td>
                    <td>${officeData.agentCount > 0 ? Math.round(officeData.totalQuantity / officeData.agentCount) : 0}개</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="chart-section">
            <div class="chart-title">👥 소속별 배정 현황</div>
            <table class="summary-table">
              <thead>
                <tr>
                  <th>소속</th>
                  <th>영업사원 수</th>
                  <th>총 배정량</th>
                  <th>평균 배정량</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(assignmentData.departments || {}).map(([departmentName, departmentData]) => `
                  <tr>
                    <td>${departmentName}</td>
                    <td>${departmentData.agentCount}명</td>
                    <td><strong>${departmentData.totalQuantity}개</strong></td>
                    <td>${departmentData.agentCount > 0 ? Math.round(departmentData.totalQuantity / departmentData.agentCount) : 0}개</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="chart-section">
            <div class="chart-title">👤 영업사원별 배정 현황 (상위 10명)</div>
            <table class="summary-table">
              <thead>
                <tr>
                  <th>영업사원</th>
                  <th>사무실</th>
                  <th>총 배정량</th>
                                          <th>배정 점수</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(assignmentData.agents || {})
                  .map(([agentId, agentAssignments]) => {
                    const agent = agents.find(a => a.contactId === agentId);
                    const totalQuantity = Object.values(agentAssignments).reduce((sum, val) => sum + (val.quantity || 0), 0);
                    const avgScore = Object.values(agentAssignments).reduce((sum, val) => sum + (val.score || 0), 0) / Object.keys(agentAssignments).length;
                    
                    return {
                      name: agent?.target || agentId,
                      office: agent?.office || '미지정',
                      quantity: totalQuantity,
                      score: Math.round(avgScore)
                    };
                  })
                  .sort((a, b) => b.quantity - a.quantity)
                  .slice(0, 10)
                  .map(agent => `
                    <tr>
                      <td>${agent.name}</td>
                      <td>${agent.office}</td>
                      <td><strong>${agent.quantity}개</strong></td>
                      <td>${agent.score}점</td>
                    </tr>
                  `).join('')}
              </tbody>
            </table>
          </div>

          <div class="footer">
            <p>※ 이 문서는 시스템에서 자동 생성되었습니다.</p>
            <p>※ 배정 결과는 각 영업사원의 성과 지표를 종합적으로 고려하여 계산됩니다.</p>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // 모델별 배정 현황 데이터
  const modelData = Object.values(assignmentData.models || {}).map(model => ({
    name: model.name,
    total: model.totalQuantity,
    assigned: model.assignedQuantity,
    remaining: model.totalQuantity - model.assignedQuantity
  }));

  // 사무실별 배정 현황 데이터
  const officeData = Object.values(assignmentData.offices || {}).map(office => ({
    name: office.office,
    agents: office.agentCount,
    quantity: office.totalQuantity
  }));

  // 소속별 배정 현황 데이터
  const departmentData = Object.values(assignmentData.departments || {}).map(dept => ({
    name: dept.department,
    agents: dept.agentCount,
    quantity: dept.totalQuantity
  }));

  // 영업사원별 배정 현황 데이터 (상위 10명)
  const agentData = Object.entries(assignmentData.agents || {})
    .map(([agentId, agentAssignments]) => {
      const agent = agents.find(a => a.contactId === agentId);
      const totalQuantity = Object.values(agentAssignments).reduce((sum, val) => sum + (val.quantity || 0), 0);
      const avgScore = Object.values(agentAssignments).reduce((sum, val) => sum + (val.score || 0), 0) / Object.keys(agentAssignments).length;
      
      return {
        name: agent?.target || agentId,
        quantity: totalQuantity,
        score: Math.round(avgScore),
        office: agent?.office || '미지정'
      };
    })
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  // 배정 비율 파이 차트 데이터
  const assignmentRatioData = [
    { name: '배정됨', value: Object.values(assignmentData.models || {}).reduce((sum, model) => sum + model.assignedQuantity, 0) },
    { name: '미배정', value: Object.values(assignmentData.models || {}).reduce((sum, model) => sum + (model.totalQuantity - model.assignedQuantity), 0) }
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">
          배정 결과 시각화
        </Typography>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
        >
          전체 인쇄
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* 모델별 배정 현황 */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                모델별 배정 현황
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={modelData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="assigned" fill="#8884d8" name="배정량" />
                  <Bar dataKey="remaining" fill="#82ca9d" name="미배정" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* 배정 비율 파이 차트 */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                전체 배정 비율
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={assignmentRatioData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {assignmentRatioData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* 사무실별 배정 현황 */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                사무실별 배정 현황
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={officeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="quantity" fill="#8884d8" name="배정량" />
                  <Bar yAxisId="right" dataKey="agents" fill="#82ca9d" name="영업사원수" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* 소속별 배정 현황 */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                소속별 배정 현황
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={departmentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="quantity" fill="#8884d8" name="배정량" />
                  <Bar yAxisId="right" dataKey="agents" fill="#82ca9d" name="영업사원수" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* 영업사원별 배정 현황 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                영업사원별 배정 현황 (상위 10명)
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={agentData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="quantity" fill="#8884d8" name="배정량" />
                  <Bar dataKey="score" fill="#82ca9d" name="배정점수" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* 배정 통계 요약 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                배정 통계 요약
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {Object.keys(assignmentData.agents || {}).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      배정된 영업사원
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="secondary">
                      {Object.keys(assignmentData.models || {}).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      배정 모델 수
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main">
                      {Object.values(assignmentData.models || {}).reduce((sum, model) => sum + model.assignedQuantity, 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      총 배정량
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="warning.main">
                      {Object.keys(assignmentData.offices || {}).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      참여 사무실
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default AssignmentVisualization; 