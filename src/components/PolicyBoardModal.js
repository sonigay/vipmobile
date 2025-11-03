import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Box,
  Typography
} from '@mui/material';
import GroupSelectionModal from './GroupSelectionModal';
import SupportItemsInput from './SupportItemsInput';

const PolicyBoardModal = ({ open, onClose, onSave, policy = null, loggedInStore }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [isDirectInput, setIsDirectInput] = useState(false);
  const [loading, setLoading] = useState(false);

  // 수정 모드일 때 초기값 설정
  useEffect(() => {
    if (open) {
      if (policy) {
        setTitle(policy.title || '');
        setContent(policy.content || '');
        setIsPinned(policy.isPinned || false);
        setSelectedGroups(policy.groups || []);
        setSelectedCompanyIds(policy.companyIds || []);
      } else {
        // 새 정책 등록
        setTitle('');
        setContent('');
        setIsPinned(false);
        setSelectedGroups([]);
        setSelectedCompanyIds([]);
        setIsDirectInput(false);
      }
    }
  }, [open, policy]);

  const handleSave = async () => {
    if (!title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }
    if (!content.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const policyData = {
        title: title.trim(),
        content: content.trim(),
        isPinned,
        groups: selectedGroups,
        companyIds: selectedCompanyIds,
        createdBy: loggedInStore?.name || 'Unknown'
      };

      await onSave(policyData, policy?.id);
      handleClose();
    } catch (error) {
      console.error('정책 저장 실패:', error);
      alert('정책 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setContent('');
    setIsPinned(false);
    setSelectedGroups([]);
    setSelectedCompanyIds([]);
    setIsDirectInput(false);
    onClose();
  };

  const handleGroupConfirm = (groups, companyIds) => {
    setSelectedGroups(groups);
    setSelectedCompanyIds(companyIds);
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {policy ? '정책 수정' : '정책 등록'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {/* 상단고정 체크박스 */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                />
              }
              label="상단고정"
              sx={{ mb: 2 }}
            />

            {/* 제목 입력 */}
            <TextField
              fullWidth
              label="제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              sx={{ mb: 2 }}
              required
              placeholder="정책 제목을 입력하세요"
            />

            {/* 그룹 선택 */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2">그룹 및 업체 선택</Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setShowGroupModal(true)}
                >
                  {selectedGroups.length > 0 || selectedCompanyIds.length > 0
                    ? `${selectedGroups.length}개 그룹, ${selectedCompanyIds.length}개 업체 선택됨`
                    : '그룹 선택'}
                </Button>
              </Box>
              {selectedGroups.length > 0 && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" color="textSecondary">
                    선택된 그룹: {selectedGroups.join(', ')}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* 내용 입력 */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                내용 *
              </Typography>
              {!isDirectInput && (
                <SupportItemsInput
                  value={content}
                  onChange={setContent}
                  isDirectInput={isDirectInput}
                  onDirectInputChange={setIsDirectInput}
                />
              )}
              <TextField
                fullWidth
                multiline
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={isDirectInput ? "정책 내용을 직접 입력하세요" : "지원사항을 추가하면 자동으로 포맷팅된 내용이 표시됩니다"}
                sx={{ mt: 2 }}
                required
                disabled={!isDirectInput}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            취소
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={loading}>
            {loading ? '저장 중...' : (policy ? '수정' : '등록')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 그룹 선택 모달 */}
      <GroupSelectionModal
        open={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        onConfirm={handleGroupConfirm}
        selectedGroups={selectedGroups}
        selectedCompanyIds={selectedCompanyIds}
      />
    </>
  );
};

export default PolicyBoardModal;

