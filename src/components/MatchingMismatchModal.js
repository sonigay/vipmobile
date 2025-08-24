import React from 'react';
import { Modal, Button, Table, Badge } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

const MatchingMismatchModal = ({ visible, onClose, matchingMismatches }) => {
  if (!matchingMismatches || matchingMismatches.length === 0) {
    return null;
  }

  const columns = [
    {
      title: '구분',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Badge 
          status={type === '출고처' ? 'warning' : 'error'} 
          text={type} 
        />
      ),
    },
    {
      title: '출고처명',
      dataIndex: '거래처정보',
      key: 'store',
      render: (거래처정보) => 거래처정보.출고처,
    },
    {
      title: '거래처정보',
      key: 'customerInfo',
      render: (_, record) => (
        <div>
          <div><strong>담당자:</strong> {record.거래처정보.담당자}</div>
          <div><strong>코드:</strong> {record.거래처정보.코드}</div>
        </div>
      ),
    },
    {
      title: '폰클데이터',
      key: 'phoneklInfo',
      render: (_, record) => (
        <div>
          <div><strong>담당자:</strong> {record.폰클출고처데이터.담당자}</div>
          <div><strong>코드:</strong> {record.폰클출고처데이터.코드}</div>
        </div>
      ),
    },
    {
      title: '상태',
      key: 'status',
      render: (_, record) => {
        const isAgentMismatch = record.거래처정보.담당자 !== record.폰클출고처데이터.담당자;
        const isCodeMismatch = record.거래처정보.코드 !== record.폰클출고처데이터.코드;
        
        if (isAgentMismatch && isCodeMismatch) {
          return <Badge status="error" text="담당자+코드 불일치" />;
        } else if (isAgentMismatch) {
          return <Badge status="warning" text="담당자 불일치" />;
        } else if (isCodeMismatch) {
          return <Badge status="warning" text="코드 불일치" />;
        }
        return <Badge status="success" text="정상" />;
      },
    },
  ];

  return (
    <Modal
      title={
        <div>
          <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
          매칭 불일치 알림
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          닫기
        </Button>
      ]}
      width={1200}
      style={{ top: 20 }}
    >
      <div style={{ marginBottom: 16 }}>
        <p>
          <strong>거래처정보</strong>와 <strong>폰클출고처데이터</strong> 간의 담당자/코드 불일치가 발견되었습니다.
        </p>
        <p>
          이는 등록점과 보유재고 계산에 영향을 줄 수 있습니다.
        </p>
      </div>
      
      <Table
        columns={columns}
        dataSource={matchingMismatches}
        rowKey={(record, index) => index}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => 
            `${range[0]}-${range[1]} / 총 ${total}건`,
        }}
        scroll={{ x: 1000 }}
      />
      
      <div style={{ marginTop: 16, padding: 16, backgroundColor: '#f6f8fa', borderRadius: 6 }}>
        <h4>📋 불일치 유형 설명</h4>
        <ul>
          <li><Badge status="warning" text="담당자 불일치" />: 거래처정보와 폰클출고처데이터의 담당자가 다름</li>
          <li><Badge status="warning" text="코드 불일치" />: 거래처정보와 폰클출고처데이터의 코드가 다름</li>
          <li><Badge status="error" text="담당자+코드 불일치" />: 담당자와 코드 모두 다름</li>
        </ul>
      </div>
    </Modal>
  );
};

export default MatchingMismatchModal;
