// 배정 이력 비교 및 분석 유틸리티

// 비교 타입 정의
export const COMPARISON_TYPES = {
  AGENT: 'agent',
  OFFICE: 'office',
  DEPARTMENT: 'department',
  MODEL: 'model',
  OVERALL: 'overall'
};

// 분석 메트릭 정의
export const ANALYSIS_METRICS = {
  QUANTITY_CHANGE: 'quantity_change',
  AGENT_CHANGE: 'agent_change',
  MODEL_DISTRIBUTION: 'model_distribution',
  EFFICIENCY: 'efficiency',
  TREND: 'trend'
};

// 배정 이력 비교 클래스
class AssignmentComparisonManager {
  constructor() {
    this.comparisonCache = new Map();
  }

  // 두 배정 이력 비교
  compareAssignments(history1, history2, comparisonType = COMPARISON_TYPES.OVERALL) {
    const cacheKey = `${history1.id}_${history2.id}_${comparisonType}`;
    
    if (this.comparisonCache.has(cacheKey)) {
      return this.comparisonCache.get(cacheKey);
    }

    const comparison = {
      history1: history1,
      history2: history2,
      comparisonType,
      timestamp: new Date().toISOString(),
      summary: this.generateComparisonSummary(history1, history2, comparisonType),
      details: this.generateComparisonDetails(history1, history2, comparisonType),
      metrics: this.calculateComparisonMetrics(history1, history2, comparisonType),
      insights: this.generateInsights(history1, history2, comparisonType)
    };

    this.comparisonCache.set(cacheKey, comparison);
    return comparison;
  }

  // 비교 요약 생성
  generateComparisonSummary(history1, history2, comparisonType) {
    const totalQuantity1 = this.calculateTotalQuantity(history1);
    const totalQuantity2 = this.calculateTotalQuantity(history2);
    const quantityChange = totalQuantity2 - totalQuantity1;
    const quantityChangePercent = totalQuantity1 > 0 ? (quantityChange / totalQuantity1) * 100 : 0;

    const totalAgents1 = this.calculateTotalAgents(history1);
    const totalAgents2 = this.calculateTotalAgents(history2);
    const agentChange = totalAgents2 - totalAgents1;

    const totalModels1 = this.calculateTotalModels(history1);
    const totalModels2 = this.calculateTotalModels(history2);
    const modelChange = totalModels2 - totalModels1;

    return {
      totalQuantity: {
        history1: totalQuantity1,
        history2: totalQuantity2,
        change: quantityChange,
        changePercent: quantityChangePercent
      },
      totalAgents: {
        history1: totalAgents1,
        history2: totalAgents2,
        change: agentChange
      },
      totalModels: {
        history1: totalModels1,
        history2: totalModels2,
        change: modelChange
      },
      dateRange: {
        history1: {
          start: history1.metadata.createdAt,
          end: history1.metadata.updatedAt || history1.metadata.createdAt
        },
        history2: {
          start: history2.metadata.createdAt,
          end: history2.metadata.updatedAt || history2.metadata.createdAt
        }
      }
    };
  }

  // 비교 상세 정보 생성
  generateComparisonDetails(history1, history2, comparisonType) {
    switch (comparisonType) {
      case COMPARISON_TYPES.AGENT:
        return this.compareByAgent(history1, history2);
      case COMPARISON_TYPES.OFFICE:
        return this.compareByOffice(history1, history2);
      case COMPARISON_TYPES.DEPARTMENT:
        return this.compareByDepartment(history1, history2);
      case COMPARISON_TYPES.MODEL:
        return this.compareByModel(history1, history2);
      case COMPARISON_TYPES.OVERALL:
      default:
        return this.compareOverall(history1, history2);
    }
  }

