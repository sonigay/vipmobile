// 색상 유틸리티 함수

// HEX 색상의 밝기 조정 (RGB 기반)
export const adjustBrightness = (hex, percent) => {
  // hex를 RGB로 변환
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) + percent;
  const g = ((num >> 8) & 0x00FF) + percent;
  const b = (num & 0x0000FF) + percent;
  
  // 0-255 범위로 제한
  const clamp = (val) => Math.min(255, Math.max(0, val));
  
  return `#${((clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).padStart(6, '0')}`;
};

// HEX 색상을 어둡게 만들기 (HSL 기반, 더 정확)
export const darkenColor = (hex, percent) => {
  // hex를 RGB로 변환
  const num = parseInt(hex.replace('#', ''), 16);
  const r = num >> 16;
  const g = (num >> 8) & 0x00FF;
  const b = num & 0x0000FF;
  
  // RGB를 0-1 범위로 정규화
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  
  // RGB를 HSL로 변환
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h, s, l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0; // 무채색
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case rNorm: h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6; break;
      case gNorm: h = ((bNorm - rNorm) / d + 2) / 6; break;
      case bNorm: h = ((rNorm - gNorm) / d + 4) / 6; break;
      default: h = 0;
    }
  }
  
  // 밝기(L) 감소
  l = Math.max(0, Math.min(1, l - (percent / 100)));
  
  // HSL을 RGB로 변환
  const hslToRgb = (h, s, l) => {
    let r, g, b;
    
    if (s === 0) {
      r = g = b = l; // 무채색
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  };
  
  const [rNew, gNew, bNew] = hslToRgb(h, s, l);
  
  return `#${((rNew << 16) | (gNew << 8) | bNew).toString(16).padStart(6, '0')}`;
};
