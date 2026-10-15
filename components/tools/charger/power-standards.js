/* ==========================================================================
   Power Standards — 8 大充电功率档位达标判定规范
   ========================================================================== */

const POWER_STD = {
  "7.5": { report: 42, tail: 7.0, label: "7.5W (5V/1.5A)" },
  "10": { report: 40, tail: 7.0, label: "10W (5V/2A)" },
  "15": { report: 35, tail: 7.0, label: "15W (5V/3A)" },
  "18": { report: 24, tail: 7.0, label: "18W 快充 (9V/2A)" },
  "33": { report: 16, tail: 2.5, label: "33W 闪充 (11V/3A)" },
  "45": { report: 15, tail: 2.0, label: "45W 超级闪充" },
  "66": { report: 10, tail: 2.0, label: "66W/67W 极速闪充" },
  "80": { report: 8, tail: 1.5, label: "80W 超级闪充" },
  "120": { report: 4.5, tail: 1.0, label: "120W 秒充" }
};

const REQUIRED_CSV_FIELDS = ["Time", "Level", "Vbat", "Ibat", "Tbat", "Status"];

function standardJudge(m, power, cap) {
  cap = Number(cap);
  const s = POWER_STD[String(power)];
  if (!s || !(cap > 0)) return { configured: false };
  const reportLimit = s.report * (cap / 1000);
  const tailLimit = s.tail * (cap / 1000);
  const fullLimit = Number.isFinite(m.t100) ? m.t100 + tailLimit : NaN;
  return {
    configured: true,
    reportLimit,
    tailLimit,
    fullLimit,
    reportPass: Number.isFinite(m.t100) ? m.t100 <= reportLimit : null,
    fullPass: Number.isFinite(m.tFull) && Number.isFinite(fullLimit) ? m.tFull <= fullLimit : null
  };
}

function badge(pass) {
  if (pass === true) return '<span class="tw-chg-badge tw-chg-badge-good">✓ 通过</span>';
  if (pass === false) return '<span class="tw-chg-badge tw-chg-badge-bad">✗ 超标</span>';
  return '<span class="tw-chg-badge tw-chg-badge-gray">数据不足</span>';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { POWER_STD, REQUIRED_CSV_FIELDS, standardJudge, badge };
}
