/* ==========================================================================
   DSLogic 协议预设 (T4) — 纯数据模块，无 DOM/依赖。
   5 个预设对应 vendor/dslogic/decoders 中的官方解码器；pins 元素为解码器
   通道 id（describe 元数据校验用）；hint = 推荐采样率短标签；tip = 阈值/
   速率 Tooltip 全文。
   ========================================================================== */

const LA_PRESETS = [
  {
    key: 'i2c', label: 'I²C', dec: '0:i2c', stacked: [],
    pins: ['scl', 'sda'], optPins: [],
    hint: '≥10MHz',
    tip: 'I²C 100k~1Mbit/s：采样率 ≥10MHz；阈值按总线电平 1.8V/3.3V',
    options: { address_format: 'unshifted' }
  },
  {
    key: 'spi', label: 'SPI', dec: '0:spi', stacked: [],
    pins: ['clk'], optPins: ['miso', 'mosi', 'cs'],
    hint: '≥10×SCK',
    tip: 'SPI：采样率 ≥10×SCK 时钟；阈值按 IO 电平；CS# 缺省时按数据间隔分组',
    options: { cs_polarity: 'active-low', cpol: 0, cpha: 0, bitorder: 'msb-first', wordsize: 8 }
  },
  {
    key: 'uart', label: 'UART', dec: '1:uart', stacked: [],
    pins: ['rxtx'], optPins: [],
    hint: '≥1MHz',
    tip: 'UART ≤1Mbit/s：采样率 ≥10×波特率；无流控解码仅需 RX/TX 单通道',
    options: { baudrate: 115200, num_data_bits: 8, parity_type: 'none', parity_check: 'yes',
               num_stop_bits: 1.0, bit_order: 'lsb-first', format: 'hex', invert: 'no' }
  },
  {
    key: 'pd', label: 'USB PD', dec: 'usb_power_delivery', stacked: [],
    pins: ['cc1'], optPins: ['cc2'],
    hint: '≥10MHz',
    tip: 'PD BMC ≈300kbit/s：采样率 ≥10MHz；CC 摆幅约 1.1V，阈值约 0.55–0.6V',
    options: { fulltext: 'no' }
  },
  {
    key: 'ufcs', label: 'UFCS', dec: '1:uart', stacked: [{ id: 'ufcs', options: { fulltext: 'no' } }],
    pins: ['rxtx'], optPins: [],
    hint: '≥4MHz',
    tip: 'UFCS 走 UART 物理层：8N1 无校验，默认 115200，可降档至 57600/38400/19200；帧首 Training 0xAA；采样率 ≥10×baudrate',
    options: { baudrate: 115200, num_data_bits: 8, parity_type: 'none', parity_check: 'yes',
               num_stop_bits: 1.0, bit_order: 'lsb-first', format: 'hex', invert: 'no' }
  }
];


/* 按边沿活跃度推测引脚映射：活跃通道按边沿数降序，依次填入必需引脚，
   再填可选引脚。返回 {role: chanIndex}；活跃通道不足时按序回填。 */
function laSuggestPins(preset, channels) {
  const act = (channels || []).filter(c => c && c.active)
    .slice().sort((a, b) => (b.edges || 0) - (a.edges || 0));
  const order = act.length ? act.map(c => c.index)
    : (channels || []).map(c => c.index);
  const roles = (preset.pins || []).concat(preset.optPins || []);
  const map = {};
  roles.forEach((r, i) => { if (i < order.length) map[r] = order[i]; });
  return map;
}


/* 预设 + 用户引脚/选项 -> decode spec（喂给 decoder/pins/options/stacked 参数）。
   pinMap: {role: probeIndex}；optVals: {optId: value}（空值回落 preset.options/default）。 */
function laPresetSpec(preset, pinMap, optVals) {
  const pins = {};
  for (const role of (preset.pins || [])) {
    const v = pinMap && pinMap[role];
    if (v === undefined || v === null || v === '') throw new Error('缺少必需引脚: ' + role);
    pins[role] = parseInt(v, 10);
  }
  for (const role of (preset.optPins || [])) {
    const v = pinMap && pinMap[role];
    if (v !== undefined && v !== null && v !== '') pins[role] = parseInt(v, 10);
  }
  const options = Object.assign({}, preset.options || {}, optVals || {});
  return {
    id: preset.dec, label: preset.label, pins, options,
    stacked: (preset.stacked || []).map(s => ({ id: s.id, options: Object.assign({}, s.options) }))
  };
}


if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LA_PRESETS, laSuggestPins, laPresetSpec };
}
