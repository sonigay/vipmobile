{/* 대중교통 위치 */}
<Grid item xs={12}>
    <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
        대중교통 위치
    </Typography>
    
    {/* 버스터미널 섹션 */}
    <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
            버스터미널
        </Typography>
        
        {/* 기존 위치 선택 */}
        <Autocomplete
            options={allTransitLocations.filter(loc => loc.type === '버스터미널')}
            getOptionLabel={(option) => `${option.name} (${option.address})`}
            value={null}
            onChange={handleBusTerminalSelect}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label="기존 버스터미널 선택"
                    placeholder="검색하여 선택하세요"
                    size="small"
                />
            )}
            sx={{ mb: 2 }}
        />
        
        {/* 새 버스터미널 추가 */}
        {isAddingNewTransit.type === '버스터미널' ? (
            <Paper sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0', bgcolor: '#f9f9f9' }}>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={5}>
                        <TextField
                            fullWidth
                            size="small"
                            label="이름"
                            value={isAddingNewTransit.name}
                            onChange={(e) => setIsAddingNewTransit({ ...isAddingNewTransit, name: e.target.value })}
                            placeholder="예: 평택터미널"
                        />
                    </Grid>
                    <Grid item xs={12} sm={5}>
                        <TextField
                            fullWidth
                            size="small"
                            label="주소"
                            value={isAddingNewTransit.address}
                            onChange={(e) => setIsAddingNewTransit({ ...isAddingNewTransit, address: e.target.value })}
                            placeholder="경기도 평택시..."
                        />
                    </Grid>
                    <Grid item xs={12} sm={2}>
                        <Button
                            fullWidth
                            size="small"
                            variant="contained"
                            onClick={() => handleAddNewTransitLocation('버스터미널')}
                            disabled={!isAddingNewTransit.name || !isAddingNewTransit.address}
                        >
                            저장
                        </Button>
                    </Grid>
                    <Grid item xs={12}>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setIsAddingNewTransit({ type: null, name: '', address: '' })}
                        >
                            취소
                        </Button>
                    </Grid>
                </Grid>
            </Paper>
        ) : (
            <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setIsAddingNewTransit({ type: '버스터미널', name: '', address: '' })}
                sx={{ mb: 2 }}
            >
                새 버스터미널 추가
            </Button>
        )}
        
        {/* 선택된 버스터미널 목록 */}
        {editBusTerminalIds.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {editBusTerminalIds.map(id => {
                    const location = allTransitLocations.find(loc => loc.id === id);
                    if (!location) return null;
                    return (
                        <Chip
                            key={id}
                            label={`${location.name} (${location.address})`}
                            onDelete={() => handleBusTerminalRemove(id)}
                            color="primary"
                            variant="outlined"
                        />
                    );
                })}
            </Box>
        )}
        
        {editBusTerminalIds.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mb: 2 }}>
                버스터미널이 없습니다. 위에서 선택하거나 새로 추가하세요.
            </Typography>
        )}
    </Box>
    
    {/* 지하철역 섹션 */}
    <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
            지하철역
        </Typography>
        
        {/* 기존 위치 선택 */}
        <Autocomplete
            options={allTransitLocations.filter(loc => loc.type === '지하철역')}
            getOptionLabel={(option) => `${option.name} (${option.address})`}
            value={null}
            onChange={handleSubwayStationSelect}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label="기존 지하철역 선택"
                    placeholder="검색하여 선택하세요"
                    size="small"
                />
            )}
            sx={{ mb: 2 }}
        />
        
        {/* 새 지하철역 추가 */}
        {isAddingNewTransit.type === '지하철역' ? (
            <Paper sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0', bgcolor: '#f9f9f9' }}>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={5}>
                        <TextField
                            fullWidth
                            size="small"
                            label="이름"
                            value={isAddingNewTransit.name}
                            onChange={(e) => setIsAddingNewTransit({ ...isAddingNewTransit, name: e.target.value })}
                            placeholder="예: 무선역 1번출구"
                        />
                    </Grid>
                    <Grid item xs={12} sm={5}>
                        <TextField
                            fullWidth
                            size="small"
                            label="주소"
                            value={isAddingNewTransit.address}
                            onChange={(e) => setIsAddingNewTransit({ ...isAddingNewTransit, address: e.target.value })}
                            placeholder="경기도 평택시..."
                        />
                    </Grid>
                    <Grid item xs={12} sm={2}>
                        <Button
                            fullWidth
                            size="small"
                            variant="contained"
                            onClick={() => handleAddNewTransitLocation('지하철역')}
                            disabled={!isAddingNewTransit.name || !isAddingNewTransit.address}
                        >
                            저장
                        </Button>
                    </Grid>
                    <Grid item xs={12}>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setIsAddingNewTransit({ type: null, name: '', address: '' })}
                        >
                            취소
                        </Button>
                    </Grid>
                </Grid>
            </Paper>
        ) : (
            <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setIsAddingNewTransit({ type: '지하철역', name: '', address: '' })}
                sx={{ mb: 2 }}
            >
                새 지하철역 추가
            </Button>
        )}
        
        {/* 선택된 지하철역 목록 */}
        {editSubwayStationIds.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {editSubwayStationIds.map(id => {
                    const location = allTransitLocations.find(loc => loc.id === id);
                    if (!location) return null;
                    return (
                        <Chip
                            key={id}
                            label={`${location.name} (${location.address})`}
                            onDelete={() => handleSubwayStationRemove(id)}
                            color="secondary"
                            variant="outlined"
                        />
                    );
                })}
            </Box>
        )}
        
        {editSubwayStationIds.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                지하철역이 없습니다. 위에서 선택하거나 새로 추가하세요.
            </Typography>
        )}
    </Box>
</Grid>