  // 영업사원별 비교
  compareByAgent(history1, history2) {
    const agents1 = this.extractAgentData(history1);
    const agents2 = this.extractAgentData(history2);
    
    const allAgentIds = new Set([
      ...Object.keys(agents1),
      ...Object.keys(agents2)
    ]);

    const comparison = {
      agents: {},
      summary: {
        added: 0,
        removed: 0,
        changed: 0,
        unchanged: 0
      }
    };

    allAgentIds.forEach(agentId => {
      const agent1 = agents1[agentId];
      const agent2 = agents2[agentId];

      if (!agent1 && agent2) {
        // 새로 추가된 영업사원
        comparison.agents[agentId] = {
          status: 'added',
          data: agent2,
          change: {
            quantity: agent2.quantity,
            models: Object.keys(agent2.models || {}).length
          }
        };
        comparison.summary.added++;
      } else if (agent1 && !agent2) {
        // 제거된 영업사원
        comparison.agents[agentId] = {
          status: 'removed',
          data: agent1,
          change: {
            quantity: -agent1.quantity,
            models: -Object.keys(agent1.models || {}).length
          }
        };
        comparison.summary.removed++;
      } else if (agent1 && agent2) {
        // 변경된 영업사원
        const quantityChange = agent2.quantity - agent1.quantity;
        const modelChange = Object.keys(agent2.models || {}).length - Object.keys(agent1.models || {}).length;
        
        comparison.agents[agentId] = {
          status: quantityChange !== 0 || modelChange !== 0 ? 'changed' : 'unchanged',
          data: {
            before: agent1,
            after: agent2
          },
          change: {
            quantity: quantityChange,
            models: modelChange,
            modelsDetail: this.compareModelAssignments(agent1.models || {}, agent2.models || {})
          }
        };
        
        if (quantityChange !== 0 || modelChange !== 0) {
          comparison.summary.changed++;
        } else {
          comparison.summary.unchanged++;
        }
      }
    });

    return comparison;
  }

  // 사무실별 비교
  compareByOffice(history1, history2) {
    const offices1 = this.groupByOffice(history1);
    const offices2 = this.groupByOffice(history2);
    
    const allOffices = new Set([
      ...Object.keys(offices1),
      ...Object.keys(offices2)
    ]);

    const comparison = {
      offices: {},
      summary: {
        added: 0,
        removed: 0,
        changed: 0,
        unchanged: 0
      }
    };

    allOffices.forEach(office => {
      const office1 = offices1[office];
      const office2 = offices2[office];

      if (!office1 && office2) {
        comparison.offices[office] = {
          status: 'added',
          data: office2,
          change: {
            quantity: office2.totalQuantity,
            agents: office2.agentCount
          }
        };
        comparison.summary.added++;
      } else if (office1 && !office2) {
        comparison.offices[office] = {
          status: 'removed',
          data: office1,
          change: {
            quantity: -office1.totalQuantity,
            agents: -office1.agentCount
          }
        };
        comparison.summary.removed++;
      } else if (office1 && office2) {
        const quantityChange = office2.totalQuantity - office1.totalQuantity;
        const agentChange = office2.agentCount - office1.agentCount;
        
        comparison.offices[office] = {
          status: quantityChange !== 0 || agentChange !== 0 ? 'changed' : 'unchanged',
          data: {
            before: office1,
            after: office2
          },
          change: {
            quantity: quantityChange,
            agents: agentChange
          }
        };
        
        if (quantityChange !== 0 || agentChange !== 0) {
          comparison.summary.changed++;
        } else {
          comparison.summary.unchanged++;
        }
      }
    });

    return comparison;
  }

  // 소속별 비교
  compareByDepartment(history1, history2) {
    const departments1 = this.groupByDepartment(history1);
    const departments2 = this.groupByDepartment(history2);
    
    const allDepartments = new Set([
      ...Object.keys(departments1),
      ...Object.keys(departments2)
    ]);

    const comparison = {
      departments: {},
      summary: {
        added: 0,
        removed: 0,
        changed: 0,
        unchanged: 0
      }
    };

    allDepartments.forEach(department => {
      const dept1 = departments1[department];
      const dept2 = departments2[department];

      if (!dept1 && dept2) {
        comparison.departments[department] = {
          status: 'added',
          data: dept2,
          change: {
            quantity: dept2.totalQuantity,
            agents: dept2.agentCount
          }
        };
        comparison.summary.added++;
      } else if (dept1 && !dept2) {
        comparison.departments[department] = {
          status: 'removed',
          data: dept1,
          change: {
            quantity: -dept1.totalQuantity,
            agents: -dept1.agentCount
          }
        };
        comparison.summary.removed++;
      } else if (dept1 && dept2) {
        const quantityChange = dept2.totalQuantity - dept1.totalQuantity;
        const agentChange = dept2.agentCount - dept1.agentCount;
        
        comparison.departments[department] = {
          status: quantityChange !== 0 || agentChange !== 0 ? 'changed' : 'unchanged',
          data: {
            before: dept1,
            after: dept2
          },
          change: {
            quantity: quantityChange,
            agents: agentChange
          }
        };
        
        if (quantityChange !== 0 || agentChange !== 0) {
          comparison.summary.changed++;
        } else {
          comparison.summary.unchanged++;
        }
      }
    });

    return comparison;
  }

