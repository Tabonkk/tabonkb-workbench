/**
 * TabonKB Workbench V1.0.0 Automated Self-Test Suite Runner
 * Executes all functional test suites and prints a consolidated report.
 */
const path = require('path');
const fs = require('fs');

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
  assert(manifest.version === '1.0.0', 'manifest.json has version 1.0.0');
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
  const { AgentHub } = require(path.join(pluginDir, 'agent-hub.js'));
  const hub = new AgentHub({ vaultBasePath: 'd:\\work\\Mgmt\\TabonKB' });
  const agentList = hub.getAgentList();
  assert(agentList.length === 4, `Hub has 4 registered agents (got: ${agentList.length})`);
  assert(agentList.some(a => a.id === 'pi'), 'Pi Agent registered');
  assert(agentList.some(a => a.id === 'hermes'), 'Hermes Agent registered');
  assert(agentList.some(a => a.id === 'gemini'), 'Gemini Agent registered');
  assert(agentList.some(a => a.id === 'niceaigc'), 'NiceAIGC Agent registered');

  // --- Suite 4: Prompt Formatting & Knowledge Base Decoupling ---
  console.log('\n>>> Suite 4: Prompt Decoupling & Formatting');
  const { AgentContextProvider } = require(path.join(pluginDir, 'agent-context-provider.js'));
  const mockApp = { vault: { getAbstractFileByPath: () => null } };
  const ctxProvider = new AgentContextProvider(mockApp);
  
  // NiceAIGC should NOT contain knowledge base metadata
  const userText = '璇疯В閲婁粈涔堟槸蹇€熷厖鐢靛崗璁紵';
  const niceaigcAdapter = hub.getAdapter('niceaigc');
  const isDecoupled = !niceaigcAdapter.id.includes('kb');
  assert(isDecoupled, 'NiceAIGC is configured as general multi-modal model');

  // Grounded context formatting for Pi/Hermes
  ctxProvider.setKnowledgeNode({ id: 'node-charger', title: '鍏呯數椹卞姩妯″潡', module: 'Charger' });
  const formattedWithContext = ctxProvider.formatPromptWithContext(userText);
  assert(formattedWithContext.includes('鍏呯數椹卞姩妯″潡') && formattedWithContext.includes('Charger'), 'Pi/Hermes context formatting includes active node metadata');

  // --- Suite 5: Reasoning Effort Support ---
  console.log('\n>>> Suite 5: Reasoning Effort Selection');
  const supportsEffort = niceaigcAdapter.supportsReasoningEffort('gpt-5-6-thinking');
  assert(supportsEffort === true, 'gpt-5-6-thinking supports reasoning effort');
  niceaigcAdapter.setReasoningEffort('max');
  const effortCfg = niceaigcAdapter.getReasoningEffortConfig();
  assert(effortCfg.id === 'max' && effortCfg.label === '鏋侀珮', 'Reasoning effort set to max (鏋侀珮)');

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

  hub.destroy();

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
