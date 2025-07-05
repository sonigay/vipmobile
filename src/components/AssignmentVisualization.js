import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper
} from '@mui/material';
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
      <Typography variant="h5" gutterBottom>
        배정 결과 시각화
      </Typography>

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