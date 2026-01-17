import React, { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import BudgetChannelSettingsTab from './BudgetChannelSettingsTab';
import BasicBudgetSettingsTab from './BasicBudgetSettingsTab';
import BasicDataSettingsTab from './BasicDataSettingsTab';

const BudgetSettingsTab = ({ loggedInStore }) => {
  const [subTab, setSubTab] = useState(0);

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={subTab} onChange={(e, newValue) => setSubTab(newValue)}>
          <Tab label="채널별예산시트설정" />
          <Tab label="기본예산시트설정" />
          <Tab label="기본데이터시트설정" />
        </Tabs>
      </Box>

      {subTab === 0 && <BudgetChannelSettingsTab loggedInStore={loggedInStore} />}
      {subTab === 1 && <BasicBudgetSettingsTab loggedInStore={loggedInStore} />}
      {subTab === 2 && <BasicDataSettingsTab loggedInStore={loggedInStore} />}
    </Box>
  );
};

export default BudgetSettingsTab;