  // 모델별 비교
  compareByModel(history1, history2) {
    const models1 = this.groupByModel(history1);
    const models2 = this.groupByModel(history2);
    
    const allModels = new Set([
      ...Object.keys(models1),
      ...Object.keys(models2)
    ]);

    const comparison = {
      models: {},
      summary: {
        added: 0,
        removed: 0,
        changed: 0,
        unchanged: 0
      }
    };

    allModels.forEach(model => {
      const model1 = models1[model];
      const model2 = models2[model];

      if (!model1 && model2) {
        comparison.models[model] = {
          status: 'added',
          data: model2,
          change: {
            quantity: model2.totalQuantity,
            agents: model2.agentCount
          }
        };
        comparison.summary.added++;
      } else if (model1 && !model2) {
        comparison.models[model] = {
          status: 'removed',
          data: model1,
          change: {
            quantity: -model1.totalQuantity,
            agents: -model1.agentCount
          }
        };
        comparison.summary.removed++;
      } else if (model1 && model2) {
        const quantityChange = model2.totalQuantity - model1.totalQuantity;
        const agentChange = model2.agentCount - model1.agentCount;
        
        comparison.models[model] = {
          status: quantityChange !== 0 || agentChange !== 0 ? 'changed' : 'unchanged',
          data: {
            before: model1,
            after: model2
          },
          change: {
            quantity: quantityChange,
            agents: agentChange,
            colors: this.compareColorAssignments(model1.colors || {}, model2.colors || {})
          }
        };
        
        if (quantityChange !== 0 || agentChange !== 0) {
          comparison.summary.changed++;
        } else {
          comparison.summary.unchanged++;
        }
      }
    });

    return comparison;
  }

  // 전체 비교
  compareOverall(history1, history2) {
    return {
      agent: this.compareByAgent(history1, history2),
      office: this.compareByOffice(history1, history2),
      department: this.compareByDepartment(history1, history2),
      model: this.compareByModel(history1, history2)
    };
  }

  // 비교 메트릭 계산
  calculateComparisonMetrics(history1, history2, comparisonType) {
    const metrics = {
      efficiency: this.calculateEfficiencyMetrics(history1, history2),
      distribution: this.calculateDistributionMetrics(history1, history2),
      trends: this.calculateTrendMetrics(history1, history2),
      impact: this.calculateImpactMetrics(history1, history2)
    };

    return metrics;
  }

  // 효율성 메트릭 계산
  calculateEfficiencyMetrics(history1, history2) {
    const totalQuantity1 = this.calculateTotalQuantity(history1);
    const totalQuantity2 = this.calculateTotalQuantity(history2);
    const totalAgents1 = this.calculateTotalAgents(history1);
    const totalAgents2 = this.calculateTotalAgents(history2);

    const efficiency1 = totalAgents1 > 0 ? totalQuantity1 / totalAgents1 : 0;
    const efficiency2 = totalAgents2 > 0 ? totalQuantity2 / totalAgents2 : 0;
    const efficiencyChange = efficiency2 - efficiency1;
    const efficiencyChangePercent = efficiency1 > 0 ? (efficiencyChange / efficiency1) * 100 : 0;

    return {
      averageQuantityPerAgent: {
        history1: efficiency1,
        history2: efficiency2,
        change: efficiencyChange,
        changePercent: efficiencyChangePercent
      },
      distributionEfficiency: this.calculateDistributionEfficiency(history1, history2)
    };
  }

