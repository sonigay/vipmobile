// 원격 로그 기능 제거: 호출 시 아무 동작도 하지 않도록 처리
export function enableRemoteLogger() {
  return () => {};
}
