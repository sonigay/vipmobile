// Registry of capture target support per mode/tab for presentation capture
// Only modes/tabs listed here will be shown in selection (to avoid incomplete captures)

export function hasCaptureSupport(modeKey, tabKey) {
  // chart: closingChart supported (detailOptions driven)
  if (modeKey === 'chart') {
    // Support all tabs for now; detail-specific targeting implemented in MeetingCaptureManager
    return true;
  }
  // inventoryChart (재고장표) - supported
  if (modeKey === 'inventoryChart') return true;
  // main/toc/ending are supported (fixed layout)
  if (modeKey === 'main' || modeKey === 'toc' || modeKey === 'ending') return true;
  // other modes default: not supported until mapped
  return false;
}