  // 분포 메트릭 계산
  calculateDistributionMetrics(history1, history2) {
    const models1 = this.groupByModel(history1);
    const models2 = this.groupByModel(history2);

    return {
      modelDistribution: this.calculateModelDistribution(models1, models2),
      agentDistribution: this.calculateAgentDistribution(history1, history2),
      officeDistribution: this.calculateOfficeDistribution(history1, history2)
    };
  }

  // 트렌드 메트릭 계산
  calculateTrendMetrics(history1, history2) {
    const date1 = new Date(history1.metadata.createdAt);
    const date2 = new Date(history2.metadata.createdAt);
    const daysDiff = (date2 - date1) / (1000 * 60 * 60 * 24);

    const totalQuantity1 = this.calculateTotalQuantity(history1);
    const totalQuantity2 = this.calculateTotalQuantity(history2);

    const dailyChange = daysDiff > 0 ? (totalQuantity2 - totalQuantity1) / daysDiff : 0;
    const weeklyChange = dailyChange * 7;
    const monthlyChange = dailyChange * 30;

    return {
      dailyChange,
      weeklyChange,
      monthlyChange,
      trendDirection: dailyChange > 0 ? 'increasing' : dailyChange < 0 ? 'decreasing' : 'stable'
    };
  }

  // 영향도 메트릭 계산
  calculateImpactMetrics(history1, history2) {
    const totalQuantity1 = this.calculateTotalQuantity(history1);
    const totalQuantity2 = this.calculateTotalQuantity(history2);
    const totalAgents1 = this.calculateTotalAgents(history1);
    const totalAgents2 = this.calculateTotalAgents(history2);

    const quantityImpact = totalQuantity1 > 0 ? Math.abs((totalQuantity2 - totalQuantity1) / totalQuantity1) * 100 : 0;
    const agentImpact = totalAgents1 > 0 ? Math.abs((totalAgents2 - totalAgents1) / totalAgents1) * 100 : 0;

    return {
      quantityImpact,
      agentImpact,
      overallImpact: (quantityImpact + agentImpact) / 2
    };
  }

  // 인사이트 생성
  generateInsights(history1, history2, comparisonType) {
    const insights = [];
    const summary = this.generateComparisonSummary(history1, history2, comparisonType);
    const metrics = this.calculateComparisonMetrics(history1, history2, comparisonType);

    // 수량 변화 인사이트
    if (summary.totalQuantity.changePercent > 10) {
      insights.push({
        type: 'quantity_increase',
        message: `배정 수량이 ${summary.totalQuantity.changePercent.toFixed(1)}% 증가했습니다.`,
        impact: 'high',
        recommendation: '증가된 수량에 대한 재고 확보가 필요할 수 있습니다.'
      });
    } else if (summary.totalQuantity.changePercent < -10) {
      insights.push({
        type: 'quantity_decrease',
        message: `배정 수량이 ${Math.abs(summary.totalQuantity.changePercent).toFixed(1)}% 감소했습니다.`,
        impact: 'medium',
        recommendation: '감소 원인을 분석하여 배정 전략을 조정하세요.'
      });
    }

    // 영업사원 변화 인사이트
    if (summary.totalAgents.change > 0) {
      insights.push({
        type: 'agent_increase',
        message: `${summary.totalAgents.change}명의 영업사원이 추가되었습니다.`,
        impact: 'medium',
        recommendation: '새로운 영업사원에 대한 교육 및 지원이 필요합니다.'
      });
    } else if (summary.totalAgents.change < 0) {
      insights.push({
        type: 'agent_decrease',
        message: `${Math.abs(summary.totalAgents.change)}명의 영업사원이 감소했습니다.`,
        impact: 'high',
        recommendation: '영업사원 감소에 따른 업무 재배정을 고려하세요.'
      });
    }

    // 효율성 인사이트
    if (metrics.efficiency.averageQuantityPerAgent.changePercent > 5) {
      insights.push({
        type: 'efficiency_improvement',
        message: `영업사원당 평균 배정 수량이 ${metrics.efficiency.averageQuantityPerAgent.changePercent.toFixed(1)}% 개선되었습니다.`,
        impact: 'positive',
        recommendation: '효율성 개선이 지속되도록 모니터링하세요.'
      });
    } else if (metrics.efficiency.averageQuantityPerAgent.changePercent < -5) {
      insights.push({
        type: 'efficiency_decline',
        message: `영업사원당 평균 배정 수량이 ${Math.abs(metrics.efficiency.averageQuantityPerAgent.changePercent).toFixed(1)}% 감소했습니다.`,
        impact: 'negative',
        recommendation: '효율성 저하 원인을 분석하고 개선 방안을 마련하세요.'
      });
    }

    // 트렌드 인사이트
    if (metrics.trends.trendDirection === 'increasing') {
      insights.push({
        type: 'positive_trend',
        message: '배정 수량이 증가하는 추세를 보이고 있습니다.',
        impact: 'positive',
        recommendation: '증가 추세를 유지하기 위한 전략을 수립하세요.'
      });
    } else if (metrics.trends.trendDirection === 'decreasing') {
      insights.push({
        type: 'negative_trend',
        message: '배정 수량이 감소하는 추세를 보이고 있습니다.',
        impact: 'negative',
        recommendation: '감소 추세를 반전시키기 위한 대책을 마련하세요.'
      });
    }

    return insights;
  }

