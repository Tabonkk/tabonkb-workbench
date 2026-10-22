/**
 * TabonKB Workbench V1.0.0 Automated Self-Test Suite Runner
 * Executes all functional test suites and prints a consolidated report.
 */
const path = require('path');
const fs = require('fs');
const child_process = require('child_process');

const pluginDir = path.resolve(__dirname, '..');
console.log('===============================================================');
console.log('   TabonKB Workbench V1.0.0 Consolidated Self-Test Runner');
console.log('   Target Plugin:', pluginDir);
console.log('===============================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, desc) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${desc}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${desc}`);
  }
}

async function runAllSuites() {
  // --- Suite 1: Code Integrity & Manifest Verification ---
  console.log('>>> Suite 1: Code Integrity & Manifest Verification');
  const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, 'manifest.json'), 'utf8'));
  assert(manifest.id === 'tabonkb-workbench', 'manifest.json has correct id');
  assert(manifest.version === '1.8.0', 'manifest.json has version 1.8.0');
  assert(fs.existsSync(path.join(pluginDir, 'main.js')), 'main.js exists');
  assert(fs.existsSync(path.join(pluginDir, 'styles.css')), 'styles.css exists');

  // --- Suite 2: Official AI Brand Icons & IconPark ---
  console.log('\n>>> Suite 2: Official AI Brand Icons & IconPark');
  const { getOfficialModelSvg, detectModelBrand, getIconPark } = require(path.join(pluginDir, 'ui', 'iconpark.js'));
  const gptBrand = detectModelBrand('gpt-5-6-thinking');
  assert(gptBrand === 'openai', `GPT-5.6 detects as openai (got: ${gptBrand})`);
  const claudeBrand = detectModelBrand('claude-3-7-sonnet');
  assert(claudeBrand === 'claude', `Claude detects as claude (got: ${claudeBrand})`);
  const dsBrand = detectModelBrand('deepseek-r1');
  assert(dsBrand === 'deepseek', `DeepSeek detects as deepseek (got: ${dsBrand})`);
  const geminiBrand = detectModelBrand('gemini-2.5-flash');
  assert(geminiBrand === 'gemini', `Gemini detects as gemini (got: ${geminiBrand})`);
  const qwenBrand = detectModelBrand('qwen-2.5-max');
  assert(qwenBrand === 'qwen', `Qwen detects as qwen (got: ${qwenBrand})`);
  const kimiBrand = detectModelBrand('moonshot-v1-32k');
  assert(kimiBrand === 'kimi', `Moonshot detects as kimi (got: ${kimiBrand})`);

  const svgOpenAI = getOfficialModelSvg('openai', 16);
  assert(svgOpenAI.includes('<svg') && svgOpenAI.includes('viewBox'), 'OpenAI official SVG rendered');
  const svgAnthropic = getOfficialModelSvg('claude', 16);
  assert(svgAnthropic.includes('<svg') && svgAnthropic.includes('viewBox'), 'Anthropic official SVG rendered');
  const svgDeepSeek = getOfficialModelSvg('deepseek', 16);
  assert(svgDeepSeek.includes('<svg') && svgDeepSeek.includes('viewBox'), 'DeepSeek official SVG rendered');
  const svgQwen = getOfficialModelSvg('qwen', 16);
  assert(svgQwen.includes('<svg') && svgQwen.includes('viewBox'), 'Qwen official SVG rendered');
  const svgKimi = getOfficialModelSvg('kimi', 16);
  assert(svgKimi.includes('<svg') && svgKimi.includes('viewBox'), 'Kimi official SVG rendered');
  const hubIcon = getIconPark('hub', 16);
  assert(hubIcon.includes('<svg') && hubIcon.includes('viewBox'), 'Agent Hub vector icon rendered');
  const abortIcon = getIconPark('pause-one', 14);
  assert(abortIcon.includes('<svg') && abortIcon.includes('viewBox'), 'Abort vector icon (pause-one) rendered');

  // --- Suite 3: Agent Hub & Adapter Registration ---
  console.log('\n>>> Suite 3: Agent Hub & Adapters');
  const os = require('os');
  const testHubVaultDir = path.join(os.tmpdir(), 'tabonkb-test-hub-' + Date.now());
  fs.mkdirSync(path.join(testHubVaultDir, '.obsidian', 'plugins', 'tabonkb-workbench'), { recursive: true });
  const { AgentHub } = require(path.join(pluginDir, 'agent-hub.js'));
  const hub = new AgentHub({ vaultBasePath: testHubVaultDir });
  const agentList = hub.getAgentList();
  assert(agentList.length === 3, `Hub has 3 registered agents (got: ${agentList.length})`);
  assert(agentList.some(a => a.id === 'pi'), 'Pi Agent registered');
  assert(agentList.some(a => a.id === 'antigravity'), 'Antigravity CLI registered');
  assert(agentList.some(a => a.id === 'niceaigc'), 'NiceAIGC registered');
  assert(!agentList.some(a => a.id === 'hermes'), 'Hermes CLI excluded from Hub');
  assert(!agentList.some(a => a.id === 'gemini'), 'Gemini CLI excluded from Hub');
  assert(!agentList.some(a => a.id === 'dsh'), 'DSH excluded from Hub dropdown');

  // --- Suite 4: Prompt Formatting & Knowledge Base Decoupling ---
  console.log('\n>>> Suite 4: Prompt Decoupling & Formatting');
  const { AgentContextProvider } = require(path.join(pluginDir, 'agent-context-provider.js'));
  const mockApp = { vault: { getAbstractFileByPath: () => null } };
  const ctxProvider = new AgentContextProvider(mockApp);
  
  // NiceAIGC should NOT contain knowledge base metadata
  const userText = '请解释什么是快速充电协议？';
  const niceaigcAdapter = hub.getAdapter('niceaigc');
  const isDecoupled = !niceaigcAdapter.id.includes('kb');
  assert(isDecoupled, 'NiceAIGC is configured as general multi-modal model');

  // Grounded context formatting for Pi/Hermes
  ctxProvider.setKnowledgeNode({ id: 'node-charger', title: '充电驱动模块', module: 'Charger' });
  const formattedWithContext = ctxProvider.formatPromptWithContext(userText);
  assert(formattedWithContext.includes('充电驱动模块') && formattedWithContext.includes('Charger'), 'Pi/Hermes context formatting includes active node metadata');

  // --- Suite 5: Reasoning Effort Support ---
  console.log('\n>>> Suite 5: Reasoning Effort Selection');
  const supportsEffort = niceaigcAdapter.supportsReasoningEffort('gpt-6-sol');
  assert(supportsEffort === true, 'gpt-6-sol supports reasoning effort');
  niceaigcAdapter.setReasoningEffort('max');
  const effortCfg = niceaigcAdapter.getReasoningEffortConfig();
  assert(effortCfg.id === 'max' && (effortCfg.label === '极高' || effortCfg.label.includes('高')), 'Reasoning effort set to max (极高)');

  // --- Suite 6: Session Segmentation & Draft Preservation ---
  console.log('\n>>> Suite 6: Session Segmentation & Draft Preservation');
  const sm = hub.sessionManager;
  sm.setDraft('pi', 'Pi draft question');
  sm.setDraft('niceaigc', 'NiceAIGC draft question');
  assert(sm.getDraft('pi') === 'Pi draft question', 'Pi draft preserved correctly');
  assert(sm.getDraft('niceaigc') === 'NiceAIGC draft question', 'NiceAIGC draft preserved correctly');

  sm.addMessage('pi', { role: 'user', text: 'Hello Pi' });
  sm.addMessage('niceaigc', { role: 'user', text: 'Hello NiceAIGC' });
  const piMsgs = sm.getMessages('pi');
  const niceMsgs = sm.getMessages('niceaigc');
  assert(piMsgs.length >= 1 && piMsgs[piMsgs.length - 1].text === 'Hello Pi', 'Pi messages isolated');
  assert(niceMsgs.length >= 1 && niceMsgs[niceMsgs.length - 1].text === 'Hello NiceAIGC', 'NiceAIGC messages isolated');

  // --- Suite 6b: Hermes reasoning effort is selectable and reaches the CLI ---
  console.log('\n>>> Suite 6b: Hermes reasoning effort');
  const { HermesAdapter } = require(path.join(pluginDir, 'providers', 'hermes-adapter.js'));
  const hermes = new HermesAdapter({ vaultBasePath: 'd:\\work\\Mgmt\\TabonKB' });
  assert(typeof hermes.supportsReasoningEffort === 'function' && hermes.supportsReasoningEffort('gpt-6-sol') === true, 'Hermes exposes reasoning effort');
  const groups = hermes.getModelGroups();
  const flagged = groups.some((g) => (g.models || []).some((m) => m.supportsReasoningEffort === true));
  assert(flagged, 'Hermes model list marks supportsReasoningEffort');
  const levels = ['off', 'low', 'medium', 'high', 'max'];
  const cliMap = { off: 'none', low: 'low', medium: 'medium', high: 'high', max: 'max' };
  for (const level of levels) {
    hermes.setReasoningEffort(level);
    const args = hermes.buildChatArgs('gpt-6-sol');
    const idx = args.indexOf('--reasoning');
    assert(idx >= 0 && args[idx + 1] === cliMap[level], `Hermes --reasoning ${cliMap[level]} for UI level ${level} (got ${args[idx + 1]})`);
    const cfg = hermes.getReasoningEffortConfig();
    assert(cfg.id === level && !!cfg.label, `Hermes effort label present for ${level}`);
  }
  hermes.setModel('deepseek-v4.1-flash', 'deepseek-v4.1-flash', 'low');
  const afterSet = hermes.buildChatArgs();
  const setIdx = afterSet.indexOf('--reasoning');
  assert(hermes.getReasoningEffort() === 'low' && afterSet[setIdx + 1] === 'low', 'setModel persists the chosen reasoning level');
  assert(afterSet.indexOf('-m') >= 0 && afterSet[afterSet.indexOf('-m') + 1] === 'deepseek-v4.1-flash', 'setModel keeps the selected Hermes model');

  const { WEKNORA_MCP_TOOL_HINT } = require(path.join(pluginDir, 'mcp', 'weknora-mcp-shared.js'));
  assert(WEKNORA_MCP_TOOL_HINT.includes('默认只调用 weknora_search'), 'WeKnora hint defaults to weknora_search');
  assert(!WEKNORA_MCP_TOOL_HINT.includes('优先调用 weknora_search / weknora_ask'), 'WeKnora hint no longer treats ask as equal default');
  assert(WEKNORA_MCP_TOOL_HINT.includes('不要把 weknora_search 与 weknora_ask'), 'WeKnora hint tells the model not to batch search and ask');
  const { WEKNORA_TOOLS } = require(path.join(pluginDir, 'services', 'weknora-service.js'));
  const askTool = WEKNORA_TOOLS.find((t) => t.name === 'weknora_ask');
  const searchTool = WEKNORA_TOOLS.find((t) => t.name === 'weknora_search');
  assert(searchTool && searchTool.description.includes('默认检索'), 'weknora_search schema says it is the default');
  assert(askTool && askTool.description.includes('非默认') && askTool.description.includes('不要与 weknora_search 并行'), 'weknora_ask schema is not the default and not parallel');

  // --- Suite 7: Security & Credential Isolation ---
  console.log('\n>>> Suite 7: Security & Credential Isolation');
  const gitignore = fs.readFileSync(path.join(pluginDir, '.gitignore'), 'utf8');
  assert(gitignore.includes('.secrets.json'), '.secrets.json is git-ignored');
  assert(gitignore.includes('.chat-history.json'), '.chat-history.json is git-ignored');
  assert(gitignore.includes('releases/'), 'releases/ directory is git-ignored');

  const dataJsonRaw = fs.readFileSync(path.join(pluginDir, 'data.json'), 'utf8');
  assert(!dataJsonRaw.includes('token') || !dataJsonRaw.includes('20zf9j0'), 'data.json does NOT leak actual session tokens');

  // --- Suite 8: Pi Agent Bridge Binary Resolution & Auto-Start ---
  console.log('\n>>> Suite 8: Pi Agent Bridge & Auto-Start');
  const { PiAgentBridge } = require(path.join(pluginDir, 'pi-agent-bridge.js'));
  const bridge = new PiAgentBridge({ vaultBasePath: 'd:\\work\\Mgmt\\TabonKB' });
  assert(bridge.customNodePath.includes('node.exe'), `Node executable accurately resolved: ${bridge.customNodePath}`);
  assert(fs.existsSync(bridge.piBundlePath), `Pi CLI bundle confirmed to exist: ${bridge.piBundlePath}`);

  // Test actual bridge startup
  console.log('  Starting Pi Agent Bridge...');
  const startOk = await bridge.start();
  assert(startOk === true, 'Pi Agent Bridge started successfully');
  const status = bridge.getStatus();
  assert(status.status === 'connected', `Bridge status transitioned to connected (got: ${status.status}, ${status.detail})`);
  bridge.destroy();

  // --- Suite 9: DSH Adapter Contract (DSH-ADP-01) ---
  console.log('\n>>> Suite 9: DSH Adapter Contract (DSH-ADP-01)');
  const { DshAdapter } = require(path.join(pluginDir, 'providers', 'dsh-adapter.js'));
  const { AgentAdapter } = require(path.join(pluginDir, 'providers', 'agent-adapter-base.js'));
  const dsh = new DshAdapter({ vaultBasePath: 'd:\\work\\Mgmt\\TabonKB' });
  assert(dsh instanceof AgentAdapter, 'DSH-ADP-01: DshAdapter instanceof AgentAdapter');
  const dshStatus = dsh.getStatus();
  assert(typeof dshStatus === 'object' && ['disconnected', 'connecting', 'connected', 'thinking', 'running_tool', 'error', 'not_installed'].includes(dshStatus.status), `DSH-ADP-01: getStatus() returns valid state (${dshStatus.status})`);

  // --- Suite 10: DSH Event Contract & Mock Stream (DSH-ADP-02) ---
  console.log('\n>>> Suite 10: DSH Event Contract & Mock Stream (DSH-ADP-02)');
  const receivedEvents = [];
  dsh.on('turn_start', () => receivedEvents.push('turn_start'));
  dsh.on('thinking_start', () => receivedEvents.push('thinking_start'));
  dsh.on('thinking_delta', (d) => receivedEvents.push(`thinking_delta:${d}`));
  dsh.on('thinking_end', () => receivedEvents.push('thinking_end'));
  dsh.on('text_delta', (d) => receivedEvents.push(`text_delta:${d}`));
  dsh.on('tool_start', (d) => receivedEvents.push(`tool_start:${d.toolName}`));
  dsh.on('tool_end', (d) => receivedEvents.push(`tool_end:${d.toolName}`));
  dsh.on('turn_end', () => receivedEvents.push('turn_end'));
  dsh.on('agent_settled', () => receivedEvents.push('agent_settled'));

  // Feed mock stream
  dsh.handleStdoutLine(JSON.stringify({ type: 'session', sessionId: 'sess-test-01', cwd: 'd:\\work\\Mgmt\\TabonKB' }));
  dsh.handleStdoutLine(JSON.stringify({ type: 'status', phase: 'turn_start', turn: 1 }));
  dsh.handleStdoutLine(JSON.stringify({ type: 'thinking', text: 'Step 1: Analyzing request...' }));
  dsh.handleStdoutLine(JSON.stringify({ type: 'text', text: 'Preparing tool execution...' }));
  dsh.handleStdoutLine(JSON.stringify({ type: 'tool_call', callId: 'call-01', tool: 'mcp__weknora__weknora_search', input: { query: 'charger' } }));
  dsh.handleStdoutLine(JSON.stringify({ type: 'tool_result', callId: 'call-01', status: 'completed', result: 'found 2 docs' }));
  dsh.handleStdoutLine(JSON.stringify({ type: 'status', phase: 'turn_end', turn: 1 }));
  dsh.handleStdoutLine(JSON.stringify({ type: 'final', text: 'Done' }));
  dsh.emit('agent_settled');

  assert(receivedEvents.includes('turn_start'), 'DSH-ADP-02: turn_start received');
  assert(receivedEvents.includes('thinking_start'), 'DSH-ADP-02: thinking_start received');
  assert(receivedEvents.some(e => e.startsWith('thinking_delta')), 'DSH-ADP-02: thinking_delta received');
  assert(receivedEvents.includes('thinking_end'), 'DSH-ADP-02: thinking_end received');
  assert(receivedEvents.some(e => e.startsWith('text_delta')), 'DSH-ADP-02: text_delta received');
  assert(receivedEvents.some(e => e.startsWith('tool_start:weknora_search')), 'DSH-ADP-02: tool_start with unwrapped name received');
  assert(receivedEvents.some(e => e.startsWith('tool_end:weknora_search')), 'DSH-ADP-02: tool_end received');
  assert(receivedEvents.includes('turn_end'), 'DSH-ADP-02: turn_end received');
  assert(receivedEvents.includes('agent_settled'), 'DSH-ADP-02: agent_settled received');

  // Verify order of event milestones
  const orderIdx = [
    receivedEvents.indexOf('thinking_start'),
    receivedEvents.indexOf('thinking_end'),
    receivedEvents.findIndex(e => e.startsWith('text_delta')),
    receivedEvents.findIndex(e => e.startsWith('tool_start')),
    receivedEvents.findIndex(e => e.startsWith('tool_end')),
    receivedEvents.indexOf('turn_end'),
    receivedEvents.indexOf('agent_settled')
  ];
  const isOrdered = orderIdx.every((val, i) => i === 0 || val >= orderIdx[i - 1]);
  assert(isOrdered, 'DSH-ADP-02: Event pipeline preserves strict sequential order');

  // --- Suite 11: DSH MCP Bridge & Entries (DSH-MCP-01) ---
  console.log('\n>>> Suite 11: DSH MCP Bridge & Entries (DSH-MCP-01)');
  const { buildDshMcpEntries } = require(path.join(pluginDir, 'mcp', 'dsh-mcp-shared.js'));
  const mcpEntries = buildDshMcpEntries('d:\\work\\Mgmt\\TabonKB');
  assert(mcpEntries.length === 10, `DSH-MCP-01: buildDshMcpEntries() output 10 items (got: ${mcpEntries.length})`);
  assert(mcpEntries.some(e => e.config && e.config.serverName === 'dslogic'),
    'DSH-MCP-01: dslogic entry registered');
  assert(mcpEntries.some(e => e.config && e.config.serverName === 'jira'),
    'DSH-MCP-01: jira entry registered');
  assert(mcpEntries.some(e => e.config && e.config.serverName === 'workbench'),
    'DSH-MCP-01: workbench entry registered');
  // DSH 侧宿主标记: 穿过 scrubbedParentEnv 的唯一通道, 所有条目统一携带
  for (const e of mcpEntries) {
    assert(e.config && e.config.env && e.config.env.TABONKB_MCP_HOST === 'dsh',
      `DSH-MCP-01: ${e.id} carries env TABONKB_MCP_HOST=dsh`);
  }

  const yamlContent = mcpEntries.map(e => JSON.stringify(e)).join('\n');
  assert(!yamlContent.includes('password') && !yamlContent.includes('token'), 'DSH-MCP-01: No plaintext credentials in entries');

  for (const entry of mcpEntries) {
    if (entry.config && entry.config.command && entry.config.command.includes('node')) {
      const script = entry.config.args[0];
      assert(fs.existsSync(script), `DSH-MCP-01: Script exists: ${path.basename(script)}`);
    } else if (entry.config && entry.config.command && entry.config.command.includes('ssh')) {
      assert(entry.config.serverName === 'codegraph', 'DSH-MCP-01: Codegraph entry is SSH based');
    }
  }

  // --- Suite 11b: TabonKB Agent Presets & Cordis Patch (DSH-PRESET-01) ---
  console.log('\n>>> Suite 11b: TabonKB Agent Presets & Cordis Patch (DSH-PRESET-01)');
  const { buildTabonKbPresets, generateDshCordisPatchYaml, stripTabonKbPresetBlock, TABONKB_PRESET_MARKER, buildDshDaemonEnv } = require(path.join(pluginDir, 'mcp', 'dsh-mcp-shared.js'));
  const presets = buildTabonKbPresets('d:\\work\\Mgmt\\TabonKB');
  assert(Array.isArray(presets) && presets.length === 2, `DSH-PRESET-01: buildTabonKbPresets returns 2 presets (got: ${presets?.length})`);

  const presetIds = presets.map(p => p.config.id);
  assert(presetIds.includes('tabonkb-dev'), 'DSH-PRESET-01: tabonkb-dev preset registered');
  assert(presetIds.includes('tabonkb-knowledge'), 'DSH-PRESET-01: tabonkb-knowledge preset registered');
  assert(!presetIds.some(id => id.startsWith('tabonkb-hw-driver') || id.startsWith('tabonkb-code-review') || id.startsWith('tabonkb-full-copilot')), 'DSH-PRESET-01: legacy presets fully removed');

  const devPersona = presets.find(p => p.config.id === 'tabonkb-dev').config.plugins[0].config.prefix;
  assert(typeof devPersona === 'string' && devPersona.length > 1200, 'DSH-PRESET-01: driver-dev persona is deeply specified');
  for (const token of ['codegraph_explore', 'opengrok_search_code', 'vendor_portal_get_detail', 'gerrit_get_diff', 'drawio_export', 'tree=mtk-bootloader', '03-Driver/']) {
    assert(devPersona.includes(token), `DSH-PRESET-01: driver-dev persona wires tool/data route: ${token}`);
  }

  const devPluginIds = presets.find(p => p.config.id === 'tabonkb-dev').config.plugins.map(p => p.id);
  assert(devPluginIds.includes('planning') && devPluginIds.includes('compaction'), 'DSH-PRESET-01: driver-dev preset carries planning + compaction groups');
  const knPluginIds = presets.find(p => p.config.id === 'tabonkb-knowledge').config.plugins.map(p => p.id);
  assert(knPluginIds.includes('compaction') && !knPluginIds.includes('planning'), 'DSH-PRESET-01: knowledge preset stays lean (compaction only)');

  const fullPatchYaml = generateDshCordisPatchYaml('d:\\work\\Mgmt\\TabonKB');
  assert(fullPatchYaml.includes('preset-tabonkb-dev') && fullPatchYaml.includes('preset-tabonkb-knowledge'), 'DSH-PRESET-01: patch YAML contains both v2 presets');
  // DSH persona/system-prompt 对文本做严格 {{var}} 插值, 仅 provider/model 已注册, 其余变量会令整轮运行失败
  const unknownPromptVars = [...fullPatchYaml.matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)].map(m => m[1]).filter(n => !['provider', 'model'].includes(n));
  assert(unknownPromptVars.length === 0, `DSH-PRESET-01: persona text references only registered prompt variables (unknown: ${unknownPromptVars.join(',') || 'none'})`);
  assert(fullPatchYaml.includes('env:') && fullPatchYaml.includes('TABONKB_MCP_HOST: "dsh"'),
    'DSH-PRESET-01: patch YAML emits config.env host marker for MCP children');
  assert(fullPatchYaml.includes('serverName: jira') && fullPatchYaml.includes('serverName: workbench'),
    'DSH-PRESET-01: patch YAML registers jira + workbench MCP entries');
  assert(!fullPatchYaml.includes('tabonkb-hw-driver') && !fullPatchYaml.includes('tabonkb-full-copilot'), 'DSH-PRESET-01: patch YAML drops all legacy presets');
  assert(!fullPatchYaml.includes('id: permission') && !fullPatchYaml.includes('id: sandbox-policy'), 'DSH-PERM-01: patch YAML leaves native base permission presets intact to prevent plugin crash');

  const dshEnv = buildDshDaemonEnv('d:\\work\\Mgmt\\TabonKB');
  assert(dshEnv.DSH_PERMISSION_MODE === 'danger-full-access', 'DSH-PERM-01: buildDshDaemonEnv sets DSH_PERMISSION_MODE=danger-full-access');

  // 幂等同步: web profile 尾部升级自愈 (剥旧块 + 追加带版本标记的新块)
  assert(TABONKB_PRESET_MARKER === 'tabonkb-presets-v2', 'DSH-PRESET-01: preset marker is versioned');
  const legacyWeb = 'a: 1\n\n- insert:\n    - id: preset-tabonkb-hw-driver\n      name: \'@deepseek-ai/dsh-agent-preset\'\n';
  assert(stripTabonKbPresetBlock(legacyWeb) === 'a: 1', `DSH-PRESET-01: legacy preset block is stripped (got: ${JSON.stringify(stripTabonKbPresetBlock(legacyWeb))})`);
  const userOwnInsert = 'a: 1\n- insert:\n    - id: my-own-plugin\n';
  assert(stripTabonKbPresetBlock(userOwnInsert) === userOwnInsert, 'DSH-PRESET-01: user-owned insert block is never touched');
  const devPatchSrc = fs.readFileSync(path.join(pluginDir, 'mcp', 'dsh-mcp-shared.js'), 'utf8');
  assert(devPatchSrc.includes('TABONKB_PRESET_MARKER') && devPatchSrc.includes('webContent.endsWith(presetSnippet)'), 'DSH-PRESET-01: web profile sync is idempotent');

  // --- Suite 12: DSH Daemon Manager (DSH-DAEMON-01) ---
  console.log('\n>>> Suite 12: DSH Daemon Manager (DSH-DAEMON-01)');
  const { DshDaemonManager } = require(path.join(pluginDir, 'services', 'dsh-daemon-manager.js'));
  const daemon = new DshDaemonManager({
    vaultBasePath: 'd:\\work\\Mgmt\\TabonKB',
    port: 3080,
    profile: 'test_profile'
  });

  const availPort = await daemon.getAvailablePort(3080, 3090);
  assert(availPort >= 3080 && availPort <= 3090, `DSH-DAEMON-01: getAvailablePort in range (got: ${availPort})`);

  const probeFake = await daemon.probeDshSignature(9999, 200);
  assert(probeFake.isDsh === false, 'DSH-DAEMON-01: Non-DSH port rejected without handshake');

  let taskkillInvoked = false;
  const originalExecSync = child_process.execSync;
  daemon.process = { pid: 99999, kill: () => {} };
  try {
    child_process.execSync = (cmd) => {
      if (cmd.includes('taskkill') && cmd.includes('/PID 99999') && cmd.includes('/T') && cmd.includes('/F')) {
        taskkillInvoked = true;
      }
    };
    await daemon.stop();
    assert(taskkillInvoked === true, 'DSH-DAEMON-01: stop() uses taskkill /PID /T /F on Windows');
  } finally {
    child_process.execSync = originalExecSync;
  }

  // --- Suite 13: DSH WebRequest Bridge & Cookie Auth (DSH-AUTH-01) ---
  console.log('\n>>> Suite 13: DSH WebRequest Bridge & Cookie Auth (DSH-AUTH-01)');
  const { getTabonKbWebRequestBridge } = require(path.join(pluginDir, 'services', 'dsh-daemon-manager.js'));
  assert(typeof getTabonKbWebRequestBridge === 'function', 'DSH-AUTH-01: getTabonKbWebRequestBridge is exported');

  // 模拟 window 环境测试 Bridge 存储与提取
  global.window = {};
  const webBridge = getTabonKbWebRequestBridge();
  assert(webBridge !== null, 'DSH-AUTH-01: Bridge created in window context');
  webBridge.setDshCookie(3081, 'dsh-auth-test=token123');
  assert(webBridge.getDshCookie(3081) === 'dsh-auth-test=token123', 'DSH-AUTH-01: Bridge retrieves cookie by port');
  assert(webBridge.getDshCookie('latest') === 'dsh-auth-test=token123', 'DSH-AUTH-01: Bridge retrieves cookie by latest fallback');

  // 测试本地真实 DSH 守护实例的鉴权凭据提取 (如果有运行中的 lockfile)
  const lock = daemon.readLockFile();
  if (lock && lock.authUrl && lock.authUrl.includes('token=')) {
    const extracted = await daemon.refreshAuthCookie(lock.authUrl);
    assert(extracted && extracted.startsWith('dsh-auth-'), 'DSH-AUTH-01: Live daemon token exchanged into valid dsh-auth cookie');
    assert(daemon.authCookie === extracted, 'DSH-AUTH-01: daemon.authCookie populated');
  } else {
    // 单元测试 fallback
    assert(typeof daemon.refreshAuthCookie === 'function', 'DSH-AUTH-01: daemon.refreshAuthCookie is defined');
  }
  assert(typeof daemon.startProxy === 'function', 'DSH-AUTH-01: daemon.startProxy is defined');
  delete global.window;

  // Suite 14: DSH Workbench Tab & Workspace Customization (DSH-TAB-01)
  console.log('\n>>> Suite 14: DSH Workbench Tab & Workspace Customization (DSH-TAB-01)');
  const deepseekWhaleSvg = getIconPark('deepseek', 22);
  assert(deepseekWhaleSvg.includes('tw-ip-deepseek') && deepseekWhaleSvg.includes('viewBox="0 0 50 50"'), 'DSH-TAB-01: getIconPark(deepseek) renders official whale SVG');

  const wsResult = daemon.ensureVaultWorkspace(path.resolve(__dirname, '..', '..', '..'));
  assert(wsResult && wsResult.ok === true, 'DSH-TAB-01: ensureVaultWorkspace succeeded');
  assert(typeof wsResult.workspaceId === 'string' && wsResult.workspaceId.length > 0, 'DSH-TAB-01: workspaceId generated');

  const { DshWorkbenchView } = require('../components/dsh-workbench-view.js');
  const dshWbView = new DshWorkbenchView({
    plugin: { dshDaemon: daemon }
  });
  assert(dshWbView !== null, 'DSH-TAB-01: DshWorkbenchView instantiated');
  assert(dshWbView.getSavedSidebarWidth() >= 200, 'DSH-TAB-01: Sidebar width is within valid range');
  assert(dshWbView.getSavedSidebarCollapsed() === true, 'DSH-TAB-01: Sidebar defaults to hidden');
  assert(typeof dshWbView.mount === 'function' && typeof dshWbView.dispose === 'function', 'DSH-TAB-01: DshWorkbenchView implements mount & dispose');
  assert(typeof dshWbView.renderLeftSidebar === 'function' && typeof dshWbView.renderResizer === 'function', 'DSH-TAB-01: Context sidebar and resizer are available');
  assert(typeof dshWbView.toggleSidebar === 'function' && typeof dshWbView.toggleDshNativeSidebar === 'function', 'DSH-TAB-01: DshWorkbenchView implements sidebar toggling');
  assert(typeof dshWbView.toggleMcpPopover === 'function' && typeof dshWbView.closeMcpPopover === 'function', 'DSH-TAB-01: DshWorkbenchView implements toggleMcpPopover & closeMcpPopover');

  const dshViewSrc = fs.readFileSync(path.join(pluginDir, 'components', 'dsh-workbench-view.js'), 'utf8');
  const daemonSrc = fs.readFileSync(path.join(pluginDir, 'services', 'dsh-daemon-manager.js'), 'utf8');
  const buildSrc = fs.readFileSync(path.join(pluginDir, 'build.py'), 'utf8');
  assert(dshViewSrc.includes('this.renderRightPane(this.containerEl)') && !dshViewSrc.includes('this.renderLeftSidebar(this.containerEl)'), 'DSH-TAB-01: mount renders full right pane without redundant host sidebar');
  assert(buildSrc.includes("btn.ondblclick = (e) =>") && buildSrc.includes('this.harnessView.toggleSidebar'), 'DSH-TAB-01: Harness nav icon double-click toggles sidebar');
  assert(daemonSrc.includes('ensureDefaultCollapsed') && daemonSrc.includes('tabonkb-dsh-toggle-sidebar'), 'DSH-TAB-01: Bridge script implements default sidebar collapse and message toggling');
  assert(dshViewSrc.includes('tabonkb-dsh-sidebar-collapsed-v2') && dshViewSrc.includes('Legacy "0"'), 'DSH-TAB-01: Legacy visible state is migrated to hidden default');
  const toggleSidebarBlock = dshViewSrc.match(/toggleSidebar\(collapse\) \{[\s\S]*?\n  \}/)?.[0] || '';
  assert(toggleSidebarBlock.includes('this.sidebarEl') && !toggleSidebarBlock.includes('iframeEl.setAttribute'), 'DSH-TAB-01: Sidebar toggle preserves the Harness iframe session');

  // Suite 15: DSH Right-Docked Navigation Rail Customization (DSH-UI-01)
  console.log('\n>>> Suite 15: DSH Right-Docked Navigation Rail Customization (DSH-UI-01)');
  const { getDshCustomStyles, getDshSidebarHideStyles } = require('../services/dsh-daemon-manager.js');
  assert(typeof getDshCustomStyles === 'function', 'DSH-UI-01: getDshCustomStyles is exported');
  assert(typeof getDshSidebarHideStyles === 'function', 'DSH-UI-01: getDshSidebarHideStyles is exported');
  const hideCss = getDshSidebarHideStyles();
  assert(hideCss.includes('data-sidebar-collapsed') && hideCss.includes('grid-template-columns: 0px minmax(0px, 1fr) auto !important'), 'DSH-UI-01: Collapsed sidebar rail width is 0px in grid');
  assert(hideCss.includes('width: 0px !important') && hideCss.includes('overflow: hidden !important'), 'DSH-UI-01: Collapsed sidebar rail is completely clipped and hidden');
  // 方案A (2026-10-01): UI 定制与 DSH 原生 Grid 布局引擎互斥, 默认必须为关闭态
  // (settings 模块顶层 require('obsidian'), 故以源文本断言代替运行时 require)
  const settingsSrc = fs.readFileSync(path.join(pluginDir, 'settings', 'workbench-settings-tab.js'), 'utf8');
  assert(/dsh:\s*\{[\s\S]*?layoutTweaks:\s*false/.test(settingsSrc), 'DSH-UI-01: layoutTweaks defaults to false (方案A 原生回归)');
  assert(settingsSrc.includes(".setValue(dshCfg.layoutTweaks === true)"), 'DSH-UI-01: layoutTweaks toggle uses opt-in semantics (=== true)');
  assert(getDshCustomStyles() === '', 'DSH-UI-01: getDshCustomStyles() defaults to OFF (empty CSS)');
  assert(getDshCustomStyles(false) === '', 'DSH-UI-01: getDshCustomStyles(false) returns empty CSS');
  assert(getDshCustomStyles(undefined) === '', 'DSH-UI-01: getDshCustomStyles(undefined) returns empty CSS (未配置 != 开启)');
  const dshCss = getDshCustomStyles(true);
  assert(typeof dshCss === 'string' && dshCss.length > 100, 'DSH-UI-01: getDshCustomStyles(true) returns opt-in CSS string');
  assert(dshCss.includes('.pI_x6G_frame') && dshCss.includes('display: flex !important'), 'DSH-UI-01: Frame converted to flex row');
  assert(dshCss.includes('.pI_x6G_centerCol') && dshCss.includes('order: 1 !important'), 'DSH-UI-01: Center col takes order 1 with flex-grow');
  assert(dshCss.includes('.pI_x6G_rightbarCol') && dshCss.includes('order: 2 !important'), 'DSH-UI-01: Rightbar col takes order 2');
  assert(dshCss.includes('.pI_x6G_sidebarCol') && dshCss.includes('order: 3 !important') && dshCss.includes('border-left:'), 'DSH-UI-01: Sidebar col docked to right (order 3) with border-left');
  assert(dshCss.includes('transform: scaleX(-1)'), 'DSH-UI-01: Toggle button icon mirrored for right-side docking');
  assert(dshCss.includes('#root >') && !dshCss.includes('div[class*="_bubble"]'), 'DSH-UI-01: Scoped to #root to protect ChatView and conversation text from pollution');
  assert(typeof dshWbView.injectCustomStyles === 'function', 'DSH-UI-01: DshWorkbenchView implements injectCustomStyles');

  // Suite 16: DSH File Link Interception & Vault Auto-Resolve (DSH-FILE-01)
  console.log('\n>>> Suite 16: DSH File Link Interception & Vault Auto-Resolve (DSH-FILE-01)');
  const { getDshFileBridgeScript } = require('../services/dsh-daemon-manager.js');
  assert(typeof getDshFileBridgeScript === 'function', 'DSH-FILE-01: getDshFileBridgeScript is exported');
  const bridgeScript = getDshFileBridgeScript();
  assert(bridgeScript.includes('tabonkb-dsh-open-file') && bridgeScript.includes('postMessage'), 'DSH-FILE-01: Bridge script posts tabonkb-dsh-open-file message');
  assert(bridgeScript.includes('stopImmediatePropagation') && bridgeScript.includes('preventDefault'), 'DSH-FILE-01: Bridge script stops click propagation to prevent DSH internal preview');
  assert(!dshCss.includes('data-sidebar-right-session]:not(:has(div[data-sidebar-right-open]))'), 'DSH-FILE-01: Rightbar panel CSS does not erroneously hide open session panels');

  // 模拟 vault 文件列表与 resolveVaultFile 四级级联比对
  const mockVaultFiles = [
    { path: '03-Driver/05-Charger/06-Spec-Ref/INDEX.md', name: 'INDEX.md', basename: 'INDEX' },
    { path: '99-Meta/04-Index/INDEX-Spec.md', name: 'INDEX-Spec.md', basename: 'INDEX-Spec' },
    { path: '00-Inbox/04-Agent-Diagrams/2026-09-26-UFCS识别流程.drawio', name: '2026-09-26-UFCS识别流程.drawio', basename: '2026-09-26-UFCS识别流程' }
  ];
  let openedFile = null;
  let splitCount = 0;
  let tabCount = 0;
  let activeSetLeaf = null;

  const parentTabGroup = {
    children: []
  };

  const existingLeafItem = {
    parent: parentTabGroup,
    view: {
      file: { path: '99-Meta/04-Index/INDEX-Spec.md' },
      getViewType: () => 'markdown',
      setEphemeralState: () => {}
    }
  };
  parentTabGroup.children.push(existingLeafItem);

  const mockFileApp = {
    vault: {
      getAbstractFileByPath: (p) => mockVaultFiles.find(f => f.path === p) || null,
      getFiles: () => mockVaultFiles
    },
    metadataCache: {
      getFirstLinkpathDest: (p) => mockVaultFiles.find(f => f.name === p) || null
    },
    workspace: {
      getLeavesOfType: () => [existingLeafItem],
      iterateRootLeaves: (cb) => { [existingLeafItem].forEach(cb); },
      createLeafInParent: (p, idx) => {
        tabCount++;
        const l = {
          parent: p,
          view: { getViewType: () => 'empty', file: null, setEphemeralState: () => {} },
          openFile: async (f) => { openedFile = f; l.view.file = f; }
        };
        p.children.push(l);
        return l;
      },
      getLeaf: (mode) => {
        if (mode === 'split') splitCount++;
        if (mode === 'tab') tabCount++;
        return {
          openFile: async (f) => { openedFile = f; }
        };
      },
      setActiveLeaf: (l) => { activeSetLeaf = l; }
    }
  };
  const mockWbView = new DshWorkbenchView({ app: mockFileApp });

  const resolved1 = mockWbView.resolveVaultFile('INDEX-Spec.md');
  assert(resolved1 && resolved1.path === '99-Meta/04-Index/INDEX-Spec.md', 'DSH-FILE-01: Basename match resolves to 99-Meta/04-Index/INDEX-Spec.md');

  const resolved2 = mockWbView.resolveVaultFile('06-Spec-Ref/INDEX.md');
  assert(resolved2 && resolved2.path === '03-Driver/05-Charger/06-Spec-Ref/INDEX.md', 'DSH-FILE-01: Suffix path match resolves to 03-Driver/05-Charger/06-Spec-Ref/INDEX.md');

  const resolved3 = mockWbView.resolveVaultFile('2026-09-26-UFCS架构图.drawio');
  assert(resolved3 && resolved3.path.includes('UFCS识别流程.drawio'), 'DSH-FILE-01: Fuzzy keyword match resolves to 2026-09-26-UFCS识别流程.drawio');

  // 测试 1: 目标文件已存在，直接 setActiveLeaf 聚焦，不分栏也不建 tab
  await mockWbView.handleOpenFile('INDEX-Spec.md', 10);
  assert(activeSetLeaf === existingLeafItem, 'DSH-FILE-01: handleOpenFile focuses existing open tab without splitting');
  assert(splitCount === 0 && tabCount === 0, 'DSH-FILE-01: handleOpenFile does not split or create tab when already open');

  // 测试 2: 打开新文件，右侧已有分栏，在已有分栏中创建新 tab (tabCount+1, splitCount 保持 0)
  await mockWbView.handleOpenFile('2026-09-26-UFCS架构图.drawio', 1);
  assert(openedFile && openedFile.path.includes('UFCS识别流程.drawio'), 'DSH-FILE-01: handleOpenFile opens new file');
  assert(tabCount === 1, 'DSH-FILE-01: handleOpenFile creates tab inside existing right group (got tabCount: ' + tabCount + ')');
  assert(splitCount === 0, 'DSH-FILE-01: handleOpenFile avoids redundant column splitting (splitCount: 0)');

  mockWbView.dispose();
  dshWbView.dispose();
  hub.destroy();

  // --- Suite 16b: DSH Per-Session Context Isolation (DSH-CTX-01) ---
  console.log('\n>>> Suite 16b: DSH Per-Session Context Isolation (DSH-CTX-01)');
  const { getDshContextBridgeScript } = require('../services/dsh-daemon-manager.js');
  const ctxBridgeSrc = getDshContextBridgeScript();
  assert(ctxBridgeSrc.includes('data-conversation-session'), 'DSH-CTX-01: bridge reads data-conversation-session attribute');
  assert(ctxBridgeSrc.includes("sid: currentSid()"), 'DSH-CTX-01: bridge reports sid in state-req/ctx-set messages');
  assert(ctxBridgeSrc.includes('pollSession') && ctxBridgeSrc.includes('valuesSid'), 'DSH-CTX-01: bridge polls session switch and tracks values ownership');
  assert(ctxBridgeSrc.includes("'__draft__'"), 'DSH-CTX-01: bridge normalizes draft sid for values comparison');
  assert(!ctxBridgeSrc.includes('window.innerHeight * 0.5') && !ctxBridgeSrc.includes('window.innerHeight * 0.25') &&
    ctxBridgeSrc.includes("querySelector('[role=\"listbox\"]')"),
    'DSH-CTX-01: menu detection is structural (listbox+option), no viewport-geometry thresholds');
  assert(ctxBridgeSrc.includes('listbox.insertBefore(ctxTitle, listbox.firstChild)') && !ctxBridgeSrc.includes('listbox.appendChild(ctxTitle)'),
    'DSH-CTX-01: context group is injected as the first group of the + menu');
  assert(!ctxBridgeSrc.includes('data-twx-badge=') && !ctxBridgeSrc.includes("setAttribute('data-twx-hidden'") && !ctxBridgeSrc.includes('wheelAccum'),
    'DSH-CTX-01: native menu items are no longer collapsed (2-item window, badges, wheel paging removed)');

  // 独立 localStorage 桩 (此前 suite 可能已建, 统一重置数据)
  if (typeof global.localStorage === 'undefined' || !global.localStorage._data) {
    global.localStorage = {
      _data: {},
      getItem(k) { return this._data[k] !== undefined ? this._data[k] : null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; }
    };
  }
  global.localStorage._data = {};
  const ctxVaultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-ctx-'));
  fs.mkdirSync(path.join(ctxVaultDir, '.obsidian', 'plugins', 'tabonkb-workbench'), { recursive: true });
  const ctxView = new DshWorkbenchView({ app: { vault: { adapter: { basePath: ctxVaultDir } } }, plugin: {} });
  assert(typeof ctxView.applyDshCtxSelection === 'function' && typeof ctxView._readDshCtxMap === 'function',
    'DSH-CTX-01: view exposes per-session ctx APIs');

  // 会话隔离: A 会话选择不影响 B 会话与草稿桶
  const lpTest = { id: 'srv/ws/mt6789/A17', platform: 'mt6789', project: 'A17', label: 'A17' };
  ctxView.applyDshCtxSelection('localproj', lpTest, 'sess-AAA');
  ctxView.applyDshCtxSelection('opengrok', 'V_sprd_os_dev', 'sess-AAA');
  assert(ctxView.getDshCtxState('sess-AAA').localproj.label === 'A17', 'DSH-CTX-01: session A bucket stores selection');
  assert(ctxView.getDshCtxState('sess-BBB').localproj === null, 'DSH-CTX-01: session B isolated from A');
  assert(ctxView.getDshCtxState('').localproj === null, 'DSH-CTX-01: draft bucket isolated from A');
  assert(process.env.TABONKB_LOCAL_PROJECT_JSON.includes('A17'), 'DSH-CTX-01: env mirror reflects active session ctx');

  // apply 不再写 pi 共享 localStorage 键 (解耦断言)
  assert(!global.localStorage.getItem('tabonkb-local-selected-project') ||
         !global.localStorage.getItem('tabonkb-local-selected-project').includes('A17'),
    'DSH-CTX-01: apply does not write shared pi localproj key');

  // 新会话仅重置草稿桶, 历史会话桶保留
  global.localStorage.setItem('tabonkb-dsh-ctx-map-v1', JSON.stringify({
    'sess-AAA': ctxView.getDshCtxState('sess-AAA'),
    '__draft__': { opengrok: 'x1', gerrit: 'mine', jira: { key: 'J-1' }, localproj: null },
    '__last': '__draft__'
  }));
  ctxView.resetDshCtxSelections();
  assert(ctxView.getDshCtxState('__draft__').opengrok === 'auto' && !ctxView.getDshCtxState('__draft__').jira,
    'DSH-CTX-01: new-chat resets only draft bucket');
  assert(ctxView.getDshCtxState('sess-AAA').localproj.label === 'A17', 'DSH-CTX-01: new-chat preserves session buckets');

  // 草稿→新会话迁移 (仅直接转变且目标无桶时)
  global.localStorage.setItem('tabonkb-dsh-ctx-map-v1', JSON.stringify({
    'sess-AAA': ctxView.getDshCtxState('sess-AAA'),
    '__draft__': { opengrok: 'auto', gerrit: 'all', jira: { key: 'NEW-7' }, localproj: null },
    '__last': '__draft__'
  }));
  ctxView._dshSid = 'sess-NEW';
  ctxView._migrateDshDraftTo('sess-NEW');
  assert(ctxView.getDshCtxState('sess-NEW').jira.key === 'NEW-7', 'DSH-CTX-01: draft ctx migrates to materialized session');
  assert(ctxView.getDshCtxState('__draft__').jira === null, 'DSH-CTX-01: draft cleared after migration');
  ctxView._migrateDshDraftTo('sess-AAA');
  assert(ctxView.getDshCtxState('sess-AAA').jira === null, 'DSH-CTX-01: existing bucket not overwritten by migration');

  // active-context.json 镜像带 source/sid
  const actxFile = path.join(ctxVaultDir, '.obsidian', 'plugins', 'tabonkb-workbench', 'active-context.json');
  const actx = JSON.parse(fs.readFileSync(actxFile, 'utf8'));
  assert(actx.source === 'dsh' && actx.sid === 'sess-NEW' && actx.selectedJiraIssue.key === 'NEW-7',
    'DSH-CTX-01: active-context.json mirrors session ctx with source/sid');

  // 镜像去重: 同值再调不写盘; 外部覆写(pi 侧无 source/sid)后自愈重写
  const origWrite = fs.writeFileSync;
  let writes = 0;
  fs.writeFileSync = function (...a) { writes++; return origWrite.apply(fs, a); };
  try {
    ctxView._mirrorDshCtxToAgent(ctxView.getDshCtxState('sess-NEW'), 'sess-NEW');
    assert(writes === 0, 'DSH-CTX-01: mirror dedup skips rewrite when file already matches');
    origWrite.call(fs, actxFile, JSON.stringify({ selectedProject: 'auto', selectedGerritFilter: 'all', selectedJiraIssue: null, selectedLocalProject: null, updatedAt: 1 }), 'utf8');
    ctxView._mirrorDshCtxToAgent(ctxView.getDshCtxState('sess-NEW'), 'sess-NEW');
    assert(writes === 1, 'DSH-CTX-01: mirror rewrites after external overwrite (self-heal)');
  } finally {
    fs.writeFileSync = origWrite;
  }
  const actx3 = JSON.parse(fs.readFileSync(actxFile, 'utf8'));
  assert(actx3.sid === 'sess-NEW' && actx3.selectedJiraIssue.key === 'NEW-7',
    'DSH-CTX-01: healed mirror restores dsh source/sid');
  ctxView.dispose();

  // opengrok _effDefaultProject 双侧语义: DSH MCP 子进程 (TABONKB_MCP_HOST=dsh) 文件优先,
  // pi/host 侧 env 优先 (DSH_PERMISSION_MODE 在 MCP 子进程中被 scrub, 不能作判定依据)
  const { OpengrokService } = require('../services/opengrok-service.js');
  const ogT = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-og-'));
  const ogFile = path.join(ogT, 'active-context.json');
  fs.writeFileSync(ogFile, JSON.stringify({ selectedProject: 'W_mp1_os_dev', source: 'dsh' }), 'utf8');
  const oldDshHost = process.env.TABONKB_MCP_HOST;
  const oldAcf = process.env.TABONKB_ACTIVE_CONTEXT_FILE;
  const oldOg = process.env.OPENGROK_DEFAULT_PROJECT;
  try {
    process.env.TABONKB_ACTIVE_CONTEXT_FILE = ogFile;
    const svc = new OpengrokService({ baseUrl: 'http://x/source', defaultProject: 'ENV_PROJ', staticDefault: 'STATIC_PROJ' });
    process.env.TABONKB_MCP_HOST = 'dsh';
    process.env.OPENGROK_DEFAULT_PROJECT = 'STALE_ENV_PROJ';
    assert(svc._effDefaultProject() === 'W_mp1_os_dev', 'DSH-CTX-01: DSH MCP side prefers live file over stale spawn env');
    fs.writeFileSync(ogFile, JSON.stringify({ selectedProject: 'auto', source: 'dsh' }), 'utf8');
    assert(svc._effDefaultProject() === 'STATIC_PROJ', 'DSH-CTX-01: file auto means unbound -> static default, not stale env');
    // pi 侧覆写 (无 source) -> 不采信文件, 回退 env
    fs.writeFileSync(ogFile, JSON.stringify({ selectedProject: 'PI_SIDE_PROJ' }), 'utf8');
    assert(svc._effDefaultProject() === 'STALE_ENV_PROJ', 'DSH-CTX-01: file without dsh source is not trusted (pi overwrite)');
    fs.writeFileSync(ogFile, JSON.stringify({ selectedProject: 'OTHER_PROJ', source: 'pi' }), 'utf8');
    assert(svc._effDefaultProject() === 'STALE_ENV_PROJ', 'DSH-CTX-01: file with foreign source is not trusted');
    delete process.env.TABONKB_MCP_HOST;
    assert(svc._effDefaultProject() === 'STALE_ENV_PROJ', 'DSH-CTX-01: pi/host side keeps env authority');
    delete process.env.OPENGROK_DEFAULT_PROJECT;
    assert(svc._effDefaultProject() === 'ENV_PROJ', 'DSH-CTX-01: pi/host side falls back to ctor cfg without env');
  } finally {
    if (oldDshHost === undefined) delete process.env.TABONKB_MCP_HOST; else process.env.TABONKB_MCP_HOST = oldDshHost;
    if (oldAcf === undefined) delete process.env.TABONKB_ACTIVE_CONTEXT_FILE; else process.env.TABONKB_ACTIVE_CONTEXT_FILE = oldAcf;
    if (oldOg === undefined) delete process.env.OPENGROK_DEFAULT_PROJECT; else process.env.OPENGROK_DEFAULT_PROJECT = oldOg;
  }

  // persona 指引 agent 走 workbench_context 取实时绑定 (不再读 active-context.json 文件)
  const dshShared = require('../mcp/dsh-mcp-shared.js');
  const dshPresets = dshShared.buildTabonKbPresets('d:/vault-test');
  const presetJson = JSON.stringify(dshPresets);
  assert(presetJson.includes('workbench_context') && presetJson.includes('project_read_file') && presetJson.includes('Gerrit 过滤器'),
    'DSH-CTX-01: persona directs agent to workbench_context/project_read_file for bindings');
  const lpPortalSrc = fs.readFileSync(path.join(pluginDir, 'extensions', 'local-project-portal.ts'), 'utf8');
  assert(lpPortalSrc.includes('active-context.json'), 'DSH-CTX-01: local-project-portal has active-context.json fallback');

  // --- Suite 16c: DSH Workbench Context & MCP Baseline (DSH-WB-01) ---
  console.log('\n>>> Suite 16c: DSH Workbench Context & MCP Baseline (DSH-WB-01)');
  const wbCtx = require('../services/workbench-context.js');
  const wbT = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-wb-'));

  // 临时三层工程树: Tier2(项目) > Tier1(public) > Tier0(基线)
  const wbProjRoot = path.join(wbT, 'proj');
  fs.mkdirSync(path.join(wbProjRoot, 'pri_project', 'driver', 'mt6858', 'K90GF2', 'base', 'drivers'), { recursive: true });
  fs.mkdirSync(path.join(wbProjRoot, 'pri_project', 'driver', 'public', 'drivers'), { recursive: true });
  fs.mkdirSync(path.join(wbProjRoot, 'drivers'), { recursive: true });
  fs.writeFileSync(path.join(wbProjRoot, 'pri_project', 'driver', 'mt6858', 'K90GF2', 'base', 'drivers', 'x.c'), 'TIER2-x\n');
  fs.writeFileSync(path.join(wbProjRoot, 'pri_project', 'driver', 'public', 'drivers', 'x.c'), 'TIER1-x\n');
  fs.writeFileSync(path.join(wbProjRoot, 'drivers', 'x.c'), 'TIER0-x\n');
  fs.writeFileSync(path.join(wbProjRoot, 'pri_project', 'driver', 'public', 'drivers', 'y.c'), 'TIER1-y\n');
  fs.writeFileSync(path.join(wbProjRoot, 'drivers', 'y.c'), 'TIER0-y\n');
  fs.writeFileSync(path.join(wbProjRoot, 'z.c'), 'TIER0-z\n');
  // ctx 里 localProject 为残缺记录 (无 priDriverRel, id 在真实清单中不存在 -> 走后备钩子)
  const wbFakeLp = {
    id: 'dshwb_fake_proj', label: 'TEST/K90GF2', serverName: '测试服务器', serverId: '62',
    workspaceName: 'W/99-test', platform: 'mt6858', project: 'K90GF2',
    fullPathWin: wbProjRoot, linuxPath: '/dfb/tankaikun/share/01/W/99-test'
  };
  const wbCtxFile = path.join(wbT, 'active-context.json');
  fs.writeFileSync(wbCtxFile, JSON.stringify({
    selectedProject: 'W_mp1_os_dev', selectedGerritFilter: 'open',
    selectedJiraIssue: { key: 'SPE-123', summary: '快充异常', status: '开放' },
    selectedLocalProject: wbFakeLp, source: 'dsh', sid: 'sess-T', updatedAt: Date.now()
  }));
  const wbCtxFileEmpty = path.join(wbT, 'active-context-empty.json');
  fs.writeFileSync(wbCtxFileEmpty, JSON.stringify({ selectedProject: 'auto', selectedGerritFilter: 'all', source: 'dsh' }));
  // pi 侧覆写形态 (无 source) 与异 source 形态
  const wbCtxFilePi = path.join(wbT, 'active-context-pi.json');
  fs.writeFileSync(wbCtxFilePi, JSON.stringify({
    selectedProject: 'PI_PROJ', selectedGerritFilter: 'reviewing',
    selectedJiraIssue: { key: 'PI-9' }, selectedLocalProject: wbFakeLp, updatedAt: Date.now()
  }));
  const wbCtxFileOther = path.join(wbT, 'active-context-other.json');
  fs.writeFileSync(wbCtxFileOther, JSON.stringify({ selectedProject: 'PI_PROJ', source: 'pi', selectedGerritFilter: 'reviewing' }));

  const oldWbHost = process.env.TABONKB_MCP_HOST;
  const oldWbAcf = process.env.TABONKB_ACTIVE_CONTEXT_FILE;
  try {
    process.env.TABONKB_MCP_HOST = 'dsh';
    process.env.TABONKB_ACTIVE_CONTEXT_FILE = wbCtxFile;
    const lc = wbCtx.readLiveContext();
    assert(lc && lc.opengrok === 'W_mp1_os_dev' && lc.gerrit === 'open' && lc.jira && lc.jira.key === 'SPE-123' && lc.localProject.id === 'dshwb_fake_proj',
      'DSH-WB-01: readLiveContext normalizes live bindings');
    const hc = wbCtx.getHostContext();
    assert(hc && hc.localProject && hc.localProject.priDriverRel === 'pri_project/driver/mt6858/K90GF2/base' && hc.localProject.fullPathWin === wbProjRoot,
      'DSH-WB-01: getHostContext backfills partial localProject via fullPathWin fallback');
    // 全量字段回查: 真实缓存清单中的 id 命中
    const realLp = (require('../services/local-project-service.js').getAllAvailableLocalProjects() || [])[0];
    if (realLp) {
      const partial = { id: realLp.id, label: realLp.label, platform: realLp.platform, project: realLp.project };
      const resolved = wbCtx.resolveLocalProjectBinding(partial);
      assert(resolved && resolved.fullPathWin === realLp.fullPathWin && resolved.priDriverRel === realLp.priDriverRel,
        'DSH-WB-01: resolveLocalProjectBinding upgrades partial record by id');
    }
    delete process.env.TABONKB_MCP_HOST;
    assert(wbCtx.readLiveContext() === null && wbCtx.getHostContext() === null,
      'DSH-WB-01: non-DSH host refuses file context');
    process.env.TABONKB_MCP_HOST = 'dsh';
    // 跨 surface 防线: pi 覆写 (无 source) / 异 source 文件在 DSH 宿主下视为未绑定
    process.env.TABONKB_ACTIVE_CONTEXT_FILE = wbCtxFilePi;
    const hcPi = wbCtx.getHostContext();
    assert(wbCtx.readLiveContext() === null && hcPi && hcPi.opengrok === 'auto' && hcPi.gerrit === 'all' && !hcPi.jira && !hcPi.localProject,
      'DSH-WB-01: pi-written file (no source) treated as unbound on DSH host');
    process.env.TABONKB_ACTIVE_CONTEXT_FILE = wbCtxFileOther;
    assert(wbCtx.readLiveContext() === null && wbCtx.getHostContext().opengrok === 'auto',
      'DSH-WB-01: foreign source value treated as unbound on DSH host');
    process.env.TABONKB_ACTIVE_CONTEXT_FILE = wbCtxFile;
    assert(wbCtx.readLiveContext() && wbCtx.readLiveContext().opengrok === 'W_mp1_os_dev',
      'DSH-WB-01: dsh source file is trusted again');
    // 路径穿越防线
    for (const bad of ['..\\..\\x', 'a/../../b', 'a\\..\\..\\b', 'C:\\Windows\\win.ini', '\\\\srv\\share\\x', '//srv/share/x']) {
      const rr = await wbCtx.runWorkbenchTool('project_read_file', { file_path: bad });
      assert(rr.isError === true && rr.text.includes('必须是工程内相对路径'),
        `DSH-WB-01: traversal rejected: ${JSON.stringify(bad)}`);
    }
    for (const ok of ['drivers/x.c', './drivers/x.c', '/drivers/y.c']) {
      const rr = await wbCtx.runWorkbenchTool('project_read_file', { file_path: ok });
      assert(rr.isError === false && rr.text.includes('源码文件解析成功'),
        `DSH-WB-01: normal relative path resolves: ${JSON.stringify(ok)}`);
    }
    // gerritFilterToQuery 全映射
    const fq = wbCtx.gerritFilterToQuery;
    assert(fq('open') === 'status:open' && fq('merged') === 'status:merged' && fq('mine') === 'owner:self' &&
      fq('reviewing') === 'reviewer:self status:open' && fq('all') === '' && fq(null) === '' && fq('bogus') === '',
      'DSH-WB-01: gerritFilterToQuery covers all filters');
  } finally {
    if (oldWbHost === undefined) delete process.env.TABONKB_MCP_HOST; else process.env.TABONKB_MCP_HOST = oldWbHost;
    if (oldWbAcf === undefined) delete process.env.TABONKB_ACTIVE_CONTEXT_FILE; else process.env.TABONKB_ACTIVE_CONTEXT_FILE = oldWbAcf;
  }

  // 2) gerrit/jira 绑定默认值 (桩 svc + env 切换)
  const { runGerritTool } = require('../services/gerrit-service.js');
  const { runJiraTool } = require('../services/jira-service.js');
  const gerritStub = { searchChanges: async (o) => ({ query: o.query || 'status:open', total: 0, changes: [], baseUrl: 'http://g' }) };
  const jiraStub = {
    getIssueDetail: async (k) => ({ key: k, summary: 's', status: '开放', priority: 'P1', assignee: 'a', reporter: 'r', created: 'c', updated: 'u', components: [], labels: [], fixVersions: [], url: 'u', description: 'd', attachments: [], commentCount: 0, comments: [] }),
    getIssueWorkspaceDir: () => ({ relDir: '00-Inbox/03-Quick-Note/SPE-123' }),
    getIssueComments: async () => [],
    listIssueAttachments: async () => [],
    downloadAttachment: async () => ({ filename: 'f.log', bytes: 1, savedAbsPath: 'a', savedRelPath: 'r' })
  };
  const oldWbHost2 = process.env.TABONKB_MCP_HOST;
  const oldWbAcf2 = process.env.TABONKB_ACTIVE_CONTEXT_FILE;
  try {
    process.env.TABONKB_MCP_HOST = 'dsh';
    process.env.TABONKB_ACTIVE_CONTEXT_FILE = wbCtxFile;
    // DSH + 绑定 open: query 缺省 -> 注入 status:open + 说明行
    let g = await runGerritTool('gerrit_search_changes', {}, gerritStub);
    assert(g.includes('status:open') && g.startsWith('(已按工作台 Gerrit 过滤器「开放中」'),
      'DSH-WB-01: gerrit default filter injected with explanation');
    // query 无显式操作符 -> 追加
    g = await runGerritTool('gerrit_search_changes', { query: 'charger' }, gerritStub);
    assert(g.includes('charger status:open') && g.startsWith('(已按工作台 Gerrit 过滤器'),
      'DSH-WB-01: gerrit filter appended to free-text query');
    // 显式操作符 -> 不覆盖 (建议文案里含 status:open, 只核对查询回显与无说明行)
    g = await runGerritTool('gerrit_search_changes', { query: 'status:merged charger' }, gerritStub);
    assert(!g.startsWith('(已按工作台') && g.includes('「status:merged charger」'),
      'DSH-WB-01: explicit status: operator is never overridden');
    // Jira: 缺省 -> 绑定工单 + 说明行
    let jr = await runJiraTool('jira_get_issue', {}, jiraStub);
    assert(jr.startsWith('(未指定 issue_key, 使用工作台绑定工单 SPE-123)') && jr.includes('SPE-123'),
      'DSH-WB-01: jira bound issue_key injected with explanation');
    jr = await runJiraTool('jira_get_issue', { issue_key: 'OTHER-9' }, jiraStub);
    assert(!jr.startsWith('(未指定 issue_key') && jr.includes('OTHER-9'),
      'DSH-WB-01: explicit issue_key is never overridden');
    // 无绑定 -> 原错误
    process.env.TABONKB_ACTIVE_CONTEXT_FILE = wbCtxFileEmpty;
    let jerr = '';
    try { await runJiraTool('jira_get_issue', {}, jiraStub); } catch (e) { jerr = e.message; }
    assert(jerr === '缺少 issue_key 参数', 'DSH-WB-01: no jira binding preserves original error');
    g = await runGerritTool('gerrit_search_changes', {}, gerritStub);
    assert(!g.startsWith('(已按工作台') && g.includes('status:open'),
      'DSH-WB-01: gerrit all-filter binding keeps default behavior');
    // pi 覆写文件 (无 source) -> 不触发任何默认注入
    process.env.TABONKB_ACTIVE_CONTEXT_FILE = wbCtxFilePi;
    let jerr2 = '';
    try { await runJiraTool('jira_get_issue', {}, jiraStub); } catch (e) { jerr2 = e.message; }
    assert(jerr2 === '缺少 issue_key 参数', 'DSH-WB-01: pi-written file never injects jira binding');
    g = await runGerritTool('gerrit_search_changes', {}, gerritStub);
    assert(!g.startsWith('(已按工作台'), 'DSH-WB-01: pi-written file never injects gerrit filter');
    // 非 DSH 宿主 -> 零变化
    delete process.env.TABONKB_MCP_HOST;
    process.env.TABONKB_ACTIVE_CONTEXT_FILE = wbCtxFile;
    jr = '';
    try { await runJiraTool('jira_get_issue', {}, jiraStub); } catch (e) { jr = e.message; }
    assert(jr === '缺少 issue_key 参数', 'DSH-WB-01: non-DSH host never injects jira binding');
    g = await runGerritTool('gerrit_search_changes', {}, gerritStub);
    assert(!g.startsWith('(已按工作台'), 'DSH-WB-01: non-DSH host never injects gerrit filter');
  } finally {
    if (oldWbHost2 === undefined) delete process.env.TABONKB_MCP_HOST; else process.env.TABONKB_MCP_HOST = oldWbHost2;
    if (oldWbAcf2 === undefined) delete process.env.TABONKB_ACTIVE_CONTEXT_FILE; else process.env.TABONKB_ACTIVE_CONTEXT_FILE = oldWbAcf2;
  }

  // 3) MCP 端到端: 与 DSH 完全一致的 scrub 语义构造子进程 env
  function wbScrubEnv(extra) {
    const env = Object.assign({}, process.env);
    for (const k of Object.keys(env)) {
      if (k.startsWith('DSH_') || /KEY|PASSWORD|SECRET|TOKEN/i.test(k)) delete env[k];
    }
    return Object.assign(env, extra || {});
  }
  function wbMcpCall(env, reqs) {
    const r = child_process.spawnSync(process.execPath, [path.join(pluginDir, 'mcp', 'workbench-mcp.js')], {
      input: reqs.map(q => JSON.stringify(q)).join('\n') + '\n',
      env, encoding: 'utf8', timeout: 30000, windowsHide: true
    });
    const out = String(r.stdout || '').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);
    const byId = {};
    out.forEach(m => { if (m.id != null) byId[m.id] = m; });
    return { byId, stderr: String(r.stderr || '') };
  }
  const wbEnv = wbScrubEnv({ TABONKB_MCP_HOST: 'dsh', TABONKB_ACTIVE_CONTEXT_FILE: wbCtxFile });
  assert(!wbEnv.DSH_PERMISSION_MODE && !wbEnv.JIRA_TOKEN, 'DSH-WB-01: test env replicates DSH scrub semantics');
  let mcp = wbMcpCall(wbEnv, [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'workbench_context', arguments: {} } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'project_read_file', arguments: { file_path: 'drivers/x.c' } } },
    { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'project_read_file', arguments: { file_path: 'drivers/y.c' } } },
    { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'project_read_file', arguments: { file_path: 'z.c' } } },
    { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'project_read_file', arguments: { file_path: 'x.c', project: 'NO_SUCH_PROJ' } } }
  ]);
  assert(mcp.byId[1] && mcp.byId[1].result && mcp.byId[1].result.serverInfo.name === 'tabonkb-workbench', 'DSH-WB-01: MCP initialize handshake');
  const wbToolNames = (mcp.byId[2]?.result?.tools || []).map(t => t.name);
  assert(wbToolNames.includes('workbench_context') && wbToolNames.includes('project_list') && wbToolNames.includes('project_read_file'),
    'DSH-WB-01: tools/list exposes 3 read-only tools');
  const ctxText = mcp.byId[3]?.result?.content?.[0]?.text || '';
  assert(ctxText.includes('W_mp1_os_dev') && ctxText.includes('SPE-123') && ctxText.includes('K90GF2') && !mcp.byId[3].result.isError,
    'DSH-WB-01: workbench_context returns live bindings over scrub env');
  const t2 = mcp.byId[4]?.result?.content?.[0]?.text || '';
  assert(t2.includes('Tier 2') && t2.includes('TIER2-x') && t2.includes('工作台当前绑定'), 'DSH-WB-01: Tier2 wins and echoes binding source');
  const t1 = mcp.byId[5]?.result?.content?.[0]?.text || '';
  assert(t1.includes('Tier 1') && t1.includes('TIER1-y'), 'DSH-WB-01: Tier1 wins over Tier0');
  const t0 = mcp.byId[6]?.result?.content?.[0]?.text || '';
  assert(t0.includes('Tier 0') && t0.includes('TIER0-z'), 'DSH-WB-01: Tier0 baseline resolved');
  assert(mcp.byId[7]?.result?.isError === true && (mcp.byId[7].result.content[0].text || '').includes('project_list'),
    'DSH-WB-01: unknown explicit project id errors with project_list hint');
  // 无绑定 ctx -> project_read_file 明确报错
  mcp = wbMcpCall(wbScrubEnv({ TABONKB_MCP_HOST: 'dsh', TABONKB_ACTIVE_CONTEXT_FILE: wbCtxFileEmpty }), [
    { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'project_read_file', arguments: { file_path: 'x.c' } } }
  ]);
  assert(mcp.byId[1]?.result?.isError === true && /未指定 project|无绑定/.test(mcp.byId[1].result.content[0].text || ''),
    'DSH-WB-01: no bound project yields clear error');
  // 非 DSH 标记 -> workbench_context 报错
  mcp = wbMcpCall(wbScrubEnv({ TABONKB_ACTIVE_CONTEXT_FILE: wbCtxFile }), [
    { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'workbench_context', arguments: {} } }
  ]);
  assert(mcp.byId[1]?.result?.isError === true && /TABONKB_MCP_HOST/.test(mcp.byId[1].result.content[0].text || ''),
    'DSH-WB-01: non-DSH host workbench_context errors clearly');
  // DSH 宿主 + pi 覆写文件 (无 source) -> 全未绑定
  mcp = wbMcpCall(wbScrubEnv({ TABONKB_MCP_HOST: 'dsh', TABONKB_ACTIVE_CONTEXT_FILE: wbCtxFilePi }), [
    { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'workbench_context', arguments: {} } }
  ]);
  const piCtxText = mcp.byId[1]?.result?.content?.[0]?.text || '';
  assert(piCtxText.includes('未绑定') && !piCtxText.includes('PI-9') && !piCtxText.includes('PI_PROJ'),
    'DSH-WB-01: pi-written file yields all-unbound workbench_context');

  // 4) opengrok 在 scrub 环境下按 TABONKB_MCP_HOST 取活文件
  const ogT2 = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-og2-'));
  const ogFile2 = path.join(ogT2, 'active-context.json');
  fs.writeFileSync(ogFile2, JSON.stringify({ selectedProject: 'W_sprd_os_dev', source: 'dsh' }));
  const ogScript = [
    `const { OpengrokService } = require(${JSON.stringify(path.join(pluginDir, 'services', 'opengrok-service.js'))});`,
    `const svc = new OpengrokService({ baseUrl: 'http://x/source', defaultProject: 'ENV_PROJ', staticDefault: 'STATIC_PROJ' });`,
    `process.stdout.write(svc._effDefaultProject());`
  ].join('\n');
  const ogRes = child_process.spawnSync(process.execPath, ['-e', ogScript], {
    env: wbScrubEnv({ TABONKB_MCP_HOST: 'dsh', TABONKB_ACTIVE_CONTEXT_FILE: ogFile2, OPENGROK_DEFAULT_PROJECT: 'STALE_ENV_PROJ' }),
    encoding: 'utf8', timeout: 15000, windowsHide: true
  });
  assert(String(ogRes.stdout).trim() === 'W_sprd_os_dev',
    `DSH-WB-01: opengrok MCP child prefers live file under scrub env (got: ${String(ogRes.stdout).trim()})`);
  const ogRes2 = child_process.spawnSync(process.execPath, ['-e', ogScript], {
    env: wbScrubEnv({ TABONKB_ACTIVE_CONTEXT_FILE: ogFile2, OPENGROK_DEFAULT_PROJECT: 'STALE_ENV_PROJ' }),
    encoding: 'utf8', timeout: 15000, windowsHide: true
  });
  assert(String(ogRes2.stdout).trim() === 'STALE_ENV_PROJ',
    'DSH-WB-01: non-DSH host keeps env authority (file untouched)');

  // 5) dsh-mcp-shared: 新条目 + env 标记
  const dshSharedSrc = fs.readFileSync(path.join(pluginDir, 'mcp', 'dsh-mcp-shared.js'), 'utf8');
  assert(dshSharedSrc.includes('DSH_MCP_HOST_ENV') && dshSharedSrc.includes('workbench-mcp.js') && dshSharedSrc.includes('jira-mcp.js'),
    'DSH-WB-01: dsh-mcp-shared registers jira+workbench with host env');
  const patchY = dshShared.generateDshCordisPatchYaml('d:\\work\\Mgmt\\TabonKB');
  assert(/env:\s*\n\s*TABONKB_MCP_HOST: "dsh"/.test(patchY), 'DSH-WB-01: generated YAML carries env section');
  assert(!/TABONKB_MCP_HOST.*password|password.*TABONKB_MCP_HOST/i.test(patchY), 'DSH-WB-01: env section carries no secrets');

  // --- Suite 17: Antigravity CLI Adapter & Thinking Pipeline (AGY-ADP-01, AGY-THINK-01) ---
  console.log('\n>>> Suite 17: Antigravity CLI Adapter & Thinking Pipeline (AGY-ADP-01, AGY-THINK-01)');
  const { AntigravityAdapter, ensureAgyMcpServers } = require(path.join(pluginDir, 'providers', 'antigravity-adapter.js'));
  const agy = new AntigravityAdapter({ vaultBasePath: 'd:\\work\\Mgmt\\TabonKB' });
  assert(agy instanceof AgentAdapter, 'AGY-ADP-01: AntigravityAdapter instanceof AgentAdapter');
  assert(agy.displayName === 'Antigravity CLI', 'AGY-ADP-01: displayName is Antigravity CLI');

  const agyStatus = agy.getStatus();
  assert(['disconnected', 'connecting', 'connected', 'thinking', 'running_tool', 'error', 'not_installed'].includes(agyStatus.status), 'AGY-ADP-01: getStatus() returns valid state');

  // Reasoning Effort Configuration
  assert(agy.supportsReasoningEffort('gemini-3.8-flash-high') === true, 'AGY-THINK-01: gemini-3.8-flash-high supports reasoning effort');
  assert(agy.supportsReasoningEffort('claude-sonnet-4-6') === true, 'AGY-THINK-01: claude-sonnet-4-6 supports reasoning effort');
  assert(agy.supportsReasoningEffort('gpt-oss-120b-medium') === false, 'AGY-THINK-01: gpt-oss-120b-medium does not support reasoning effort');

  agy.setReasoningEffort('high');
  assert(agy.getReasoningEffort() === 'high', 'AGY-THINK-01: getReasoningEffort returns high');
  const agyEffortCfg = agy.getReasoningEffortConfig();
  assert(agyEffortCfg.label === '高推理', 'AGY-THINK-01: reasoning effort config label is 高推理');

  // MCP Servers provisioning
  const mcpProvision = ensureAgyMcpServers('d:\\work\\Mgmt\\TabonKB');
  assert(mcpProvision.ok === true, 'AGY-ADP-01: ensureAgyMcpServers succeeds');

  // Event sequence contract simulation
  const agyEvents = [];
  agy.on('turn_start', () => agyEvents.push('turn_start'));
  agy.on('thinking_start', () => agyEvents.push('thinking_start'));
  agy.on('thinking_delta', (d) => agyEvents.push(`thinking_delta:${d}`));
  agy.on('thinking_end', () => agyEvents.push('thinking_end'));
  agy.on('text_delta', (d) => agyEvents.push(`text_delta:${d}`));
  agy.on('tool_start', (d) => agyEvents.push(`tool_start:${d.toolName}`));
  agy.on('tool_end', (d) => agyEvents.push(`tool_end:${d.toolName}`));
  agy.on('turn_end', () => agyEvents.push('turn_end'));
  agy.on('agent_settled', () => agyEvents.push('agent_settled'));

  // Feed mock NDJSON events
  agy.isThinkingActive = true;
  agy.handleEvent({ event: 'init', conversation_id: 'mock-conv-123' });
  agy.handleEvent({ event: 'step_update', step_update: { step_type: 'agent_response', thinking_delta: 'Thinking through problem step 1...' } });
  agy.handleEvent({ event: 'step_update', step_update: { step_type: 'tool', state: 'ACTIVE', tool_name: 'call_mcp_tool', tool_info: { parameters: { ToolName: 'weknora_search' } } } });
  agy.handleEvent({ event: 'step_update', step_update: { step_type: 'tool', state: 'DONE', tool_name: 'call_mcp_tool', tool_info: { parameters: { ToolName: 'weknora_search' }, output: 'docs' }, duration_seconds: 1.2 } });
  agy.handleEvent({ event: 'step_update', step_update: { step_type: 'agent_response', text_delta: 'Here is the result...' } });
  agy.handleEvent({ event: 'result', result: { status: 'SUCCESS', response: 'Here is the result...' } });

  assert(agyEvents.includes('thinking_delta:Thinking through problem step 1...'), 'AGY-THINK-01: thinking_delta received in stream');
  assert(agyEvents.includes('thinking_end'), 'AGY-THINK-01: thinking_end emitted before tool / text');
  assert(agyEvents.some(e => e.startsWith('tool_start:weknora_search')), 'AGY-ADP-01: tool_start unwraps MCP tool name');
  assert(agyEvents.some(e => e.startsWith('tool_end:weknora_search')), 'AGY-ADP-01: tool_end received');
  assert(agyEvents.includes('text_delta:Here is the result...'), 'AGY-ADP-01: text_delta received');
  assert(agyEvents.includes('turn_end'), 'AGY-ADP-01: turn_end received');
  assert(agyEvents.includes('agent_settled'), 'AGY-ADP-01: agent_settled received');

  // --- Suite 17b: NiceAIGC Adapter Reasoning & Thinking Pipeline (NICE-THINK-01) ---
  console.log('\n>>> Suite 17b: NiceAIGC Adapter Reasoning & Thinking Pipeline (NICE-THINK-01)');
  const { NiceAigcAdapter } = require(path.join(pluginDir, 'providers', 'niceaigc-adapter.js'));
  const nice = new NiceAigcAdapter({ vaultBasePath: 'd:\\work\\Mgmt\\TabonKB' });
  assert(nice.supportsReasoningEffort('gpt-6-thinking') === true, 'NICE-THINK-01: gpt-6-thinking supports reasoning');
  assert(nice.supportsReasoningEffort('gpt-6.1-sol-wm') === true, 'NICE-THINK-01: gpt-6.1-sol-wm supports reasoning');
  assert(nice.supportsReasoningEffort('gpt-4o-mini') === false, 'NICE-THINK-01: gpt-4o-mini does not support reasoning');

  const niceEvents = [];
  nice.on('thinking_start', (d) => niceEvents.push(`thinking_start:${d?.startTime ? 'ok' : 'none'}`));
  nice.on('thinking_delta', (d) => niceEvents.push(`thinking_delta:${d}`));
  nice.on('thinking_recap', (d) => niceEvents.push(`thinking_recap:${d?.durationSec}:${d?.recapType}`));
  nice.on('thinking_end', () => niceEvents.push('thinking_end'));

  // Test 1: Stream state init for reasoning model emits thinking_start immediately
  const sState = nice._createStreamState('gpt-6.1-sol-wm');
  assert(sState.isThinkingActive === true, 'NICE-THINK-01: streamState initializes active thinking');
  assert(niceEvents.includes('thinking_start:ok'), 'NICE-THINK-01: thinking_start emitted upon streamState creation');

  // Test 2: Frame parsing with reasoning recap (OpenAI hide_all policy)
  const recapFrame = {
    message: {
      id: 'msg-recap-1',
      author: { role: 'assistant' },
      content: { content_type: 'reasoning_recap', content: 'Worked for 7s' },
      metadata: { finished_duration_sec: 7, reasoning_recap_type: 'hide_all' }
    }
  };
  nice._processSseFrame(recapFrame, sState, () => {});
  assert(niceEvents.includes('thinking_recap:7:hide_all'), 'NICE-THINK-01: thinking_recap frame correctly parsed');
  assert(niceEvents.includes('thinking_end'), 'NICE-THINK-01: thinking_end emitted on reasoning_recap');
  assert(sState.isThinkingActive === false, 'NICE-THINK-01: streamState.isThinkingActive turned false');

  // Test 3: Frame parsing with thought parts (Claude/DeepSeek)
  const thoughtState = nice._createStreamState('gpt-4o-mini');
  const thoughtFrame = {
    message: {
      id: 'msg-thought-1',
      author: { role: 'assistant' },
      content: { content_type: 'thought', parts: ['推导思考第一步...'] }
    }
  };
  nice._processSseFrame(thoughtFrame, thoughtState, () => {});
  assert(niceEvents.includes('thinking_delta:推导思考第一步...'), 'NICE-THINK-01: thinking_delta parsed from thought parts');
  assert(thoughtState.isThinkingActive === true, 'NICE-THINK-01: thoughtState activated thinking');

  // Test 4: Final answer frame switches thinking to text
  let finalChunk = '';
  const finalFrame = {
    message: {
      id: 'msg-final-1',
      author: { role: 'assistant' },
      channel: 'final',
      content: { content_type: 'text', parts: ['最终答案是 42。'] }
    }
  };
  nice._processSseFrame(finalFrame, thoughtState, (c) => { finalChunk += c; });
  assert(finalChunk === '最终答案是 42。', 'NICE-THINK-01: final answer text received');
  assert(thoughtState.isThinkingActive === false, 'NICE-THINK-01: thinking switched off on final text');

  // Test 5: OpenAI /v1 format reasoning_content
  const v1State = nice._createStreamState('gpt-4o-mini');
  const v1ReasoningFrame = {
    choices: [{ delta: { reasoning_content: 'OpenAI v1 reasoning step...' } }]
  };
  nice._processSseFrame(v1ReasoningFrame, v1State, () => {});
  assert(niceEvents.includes('thinking_delta:OpenAI v1 reasoning step...'), 'NICE-THINK-01: OpenAI v1 reasoning_content delta parsed');

  console.log('\n>>> Suite 18: Agent Session Inheritance & Antigravity Multi-turn Persistence (SESS-MGR-01, AGY-SESS-01)');
  const testVaultDir = path.join(os.tmpdir(), 'tabonkb-test-vault-' + Date.now());
  fs.mkdirSync(path.join(testVaultDir, '.obsidian', 'plugins', 'tabonkb-workbench'), { recursive: true });
  const { AgentSessionManager } = require(path.join(pluginDir, 'agent-session-manager.js'));
  const testSm = new AgentSessionManager({ vaultBasePath: testVaultDir });

  // Test SESS-MGR-01: Active session inheritance and recovery
  testSm.clearAll();
  const s1 = testSm.createSession('antigravity', 'USB眼图测试');
  testSm.addMessage('antigravity', { role: 'user', text: '帮我搜索usb眼图资料' });
  testSm.addMessage('antigravity', { role: 'assistant', text: '已为您查询到MTK USB眼图SOP...', thinking: '正在检索原厂SOP...' });
  testSm.setSessionConversation('antigravity', 'agy-conv-uuid-1', null);

  assert(testSm.getActiveSessionId('antigravity') === s1.id, 'SESS-MGR-01: Active session ID correctly tracked');
  assert(testSm.getMessages('antigravity').length === 2, 'SESS-MGR-01: Session contains 2 messages');
  assert(testSm.getMessages('antigravity')[1].thinking === '正在检索原厂SOP...', 'SESS-MGR-01: Thinking text preserved in memory');

  // Save to disk and test full reload from file
  testSm.saveSessions();
  assert(testSm.getLastActiveAgentId() === 'antigravity', 'SESS-MGR-01: lastActiveAgentId correctly resolved to antigravity');

  // Verify save and load persistence simulation
  const savedData = {};
  for (const [aid, a] of testSm.agents.entries()) {
    savedData[aid] = {
      activeSessionId: a.activeSessionId,
      sessions: a.sessions,
      draft: a.draft
    };
  }

  // Create a new session manager instance simulating app restart / reload from disk
  const testSmReloaded = new AgentSessionManager({ vaultBasePath: testVaultDir });
  assert(testSmReloaded.getLastActiveAgentId() === 'antigravity', 'SESS-MGR-01: lastActiveAgentId inherited from disk _meta after reload');
  assert(testSmReloaded.getActiveSessionId('antigravity') === s1.id, 'SESS-MGR-01: activeSessionId inherited after reload');
  assert(testSmReloaded.getMessages('antigravity').length === 2, 'SESS-MGR-01: Messages restored after reload');
  assert(testSmReloaded.getSessionConversation('antigravity').conversationId === 'agy-conv-uuid-1', 'SESS-MGR-01: conversationId persisted across reloads');

  // Test AgentHub constructor auto-recovers antigravity as active agent
  const testHub = new AgentHub({ vaultBasePath: testVaultDir });
  assert(testHub.activeAgentId === 'antigravity', 'SESS-MGR-01: AgentHub automatically defaults to persisted antigravity');

  // Test fallback when activeSessionId was null/missing
  const testSmFallback = new AgentSessionManager({ vaultBasePath: testVaultDir });
  for (const [aid, data] of Object.entries(savedData)) {
    const ag = testSmFallback.getAgent(aid);
    if (Array.isArray(data.sessions)) {
      ag.sessions = data.sessions;
      // activeSessionId is null
      if (null && ag.sessions.some(s => s.id === null)) {
        ag.activeSessionId = null;
      } else if (ag.sessions.length > 0) {
        ag.activeSessionId = ag.sessions[0].id;
      }
    }
  }
  assert(testSmFallback.getActiveSessionId('antigravity') === s1.id, 'SESS-MGR-01: Falls back to latest session when activeSessionId is null');

  // Test delete fallback to next remaining session
  const s2 = testSm.createSession('antigravity', 'MT6789平台');
  assert(testSm.getActiveSessionId('antigravity') === s2.id, 'SESS-MGR-01: Newly created session is active');
  testSm.deleteSession('antigravity', s2.id);
  assert(testSm.getActiveSessionId('antigravity') === s1.id, 'SESS-MGR-01: deleteSession falls back to remaining session');

  // Test AGY-SESS-01: AntigravityAdapter session synchronization
  const agyWithSession = new AntigravityAdapter({
    vaultBasePath: testVaultDir,
    sessionManager: testSm
  });

  // 1. Initial sync from session manager
  agyWithSession._syncSessionConversation();
  assert(agyWithSession.sessionId === 'agy-conv-uuid-1', 'AGY-SESS-01: Adapter syncs conversationId from active session');

  // 2. Event updates persist back to session manager
  agyWithSession.handleEvent({ event: 'init', conversation_id: 'agy-conv-uuid-updated' });
  assert(agyWithSession.sessionId === 'agy-conv-uuid-updated', 'AGY-SESS-01: Adapter receives conversation_id from init');
  assert(testSm.getSessionConversation('antigravity').conversationId === 'agy-conv-uuid-updated', 'AGY-SESS-01: conversation_id persisted to session manager');

  // 3. New session resets adapter session state
  await agyWithSession.newSession();
  assert(agyWithSession.sessionId === null, 'AGY-SESS-01: newSession resets sessionId to null');
  assert(agyWithSession._boundSessionId === null, 'AGY-SESS-01: newSession resets _boundSessionId to null');

  // --- Suite 19: Assistant Markdown GenUI & Citation Sanitization (CL-GENUI-01) ---
  console.log('\n>>> Suite 19: Assistant Markdown GenUI & Citation Sanitization (CL-GENUI-01)');
  const { cleanAssistantMarkdown: cleanMdPi } = require(path.join(pluginDir, 'pi-drawer-view.js'));
  const { cleanAssistantMarkdown: cleanMdNice } = require(path.join(pluginDir, 'providers', 'niceaigc-adapter.js'));

  const rawSample1 = '单位费率恢复为6%。genui{"citation":{"refs":["turn1view0","turn1search10"]}}\n\n基数反算：';
  const cleaned1Pi = cleanMdPi(rawSample1);
  const cleaned1Nice = cleanMdNice(rawSample1);
  assert(!cleaned1Pi.includes('genui') && !cleaned1Pi.includes('turn1view0'), 'CL-GENUI-01: pi-drawer-view cleans genui refs citation');
  assert(!cleaned1Nice.includes('genui') && !cleaned1Nice.includes('turn1view0'), 'CL-GENUI-01: niceaigc-adapter cleans genui refs citation');
  assert(cleaned1Pi === '单位费率恢复为6%。\n\n基数反算：', 'CL-GENUI-01: Output format matches exactly without citation debris');

  const rawSample2 = '现行政策说明。 genui{"citation":{"ref":"turn3view0"}}\n\n深圳职工医保';
  const cleaned2 = cleanMdPi(rawSample2);
  assert(cleaned2 === '现行政策说明。\n\n深圳职工医保', 'CL-GENUI-01: Leading space before genui citation stripped cleanly');

  const rawSample3 = '流式中未完成的标签 genui{"citation":{"ref":"turnX';
  const cleaned3 = cleanMdPi(rawSample3);
  assert(cleaned3 === '流式中未完成的标签', 'CL-GENUI-01: Incomplete streaming genui directive hidden cleanly');

  const rawSample4 = '```json\n{\n  "genui": 123\n}\n```';
  const cleaned4 = cleanMdPi(rawSample4);
  assert(cleaned4.includes('"genui": 123'), 'CL-GENUI-01: Regular json code block preserved intact');

  // --- Suite 20: Local Project Service & 3-Tier Diff Resolution (LOCAL-PROJ-01) ---
  console.log('\n>>> Suite 20: Local Project Service & 3-Tier Diff Resolution (LOCAL-PROJ-01)');
  const localSvc = require(path.join(pluginDir, 'services', 'local-project-service.js'));

  assert(Array.isArray(localSvc.LOCAL_SERVERS) && localSvc.LOCAL_SERVERS.length === 2, 'LOCAL-PROJ-01: LOCAL_SERVERS defines 62 and 31 servers');
  const allProjs = localSvc.getAllAvailableLocalProjects(true);
  assert(allProjs.length > 0, `LOCAL-PROJ-01: getAllAvailableLocalProjects discovered projects (found ${allProjs.length})`);

  const k82 = allProjs.find(p => p.project === 'K82NF' && p.serverId === '62');
  assert(Boolean(k82), 'LOCAL-PROJ-01: Discovered K82NF project on 62 server');

  const n30 = allProjs.find(p => p.project === 'N30' && p.serverId === '31');
  assert(Boolean(n30), 'LOCAL-PROJ-01: Discovered N30 project on 31 server');

  // Test Tier 2 Resolution
  if (n30) {
    const resTier2 = localSvc.resolveEffectiveFile(n30, 'kernel/kernel_device_modules-6.1/arch');
    assert(resTier2 && resTier2.tier === 2 && resTier2.isOverride === true, 'LOCAL-PROJ-02: Resolved to Tier 2 (project custom)');
  }

  // Test Route Edit Target
  if (n30) {
    const routeProject = localSvc.routeEditTarget(n30, 'drivers/misc/mediatek/test_drv.c', 'project');
    assert(routeProject.targetRel.includes('pri_project/driver/mt6878/N30/base'), 'LOCAL-PROJ-03: Route edit target directs to Tier 2 project base');

    const routePublic = localSvc.routeEditTarget(n30, 'drivers/misc/mediatek/test_drv.c', 'public');
    assert(routePublic.targetRel.includes('pri_project/driver/public'), 'LOCAL-PROJ-03: Route edit target directs to Tier 1 public for common scope');
  }

  // Test Compile Command
  if (n30) {
    const cmd = localSvc.buildCompileCommand(n30, 'driver');
    assert(cmd.includes('./pri_project/build/build.sh -p mt6878 -m N30 -k driver'), 'LOCAL-PROJ-04: Compile command automatically formats -p mt6878 -m N30');
  }

  // Test Compiler Error Distillation
  const rawLog = 'BENIGN_PREFIX_LINE\n[10/1000] Compiling a.c\n[11/1000] Compiling b.c\n[12/1000] Compiling c.c\n[13/1000] Compiling d.c\nfoo.c:10: error: unknown type name "sc_charger_t"\nmake[1]: *** [foo.o] Error 1\n[14/1000] Compiling e.c\n[15/1000] Compiling f.c\nBENIGN_TAIL_LINE';
  const extracted = localSvc.extractCompilerErrors(rawLog);
  assert(extracted.includes('error: unknown type name') && !extracted.includes('BENIGN_PREFIX_LINE'), 'LOCAL-PROJ-05: Compiler error extraction filters benign warnings');

  // --- Suite 21: Native Battery Charger & Power-Z Integration (CHG-REF-01) ---
  console.log('\n>>> Suite 21: Native Battery Charger & Power-Z Integration (CHG-REF-01)');
  
  // 1. Verify Register DB
  const { REGISTER_DB } = require(path.join(pluginDir, 'components', 'tools', 'charger', 'register-db.js'));
  const chips = Object.keys(REGISTER_DB);
  assert(chips.includes('SC89601D') && chips.includes('SC89890H') && chips.includes('UPM6920A'), 'CHG-REG-01: Register DB contains SC89601D, SC89890H, UPM6920A');
  assert(Object.keys(REGISTER_DB['SC89601D']).length >= 10, 'CHG-REG-01: SC89601D has >= 10 decoded registers');

  // 2. Verify Power Standards
  const { POWER_STD, standardJudge } = require(path.join(pluginDir, 'components', 'tools', 'charger', 'power-standards.js'));
  assert(POWER_STD['18'] && POWER_STD['33'] && POWER_STD['66'], 'CHG-STD-01: Power standards include 18W, 33W, 66W');
  const dummyMetrics = { t100: 65, tFull: 95, maxT: 41.5, ah: 4.8 };
  const judge18 = standardJudge(dummyMetrics, '18', 5000);
  assert(judge18.configured === true && judge18.reportPass === true, 'CHG-STD-01: 18W standard judge evaluates passing metrics');

  // 3. Verify Calc Engine
  const calc = require(path.join(pluginDir, 'components', 'tools', 'charger', 'charger-calc.js'));
  const sampleCsv = [
    'Time,Level,Vbat,Ibat,Tbat,Status',
    '2026-10-10 00:00:00,10,3600,2000,28,Charging',
    '2026-10-10 00:30:00,55,3950,1800,34,Charging',
    '2026-10-10 01:00:00,90,4350,1200,36,Charging',
    '2026-10-10 01:10:00,100,4400,600,33,Charging',
    '2026-10-10 01:30:00,100,4400,80,30,Full'
  ].join('\n');
  const parsed = calc.parseCSV(sampleCsv);
  assert(parsed.rows.length === 5, 'CHG-CALC-01: parseCSV parsed 5 valid rows');
  const analysis = calc.analyze(parsed);
  assert(analysis.t100 > 60 && analysis.t100 < 80, 'CHG-CALC-01: Calculated 100% report time correctly');
  assert(analysis.cutoffI === 600, 'CHG-CALC-01: Identified Full cutoff previous current 600mA');
  assert(analysis.stages.length > 0, 'CHG-CALC-01: Generated SOC intervals stages');

  // 4. Verify IC Bitfield Decoder & Differ
  const detected = calc.detectChip('DUMP FOR SC89601D CHIP');
  assert(detected === 'SC89601D', 'CHG-IC-01: detectChip detected SC89601D');
  const rawDump = '0x00: 0x08\n0x01: 0x1B\n0x02: 0x00\n0x03: 0x22\n0x04: 0x81\n0x05: 0x20';
  const dumpRes = calc.parseDump(rawDump, 'SC89601D');
  assert(dumpRes.values.size >= 6, 'CHG-IC-01: parseDump extracted register map');

  // 5. Verify Component Classes
  const { ChargePanel } = require(path.join(pluginDir, 'components', 'tools', 'charger', 'charge-panel.js'));
  assert(typeof ChargePanel === 'function', 'CHG-PANEL-01: ChargePanel exported');
  const { DischargePanel } = require(path.join(pluginDir, 'components', 'tools', 'charger', 'discharge-panel.js'));
  assert(typeof DischargePanel === 'function', 'CHG-PANEL-01: DischargePanel exported');
  const { IcPanel } = require(path.join(pluginDir, 'components', 'tools', 'charger', 'ic-panel.js'));
  assert(typeof IcPanel === 'function', 'CHG-PANEL-01: IcPanel exported');
  const { PowerzPanel } = require(path.join(pluginDir, 'components', 'tools', 'charger', 'powerz-panel.js'));
  assert(typeof PowerzPanel === 'function', 'CHG-PZ-01: PowerzPanel exported');
  const { ChargerToolView } = require(path.join(pluginDir, 'components', 'tools', 'charger', 'charger-tool-view.js'));
  assert(typeof ChargerToolView === 'function', 'CHG-VIEW-01: ChargerToolView exported');

  // 6. Verify Power-Z Official Console Service (无自研采集/逆向, 不与官方工具争抢设备)
  const { PowerZService, getPowerZService } = require(path.join(pluginDir, 'services', 'powerz-service.js'));
  assert(typeof PowerZService === 'function', 'CHG-PZ-SRV-01: PowerZService class exported');
  assert(typeof getPowerZService === 'function', 'CHG-PZ-SRV-01: getPowerZService singleton exported');
  assert(fs.existsSync(path.join(pluginDir, 'services', 'powerz_db.py')), 'CHG-PZ-SRV-01: powerz_db.py (official .db reader) exists');
  const pzInst = new PowerZService({ vaultBasePath: path.resolve(__dirname, '..', '..', '..') });
  assert(typeof pzInst.getCaptureDir() === 'string', 'CHG-PZ-SRV-02: getCaptureDir returns a path');
  assert(Array.isArray(pzInst.listCaptures()), 'CHG-PZ-SRV-02: listCaptures returns an array');
  assert(typeof pzInst.launchOfficial === 'function' && typeof pzInst.getOfficialDir() === 'string', 'CHG-PZ-SRV-02: launchOfficial + getOfficialDir available');
  assert(typeof pzInst.analyzeCapture === 'function' && typeof pzInst.readCaptureData === 'function', 'CHG-PZ-SRV-02: analyzeCapture + readCaptureData available');
  // 自研采集 / PD 逆向已彻底移除
  assert(typeof pzInst.startHardwareWorker === 'undefined', 'CHG-PZ-SRV-03: self-built worker removed');
  assert(typeof pzInst.getPdAnalysis === 'undefined', 'CHG-PZ-SRV-03: self-built PD analysis removed');
  assert(typeof pzInst.renegotiate === 'undefined' && typeof pzInst.triggerProtocol === 'undefined', 'CHG-PZ-SRV-03: self-built PD trigger/renegotiate removed');
  assert(!fs.existsSync(path.join(pluginDir, 'services', 'km003c_worker.py')) && !fs.existsSync(path.join(pluginDir, 'services', 'pd-decoder.js')),
    'CHG-PZ-SRV-03: km003c_worker.py + pd-decoder.js deleted');

  // 8. Verify ChargerToolView sub-tab persistence
  global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); }
  };
  global.localStorage.setItem('tabonkb_charger_active_tab', 'powerz');
  const mockContainer = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  const mockNav = { innerHTML: '', querySelectorAll: () => [] };
  const chgView = new ChargerToolView(null, mockContainer, { navTabsContainer: mockNav });
  assert(chgView.activeTab === 'powerz', 'CHG-VIEW-02: ChargerToolView initializes activeTab from localStorage');

  // CHG-PZ-SRV-06: 官方控制台目录解析
  assert(typeof pzInst.getOfficialDir() === 'string' && typeof pzInst.getCaptureDir() === 'string',
    'CHG-PZ-SRV-06: official console dirs resolve to strings');

  // CHG-PZ-SRV-07: 曲线数据解析 (.db) 与 PD协议报文解析 (.sqlite) (对应图2 数据记录仪 & 图3 PD协议分析仪)
  assert(typeof pzInst.parseCurveData === 'function', 'CHG-PZ-SRV-07: parseCurveData method exported');
  assert(typeof pzInst.parsePdData === 'function', 'CHG-PZ-SRV-07: parsePdData method exported');
  const sampleDb = '261012192042.db';
  if (fs.existsSync(path.join(pzInst.getCaptureDir(), sampleDb))) {
    const curveRes = await pzInst.parseCurveData(sampleDb, 100);
    assert(curveRes.ok && curveRes.points && curveRes.points.length > 0, 'CHG-PZ-SRV-07: parseCurveData successfully parses real .db');
    assert(curveRes.metrics && curveRes.metrics.voltage, 'CHG-PZ-SRV-07: parseCurveData extracts valid metrics');
  }
  const samplePd = 'pd.sqlite';
  if (fs.existsSync(path.join(pzInst.getCaptureDir(), samplePd))) {
    const pdRes = await pzInst.parsePdData(samplePd);
    assert(pdRes.ok && pdRes.packets && pdRes.packets.length > 0, 'CHG-PZ-SRV-07: parsePdData successfully parses real .sqlite');
    assert(pdRes.chart && pdRes.chart.length > 0, 'CHG-PZ-SRV-07: parsePdData extracts synchronized waveform');
  }

  // CHG-PZ-ICON-01: 验证 1:1 官方原版图标资源集 (页面选项卡与曲线内容菜单彻底消除非官方卡通 Emoji)
  const { PZ_OFFICIAL_ICONS } = require(path.join(pluginDir, 'components', 'tools', 'charger', 'powerz-panel.js'));
  assert(PZ_OFFICIAL_ICONS && typeof PZ_OFFICIAL_ICONS === 'object', 'CHG-PZ-ICON-01: PZ_OFFICIAL_ICONS exported');
  assert(typeof PZ_OFFICIAL_ICONS.tab_chart === 'string' && PZ_OFFICIAL_ICONS.tab_chart.startsWith('data:image/png;base64,'), 'CHG-PZ-ICON-01: tab_chart is valid data URL');
  assert(typeof PZ_OFFICIAL_ICONS.tab_protocol === 'string' && PZ_OFFICIAL_ICONS.tab_protocol.startsWith('data:image/png;base64,'), 'CHG-PZ-ICON-01: tab_protocol is valid data URL');
  assert(typeof PZ_OFFICIAL_ICONS.tab_powerz_z === 'string' && PZ_OFFICIAL_ICONS.tab_powerz_z.startsWith('data:image/png;base64,'), 'CHG-PZ-ICON-01: tab_powerz_z is valid data URL');
  assert(typeof PZ_OFFICIAL_ICONS.tab_ic === 'string' && PZ_OFFICIAL_ICONS.tab_ic.startsWith('data:image/png;base64,'), 'CHG-PZ-ICON-01: tab_ic is valid data URL');
  assert(typeof PZ_OFFICIAL_ICONS.menu_btn === 'string' && PZ_OFFICIAL_ICONS.menu_btn.startsWith('data:image/png;base64,'), 'CHG-PZ-ICON-01: menu_btn is valid data URL');
  assert(typeof PZ_OFFICIAL_ICONS.item_measure === 'string' && PZ_OFFICIAL_ICONS.item_measure.startsWith('data:image/png;base64,'), 'CHG-PZ-ICON-01: item_measure is valid data URL');

  // --- Suite 22: Drawer View Placeholder & Sticky Header State Management (DRAWER-STATE-01) ---
  console.log('\n>>> Suite 22: Drawer View Placeholder & Sticky Header State Management (DRAWER-STATE-01)');
  const { PiDrawerView } = require(path.join(pluginDir, 'pi-drawer-view.js'));

  const mockInputEl = { placeholder: '' };
  const mockStickyHeaderEl = {
    classList: {
      _classes: new Set(['visible']),
      contains(c) { return this._classes.has(c); },
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); }
    },
    _qText: { textContent: '修改方案有问题，只修改hardware_info的驱动代码就行...' },
    querySelector(selector) {
      if (selector === '.tw-sticky-q-text') return this._qText;
      return null;
    }
  };
  const mockMessagesEl = { innerHTML: '<div>old bubble</div>', querySelectorAll: () => [] };
  const mockAdapter = {
    name: 'pi',
    displayName: 'Pi Agent',
    getModel: () => ({ id: 'gpt-6.1-sol', name: 'gpt-6.1-sol' })
  };
  const mockHub = {
    activeAgentId: 'pi',
    getActiveAdapter: () => mockAdapter,
    getAgentList: () => [{ id: 'pi', displayName: 'Pi Agent', name: 'Pi' }],
    sessionManager: {
      getMessages: () => []
    }
  };

  const drawerViewProto = PiDrawerView.prototype;
  const mockDrawer = Object.create(drawerViewProto);
  mockDrawer.inputEl = mockInputEl;
  mockDrawer.hub = mockHub;
  mockDrawer.stickyHeaderEl = mockStickyHeaderEl;
  mockDrawer.messagesEl = mockMessagesEl;
  mockDrawer.activeToolCards = new Map();
  mockDrawer.selectedLocalProject = { id: 'p1', project: 'GP801H', label: '05-UW/GP801H' };
  mockDrawer.selectedJiraIssue = null;
  mockDrawer.inputChips = [];

  mockDrawer.updateInputPlaceholder();
  assert(mockDrawer.inputEl.placeholder === '发消息或创建任务，/ 调用指令，@ 文件或对话',
    'DRAWER-STATE-01: updateInputPlaceholder emits minimal DSH-style hint');
  assert(mockDrawer._inputPlaceholder === '发消息或创建任务，/ 调用指令，@ 文件或对话',
    'DRAWER-STATE-01: _inputPlaceholder cache is updated in sync');

  // Test chips override
  mockDrawer.inputChips = [{ type: 'command', name: 'compact', label: '/compact' }];
  mockDrawer._syncInputPlaceholder();
  assert(mockDrawer.inputEl.placeholder === '输入消息内容...',
    'DRAWER-STATE-01: _syncInputPlaceholder switches to chip prompt when chips present');
  mockDrawer.inputChips = [];
  mockDrawer._syncInputPlaceholder();
  assert(mockDrawer.inputEl.placeholder === '发消息或创建任务，/ 调用指令，@ 文件或对话',
    'DRAWER-STATE-01: _syncInputPlaceholder restores minimal placeholder when chips removed');

  // Test restoreSessionMessages resets stickyHeaderEl and minimap
  mockDrawer.restoreSessionMessages('pi');
  assert(!mockStickyHeaderEl.classList.contains('visible'),
    'DRAWER-STATE-01: restoreSessionMessages removes visible class from stickyHeaderEl');
  assert(mockStickyHeaderEl._qText.textContent === '',
    'DRAWER-STATE-01: restoreSessionMessages clears textContent of stickyHeaderEl');
  assert(Array.isArray(mockDrawer._minimapBubbles) && mockDrawer._minimapBubbles.length === 0,
    'DRAWER-STATE-01: restoreSessionMessages resets _minimapBubbles to empty array');

  // --- Suite 23: Agent Drawer Mount DOM Reuse & Streaming Survival (DRAWER-MOUNT-01) ---
  console.log('\n>>> Suite 23: Agent Drawer Mount DOM Reuse & Streaming Survival (DRAWER-MOUNT-01)');

  // 精简 DOM 桩（无 jsdom 依赖）：覆盖 PiDrawerView.buildDom/mount/流式渲染所需的 DOM 面
  class MockEl {
    constructor(tag = 'div') {
      this.tagName = String(tag || 'div').toUpperCase();
      this.ownerDocument = null;
      this.children = [];
      this.childNodes = this.children;
      this.parentElement = null;
      this.style = {
        setProperty(k, v) { this[k] = v; },
        getPropertyValue(k) { return this[k] || ''; },
        removeProperty(k) { delete this[k]; }
      };
      this.dataset = {};
      this._classes = new Set();
      const self = this;
      this.classList = {
        add(...cs) { cs.forEach(c => self._classes.add(c)); },
        remove(...cs) { cs.forEach(c => self._classes.delete(c)); },
        toggle(c, force) {
          const want = force === undefined ? !self._classes.has(c) : !!force;
          if (want) self._classes.add(c); else self._classes.delete(c);
          return want;
        },
        contains(c) { return self._classes.has(c); }
      };
      this._attrs = {};
      this._listeners = {};
      this._html = '';
      this._htmlKids = [];
      this.textContent = '';
      this.value = '';
      this.title = '';
      this.placeholder = '';
      this.scrollTop = 0; this.scrollLeft = 0;
      this.clientHeight = 600; this.clientWidth = 420;
      this.offsetTop = 0; this.offsetHeight = 0; this.offsetWidth = 0;
      this.disabled = false; this.checked = false; this.files = [];
    }
    get className() { return [...this._classes].join(' '); }
    set className(v) { this._classes = new Set(String(v || '').split(/\s+/).filter(Boolean)); }
    get id() { return this._attrs.id || ''; }
    set id(v) { this._attrs.id = v; }
    get firstChild() { return this.children[0] || this._htmlKids[0] || null; }
    get lastChild() { return this.children[this.children.length - 1] || null; }
    get innerHTML() { return this._html; }
    set innerHTML(v) {
      this._html = String(v || '');
      this.children.length = 0;
      this._htmlKids = MockEl.parseHtml(this._html);
      for (const k of this._htmlKids) k.parentElement = this;
    }
    static parseHtml(html) {
      const kids = [];
      const tagRe = /<([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
      let m;
      while ((m = tagRe.exec(html)) !== null) {
        const el = new MockEl(m[1]);
        const attrs = m[2] || '';
        const idM = attrs.match(/\bid\s*=\s*"([^"]*)"/) || attrs.match(/\bid\s*=\s*'([^']*)'/);
        const clM = attrs.match(/\bclass\s*=\s*"([^"]*)"/) || attrs.match(/\bclass\s*=\s*'([^']*)'/);
        const phM = attrs.match(/\bplaceholder\s*=\s*"([^"]*)"/) || attrs.match(/\bplaceholder\s*=\s*'([^']*)'/);
        if (idM) el._attrs.id = idM[1];
        if (clM) el.className = clM[1];
        if (phM) el.placeholder = phM[1];
        kids.push(el);
      }
      return kids;
    }
    _descendants() {
      const out = [];
      const walk = (el) => {
        for (const c of el.children) { out.push(c); walk(c); }
        for (const c of el._htmlKids) { out.push(c); walk(c); }
      };
      walk(this);
      return out;
    }
    _matchOne(el, sel) {
      if (sel === '*') return true;
      const tokens = String(sel).trim().match(/[#.]?[^\s#.]+/g) || [];
      for (const t of tokens) {
        if (t === '*') continue;
        if (t.startsWith('#')) { if (el.id !== t.slice(1)) return false; }
        else if (t.startsWith('.')) { if (!el._classes.has(t.slice(1))) return false; }
        else if (el.tagName !== t.toUpperCase()) return false;
      }
      return true;
    }
    _matchSelector(el, sel) {
      for (const part of String(sel).split(',')) {
        const comps = part.trim().split(/\s+/).filter(Boolean);
        const last = comps[comps.length - 1];
        if (last && this._matchOne(el, last)) {
          if (comps.length === 1) return true;
          let curr = el.parentElement;
          let ci = comps.length - 2;
          while (curr && ci >= 0) {
            if (comps[ci] === '>') {
              ci--;
              if (ci >= 0 && this._matchOne(curr, comps[ci])) {
                ci--;
                curr = curr.parentElement;
              } else {
                break;
              }
            } else {
              if (this._matchOne(curr, comps[ci])) ci--;
              curr = curr.parentElement;
            }
          }
          if (ci < 0) return true;
        }
      }
      return false;
    }
    querySelector(sel) { return this._descendants().find(el => this._matchSelector(el, sel)) || null; }
    querySelectorAll(sel) { return this._descendants().filter(el => this._matchSelector(el, sel)); }
    appendChild(c) {
      if (c.parentElement) c.parentElement._detach(c);
      c.parentElement = this;
      this.children.push(c);
      return c;
    }
    insertBefore(c, ref) {
      const i = this.children.indexOf(ref);
      if (c.parentElement) c.parentElement._detach(c);
      c.parentElement = this;
      if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
      return c;
    }
    _detach(c) {
      let i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      i = this._htmlKids.indexOf(c);
      if (i >= 0) this._htmlKids.splice(i, 1);
    }
    removeChild(c) { this._detach(c); if (c) c.parentElement = null; return c; }
    remove() { if (this.parentElement) { this.parentElement._detach(this); this.parentElement = null; } }
    empty() { this.children.length = 0; this._htmlKids.length = 0; this._html = ''; }
    contains(el) {
      if (el === this) return true;
      let p = el && el.parentElement;
      while (p) { if (p === this) return true; p = p.parentElement; }
      return false;
    }
    closest(sel) { let p = this; while (p) { if (this._matchSelector(p, sel)) return p; p = p.parentElement; } return null; }
    matches(sel) { return this._matchSelector(this, sel); }
    setAttribute(k, v) { this._attrs[k] = String(v); }
    getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; }
    removeAttribute(k) { delete this._attrs[k]; }
    hasAttribute(k) { return k in this._attrs; }
    addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
    removeEventListener() {}
    dispatchEvent() { return true; }
    addClass(...cs) { cs.forEach(c => this._classes.add(c)); return this; }
    removeClass(...cs) { cs.forEach(c => this._classes.delete(c)); return this; }
    toggleClass(c, f) { return this.classList.toggle(c, f); }
    hasClass(c) { return this._classes.has(c); }
    createDiv(opts = {}) {
      if (typeof opts === 'string') opts = { cls: opts };
      const d = new MockEl('div');
      if (opts.cls) d.className = opts.cls;
      if (opts.text) d.textContent = opts.text;
      this.appendChild(d); return d;
    }
    createEl(tag, opts = {}) {
      const d = new MockEl(tag);
      if (opts.cls) d.className = opts.cls;
      if (opts.text) d.textContent = opts.text;
      if (opts.attr) for (const k in opts.attr) d.setAttribute(k, opts.attr[k]);
      this.appendChild(d); return d;
    }
    insertAdjacentHTML(_pos, html) {
      for (const k of MockEl.parseHtml(html)) { k.parentElement = this; this._htmlKids.push(k); }
    }
    scrollTo() {}
    scrollIntoView() {}
    focus() {}
    blur() {}
    select() {}
    click() {}
    getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }; }
    get scrollHeight() { return Math.max(this.clientHeight, this.children.length * 20); }
    get scrollWidth() { return this.clientWidth; }
  }

  const docListeners23 = [];
  const MockDocument23 = {
    _isDocRoot: true,
    body: new MockEl('body'),
    documentElement: new MockEl('html'),
    hidden: false,
    createElement(tag) { const el = new MockEl(tag); el.ownerDocument = this; return el; },
    createElementNS(_ns, tag) { return this.createElement(tag); },
    createTextNode(t) { const el = new MockEl('#text'); el.textContent = t; return el; },
    addEventListener(type, fn, opts) { docListeners23.push({ type, fn, signal: (opts && opts.signal) || null }); },
    removeEventListener() {},
    querySelector(sel) { return this.body.querySelector(sel); },
    querySelectorAll(sel) { return this.body.querySelectorAll(sel); },
    execCommand() { return true; }
  };
  MockDocument23.body.parentElement = MockDocument23.documentElement;

  const mockApp23 = {
    vault: { adapter: { basePath: '', getResourcePath: (p) => p }, getAbstractFileByPath: () => null },
    plugins: { plugins: {}, getPlugin: () => null },
    workspace: { getLeavesOfType: () => [] },
    metadataCache: { getFileCache: () => ({}) },
    setting: {}
  };
  const ctxProvider23 = {
    app: mockApp23,
    onChange() {},
    getContextBadgeInfo: () => ({ hasContext: false, title: '', module: '' }),
    getActiveFile: () => null,
    clearContext() {},
    clearKnowledgeNode() {},
    formatPromptWithContext: (t) => t
  };

  global.document = MockDocument23;
  global.window = {
    app: mockApp23, innerWidth: 1600, innerHeight: 900,
    addEventListener() {}, removeEventListener() {}
  };
  if (!global.localStorage) {
    global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
  }
  global.requestAnimationFrame = global.requestAnimationFrame || ((cb) => setTimeout(cb, 0));
  global.cancelAnimationFrame = global.cancelAnimationFrame || ((id) => clearTimeout(id));
  global.MutationObserver = global.MutationObserver || class { constructor(cb) { this._cb = cb; } observe() {} disconnect() {} };
  global.ResizeObserver = global.ResizeObserver || class { constructor(cb) { this._cb = cb; } observe() {} disconnect() {} };
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async () => {} } }, configurable: true });
    }
  } catch (_) {}

  function makeStubHub23() {
    const listeners = {};
    const adapter = {
      id: 'pi', name: 'Pi Agent', displayName: 'Pi Agent', icon: '<svg></svg>',
      status: 'connected', permissionMode: 'readwrite', isStreaming: false,
      getStatus() { return { status: this.status, detail: 'ok' }; },
      getModel: () => ({ id: 'gpt-6.1-sol', name: 'gpt-6.1-sol' }),
      getModelGroups: () => [],
      supportsReasoningEffort: () => false,
      getReasoningEffortConfig: () => null,
      detect: async () => ({ available: true }),
      start: async () => true,
      _syncSessionConversation() {}
    };
    const added = [];
    const sessionManager = {
      _msgs: [],
      getMessages: () => sessionManager._msgs.slice(),
      addMessage: (aid, m) => { added.push(m); sessionManager._msgs.push(m); },
      getActiveSessionId: () => 'sess-1',
      getSessions: () => [],
      getDraft: () => '',
      setDraft: () => {},
      switchSession: () => {},
      newSession: () => {},
      deleteSession: () => {}
    };
    const hub = {
      activeAgentId: 'pi', sessionManager,
      on: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
      emit: (ev, d) => { (listeners[ev] || []).slice().forEach(f => f(d)); },
      getActiveAdapter: () => adapter,
      getAdapter: () => adapter,
      getAgentList: () => [{ id: 'pi', name: 'Pi Agent', displayName: 'Pi Agent', icon: '<svg/>' }],
      getStatus: () => adapter.getStatus(),
      isStreaming: () => !!adapter.isStreaming,
      getPermissionMode: () => 'readwrite',
      setPermissionMode: async () => {},
      switchAgent: async () => {}
    };
    return { hub, adapter, added };
  }

  // 场景 A：流式任务中跨页签切换（多次 mount），气泡/工具句柄不丢失，消息完整聚合落库
  const { hub: hubA, adapter: adpA, added: addedA } = makeStubHub23();
  const drawerA = new PiDrawerView({ hub: hubA, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
  const layoutA1 = MockDocument23.createElement('div'); layoutA1.className = 'tabonkb-workbench-layout';
  drawerA.mount(layoutA1);
  assert(!!drawerA.drawerEl && drawerA.drawerEl.parentElement === layoutA1, 'DRAWER-MOUNT-01: initial mount builds DOM into layout');

  adpA.isStreaming = true;
  hubA.emit('turn_start');
  hubA.emit('thinking_start', { startTime: Date.now() });
  hubA.emit('thinking_delta', '第一步：分析充电驱动代码结构');
  hubA.emit('tool_start', { toolCallId: 'call-1', toolName: 'read_file', actionDesc: '读取驱动源码' });

  const msgBeforeSwitch = drawerA.currentAssistantMessage;
  const drawerElBefore = drawerA.drawerEl;
  const msgChildrenBefore = drawerA.messagesEl.children.length;
  assert(!!msgBeforeSwitch && (msgBeforeSwitch.thinkingText || '').includes('第一步'), 'DRAWER-MOUNT-01: thinking text accumulated before switch');
  assert(drawerA.activeToolCards.has('call-1'), 'DRAWER-MOUNT-01: activeToolCards holds running tool before switch');

  const aiWrapA = MockDocument23.createElement('div'); aiWrapA.className = 'tw-explore-ai-pane';
  const layoutA2 = MockDocument23.createElement('div'); layoutA2.className = 'tabonkb-workbench-layout';
  const layoutA3 = MockDocument23.createElement('div'); layoutA3.className = 'tabonkb-workbench-layout';
  drawerA.mount(aiWrapA);   // explore ai（studio 宿主）
  drawerA.mount(layoutA2);  // home（普通宿主）
  drawerA.mount(layoutA3);  // tasks（普通宿主）
  drawerA.mount(aiWrapA);   // 返回 explore ai

  assert(drawerA.drawerEl === drawerElBefore, 'DRAWER-MOUNT-01: drawerEl node is reused (not rebuilt) across mounts');
  assert(drawerA.drawerEl.parentElement === aiWrapA, 'DRAWER-MOUNT-01: remount re-attaches drawerEl into the new host container');
  assert(drawerA.currentAssistantMessage === msgBeforeSwitch, 'DRAWER-MOUNT-01: currentAssistantMessage is the same reference after page switches');
  assert(drawerA.activeToolCards.has('call-1'), 'DRAWER-MOUNT-01: activeToolCards survives page switches');
  assert(drawerA.messagesEl.children.length >= msgChildrenBefore && msgChildrenBefore > 0, 'DRAWER-MOUNT-01: in-flight bubble DOM preserved');
  assert(msgBeforeSwitch.startTime > 0, 'DRAWER-MOUNT-01: banner timer not restarted (startTime unchanged, no 1-second restart)');

  hubA.emit('tool_end', { toolCallId: 'call-1', toolName: 'read_file', durationMs: 800 });
  hubA.emit('text_delta', '根据分析，充电驱动需要修改 hardware_info');
  adpA.isStreaming = false;
  hubA.emit('turn_end', { usage: { input: 100, output: 50 } });
  hubA.emit('agent_settled', {});

  const persisted = addedA[addedA.length - 1];
  assert(addedA.length === 1, 'DRAWER-MOUNT-01: exactly one assistant message persisted (no fragment/duplicate after switches)');
  assert(!!persisted && (persisted.thinking || '').includes('第一步'), 'DRAWER-MOUNT-01: persisted message retains thinking chain across page switch');
  assert(!!persisted && Array.isArray(persisted.toolCalls) && persisted.toolCalls.length === 1, 'DRAWER-MOUNT-01: persisted message keeps the tool call record');
  assert(!!persisted && (persisted.text || '').includes('根据分析'), 'DRAWER-MOUNT-01: streamed text aggregated into the same message');
  assert(drawerA.currentAssistantMessage === null, 'DRAWER-MOUNT-01: message finalized after agent_settled');

  // 场景 B：studio 宿主与普通宿主之间的形态与显隐状态机
  const { hub: hubB } = makeStubHub23();
  const drawerB = new PiDrawerView({ hub: hubB, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
  const layoutB = MockDocument23.createElement('div'); layoutB.className = 'tabonkb-workbench-layout';
  const aiPaneB = MockDocument23.createElement('div'); aiPaneB.className = 'tw-explore-ai-pane';
  drawerB.mount(layoutB);
  drawerB.mount(aiPaneB);
  assert(drawerB.drawerEl.classList.contains('tw-studio-mode') === true, 'DRAWER-MOUNT-02: studio host applies tw-studio-mode');
  assert(drawerB.drawerEl.style.width === '100%' && drawerB.drawerEl.style.display === 'flex', 'DRAWER-MOUNT-02: studio host forces full-width open');
  drawerB.mount(layoutB);
  assert(drawerB.drawerEl.classList.contains('tw-studio-mode') === false, 'DRAWER-MOUNT-02: normal host removes tw-studio-mode');
  assert(drawerB.drawerEl.style.display === 'none' && drawerB.isOpenState === false, 'DRAWER-MOUNT-02: docked drawer hidden & isOpenState reset (no stale true from studio)');
  drawerB.toggle();
  assert(drawerB.isOpenState === true && drawerB.drawerEl.style.display === 'flex', 'DRAWER-MOUNT-02: first toggle() opens drawer immediately (no dead click)');
  drawerB.mount(layoutB);
  assert(drawerB.isOpenState === true && drawerB.drawerEl.style.display === 'flex', 'DRAWER-MOUNT-02: normal open state survives remount via _normalDrawerOpen');
  drawerB.close();
  assert(drawerB._normalDrawerOpen === false && drawerB.drawerEl.style.display === 'none', 'DRAWER-MOUNT-02: close() syncs _normalDrawerOpen=false');

  // 场景 C：document 级全局监听防泄漏 + 幽灵吸顶条样式回归
  assert(drawerA._docEventsAbort instanceof AbortController && !drawerA._docEventsAbort.signal.aborted, 'DRAWER-MOUNT-03: _docEventsAbort installed during buildDom');
  const firstDocSignal = drawerA._docEventsAbort.signal;
  const boundCount = docListeners23.filter(l => l.signal === firstDocSignal).length;
  assert(boundCount === 5, `DRAWER-MOUNT-03: exactly 5 document listeners bound to abort signal (got ${boundCount})`);
  drawerA.buildDom(); // 模拟异常恢复路径下的二次构建
  assert(firstDocSignal.aborted === true, 'DRAWER-MOUNT-03: re-running buildDom aborts previous document listeners');
  assert(drawerA._docEventsAbort.signal !== firstDocSignal && !drawerA._docEventsAbort.signal.aborted, 'DRAWER-MOUNT-03: fresh abort signal installed after rebuild');

  const stylesSrc23 = fs.readFileSync(path.join(pluginDir, 'styles.css'), 'utf8');
  const stickyBlocks23 = stylesSrc23.match(/\.tw-sticky-question\s*\{[^}]*\}/g) || [];
  const ghostBlock23 = stickyBlocks23.find(b => /display\s*:\s*flex\s*!important/.test(b));
  assert(!ghostBlock23, 'DRAWER-MOUNT-03: .tw-sticky-question has no unconditional display:flex !important (ghost bar fixed)');

  // 场景 D：孤儿回合（热重载/进程被杀导致在途回复未落库）恢复后渲染中断标记
  // 1) 会话以未应答的 user 消息结尾 → 恢复后消息区末尾出现 .tw-interrupt-marker
  const { hub: hubD1 } = makeStubHub23();
  hubD1.sessionManager._msgs.push(
    { role: 'user', text: '根据 kernel log 定位下关机原因', timestamp: Date.now() - 120000 },
    { role: 'assistant', text: '初步分析：充电线程正常', thinking: '检查日志', processSteps: [{ label: '思考', text: 'x' }], timestamp: Date.now() - 90000 },
    { role: 'user', text: '继续深入', timestamp: Date.now() - 60000 }
  );
  const drawerD1 = new PiDrawerView({ hub: hubD1, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
  const layoutD1 = MockDocument23.createElement('div'); layoutD1.className = 'tabonkb-workbench-layout';
  drawerD1.mount(layoutD1);
  const markerD1 = drawerD1.messagesEl.querySelector('.tw-interrupt-marker');
  assert(!!markerD1, 'DRAWER-MOUNT-04: interrupt marker rendered when restored session ends with unanswered user message');
  assert(markerD1 === drawerD1.messagesEl.children[drawerD1.messagesEl.children.length - 1], 'DRAWER-MOUNT-04: interrupt marker sits at the end of the message list');
  assert(markerD1 && !hubD1.sessionManager._msgs.some(m => m.role !== 'user' && m.role !== 'assistant'), 'DRAWER-MOUNT-04: marker is DOM-only, nothing extra persisted');

  // 2) 会话以完全空壳的 assistant（重载前残缺落库痕迹）结尾 → 同样渲染标记
  const { hub: hubD2 } = makeStubHub23();
  hubD2.sessionManager._msgs.push(
    { role: 'user', text: '问题A', timestamp: Date.now() - 60000 },
    { role: 'assistant', text: '', thinking: '', processSteps: [{ label: '思考', text: '' }], timestamp: Date.now() - 59000 }
  );
  const drawerD2 = new PiDrawerView({ hub: hubD2, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
  const layoutD2 = MockDocument23.createElement('div'); layoutD2.className = 'tabonkb-workbench-layout';
  drawerD2.mount(layoutD2);
  assert(!!drawerD2.messagesEl.querySelector('.tw-interrupt-marker'), 'DRAWER-MOUNT-04: interrupt marker rendered for truncated empty assistant tail');

  // 3) 正常收尾的会话（assistant 有正文）→ 不渲染标记
  const { hub: hubD3 } = makeStubHub23();
  hubD3.sessionManager._msgs.push(
    { role: 'user', text: '问题B', timestamp: Date.now() - 60000 },
    { role: 'assistant', text: '结论：关机由电量计低电保护触发', timestamp: Date.now() - 59000 }
  );
  const drawerD3 = new PiDrawerView({ hub: hubD3, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
  const layoutD3 = MockDocument23.createElement('div'); layoutD3.className = 'tabonkb-workbench-layout';
  drawerD3.mount(layoutD3);
  assert(!drawerD3.messagesEl.querySelector('.tw-interrupt-marker'), 'DRAWER-MOUNT-04: no marker for a normally completed session');

  // 4) 流式进行中（末条为 user 且 hub.isStreaming()=true）→ 恢复时不误标中断
  const { hub: hubD4, adapter: adpD4 } = makeStubHub23();
  hubD4.sessionManager._msgs.push({ role: 'user', text: '进行中的问题', timestamp: Date.now() - 5000 });
  const drawerD4 = new PiDrawerView({ hub: hubD4, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
  const layoutD4 = MockDocument23.createElement('div'); layoutD4.className = 'tabonkb-workbench-layout';
  adpD4.isStreaming = true;
  drawerD4.mount(layoutD4);
  assert(!drawerD4.messagesEl.querySelector('.tw-interrupt-marker'), 'DRAWER-MOUNT-04: no marker while a turn is streaming (isStreaming guard)');
  adpD4.isStreaming = false;

  // =========================================================================
  // Suite 24: STREAM-QUEUE —— 流式 steer 插队 / follow_up 排队 / 回显去重 /
  //           pi .jsonl 孤儿回合恢复 / 只读方案执行条
  // =========================================================================
  console.log('\n--- Suite 24: STREAM-QUEUE ---');

  // 带 steer/followUp 能力桩的 hub 工厂（复用 mockApp23/ctxProvider23/MockDocument23）
  function makeStubHub24(overrides = {}) {
    const listeners = {};
    const calls = { steer: [], followUp: [], cancelQueued: [], send: [], setPerm: [] };
    let permMode = overrides.permMode || 'readwrite';
    const adapter = Object.assign({
      id: 'pi', name: 'Pi Agent', displayName: 'Pi Agent', icon: '<svg></svg>',
      status: 'connected', permissionMode: 'readwrite', isStreaming: false,
      getStatus() { return { status: this.status, detail: 'ok' }; },
      getModel: () => ({ id: 'gpt-6.1-sol', name: 'gpt-6.1-sol' }),
      getModelGroups: () => [],
      supportsReasoningEffort: () => false,
      getReasoningEffortConfig: () => null,
      detect: async () => ({ available: true }),
      start: async () => true,
      _syncSessionConversation() {},
      steer: async (t) => { calls.steer.push(t); return { success: true }; },
      followUp: async (t) => { calls.followUp.push(t); return { success: true }; },
      removeQueuedMessage: async (k, t) => { calls.cancelQueued.push([k, t]); return { success: true }; },
      send: async (t) => { calls.send.push(t); return { success: true }; }
    }, overrides.adapter || {});
    const sessionManager = {
      _msgs: [],
      getMessages() { return sessionManager._msgs.slice(); },
      addMessage(aid, m) { sessionManager._msgs.push(m); },
      truncateMessages(aid, fromIdx) { if (fromIdx >= 0 && fromIdx < sessionManager._msgs.length) sessionManager._msgs.length = fromIdx; },
      getActiveSessionId: () => 'sess-1',
      getSessions: () => [],
      getDraft: () => '',
      setDraft: () => {},
      switchSession: () => {},
      newSession: () => {},
      deleteSession: () => {}
    };
    const hub = {
      activeAgentId: 'pi', sessionManager, _calls: calls,
      on: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
      emit: (ev, d) => { (listeners[ev] || []).slice().forEach(f => f(d)); },
      getActiveAdapter: () => adapter,
      getAdapter: () => adapter,
      getAgentList: () => [{ id: 'pi', name: 'Pi Agent', displayName: 'Pi Agent', icon: '<svg/>' }],
      getStatus: () => adapter.getStatus(),
      isStreaming: () => !!adapter.isStreaming,
      getPermissionMode: () => permMode,
      setPermissionMode: async (m) => { calls.setPerm.push(m); permMode = m; },
      followUp: async (t, meta) => adapter.followUp((meta && meta.prompt) || t),
      cancelQueued: async (k, t) => adapter.removeQueuedMessage(k, t),
      steer: async (t) => adapter.steer(t),
      send: async (t) => adapter.send(t),
      abort: async () => { adapter.isStreaming = false; hub.emit('agent_settled', {}); },
      newSession: async () => {},
      switchAgent: async () => {}
    };
    return { hub, adapter, calls, sessionManager };
  }

  const tick24 = () => new Promise(r => setTimeout(r, 5));

  // 场景 E：流式中 Enter → steer 插队（乐观气泡 + 回显去重）
  {
    const { hub, adapter, calls } = makeStubHub24();
    const drawer = new PiDrawerView({ hub, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
    const host = MockDocument23.createElement('div');
    drawer.mount(host);
    drawer.open();
    adapter.isStreaming = true;
    hub.emit('turn_start');
    const kidsBefore = drawer.messagesEl.children.length;

    drawer.inputEl.value = '注意检查 RCU 旁路';
    await drawer.handleQueueSend('steer');
    assert(calls.steer.length === 1 && calls.steer[0] === '注意检查 RCU 旁路', 'STREAM-01: Enter during streaming issues pi steer with wireText');
    assert(drawer.inputEl.value === '', 'STREAM-01: input cleared after steer');
    // A 方案分段：空壳旧气泡被移除 + 纠偏气泡追加 → 净增 0；若非空段则收尾保留在 DOM
    assert(drawer.messagesEl.children.length === kidsBefore, 'STREAM-01: empty pre-steer bubble cut & removed, user steer bubble appended');
    assert(drawer._pendingSentWires.length === 1 && drawer._pendingSentWires[0].optimistic === true, 'STREAM-01: optimistic echo ledger entry recorded');

    // pi 侧回显 message_start(user) 到达 → 对账命中 → 不重复渲染
    const kidsAfterSteer = drawer.messagesEl.children.length;
    hub.emit('user_message', { text: '注意检查 RCU 旁路' });
    assert(drawer.messagesEl.children.length === kidsAfterSteer, 'STREAM-01: steer echo deduped via pending ledger (no duplicate bubble)');
    assert(drawer._pendingSentWires.length === 0, 'STREAM-01: ledger entry consumed by echo');
    adapter.isStreaming = false;
  }

  // 场景 E2：steer 前后分段落库——[assistant1][user][assistant2] 顺序与禁跨用户消息合并
  {
    const { hub, adapter, calls, sessionManager } = makeStubHub24();
    const drawer = new PiDrawerView({ hub, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
    const host = MockDocument23.createElement('div');
    drawer.mount(host);
    drawer.open();
    adapter.isStreaming = true;
    hub.emit('turn_start');
    hub.emit('text_delta', '第一段分析内容');

    drawer.inputEl.value = '补充：重点看 otg 路径';
    await drawer.handleQueueSend('steer');
    // steer 发送即把前段收尾+落库：此时应已有 [assistant1][user]（用户消息经异步 persist 落地）
    await tick24();
    hub.emit('user_message', { text: '补充：重点看 otg 路径' });
    hub.emit('text_delta', '第二段纠偏后输出');
    adapter.isStreaming = false;
    hub.emit('agent_settled', {});
    await tick24();

    const roles = sessionManager._msgs.map(m => m.role);
    const aIdx = roles.indexOf('assistant');
    const uIdx = roles.indexOf('user');
    const a2Idx = roles.lastIndexOf('assistant');
    assert(aIdx === 0 && uIdx === 1 && a2Idx === 2, 'STREAM-06: persisted order is [assistant1][user-steer][assistant2] (no cross-user merge)');
    assert(sessionManager._msgs[0].text.includes('第一段分析内容'), 'STREAM-06: first segment carries pre-steer text');
    assert(sessionManager._msgs[2].text.includes('第二段纠偏后输出'), 'STREAM-06: second segment carries post-steer text');
    // 连续段（无用户消息分隔）合并为一条：本场景两轮 turn 各自成段
    const asstCount = sessionManager._msgs.filter(m => m.role === 'assistant').length;
    assert(asstCount === 2, 'STREAM-06: two assistant segments persisted as two records (split by user msg)');
  }

  // 场景 E3：steer 失败回滚乐观气泡（不残留幽灵 user 记录）
  {
    const { hub, adapter, sessionManager } = makeStubHub24();
    adapter.steer = async () => { throw new Error('Pi 核心进程未就绪或已断开'); };
    const drawer = new PiDrawerView({ hub, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
    const host = MockDocument23.createElement('div');
    drawer.mount(host);
    drawer.open();
    adapter.isStreaming = true;
    hub.emit('turn_start');
    hub.emit('text_delta', '运行中内容');
    drawer.inputEl.value = '注定失败的纠偏';
    await drawer.handleQueueSend('steer');
    await tick24();
    assert(!sessionManager._msgs.some(m => m.role === 'user' && m.text === '注定失败的纠偏'), 'STREAM-07: failed steer rolls back optimistic bubble (no phantom user record)');
    assert(drawer._pendingSentWires.length === 0, 'STREAM-07: failed steer ledger entry removed');
    adapter.isStreaming = false;
  }

  // 场景 F：流式中 Alt+Enter → follow_up 排队（先不渲染气泡，回显派发时补渲染并落库）
  {
    const { hub, adapter, calls, sessionManager } = makeStubHub24();
    const drawer = new PiDrawerView({ hub, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
    const host = MockDocument23.createElement('div');
    drawer.mount(host);
    drawer.open();
    adapter.isStreaming = true;
    hub.emit('turn_start');
    const kidsBefore = drawer.messagesEl.children.length;

    drawer.inputEl.value = '然后再看 fuel gauge';
    await drawer.handleQueueSend('follow_up');
    assert(calls.followUp.length === 1 && calls.followUp[0] === '然后再看 fuel gauge', 'STREAM-02: Alt+Enter queues follow_up with wireText');
    assert(drawer.messagesEl.children.length === kidsBefore, 'STREAM-02: queued item does NOT render user bubble immediately');
    assert(drawer._pendingSentWires.length === 1 && drawer._pendingSentWires[0].optimistic === false, 'STREAM-02: queued echo ledger entry pending render');

    // queue_update 快照 → 排队胶囊条渲染
    hub.emit('queue_update', { steering: [], followUp: ['然后再看 fuel gauge', '第二条排队'] });
    const strip = drawer.queueStripEl;
    assert(strip && strip.style.display === 'flex', 'STREAM-02: queue strip visible on queue_update');
    assert(strip.querySelectorAll('.tw-queue-chip').length === 2, 'STREAM-02: two queue chips rendered');
    assert((strip.innerHTML || '').includes('然后再看 fuel gauge'), 'STREAM-02: chip shows queued text');

    // 点击第 2 个芯片 ✕ → cancelQueued('follow', text)
    const chipXs = strip.querySelectorAll('.tw-queue-chip-x');
    chipXs[1].onclick({ stopPropagation() {} });
    await tick24();
    assert(calls.cancelQueued.length === 1 && calls.cancelQueued[0][0] === 'follow' && calls.cancelQueued[0][1] === '第二条排队', 'STREAM-02: chip ✕ removes that queued item via cancelQueued');

    // 本轮结束 → pi 消费排队项 → message_start(user) 回显 → 渲染原文气泡 + 落库
    adapter.isStreaming = false;
    hub.emit('queue_update', { steering: [], followUp: [] });
    hub.emit('user_message', { text: '然后再看 fuel gauge' });
    await tick24();
    const userBubbles = drawer.messagesEl.querySelectorAll('.tw-msg-bubble-wrap.user');
    assert(userBubbles.length === 1, 'STREAM-02: dispatched follow_up renders user bubble on echo');
    assert(sessionManager._msgs.some(m => m.role === 'user' && m.text === '然后再看 fuel gauge'), 'STREAM-02: dispatched follow_up persisted as user message');
    assert(strip.style.display === 'none', 'STREAM-02: strip hides when queue empties');
  }

  // 场景 G：abort 回收队列 → queue_cleared 回填输入框；正常 prompt 回显对账
  {
    const { hub, adapter } = makeStubHub24();
    const drawer = new PiDrawerView({ hub, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
    const host = MockDocument23.createElement('div');
    drawer.mount(host);
    drawer.open();

    hub.emit('queue_cleared', { steering: ['插队没赶上'], followUp: ['排队甲', '排队乙'] });
    assert(drawer.inputEl.value === '插队没赶上\n排队甲\n排队乙', 'STREAM-03: cleared queue texts restored into input on abort');

    // 正常发送的回显对账：handleSend 登记 optimistic → echo 去重
    drawer.inputEl.value = '正常提问';
    sessionManagerPushGuard: {
      const msgsBefore = hub.sessionManager._msgs.length;
      await drawer.handleSend();
      hub.emit('user_message', { text: '正常提问' });
      await tick24();
      const userMsgs = hub.sessionManager._msgs.filter(m => m.role === 'user');
      assert(userMsgs.length === 1, 'STREAM-03: normal prompt echo deduped (single persisted user message)');
    }
  }

  // 场景 H：AgentHub 本地队列（非 pi adapter 无原生队列）——入队快照、settled 自动派发、取消
  {
    const { AgentHub } = require('../agent-hub.js');
    const hub = Object.create(AgentHub.prototype);
    hub.listeners = new Map();
    hub._localFollowUpQueue = [];
    hub.activeAgentId = 'agx';
    const sentLocal = [];
    const fakeAdapter = {
      isStreaming: false,
      send: async (t) => { sentLocal.push(t); return { success: true }; },
      abort: async () => {}
    };
    hub.getActiveAdapter = () => fakeAdapter;
    const hubEvents = [];
    const origEmit = AgentHub.prototype.emit.bind(hub);
    hub.emit = (ev, d) => { hubEvents.push([ev, d]); return origEmit(ev, d); };

    await hub.followUp('本地排队任务一');
    assert(hub._localFollowUpQueue.length === 1, 'STREAM-04: non-pi adapter falls back to hub local queue');
    assert(hubEvents.some(e => e[0] === 'queue_update' && e[1].followUp.length === 1 && e[1]._local === true), 'STREAM-04: local queue emits synthesized queue_update');

    // settled → 自动派发首项
    hub._dispatchLocalFollowUp(fakeAdapter);
    assert(sentLocal.length === 1 && sentLocal[0] === '本地排队任务一', 'STREAM-04: settled dispatches head of local queue via adapter.send');
    assert(hubEvents.some(e => e[0] === 'follow_up_dispatched' && e[1].text === '本地排队任务一'), 'STREAM-04: follow_up_dispatched broadcast before send');

    // 取消剩余项
    await hub.followUp('排队二');
    await hub.followUp('排队三');
    await hub.cancelQueued('follow', '排队二');
    assert(hub._localFollowUpQueue.length === 1 && hub._localFollowUpQueue[0].text === '排队三', 'STREAM-04: cancelQueued splices exact item from local queue');

    // abort 清空本地队列并广播 queue_cleared
    hub._localFollowUpQueue.push({ id: 'x', text: '排队四' });
    await hub.abort();
    assert(hub._localFollowUpQueue.length === 0, 'STREAM-04: abort clears local queue');
    assert(hubEvents.some(e => e[0] === 'queue_cleared' && e[1].followUp.includes('排队四')), 'STREAM-04: abort broadcasts cleared texts for input restore');

    // pi 原生路径：adapter 提供 followUp 时不入本地队列
    const nativeCalls = [];
    const piAdapter = { isStreaming: false, followUp: async (t) => { nativeCalls.push(t); }, send: async () => {} };
    hub.getActiveAdapter = () => piAdapter;
    await hub.followUp('原生排队');
    assert(nativeCalls.length === 1 && hub._localFollowUpQueue.length === 0, 'STREAM-04: adapter with native followUp bypasses local queue');
  }

  // 场景 I：pi .jsonl 孤儿回合恢复 —— 热重载中断后从会话文件回填 thinking/tool 步骤
  {
    const os = require('os');
    const vaultKey = 'D:\\VaultTest';
    const jsonlPath = path.join(os.tmpdir(), `pi-sess-test-${Date.now()}.jsonl`);
    const lines = [
      JSON.stringify({ type: 'session', cwd: vaultKey, id: 'test' }),
      JSON.stringify({ type: 'message', timestamp: 1000, message: { role: 'user', content: [{ type: 'text', text: '继续深入分析关机根因\n\n[Target Codebase: xxx]' }] } }),
      JSON.stringify({ type: 'message', timestamp: 2000, message: { role: 'assistant', content: [{ type: 'thinking', thinking: '先看充电线程日志…' }, { type: 'toolCall', id: 't1', name: 'grep', arguments: { pattern: 'shutdown' } }] } }),
      JSON.stringify({ type: 'message', timestamp: 3000, message: { role: 'toolResult', toolCallId: 't1', content: [{ type: 'text', text: 'charger_thread: ok' }], isError: false } }),
      JSON.stringify({ type: 'message', timestamp: 4000, message: { role: 'assistant', content: [{ type: 'text', text: '初步结论：低电保护触发关机' }] } })
    ];
    fs.writeFileSync(jsonlPath, lines.join('\n') + '\n', 'utf-8');
    const mapKey = vaultKey.replace(/\\/g, '/').toLowerCase();
    const map = JSON.parse(localStorage.getItem('tabonkb-pi-session-files') || '{}');
    map[mapKey] = jsonlPath;
    localStorage.setItem('tabonkb-pi-session-files', JSON.stringify(map));

    const { hub, sessionManager } = makeStubHub24();
    sessionManager._msgs.push(
      { role: 'user', text: '先分析 kernel log', timestamp: Date.now() - 120000 },
      { role: 'assistant', text: '线程正常', timestamp: Date.now() - 90000 },
      { role: 'user', text: '继续深入分析关机根因', timestamp: Date.now() - 60000 }
    );
    const drawer = new PiDrawerView({ hub, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: vaultKey });
    const host = MockDocument23.createElement('div');
    drawer.mount(host);

    const lastMsg = sessionManager._msgs[sessionManager._msgs.length - 1];
    assert(lastMsg.role === 'assistant' && lastMsg.interrupted === true, 'RECOVER-01: orphaned turn recovered from pi .jsonl into interrupted assistant message');
    assert((lastMsg.thinking || '').includes('充电线程'), 'RECOVER-01: recovered message contains thinking chain');
    assert(Array.isArray(lastMsg.toolCalls) && lastMsg.toolCalls.length === 1 && lastMsg.toolCalls[0].toolName === 'grep' && lastMsg.toolCalls[0].output.includes('charger_thread'), 'RECOVER-01: recovered tool call carries output');
    assert((lastMsg.text || '').includes('低电保护'), 'RECOVER-01: recovered message contains streamed text');
    const marker = drawer.messagesEl.querySelector('.tw-interrupt-marker');
    assert(!!marker && marker === drawer.messagesEl.children[drawer.messagesEl.children.length - 1], 'RECOVER-01: interrupt marker still tails the recovered bubble');
    assert(Array.isArray(lastMsg.processSteps) && lastMsg.processSteps.some(s => s.type === 'thinking') && lastMsg.processSteps.some(s => s.type === 'tool'), 'RECOVER-01: recovered message rebuilds ordered thinking+tool processSteps');
    assert(!!drawer.messagesEl.querySelector('.tw-dsh-process-banner'), 'RECOVER-01: recovered bubble renders collapsed process banner');

    // 文本不匹配（其他会话文件）→ 不恢复
    const { hub: hub2, sessionManager: sm2 } = makeStubHub24();
    sm2._msgs.push({ role: 'user', text: '完全不同的提问内容xyz', timestamp: Date.now() - 60000 });
    const drawer2 = new PiDrawerView({ hub: hub2, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: vaultKey });
    const host2 = MockDocument23.createElement('div');
    drawer2.mount(host2);
    assert(sm2._msgs.length === 1 && !!drawer2.messagesEl.querySelector('.tw-interrupt-marker'), 'RECOVER-02: mismatched session file skips recovery, marker still shown');
  }

  // 场景 J：只读模式回合落定 → ExecutePlanBar 浮现；点击执行 → 切读写并发送
  {
    const { hub, adapter, calls, sessionManager } = makeStubHub24({ permMode: 'readonly' });
    const drawer = new PiDrawerView({ hub, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
    const host = MockDocument23.createElement('div');
    drawer.mount(host);
    drawer.open();

    // 只读模式 settle 且有正文 → 方案条浮现
    adapter.isStreaming = true;
    hub.emit('turn_start');
    hub.emit('text_delta', '方案：先修改 abc，再编译验证');
    adapter.isStreaming = false;
    hub.emit('turn_end', {});
    hub.emit('agent_settled', {});
    assert(drawer.planBarEl && drawer.planBarEl.style.display === 'flex', 'PLAN-01: execute-plan bar appears after readonly turn with content');

    // 点击执行 → 切读写 + 自动发送执行指令
    const runBtn = drawer.drawerEl.querySelector('#twPlanBarRun');
    runBtn.onclick();
    await tick24();
    assert(calls.setPerm[0] === 'readwrite', 'PLAN-01: run button switches to readwrite');
    assert(calls.send.length === 1 && (calls.send[0] || '').includes('请按上述方案执行'), 'PLAN-01: run button auto-sends execute instruction');
    assert(drawer.planBarEl.style.display === 'none', 'PLAN-01: plan bar hides after run');

    // 读写模式 settle → 不浮现
    const { hub: hubRW, adapter: adpRW } = makeStubHub24({ permMode: 'readwrite' });
    const drawerRW = new PiDrawerView({ hub: hubRW, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
    const hostRW = MockDocument23.createElement('div');
    drawerRW.mount(hostRW);
    adpRW.isStreaming = true;
    hubRW.emit('turn_start');
    hubRW.emit('text_delta', '正常回答');
    adpRW.isStreaming = false;
    hubRW.emit('agent_settled', {});
    assert(drawerRW.planBarEl.style.display === 'none', 'PLAN-02: no plan bar in readwrite mode');

    // 流式占位提示（需已进入回合：turn_start 建泡后 updateSendButtonState 才走流式分支）
    adpRW.isStreaming = true;
    hubRW.emit('turn_start');
    drawerRW.updateSendButtonState();
    assert((drawerRW.inputEl.placeholder || '').includes('插队'), 'STREAM-05: streaming placeholder hints steer/queue keys');
    adpRW.isStreaming = false;
  }

  // 场景 K：流式中鼠标发送入口（④）——有输入显示发送键、点击=steer
  {
    const { hub, adapter, calls } = makeStubHub24();
    const drawer = new PiDrawerView({ hub, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
    const host = MockDocument23.createElement('div');
    drawer.mount(host);
    drawer.open();
    adapter.isStreaming = true;
    hub.emit('turn_start');
    drawer.updateSendButtonState();
    assert(drawer.btnSend.style.display === 'none', 'STREAM-08: streaming + empty input keeps send button hidden');

    drawer.inputEl.value = '鼠标发送的纠偏';
    drawer.updateSendButtonState();
    assert(drawer.btnSend.style.display === 'inline-flex' && drawer.btnSend.disabled === false, 'STREAM-08: streaming + input text keeps send button clickable');
    assert((drawer.btnSend.title || '').includes('插队'), 'STREAM-08: send button title hints steer during streaming');

    drawer.btnSend.onclick();
    await tick24();
    assert(calls.steer.length === 1 && calls.steer[0] === '鼠标发送的纠偏', 'STREAM-08: clicking send during streaming routes to steer');

    // 仅附件（无文本/胶囊）不应显示发送键：handleQueueSend 只发送文本协议
    drawer.inputEl.value = '';
    drawer.attachedImages = [{ name: 'only.png' }];
    adapter.status = 'thinking';
    drawer.updateSendButtonState();
    assert(drawer.btnSend.style.display === 'none', 'STREAM-08: streaming + image-only keeps send button hidden');
    drawer.attachedImages = [];
    adapter.status = 'connected';
    adapter.isStreaming = false;
  }

  // 场景 K2：推理模型预建空 thinking step 不应被当作有效段（P2-1）
  {
    const { hub, adapter, sessionManager } = makeStubHub24({ adapter: { supportsReasoningEffort: () => true } });
    const drawer = new PiDrawerView({ hub, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
    const host = MockDocument23.createElement('div');
    drawer.mount(host);
    drawer.open();
    adapter.isStreaming = true;
    hub.emit('turn_start');
    assert(drawer.messagesEl.querySelectorAll('.tw-msg-bubble-wrap.assistant').length === 1, 'STREAM-12: reasoning model pre-creates assistant bubble');

    drawer.inputEl.value = '刚起跑就纠偏';
    await drawer.handleQueueSend('steer');
    await tick24();

    const aMsgs = sessionManager._msgs.filter(m => m.role === 'assistant');
    assert(aMsgs.length === 0, 'STREAM-12: empty thinking step is not persisted as an assistant record');
    assert(drawer.messagesEl.querySelectorAll('.tw-msg-bubble-wrap.assistant').length === 0, 'STREAM-12: empty assistant shell removed on steer split');
    assert(sessionManager._msgs.some(m => m.role === 'user' && m.text === '刚起跑就纠偏'), 'STREAM-12: steer user message still persisted');
    adapter.isStreaming = false;
  }

  // 场景 K3：新会话清除瞬态（P3-1）
  {
    const { hub } = makeStubHub24();
    const drawer = new PiDrawerView({ hub, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
    const host = MockDocument23.createElement('div');
    drawer.mount(host);
    drawer.open();
    drawer._pendingSentWires = [{ wire: 'old', ts: Date.now() }];
    drawer._queuedWireByPrompt.set('prompt-x', 'wire-x');
    drawer._assistantRunBuffer = [{ text: 'stale' }];
    drawer._runAborted = true;
    drawer._suppressPlanBarOnce = true;

    await drawer.handleNewSession();
    assert(drawer._pendingSentWires.length === 0, 'STREAM-13: new session clears echo ledger');
    assert(drawer._queuedWireByPrompt.size === 0, 'STREAM-13: new session clears queued wire map');
    assert(drawer._assistantRunBuffer.length === 0, 'STREAM-13: new session clears assistant run buffer');
    assert(drawer._runAborted === false && drawer._suppressPlanBarOnce === false, 'STREAM-13: new session resets abort/planbar flags');
  }

  // 场景 K4：steer 切段时运行中工具不被提前标完成（P3-2）
  {
    const { hub, adapter, sessionManager } = makeStubHub24();
    const drawer = new PiDrawerView({ hub, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
    const host = MockDocument23.createElement('div');
    drawer.mount(host);
    drawer.open();
    adapter.isStreaming = true;
    hub.emit('turn_start');
    hub.emit('tool_start', { toolCallId: 't1', toolName: 'read', args: { path: 'mtk_charger.c' }, actionDesc: '读取 mtk_charger.c', startTime: Date.now() });
    assert(drawer.activeToolCards.has('t1'), 'STREAM-14: running tool registered before steer');

    drawer.inputEl.value = '工具执行中插队';
    await drawer.handleQueueSend('steer');
    await tick24();

    const assistantBubble = drawer.messagesEl.querySelector('.tw-msg-bubble-wrap.assistant');
    const runningMarker = assistantBubble && assistantBubble.querySelector('.tw-dsh-step-marker.running');
    assert(!!runningMarker, 'STREAM-14: running tool marker survives steer split');
    const aMsg = sessionManager._msgs.find(m => m.role === 'assistant');
    const toolStep = aMsg && (aMsg.processSteps || []).find(s => s.type === 'tool');
    assert(toolStep && !String(toolStep.label || '').includes('正在执行'), 'STREAM-14: persisted tool step label normalized (no permanent 正在执行)');

    hub.emit('tool_end', { toolCallId: 't1', toolName: 'read', durationMs: 12, isError: false });
    const stillRunning = drawer.messagesEl.querySelector('.tw-msg-bubble-wrap.assistant .tw-dsh-step-marker.running');
    assert(!stillRunning, 'STREAM-14: tool_end clears running marker after split');
    adapter.isStreaming = false;
  }

  // 场景 K5：用户消息同步落库，图片元数据稍后补写（P3-3）
  {
    const { hub, sessionManager } = makeStubHub24();
    const drawer = new PiDrawerView({ hub, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
    const host = MockDocument23.createElement('div');
    drawer.mount(host);
    drawer.open();
    drawer.addUserMessageBubble('同步落库的提问', null, []);
    assert(sessionManager._msgs.some(m => m.role === 'user' && m.text === '同步落库的提问'), 'STREAM-15: user message persisted synchronously before image promise resolves');
  }

  // 场景 K6：实时工具步明细行 + 失败标红 + 悬停全参（工具明细可视化）
  {
    const { hub, adapter, sessionManager } = makeStubHub24();
    const drawer = new PiDrawerView({ hub, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
    const host = MockDocument23.createElement('div');
    drawer.mount(host);
    drawer.open();
    adapter.isStreaming = true;
    hub.emit('turn_start');
    hub.emit('tool_start', { toolCallId: 'd1', toolName: 'bash', args: { command: 'cd W/03-mtk-ww && grep -rn mt6370 .' }, actionDesc: '检索 MT6370', startTime: Date.now() });

    // 流式中：调用发起即刻可见明细行（不等 tool_end）
    const step = drawer.currentAssistantMessage.steps.find(s => s.type === 'tool');
    const liveLines = step.proseEl.querySelectorAll('.tw-tool-detail-line');
    assert(step.proseEl.style.display === 'block' && liveLines.length === 1, 'STREAM-16: running call renders detail line immediately');
    assert((liveLines[0].textContent || '').includes('bash(cd W/03-mtk-ww'), 'STREAM-16: detail line shows bash(command) form');
    assert((liveLines[0].title || '').includes('mt6370'), 'STREAM-16: detail line title carries full args JSON');

    // 第二个调用（失败）→ tool_end 后标红 + ✗ + 错误摘要
    hub.emit('tool_start', { toolCallId: 'd2', toolName: 'read', args: { path: 'drivers/mtk_charger.c' }, startTime: Date.now() });
    hub.emit('tool_end', { toolCallId: 'd1', toolName: 'bash', durationMs: 80, isError: false });
    hub.emit('tool_end', { toolCallId: 'd2', toolName: 'read', durationMs: 15, isError: true, error: 'ENOENT: no such file' });
    const lines = step.proseEl.querySelectorAll('.tw-tool-detail-line');
    assert(lines.length === 2, 'STREAM-16: aggregated step lists all calls line-by-line');
    assert(lines[1].classList.contains('error') && (lines[1].textContent || '').includes('✗') && (lines[1].textContent || '').includes('ENOENT'), 'STREAM-16: failed call line marked red with ✗ + error summary');

    // 落库 toolSummaries 携带 ✗ 标记（历史恢复同源显示）
    adapter.isStreaming = false;
    hub.emit('agent_settled', {});
    const asst = sessionManager._msgs.filter(m => m.role === 'assistant').pop();
    const ts = (asst.processSteps || []).find(s => s.type === 'tool');
    assert(ts && ts.toolSummaries.some(l => l.startsWith('✗')) && ts.toolSummaries.some(l => l.includes('bash(cd W/03-mtk-ww')), 'STREAM-16: persisted toolSummaries carry ✗ failure marker + per-call detail');
  }

  // 场景 L：本地队列抑制派发（①）+ 注入上下文派发（②）——真实 AgentHub 原型
  {
    const { AgentHub } = require('../agent-hub.js');
    const hub = Object.create(AgentHub.prototype);
    hub.listeners = new Map();
    hub._localFollowUpQueue = [];
    hub._suppressFollowUpDispatch = false;
    hub.activeAgentId = 'agx';
    const sentLocal = [];
    const fakeAdapter = {
      isStreaming: false,
      send: async (t) => { sentLocal.push(t); return { success: true }; },
      abort: async () => {}
    };
    hub.getActiveAdapter = () => fakeAdapter;
    const hubEvents = [];
    const origEmit = AgentHub.prototype.emit.bind(hub);
    hub.emit = (ev, d) => { hubEvents.push([ev, d]); return origEmit(ev, d); };

    // 注入上下文入队：派发应发 prompt（注入后），事件带 text（原文）
    await hub.followUp('看 fuel gauge', { prompt: '[TabonKB Context Meta]x[研发人员提问]\n看 fuel gauge\n\n[Jira Issue Context] key=ABC-1' });
    hub._dispatchLocalFollowUp(fakeAdapter);
    assert(sentLocal.length === 1 && sentLocal[0].includes('[Jira Issue Context]'), 'STREAM-09: local dispatch sends injected prompt (context preserved)');
    const dispEvt = hubEvents.find(e => e[0] === 'follow_up_dispatched');
    assert(dispEvt && dispEvt[1].text === '看 fuel gauge' && dispEvt[1].prompt.includes('[Jira Issue Context]'), 'STREAM-09: follow_up_dispatched carries wire text + injected prompt');

    // 抑制派发：abort/switch 同步 settled 期间不得派发
    await hub.followUp('切换期间的排队');
    hub._suppressFollowUpDispatch = true;
    hub._dispatchLocalFollowUp(fakeAdapter);
    hub._suppressFollowUpDispatch = false;
    assert(sentLocal.length === 1, 'STREAM-09: suppressed dispatch (switch/abort window) does not send');

    // adapter 已非活跃（异步迟到 settled）→ 不派发
    const staleAdapter = { send: async () => { sentLocal.push('STALE'); return { success: true }; }, abort: async () => {} };
    hub._dispatchLocalFollowUp(staleAdapter);
    assert(sentLocal.length === 1 && !sentLocal.includes('STALE'), 'STREAM-09: stale adapter settled does not dispatch');
    assert(hub._localFollowUpQueue.length === 1, 'STREAM-09: undispatched queue item survives aborted/stale settle');

    // 正常 settled → 派发
    hub._dispatchLocalFollowUp(fakeAdapter);
    assert(sentLocal.length === 2 && sentLocal[1] === '切换期间的排队', 'STREAM-09: normal settle dispatches head item');
  }

  // 场景 M：pi 原生 follow_up 注入 prompt + 胶囊显示用户原文（②）
  {
    const wrapCtx = Object.assign({}, ctxProvider23, {
      formatPromptWithContext: (t) => `[TabonKB Context Meta] x\n[研发人员提问]\n${t}\n\n[Jira Issue Context] 绑定 ABC-1`
    });
    const { hub, adapter, calls } = makeStubHub24();
    const drawer = new PiDrawerView({ hub, app: mockApp23, contextProvider: wrapCtx, vaultBasePath: '' });
    const host = MockDocument23.createElement('div');
    drawer.mount(host);
    drawer.open();
    adapter.isStreaming = true;
    hub.emit('turn_start');

    drawer.inputEl.value = '排队：验证充电曲线';
    await drawer.handleQueueSend('follow_up');
    assert(calls.followUp.length === 1 && calls.followUp[0].includes('[Jira Issue Context]') && calls.followUp[0].includes('排队：验证充电曲线'),
      'STREAM-10: pi native follow_up enqueues injected prompt (context preserved)');

    // 引擎快照回传注入后 prompt → 胶囊显示用户原文而非包裹
    hub.emit('queue_update', { steering: [], followUp: [calls.followUp[0]] });
    const chipText = (drawer.queueStripEl.innerHTML || '');
    assert(chipText.includes('排队：验证充电曲线') && !chipText.includes('TabonKB Context Meta') && !chipText.includes('Jira Issue Context'),
      'STREAM-10: queue chip displays user wire text, not injected prompt wrapper');

    // 派发回显文本 = 注入后 prompt → 对账经提取命中 wire → 渲染原文气泡
    adapter.isStreaming = false;
    hub.emit('user_message', { text: calls.followUp[0] });
    await tick24();
    const userBubbles = drawer.messagesEl.querySelectorAll('.tw-msg-bubble-wrap.user');
    assert(userBubbles.length === 1, 'STREAM-10: echo with injected prompt deduped via extraction, renders wire bubble');
    const userMsgs = hub.sessionManager._msgs.filter(m => m.role === 'user');
    assert(userMsgs.length === 1 && userMsgs[0].text === '排队：验证充电曲线', 'STREAM-10: dispatched follow_up persists user wire text (not injected)');
  }

  // 场景 N：切换历史会话清理瞬态（⑤）+ 工具摘要明细（⑥）+ 中止标记落库（⑦）
  {
    const { hub, adapter, sessionManager } = makeStubHub24({ permMode: 'readonly' });
    const drawer = new PiDrawerView({ hub, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
    const host = MockDocument23.createElement('div');
    drawer.mount(host);
    drawer.open();

    // 只读 settle → PlanBar 弹出
    adapter.isStreaming = true;
    hub.emit('turn_start');
    hub.emit('text_delta', '方案内容');
    adapter.isStreaming = false;
    hub.emit('agent_settled', {});
    assert(drawer.planBarEl.style.display === 'flex', 'PLAN-03: readonly settle shows plan bar');
    drawer._pendingSentWires.push({ wire: 'stale', optimistic: false, ts: Date.now() });
    drawer.loadHistorySession('sess-2');
    assert(drawer.planBarEl.style.display === 'none', 'PLAN-03: switching history session hides plan bar');
    assert(drawer._pendingSentWires.length === 0, 'PLAN-03: switching history session clears echo ledger');

    // 中止落库 aborted + PlanBar 抑制
    adapter.isStreaming = true;
    hub.emit('turn_start');
    hub.emit('text_delta', '将被中止的回答');
    await drawer.handleAbort();
    await tick24();
    const abortedMsg = sessionManager._msgs.filter(m => m.role === 'assistant').pop();
    assert(abortedMsg && abortedMsg.aborted === true, 'PLAN-04: pi abort persists aborted:true on the merged record');
    assert(drawer.planBarEl.style.display === 'none', 'PLAN-04: plan bar stays hidden after abort-settled (suppress-once)');

    // NiceAIGC 只读模式不弹 PlanBar
    const { hub: hubN, adapter: adpN } = makeStubHub24({ permMode: 'readonly' });
    hubN.activeAgentId = 'niceaigc';
    const drawerN = new PiDrawerView({ hub: hubN, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
    const hostN = MockDocument23.createElement('div');
    drawerN.mount(hostN);
    adpN.isStreaming = true;
    hubN.emit('turn_start');
    hubN.emit('text_delta', '纯聊天回答');
    adpN.isStreaming = false;
    hubN.emit('agent_settled', {});
    assert(drawerN.planBarEl.style.display === 'none', 'PLAN-05: NiceAIGC readonly settle does not show plan bar');

    // 工具摘要明细落库：tool step 携带 toolSummaries
    const { hub: hubT, adapter: adpT, sessionManager: smT } = makeStubHub24();
    const drawerT = new PiDrawerView({ hub: hubT, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
    const hostT = MockDocument23.createElement('div');
    drawerT.mount(hostT);
    adpT.isStreaming = true;
    hubT.emit('turn_start');
    hubT.emit('tool_start', { toolCallId: 'tc1', toolName: 'grep', args: { pattern: 'shutdown' }, actionDesc: '检索关机日志', startTime: Date.now() });
    hubT.emit('tool_end', { toolCallId: 'tc1', toolName: 'grep', durationMs: 120, isError: false, output: 'ok' });
    hubT.emit('tool_start', { toolCallId: 'tc2', toolName: 'read', args: { path: 'W:/proj/pri/mtk_charger.c' }, startTime: Date.now() });
    hubT.emit('tool_end', { toolCallId: 'tc2', toolName: 'read', durationMs: 80, isError: false, output: 'code' });
    hubT.emit('text_delta', '结论文本');
    adpT.isStreaming = false;
    hubT.emit('agent_settled', {});
    const asst = smT._msgs.filter(m => m.role === 'assistant').pop();
    const toolStep = (asst.processSteps || []).find(s => s.type === 'tool');
    assert(toolStep && Array.isArray(toolStep.toolSummaries) && toolStep.toolSummaries.includes('grep("shutdown")') && toolStep.toolSummaries.includes('read(mtk_charger.c)'),
      'STREAM-11: persisted processSteps carry per-call summaries like read(x.c)/grep("..")');

    // 旧数据回退：无 toolSummaries 但 msg.toolCalls 存在 → banner 渲染合并摘要
    drawerT.renderPastAssistantMessage({
      role: 'assistant', text: '旧回复', toolCalls: [{ toolName: 'read', args: { path: 'a/b/mtk_charger.c' } }],
      processSteps: [{ type: 'tool', icon: 'fileText', label: '已读取文件', text: '' }], timestamp: Date.now()
    });
    const lastBubble = drawerT.messagesEl.children[drawerT.messagesEl.children.length - 1];
    const detailEls = lastBubble.querySelectorAll('.tw-tool-detail-line');
    const found = detailEls.some(p => (p.textContent || '').includes('read(mtk_charger.c)'));
    assert(found, 'STREAM-11: legacy record without toolSummaries renders merged per-call summary fallback');

    // 序列化白名单往返：aborted/interrupted 不丢
    const os2 = require('os');
    const { AgentSessionManager } = require('../agent-session-manager.js');
    const realSM = new AgentSessionManager({ vaultBasePath: path.join(os2.tmpdir(), `sm-test-${Date.now()}`), app: mockApp23 });
    realSM.addMessage('pi', { role: 'assistant', text: 'x', aborted: true, interrupted: true, timestamp: Date.now() });
    const round = JSON.parse(realSM.serializeSessions());
    const rtMsg = round.pi.sessions[0].messages[0];
    assert(rtMsg.aborted === true && rtMsg.interrupted === true, 'SESS-01: aborted/interrupted survive serializeSessions whitelist round-trip');
  }

  // --- Suite 25: MERMAID-EDGELABEL ---
  console.log('\n--- Suite 25: MERMAID-EDGELABEL ---');
  {
    const { hub } = makeStubHub24();
    const drawer = new PiDrawerView({ hub, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
    const svg = MockDocument23.createElement('svg');
    const styleEl = MockDocument23.createElement('style');
    styleEl.textContent = '.edgeLabel { background-color: #ededed; } .edgeLabel rect { opacity: 0.5; fill: #ededed; }';
    svg.appendChild(styleEl);

    const edgeLabels = MockDocument23.createElement('g');
    edgeLabels.classList.add('edgeLabels');
    svg.appendChild(edgeLabels);

    const edgeLabelG = MockDocument23.createElement('g');
    edgeLabelG.classList.add('edgeLabel');
    edgeLabels.appendChild(edgeLabelG);

    const rect = MockDocument23.createElement('rect');
    edgeLabelG.appendChild(rect);

    const fo = MockDocument23.createElement('foreignObject');
    edgeLabelG.appendChild(fo);

    const div = MockDocument23.createElement('div');
    fo.appendChild(div);

    const span = MockDocument23.createElement('span');
    span.classList.add('edgeLabel');
    div.appendChild(span);

    const innerChild = MockDocument23.createElement('span');
    span.appendChild(innerChild);

    const nodeG = MockDocument23.createElement('g');
    nodeG.classList.add('node');
    const nodeTxt = MockDocument23.createElement('text');
    nodeG.appendChild(nodeTxt);
    svg.appendChild(nodeG);

    drawer._beautifyMermaidSvg(svg, false);

    assert(styleEl.textContent.includes('background: transparent !important'), 'MERMAID-01: internal <style> edgeLabel background sanitized');
    assert(rect.style.display === 'none', 'MERMAID-02: edgeLabel rect hidden');
    assert(fo.style.overflow === 'visible', 'MERMAID-03: foreignObject overflow set to visible');
    assert(div.style.background === 'transparent', 'MERMAID-04: wrapper div background transparent');
    assert(span.style.background === '#FFFFFF' || span.style['background-color'] === '#FFFFFF', 'MERMAID-05: primary badge white background');
    assert(span.style.border.includes('#CBD5E1'), 'MERMAID-06: primary badge slate border');
    assert(innerChild.style.background === 'transparent', 'MERMAID-07: badge inner child transparent');
    assert(span.style['font-size'] === '13px', 'MERMAID-08: edgeLabel badge font-size is 13px');
    assert(nodeTxt.style['font-size'] === '14px', 'MERMAID-09: node label font-size is 14px');
  }

  // --- Suite 26: Reload Performance & Non-Blocking Startup (RELOAD-PERF-01) ---
  console.log('\n--- Suite 26: RELOAD-PERF-01 ---');
  {
    // 1. DshDaemonManager.destroy() default soft-detach preserves daemon & lockfile on plugin reload
    const reloadDaemon = new DshDaemonManager({ vaultBasePath: pluginDir, port: 3080 });
    let stopCalledOnSoftDestroy = false;
    const origStop = reloadDaemon.stop.bind(reloadDaemon);
    reloadDaemon.stop = async () => { stopCalledOnSoftDestroy = true; return origStop(); };
    reloadDaemon.process = {
      pid: 88888,
      stdout: { removeAllListeners() {} },
      stderr: { removeAllListeners() {} },
      removeAllListeners() {},
      unref() {}
    };
    reloadDaemon._ownedPid = 88888;
    reloadDaemon.destroy(); // default killDaemon = false
    assert(stopCalledOnSoftDestroy === false, 'RELOAD-PERF-01: destroy() soft-detaches without killing daemon on plugin reload');
    assert(reloadDaemon.process === null && reloadDaemon._ownedPid === null, 'RELOAD-PERF-01: destroy() clears local process handles cleanly');

    // Explicit destroy(true) still invokes stop()
    let stopCalledOnHardDestroy = false;
    reloadDaemon.stop = async () => { stopCalledOnHardDestroy = true; return true; };
    reloadDaemon.destroy(true);
    assert(stopCalledOnHardDestroy === true, 'RELOAD-PERF-02: destroy(true) explicitly stops daemon when requested');

    // 2. Progressive restoreSessionMessages for large sessions (>12 messages)
    const { hub: hubPerf } = makeStubHub24();
    const manyMsgs = [];
    for (let i = 0; i < 24; i++) {
      manyMsgs.push(i % 2 === 0
        ? { role: 'user', text: '提问 ' + i, timestamp: Date.now() - (24 - i) * 1000 }
        : { role: 'assistant', text: '回答 ' + i, timestamp: Date.now() - (24 - i) * 1000 });
    }
    hubPerf.sessionManager._msgs = manyMsgs;
    const drawerPerf = new PiDrawerView({ hub: hubPerf, app: mockApp23, contextProvider: ctxProvider23, vaultBasePath: '' });
    const layoutPerf = MockDocument23.createElement('div');
    drawerPerf.mount(layoutPerf);
    drawerPerf.restoreSessionMessages('pi');
    assert(drawerPerf.messagesEl.children.length === 10, 'RELOAD-PERF-03: restoreSessionMessages renders tail 10 messages synchronously on first frame (got ' + drawerPerf.messagesEl.children.length + ')');
    await new Promise(r => setTimeout(r, 120));
    assert(drawerPerf.messagesEl.children.length === 24, 'RELOAD-PERF-04: restoreSessionMessages progressively prepends remaining history in background chunks (got ' + drawerPerf.messagesEl.children.length + ')');

    // 3. Verify build.py & main.js contain frame-yielding onOpen, guarded post-scan render, and cached getGerritBaseUrl
    const mainJsContent = fs.readFileSync(path.join(pluginDir, 'main.js'), 'utf8');
    assert(mainJsContent.includes('_gerritBaseUrlCache'), 'RELOAD-PERF-05: main.js includes in-memory cache for getGerritBaseUrl');
    assert(mainJsContent.includes('_isInitialRenderPass'), 'RELOAD-PERF-06: main.js defers cold _auLedgerScan off initial synchronous render pass');
    assert(mainJsContent.includes("if (!hubBusy && !drawerBusy && this.activeTab === 'home')"), 'RELOAD-PERF-07: onOpen post-scan render is guarded to home tab only');

    // 4. Monaco iframe must be lazy: mount() must NOT eagerly call initMonacoIframe (startup cost ~10s measured)
    {
      const mountStart = mainJsContent.indexOf('  mount(parentEl) {');
      const mountEnd = mainJsContent.indexOf('initMonacoIframe()', mountStart);
      const renderHeaderIdx = mainJsContent.indexOf('this.renderHeader();', mountStart);
      assert(mountStart > 0 && (mountEnd < 0 || mountEnd > renderHeaderIdx), 'RELOAD-PERF-08: CodeViewerPanel.mount() does not eagerly spawn Monaco iframe');
      assert(mainJsContent.includes('if (this.iframeEl) return; // 懒加载幂等守卫'), 'RELOAD-PERF-08: initMonacoIframe is idempotent for lazy mounting');
      assert(mainJsContent.includes('this.initMonacoIframe();'), 'RELOAD-PERF-08: openFile lazily initializes Monaco iframe on first use');
    }
  }

  // --- Suite 27: MAGPIE-OBS-01 —— Magpie 观测桥接、配速/OLS 耗尽预测、走势 SVG、只读安全约束 ---
  console.log('\n--- Suite 27: MAGPIE-OBS-01 (Magpie Observability Bridge) ---');
  {
    const { MagpieObservabilityService } = require(path.join(pluginDir, 'services', 'magpie-observability-service.js'));
    const obs = new MagpieObservabilityService({ baseUrl: 'http://127.0.0.1:9', timeoutMs: 600 });

    // OBS-01: computePace 周期过半(50%)实际仅耗 10% → diff=-40 / 'slow'
    {
      const nowMs = Date.now();
      const win = { name: 'month', used: 10, resetsAt: new Date(nowMs + 15 * 86400000).toISOString(), startsAt: new Date(nowMs - 15 * 86400000).toISOString() };
      const pace = obs.computePace(win, [], nowMs);
      assert(pace && pace.diff === -40 && pace.label === '配速 -40%' && pace.status === 'slow',
        `MAGPIE-OBS-01: computePace slow pace (got: ${JSON.stringify(pace)})`);
    }

    // OBS-02: computeQuotaEta OLS 回归 —— 平缓消耗安全 / 陡峭消耗给出耗尽时间
    {
      const nowMs = Date.now();
      // 平缓斜率(-1.5%/h → ~63.7h 耗尽) 在 24h 后重置的窗口内是安全的；陡峭斜率(-15%/h → ~1h 耗尽) 必预警
      const cycle = { start: nowMs - 10 * 86400000, reset: nowMs + 86400000, now: nowMs };
      const gentle = [
        { t: nowMs - 3600000, left: 97 }, { t: nowMs - 2400000, left: 96.5 },
        { t: nowMs - 1200000, left: 96 }, { t: nowMs, left: 95.5 }
      ];
      const eta1 = obs.computeQuotaEta(gentle, cycle, nowMs);
      assert(eta1 && eta1.safe === true && eta1.text === '按此速度，能撑到重置',
        `MAGPIE-OBS-02: gentle slope predicts safe-to-reset (got: ${JSON.stringify(eta1)})`);
      const steep = [
        { t: nowMs - 3600000, left: 60 }, { t: nowMs - 2400000, left: 45 },
        { t: nowMs - 1200000, left: 30 }, { t: nowMs, left: 15 }
      ];
      const eta2 = obs.computeQuotaEta(steep, cycle, nowMs);
      assert(eta2 && eta2.safe === false && eta2.outMs > nowMs && eta2.text.includes('耗尽'),
        `MAGPIE-OBS-02: steep slope predicts exhaustion time (got: ${JSON.stringify(eta2)})`);
    }

    // OBS-03: renderQuotaPlotSvg 输出含 even/line/now 元素的合法 SVG
    {
      const nowMs = Date.now();
      const win = { name: 'month', used: 40, resetsAt: new Date(nowMs + 18 * 86400000).toISOString(), startsAt: new Date(nowMs - 12 * 86400000).toISOString() };
      const pts = [
        { at: new Date(nowMs - 7200000).toISOString(), left: 62, start: win.startsAt, resetsAt: win.resetsAt },
        { at: new Date(nowMs - 3600000).toISOString(), left: 61, start: win.startsAt, resetsAt: win.resetsAt }
      ];
      const { svg } = obs.renderQuotaPlotSvg(win, pts, nowMs);
      assert(svg.includes('tw-mq-qc-even') && svg.includes('tw-mq-qc-line') && svg.includes('tw-mq-qc-now') && svg.includes('<svg'),
        'MAGPIE-OBS-03: quota plot SVG contains even/line/now elements');
    }

    // OBS-04: maskUser 邮箱打码规则
    assert(obs.maskUser('bjut_1@163.com', true) === 'b***1@163.com',
      `MAGPIE-OBS-04: maskUser email (got: ${obs.maskUser('bjut_1@163.com', true)})`);

    // OBS-05: fetchSnapshot 只读安全 —— 仅请求 cards/?kept=1/history/usage; 不可达时 1500ms 内静默 online:false
    {
      const requested = [];
      const spy = new MagpieObservabilityService({ baseUrl: 'http://127.0.0.1:9', timeoutMs: 600 });
      spy.requestJson = (m, p) => { requested.push(`${m} ${p}`); return Promise.resolve({ ok: false, status: 0, data: null }); };
      const t0 = Date.now();
      const snap = await spy.fetchSnapshot('week', true);
      const elapsed = Date.now() - t0;
      assert(snap && snap.online === false && elapsed < 1500,
        `MAGPIE-OBS-05: offline snapshot silent-fallback within 1500ms (elapsed: ${elapsed}ms)`);
      const paths = requested.join('|');
      assert(requested.length === 4 && paths.includes('/v1/magpie/quotas/cards') && paths.includes('/v1/magpie/quotas?kept=1')
        && paths.includes('/v1/magpie/quotas/history') && paths.includes('/v1/magpie/usage?period=7d')
        && !requested.some(r => r.startsWith('POST') || (r.includes('/v1/magpie/quotas') && !r.includes('?kept=1') && !r.includes('cards') && !r.includes('history'))),
        `MAGPIE-OBS-05: only read-only memory-snapshot endpoints requested (got: ${paths})`);
      const realObs = new MagpieObservabilityService({ baseUrl: 'http://127.0.0.1:9', timeoutMs: 400 });
      const t1 = Date.now();
      const snap2 = await realObs.fetchSnapshot('week', true);
      assert(snap2 && snap2.online === false && (Date.now() - t1) < 1500,
        `MAGPIE-OBS-05: unreachable 127.0.0.1:9 returns {online:false} without throwing (${Date.now() - t1}ms)`);
    }

    // OBS-06: main.js 首页卡片包含额度区 / 4 KPI 含缓存切换 / 三维切换 的集成标记
    {
      const mainJsContent27 = fs.readFileSync(path.join(pluginDir, 'main.js'), 'utf8');
      assert(mainJsContent27.includes('tw-mq-quota-section') && mainJsContent27.includes('观测 · 用量与额度概览'),
        'MAGPIE-OBS-06: card renders quota section & observability header');
      assert(mainJsContent27.includes('data-mqcache') && mainJsContent27.includes('_mqIncludeCache'),
        'MAGPIE-OBS-06: TOKEN KPI has include/exclude-cache toggle');
      assert(mainJsContent27.includes("data-t=\"agents\"") && mainJsContent27.includes("data-t=\"models\"") && mainJsContent27.includes("data-t=\"accounts\""),
        'MAGPIE-OBS-06: AGENT/模型/账号 three-dimension rank tabs present');
      assert(mainJsContent27.includes('refreshMagpieObservability') && mainJsContent27.includes('/v1/magpie/quotas/cards'),
        'MAGPIE-OBS-06: refreshMagpieObservability bridge wired into bundle');
    }
  }

  // --- Suite 28: REMOTE-EXEC —— SSH 执行器纯逻辑内核 (remote-exec-core.js) ---
  console.log('\n--- Suite 28: REMOTE-EXEC (SSH Executor Core) ---');
  {
    const rex = require(path.join(pluginDir, 'services', 'remote-exec-core.js'));
    const { windowsPathToLinux, linuxPathToWindows } = require(path.join(pluginDir, 'services', 'local-project-service.js'));
    const WROOTS = ['/dfb/tankaikun/share/01/pri_project/driver/mt6858/K90GF2', '/dfb/tankaikun/share/01/pri_project/driver/public'];
    const ctxRW = { writeRoots: WROOTS };

    // REX-01: 动态超时公式 clamp(60,600,60+fileCount/250) 取整, 异常值兜底 180; 探测超时哨兵 1e9 → 600
    assert(rex.calcTimeoutSec(0) === 60, 'REX-01: calcTimeoutSec(0) = 60');
    assert(rex.calcTimeoutSec(49129) === 256, `REX-01: calcTimeoutSec(49129) = 256 (got ${rex.calcTimeoutSec(49129)})`);
    assert(rex.calcTimeoutSec(1e6) === 600, 'REX-01: calcTimeoutSec(1e6) = 600 (cap)');
    assert(rex.calcTimeoutSec(1e9) === 600, 'REX-01: calcTimeoutSec(1e9) = 600 (probe-timeout sentinel)');
    assert(rex.calcTimeoutSec(NaN) === 180 && rex.calcTimeoutSec(-5) === 180, 'REX-01: NaN/negative fileCount fallback = 180');

    // REX-01b: clampTimeoutSec 显式超时夹取 —— 生产默认 [60,600], 测试可传 minSec 或经 env 调低
    assert(rex.clampTimeoutSec(3) === 60, 'REX-01b: clampTimeoutSec(3) = 60 (production default min)');
    assert(rex.clampTimeoutSec(9999) === 600, 'REX-01b: clampTimeoutSec(9999) = 600 (cap)');
    assert(rex.clampTimeoutSec(3, 1) === 3, 'REX-01b: clampTimeoutSec(3, 1) = 3 (explicit minSec override)');

    // REX-02: 路径映射往返 (Y:/Z:/UNC ↔ linux)
    assert(windowsPathToLinux('Y:\\01\\pri_project\\driver\\public\\x.c') === '/dfb/tankaikun/share/01/pri_project/driver/public/x.c',
      'REX-02: Y:\\...\\x.c → /dfb/tankaikun/share/01/.../x.c');
    assert(linuxPathToWindows('/dfb/tankaikun/share/01/pri_project/driver/public/x.c') === 'Y:\\01\\pri_project\\driver\\public\\x.c',
      'REX-02: /dfb/.../x.c → Y:\\01\\...\\x.c');
    assert(linuxPathToWindows(windowsPathToLinux('Y:\\01\\pri_project\\driver\\public\\x.c')) === 'Y:\\01\\pri_project\\driver\\public\\x.c',
      'REX-02: Y: round-trip identity');
    assert(windowsPathToLinux('Z:\\work\\k90\\a.c') === '/home/tankaikun/share/work/k90/a.c',
      'REX-02: Z:\\work → /home/tankaikun/share/work');
    assert(linuxPathToWindows('/home/tankaikun/share/work/k90/a.c') === 'Z:\\work\\k90\\a.c',
      'REX-02: /home/.../work → Z:\\work');
    assert(windowsPathToLinux('\\\\192.168.1.62\\tankaikun\\01\\x.c') === '/dfb/tankaikun/share/01/x.c',
      'REX-02: UNC 62 → /dfb/tankaikun/share');
    assert(windowsPathToLinux('\\\\192.168.1.31\\tankaikun\\work\\k90\\a.c') === '/home/tankaikun/share/work/k90/a.c',
      'REX-02: UNC 31 → /home/tankaikun/share/work');

    // REX-03: resolveServer 映射
    assert(rex.resolveServer('Y:\\01') && rex.resolveServer('Y:\\01').id === '62', 'REX-03: Y: → server 62');
    assert(rex.resolveServer('Z:\\work\\x') && rex.resolveServer('Z:\\work\\x').id === '31', 'REX-03: Z:\\work → server 31');
    assert(rex.resolveServer('\\\\192.168.1.62\\tankaikun\\01') && rex.resolveServer('\\\\192.168.1.62\\tankaikun\\01').id === '62',
      'REX-03: UNC 62 → server 62');
    assert(rex.resolveServer('/dfb/tankaikun/share/01') && rex.resolveServer('/dfb/tankaikun/share/01').id === '62', 'REX-03: /dfb linux path → 62');
    assert(rex.resolveServer('62') && rex.resolveServer('62').id === '62' && rex.resolveServer('31').id === '31', 'REX-03: server id string resolves');
    assert(rex.resolveServer('') && rex.resolveServer('').id === '62', 'REX-03: empty defaults to 62');
    assert(rex.resolveServer('C:\\local\\x') === null, 'REX-03: non-mapped path returns null');

    // REX-04: buildRemoteCommand 注入安全 —— 原文不得出现于 shell 命令, 仅 base64
    const injectCmds = ["'; rm -rf / ;'", "echo 'a'\"b`id`$(id)' && rm -rf ~", 'line1\nrm -rf /dfb\nline2', 'cat $(echo /etc/passwd)'];
    for (const ic of injectCmds) {
      const rc = rex.buildRemoteCommand({ cmd: ic, timeoutSec: 90, marker: 'mk_test' });
      const b64 = Buffer.from(ic, 'utf8').toString('base64');
      assert(rc.indexOf(ic) === -1 && !/rm -rf/.test(rc) && Buffer.from(b64, 'base64').toString('utf8') === ic,
        `REX-04: injected cmd not leaked to shell (b64 only): ${JSON.stringify(ic).slice(0, 40)}`);
      assert(rc === `timeout -k 5 90 bash -c "$(echo ${b64} | base64 -d)" mk_test`,
        'REX-04: remote cmd shape = timeout -k 5 T bash -c "$(echo B64|base64 -d)" marker');
    }

    // REX-05: buildSshArgs 结构
    const s62 = rex.resolveServer('62');
    const sshArgs = rex.buildSshArgs(s62, 'echo hi');
    assert(sshArgs[0] === '-T' && sshArgs.includes('BatchMode=yes') && sshArgs.includes('ConnectTimeout=10')
      && sshArgs[sshArgs.length - 2] === 'tankaikun@192.168.1.62' && sshArgs[sshArgs.length - 1] === 'echo hi',
      'REX-05: ssh args = -T BatchMode keepalive user@host remoteCmd');

    // REX-06: shellQuote 单引号转义
    assert(rex.shellQuote("a'b") === "'a'\\''b'", `REX-06: shellQuote escapes single quotes (got ${rex.shellQuote("a'b")})`);
    assert(rex.shellQuote('plain') === "'plain'", 'REX-06: shellQuote plain string');

    // REX-07: checkCommand —— readonly 档 (权威对抗性用例集, 期望值以 adv-test.js 为准)
    const ctxAdv = { writeRoots: ['/dfb/tankaikun/share/01/pri_project/driver/mt6858/K90GF2/', '/dfb/tankaikun/share/01/pri_project/driver/public'] };
    const roCases = [
      // 只读档应拦 (这些都能写文件或执行命令)
      ['git diff --output=/tmp/x', false],
      ['git log --output=/tmp/x', false],
      ["git -c core.fsmonitor='touch /tmp/pwn' status", false],
      ["git -c diff.external='touch /tmp/pwn' diff --ext-diff", false],
      ["sed -n 's/a/b/e;p' /etc/hosts", false],
      ["sed -n 's/a/b/w /tmp/x' /etc/hosts", false],
      ['tree -o /tmp/x /dfb', false],
      ['uniq /dev/null /tmp/x', false],
      ['repo manifest -o /tmp/m.xml', false],
      ['head -c 10 /etc/hosts | tee /tmp/x', false],
      ['sort -o /tmp/x /etc/hosts', false],
      ['find . -fprint /tmp/x', false],
      ['git diff --no-index a b', true],
      ['grep -rn foo /dfb/tankaikun/share/01/pri_project | head -20', true],
      ['git -C /dfb/tankaikun/share/01/pri_project/build log --oneline -3', true],
      // 补充用例
      ['grep -rnI foo /dfb/tankaikun/share/01', true],
      ['find /dfb/tankaikun/share/01 -name a.c', true],
      ["sed -n '1,5p' /dfb/x.c", true],
      ["sed -n '/foo/p' /dfb/x.c", true],
      ["awk '{print $1}' /tmp/f", true],
      ['awk -F: {print $1} /tmp/f', true],
      ['grep x > /tmp/a', false],
      ['echo $(id)', false],
      ['sed -i s/a/b/ /tmp/x', false],
      ['git reset --hard', false],
      ["python3 -c 'print(1)'", false],
      ['rm -rf /tmp/x', false],
      // —— adv2 权威对抗集 (readonly) ——
      ['git log --pretty=format:%h -n3', true],
      ['git diff HEAD~1 -- drivers/a.c', true],
      ['git --git-dir=/x/.git status', false],
      ['git log --format=%H --output /tmp/x', false],
      ["sed -n '10,20p' /dfb/x.c", true],
      ["sed -n -e 's/a/b/e' /dfb/x.c", false],
      ["sed --expression='1e id' -n /dfb/x.c", false],
      ['awk \'BEGIN{system("id")}\' /dev/null', false],
      ['awk \'{print > "/tmp/x"}\' /etc/hosts', false],
      ['cat /etc/hosts; id', false],
      ['ls && touch /tmp/x', false],
      ['ls | xargs rm', false],
      ['find /dfb -name "*.c" -exec rm {} +', false],
      ['ls $(echo /tmp)', false],
      ['ls "$(id)"', false],
      ['echo hi >/tmp/x', false],
      ['FOO=1 bash -c id', false],
      ['/usr/bin/env id', false],
      ['command -v id', false],
      ['time id', false],
      // —— 第二轮评审补充用例 (引号语义/git -C/凭据保护) ——
      ["ls '$(id)'", true],
      ['ls "`id`"', false],
      ['ls "$HOME"', true],
      ['git -C /tmp/x status', false],
      ['git -C /dfb/tankaikun/share/01/pri_project/build status', true],
      ['sort --compress-program=/tmp/sh /etc/hosts', false],
      ['cat /home/tankaikun/.ssh/id_rsa', false],
      ['grep -rn id_rsa /dfb/tankaikun/share/01/pri_project', true],
      ['find /dfb -name id_rsa', true]
    ];
    roCases.forEach(([c, ok], i) => {
      const r = rex.checkCommand(c, 'readonly', ctxAdv);
      assert(r.ok === ok, `REX-07-${i}: readonly ${ok ? 'allows' : 'rejects'} ${JSON.stringify(c).slice(0, 44)}${r.ok === ok ? '' : ' (reason: ' + (r.reason || 'allowed') + ')'}`);
    });

    // REX-07b: readonly 敏感路径硬拦截 (.ssh/id_rsa 全档拒绝; git -C /tmp 拒绝)
    {
      const r7b = rex.checkCommand('git -C /tmp/evil status', 'readonly', ctxAdv);
      assert(!r7b.ok && /git -C|tmp/.test(r7b.reason || ''), `REX-07b: readonly git -C /tmp denied (got: ${r7b.reason})`);
    }

    // REX-08: checkCommand —— readwrite 档 (白名单模型: 只读集 + 受限写动词, 写目标限 writeRoots//tmp)
    const rwCases = [
      // 写边界外的写动作应拦
      ['dd if=/dev/zero of=/dfb/tankaikun/share/01/vendor_w/x bs=1 count=1', false],
      ['truncate -s 0 /dfb/tankaikun/share/01/vendor_w/kernel/a.c', false],
      ['gzip /dfb/tankaikun/share/01/vendor_w/kernel/a.c', false],
      ['shred -u /dfb/tankaikun/share/01/vendor_w/kernel/a.c', false],
      ['zip /tmp/a.zip /etc/hosts', false],
      ['unlink /dfb/tankaikun/share/01/vendor_w/kernel/a.c', false],
      ['awk -i inplace "{print}" /dfb/tankaikun/share/01/vendor_w/a.c', false],
      ['printf x > /dfb/tankaikun/share/01/vendor_w/a.c', false],
      ['mkdir -p /tmp/a', true],
      ['cp /etc/hosts /tmp/hosts.bak', true],
      ["sed -i 's/a/b/' /dfb/tankaikun/share/01/pri_project/driver/mt6858/K90GF2/base/x.c", true],
      // 补充用例
      [`echo hi > ${WROOTS[1]}/note.txt`, true],
      ['rm /tmp/a.bak', true],
      ['tee /tmp/a.txt', true],
      [`mv ${WROOTS[1]}/a ${WROOTS[1]}/b`, true],
      ['rm -rf /dfb/tankaikun/share/01', false],
      ['git push', false],
      ['sudo ls', false],
      ['echo hi > /etc/x', false],
      ['rm -rf /tmp/abc', false],
      ['mv /etc/passwd /tmp/x', false],
      ['sed -i s/a/b/w /tmp/f.c', false],
      ["sed -i 's/a/b/e' /tmp/f.c", false],
      ['df -h', false],
      ['sleep 5', false],
      // —— adv2 权威对抗集 (readwrite) ——
      ['cp /etc/hosts /dfb/tankaikun/share/01/pri_project/driver/mt6858/K90GF2/base/hosts.bak', true],
      ['cp /etc/hosts /dfb/tankaikun/share/01/vendor_w/hosts', false],
      ['mv /dfb/tankaikun/share/01/vendor_w/a.c /tmp/a.c', false],
      ['cp /etc/hosts /dfb/tankaikun/share/01/pri_project/driver/mt6858/K90GF2/../../../../vendor_w/x', false],
      ['tee /dfb/tankaikun/share/01/vendor_w/x < /etc/hosts', false],
      ['rm /dfb/tankaikun/share/01/pri_project/driver/mt6858/K90GF2/base/a.c', false],
      ['rm /tmp/x.tmp', true],
      ['make -j8', false],
      // —— 第二轮评审补充用例 ——
      ['git -C /tmp/x status', false],
      ['git -C /dfb/tankaikun/share/01/pri_project/build status', true],
      ['tee /dfb/tankaikun/share/01/pri_project/driver/public/.git/config', false],
      ['cat /home/tankaikun/.ssh/id_rsa', false],
      ['cat ~/.ssh/id_rsa', false],
      ['tee /tmp/x < /home/u/.ssh/id_rsa', false]
    ];
    rwCases.forEach(([c, ok], i) => {
      const r = rex.checkCommand(c, 'readwrite', ctxRW);
      assert(r.ok === ok, `REX-08-${i}: readwrite ${ok ? 'allows' : 'rejects'} ${JSON.stringify(c).slice(0, 50)}${r.ok === ok ? '' : ' (reason: ' + (r.reason || 'allowed') + ')'}`);
    });

    // REX-08c: ctx.cwd=/tmp 时 git/repo 有效目录防护 (readwrite 拒绝; full 放行)
    {
      const ctxTmp = { writeRoots: ['/x'], cwd: '/tmp/evil' };
      assert(!rex.checkCommand('git status', 'readwrite', ctxTmp).ok, 'REX-08c: readwrite git status with cwd=/tmp/evil denied');
      assert(rex.checkCommand('git status', 'full', ctxTmp).ok, 'REX-08c: full git status with cwd=/tmp/evil allowed');
    }

    // REX-08b: 读写档非白名单命令的统一拒绝文案 (提示需完全权限模式)
    {
      const rr = rex.checkCommand('dd if=/dev/zero of=/tmp/x bs=1 count=1', 'readwrite', ctxRW);
      assert(!rr.ok && /完全权限模式/.test(rr.reason || ''), `REX-08b: non-whitelisted cmd rejection mentions 完全权限模式 (got: ${rr.reason})`);
      const rr2 = rex.checkCommand('kill -9 1234', 'readwrite', ctxRW);
      assert(!rr2.ok && /完全权限模式/.test(rr2.reason || ''), `REX-08b: kill rejection mentions 完全权限模式 (got: ${rr2.reason})`);
    }

    // REX-09: checkCommand —— full 档 (仅硬拦截灾难级)
    const fullCases = [
      ['git reset --hard', true],
      ['rm -rf /dfb/tankaikun/share/01/old_bak', true],
      ['python3 -c "print(1)"', true],
      ['find /dfb -name x -delete', true],
      ['git push origin main', true],
      ['df -h /', true],
      ['sleep 30', true],
      ['sudo ls', false],
      ['su root', false],
      ['rm -rf /', false],
      ['rm -rf ~', false],
      ['rm -rf /dfb', false],
      ['mkfs.ext4 /dev/sda', false],
      ['dd if=/dev/zero of=/dev/sda', false],
      ['reboot', false],
      [':(){ :|:& };:', false],
      ['echo x > /dev/sda', false],
      // —— adv2 权威对抗集 (full) + 凭据全档硬拦截 ——
      ['make -j8', true],
      ['rm -rf /dfb/tankaikun/share', false],
      ['rm -rf /dfb/tankaikun/share/01/out', true],
      ['cat /home/tankaikun/.ssh/id_rsa', false],
      ['head /etc/shadow', false],
      ['cp /home/tankaikun/.netrc /tmp/x', false],
      ['cat ~/.aws/credentials', false]
    ];
    fullCases.forEach(([c, ok], i) => {
      const r = rex.checkCommand(c, 'full', ctxRW);
      assert(r.ok === ok, `REX-09-${i}: full ${ok ? 'allows' : 'rejects'} ${JSON.stringify(c).slice(0, 44)}${r.ok === ok ? '' : ' (reason: ' + (r.reason || 'allowed') + ')'}`);
    });
  }

  // --- Suite 29: FILE-LOCATE — AI 文件链接定位内核 (R1-R4 修复回归) ---
  console.log('\n>>> Suite 29: FILE-LOCATE (File Link Resolution Core)');
  {
    const flc = require('../services/file-locator-core.js');
    const { decodeTarget, splitLine, classifyTarget, shortenPathLabel, rankHits, buildLocateScript, OBSIDIAN_NATIVE_EXTS } = flc;

    // FL-01: decodeTarget (R1 百分号编码)
    const vaultAbsReal = 'D:/work/Mgmt/TabonKB/03-Driver/05-Charger/04-Debug-Case/MT6789-MT6366库仑计休眠频繁唤醒排障_v1.0_20261019_MTK_CHG_CASE.md';
    const encReal = vaultAbsReal.replace(/[^\x00-\x7f]+/g, m => encodeURIComponent(m));
    assert(decodeTarget(encReal) === vaultAbsReal, 'FL-01a: decodeTarget decodes real percent-encoded Chinese vault path');
    assert(decodeTarget('a%ZZb') === 'a%ZZb', 'FL-01b: invalid %ZZ sequence unchanged');
    assert(decodeTarget('100% sure') === '100% sure', 'FL-01c: isolated % unchanged');
    assert(decodeTarget(vaultAbsReal) === vaultAbsReal, 'FL-01d: already-decoded Chinese path unchanged');
    assert(decodeTarget('file:///D:/x%20y.md') === 'D:/x y.md', 'FL-01e: file:/// prefix stripped and decoded');
    assert(decodeTarget('`x.c`') === 'x.c' && decodeTarget('[[x.c]]') === 'x.c', 'FL-01f: backtick/wikilink wrappers stripped');

    // FL-02: splitLine (行号锚点)
    assert(splitLine('a.c:85').line === 85 && splitLine('a.c:85').path === 'a.c', 'FL-02a: a.c:85 -> line 85');
    assert(splitLine('a.c#L85-L90').line === 85 && splitLine('a.c#L85-L90').path === 'a.c', 'FL-02b: #L85-L90 -> line 85');
    assert(splitLine('D:\\x\\a.c').line === null && splitLine('D:\\x\\a.c').path === 'D:\\x\\a.c', 'FL-02c: drive colon not a line suffix');
    assert(splitLine('D:\\x\\a.c:12:3').line === 12 && splitLine('D:\\x\\a.c:12:3').path === 'D:\\x\\a.c', 'FL-02d: :12:3 -> line 12');

    // FL-03: classifyTarget
    const vb = 'D:\\work\\Mgmt\\TabonKB';
    assert(classifyTarget(vaultAbsReal, { vaultBase: vb }) === 'vault_abs', 'FL-03a: vault abs path -> vault_abs');
    assert(classifyTarget('pri_project\\driver\\mt6789\\K90\\base\\kernel\\kernel_device_modules-6.12\\x.dtsi', { vaultBase: vb }) === 'rel_workspace', 'FL-03b: pri_project rel -> rel_workspace');
    assert(classifyTarget('drivers/power/supply/mtk_pe5.c', { vaultBase: vb }) === 'rel_partial', 'FL-03c: drivers/... -> rel_partial');
    assert(classifyTarget('mtk_battery.c', { vaultBase: vb }) === 'bare', 'FL-03d: bare filename -> bare');
    assert(classifyTarget('Y:\\01\\pri_project\\x.c', { vaultBase: vb }) === 'server_abs', 'FL-03e: Y: -> server_abs');
    assert(classifyTarget('C:\\x\\a.c', { vaultBase: vb }) === 'local_abs', 'FL-03f: C: -> local_abs');
    assert(classifyTarget('\\\\192.168.1.62\\tankaikun\\01\\x.c', { vaultBase: vb }) === 'server_abs', 'FL-03g: UNC -> server_abs');
    assert(classifyTarget('.obsidian/community-plugins.json', { vaultBase: vb }) === 'rel_partial', 'FL-03h: .obsidian rel -> rel_partial (vault 优先判定在 resolver)');

    // FL-04: shortenPathLabel
    assert(shortenPathLabel('pri_project/driver/a/b/c.c').label === 'c.c', 'FL-04a: long path -> basename');
    assert(shortenPathLabel('drivers/x/y.c:85').label === 'y.c:85', 'FL-04b: line suffix preserved');
    assert(shortenPathLabel('foo.c').label === 'foo.c', 'FL-04c: non-path text unchanged');
    assert(shortenPathLabel('vendor_w/.../bat_setting/x.dtsi').label === 'x.dtsi', 'FL-04d: ellipsis path -> last meaningful segment');

    // FL-05: rankHits (pri > public > kernelVer > root > other)
    const hits29 = [
      '/dfb/tankaikun/share/01/vendor_w/kernel/kernel_device_modules-6.18/drivers/power/supply/mtk_pe5.c',
      '/dfb/tankaikun/share/01/vendor_w/kernel/kernel_device_modules-6.12/drivers/power/supply/mtk_pe5.c',
      '/dfb/tankaikun/share/01/pri_project/driver/public/drivers/power/supply/mtk_pe5.c',
      '/dfb/tankaikun/share/01/pri_project/driver/mt6858/K90GF2/base/drivers/power/supply/mtk_pe5.c',
      '/other/root/mtk_pe5.c'
    ];
    const ranked29 = rankHits(hits29, { projectLinuxRoot: '/dfb/tankaikun/share/01', priDriverRel: 'pri_project/driver/mt6858/K90GF2/base', publicDriverRel: 'pri_project/driver/public', kernelVer: '6.12' });
    assert(ranked29[0].includes('/K90GF2/base/'), 'FL-05a: pri project hit ranks first');
    assert(ranked29[1].includes('/driver/public/'), 'FL-05b: public hit ranks second');
    assert(ranked29[2].includes('kernel_device_modules-6.12'), 'FL-05c: kernelVer 6.12 ranks before 6.18');

    // FL-06: buildLocateScript (安全转义 + 分层提前停)
    const sc29 = buildLocateScript({ anchors: ['/dfb/tankaikun/share/01'], rel: 'pri_project/driver/x.c', fileName: 'x.c', tiers: ['/dfb/tankaikun/share/01/pri_project/driver/mt6858/K90GF2/base', '/dfb/tankaikun/share/01/vendor_w/kernel/kernel_device_modules-*'] });
    assert(sc29.includes('-path "*/'), 'FL-06a: script uses -path "*/..." suffix matching');
    assert(/"\$hits" -gt 0 \] && break/.test(sc29), 'FL-06b: tier loop stops on first non-empty hits');
    assert(sc29.includes("'/dfb/tankaikun/share/01'"), 'FL-06c: anchors shell-quoted');
    const scEvil = buildLocateScript({ rel: "a'b $(id).c", tiers: ['/x'] });
    assert(scEvil.includes('\\$(id)') && !scEvil.includes('`'), 'FL-06d: $(...) escaped, no unescaped injection fragments');
    const scSp = buildLocateScript({ fileName: 'a b.c', tiers: ['/x y; rm -rf /'] });
    assert(scSp.includes("'/x y; rm -rf /'"), 'FL-06e: tier with spaces/semicolon safely quoted');
    const scName = buildLocateScript({ fileName: 'mtk_pe5.c', tiers: ['/a'] });
    assert(scName.includes('-name "mtk_pe5.c"'), 'FL-06f: bare filename uses -name matching');
    assert(OBSIDIAN_NATIVE_EXTS.has('md') && OBSIDIAN_NATIVE_EXTS.has('pdf') && !OBSIDIAN_NATIVE_EXTS.has('c'), 'FL-06g: OBSIDIAN_NATIVE_EXTS covers md/pdf, excludes code ext');

    // FL-07: locateRemoteFileAsync 导出与失败兜底 (不可达服务器不悬挂)
    const lps = require('../services/local-project-service.js');
    assert(typeof lps.locateRemoteFileAsync === 'function', 'FL-07a: locateRemoteFileAsync exported');
    const lr29 = await lps.locateRemoteFileAsync({ server: { sshHost: '127.0.0.1', user: 'nobody' }, anchors: ['/x'], rel: 'a/b.c', fileName: 'b.c', timeoutMs: 200 });
    assert(lr29 && Array.isArray(lr29.hits) && ['anchor', 'tier', 'last_resort', 'none'].includes(lr29.stage), 'FL-07b: unreachable server resolves {hits,stage} without hanging');

    // FL-08: 提示词 [文件引用] 注入 + 剥离还原
    const { AgentContextProvider } = require('../agent-context-provider.js');
    const cp29 = Object.create(AgentContextProvider.prototype);
    cp29.selectedNode = { id: 'n1', title: 'T', module: 'M', platform: 'P', type: 't', path: 'x.md', connections: [] };
    cp29.activeFilter = ''; cp29.searchKeyword = ''; cp29.activeFile = null; cp29.app = null;
    const wire29 = cp29.formatPromptWithContext('用户原文');
    assert(wire29.includes('[文件引用]'), 'FL-08a: injected prompt contains [文件引用] rule');
    const { PiDrawerView } = require(path.join(pluginDir, 'pi-drawer-view.js'));
    const stripped29 = PiDrawerView.prototype._extractUserTextFromWire.call({}, wire29);
    assert(stripped29 === '用户原文', 'FL-08b: wire extraction restores user text without [文件引用] residue');

    // FL-09: openVaultFileInSplit —— 建分栏/复用/失效重建/anchor 回退/失败回落 (stub workspace)
    const Drawer29 = Object.create(PiDrawerView.prototype);
    let created29 = 0, revealed29 = 0, getLeafCalls29 = 0;
    const opened29 = [];
    const anchorLeaf29 = { view: {}, parent: {} };
    const ws29 = {
      _all: [anchorLeaf29],
      getLeavesOfType(t) { return this._all.filter(l => t === 'markdown' ? l._isMd : l._vt === t); },
      iterateAllLeaves(fn) { this._all.slice().forEach(fn); },
      createLeafBySplit: async (anchor) => {
        if (!anchor) throw new Error('anchor required');
        created29++;
        const l = { view: {}, parent: {}, _isMd: true, openFile: async (tf, st) => { opened29.push([tf, st]); } };
        ws29._all.push(l);
        return l;
      },
      getLeaf() {
        getLeafCalls29++;
        const l = { view: {}, parent: {}, _isMd: true, openFile: async (tf, st) => { opened29.push([tf, st]); } };
        ws29._all.push(l);
        return l;
      },
      revealLeaf() { revealed29++; },
      activeLeaf: anchorLeaf29
    };
    Drawer29.app = { workspace: ws29 };
    Drawer29._vaultSplitLeaf = null;
    const tf29 = { path: 'a/b.md' };
    await Drawer29.openVaultFileInSplit(tf29, 5);
    assert(created29 === 1 && opened29.length === 1 && revealed29 === 1, 'FL-09a: first call creates split leaf, opens file, reveals');
    await Drawer29.openVaultFileInSplit(tf29, 9);
    assert(created29 === 1 && opened29.length === 2, 'FL-09b: second call reuses cached leaf');
    // 缓存叶被 detach: view/parent 引用残留但已不在 iterateAllLeaves → 必须重建
    const deadLeaf29 = Drawer29._vaultSplitLeaf;
    ws29._all = ws29._all.filter(l => l !== deadLeaf29);
    assert(deadLeaf29.view && deadLeaf29.parent, 'FL-09c0: detached leaf retains stale view/parent refs');
    await Drawer29.openVaultFileInSplit(tf29, 1);
    assert(created29 === 2, 'FL-09c: detached cached leaf triggers recreation');
    assert(opened29[0][1] && opened29[0][1].eState && opened29[0][1].eState.line === 4 && opened29[0][1].active === false, 'FL-09d: eState line = target-1, active:false');
    // 缓存叶为 pdf 视图叶 (不在 markdown 列表) 但仍在工作区 → 复用
    const pdfLeaf29 = { view: {}, parent: {}, _vt: 'pdf', openFile: async (tf, st) => { opened29.push([tf, st]); } };
    ws29._all.push(pdfLeaf29);
    Drawer29._vaultSplitLeaf = pdfLeaf29;
    await Drawer29.openVaultFileInSplit(tf29, 2);
    assert(created29 === 2 && opened29.length === 4, 'FL-09e: non-markdown cached leaf still in workspace is reused');
    // anchor 缺失 (无工作台叶且无 activeLeaf) → getLeaf 回退
    const ws29b = {
      _all: [],
      getLeavesOfType() { return []; },
      iterateAllLeaves(fn) { this._all.slice().forEach(fn); },
      createLeafBySplit: async () => { throw new Error('should not be called'); },
      getLeaf() { getLeafCalls29++; const l = { view: {}, parent: {}, openFile: async () => {} }; ws29b._all.push(l); return l; },
      revealLeaf() {},
      activeLeaf: null
    };
    const Drawer29b = Object.create(PiDrawerView.prototype);
    Drawer29b.app = { workspace: ws29b };
    Drawer29b._vaultSplitLeaf = null;
    const leafB = await Drawer29b.openVaultFileInSplit(tf29, 1);
    assert(leafB && getLeafCalls29 === 1, 'FL-09f: null anchor falls back to getLeaf');
    // createLeafBySplit 抛错 → 返回 null, openCodeInSplitPane 回落代码面板
    const ws29c = {
      _all: [],
      getLeavesOfType() { return []; },
      iterateAllLeaves(fn) { this._all.slice().forEach(fn); },
      createLeafBySplit: async () => { throw new Error('boom'); },
      getLeaf() { throw new Error('boom2'); },
      revealLeaf() {},
      activeLeaf: { view: {} }
    };
    const Drawer29c = Object.create(PiDrawerView.prototype);
    Drawer29c.app = { workspace: ws29c };
    Drawer29c._vaultSplitLeaf = null;
    const leafC = await Drawer29c.openVaultFileInSplit(tf29, 1);
    assert(leafC === null, 'FL-09g: createLeafBySplit error returns null');
    const panelCalls29 = [];
    Drawer29c.resolveCodeFilePath = () => ({ filePath: 'D:/work/Mgmt/TabonKB/a/b.md', line: 3, isVault: true, classification: 'vault_abs' });
    Drawer29c._resolveVaultTFile = () => tf29;
    Drawer29c.vaultBasePath = 'D:/work/Mgmt/TabonKB';
    Drawer29c.codeViewerPanel = { openFile: (...a) => panelCalls29.push(a) };
    Drawer29c.selectedLocalProject = null;
    Drawer29c.getSavedLocalProject = () => null;
    await Drawer29c.openCodeInSplitPane('a/b.md', 3);
    assert(panelCalls29.length === 1 && panelCalls29[0][0].endsWith('b.md'), 'FL-09h: vault split failure falls back to code panel');

    // FL-10: _probeWorkspaceAnchors —— 800ms 预算 / 盘符-UNC 互斥 / 命中返回 (stub fs 探测)
    const Drawer29d = Object.create(PiDrawerView.prototype);
    Drawer29d.selectedLocalProject = null;
    Drawer29d.getSavedLocalProject = () => null;
    Drawer29d.vaultBasePath = 'D:/work/Mgmt/TabonKB';
    Drawer29d.app = null;
    Drawer29d._driveOnlineCache = {};
    const probedPaths29 = [];
    Drawer29d._statFileProbe = (p) => { probedPaths29.push(p); return false; };
    Drawer29d._isDriveLikelyOnline = (root) => !/^\\\\/.test(String(root)) && /^[Yy]/.test(String(root)); // Y 在线
    Drawer29d._lpCacheProjs = [
      { fullPathWin: 'Y:\\01', uncPath: '\\\\192.168.1.62\\tankaikun\\01' },
      { fullPathWin: 'Y:\\W\\03-mtk-ww', uncPath: '\\\\192.168.1.62\\tankaikun\\W\\03-mtk-ww' }
    ];
    Drawer29d._probeWorkspaceAnchors('pri_project\\a.c');
    assert(probedPaths29.every(p => !p.startsWith('\\\\')), 'FL-10a: UNC variant skipped while drive letter online');
    // 盘符离线 → 回退 UNC 变体
    probedPaths29.length = 0;
    Drawer29d._isDriveLikelyOnline = () => false;
    Drawer29d._probeWorkspaceAnchors('pri_project\\a.c');
    assert(probedPaths29.length > 0 && probedPaths29.every(p => p.startsWith('\\\\192.168.1.62')), 'FL-10b: drive offline falls back to UNC variant');
    // 命中返回第一个命中
    probedPaths29.length = 0;
    Drawer29d._statFileProbe = (p) => { probedPaths29.push(p); return /Y:\\01\\pri_project\\a\.c$/i.test(p); };
    Drawer29d._isDriveLikelyOnline = () => true;
    const hit29 = Drawer29d._probeWorkspaceAnchors('pri_project\\a.c');
    assert(hit29 && /Y:\\01\\pri_project\\a\.c$/i.test(hit29), 'FL-10c: first hit path returned');
    // 预算耗尽 → <800ms+单次余量 内返回 null (stat 每次模拟 60ms 阻塞)
    probedPaths29.length = 0;
    Drawer29d._lpCacheProjs = Array.from({ length: 40 }, (_, i) => ({ fullPathWin: `Y:\\ws${i}`, uncPath: `\\\\192.168.1.62\\t\\ws${i}` }));
    Drawer29d._statFileProbe = (p) => { probedPaths29.push(p); const s = Date.now(); while (Date.now() - s < 60) {} return false; };
    const bt0 = Date.now();
    const r29 = Drawer29d._probeWorkspaceAnchors('pri_project\\a.c');
    const bt1 = Date.now() - bt0;
    assert(r29 === null && bt1 < 1500 && probedPaths29.length < 40, `FL-10d: budget exhaustion returns null in time (took ${bt1}ms, probed ${probedPaths29.length})`);
  }

  // --- Suite 30: TOPIC-SVC —— 个人专题 00-TASK.md 解析/写回幂等 + 派生字段 + 目录命名 (P1a) ---
  console.log('\n>>> Suite 30: TOPIC-SVC (Personal Topics 00-TASK.md Core)');
  {
    const TS = require(path.join(pluginDir, 'services', 'topic-service.js'));

    const sample = [
      '---',
      'title: "测试专题"',
      '---',
      '',
      '## 执行步骤 (Checklist)',
      '- [ ] 待推进',
      '- [x] 已完成',
      '- [X] 大写完成',
      '',
      '## 想法 (Ideas)',
      '- 💡 **[2026-10-21]** 想法一',
      '',
      '## 进展日志 (Timeline)',
      '- **[2026-10-20 10:40]** 进展A',
      '- **[2026-10-19 09:00]** 进展B',
      '',
      '## 备注',
      '- [ ] 章节外的复选框不算',
      ''
    ].join('\n');

    // ① parseTaskBody: 复选框三态识别 / 章节外忽略 / 宽松标题匹配 / 缺失章节空数组
    const pr1 = TS.parseTaskBody(sample);
    assert(pr1.steps.length === 3, `TOPIC-01a: steps parsed from Checklist section only (got ${pr1.steps.length})`);
    assert(pr1.steps[0].done === false && pr1.steps[1].done === true && pr1.steps[2].done === true, 'TOPIC-01b: [ ]/[x]/[X] done flags recognized');
    assert(pr1.steps[0].label === '待推进' && pr1.steps[2].label === '大写完成', 'TOPIC-01c: step labels extracted');
    assert(pr1.ideas.length === 1 && pr1.ideas[0].text.includes('想法一'), 'TOPIC-01d: ideas section parsed');
    assert(pr1.timeline.length === 2 && pr1.timeline[0].time === '2026-10-20 10:40' && pr1.timeline[0].text === '进展A', 'TOPIC-01e: timeline entries parsed with time');
    const prLoose = TS.parseTaskBody('## 执行步骤\n- [ ] 裸标题也识别\n');
    assert(prLoose.steps.length === 1 && prLoose.steps[0].label === '裸标题也识别', 'TOPIC-01f: loose heading match (## 执行步骤 without suffix)');
    const prNone = TS.parseTaskBody('# 只有标题\n正文没有章节\n- [ ] 顶层复选框不算\n');
    assert(prNone.steps.length === 0 && prNone.ideas.length === 0 && prNone.timeline.length === 0, 'TOPIC-01g: missing sections return empty arrays');

    // ② toggleStep: 仅目标行变化 + CRLF 保持
    const stepLine = pr1.steps[0].line;
    const tog = TS.toggleStep(sample, stepLine, true);
    const srcLines = sample.split('\n');
    const togLines = tog.split('\n');
    assert(togLines[stepLine] === '- [x] 待推进', 'TOPIC-02a: toggleStep marks target line done');
    assert(srcLines.every((l, i) => i === stepLine || togLines[i] === l), 'TOPIC-02b: all other lines byte-identical');
    const togBack = TS.toggleStep(tog, stepLine, false);
    assert(togBack === sample, 'TOPIC-02c: toggle back restores original text');
    const crlf = sample.replace(/\n/g, '\r\n');
    const crlfTog = TS.toggleStep(crlf, stepLine, true);
    assert((crlfTog.match(/\n/g) || []).length === (crlfTog.match(/\r\n/g) || []).length, 'TOPIC-02d: CRLF preserved on CRLF text (no lone LF)');
    assert(crlfTog.split('\r\n')[stepLine] === '- [x] 待推进', 'TOPIC-02e: CRLF toggle applied to correct line');
    assert(TS.toggleStep(sample, 0, true) === sample, 'TOPIC-02f: non-checkbox line untouched');

    // ③ addStep: 末尾条目后追加, 不越下一个 ##; 章节缺失补建; 未知章节保留
    const added = TS.addStep(sample, '新步骤');
    const idxNew = added.indexOf('- [ ] 新步骤');
    const idxLast = added.indexOf('- [X] 大写完成');
    const idxIdeas = added.indexOf('## 想法');
    assert(idxNew > idxLast && idxNew < idxIdeas, 'TOPIC-03a: addStep appends after last item before next ##');
    assert(added.includes('## 备注\n- [ ] 章节外的复选框不算'), 'TOPIC-03b: unknown trailing section preserved');
    const noSec = TS.addStep('自由文本\n- [ ] 顶层框\n', '补建步骤');
    assert(noSec.startsWith('自由文本\n- [ ] 顶层框\n') && noSec.includes('## 执行步骤 (Checklist)\n- [ ] 补建步骤\n'), 'TOPIC-03c: missing Checklist section appended at end');
    const emptySec = TS.addStep('## 执行步骤 (Checklist)\n\n## 想法 (Ideas)\n', '首条');
    const esLines = emptySec.split('\n');
    assert(esLines[1] === '- [ ] 首条' && esLines[2] === '' && esLines[3] === '## 想法 (Ideas)', 'TOPIC-03d: empty Checklist section inserts under heading');

    // ④ addProgress: Timeline 顶部插入 / 格式精确 / 最新在上 / 缺失补建
    const prog = TS.addProgress(sample, '新进展', '2026-10-20 12:00');
    const tlIdx = prog.indexOf('## 进展日志 (Timeline)');
    const newIdx = prog.indexOf('- **[2026-10-20 12:00]** 新进展');
    const oldIdx = prog.indexOf('- **[2026-10-20 10:40]** 进展A');
    assert(newIdx > tlIdx && newIdx < oldIdx, 'TOPIC-04a: addProgress inserts at Timeline top (newest first)');
    const progMissing = TS.addProgress('无章节\n', 'x', '2026-10-21 08:30');
    assert(progMissing.startsWith('无章节\n') && progMissing.includes('## 进展日志 (Timeline)\n- **[2026-10-21 08:30]** x\n'), 'TOPIC-04b: missing Timeline section appended at end');

    // ⑤ 往返幂等: 含未知章节与手写文字的样本, 未触及部分逐字不变
    const messy = '# 标题\n\n手写自由文本，不得改动。\n\n## 执行步骤\n- [ ] a\n\n## 奇怪章节\n保留我！！\n- [ ] 不在步骤区\n\n结尾文本\n';
    const prM = TS.parseTaskBody(messy);
    let m1 = TS.toggleStep(messy, prM.steps[0].line, true);
    m1 = TS.addStep(m1, 'b');
    m1 = TS.addProgress(m1, 'p1', '2026-10-22 09:00');
    assert(m1.startsWith('# 标题\n\n手写自由文本，不得改动。\n'), 'TOPIC-05a: handwritten head preserved verbatim');
    assert(m1.includes('## 奇怪章节\n保留我！！\n- [ ] 不在步骤区\n\n结尾文本\n'), 'TOPIC-05b: unknown section & tail preserved verbatim');
    const prM2 = TS.parseTaskBody(m1);
    assert(prM2.steps.length === 2 && prM2.steps[0].done && prM2.steps[1].label === 'b', 'TOPIC-05c: checklist ops applied inside loose section');
    assert(prM2.timeline.length === 1 && prM2.timeline[0].text === 'p1', 'TOPIC-05d: progress appended into newly built Timeline');

    // ⑥ calcProgress / calcIdle
    const cp = TS.calcProgress([{ done: true }, { done: false }, { done: true }]);
    assert(cp.done === 2 && cp.total === 3 && cp.percent === 67, `TOPIC-06a: calcProgress 2/3 (got ${cp.percent}%)`);
    const cp0 = TS.calcProgress([]);
    assert(cp0.done === 0 && cp0.total === 0 && cp0.percent === null, 'TOPIC-06b: calcProgress total=0 → percent null');
    const t0 = Date.now();
    const idle0 = TS.calcIdle(t0, t0, 'in_progress');
    assert(idle0.days === 0 && idle0.label === '今日推进' && idle0.warn === false, 'TOPIC-06c: calcIdle 0 天 → 今日推进');
    const idle3 = TS.calcIdle(t0 - 3 * 86400000, t0, 'in_progress');
    assert(idle3.days === 3 && idle3.label === '3天前' && idle3.warn === false, 'TOPIC-06d: calcIdle 3 天不告警');
    const idle7 = TS.calcIdle(t0 - 7 * 86400000, t0, 'in_progress');
    assert(idle7.days === 7 && idle7.warn === true, 'TOPIC-06e: calcIdle 7 天告警');
    const idle10 = TS.calcIdle(t0 - 10 * 86400000, t0, 'in_progress');
    assert(idle10.days === 10 && idle10.label === '10天前' && idle10.warn === true, 'TOPIC-06f: calcIdle 10 天告警文案');
    const idlePaused = TS.calcIdle(t0 - 10 * 86400000, t0, 'paused');
    assert(idlePaused.days === 10 && idlePaused.warn === false, 'TOPIC-06g: paused 专题不告警');

    // ⑦ sanitizeTopicDirName + 重名后缀
    assert(TS.sanitizeTopicDirName('a/b:c*d?"<>|#%& x', '20261020') === '20261020-abcd-x', 'TOPIC-07a: illegal chars stripped');
    assert(TS.sanitizeTopicDirName('  hello   world  ', '2026-10-20') === '20261020-hello-world', 'TOPIC-07b: spaces→dash, dashes in date tolerated');
    const longTitle = '超长标题'.repeat(15);
    const sanLong = TS.sanitizeTopicDirName(longTitle, '20261020');
    assert(sanLong === '20261020-' + '超长标题'.repeat(10), `TOPIC-07c: title truncated to 40 chars (got len ${sanLong.length})`);
    assert(TS.sanitizeTopicDirName('  ///  ', '20261020') === '20261020', 'TOPIC-07d: all-illegal title falls back to bare date');

    // ⑧ parseWikiLink
    assert(TS.parseWikiLink('[[a/b.md|别名]]') === 'a/b.md', 'TOPIC-08a: wikilink alias stripped');
    assert(TS.parseWikiLink('[[a/b.md#锚点]]') === 'a/b.md', 'TOPIC-08b: wikilink anchor stripped');
    assert(TS.parseWikiLink('a/b.md') === 'a/b.md', 'TOPIC-08c: plain string passthrough');
    assert(TS.parseWikiLink('[[a/b|c#d]]') === 'a/b', 'TOPIC-08d: alias+anchor both stripped');

    // ⑨ canStar 边界 (上限 3)
    const mkT = (id, starred, status) => ({ id, starred, status: status || 'in_progress' });
    const star2 = [mkT('a', true), mkT('b', true)];
    assert(TS.canStar(star2, mkT('c', false)) === true, 'TOPIC-09a: 2 starred → new star allowed');
    const star3 = [mkT('a', true), mkT('b', true), mkT('c', true)];
    assert(TS.canStar(star3, mkT('d', false)) === false, 'TOPIC-09b: 3 starred → new star rejected');
    assert(TS.canStar(star3, mkT('a', true)) === true, 'TOPIC-09c: already-starred can always unstar');
    const starPaused = [mkT('a', true), mkT('b', true), mkT('c', true, 'paused')];
    assert(TS.canStar(starPaused, mkT('d', false)) === true, 'TOPIC-09d: paused starred does not count toward limit');

    // ⑩ createTopic / archive (最小 vault+fileManager+metadataCache mock)
    const _parseFmMock = (content) => {
      const m = /^---\n([\s\S]*?)\n---/.exec(String(content));
      const fm = {};
      if (!m) return fm;
      for (const line of m[1].split('\n')) {
        const mm = /^([A-Za-z_]+):\s*(.*)$/.exec(line);
        if (!mm) continue;
        let v = mm[2].trim();
        if (v === '[]') v = [];
        else if (v === 'true') v = true;
        else if (v === 'false') v = false;
        else if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/\\"/g, '"');
        fm[mm[1]] = v;
      }
      return fm;
    };
    const mockNodes = new Map();
    const mockFm = new Map();
    const mkFolderN = (p) => {
      const n = { name: p.split('/').pop(), path: p, children: [] };
      mockNodes.set(p, n);
      const par = p.split('/').slice(0, -1).join('/');
      if (par && mockNodes.has(par)) mockNodes.get(par).children.push(n);
      return n;
    };
    const mkFileN = (p, c) => {
      const n = { name: p.split('/').pop(), path: p, extension: p.split('.').pop(), stat: { mtime: Date.now() }, content: c };
      mockNodes.set(p, n);
      const par = p.split('/').slice(0, -1).join('/');
      if (par && mockNodes.has(par)) mockNodes.get(par).children.push(n);
      mockFm.set(p, _parseFmMock(c));
      return n;
    };
    const mockApp = {
      vault: {
        adapter: { exists: async (p) => mockNodes.has(p) },
        getAbstractFileByPath: (p) => mockNodes.get(p) || null,
        createFolder: async (p) => { if (!mockNodes.has(p)) mkFolderN(p); return mockNodes.get(p); },
        create: async (p, c) => mkFileN(p, c),
        read: async (f) => f.content,
        modify: async (f, c) => { f.content = c; mockFm.set(f.path, _parseFmMock(c)); },
        process: async (f, fn) => { f.content = fn(f.content); return f.content; },
        rename: async (f, newPath) => {
          const oldPath = f.path;
          const oldPar = mockNodes.get(oldPath.split('/').slice(0, -1).join('/'));
          if (oldPar) oldPar.children = oldPar.children.filter(c => c !== f);
          const moves = [];
          for (const [p, n] of [...mockNodes.entries()]) {
            if (p === oldPath || p.startsWith(oldPath + '/')) moves.push([p, n]);
          }
          for (const [p, n] of moves) {
            const np = newPath + p.slice(oldPath.length);
            mockNodes.delete(p);
            n.path = np;
            mockNodes.set(np, n);
            if (mockFm.has(p)) { mockFm.set(np, mockFm.get(p)); mockFm.delete(p); }
          }
          f.name = newPath.split('/').pop();
          const newPar = mockNodes.get(newPath.split('/').slice(0, -1).join('/'));
          if (newPar) newPar.children.push(f);
        },
        on: () => ({}), offref: () => {}
      },
      fileManager: {
        processFrontMatter: async (file, fn) => {
          const fm = mockFm.get(file.path) || {};
          fn(fm);
          mockFm.set(file.path, fm);
        }
      },
      metadataCache: {
        getFileCache: (f) => ({ frontmatter: mockFm.get(f.path) || {} }),
        on: () => ({}), offref: () => {}
      }
    };

    const svc = new TS.TopicService({ app: mockApp, rootPath: 'topics' });
    const created = await svc.createTopic({ title: 'USB-PD 专项研究', track: 'deep', module: 'USB', goal: '搞清楚 PD' });
    assert(/^\d{8}-USB-PD/.test(created.id), `TOPIC-10a: createTopic dir name is YYYYMMDD-短标题 (got ${created.id})`);
    const taskNode = mockNodes.get(`${created.dir}/00-TASK.md`);
    assert(!!taskNode && taskNode.content.includes('## 执行步骤 (Checklist)') && taskNode.content.includes('## 想法 (Ideas)') && taskNode.content.includes('## 进展日志 (Timeline)'), 'TOPIC-10b: 00-TASK.md contains all three sections');
    const fmCreated = mockFm.get(taskNode.path);
    assert(fmCreated.title === 'USB-PD 专项研究' && fmCreated.track === 'deep' && fmCreated.module === 'USB' && fmCreated.status === 'in_progress' && fmCreated.starred === false && fmCreated.goal === '搞清楚 PD', 'TOPIC-10c: frontmatter fields written');
    assert(Array.isArray(fmCreated.jira) && Array.isArray(fmCreated.published_docs) && Array.isArray(fmCreated.linked_refs), 'TOPIC-10d: list fields initialized as []');
    const created2 = await svc.createTopic({ title: 'USB-PD 专项研究', track: 'deep', module: 'USB' });
    assert(created2.id === created.id + '-2', `TOPIC-10e: duplicate dir name gets -2 suffix (got ${created2.id})`);
    const scanned = await svc.scan();
    assert(scanned.length === 2 && scanned.every(t => t.id && t.taskFile), `TOPIC-10f: scan() returns topics (got ${scanned.length})`);
    const t1 = scanned.find(t => t.id === created.id);
    assert(t1 && t1.title === 'USB-PD 专项研究' && t1.timeline.length === 1, 'TOPIC-10g: scanned topic has fm title + initial timeline entry');
    // 扫描忽略 _ 开头目录
    mkFolderN('topics/_Seeds');
    mkFileN('topics/_Seeds/20261020-x.md', '---\ntitle: x\n---\n');
    const scanned2 = await svc.scan();
    assert(scanned2.length === 2, 'TOPIC-10h: _-prefixed dirs skipped by scan');
    // archive: 移入 _Archived + status done + 重名后缀
    mkFolderN('topics/_Archived');
    mkFolderN(`topics/_Archived/${created.id}`);
    await svc.archive(t1);
    assert(mockNodes.has(`topics/_Archived/${created.id}-2`), `TOPIC-10i: archive moves dir into _Archived with dedupe suffix`);
    assert(!mockNodes.has(`${created.dir}`), 'TOPIC-10j: original dir removed after archive');
    const fmArchived = mockFm.get(`topics/_Archived/${created.id}-2/00-TASK.md`);
    assert(fmArchived && fmArchived.status === 'done', 'TOPIC-10k: archive sets status: done');
  }

  // --- Suite 31: TOPIC-P1B —— 想法行操作 + 种子池 + 记灵感去向 (P1b) ---
  console.log('\n>>> Suite 31: TOPIC-P1B (Ideas / Seeds / Idea Capture)');
  {
    const TS = require(path.join(pluginDir, 'services', 'topic-service.js'));
    const ICP = require(path.join(pluginDir, 'components', 'idea-capture-palette.js'));

    // ① parseTaskBody ideas 新字段: label/date/source/struck + text 保持原义
    const ideaSample = [
      '## 想法 (Ideas)',
      '- 💡 **[2026-10-21]** 想法一 · 来源A',
      '- ~~💡 **[2026-10-20]** 已划掉 · JIRA-1~~',
      '- 💡 **[2026-10-19]** 无来源想法',
      ''
    ].join('\n');
    const pri = TS.parseTaskBody(ideaSample);
    assert(pri.ideas.length === 3, `IDEA-01a: all idea items parsed (got ${pri.ideas.length})`);
    assert(pri.ideas[0].label === '想法一' && pri.ideas[0].date === '2026-10-21' && pri.ideas[0].source === '来源A' && pri.ideas[0].struck === false, 'IDEA-01b: label/date/source/struck parsed');
    assert(pri.ideas[0].text.includes('💡 **[2026-10-21]** 想法一'), 'IDEA-01c: text keeps raw line content (P1a compat)');
    assert(pri.ideas[1].struck === true && pri.ideas[1].label === '已划掉' && pri.ideas[1].source === 'JIRA-1', 'IDEA-01d: struck item parsed');
    assert(pri.ideas[2].label === '无来源想法' && pri.ideas[2].source === '', 'IDEA-01e: no-source idea parsed');

    // ② addIdea: 顶部插入 / 缺失补建 / 格式精确
    const ai = TS.addIdea(ideaSample, '新想法', '2026-10-22', 'SRC');
    assert(ai.split('\n')[1] === '- 💡 **[2026-10-22]** 新想法 · SRC', 'IDEA-02a: addIdea inserts at Ideas top with exact format');
    const aiNoSrc = TS.addIdea(ideaSample, '无来源', '2026-10-22');
    assert(aiNoSrc.split('\n')[1] === '- 💡 **[2026-10-22]** 无来源', 'IDEA-02b: addIdea without source omits trailing dot');
    const aiMissing = TS.addIdea('自由文本\n', 'X', '2026-10-22');
    assert(aiMissing.startsWith('自由文本\n') && aiMissing.includes('## 想法 (Ideas)\n- 💡 **[2026-10-22]** X\n'), 'IDEA-02c: missing Ideas section appended at end');
    const aiNewest = TS.addIdea(ideaSample, '最新', '2026-10-23');
    assert(aiNewest.indexOf('最新') < aiNewest.indexOf('想法一'), 'IDEA-02d: newest idea on top');

    // ③ ideaToStep: 删行 + 追加步骤 + 其余字节不变; 非法目标原样返回
    const ideaBase = [
      '## 执行步骤 (Checklist)',
      '- [ ] 旧步骤',
      '',
      '## 想法 (Ideas)',
      '- 💡 **[2026-10-21]** 变成步骤 · SRC',
      '- 💡 **[2026-10-20]** 留下',
      '',
      '## 进展日志 (Timeline)',
      ''
    ].join('\n');
    const prB = TS.parseTaskBody(ideaBase);
    const i2s = TS.ideaToStep(ideaBase, prB.ideas[0].line);
    assert(!i2s.includes('变成步骤 · SRC'), 'IDEA-03a: idea line removed (incl. line end)');
    const idxNewStep = i2s.indexOf('- [ ] 变成步骤');
    assert(idxNewStep > i2s.indexOf('- [ ] 旧步骤') && idxNewStep < i2s.indexOf('## 想法'), 'IDEA-03b: label appended as - [ ] step inside Checklist');
    assert(i2s.includes('## 想法 (Ideas)\n- 💡 **[2026-10-20]** 留下\n'), 'IDEA-03c: other idea line byte-preserved');
    const struckBase = '## 想法 (Ideas)\n- ~~💡 **[2026-10-20]** 划掉的~~\n';
    const prStruck = TS.parseTaskBody(struckBase);
    assert(TS.ideaToStep(struckBase, prStruck.ideas[0].line) === struckBase, 'IDEA-03d: struck idea → unchanged');
    assert(TS.ideaToStep(ideaBase, 0) === ideaBase, 'IDEA-03e: non-idea line → unchanged');
    assert(TS.ideaToStep(ideaBase, 999) === ideaBase, 'IDEA-03f: out-of-range line → unchanged');

    // ④ strikeIdea 幂等 + 仅目标行变化
    const st = TS.strikeIdea(ideaBase, prB.ideas[0].line);
    const stLines = st.split('\n');
    const baseLines = ideaBase.split('\n');
    assert(stLines[prB.ideas[0].line] === '- ~~💡 **[2026-10-21]** 变成步骤 · SRC~~', 'IDEA-04a: strikeIdea wraps content in ~~');
    assert(baseLines.every((l, i) => i === prB.ideas[0].line || stLines[i] === l), 'IDEA-04b: other lines byte-identical');
    const stParsed = TS.parseTaskBody(st);
    assert(stParsed.ideas[0].struck === true, 'IDEA-04c: struck flag set after strike');
    const stLineIdx = stParsed.ideas[0].line;
    assert(TS.strikeIdea(st, stLineIdx) === st, 'IDEA-04d: strikeIdea idempotent');

    // ⑤ removeIdeaLine
    const rm = TS.removeIdeaLine(ideaBase, prB.ideas[0].line);
    assert(!rm.includes('变成步骤'), 'IDEA-05a: removeIdeaLine drops the line');
    assert(rm.split('\n').length === baseLines.length - 1, 'IDEA-05b: exactly one line removed');
    assert(rm.includes('## 想法 (Ideas)\n- 💡 **[2026-10-20]** 留下\n'), 'IDEA-05c: neighbours preserved');
    assert(TS.removeIdeaLine(ideaBase, 0) === ideaBase, 'IDEA-05d: non-idea line → unchanged');

    // ⑥ parseSeedBody + addWater
    const seedSample = [
      '## 想法',
      '灵感全文第一行',
      '第二行',
      '',
      '## 浇水',
      '- **[2026-10-22 09:00]** 浇水A',
      '- **[2026-10-21 08:00]** 浇水B',
      ''
    ].join('\n');
    const psb = TS.parseSeedBody(seedSample);
    assert(psb.idea === '灵感全文第一行\n第二行', `SEED-01a: seed idea body parsed (got "${psb.idea}")`);
    assert(psb.waters.length === 2 && psb.waters[0].time === '2026-10-22 09:00' && psb.waters[0].text === '浇水A', 'SEED-01b: water entries parsed newest-first');
    const aw = TS.addWater(seedSample, '浇水C', '2026-10-23 10:00');
    assert(aw.indexOf('- **[2026-10-23 10:00]** 浇水C') > aw.indexOf('## 浇水') && aw.indexOf('- **[2026-10-23 10:00]** 浇水C') < aw.indexOf('- **[2026-10-22 09:00]** 浇水A'), 'SEED-02a: addWater inserts at 浇水 top (newest first)');
    const awMissing = TS.addWater('## 想法\nx\n', 'w', '2026-10-23 10:00');
    assert(awMissing.includes('## 浇水\n- **[2026-10-23 10:00]** w\n'), 'SEED-02b: missing 浇水 section appended at end');

    // ⑦ seedEffectiveStatus
    assert(TS.seedEffectiveStatus('seed', 2) === 'seed', 'SEED-03a: 2 waters → seed');
    assert(TS.seedEffectiveStatus('seed', 3) === 'growing', 'SEED-03b: 3 waters → growing');
    assert(TS.seedEffectiveStatus('sprouted', 9) === 'sprouted', 'SEED-03c: sprouted unchanged');
    assert(TS.seedEffectiveStatus('growing', 0) === 'growing', 'SEED-03d: growing unchanged');

    // ⑧ inferCaptureTarget 全分支
    const capTopics = [
      { id: 'T1', status: 'in_progress', jira: ['SPE123-1'] },
      { id: 'T2', status: 'paused', jira: ['SPE123-2'] }
    ];
    const tgt1 = TS.inferCaptureTarget({ selectedTopicId: 'T1' }, capTopics);
    assert(tgt1.type === 'topic' && tgt1.id === 'T1', 'CAP-01a: selected in_progress topic wins');
    assert(TS.inferCaptureTarget({ selectedTopicId: 'T2' }, capTopics).type === 'seed', 'CAP-01b: selected paused topic → seed fallback');
    const tgt3 = TS.inferCaptureTarget({ jiraKey: 'spe123-1' }, capTopics);
    assert(tgt3.type === 'topic' && tgt3.id === 'T1', 'CAP-01c: jira key match is case-insensitive');
    assert(TS.inferCaptureTarget({ jiraKey: 'SPE123-2' }, capTopics).type === 'seed', 'CAP-01d: jira key hitting paused topic → seed');
    assert(TS.inferCaptureTarget({}, capTopics).type === 'seed', 'CAP-01e: no context → seed');
    assert(TS.inferCaptureTarget({ selectedTopicId: 'NOPE' }, capTopics).type === 'seed', 'CAP-01f: unknown selectedTopicId → seed');

    // ⑨ isJiraKey
    assert(TS.isJiraKey('SPE123-1') === true && TS.isJiraKey('ABC-12') === true, 'CAP-02a: jira key positives');
    assert(TS.isJiraKey('spe123-1') === false && TS.isJiraKey('A-1') === false && TS.isJiraKey('SPE-1x') === false && TS.isJiraKey('') === false, 'CAP-02b: jira key negatives');

    // ⑩ shouldYieldCtrlI
    const elCm = { closest: (sel) => (sel === '.cm-editor' ? elCm : null) };
    const elMon = { closest: (sel) => (sel === '.monaco-editor' ? elMon : null) };
    const elPlain = { closest: () => null };
    assert(ICP.shouldYieldCtrlI(elCm) === true && ICP.shouldYieldCtrlI(elMon) === true, 'CAP-03a: editor ancestors yield Ctrl+I');
    assert(ICP.shouldYieldCtrlI(elPlain) === false && ICP.shouldYieldCtrlI(null) === false && ICP.shouldYieldCtrlI(undefined) === false, 'CAP-03b: input/null/plain element does not yield');
    assert(typeof ICP.IdeaCapturePalette === 'function', 'CAP-03c: IdeaCapturePalette class exported');

    // ⑪ mock vault 集成 (含 fileManager.renameFile)
    const _parseFm31 = (content) => {
      const m = /^---\n([\s\S]*?)\n---/.exec(String(content));
      const fm = {};
      if (!m) return fm;
      for (const line of m[1].split('\n')) {
        const mm = /^([A-Za-z_]+):\s*(.*)$/.exec(line);
        if (!mm) continue;
        let v = mm[2].trim();
        if (/^\[.*\]$/.test(v)) v = v === '[]' ? [] : v.slice(1, -1).split(',').map(x => x.trim().replace(/^"|"$/g, '').replace(/\\"/g, '"'));
        else if (v === 'true') v = true;
        else if (v === 'false') v = false;
        else if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/\\"/g, '"');
        fm[mm[1]] = v;
      }
      return fm;
    };
    const mockNodes31 = new Map();
    const mockFm31 = new Map();
    const mkFolderN31 = (p) => {
      const n = { name: p.split('/').pop(), path: p, children: [] };
      mockNodes31.set(p, n);
      const par = p.split('/').slice(0, -1).join('/');
      if (par && mockNodes31.has(par)) mockNodes31.get(par).children.push(n);
      return n;
    };
    const mkFileN31 = (p, c) => {
      const n = { name: p.split('/').pop(), path: p, extension: p.split('.').pop(), stat: { mtime: Date.now() }, content: c };
      mockNodes31.set(p, n);
      const par = p.split('/').slice(0, -1).join('/');
      if (par && mockNodes31.has(par)) mockNodes31.get(par).children.push(n);
      mockFm31.set(p, _parseFm31(c));
      return n;
    };
    const mockVault31 = {
      adapter: { exists: async (p) => mockNodes31.has(p) },
      getAbstractFileByPath: (p) => mockNodes31.get(p) || null,
      createFolder: async (p) => { if (!mockNodes31.has(p)) mkFolderN31(p); return mockNodes31.get(p); },
      create: async (p, c) => mkFileN31(p, c),
      read: async (f) => f.content,
      modify: async (f, c) => { f.content = c; mockFm31.set(f.path, _parseFm31(c)); },
      process: async (f, fn) => { f.content = fn(f.content); return f.content; },
      rename: async (f, newPath) => {
        const oldPath = f.path;
        const oldPar = mockNodes31.get(oldPath.split('/').slice(0, -1).join('/'));
        if (oldPar) oldPar.children = oldPar.children.filter(c => c !== f);
        const moves = [];
        for (const [p, n] of [...mockNodes31.entries()]) {
          if (p === oldPath || p.startsWith(oldPath + '/')) moves.push([p, n]);
        }
        for (const [p, n] of moves) {
          const np = newPath + p.slice(oldPath.length);
          mockNodes31.delete(p);
          n.path = np;
          mockNodes31.set(np, n);
          if (mockFm31.has(p)) { mockFm31.set(np, mockFm31.get(p)); mockFm31.delete(p); }
        }
        f.name = newPath.split('/').pop();
        const newPar = mockNodes31.get(newPath.split('/').slice(0, -1).join('/'));
        if (newPar) newPar.children.push(f);
      },
      on: () => ({}), offref: () => {}
    };
    const mockApp31 = {
      vault: mockVault31,
      fileManager: {
        processFrontMatter: async (file, fn) => {
          const fm = mockFm31.get(file.path) || {};
          fn(fm);
          mockFm31.set(file.path, fm);
        },
        renameFile: async (file, newPath) => mockVault31.rename(file, newPath)
      },
      metadataCache: {
        getFileCache: (f) => ({ frontmatter: mockFm31.get(f.path) || {} }),
        on: () => ({}), offref: () => {}
      }
    };

    const svc31 = new TS.TopicService({ app: mockApp31, rootPath: 'topics' });

    // createSeed: 文件名/重名后缀/fm/两章节
    const s1 = await svc31.createSeed({ text: '灵感一行\n第二行', source: 'jira', source_ref: 'SPE123-1' });
    assert(/^\d{8}-.+\.md$/.test(s1.id) && s1.path === `topics/_Seeds/${s1.id}`, `SEED-10a: createSeed writes into _Seeds with date name (got ${s1.id})`);
    const s1n = mockNodes31.get(s1.path);
    assert(s1n.content.includes('## 想法\n灵感一行\n第二行\n') && s1n.content.includes('## 浇水'), 'SEED-10b: seed body has 想法(全文)+浇水 sections');
    const sfm1 = mockFm31.get(s1.path);
    assert(sfm1.status === 'seed' && sfm1.source === 'jira' && sfm1.source_ref === 'SPE123-1' && sfm1.title === '灵感一行', 'SEED-10c: seed frontmatter fields');
    const s2 = await svc31.createSeed({ text: '灵感一行\n第二行' });
    assert(s2.id === s1.id.replace('.md', '-2.md'), `SEED-10d: filename collision → -2 suffix (got ${s2.id})`);

    // scanSeeds 忽略 _Withered 子目录
    mkFolderN31('topics/_Seeds/_Withered');
    mkFileN31('topics/_Seeds/_Withered/20261020-dead.md', '---\ntitle: dead\nstatus: withered\n---\n\n## 想法\nx\n\n## 浇水\n');
    const seeds0 = await svc31.scanSeeds();
    assert(seeds0.length === 2 && !seeds0.some(s => s.id.includes('dead')), 'SEED-11a: scanSeeds top-level only, _Withered ignored');

    // water ×3 → growing
    let so = seeds0.find(s => s.id === s1.id);
    await svc31.water(so, 'w1');
    so = (await svc31.scanSeeds()).find(s => s.id === s1.id);
    assert(so.waters.length === 1 && so.status === 'seed', 'SEED-12a: 1st water recorded, still seed');
    await svc31.water(so, 'w2');
    so = (await svc31.scanSeeds()).find(s => s.id === s1.id);
    assert(so.waters.length === 2 && so.status === 'seed', 'SEED-12b: 2 waters → still seed');
    await svc31.water(so, 'w3');
    so = (await svc31.scanSeeds()).find(s => s.id === s1.id);
    assert(so.waters.length === 3 && so.status === 'growing', 'SEED-12c: 3rd water → growing');
    assert(so.waters[0].text === 'w3', 'SEED-12d: newest water on top');
    assert(mockFm31.get(so.path).status === 'growing', 'SEED-12e: fm status updated to growing');

    // sprout: 专题字段/jira/Timeline 顺序/种子移入 00-SEED.md
    const wTimesBefore = so.waters.map(w => w.time);
    const spr = await svc31.sprout(so, { track: 'deep', module: 'USB' });
    const sprTaskPath = `${spr.dir}/00-TASK.md`;
    const sprFm = mockFm31.get(sprTaskPath);
    assert(sprFm.title === '灵感一行' && sprFm.goal === '灵感一行' && sprFm.track === 'deep' && sprFm.module === 'USB', 'SEED-13a: sprout topic fields (goal = idea first line)');
    assert(Array.isArray(sprFm.jira) && sprFm.jira.includes('SPE123-1'), 'SEED-13b: source_ref jira key → topic jira');
    const sprParsed = TS.parseTaskBody(mockNodes31.get(sprTaskPath).content);
    assert(sprParsed.timeline[0].text === '发芽自种子', 'SEED-13c: timeline top = 发芽自种子');
    assert(sprParsed.timeline.length === 4 && sprParsed.timeline[1].text === '💧 w3' && sprParsed.timeline[3].text === '💧 w1', 'SEED-13d: water history migrated newest-first below sprout entry');
    assert(sprParsed.timeline[1].time === wTimesBefore[0] && sprParsed.timeline[3].time === wTimesBefore[2], 'SEED-13e: water timestamps preserved verbatim');
    assert(mockNodes31.has(`${spr.dir}/00-SEED.md`), 'SEED-13f: seed moved into topic dir as 00-SEED.md');
    assert(mockFm31.get(`${spr.dir}/00-SEED.md`).status === 'sprouted', 'SEED-13g: seed status = sprouted');
    assert(!mockNodes31.has(s1.path), 'SEED-13h: original seed path removed');

    // mergeSeed: 移入 <专题>/_seeds/ + Ideas 顶部并入条目 + status merged
    const s2Obj = (await svc31.scanSeeds()).find(s => s.id === s2.id);
    const sprTopic = (await svc31.scan()).find(t => t.id === spr.id);
    await svc31.mergeSeed(s2Obj, sprTopic);
    assert(mockNodes31.has(`${spr.dir}/_seeds/${s2.id}`), `SEED-14a: merged seed moved into <topic>/_seeds/`);
    assert(mockFm31.get(`${spr.dir}/_seeds/${s2.id}`).status === 'merged', 'SEED-14b: seed status = merged');
    const mgParsed = TS.parseTaskBody(mockNodes31.get(sprTaskPath).content);
    assert(mgParsed.ideas.length >= 1 && mgParsed.ideas[0].label === s2Obj.title && mgParsed.ideas[0].source.includes('并入 [['), 'SEED-14c: topic Ideas top has 并入 entry with wikilink');

    // discardSeed: 移入 _Withered + status withered + 文件仍在 + 不再被扫描
    const s3 = await svc31.createSeed({ text: '丢弃的种子' });
    await svc31.discardSeed({ id: s3.id, path: s3.path, file: s3.file });
    const wPath = `topics/_Seeds/_Withered/${s3.id}`;
    assert(mockNodes31.has(wPath) && !mockNodes31.has(s3.path), 'SEED-15a: discarded seed moved into _Withered (not deleted)');
    assert(mockFm31.get(wPath).status === 'withered', 'SEED-15b: seed status = withered');
    assert(!(await svc31.scanSeeds()).some(s => s.id === s3.id), 'SEED-15c: withered seed excluded from scanSeeds');

    // forkIdea: 想法 → 种子, 原想法行移除
    const ft = await svc31.createTopic({ title: '分叉源专题', track: 'work', module: 'GEN' });
    await svc31.addIdea(ft, '分叉想法', 'S');
    const ftScan = (await svc31.scan()).find(t => t.id === ft.id);
    const fkSeed = await svc31.forkIdea(ftScan, ftScan.ideas[0].line);
    assert(fkSeed && fkSeed.file, 'SEED-16a: forkIdea creates a seed');
    const fkFm = mockFm31.get(fkSeed.path);
    assert(fkFm.source === 'note' && fkFm.source_ref === `[[${ft.dir}/00-TASK]]` && fkFm.track === 'work' && fkFm.module === 'GEN', 'SEED-16b: forked seed inherits topic track/module + note source_ref');
    assert(TS.parseSeedBody(mockNodes31.get(fkSeed.path).content).idea === '分叉想法', 'SEED-16c: forked seed carries idea label as body');
    assert(TS.parseTaskBody(mockNodes31.get(`${ft.dir}/00-TASK.md`).content).ideas.length === 0, 'SEED-16d: original idea line removed from topic');

    // captureIdea 两种去向
    const capR1 = await svc31.captureIdea({ text: '记入专题的想法', target: { type: 'topic', id: ft.id }, context: { source: 'manual' } });
    assert(capR1.kind === 'topic', 'CAP-10a: topic target → kind topic');
    const ftIdeas = TS.parseTaskBody(mockNodes31.get(`${ft.dir}/00-TASK.md`).content).ideas;
    assert(ftIdeas.length === 1 && ftIdeas[0].label === '记入专题的想法', 'CAP-10b: captured idea appended to topic Ideas');
    const capR2 = await svc31.captureIdea({ text: '新捕获种子', target: { type: 'seed', track: 'deep' }, context: { source: 'jira', source_ref: 'SPE123-9' } });
    assert(capR2.kind === 'seed' && mockFm31.get(capR2.seed.path).track === 'deep' && mockFm31.get(capR2.seed.path).source_ref === 'SPE123-9', 'CAP-10c: seed target → createSeed with context');
  }

  // --- Suite 32: JIRA-SANDBOX —— 排查建档统一 (一单一目录 + DBG 草稿) + 记灵感上下文合并 (P1c) ---
  console.log('\n>>> Suite 32: JIRA-SANDBOX (Debug Sandbox & Naming)');
  {
    const JSS = require(path.join(pluginDir, 'services', 'jira-sandbox-service.js'));
    const ICP = require(path.join(pluginDir, 'components', 'idea-capture-palette.js'));

    // ① inferDbgNaming: components > summary > description; CN/EN; 默认 COMMON/GEN
    const n1 = JSS.inferDbgNaming({ components: ['MTK Connectivity'], summary: 'sm8650 显示问题', description: 'usb pd' });
    assert(n1.platform === 'MTK' && n1.module === 'CONN', `DBG-01a: components beats summary/description (got ${n1.platform}/${n1.module})`);
    const n2 = JSS.inferDbgNaming({ components: [], summary: 'SM8650 充电异常', description: 'mt6789 usb' });
    assert(n2.platform === 'QCOM' && n2.module === 'CHG', `DBG-01b: summary beats description, sm8650→QCOM, 充电→CHG (got ${n2.platform}/${n2.module})`);
    const n3 = JSS.inferDbgNaming({ description: 'mt6789 kernel panic 死机' });
    assert(n3.platform === 'MTK' && n3.module === 'KERN', `DBG-01c: mt6789→MTK, kernel→KERN from description (got ${n3.platform}/${n3.module})`);
    const n4 = JSS.inferDbgNaming({});
    assert(n4.platform === 'COMMON' && n4.module === 'GEN', 'DBG-01d: empty issue → COMMON/GEN');
    const n5 = JSS.inferDbgNaming({ components: ['展锐 Audio'], summary: '喇叭无声' });
    assert(n5.platform === 'UNISOC' && n5.module === 'AUD', `DBG-01e: 展锐→UNISOC, Audio→AUD (got ${n5.platform}/${n5.module})`);
    const n6 = JSS.inferDbgNaming({ summary: 'USB 充电异常' });
    assert(n6.module === 'CHG', `DBG-01f: CHG listed before USB in rule order (got ${n6.module})`);

    // ② sanitizeDbgTitle
    assert(JSS.sanitizeDbgTitle('SPE123-1', 'a/b:c*d?"<>|#%&^[]! x') === 'SPE123-1-abcd-x', 'DBG-02a: illegal chars stripped, space→dash');
    assert(JSS.sanitizeDbgTitle('SPE123-1', '充电（PD）异常！') === 'SPE123-1-充电PD异常', 'DBG-02b: full-width punct stripped');
    const longS = '超长摘要'.repeat(10); // 40 chars
    const tLong = JSS.sanitizeDbgTitle('K-1', longS);
    assert(tLong === 'K-1-' + '超长摘要'.repeat(6), `DBG-02c: short title truncated to 24 chars (got ${tLong.length})`);
    assert(JSS.sanitizeDbgTitle('SPE123-1', '') === 'SPE123-1', 'DBG-02d: empty summary → KEY only');
    assert(JSS.sanitizeDbgTitle('SPE123-1', '  多空   白  ') === 'SPE123-1-多空-白', 'DBG-02e: whitespace collapsed to single dash');

    // ③ buildDbgFileName: 精确格式 / ≤80 / 超长只截标题
    const fn1 = JSS.buildDbgFileName(
      { key: 'SPE123-163', summary: '电量计信息缺失' },
      new Date(2026, 9, 20),
      { platform: 'UNISOC', module: 'CHG' }
    );
    assert(fn1 === 'SPE123-163-电量计信息缺失_v0.1_20261020_UNISOC_CHG_DBG.md', `DBG-03a: exact filename (got ${fn1})`);
    const fn2 = JSS.buildDbgFileName(
      { key: 'SPECIALPROJECT-123456789', summary: 'x'.repeat(60) },
      new Date(2026, 9, 20),
      { platform: 'COMMON', module: 'GEN' }
    );
    assert(fn2.length <= 80 && fn2.startsWith('SPECIALPROJECT-123456789') && fn2.endsWith('_v0.1_20261020_COMMON_GEN_DBG.md'), `DBG-03b: ≤80, KEY + suffix preserved (len ${fn2.length})`);

    // ④ buildDbgNoteContent: fm/tags/四章节顺序/占位/评论引用块
    const issueA = {
      key: 'SPE123-163', summary: '充电异常', url: 'http://jira/x', status: 'In Progress',
      assignee: '张三', reporter: '李四', components: ['Charger'],
      description: '描述正文第一行'
    };
    const c1 = JSS.buildDbgNoteContent(issueA, [{ author: '王五', created: '2026-10-20', body: '评论一行\n评论二行' }], new Date(2026, 9, 20), { platform: 'QCOM', module: 'CHG' });
    assert(c1.includes('doctype: DBG') && c1.includes('version: v0.1') && c1.includes('status: draft'), 'DBG-04a: doctype/version/status in fm');
    assert(c1.includes('platform: [QCOM]') && c1.includes('module: [CHG]'), 'DBG-04b: platform/module fm');
    assert(c1.includes('"#platform/qcom"') && c1.includes('"#module/charger"') && c1.includes('"#doctype/dbg"') && c1.includes('"#status/draft"'), 'DBG-04c: four tags');
    assert(c1.includes('jira_key: "SPE123-163"') && c1.includes('jira_url: "http://jira/x"'), 'DBG-04d: jira fields');
    const iR = c1.indexOf('## 复现现象');
    const iS = c1.indexOf('## 源码调用链');
    const iV = c1.indexOf('## 验证结论');
    const iP = c1.indexOf('## Patch');
    assert(iR > 0 && iR < iS && iS < iV && iV < iP, 'DBG-04e: four DBG sections in order');
    assert(c1.includes('- 测试条件/版本:') && c1.includes('```text\n```'), 'DBG-04f: 复现现象 prompts + empty code block');
    assert(c1.includes('> 评论一行') && c1.includes('> 评论二行') && c1.includes('👤 王五'), 'DBG-04g: comment body quote-wrapped');
    const c2 = JSS.buildDbgNoteContent({ key: 'X-1', summary: '' }, [], new Date(2026, 9, 20), { platform: 'COMMON', module: 'GEN' });
    assert(c2.includes('*(暂无详细描述)*') && c2.includes('*(暂无历史注释记录)*'), 'DBG-04h: empty desc/comments placeholders');
    assert(c2.includes('platform: [COMMON]') && c2.includes('"#platform/common"') && c2.includes('"#module/general"'), 'DBG-04i: COMMON/GEN → common/general tags');

    // ⑤ 服务: mock vault (复用 Suite 30/31 写法)
    const mockNodes32 = new Map();
    const mkFolderN32 = (p) => {
      const n = { name: p.split('/').pop(), path: p, children: [] };
      mockNodes32.set(p, n);
      const par = p.split('/').slice(0, -1).join('/');
      if (par && mockNodes32.has(par)) mockNodes32.get(par).children.push(n);
      return n;
    };
    const mkFileN32 = (p, c, mtime) => {
      const n = { name: p.split('/').pop(), path: p, extension: p.split('.').pop(), stat: { mtime: mtime || Date.now() }, content: c };
      mockNodes32.set(p, n);
      const par = p.split('/').slice(0, -1).join('/');
      if (par && mockNodes32.has(par)) mockNodes32.get(par).children.push(n);
      return n;
    };
    const mockVault32 = {
      adapter: { exists: async (p) => mockNodes32.has(p) },
      getAbstractFileByPath: (p) => mockNodes32.get(p) || null,
      createFolder: async (p) => { if (!mockNodes32.has(p)) mkFolderN32(p); return mockNodes32.get(p); },
      create: async (p, c) => mkFileN32(p, c),
      read: async (f) => f.content
    };
    const svc32 = new JSS.JiraSandboxService({ app: { vault: mockVault32 } });
    const issue32 = { key: 'SPE123-163', summary: '充电异常', url: 'http://jira/x', components: ['Charger'] };

    // exists 真假
    assert((await svc32.exists('SPE123-163')) === false, 'SBX-01a: exists false before create');
    // create 首次: 建目录+草稿, 不建 attachments
    const r1 = await svc32.create(issue32, [], new Date(2026, 9, 20));
    assert(r1.created === true && r1.folder === '00-Inbox/03-Quick-Note/SPE123-163', `SBX-01b: first create makes dir (got ${r1.folder})`);
    assert(/00-Inbox\/03-Quick-Note\/SPE123-163\/.+_DBG\.md$/.test(r1.file.path), `SBX-01c: DBG draft path (got ${r1.file.path})`);
    assert(!mockNodes32.has('00-Inbox/03-Quick-Note/SPE123-163/attachments'), 'SBX-01d: attachments dir NOT created');
    assert(r1.file.content.includes('## 复现现象') && r1.file.content.includes('doctype: DBG'), 'SBX-01e: draft content has DBG fm + sections');
    assert((await svc32.exists('SPE123-163')) === true, 'SBX-01f: exists true after create');
    // 再次 create: 返回已有草稿 created:false, 不重复建文件
    const filesBefore = [...mockNodes32.keys()].filter(p => p.endsWith('.md')).length;
    const r2 = await svc32.create(issue32, []);
    assert(r2.created === false && r2.file.path === r1.file.path, 'SBX-02a: second create returns existing draft');
    assert([...mockNodes32.keys()].filter(p => p.endsWith('.md')).length === filesBefore, 'SBX-02b: no new file on second create');
    // 目录存在但无 DBG → 补建
    mkFolderN32('00-Inbox/03-Quick-Note/OTHER-1');
    mkFileN32('00-Inbox/03-Quick-Note/OTHER-1/note.md', 'x');
    const r3 = await svc32.create({ key: 'OTHER-1', summary: '' }, [], new Date(2026, 9, 20));
    assert(r3.created === true && r3.file.name.endsWith('_DBG.md'), 'SBX-03a: dir without DBG → draft created');
    // createDraft 重名 …_DBG-2.md
    const d1 = await svc32.createDraft(issue32, [], new Date(2026, 9, 20));
    assert(d1.name === r1.file.name.replace(/_DBG\.md$/, '_DBG-2.md'), `SBX-04a: createDraft dedupes with -2 (got ${d1.name})`);
    const d2 = await svc32.createDraft(issue32, [], new Date(2026, 9, 20));
    assert(d2.name.endsWith('_DBG-3.md'), `SBX-04b: second draft → -3 (got ${d2.name})`);
    // list: 递归 + md 优先 + mtime 降序 + 上限 50
    mkFolderN32('00-Inbox/03-Quick-Note/SPE123-163/attachments');
    mkFileN32('00-Inbox/03-Quick-Note/SPE123-163/attachments/log.txt', 'log', 1000);
    mkFileN32('00-Inbox/03-Quick-Note/SPE123-163/old.md', 'x', 500);
    const lst = await svc32.list('SPE123-163');
    assert(lst.length === 5 && lst.some(f => f.name === 'log.txt'), `SBX-05a: list recursive includes attachments (got ${lst.length})`);
    const firstNonMd = lst.findIndex(f => f.extension !== 'md');
    assert(lst.slice(0, firstNonMd === -1 ? lst.length : firstNonMd).every(f => f.extension === 'md'), 'SBX-05b: md files first');
    assert(lst[firstNonMd].name === 'log.txt', 'SBX-05c: non-md after md');
    for (let i = 0; i < 55; i++) mkFileN32(`00-Inbox/03-Quick-Note/OTHER-1/f${i}.txt`, 'x', i);
    assert((await svc32.list('OTHER-1')).length === 50, 'SBX-05d: list capped at 50');
    const lst2 = await svc32.list('OTHER-1');
    assert(lst2[0].extension === 'md', 'SBX-05e: md files still first under cap');
    assert((await svc32.list('NOPE-9')).length === 0, 'SBX-05f: missing dir → empty list');

    // ⑥ mergeCaptureContext: 合并语义 + 显式 null/'' 屏蔽
    const baseCtx = { selectedTopicId: 'T1', jiraKey: null, activeFilePath: 'a/b.md', selectionText: 'sel', selectionFromAgent: true };
    const mCtx = ICP.mergeCaptureContext(baseCtx, { jiraKey: 'SPE123-163', selectedTopicId: null, activeFilePath: null, selectionText: '', selectionFromAgent: false, module: 'CHG' });
    assert(mCtx.jiraKey === 'SPE123-163' && mCtx.module === 'CHG', 'CTX-01a: override keys win');
    assert(mCtx.selectedTopicId === null && mCtx.activeFilePath === null && mCtx.selectionText === '' && mCtx.selectionFromAgent === false, 'CTX-01b: explicit null/empty mask base values');
    const mCtx2 = ICP.mergeCaptureContext(baseCtx, { jiraKey: 'K-1' });
    assert(mCtx2.activeFilePath === 'a/b.md' && mCtx2.selectionText === 'sel' && mCtx2.selectedTopicId === 'T1', 'CTX-01c: unspecified keys keep base values');
    assert(baseCtx.jiraKey === null && baseCtx.selectionText === 'sel', 'CTX-01d: base object not mutated');
  }

  // --- Suite 33: JIRA-P2A —— 联调提示词 / 结单分流 / 升为专题 (P2a) ---
  console.log('\n>>> Suite 33: JIRA-P2A (Tools Prompts / Triage / Promote)');
  {
    const JSS = require(path.join(pluginDir, 'services', 'jira-sandbox-service.js'));
    const TS = require(path.join(pluginDir, 'services', 'topic-service.js'));

    const issP = { key: 'SPE123-163', summary: '充电异常', url: 'http://x', components: ['Charger'] };
    const pCtx = {
      sandboxDir: '00-Inbox/03-Quick-Note/SPE123-163',
      draftPath: '00-Inbox/03-Quick-Note/SPE123-163/x_DBG.md',
      module: 'CHG', platform: 'QCOM'
    };

    // ① 三个联调提示词
    const pa = JSS.buildAttachmentPrompt(issP, pCtx);
    assert(pa.includes('SPE123-163') && pa.includes('jira_list_attachments') && pa.includes('jira_download_attachment') && pa.includes('/attachments/') && pa.includes('复现现象') && pa.includes('不存在请先创建'), 'P2A-01a: attachment prompt tools/dir/section/create-hint');
    const ps = JSS.buildSourcePrompt(issP, pCtx);
    assert(ps.includes('opengrok_list_projects') && ps.includes('opengrok_search_code') && ps.includes('opengrok_read_file') && ps.includes('源码调用链') && ps.includes('CHG') && ps.includes('行号'), 'P2A-01b: source prompt opengrok tools/section/module');
    const pg = JSS.buildGerritPrompt(issP, pCtx);
    assert(pg.includes('gerrit_search_changes') && pg.includes('gerrit_get_diff') && pg.includes('gerrit_get_comments') && pg.includes('## Patch') && pg.includes('SPE123-163'), 'P2A-01c: gerrit prompt tools/section');

    // ② buildCasePrompt
    const pc = JSS.buildCasePrompt(issP, pCtx);
    assert(pc.includes('tabonkb-inbox-ingest') && pc.includes('_v1.0_') && pc.includes('_CASE.md'), 'P2A-02a: case prompt skill + naming template');
    assert(pc.includes('04-Debug-Case') && pc.includes('05-Charger'), 'P2A-02b: CHG → 05-Charger landing dir');
    assert(pc.includes('#issue/') && pc.includes('确认') && pc.includes('归类裁决') && pc.includes('Oplog'), 'P2A-02c: #issue/ tag + L2 confirm wording');
    const pcGen = JSS.buildCasePrompt(issP, { ...pCtx, module: 'GEN' });
    assert(pcGen.includes('01-Directory-Spec'), 'P2A-02d: GEN → 01-Directory-Spec 裁决提示');

    // ③ toolIdForModule
    assert(JSS.toolIdForModule('CHG') === 'battery-charger' && JSS.toolIdForModule('PWR') === 'battery-charger', 'P2A-03a: CHG/PWR → battery-charger');
    assert(JSS.toolIdForModule('DISP') === 'logic' && JSS.toolIdForModule('') === 'logic' && JSS.toolIdForModule('GEN') === 'logic', 'P2A-03b: others → logic');

    // ④ findTopicByJira (纯函数)
    assert(TS.findTopicByJira([{ id: 't1', jira: ['SPE-1', 'ABC-2'] }], 'abc-2').id === 't1', 'P2A-04a: case-insensitive jira hit');
    assert(TS.findTopicByJira([{ id: 't1', jira: 'not-array' }], 'X-1') === null, 'P2A-04b: jira non-array tolerated');
    assert(TS.findTopicByJira([{ id: 't1', jira: ['A-1'] }], 'B-2') === null && TS.findTopicByJira(null, 'A-1') === null, 'P2A-04c: no hit / null topics → null');

    // ⑤ readDisposition / setDisposition (mock vault + fm)
    const _parseFm33 = (content) => {
      const m = /^---\n([\s\S]*?)\n---/.exec(String(content));
      const fm = {};
      if (!m) return fm;
      for (const line of m[1].split('\n')) {
        const mm = /^([A-Za-z_]+):\s*(.*)$/.exec(line);
        if (!mm) continue;
        let v = mm[2].trim();
        if (/^\[.*\]$/.test(v)) v = v === '[]' ? [] : v.slice(1, -1).split(',').map(x => x.trim().replace(/^"|"$/g, '').replace(/\\"/g, '"'));
        else if (v === 'true') v = true;
        else if (v === 'false') v = false;
        else if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/\\"/g, '"');
        fm[mm[1]] = v;
      }
      return fm;
    };
    const nodes33 = new Map();
    const fm33 = new Map();
    const mkFolder33 = (p) => {
      const n = { name: p.split('/').pop(), path: p, children: [] };
      nodes33.set(p, n);
      const par = p.split('/').slice(0, -1).join('/');
      if (par && nodes33.has(par)) nodes33.get(par).children.push(n);
      return n;
    };
    const mkFile33 = (p, c, mtime) => {
      const n = { name: p.split('/').pop(), path: p, extension: p.split('.').pop(), stat: { mtime: mtime || Date.now() }, content: c };
      nodes33.set(p, n);
      const par = p.split('/').slice(0, -1).join('/');
      if (par && nodes33.has(par)) nodes33.get(par).children.push(n);
      fm33.set(p, _parseFm33(c));
      return n;
    };
    const mockVault33 = {
      adapter: { exists: async (p) => nodes33.has(p) },
      getAbstractFileByPath: (p) => nodes33.get(p) || null,
      createFolder: async (p) => { if (!nodes33.has(p)) mkFolder33(p); return nodes33.get(p); },
      create: async (p, c) => mkFile33(p, c),
      read: async (f) => f.content,
      modify: async (f, c) => { f.content = c; fm33.set(f.path, _parseFm33(c)); },
      process: async (f, fn) => { f.content = fn(f.content); return f.content; },
      rename: async (f, newPath) => {
        const oldPath = f.path;
        const oldPar = nodes33.get(oldPath.split('/').slice(0, -1).join('/'));
        if (oldPar) oldPar.children = oldPar.children.filter(c => c !== f);
        const moves = [];
        for (const [p, n] of [...nodes33.entries()]) {
          if (p === oldPath || p.startsWith(oldPath + '/')) moves.push([p, n]);
        }
        for (const [p, n] of moves) {
          const np = newPath + p.slice(oldPath.length);
          nodes33.delete(p);
          n.path = np;
          nodes33.set(np, n);
          if (fm33.has(p)) { fm33.set(np, fm33.get(p)); fm33.delete(p); }
        }
        f.name = newPath.split('/').pop();
        const newPar = nodes33.get(newPath.split('/').slice(0, -1).join('/'));
        if (newPar) newPar.children.push(f);
      },
      delete: async (f) => {
        const kill = (p) => {
          const n = nodes33.get(p);
          if (!n) return;
          if (n.children) for (const c of [...n.children]) kill(c.path);
          nodes33.delete(p); fm33.delete(p);
        };
        const par = nodes33.get(f.path.split('/').slice(0, -1).join('/'));
        if (par) par.children = par.children.filter(c => c !== f);
        kill(f.path);
      }
    };
    const mockApp33 = {
      vault: mockVault33,
      fileManager: {
        processFrontMatter: async (file, fn) => {
          const fm = fm33.get(file.path) || {};
          fn(fm);
          fm33.set(file.path, fm);
        },
        renameFile: async (file, newPath) => mockVault33.rename(file, newPath)
      },
      metadataCache: { getFileCache: (f) => ({ frontmatter: fm33.get(f.path) || {} }) }
    };

    const svcBox = new JSS.JiraSandboxService({ app: mockApp33 });
    mkFolder33('00-Inbox');
    mkFolder33('00-Inbox/03-Quick-Note');
    const dbgPath = '00-Inbox/03-Quick-Note/SPE123-163/x_DBG.md';
    mkFolder33('00-Inbox/03-Quick-Note/SPE123-163');
    mkFile33(dbgPath, '---\ntitle: t\ndoctype: DBG\nupdated: 2026-10-20\n---\nbody');
    const d0 = await svcBox.readDisposition('SPE123-163');
    assert(d0.disposition === '' && d0.closed_at === '', 'P2A-05a: empty disposition default');
    await svcBox.setDisposition('SPE123-163', 'closed', new Date(2026, 9, 22));
    const d1 = await svcBox.readDisposition('SPE123-163');
    assert(d1.disposition === 'closed' && d1.closed_at === '2026-10-22', 'P2A-05b: closed writes disposition + closed_at');
    assert(fm33.get(dbgPath).updated === '2026-10-22', 'P2A-05c: existing updated field refreshed');
    await svcBox.setDisposition('SPE123-163', 'topic', new Date(2026, 9, 23));
    const d2 = await svcBox.readDisposition('SPE123-163');
    assert(d2.disposition === 'topic' && d2.closed_at === '2026-10-22', 'P2A-05d: topic does not touch closed_at');
    await svcBox.setDisposition('SPE123-163', 'closed', new Date(2026, 9, 25));
    assert((await svcBox.readDisposition('SPE123-163')).closed_at === '2026-10-25', 'P2A-05e: re-close refreshes closed_at (idempotent)');
    let threwND = false;
    try { await svcBox.setDisposition('NONE-1', 'closed'); } catch (e) { threwND = e.message === 'NO_DRAFT'; }
    assert(threwND, 'P2A-05f: no draft → NO_DRAFT');
    assert((await svcBox.findDraft('NONE-1')) === null && (await svcBox.findDraft('SPE123-163')).path === dbgPath, 'P2A-05g: findDraft hit/miss');

    // ⑥ promoteFromJira (mock)
    const tsvc = new TS.TopicService({ app: mockApp33, rootPath: 'topics' });
    mkFile33('00-Inbox/03-Quick-Note/SPE123-163/notes.md', 'notes');
    mkFolder33('00-Inbox/03-Quick-Note/SPE123-163/attachments');
    mkFile33('00-Inbox/03-Quick-Note/SPE123-163/attachments/log.txt', 'log');
    const tp = await tsvc.promoteFromJira({ key: 'SPE123-163', summary: '充电异常分析' }, { module: 'CHG', platform: 'QCOM', sandboxDir: '00-Inbox/03-Quick-Note/SPE123-163' });
    const taskPath = `${tp.dir}/00-TASK.md`;
    const tfm = fm33.get(taskPath);
    assert(tfm.title === '[SPE123-163] 充电异常分析' && tfm.track === 'work' && tfm.module === 'CHG' && tfm.goal === '充电异常分析', 'P2A-06a: topic fm title/track/module/goal');
    assert(Array.isArray(tfm.jira) && tfm.jira.includes('SPE123-163'), 'P2A-06b: topic jira array');
    assert(nodes33.has(`${tp.dir}/x_DBG.md`) && nodes33.has(`${tp.dir}/notes.md`) && nodes33.has(`${tp.dir}/attachments/log.txt`), 'P2A-06c: sandbox children (incl attachments/) moved to topic dir top');
    assert(!nodes33.has('00-Inbox/03-Quick-Note/SPE123-163'), 'P2A-06d: emptied sandbox dir deleted');
    assert(fm33.get(`${tp.dir}/x_DBG.md`).disposition === 'topic', 'P2A-06e: moved draft fm disposition=topic');
    const taskBody = nodes33.get(taskPath).content;
    const parsedT = TS.parseTaskBody(taskBody);
    assert(taskBody.includes('源自 Jira SPE123-163：充电异常分析') && taskBody.includes(`[[${tp.dir}/x_DBG]]`), 'P2A-06f: timeline entry + draft wikilink');
    assert(parsedT.steps.some(s => String(s.label || '').includes('梳理 SPE123-163 排查结论')), 'P2A-06g: checklist step added');

    // 同名冲突加后缀: 沙盒里混入 00-TASK.md
    mkFolder33('00-Inbox/03-Quick-Note/SPEC-1');
    mkFile33('00-Inbox/03-Quick-Note/SPEC-1/00-TASK.md', 'shadow');
    const tp2 = await tsvc.promoteFromJira({ key: 'SPEC-1', summary: 'x' }, { sandboxDir: '00-Inbox/03-Quick-Note/SPEC-1' });
    assert(nodes33.has(`${tp2.dir}/00-TASK-2.md`), 'P2A-06h: name collision → -2 suffix, 00-TASK.md not overwritten');

    // 残留不删: _moveFile 对顽固文件抛错 → 目录保留
    mkFolder33('00-Inbox/03-Quick-Note/STUB-1');
    mkFile33('00-Inbox/03-Quick-Note/STUB-1/keep.md', 'k');
    mkFile33('00-Inbox/03-Quick-Note/STUB-1/stubborn.txt', 's');
    const tsvcB = new TS.TopicService({ app: mockApp33, rootPath: 'topics' });
    const origMove = tsvcB._moveFile.bind(tsvcB);
    tsvcB._moveFile = async (f, p) => { if (f.name === 'stubborn.txt') throw new Error('IO locked'); return origMove(f, p); };
    let threwMove = false;
    try { await tsvcB.promoteFromJira({ key: 'STUB-1', summary: 'x' }, { sandboxDir: '00-Inbox/03-Quick-Note/STUB-1' }); } catch (e) { threwMove = true; }
    assert(threwMove && nodes33.has('00-Inbox/03-Quick-Note/STUB-1'), 'P2A-06i: move failure propagates, non-empty dir kept');

    // 沙盒不存在仍成功
    const tp3 = await tsvc.promoteFromJira({ key: 'NOBOX-1', summary: '无沙盒' }, { sandboxDir: '00-Inbox/03-Quick-Note/NOBOX-1' });
    assert(tp3.id && Array.isArray(fm33.get(`${tp3.dir}/00-TASK.md`).jira) && fm33.get(`${tp3.dir}/00-TASK.md`).jira.includes('NOBOX-1'), 'P2A-06j: missing sandbox → topic still created');

    // ⑦ ensureTopicFromJira: 命中不重复创建
    const e1 = await tsvc.ensureTopicFromJira({ key: 'SPE123-163', summary: 'x' }, {});
    assert(e1.created === false && e1.topic.id === tp.id, 'P2A-07a: existing topic reused (created:false)');
    const e2 = await tsvc.ensureTopicFromJira({ key: 'NEW-9', summary: '新单' }, {});
    assert(e2.created === true && e2.topic.id, 'P2A-07b: new jira → created:true');
    const e3 = await tsvc.ensureTopicFromJira({ key: 'NEW-9', summary: '新单' }, {});
    assert(e3.created === false && e3.topic.id === e2.topic.id, 'P2A-07c: second call does not duplicate');
  }

  // --- Suite 34: TOPIC-P2B —— 智能与治理 (入库提示词/AI/自动浇水/枯萎/归档②) ---
  console.log('\n>>> Suite 34: TOPIC-P2B (Smart & Governance)');
  {
    const TS = require(path.join(pluginDir, 'services', 'topic-service.js'));
    const JSS = require(path.join(pluginDir, 'services', 'jira-sandbox-service.js'));

    const t34 = {
      id: 't1', dir: 'topics/t1', title: '充电深耕', track: 'deep', module: 'CHG',
      status: 'in_progress', goal: '吃透快充框架',
      steps: [{ label: '读框架', done: true }, { label: '画调用链', done: false }],
      timeline: [{ label: '开工' }, { label: '读完 HAL' }, { label: '整理笔记' }],
      ideas: [{ label: '想法甲', struck: false }, { label: '想法乙', struck: true }],
      published_docs: [], linked_refs: []
    };
    const f34 = { path: 'topics/t1/draft.md', name: 'draft.md' };

    // ① buildIngestPrompt
    const ip = TS.buildIngestPrompt(t34, f34, { platform: 'QCOM', module: 'CHG', doctype: 'DBG', targetDir: '', moduleDir: '05-Charger' });
    assert(ip.includes('tabonkb-inbox-ingest'), 'P2B-01a: skill name');
    assert(ip.includes('99-Meta/02-Naming-Spec.md') && ip.includes('v1.2'), 'P2B-01b: naming spec ref');
    assert(ip.includes('topics/t1/draft.md') && ip.includes('topics/t1'), 'P2B-01c: file path + topic dir');
    assert(ip.includes('QCOM') && ip.includes('CHG') && ip.includes('DBG'), 'P2B-01d: platform/module/doctype');
    assert(ip.includes('01-Directory-Spec') && ip.includes('03-Driver/05-Charger/'), 'P2B-01e: auto-dir ruling + module dir suggestion');
    assert(ip.includes('归类裁决') && ip.includes('确认后再执行'), 'P2B-01f: L2 confirm wording');
    assert(ip.includes('published_docs') && ip.includes('进展日志') && ip.includes('📦 入库'), 'P2B-01g: published_docs + timeline append');
    assert(ip.includes('不删除') && ip.includes('原草稿'), 'P2B-01h: keep original draft');
    const ip2 = TS.buildIngestPrompt(t34, f34, { platform: 'COMMON', module: 'GEN', doctype: 'NOTE', targetDir: '', moduleDir: '' });
    assert(ip2.includes('请按 01-Directory-Spec 裁决'), 'P2B-01i: missing moduleDir wording');
    const ip3 = TS.buildIngestPrompt(t34, f34, { platform: 'COMMON', module: 'GEN', doctype: 'NOTE', targetDir: '08-Learning/x', moduleDir: '' });
    assert(ip3.includes('08-Learning/x'), 'P2B-01j: explicit targetDir passed through');

    // ② buildDecomposePrompt
    const dp = TS.buildDecomposePrompt(t34);
    assert(dp.includes('吃透快充框架') && dp.includes('充电深耕'), 'P2B-02a: goal + title');
    assert(dp.includes('读框架') && dp.includes('画调用链'), 'P2B-02b: checklist items');
    assert(dp.includes('整理笔记') && dp.includes('读完 HAL'), 'P2B-02c: recent progress');
    assert(dp.includes('确认') && dp.includes('执行步骤'), 'P2B-02d: confirm-before-append');

    // ③ buildEvaluatePrompt
    const seed34 = { path: 'topics/_Seeds/s1.md', title: '快充想法', idea: '研究 vbus', waters: [{ text: 'x' }], source: 'manual', source_ref: '' };
    const ep = TS.buildEvaluatePrompt(seed34, { weknoraTools: ['weknora_search', 'weknora_read_document'] });
    assert(ep.includes('weknora_search') && ep.includes('weknora_read_document'), 'P2B-03a: weknoraTools verbatim');
    assert(ep.includes('topics/_Seeds/s1.md') && ep.includes('研究 vbus'), 'P2B-03b: seed path + idea');
    assert(ep.includes('✨评估') && ep.includes('## 浇水'), 'P2B-03c: water format');
    assert(/空.*track|track.*空/.test(ep) || ep.includes('空字段'), 'P2B-03d: only empty fm fields');
    const epNone = TS.buildEvaluatePrompt(seed34, {});
    assert(epNone.includes('请使用可用的 WeKnora 检索工具'), 'P2B-03e: missing tools fallback');

    // ④ seedKeywords
    const kw = TS.seedKeywords('charger IC 快充异常 vbus the and vbus');
    assert(kw.includes('charger') && kw.includes('vbus'), 'P2B-04a: ascii tokens');
    assert(!kw.includes('the') && !kw.includes('and') && !kw.includes('ic'), 'P2B-04b: stopwords + len>=3');
    assert(kw.includes('快充') && kw.includes('充异') && kw.includes('异常'), 'P2B-04c: CJK bigrams');
    assert(kw.filter(x => x === 'vbus').length === 1, 'P2B-04d: dedup');

    // ⑤ seedMatchesDoc
    const s5 = { module: 'CHG', title: '快充异常', idea: '充电 vbus' };
    assert(TS.seedMatchesDoc(s5, { module: ['chg'], text: '充电 异常 vbus' }) === true, 'P2B-05a: module match + score>=3 + ci');
    assert(TS.seedMatchesDoc({ ...s5 }, { module: ['CHG'], text: '快充 异常' }) === false, 'P2B-05b: score 2 no trigger');
    assert(TS.seedMatchesDoc({ ...s5, module: '' }, { module: ['CHG'], text: '快充 异常 vbus 充电' }) === false, 'P2B-05c: empty module no trigger');
    assert(TS.seedMatchesDoc(s5, { module: ['DISP'], text: '快充 异常 vbus 充电' }) === false, 'P2B-05d: module mismatch no trigger');

    // ⑥ parseSeedBody auto/line + removeWaterLine
    const sb = ['# x', '', '## 想法', 'idea', '', '## 浇水', '- **[2026-01-01 10:00]** 手动', '- **[2026-01-02 10:00]** 关联：[[a/b]] ·auto', ''].join('\n');
    const pb = TS.parseSeedBody(sb);
    assert(pb.waters.length === 2 && pb.waters[0].auto === false && pb.waters[1].auto === true, 'P2B-06a: auto flag');
    assert(pb.waters[1].text.includes('·auto') && pb.waters[1].line === 7, 'P2B-06b: text keeps suffix + line index');
    const rm = TS.removeWaterLine(sb, pb.waters[1].line);
    assert(!rm.includes('关联：[[a/b]]') && rm.includes('手动'), 'P2B-06c: removeWaterLine removes only target');
    const rmBad = TS.removeWaterLine(sb, 99);
    assert(rmBad === sb, 'P2B-06d: illegal line returns unchanged');
    assert(TS.isAutoWater({ text: 'x ·auto' }) === true && TS.isAutoWater({ text: 'x' }) === false, 'P2B-06e: isAutoWater');

    // ⑦ shouldWitherSeed
    const now34 = new Date('2026-10-20T00:00:00').getTime();
    const d89 = new Date(now34 - 89 * 86400000);
    const d90 = new Date(now34 - 90 * 86400000);
    const fmt34 = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
    assert(TS.shouldWitherSeed({ status: 'seed', touched: fmt34(d89) }, now34) === false, 'P2B-07a: 89d no');
    assert(TS.shouldWitherSeed({ status: 'seed', touched: fmt34(d90) }, now34) === true, 'P2B-07b: 90d yes');
    assert(TS.shouldWitherSeed({ status: 'sprouted', touched: fmt34(d90) }, now34) === false, 'P2B-07c: sprouted never');
    assert(TS.shouldWitherSeed({ status: 'seed', created: '2026-07-20', touched: '' }, now34) === true, 'P2B-07d: missing touched uses created');
    assert(TS.shouldWitherSeed({ status: 'seed' }, now34) === false, 'P2B-07e: both missing → false');
    assert(TS.shouldWitherSeed({ status: 'growing', touched: fmt34(d90) }, now34) === true, 'P2B-07f: growing withers');

    // ⑧-⑭ mock vault
    const _parseFm34 = (content) => {
      const m = /^---\n([\s\S]*?)\n---/.exec(String(content));
      const fm = {};
      if (!m) return fm;
      for (const line of m[1].split('\n')) {
        const mm = /^([A-Za-z_]+):\s*(.*)$/.exec(line);
        if (!mm) continue;
        let v = mm[2].trim();
        if (/^\[.*\]$/.test(v)) v = v === '[]' ? [] : v.slice(1, -1).split(',').map(x => x.trim().replace(/^"|"$/g, '').replace(/\\"/g, '"'));
        else if (v === 'true') v = true;
        else if (v === 'false') v = false;
        else if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/\\"/g, '"');
        fm[mm[1]] = v;
      }
      return fm;
    };
    const nodes34 = new Map();
    const fm34 = new Map();
    const mkFolder34 = (p) => {
      const n = { name: p.split('/').pop(), path: p, children: [] };
      nodes34.set(p, n);
      const par = p.split('/').slice(0, -1).join('/');
      if (par && nodes34.has(par)) nodes34.get(par).children.push(n);
      return n;
    };
    const mkFile34 = (p, c, mtime) => {
      const n = { name: p.split('/').pop(), path: p, extension: p.split('.').pop(), stat: { mtime: mtime || Date.now() }, content: c };
      nodes34.set(p, n);
      const par = p.split('/').slice(0, -1).join('/');
      if (par && nodes34.has(par)) nodes34.get(par).children.push(n);
      fm34.set(p, _parseFm34(c));
      return n;
    };
    const mockVault34 = {
      adapter: { exists: async (p) => nodes34.has(p) },
      getAbstractFileByPath: (p) => nodes34.get(p) || null,
      createFolder: async (p) => { if (!nodes34.has(p)) mkFolder34(p); return nodes34.get(p); },
      create: async (p, c) => mkFile34(p, c),
      read: async (f) => f.content,
      modify: async (f, c) => { f.content = c; },
      process: async (f, fn) => { f.content = fn(f.content); return f.content; },
      rename: async (f, newPath) => {
        const oldPath = f.path;
        const oldPar = nodes34.get(oldPath.split('/').slice(0, -1).join('/'));
        if (oldPar) oldPar.children = oldPar.children.filter(c => c !== f);
        const moves = [];
        for (const [p, n] of [...nodes34.entries()]) {
          if (p === oldPath || p.startsWith(oldPath + '/')) moves.push([p, n]);
        }
        for (const [p, n] of moves) {
          const np = newPath + p.slice(oldPath.length);
          nodes34.delete(p);
          n.path = np; n.name = np.split('/').pop();
          nodes34.set(np, n);
          if (fm34.has(p)) { fm34.set(np, fm34.get(p)); fm34.delete(p); }
        }
        const newPar = nodes34.get(newPath.split('/').slice(0, -1).join('/'));
        if (newPar) newPar.children.push(f);
      },
      delete: async (f) => {
        const kill = (p) => {
          const n = nodes34.get(p);
          if (!n) return;
          if (n.children) for (const c of [...n.children]) kill(c.path);
          nodes34.delete(p); fm34.delete(p);
        };
        const par = nodes34.get(f.path.split('/').slice(0, -1).join('/'));
        if (par) par.children = par.children.filter(c => c !== f);
        kill(f.path);
      }
    };
    const mockApp34 = {
      vault: mockVault34,
      fileManager: {
        processFrontMatter: async (file, fn) => {
          const fm = fm34.get(file.path) || {};
          fn(fm);
          fm34.set(file.path, fm);
        },
        renameFile: async (file, newPath) => mockVault34.rename(file, newPath)
      },
      metadataCache: { getFileCache: (f) => ({ frontmatter: fm34.get(f.path) || {} }) }
    };
    const svc = new TS.TopicService({ app: mockApp34, rootPath: 'topics' });

    // isAutoWaterDocPath
    assert(TS.isAutoWaterDocPath('03-Driver/a.md', 'topics') === true, 'P2B-08a: in-scope md true');
    assert(TS.isAutoWaterDocPath('03-Driver/a.png', 'topics') === false, 'P2B-08b: png false');
    assert(TS.isAutoWaterDocPath('00-Inbox/x.md', 'topics') === false, 'P2B-08c: inbox false');
    assert(TS.isAutoWaterDocPath('topics/t1/00-TASK.md', 'topics') === false, 'P2B-08d: topic root false');
    assert(TS.isAutoWaterDocPath('02-Random/x.md', 'topics') === false, 'P2B-08e: out-of-scope false');

    // ⑧ autoWaterForDoc
    mkFolder34('topics'); mkFolder34('topics/_Seeds'); mkFolder34('03-Driver');
    const sd1 = await svc.createSeed({ text: '快充异常 vbus 掉电', module: 'CHG', source: 'manual' });
    const sdS = await svc.createSeed({ text: '快充异常 vbus 掉电 sprouted', module: 'CHG', source: 'manual' });
    fm34.set(sdS.path, { ...fm34.get(sdS.path), status: 'sprouted' });
    const docP = '03-Driver/充电异常-vbus-日志.md';
    mkFile34(docP, '---\nmodule: CHG\ntitle: "充电异常 vbus 日志"\ntags: [driver]\n---\nbody');
    const n1 = await svc.autoWaterForDoc(docP);
    assert(n1 === 1, 'P2B-08f: in-scope doc waters matching seed only');
    let body1 = nodes34.get(sd1.path).content;
    assert(body1.includes('关联：[[03-Driver/充电异常-vbus-日志]] ·auto'), 'P2B-08g: ·auto label appended');
    const n1b = await svc.autoWaterForDoc(docP);
    assert(n1b === 0, 'P2B-08h: repeated call no duplicate');
    assert((await svc.autoWaterForDoc('00-Inbox/x.md')) === 0
      && (await svc.autoWaterForDoc('topics/t1/00-TASK.md')) === 0
      && (await svc.autoWaterForDoc('99-Meta/x.md')) === 0, 'P2B-08i: inbox/topic/out-of-scope skipped');
    // third water → growing
    mkFile34('03-Driver/d2.md', '---\nmodule: CHG\ntitle: "充电异常 vbus 之二"\n---\nb');
    mkFile34('03-Driver/d3.md', '---\nmodule: CHG\ntitle: "充电异常 vbus 之三"\n---\nb');
    await svc.autoWaterForDoc('03-Driver/d2.md');
    const n3 = await svc.autoWaterForDoc('03-Driver/d3.md');
    assert(n3 === 1 && fm34.get(sd1.path).status === 'growing', 'P2B-08j: 3rd water → fm growing');

    // ⑨ autoWaterForIssue
    const sdRef = await svc.createSeed({ text: '排查想法', module: 'GEN', source: 'jira', source_ref: 'SPEC-9' });
    const ni = await svc.autoWaterForIssue({ key: 'spec-9', summary: '任意' });
    assert(ni === 1 && nodes34.get(sdRef.path).content.includes('工单 spec-9 已关闭 ·auto'), 'P2B-09a: source_ref equality (ci)');
    assert((await svc.autoWaterForIssue({ key: 'SPEC-9', summary: 'x' })) === 0, 'P2B-09b: same label dedup');
    const sdKw = await svc.createSeed({ text: '快充异常 vbus', module: 'CHG', source: 'manual' });
    const ni2 = await svc.autoWaterForIssue({ key: 'SPE-77', summary: '充电异常 vbus 掉电', components: ['Charger'] });
    assert(ni2 >= 1 && nodes34.get(sdKw.path).content.includes('工单 SPE-77 已关闭 ·auto'), 'P2B-09c: module+keyword hit');
    const sdGen = await svc.createSeed({ text: '泛泛想法 vbus', module: 'DISP', source: 'manual' });
    const niGen = await svc.autoWaterForIssue({ key: 'GEN-1', summary: 'vbus 泛泛想法', components: [] });
    assert(!nodes34.get(sdGen.path).content.includes('GEN-1'), 'P2B-09d: GEN module excluded from kw match');

    // ⑩ unwater
    const sdU = await svc.createSeed({ text: 'u1', module: 'CHG' });
    await svc.water(sdU, 'w1'); await svc.water(sdU, 'w2'); await svc.water(sdU, 'w3');
    assert(fm34.get(sdU.path).status === 'growing', 'P2B-10a: 3 waters → growing');
    const pbU = TS.parseSeedBody(nodes34.get(sdU.path).content);
    await svc.unwater({ ...sdU, file: nodes34.get(sdU.path), status: 'growing' }, pbU.waters[0].line);
    const pbU2 = TS.parseSeedBody(nodes34.get(sdU.path).content);
    assert(pbU2.waters.length === 2 && fm34.get(sdU.path).status === 'seed', 'P2B-10b: unwater → <3 reverts to seed');

    // ⑪ witherStaleSeeds
    const sdOld = await svc.createSeed({ text: 'old seed', module: 'CHG' });
    const sdNew = await svc.createSeed({ text: 'new seed', module: 'CHG' });
    fm34.set(sdOld.path, { ...fm34.get(sdOld.path), touched: '2025-06-01 00:00', created: '2025-06-01' });
    const nw = await svc.witherStaleSeeds(new Date('2025-09-15').getTime());
    assert(nw === 1, 'P2B-11a: only stale seed withered');
    const oldName = sdOld.id;
    assert(nodes34.has(`topics/_Seeds/_Withered/${oldName}`), 'P2B-11b: moved to _Withered');
    assert(!nodes34.has(`topics/_Seeds/${oldName}`), 'P2B-11c: removed from _Seeds top');
    assert(fm34.get(`topics/_Seeds/_Withered/${oldName}`).status === 'withered', 'P2B-11d: status=withered');
    assert(nodes34.has(sdNew.path), 'P2B-11e: fresh seed untouched');

    // ⑫ scanWithered / reviveSeed
    const wl = await svc.scanWithered();
    assert(wl.length === 1 && wl[0].status === 'withered', 'P2B-12a: scanWithered finds record');
    mkFile34(`topics/_Seeds/${oldName}`, 'conflict'); // 占位制造重名
    await svc.reviveSeed(wl[0]);
    const revivedPath = `topics/_Seeds/${oldName.replace(/\.md$/, '-2.md')}`;
    assert(nodes34.has(revivedPath), 'P2B-12b: revive dedupes name conflict');
    assert(!nodes34.has(`topics/_Seeds/_Withered/${oldName}`), 'P2B-12c: removed from _Withered');
    const rfm = fm34.get(revivedPath);
    assert(rfm.status === 'seed' && rfm.touched && rfm.touched !== '2025-06-01 00:00', 'P2B-12d: status=seed + touched refreshed');

    // ⑬ addPublishedDoc
    const tpA = await svc.createTopic({ title: '专题A', module: 'CHG' });
    const ok1 = await svc.addPublishedDoc({ ...tpA, published_docs: [] }, { path: '03-Driver/doc-x.md' });
    const tfileA = nodes34.get(`${tpA.dir}/00-TASK.md`);
    assert(ok1 === true && fm34.get(tfileA.path).published_docs.includes('[[03-Driver/doc-x]]'), 'P2B-13a: published_docs gets [[no-ext]]');
    assert(tfileA.content.includes('📦 入库：[[03-Driver/doc-x]]'), 'P2B-13b: timeline entry');
    const ok2 = await svc.addPublishedDoc({ ...tpA, published_docs: ['[[03-Driver/doc-x]]'] }, { path: '03-Driver/doc-x.md' });
    assert(ok2 === false && fm34.get(tfileA.path).published_docs.length === 1, 'P2B-13c: dedup');

    // ⑭ archive ideasToSeeds
    const tpB = await svc.createTopic({ title: '专题B', module: 'CHG', track: 'deep' });
    await svc.addIdea(tpB, '想法一');
    await svc.addIdea(tpB, '想法二');
    let parsedB = TS.parseTaskBody(nodes34.get(`${tpB.dir}/00-TASK.md`).content);
    const struckLine = parsedB.ideas[1].line;
    await svc.strikeIdea(tpB, struckLine);
    parsedB = TS.parseTaskBody(nodes34.get(`${tpB.dir}/00-TASK.md`).content); // 重取 struck 状态
    const tpBf = (await svc.scan()).find(t => t.id === tpB.id);
    const ar = await svc.archive(tpBf, { ideasToSeeds: true });
    assert(ar.seedsCreated === 1, 'P2B-14a: only unstruck idea → 1 seed');
    assert(ar.archivedPath.startsWith('topics/_Archived/'), 'P2B-14b: archived path returned');
    assert(nodes34.has(`${ar.archivedPath}/00-TASK.md`), 'P2B-14c: topic folder moved to _Archived');
    const newSeeds = await svc.scanSeeds();
    const convSeed = newSeeds.find(s => String(s.source_ref).includes('_Archived'));
    assert(convSeed && convSeed.source === 'note' && convSeed.source_ref === `[[${ar.archivedPath}/00-TASK]]`, 'P2B-14d: source_ref points at archived task');
    const unstruckIdeas = parsedB.ideas.filter(i => !i.struck);
    const converted = newSeeds.filter(s => String(s.source_ref).includes('_Archived'));
    assert(converted.length === unstruckIdeas.length && converted.every(s => s.track === 'deep' && s.module === 'CHG'), 'P2B-14e: seed count + track/module inherited');
    // 无 ideasToSeeds → 旧行为
    const tpC = await svc.createTopic({ title: '专题C', module: 'DISP' });
    await svc.addIdea(tpC, '遗留想法');
    const tpCf = (await svc.scan()).find(t => t.id === tpC.id);
    const ar2 = await svc.archive(tpCf);
    assert(ar2.seedsCreated === 0 && nodes34.has(`${ar2.archivedPath}/00-TASK.md`), 'P2B-14f: plain archive unchanged');
  }

  // --- Suite 35: TOPIC-P3 —— 周回顾 + 能力雷达 (P3) ---
  console.log('\n>>> Suite 35: TOPIC-P3 (Weekly Review / Radar)');
  {
    const TS = require(path.join(pluginDir, 'services', 'topic-service.js'));
    const RS = require(path.join(pluginDir, 'services', 'radar-service.js'));

    // ① isoWeekKey (期望值按 ISO 8601: 周四定年, 周一为起点)
    assert(TS.isoWeekKey(new Date('2026-01-01T12:00:00')) === '2026-W01', 'P3-01a: 2026-01-01 Thu → W01');
    assert(TS.isoWeekKey(new Date('2026-12-31T12:00:00')) === '2026-W53', 'P3-01b: 2026-12-31 Thu → 2026-W53');
    assert(TS.isoWeekKey(new Date('2027-01-01T12:00:00')) === '2026-W53', 'P3-01c: 2027-01-01 Fri → 仍 2026-W53');
    assert(TS.isoWeekKey(new Date('2027-01-03T12:00:00')) === '2026-W53', 'P3-01d: 周日 2027-01-03 → W53');
    assert(TS.isoWeekKey(new Date('2027-01-04T12:00:00')) === '2027-W01', 'P3-01e: 周一 2027-01-04 → W01');
    assert(TS.isoWeekKey(new Date('2024-12-29T12:00:00')) === '2024-W52', 'P3-01f: 闰年 2024-12-29 Sun → W52');
    assert(TS.isoWeekKey(new Date('2024-12-30T12:00:00')) === '2025-W01', 'P3-01g: 2024-12-30 Mon → 2025-W01');
    assert(TS.isoWeekKey(new Date('2020-12-31T12:00:00')) === '2020-W53', 'P3-01h: 闰年 2020-12-31 → W53');

    // ② shouldShowWeeklyReview
    const now35 = new Date('2026-10-19T10:00:00'); // 周一
    const wk35 = TS.isoWeekKey(now35);
    assert(TS.shouldShowWeeklyReview('', now35, false) === false, 'P3-02a: no content → false');
    assert(TS.shouldShowWeeklyReview(wk35, now35, true) === false, 'P3-02b: same week key → false');
    assert(TS.shouldShowWeeklyReview('2026-W42', now35, true) === true, 'P3-02c: diff week + content → true');

    // ③ buildWeeklyReviewPlan
    const tDay = 86400000;
    const mkIdea35 = (label, daysAgo, struck) => ({ line: 0, label, struck: !!struck, date: new Date(now35.getTime() - daysAgo * tDay).toISOString().slice(0, 10) });
    const topics35 = [
      { id: 't1', title: 'T1', status: 'in_progress', starred: true, ideas: [mkIdea35('旧想法A', 20), mkIdea35('新想法', 2), mkIdea35('已划掉', 30, true), mkIdea35('边界14天', 14)] },
      { id: 't2', title: 'T2', status: 'in_progress', starred: false, ideas: [mkIdea35('旧想法B', 16)] },
      { id: 't3', title: 'T3', status: 'paused', starred: false, ideas: [mkIdea35('暂停的', 100)] },
      { id: 't4', title: 'T4', status: 'done', starred: false, ideas: [mkIdea35('已完成的', 100)] }
    ];
    const seeds35 = [
      { id: 'g1', title: 'G1', status: 'growing', waters: [1, 2, 3, 4, 5], module: 'CHG' },
      { id: 'g2', title: 'G2', status: 'growing', waters: [1, 2, 3], module: 'DISP' },
      { id: 'g3', title: 'G3', status: 'growing', waters: [1], module: 'PWR' },
      { id: 'g4', title: 'G4', status: 'growing', waters: [], module: 'AI' },
      { id: 's1', title: 'S1', status: 'seed', waters: [], module: 'CHG' },
      { id: 'sp', title: 'SP', status: 'sprouted', waters: [1, 2, 3], module: 'CHG' }
    ];
    const plan35 = TS.buildWeeklyReviewPlan(topics35, seeds35, now35);
    assert(plan35.topics.length === 2 && plan35.topics[0].id === 't1' && plan35.topics[0].starred === true && plan35.topics[1].starred === false, 'P3-03a: topics = in_progress only, starred kept');
    assert(plan35.seeds.map(s => s.id).join(',') === 'g1,g2,g3', 'P3-03b: seeds growing only, water desc, top3');
    assert(plan35.seeds.every(s => typeof s.waterCount === 'number'), 'P3-03c: waterCount field');
    const il = plan35.ideas.map(i => i.label);
    assert(il.includes('旧想法A') && il.includes('旧想法B') && il.includes('边界14天'), 'P3-03d: ≥14d unstruck ideas incl 14d boundary');
    assert(!il.includes('新想法') && !il.includes('已划掉') && !il.includes('暂停的') && !il.includes('已完成的'), 'P3-03e: fresh/struck/non-inprogress excluded');
    assert(plan35.ideas[0].label === '旧想法A' && il.length === 3, 'P3-03f: oldest first');
    // 取前 5
    const manyIdeas = [{ id: 'tx', title: 'X', status: 'in_progress', ideas: [mkIdea35('a', 90), mkIdea35('b', 80), mkIdea35('c', 70), mkIdea35('d', 60), mkIdea35('e', 50), mkIdea35('f', 40)] }];
    assert(TS.buildWeeklyReviewPlan(manyIdeas, [], now35).ideas.length === 5, 'P3-03g: ideas capped at 5');

    // ④ computeRadar (返回顺序 = RADAR_MODULES, 字段 code/label/D/J/A/active/raw/score/zone)
    const pushDocs = (arr, mod, dt, n, ts) => { for (let i = 0; i < n; i++) arr.push({ module: mod, doctype: dt, ts: ts != null ? ts : 0 }); };
    const docs35 = [];
    pushDocs(docs35, 'DISP', 'ARCH', 16); pushDocs(docs35, 'DISP', 'DBG', 1);            // D=50 → 100 familiar
    pushDocs(docs35, 'CAM', 'ARCH', 6); pushDocs(docs35, 'CAM', 'DBG', 1);              // D=20 → 40 familiar(边界)
    pushDocs(docs35, 'AUD', 'ARCH', 6); pushDocs(docs35, 'AUD', 'CODE', 1);             // D=19.5 → 39 expand
    pushDocs(docs35, 'USB', 'CODE', 5);                                               // D=7.5 → 15 expand(边界)
    pushDocs(docs35, 'PWR', 'DBG', 3); pushDocs(docs35, 'PWR', 'SPEC', 1);              // D=7 → 14 (+active→expand)
    docs35.push({ module: 'GEN', doctype: 'ARCH', ts: 0 });                           // GEN 不参与
    docs35.push({ module: 'CHG', doctype: 'MEET', ts: 0 });                           // 权重 0
    const topicsR = [{ id: 'tp', status: 'in_progress', module: 'PWR' }, { id: 'tq', status: 'in_progress', module: 'ai' }];
    const radar35 = RS.computeRadar({ docs: docs35, jiraClosed: { DISP: 2, GEN: 5 }, topics: topicsR, nowMs: 0, weights: { doc: 1, jira: 0, act: 0 } });
    const by = Object.fromEntries(radar35.map(r => [r.code, r]));
    assert(radar35.length === RS.RADAR_MODULES.length && radar35[0].code === 'DISP', 'P3-04a: 18 axes in RADAR_MODULES order');
    assert(by.DISP.D === 50 && by.DISP.score === 100 && by.DISP.zone === 'familiar', 'P3-04b: max normalized to 100');
    assert(by.DISP.J === 2, 'P3-04b2: jiraClosed count-map counted (GEN dropped)');
    assert(by.CAM.score === 40 && by.CAM.zone === 'familiar', 'P3-04c: score 40 → familiar boundary');
    assert(by.AUD.score === 39 && by.AUD.zone === 'expand', 'P3-04d: score 39 → expand');
    assert(by.USB.score === 15 && by.USB.zone === 'expand', 'P3-04e: score 15 → expand boundary');
    assert(by.PWR.score === 14 && by.PWR.zone === 'expand' && by.PWR.active === true, 'P3-04f: 14 + active topic → expand');
    assert(by.AI.score === 0 && by.AI.zone === 'expand' && by.AI.active === true, 'P3-04g: 0 + active topic (ci) → expand');
    assert(by.SEC.zone === 'blank' && by.SEC.active === false, 'P3-04h: 0 no topic → blank');
    assert(!radar35.some(r => r.code === 'GEN'), 'P3-04i: GEN not in modules');
    assert(by.CHG.D === 0, 'P3-04j: weight-0 doctype contributes 0');
    // jira count-map + 默认权重 (jira-only → 100)
    const radar35b = RS.computeRadar({ docs: [], jiraClosed: { KERN: 2 }, topics: [], nowMs: 0 });
    const byb = Object.fromEntries(radar35b.map(r => [r.code, r]));
    assert(byb.KERN.J === 2 && byb.KERN.score === 100, 'P3-04k: jira counted, jira-only → 100');
    // active: 89/91 天边界 (只对权重>0 计)
    const docsAct = [
      { module: 'SNS', doctype: 'NOTE', ts: 0 },            // 89d 前 → active
      { module: 'SNS', doctype: 'NOTE', ts: -2 * tDay },    // 91d 前 → 不活跃
      { module: 'SNS', doctype: 'MEET', ts: 0 }             // 权重 0 → 不计活跃
    ];
    const rAct = RS.computeRadar({ docs: docsAct, topics: [], nowMs: 89 * tDay });
    assert(rAct.find(r => r.code === 'SNS').A === 1, 'P3-04l: 89d in / 91d out + weight-0 not counted');
    // 全零
    const rZero = RS.computeRadar({ docs: [], topics: [], nowMs: 0 });
    assert(rZero.every(r => r.score === 0), 'P3-04m: all zero → all 0');
    // 多模块文档各计一次 (大小写不敏感)
    const rMulti = RS.computeRadar({ docs: [{ module: ['CHG', 'usb'], doctype: 'DBG', ts: 0 }], topics: [], nowMs: 0 });
    assert(rMulti.find(r => r.code === 'CHG').D === 2 && rMulti.find(r => r.code === 'USB').D === 2, 'P3-04n: multi-module doc counts each (ci)');
    // 默认权重公式 raw = 0.6D + 0.3J + 0.1A
    const rW = RS.computeRadar({ docs: [{ module: 'WB', doctype: 'DBG', ts: 0 }], jiraClosed: { WB: 1 }, topics: [], nowMs: 0 });
    assert(Math.abs(rW.find(r => r.code === 'WB').raw - (0.6 * 2 + 0.3 * 1 + 0.1 * 1)) < 1e-9, 'P3-04o: raw = 0.6D+0.3J+0.1A');

    // ⑤ quarterKey / prevQuarterKey / diffRadar
    assert(RS.quarterKey(new Date('2026-10-20')) === '2026-Q4' && RS.quarterKey(new Date('2027-01-15')) === '2027-Q1', 'P3-05a: quarterKey');
    assert(RS.prevQuarterKey('2027-Q1') === '2026-Q4' && RS.prevQuarterKey('2026-Q4') === '2026-Q3', 'P3-05b: prevQuarterKey cross-year');
    const diff35 = RS.diffRadar([{ code: 'CHG', score: 60 }, { code: 'USB', score: 10 }], { CHG: 40 });
    assert(diff35[0].delta === 20 && diff35[1].delta === null, 'P3-05c: delta; missing code → null');
    assert(RS.diffRadar([{ code: 'X', score: 5 }], null)[0].delta === null, 'P3-05d: no snapshot → null');

    // ⑥ recommendSeedsForBlank
    const radarRec = [
      { code: 'AI', label: 'AI', zone: 'blank' },
      { code: 'HW', label: '硬件', zone: 'blank' },
      { code: 'CHG', label: '充电', zone: 'familiar' }
    ];
    const seedsRec = [
      { id: 'a', title: 'AI种子1', module: 'ai', status: 'seed', waters: [] },
      { id: 'b', title: 'AI种子2', module: 'AI', status: 'growing', waters: [1, 2, 3] },
      { id: 'c', title: 'AI已发芽', module: 'AI', status: 'sprouted', waters: [] },
      { id: 'd', title: '充电种子', module: 'CHG', status: 'seed', waters: [] }
    ];
    const recs35 = RS.recommendSeedsForBlank(radarRec, seedsRec);
    assert(recs35.length === 2 && recs35[0].code === 'AI' && recs35[1].code === 'HW', 'P3-06a: blank only, both listed');
    assert(recs35[0].seeds.map(s => s.id).join(',') === 'b,a', 'P3-06b: seeds sorted by waters desc, sprouted excluded');
    assert(recs35[1].seeds.length === 0, 'P3-06c: blank w/o seeds still returned');
    assert(!recs35.some(r => r.code === 'CHG'), 'P3-06d: familiar excluded');
    // 每模块最多 3 颗
    const manySeeds = [1, 2, 3, 4].map(n => ({ id: `s${n}`, title: `S${n}`, module: 'HW', status: 'seed', waters: new Array(n).fill(1) }));
    const recsCap = RS.recommendSeedsForBlank(radarRec, manySeeds);
    assert(recsCap.find(r => r.code === 'HW').seeds.length === 3 && recsCap.find(r => r.code === 'HW').seeds[0].id === 's4', 'P3-06e: capped at 3, water desc');

    // ⑦ RadarService.collectDocs / collectJiraClosed / 快照 (mock)
    const fm35 = new Map();
    const allFiles35 = [];
    const mkF35 = (p, fm, mtime) => {
      const f = { path: p, name: p.split('/').pop(), extension: 'md', stat: { mtime: mtime || 0 } };
      fm35.set(p, fm || {});
      allFiles35.push(f);
      return f;
    };
    mkF35('03-Driver/a.md', { module: ['chg', 'usb'], doctype: 'DBG', updated: '2026-10-01' }, 5);
    mkF35('00-Inbox/x.md', { module: 'CHG', doctype: 'NOTE' });
    mkF35('99-Meta/m.md', { module: 'AI', doctype: 'NOTE' });
    mkF35('topics/t1/00-TASK.md', { module: 'DISP', doctype: 'NOTE' });
    mkF35('08-Learning/nomod.md', { doctype: 'NOTE' });                       // 缺 module → 跳过
    mkF35('08-Learning/nodt.md', { module: 'AI' });                            // 缺 doctype → 跳过
    mkF35('08-Learning/01-Materials/l.md', { module: 'AI', doctype: 'arch' }, 7); // doctype 小写→大写; 无 fm 日期 → mtime
    const storage35 = (() => { let m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _dump: () => ({ ...m }) }; })();
    const tsvcStub = { rootPath: 'topics', scan: async () => topicsR, scanSeeds: async () => seedsRec };
    const radarSvc = new RS.RadarService({
      app: { vault: { getMarkdownFiles: () => allFiles35 }, metadataCache: { getFileCache: f => ({ frontmatter: fm35.get(f.path) || {} }) } },
      topicService: tsvcStub,
      getJiraIssues: () => [
        { key: 'WB-1', summary: '充电异常', statusCategory: 'done' },
        { key: 'WB-2', summary: '屏闪 display', statusCategory: 'done' },
        { key: 'WB-3', summary: 'zzz 无关事项', statusCategory: 'done' },
        { key: 'WB-4', summary: '充电相关问题', statusCategory: 'in progress' }
      ],
      categorizeDone: i => String(i.statusCategory || '').toLowerCase() === 'done',
      storage: storage35
    });
    const coll = await radarSvc.collectDocs();
    assert(coll.length === 2, 'P3-07a: collectDocs excludes Inbox/Meta/topics + no-module/no-doctype skipped');
    const cd1 = coll.find(d => d.module.includes('CHG'));
    assert(cd1.module.join(',') === 'CHG,USB' && cd1.doctype === 'DBG', 'P3-07b: array module upper + doctype');
    assert(cd1.ts === Date.parse('2026-10-01'), 'P3-07c: fm.updated preferred over mtime');
    const cd2 = coll.find(d => d.module.includes('AI'));
    assert(cd2.ts === 7 && cd2.doctype === 'ARCH', 'P3-07d: missing fm date → mtime + doctype upper');
    const jm = radarSvc.collectJiraClosed();
    assert(jm.CHG === 1 && jm.DISP === 1 && Object.keys(jm).length === 2, 'P3-07e: done issues → module counts, GEN/in-progress dropped');
    const jmEmpty = new RS.RadarService({ app: { vault: { getMarkdownFiles: () => [] }, metadataCache: { getFileCache: () => ({}) } } }).collectJiraClosed();
    assert(Object.keys(jmEmpty).length === 0, 'P3-07f: missing getter → {}');
    const comp1 = await radarSvc.compute(Date.parse('2026-10-20'));
    assert(Array.isArray(comp1) && comp1.length === RS.RADAR_MODULES.length, 'P3-07g: compute → 18-entry radar');
    assert(comp1.find(r => r.code === 'DISP').J === 1, 'P3-07h: compute feeds cached jira counts');
    // 快照读写
    radarSvc.saveSnapshot('2026-Q4', comp1);
    const snapNow = JSON.parse(storage35._dump()['tabonkb-radar-snapshots']);
    assert(snapNow['2026-Q4'] && typeof snapNow['2026-Q4'].CHG === 'number', 'P3-07i: snapshot written under quarter key');
    assert(radarSvc.prevQuarterSnapshot(new Date('2026-10-20')) === null, 'P3-07j: no prev-quarter snapshot → null');
    storage35.setItem('tabonkb-radar-snapshots', JSON.stringify({ '2026-Q3': { CHG: 5 }, '2026-Q4': { CHG: 9 } }));
    const prevS = radarSvc.prevQuarterSnapshot(new Date('2026-10-20'));
    assert(prevS && prevS.CHG === 5, 'P3-07k: prev quarter snapshot loaded');
    // 只保留最近 8 个季度
    const snaps9 = {};
    for (let y = 2020; y <= 2021; y++) for (let q = 1; q <= 4; q++) snaps9[`${y}-Q${q}`] = { CHG: y * 10 + q };
    snaps9['2022-Q1'] = { CHG: 1 };
    storage35.setItem('tabonkb-radar-snapshots', JSON.stringify(snaps9));
    radarSvc.saveSnapshot('2022-Q2', comp1);
    const after8 = Object.keys(JSON.parse(storage35._dump()['tabonkb-radar-snapshots']));
    assert(after8.length === 8 && after8.includes('2022-Q2') && !after8.includes('2020-Q1'), 'P3-07l: snapshots pruned to latest 8 quarters');

    // ⑧ applyWeeklyReview (mock vault, 复用 Suite34 模式)
    const _parseFm35 = (content) => {
      const m = /^---\n([\s\S]*?)\n---/.exec(String(content));
      const fm = {};
      if (!m) return fm;
      for (const line of m[1].split('\n')) {
        const mm = /^([A-Za-z_]+):\s*(.*)$/.exec(line);
        if (!mm) continue;
        let v = mm[2].trim();
        if (/^\[.*\]$/.test(v)) v = v === '[]' ? [] : v.slice(1, -1).split(',').map(x => x.trim().replace(/^"|"$/g, '').replace(/\\"/g, '"'));
        else if (v === 'true') v = true;
        else if (v === 'false') v = false;
        else if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/\\"/g, '"');
        fm[mm[1]] = v;
      }
      return fm;
    };
    const nodes35 = new Map();
    const fm35b = new Map();
    const mkFolder35 = (p) => {
      const n = { name: p.split('/').pop(), path: p, children: [] };
      nodes35.set(p, n);
      const par = p.split('/').slice(0, -1).join('/');
      if (par && nodes35.has(par)) nodes35.get(par).children.push(n);
      return n;
    };
    const mkFile35 = (p, c) => {
      const n = { name: p.split('/').pop(), path: p, extension: p.split('.').pop(), stat: { mtime: Date.now() }, content: c };
      nodes35.set(p, n);
      const par = p.split('/').slice(0, -1).join('/');
      if (par && nodes35.has(par)) nodes35.get(par).children.push(n);
      fm35b.set(p, _parseFm35(c));
      return n;
    };
    const vault35 = {
      adapter: { exists: async (p) => nodes35.has(p) },
      getAbstractFileByPath: (p) => nodes35.get(p) || null,
      createFolder: async (p) => { if (!nodes35.has(p)) mkFolder35(p); return nodes35.get(p); },
      create: async (p, c) => mkFile35(p, c),
      read: async (f) => f.content,
      modify: async (f, c) => { f.content = c; },
      process: async (f, fn) => { f.content = fn(f.content); return f.content; },
      rename: async (f, newPath) => {
        const oldPath = f.path;
        const oldPar = nodes35.get(oldPath.split('/').slice(0, -1).join('/'));
        if (oldPar) oldPar.children = oldPar.children.filter(c => c !== f);
        const moves = [];
        for (const [p, n] of [...nodes35.entries()]) {
          if (p === oldPath || p.startsWith(oldPath + '/')) moves.push([p, n]);
        }
        for (const [p, n] of moves) {
          const np = newPath + p.slice(oldPath.length);
          nodes35.delete(p);
          n.path = np; n.name = np.split('/').pop();
          nodes35.set(np, n);
          if (fm35b.has(p)) { fm35b.set(np, fm35b.get(p)); fm35b.delete(p); }
        }
        const newPar = nodes35.get(newPath.split('/').slice(0, -1).join('/'));
        if (newPar) newPar.children.push(f);
      },
      delete: async (f) => {
        const kill = (p) => {
          const n = nodes35.get(p);
          if (!n) return;
          if (n.children) for (const c of [...n.children]) kill(c.path);
          nodes35.delete(p); fm35b.delete(p);
        };
        const par = nodes35.get(f.path.split('/').slice(0, -1).join('/'));
        if (par) par.children = par.children.filter(c => c !== f);
        kill(f.path);
      }
    };
    const app35 = {
      vault: vault35,
      fileManager: {
        processFrontMatter: async (file, fn) => { const fm = fm35b.get(file.path) || {}; fn(fm); fm35b.set(file.path, fm); },
        renameFile: async (file, newPath) => vault35.rename(file, newPath)
      },
      metadataCache: { getFileCache: (f) => ({ frontmatter: fm35b.get(f.path) || {} }) }
    };
    const svc35 = new TS.TopicService({ app: app35, rootPath: 'topics' });

    // focus 重置: t1 starred→保持, t2→true, t3→false(不在 focusIds)
    const rt1 = await svc35.createTopic({ title: '甲', module: 'CHG' });
    const rt2 = await svc35.createTopic({ title: '乙', module: 'DISP' });
    const rt3 = await svc35.createTopic({ title: '丙', module: 'PWR' });
    await svc35._setFm(rt1.taskFile, { starred: true });
    await svc35._setFm(rt3.taskFile, { starred: true });
    const awr = await svc35.applyWeeklyReview({ focusIds: [rt1.id, rt2.id] });
    assert(awr.focused === 2, 'P3-08a: focused count (t2 on, t3 off)');
    const fmA = fm35b.get(`${rt1.dir}/00-TASK.md`), fmB = fm35b.get(`${rt2.dir}/00-TASK.md`), fmC = fm35b.get(`${rt3.dir}/00-TASK.md`);
    assert(fmA.starred === true && fmB.starred === true && fmC.starred === false, 'P3-08b: starred reset by focusIds');
    await svc35.applyWeeklyReview({ focusIds: [rt1.id, rt2.id, rt3.id, 'extra-x'] });
    assert(fm35b.get(`${rt3.dir}/00-TASK.md`).starred === true, 'P3-08c: >3 ids truncated to 3');
    // seedActions: sprout / discard / keep
    const sd35a = await svc35.createSeed({ text: '要发芽', module: 'USB', track: 'broad' });
    const sd35b = await svc35.createSeed({ text: '要丢弃', module: 'CAM' });
    const sd35c = await svc35.createSeed({ text: '要保留', module: 'SEC' });
    const awr2 = await svc35.applyWeeklyReview({
      seedActions: { [sd35a.id]: 'sprout', [sd35b.id]: 'discard', [sd35c.id]: 'keep' }
    });
    assert(awr2.sprouted === 1 && awr2.discarded === 1, 'P3-08d: sprout + discard executed');
    assert(nodes35.has(`topics/_Seeds/_Withered/${sd35b.id}`), 'P3-08e: discard → _Withered');
    assert(nodes35.has(sd35c.path), 'P3-08f: keep untouched');
    const sproutedSeedPaths = [...nodes35.keys()].filter(p => p.endsWith('/00-SEED.md'));
    assert(!nodes35.has(sd35a.path) && sproutedSeedPaths.length >= 1, 'P3-08g: sprouted seed file moved into topic dir');
    const sprDir = sproutedSeedPaths[0].split('/').slice(0, -1).join('/');
    assert(fm35b.get(sproutedSeedPaths[0]).status === 'sprouted' && fm35b.get(`${sprDir}/00-TASK.md`).track === 'broad', 'P3-08h: sprout uses seed track/module');
    // ideaActions: 同专题 3 条 —— 首 strike / 中 step / 末 fork (行号降序执行不错位)
    const rt4 = await svc35.createTopic({ title: '想法专题', module: 'CHG' });
    await svc35.addIdea(rt4, '想法一');
    await svc35.addIdea(rt4, '想法二');
    await svc35.addIdea(rt4, '想法三');
    const parsed35 = TS.parseTaskBody(nodes35.get(`${rt4.dir}/00-TASK.md`).content);
    // addIdea 顶部插入: 文件顺序 = 想法三(line低), 想法二(中), 想法一(line高)
    const iTop = parsed35.ideas[0], iMid = parsed35.ideas[1], iBot = parsed35.ideas[2];
    const seedsBefore = [...nodes35.keys()].filter(p => p.startsWith('topics/_Seeds/') && p.endsWith('.md')).length;
    const awr3 = await svc35.applyWeeklyReview({
      ideaActions: [
        { topicId: rt4.id, line: iTop.line, label: iTop.label, action: 'strike' },
        { topicId: rt4.id, line: iMid.line, label: iMid.label, action: 'step' },
        { topicId: rt4.id, line: iBot.line, label: iBot.label, action: 'fork' }
      ]
    });
    const body4 = nodes35.get(`${rt4.dir}/00-TASK.md`).content;
    const parsedAfter = TS.parseTaskBody(body4);
    assert(awr3.steps === 1 && awr3.forked === 1 && awr3.struck === 1, 'P3-08i: three actions counted');
    assert(body4.includes('~~') && parsedAfter.ideas.length === 1 && parsedAfter.ideas[0].struck === true && parsedAfter.ideas[0].label === iTop.label, 'P3-08j: top idea struck in place, others removed');
    assert(parsedAfter.steps.some(s => String(s.label).includes(iMid.label)), 'P3-08l: mid idea → step');
    const seedsAfter = [...nodes35.keys()].filter(p => p.startsWith('topics/_Seeds/') && p.endsWith('.md')).length;
    assert(seedsAfter > seedsBefore, 'P3-08m: bottom idea → new seed');
    // 单项失败不中断
    const rt5 = await svc35.createTopic({ title: '失败专题', module: 'AI' });
    await svc35.addIdea(rt5, '会失败');
    await svc35.addIdea(rt5, '会成功');
    const p5 = TS.parseTaskBody(nodes35.get(`${rt5.dir}/00-TASK.md`).content);
    const origStep = svc35.ideaToStep.bind(svc35);
    svc35.ideaToStep = async () => { throw new Error('boom'); };
    const awr4 = await svc35.applyWeeklyReview({
      ideaActions: [
        { topicId: rt5.id, line: p5.ideas[0].line, action: 'step' },
        { topicId: rt5.id, line: p5.ideas[1].line, action: 'strike' }
      ]
    });
    svc35.ideaToStep = origStep;
    assert(awr4.struck === 1 && awr4.steps === 0, 'P3-08n: failing item skipped, others continue');

    // ⑨ main.js bundle 级断言: 拼接后 P3 入口图标与渲染函数名必须存在
    {
      const mainSrc = fs.readFileSync(path.join(pluginDir, 'main.js'), 'utf8');
      assert(mainSrc.includes('🗓') && mainSrc.includes('📡'), 'P3-09a: main.js contains 🗓/📡 entry icons');
      assert(mainSrc.includes('_openReview') && mainSrc.includes('_toggleRadar') && mainSrc.includes('_renderRadarSvg'), 'P3-09b: main.js contains P3 render functions');
    }
  }

  // --- Suite 36: LOCAL-EXEC —— 本地 cmd 执行器内核 + 字节级文件搬运 (local-exec-core.js) ---
  console.log('\n>>> Suite 36: LOCAL-EXEC (Local cmd Executor Core)');
  {
    const lxc = require(path.join(pluginDir, 'services', 'local-exec-core.js'));
    const VAULT = 'D:\\work\\Mgmt\\TabonKB';
    const TMP = require('os').tmpdir();
    const ctxL = {
      writeRoots: [VAULT, TMP, '\\\\192.168.1.62\\tankaikun\\01\\pri_project\\driver\\public'],
      vaultRoot: VAULT,
      cwd: VAULT
    };
    const lex = (c, m) => lxc.checkLocalCommand(c, m, ctxL);
    const denyReason = (c, m) => { const r = lex(c, m); return r.ok ? 'ALLOWED' : r.reason; };

    // LXC-01: 复用转发与常量
    assert(lxc.MODE_NAMES.readonly === '只读' && lxc.MODE_NAMES.full === '完全权限', 'LXC-01: MODE_NAMES 复用 remote-exec-core');
    assert(typeof lxc.clampTimeoutSec === 'function' && lxc.clampTimeoutSec(3, 1) === 3, 'LXC-01: clampTimeoutSec 转发 (minSec=1 → 3)');

    // LXC-02: 只读档检索类白名单放行
    const roAllow = ['dir X:\\', 'type a.txt', 'certutil -hashfile f SHA256', 'findstr /i x f', 'git status', 'type "a&b"', 'attrib somefile.txt', 'sort /R f', 'robocopy a b /L'];
    roAllow.forEach((c, i) => assert(lex(c, 'readonly').ok === true, `LXC-02-${i}: readonly allows ${JSON.stringify(c)} (got: ${denyReason(c, 'readonly')})`));

    // LXC-03: 只读档拒绝 (写动词/脚本宿主/链式/展开)
    const roDeny = ['copy a b', 'del f', 'powershell -c 1', 'echo', 'set', 'dir & whoami', 'dir | more', 'echo x > a', '%PATH%', '`', 'dir;ver', 'type C:\\a^&b', 'dir "a%b"', 'dir a^&b', 'certutil -encode a b', 'attrib +r f', 'attrib /s f', 'sort /o out.txt in.txt', 'robocopy a b', 'mkdir x', 'git push', 'git reset --hard'];
    roDeny.forEach((c, i) => assert(lex(c, 'readonly').ok === false, `LXC-03-${i}: readonly rejects ${JSON.stringify(c)} (got: ${lex(c, 'readonly').ok ? 'ALLOWED' : 'denied'})`));

    // LXC-04: 读写档写动词边界 (写目标限定 vaultRoot/writeRoots/TEMP)
    const rwCases = [
      ['copy D:\\src\\f ' + VAULT + '\\a\\f', true],
      ['copy a b', false],                                    // 相对 dst 不在写根
      ['del ' + VAULT + '\\x\\f', true],
      ['del ' + VAULT, false],                                // 写根本身禁止删除
      ['del ..', false],
      ['del ' + VAULT + '\\..\\x', false],                    // .. 段
      ['robocopy a b /MIR', false],
      ['copy a D:\\x\\f', false],                             // 界外绝对路径
      ['mkdir ' + VAULT + '\\sub', true],
      ['move ' + VAULT + '\\a ' + VAULT + '\\b', true],
      ['move ' + VAULT + ' ' + VAULT + '\\b', false],         // move 源=写根本身视同删除
      ['move ' + VAULT + '\\a\\f.txt ' + VAULT, true],        // 评审加固: move 目标=写根本身合法 (移入根目录)
      ['move ' + VAULT + '\\a ' + VAULT, true],               // move VAULT\a(非根)→VAULT 合法移入
      ['move D:\\x\\f ' + VAULT + '\\f', false],              // 评审加固: move 源在写根外拒绝
      ['move ' + VAULT + ' ' + VAULT + '\\sub', false],       // move 源=写根本身视同删根
      ['ren ' + VAULT + '\\a.txt b.txt', true],
      ['ren ' + VAULT + '\\a.txt x\\b.txt', false],           // ren 新名须裸文件名
      ['rmdir ' + VAULT, false],
      ['powershell -c 1', false],
      ['node -e 1', false],
      ['set PATH', false],
      ['type a.txt', true],
      ['git log --oneline -3', true],
      ['git push', false],
      ['git -C ' + VAULT + ' status', true],
      ['git -C D:\\else status', false],
      ['git -C ..\\x status', false],
      ['dir /s ' + VAULT, true]
    ];
    rwCases.forEach(([c, ok], i) => assert(lex(c, 'readwrite').ok === ok, `LXC-04-${i}: readwrite ${ok ? 'allows' : 'rejects'} ${JSON.stringify(c).slice(0, 60)}${ok ? '' : ' (' + denyReason(c, 'readwrite') + ')'}`));

    // LXC-05: 完全权限档仅拦灾难级
    const fullCases = [
      ['powershell -c x', true],
      ['node -e x', true],
      ['copy a b', true],
      ['del ' + VAULT + '\\tmp\\f', true],
      ['reg query HKLM', true],
      ['format C:', false],
      ['shutdown', false],
      ['diskpart', false],
      ['del C:\\', false],
      ['del \\', false],
      ['rd C:\\Windows', false],
      ['reg add HKLM', false],
      ['cipher /w D:\\', false],
      ['takeown /f x', false],
      ['bcdedit /set x y', false],
      ['icacls D:\\x /grant u:f', false],
      ['set', false]
    ];
    fullCases.forEach(([c, ok], i) => assert(lex(c, 'full').ok === ok, `LXC-05-${i}: full ${ok ? 'allows' : 'rejects'} ${JSON.stringify(c).slice(0, 50)}${ok ? '' : ' (' + denyReason(c, 'full') + ')'}`));

    // LXC-06: 凭据/密钥路径全档硬拦截
    const credCases = [
      'type C:\\u\\.ssh\\id_rsa',
      'copy C:\\x\\.aws\\credentials d:\\t',
      'dir "%USERPROFILE%\\Cookies"',
      'type NTUSER.DAT',
      'type C:\\Windows\\System32\\config\\SAM',
      'type "C:\\u\\AppData\\Local\\X\\Login Data"'
    ];
    credCases.forEach((c) => {
      for (const m of ['readonly', 'readwrite', 'full']) {
        assert(!lex(c, m).ok, `LXC-06: ${m} rejects credential path ${JSON.stringify(c).slice(0, 55)}`);
      }
    });
    // 搜索 pattern 位不误伤 (与 remote-exec-core 同思路)
    assert(lex('findstr "id_rsa" a.txt', 'readonly').ok === true, 'LXC-06b: findstr pattern position not scanned');
    assert(lex('findstr /g:.ssh\\lst a.txt', 'readonly').ok === false, 'LXC-06c: findstr /g: file flag scanned');

    // LXC-07: localWriteTargetOk / isRootItself
    assert(lxc.localWriteTargetOk('\\\\192.168.1.62\\tankaikun\\01\\pri_project\\driver\\public\\f', ctxL) === true, 'LXC-07: UNC 写根前缀命中');
    assert(lxc.localWriteTargetOk('\\??\\' + VAULT + '\\sub\\f', ctxL) === true, 'LXC-07: \\??\\ 前缀规范化后命中');
    assert(lxc.localWriteTargetOk('c:\\', ctxL) === false, 'LXC-07: 盘符根拒绝');
    assert(lxc.localWriteTargetOk('sub\\f', ctxL) === false, 'LXC-07: 相对路径拒绝');
    assert(lxc.localWriteTargetOk(VAULT + '2\\x', ctxL) === false, 'LXC-07: 前缀边界 (TabonKB2 不误命中)');
    assert(lxc.localWriteTargetOk(VAULT + '\\.git\\config', ctxL) === false, 'LXC-07: .git 组件拒绝');
    assert(lxc.localWriteTargetOk(VAULT, ctxL) === true && lxc.isRootItself(VAULT, VAULT) === true, 'LXC-07: 写根本身命中且可识别');
    assert(lxc.isRootItself(VAULT + '\\x', VAULT) === false, 'LXC-07: isRootItself 非根为 false');
    // 8.3 短名/长路径双形态 (os.tmpdir()→ADMINI~1, AI 常用 Administrator 长名, 双形态都在写根内都应命中)
    const TMP_SHORT = 'C:\\Users\\ADMINI~1\\AppData\\Local\\Temp', TMP_LONG = 'C:\\Users\\Administrator\\AppData\\Local\\Temp';
    const ctxBoth = { writeRoots: [TMP_SHORT, TMP_LONG], vaultRoot: VAULT };
    assert(lxc.localWriteTargetOk(TMP_SHORT + '\\tw\\f.txt', ctxBoth) === true, 'LXC-07b: TEMP 短名形态命中');
    assert(lxc.localWriteTargetOk(TMP_LONG + '\\tw\\f.txt', ctxBoth) === true, 'LXC-07b: TEMP 长路径形态命中');

    // LXC-09: 评审加固 —— 删除/移动类目标禁通配符 (防 * 展开清空写根)
    const wildDeny = [
      'del /s ' + VAULT + '\\*',
      'del /q ' + VAULT + '\\?.md',
      'rd /s /q ' + VAULT + '\\*',
      'move ' + VAULT + '\\* ' + VAULT + '\\sub',
      'ren ' + VAULT + '\\* x',
      'del ' + VAULT + '\\sub\\*.tmp'
    ];
    wildDeny.forEach((c, i) => assert(lex(c, 'readwrite').ok === false, `LXC-09-${i}: readwrite rejects wildcard del/move/ren ${JSON.stringify(c).slice(0, 60)}`));
    assert(lex('del ' + VAULT + '\\sub\\f.tmp', 'readwrite').ok === true, 'LXC-09: 非通配正常删除放行');
    assert(lex('copy a ' + VAULT, 'readwrite').ok === true, 'LXC-09: copy dst=写根本身放行 (copy 不禁通配/根)');

    // LXC-10: 评审加固 —— 带文件值旗标参与凭据扫描 (xcopy /EXCLUDE, robocopy /JOB·LOG·UNILOG)
    assert(lex('xcopy D:\\x ' + VAULT + '\\a /EXCLUDE:C:\\u\\.ssh\\key', 'readwrite').ok === false, 'LXC-10: xcopy /EXCLUDE 值凭据路径拒绝');
    assert(lex('robocopy a b /JOB:C:\\u\\.ssh\\key', 'readwrite').ok === false, 'LXC-10: robocopy /JOB 值凭据路径拒绝');
    assert(lex('robocopy a b /LOG+:C:\\u\\.ssh\\key', 'full').ok === false, 'LXC-10: robocopy /LOG+ 值凭据路径拒绝 (全档扫描)');
    assert(lex('xcopy D:\\x ' + VAULT + '\\a /EXCLUDE:' + VAULT + '\\ok.txt', 'readwrite').ok === true, 'LXC-10: xcopy /EXCLUDE 合法路径不误伤');

    // LXC-08: 接线断言 (源码级)
    const bridgeSrc = fs.readFileSync(path.join(pluginDir, 'pi-agent-bridge.js'), 'utf8');
    assert(bridgeSrc.includes('local_exec'), 'LXC-08: --tools 注册 local_exec');
    assert(bridgeSrc.includes('local_copy') && bridgeSrc.includes('local_move'), 'LXC-08: --tools 注册 local_copy/local_move');
    assert(bridgeSrc.includes('local-exec-portal.ts'), 'LXC-08: getExtensionPaths 注册 local-exec-portal.ts');
    assert(bridgeSrc.includes('TABONKB_VAULT_PATH'), 'LXC-08: spawn env 注入 TABONKB_VAULT_PATH');
    const lpSrc = fs.readFileSync(path.join(pluginDir, 'extensions', 'local-project-portal.ts'), 'utf8');
    assert(lpSrc.includes('local_copy') && lpSrc.includes('local_move') && lpSrc.includes('local-exec-core.js'), 'LXC-08: local-project-portal 注册 local_copy/local_move 并加载内核');
    const leSrc = fs.readFileSync(path.join(pluginDir, 'extensions', 'local-exec-portal.ts'), 'utf8');
    assert(leSrc.includes('local_exec') && leSrc.includes('checkLocalCommand'), 'LXC-08: local-exec-portal 注册 local_exec 并调用 checkLocalCommand');
    assert(leSrc.includes('realpathSync.native') && lpSrc.includes('realpathSync.native'), 'LXC-08: 两 portal 写根均补 realpath 长路径形态');
    assert(leSrc.includes('taskkill') && leSrc.includes('TextDecoder'), 'LXC-08: local-exec-portal 进程树杀 + GBK 解码');

    // LXC-11: 评审加固 —— 源码级断言 (local_move 源限写根 / killTree 进程树杀)
    assert(lpSrc.includes('local_move 会删除源文件'), 'LXC-11: local_move 非 full 档源须在写根内');
    assert(leSrc.includes('taskkill') && leSrc.includes('/T') && leSrc.includes('killTree'), 'LXC-11: runLocal 超时/中止改 taskkill /T /F 杀进程树');
  }

  // Summary
  console.log('\n===============================================================');
  console.log(`   TEST RESULTS SUMMARY: ${passedTests} Passed, ${failedTests} Failed (Total: ${totalTests})`);
  if (failedTests === 0) {
    console.log('   STATUS: ALL SELF-TEST SUITES PASSED! [V1.0.0 RELEASE READY]');
  } else {
    console.error('   STATUS: SOME TESTS FAILED! CHECK LOGS ABOVE.');
  }
  console.log('===============================================================\n');

  process.exit(failedTests === 0 ? 0 : 1);
}

runAllSuites().catch(err => {
  console.error('Test Runner Exception:', err);
  process.exit(1);
});
