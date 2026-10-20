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
  assert(manifest.version === '1.7.0', 'manifest.json has version 1.7.0');
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
  assert(mcpEntries.length === 8, `DSH-MCP-01: buildDshMcpEntries() output 8 items (got: ${mcpEntries.length})`);
  assert(mcpEntries.some(e => e.config && e.config.serverName === 'dslogic'),
    'DSH-MCP-01: dslogic entry registered');

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