  // 헬퍼 함수들
  calculateTotalQuantity(history) {
    if (!history.assignments || !history.assignments.agents) return 0;
    return Object.values(history.assignments.agents).reduce((sum, agent) => sum + (agent.quantity || 0), 0);
  }

  calculateTotalAgents(history) {
    if (!history.assignments || !history.assignments.agents) return 0;
    return Object.keys(history.assignments.agents).length;
  }

  calculateTotalModels(history) {
    if (!history.assignments || !history.assignments.agents) return 0;
    const allModels = new Set();
    Object.values(history.assignments.agents).forEach(agent => {
      if (agent.models) {
        Object.keys(agent.models).forEach(model => allModels.add(model));
      }
    });
    return allModels.size;
  }

  extractAgentData(history) {
    return history.assignments?.agents || {};
  }

  groupByOffice(history) {
    const offices = {};
    const agents = this.extractAgentData(history);
    
    Object.entries(agents).forEach(([agentId, agent]) => {
      const office = agent.office || '미분류';
      if (!offices[office]) {
        offices[office] = {
          totalQuantity: 0,
          agentCount: 0,
          agents: {}
        };
      }
      offices[office].totalQuantity += agent.quantity || 0;
      offices[office].agentCount++;
      offices[office].agents[agentId] = agent;
    });

    return offices;
  }

  groupByDepartment(history) {
    const departments = {};
    const agents = this.extractAgentData(history);
    
    Object.entries(agents).forEach(([agentId, agent]) => {
      const department = agent.department || '미분류';
      if (!departments[department]) {
        departments[department] = {
          totalQuantity: 0,
          agentCount: 0,
          agents: {}
        };
      }
      departments[department].totalQuantity += agent.quantity || 0;
      departments[department].agentCount++;
      departments[department].agents[agentId] = agent;
    });

    return departments;
  }

  groupByModel(history) {
    const models = {};
    const agents = this.extractAgentData(history);
    
    Object.values(agents).forEach(agent => {
      if (agent.models) {
        Object.entries(agent.models).forEach(([model, modelData]) => {
          if (!models[model]) {
            models[model] = {
              totalQuantity: 0,
              agentCount: 0,
              colors: {},
              agents: {}
            };
          }
          models[model].totalQuantity += modelData.quantity || 0;
          models[model].agentCount++;
          
          if (modelData.colors) {
            Object.entries(modelData.colors).forEach(([color, quantity]) => {
              models[model].colors[color] = (models[model].colors[color] || 0) + quantity;
            });
          }
        });
      }
    });

    return models;
  }

  compareModelAssignments(models1, models2) {
    const allModels = new Set([...Object.keys(models1), ...Object.keys(models2)]);
    const comparison = {};

    allModels.forEach(model => {
      const model1 = models1[model];
      const model2 = models2[model];
      
      if (model1 && model2) {
        comparison[model] = {
          quantityChange: (model2.quantity || 0) - (model1.quantity || 0),
          colors: this.compareColorAssignments(model1.colors || {}, model2.colors || {})
        };
      } else if (model1) {
        comparison[model] = {
          quantityChange: -(model1.quantity || 0),
          colors: {}
        };
      } else if (model2) {
        comparison[model] = {
          quantityChange: model2.quantity || 0,
          colors: model2.colors || {}
        };
      }
    });

    return comparison;
  }

