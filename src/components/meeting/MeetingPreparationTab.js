import React, { useState } from 'react';
import {
  Box,
  Container,
  Button,
  Stack
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import MeetingList from './MeetingList';
import MeetingEditor from './MeetingEditor';
import MeetingConfigEditor from './MeetingConfigEditor';
import MeetingCaptureManager from './MeetingCaptureManager';

function MeetingPreparationTab({ loggedInStore, onMeetingSelectForPresentation }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [configEditing, setConfigEditing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [newlyCreatedMeeting, setNewlyCreatedMeeting] = useState(null);

  const handleAdd = () => {
    setEditingMeeting(null);
    setEditorOpen(true);
  };

  const handleEdit = (meeting) => {
    setEditingMeeting(meeting);
    setEditorOpen(true);
  };

  const handleDelete = () => {
    // 목록 새로고침
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSelect = (meeting) => {
    if (meeting.status === 'completed') {
      // 완료된 회의는 회의진행 탭으로 이동
      if (onMeetingSelectForPresentation) {
        onMeetingSelectForPresentation(meeting);
      } else {
        alert('회의 재생 기능은 회의진행 탭에서 이용하실 수 있습니다.');
      }
      return;
    }
    setSelectedMeeting(meeting);
    setConfigEditing(true);
  };

  const handleEditorClose = () => {
    setEditorOpen(false);
    setEditingMeeting(null);
  };

  const handleEditorSuccess = async (createdMeeting) => {
    setEditorOpen(false);
    setEditingMeeting(null);
    
    // 새로 생성된 회의인 경우 캡처 시작
    if (createdMeeting && !editingMeeting && createdMeeting.slides) {
      // MeetingCaptureManager를 사용하여 캡처 시작
      setNewlyCreatedMeeting(createdMeeting);
      setConfigEditing(true);
    } else {
      // 목록 새로고침
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handleConfigCancel = () => {
    setConfigEditing(false);
    setSelectedMeeting(null);
    setNewlyCreatedMeeting(null);
  };

  const handleConfigSave = () => {
    setConfigEditing(false);
    setSelectedMeeting(null);
    setNewlyCreatedMeeting(null);
    // 목록 새로고침
    setRefreshTrigger(prev => prev + 1);
  };

  if (configEditing && (selectedMeeting || newlyCreatedMeeting)) {
    const meetingToEdit = selectedMeeting || newlyCreatedMeeting;
    
    // 새로 생성된 회의이고 슬라이드가 있으면 바로 캡처 화면으로
    if (newlyCreatedMeeting && newlyCreatedMeeting.slides && newlyCreatedMeeting.slides.length > 0) {
      return (
        <MeetingCaptureManager
          meeting={newlyCreatedMeeting}
          slides={newlyCreatedMeeting.slides}
          loggedInStore={loggedInStore}
          onComplete={handleConfigSave}
          onCancel={handleConfigCancel}
        />
      );
    }
    
    // 기존 회의 선택 또는 설정 편집인 경우
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleConfigCancel}
          sx={{ mb: 2 }}
        >
          목록으로 돌아가기
        </Button>
        <MeetingConfigEditor
          meeting={meetingToEdit}
          loggedInStore={loggedInStore}
          onSave={handleConfigSave}
          onCancel={handleConfigCancel}
        />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <MeetingList
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSelect={handleSelect}
        refreshTrigger={refreshTrigger}
      />

      <MeetingEditor
        open={editorOpen}
        meeting={editingMeeting}
        loggedInStore={loggedInStore}
        onClose={handleEditorClose}
        onSuccess={handleEditorSuccess}
      />
    </Container>
  );
}

export default MeetingPreparationTab;

