// 팀 정보 조회 API
function setupTeamRoutes(app, getSheetValuesWithoutCache) {
  app.get('/api/teams', async (req, res) => {
    try {
      console.log('팀 정보 조회 요청');
      
      const values = await getSheetValuesWithoutCache('대리점아이디관리');
      
      if (!values || values.length <= 1) {
        return res.json({ success: true, teams: [] });
      }
      
      // A열(대상이름)과 P열(권한레벨) 매핑
      const teams = values.slice(1)
        .filter(row => row[0] && row[15]) // A열과 P열이 모두 있는 행만
        .map(row => ({
          code: row[15], // P열: 권한레벨 (AA, BB, CC 등)
          name: row[0]   // A열: 대상이름
        }))
        .filter(team => ['AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(team.code)); // 정책팀만 필터링
      
      // 홍남옥 하드코딩 추가
      teams.push({
        code: '홍남옥',
        name: '홍남옥'
      });
      
      console.log(`팀 정보 조회 완료: ${teams.length}건`);
      res.json({ success: true, teams });
      
    } catch (error) {
      console.error('팀 정보 조회 실패:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

module.exports = setupTeamRoutes; 