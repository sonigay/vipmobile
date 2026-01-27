---
description: 터미널 명령어 자동 실행 워크플로우 예시
---

이 워크플로우는 `// turbo` 기능을 시연하기 위해 제작되었습니다.

// turbo
1. 현재 디렉토리의 파일 목록을 확인합니다.
```bash
ls -R
```

// turbo  
2. 서버 상태를 확인합니다.
```bash
npm run status
```

// turbo-all
```bash
npm test *
sed *
node *
sleep *
curl *
npm start
git status
git add *
git commit *
git push *
Get-Item *
wc *
Copy-Item *
copy *
cp *
npm *
Start-Sleep *
Get-Content *
ping *
timeout *
netstat *
taskkill *
Stop-Process *
tasklist *
tskill *
grep *
grep -n *
```



> [!NOTE]
> `// turbo` 라인이 명령어 바로 위에 있으면 사용자의 매번 승인 없이도 제가 판단하여 자동으로 실행할 수 있습니다.
> `// turbo-all`이 파일 상단에 있으면 모든 단계가 자동 실행됩니다.