import React, { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import BudgetChannelCheckTab from './BudgetChannelCheckTab';
import BasicBudgetCheckTab from './BasicBudgetCheckTab';
import BasicDataCheckTab from './BasicDataCheckTab';

const BudgetCheckTab = ({ loggedInStore }) => {
  const [subTab, setSubTab] = useState(0);

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={subTab} onChange={(e, newValue) => setSubTab(newValue)}>
          <Tab label="채널별예산확인" />
          <Tab label="기본예산확인" />
          <Tab label="기본데이터확인" />
        </Tabs>
      </Box>

      {subTab === 0 && <BudgetChannelCheckTab loggedInStore={loggedInStore} />}
      {subTab === 1 && <BasicBudgetCheckTab loggedInStore={loggedInStore} />}
      {subTab === 2 && <BasicDataCheckTab loggedInStore={loggedInStore} />}
    </Box>
  );
};

export default BudgetCheckTab;