  compareColorAssignments(colors1, colors2) {
    const allColors = new Set([...Object.keys(colors1), ...Object.keys(colors2)]);
    const comparison = {};

    allColors.forEach(color => {
      const color1 = colors1[color] || 0;
      const color2 = colors2[color] || 0;
      comparison[color] = color2 - color1;
    });

    return comparison;
  }

  calculateDistributionEfficiency(history1, history2) {
    // 분포 효율성 계산 (표준편차 기반)
    const agents1 = Object.values(this.extractAgentData(history1));
    const agents2 = Object.values(this.extractAgentData(history2));

    const quantities1 = agents1.map(agent => agent.quantity || 0);
    const quantities2 = agents2.map(agent => agent.quantity || 0);

    const stdDev1 = this.calculateStandardDeviation(quantities1);
    const stdDev2 = this.calculateStandardDeviation(quantities2);

    return {
      history1: stdDev1,
      history2: stdDev2,
      improvement: stdDev1 > stdDev2 ? (stdDev1 - stdDev2) / stdDev1 * 100 : 0
    };
  }

  calculateStandardDeviation(values) {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  }

  calculateModelDistribution(models1, models2) {
    const allModels = new Set([...Object.keys(models1), ...Object.keys(models2)]);
    const distribution = {};

    allModels.forEach(model => {
      const model1 = models1[model];
      const model2 = models2[model];
      
      distribution[model] = {
        history1: model1 ? model1.totalQuantity : 0,
        history2: model2 ? model2.totalQuantity : 0,
        change: (model2 ? model2.totalQuantity : 0) - (model1 ? model1.totalQuantity : 0)
      };
    });

    return distribution;
  }

  calculateAgentDistribution(history1, history2) {
    const agents1 = this.extractAgentData(history1);
    const agents2 = this.extractAgentData(history2);
    
    const quantities1 = Object.values(agents1).map(agent => agent.quantity || 0);
    const quantities2 = Object.values(agents2).map(agent => agent.quantity || 0);

    return {
      history1: {
        min: Math.min(...quantities1),
        max: Math.max(...quantities1),
        average: quantities1.reduce((sum, qty) => sum + qty, 0) / quantities1.length
      },
      history2: {
        min: Math.min(...quantities2),
        max: Math.max(...quantities2),
        average: quantities2.reduce((sum, qty) => sum + qty, 0) / quantities2.length
      }
    };
  }

  calculateOfficeDistribution(history1, history2) {
    const offices1 = this.groupByOffice(history1);
    const offices2 = this.groupByOffice(history2);
    
    const quantities1 = Object.values(offices1).map(office => office.totalQuantity);
    const quantities2 = Object.values(offices2).map(office => office.totalQuantity);

    return {
      history1: {
        min: Math.min(...quantities1),
        max: Math.max(...quantities1),
        average: quantities1.reduce((sum, qty) => sum + qty, 0) / quantities1.length
      },
      history2: {
        min: Math.min(...quantities2),
        max: Math.max(...quantities2),
        average: quantities2.reduce((sum, qty) => sum + qty, 0) / quantities2.length
      }
    };
  }

  // 캐시 정리
  clearCache() {
    this.comparisonCache.clear();
  }

  // 캐시 크기 확인
  getCacheSize() {
    return this.comparisonCache.size;
  }
}

// 싱글톤 인스턴스 생성
export const assignmentComparisonManager = new AssignmentComparisonManager();

// 편의 함수들
export const compareAssignments = (history1, history2, comparisonType) => {
  return assignmentComparisonManager.compareAssignments(history1, history2, comparisonType);
};

export const generateComparisonReport = (history1, history2, comparisonType = COMPARISON_TYPES.OVERALL) => {
  const comparison = compareAssignments(history1, history2, comparisonType);
  
  return {
    title: `배정 이력 비교 리포트`,
    subtitle: `${history1.metadata.name} vs ${history2.metadata.name}`,
    timestamp: new Date().toISOString(),
    comparison,
    recommendations: comparison.insights
      .filter(insight => insight.recommendation)
      .map(insight => insight.recommendation)
  };
}; 