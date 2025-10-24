#!/usr/bin/env node

/**
 * 확장프로그램 버전 자동 업데이트 스크립트
 * 
 * 사용법: node update-extension-version.js
 * 
 * 이 스크립트는 content.js의 버전 히스토리를 읽어서
 * 최신 버전을 자동으로 계산하고 manifest.json을 업데이트합니다.
 */

const fs = require('fs');
const path = require('path');

// 파일 경로
const contentJsPath = path.join(__dirname, 'vip-extension', 'content.js');
const manifestJsonPath = path.join(__dirname, 'vip-extension', 'manifest.json');

function extractVersionFromContentJs() {
  try {
    const content = fs.readFileSync(contentJsPath, 'utf8');
    
    // 버전 히스토리에서 최신 버전 추출
    const versionHistoryMatch = content.match(/\/\/ 자동 버전 계산: 현재 최신 버전은 (v[\d.]+)/);
    if (versionHistoryMatch) {
      return versionHistoryMatch[1];
    }
    
    // 대안: versionHistory 배열에서 마지막 버전 추출
    const versionArrayMatch = content.match(/const versionHistory = \[([^\]]+)\]/);
    if (versionArrayMatch) {
      const versions = versionArrayMatch[1].split(',').map(v => v.trim().replace(/['"]/g, ''));
      return versions[versions.length - 1];
    }
    
    throw new Error('버전 정보를 찾을 수 없습니다.');
  } catch (error) {
    console.error('content.js에서 버전 정보를 읽는 중 오류:', error.message);
    return null;
  }
}

function updateManifestJson(version) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'));
    manifest.version = version.replace('v', ''); // v1.3.2 -> 1.3.2
    fs.writeFileSync(manifestJsonPath, JSON.stringify(manifest, null, 2));
    console.log(`✅ manifest.json 버전 업데이트: ${manifest.version}`);
    return true;
  } catch (error) {
    console.error('manifest.json 업데이트 중 오류:', error.message);
    return false;
  }
}

function main() {
  console.log('🔄 확장프로그램 버전 자동 업데이트 시작...');
  
  // content.js에서 최신 버전 추출
  const latestVersion = extractVersionFromContentJs();
  if (!latestVersion) {
    console.error('❌ 버전 정보를 찾을 수 없습니다.');
    process.exit(1);
  }
  
  console.log(`📋 content.js에서 감지된 최신 버전: ${latestVersion}`);
  
  // manifest.json 업데이트
  const success = updateManifestJson(latestVersion);
  if (success) {
    console.log('🎉 확장프로그램 버전 업데이트 완료!');
  } else {
    console.error('❌ 버전 업데이트 실패');
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  main();
}

module.exports = { extractVersionFromContentJs, updateManifestJson };
