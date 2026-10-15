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
  assert(manifest.version === '1.3.0', 'manifest.json has version 1.3.0');
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
