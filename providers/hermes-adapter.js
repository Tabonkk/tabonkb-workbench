const { AgentAdapter, getAgentBrandSvg } = require('./agent-adapter-base.js');
const { buildVendorEnv, ensureHermesVendorMcp, VENDOR_MCP_TOOL_HINT } = require('../mcp/vendor-mcp-shared.js');
const { buildWeknoraEnv, ensureHermesWeknoraMcp, WEKNORA_MCP_TOOL_HINT } = require('../mcp/weknora-mcp-shared.js');
const { buildOpengrokEnv, ensureHermesOpengrokMcp, OPENGROK_MCP_TOOL_HINT } = require('../mcp/opengrok-mcp-shared.js');
const { buildGerritEnv, ensureHermesGerritMcp, GERRIT_MCP_TOOL_HINT } = require('../mcp/gerrit-mcp-shared.js');
const { ensureHermesCodegraphMcp, CODEGRAPH_MCP_TOOL_HINT } = require('../mcp/codegraph-mcp-shared.js');
const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

class HermesAdapter extends AgentAdapter {
  constructor(options = {}) {
    super({
      id: 'hermes',
      name: 'hermes',
      displayName: 'Hermes CLI',
      icon: getAgentBrandSvg('hermes', 16),
      vaultBasePath: options.vaultBasePath || '',
      permissionMode: options.permissionMode || 'readonly'
    });
    this.process = null;
    this.stdoutBuffer = '';
    this.currentToolCallId = null;
    this.currentToolName = null;
    this.currentToolStartTime = null;
  }

  resolveBinary() {
    const candidates = [];
    if (process.env.HERMES_CLI_PATH) candidates.push(process.env.HERMES_CLI_PATH);
    const nodeDir = process.env.APPDATA ? path.join(process.env.APPDATA, 'node-v24.15.0') : '';
    candidates.push('C:\\Users\\Administrator\\AppData\\Local\\hermes\\bin\\hermes.exe');
    if (nodeDir) candidates.push(path.join(nodeDir, 'hermes.cmd'), path.join(nodeDir, 'hermes.exe'));
    candidates.push('hermes');
    const found = candidates.find((candidate) => candidate === 'hermes' || fs.existsSync(candidate));
    return { cmd: found || 'hermes', prefixArgs: [] };
  }

  hermesHome() {
    return process.env.HERMES_HOME || path.join(process.env.LOCALAPPDATA || 'C:\\Users\\Administrator\\AppData\\Local', 'hermes');
  }

  loadModelCatalog() {
    try {
      const cachePath = path.join(this.hermesHome(), 'provider_models_cache.json');
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      const out = {};
      for (const prov of Object.keys(data || {})) {
        const entry = data[prov] || {};
        const list = Array.isArray(entry) ? entry : (entry && Array.isArray(entry.models) ? entry.models : []);
        const ids = list.map((m) => String(m)).filter(Boolean);
        if (ids.length) out[prov] = ids;
      }
      return out;
    } catch (error) {
      return {};
    }
  }

  readDefaultModel() {
    try {
      const txt = fs.readFileSync(path.join(this.hermesHome(), 'config.yaml'), 'utf8');
      const def = txt.match(/^\s{2}default:\s*(\S+)\s*$/m);
      const prov = txt.match(/^\s{2}provider:\s*(\S+)\s*$/m);
      return { id: def ? def[1] : '', provider: prov ? prov[1] : '' };
    } catch (error) {
      return { id: '', provider: '' };
    }
  }

  getModelGroups() {
    const catalog = this.loadModelCatalog();
    const providers = Object.keys(catalog);
    if (providers.length === 0) return [];
    const def = this.readDefaultModel();
    const activeProvider = (this.selectedModel && this.selectedModel.provider) || def.provider;
    const topProvider = catalog[activeProvider] ? activeProvider : providers[0];
    const groups = [{
      group: `${topProvider} · 当前提供商`,
      isTop: true,
      iconPark: 'star',
      models: catalog[topProvider].map((id) => ({ id, name: id, desc: topProvider }))
    }];
    for (const prov of providers) {
      if (prov === topProvider) continue;
      groups.push({
        group: prov,
        iconPark: 'cloud',
        models: catalog[prov].map((id) => ({ id, name: id, desc: prov }))
      });
    }
    return groups;
  }

  getModel() {
    if (this.selectedModel) return { id: this.selectedModel.id, name: this.selectedModel.name || this.selectedModel.id };
    const def = this.readDefaultModel();
    return { id: def.id || 'default', name: def.id || '默认模型' };
  }

  setModel(modelId, displayName) {
    const catalog = this.loadModelCatalog();
    let provider = this.readDefaultModel().provider;
    for (const prov of Object.keys(catalog)) {
      if (catalog[prov].indexOf(modelId) >= 0) {
        provider = prov;
        break;
      }
    }
    this.selectedModel = { id: modelId, name: displayName || modelId, provider };
  }

  async detect() {
    return new Promise((resolve) => {
      const bin = this.resolveBinary();
      let output = '';
      let proc;
      try {
        proc = child_process.spawn(bin.cmd, [...bin.prefixArgs, '--version'], {
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true
        });
      } catch (error) {
        this.setStatus('not_installed', 'Hermes CLI not found');
        resolve({ available: false, error: error.message });
        return;
      }
      proc.stdout.on('data', (data) => { output += data.toString(); });
      proc.on('error', (error) => {
        this.setStatus('not_installed', 'Hermes CLI not found');
        resolve({ available: false, error: error.message });
      });
      proc.on('close', (code) => {
        if (code === 0) {
          this.setStatus('connected', 'Hermes CLI connected');
          resolve({ available: true, version: output.trim() });
        } else {
          this.setStatus('not_installed', 'Hermes CLI not found');
          resolve({ available: false, error: `Hermes exited with code ${code}` });
        }
      });
    });
  }

  async start() {
    const result = await this.detect();
    if (result.available) {
      this.setStatus('connected', 'Hermes CLI connected');
      await this.ensureVendorMcp();
      await this.ensureWeknoraMcp();
      await this.ensureOpengrokMcp();
      await this.ensureCodegraphMcp();
    }
    return result.available;
  }

  /**
   * 幂等注册芯片检索 MCP server (tabonkb-vendor)
   */
  async ensureVendorMcp() {
    if (this._vendorMcpEnsured) return;
    this._vendorMcpEnsured = true;
    try {
      const bin = this.resolveBinary();
      const res = await ensureHermesVendorMcp(bin.cmd, bin.prefixArgs, this.vaultBasePath);
      if (!res.ok) console.warn('[Hermes] vendor MCP 注册失败:', res.error || res.output);
    } catch (e) {
      console.warn('[Hermes] vendor MCP 注册异常:', e.message);
    }
  }

  /**
   * 幂等注册团队知识库 MCP server (tabonkb-weknora)
   */
  async ensureWeknoraMcp() {
    if (this._weknoraMcpEnsured) return;
    this._weknoraMcpEnsured = true;
    try {
      const bin = this.resolveBinary();
      const res = await ensureHermesWeknoraMcp(bin.cmd, bin.prefixArgs, this.vaultBasePath);
      if (!res.ok) console.warn('[Hermes] weknora MCP 注册失败:', res.error || res.output);
    } catch (e) {
      console.warn('[Hermes] weknora MCP 注册异常:', e.message);
    }
  }

  /**
   * 幂等注册 OpenGrok 代码检索 MCP server (tabonkb-opengrok)
   */
  async ensureOpengrokMcp() {
    if (this._opengrokMcpEnsured) return;
    this._opengrokMcpEnsured = true;
    try {
      const bin = this.resolveBinary();
      const res = await ensureHermesOpengrokMcp(bin.cmd, bin.prefixArgs, this.vaultBasePath);
      if (!res.ok) console.warn('[Hermes] opengrok MCP 注册失败:', res.error || res.output);
    } catch (e) {
      console.warn('[Hermes] opengrok MCP 注册异常:', e.message);
    }
  }

  /**
   * 幂等注册 Gerrit 代码评审 MCP server (tabonkb-gerrit)
   */
  async ensureGerritMcp() {
    if (this._gerritMcpEnsured) return;
    this._gerritMcpEnsured = true;
    try {
      const bin = this.resolveBinary();
      const res = await ensureHermesGerritMcp(bin.cmd, bin.prefixArgs, this.vaultBasePath);
      if (!res.ok) console.warn('[Hermes] gerrit MCP 注册失败:', res.error || res.output);
    } catch (e) {
      console.warn('[Hermes] gerrit MCP 注册异常:', e.message);
    }
  }

  /**
   * 幂等注册 62 上的 CodeGraph（内核 + 项目私有驱动）
   */
  async ensureCodegraphMcp() {
    if (this._codegraphMcpEnsured) return;
    this._codegraphMcpEnsured = true;
    try {
      const bin = this.resolveBinary();
      const res = await ensureHermesCodegraphMcp(bin.cmd, bin.prefixArgs);
      if (!res.ok) console.warn('[Hermes] codegraph MCP 注册失败:', JSON.stringify(res.results || []).slice(-500));
    } catch (e) {
      console.warn('[Hermes] codegraph MCP 注册异常:', e.message);
    }
  }

  async stop() {
    await this.abort();
    this.setStatus('disconnected', 'Stopped');
  }

  /**
   * Send prompt to Hermes CLI using stream-json mode, with full tool-calling & streaming events
   */
  async send(text, contextPayload) {
    if (this.isStreaming) return { success: false, error: 'Another Hermes request is still running' };
    await this.ensureVendorMcp();
    await this.ensureWeknoraMcp();
    await this.ensureOpengrokMcp();
    await this.ensureGerritMcp();
    await this.ensureCodegraphMcp();

    this.isStreaming = true;
    this.stdoutBuffer = '';
    this.currentToolCallId = null;
    this.currentToolName = null;
    this.currentToolStartTime = null;

    this.setStatus('thinking', 'Hermes is thinking');
    this.emit('turn_start');

    const prompt = (contextPayload ? `${text}\n\n${JSON.stringify(contextPayload)}` : text) + VENDOR_MCP_TOOL_HINT + WEKNORA_MCP_TOOL_HINT + OPENGROK_MCP_TOOL_HINT + GERRIT_MCP_TOOL_HINT + CODEGRAPH_MCP_TOOL_HINT;
    const bin = this.resolveBinary();
    const modelId = (this.selectedModel && this.selectedModel.id) || this.readDefaultModel().id;
    const modelArgs = modelId && modelId !== 'default' ? ['-m', modelId] : [];

    // Use stream-json mode with --query-file - via stdin pipe for robust UTF-8 handling
    const spawnArgs = [
      ...bin.prefixArgs,
      'chat',
      '--query-file', '-',
      '--format', 'stream-json',
      '--yolo',
      '--accept-hooks',
      ...modelArgs
    ];

    return new Promise((resolve) => {
      try {
        this.process = child_process.spawn(bin.cmd, spawnArgs, {
          cwd: this.vaultBasePath || process.cwd(),
          env: Object.assign({}, process.env, buildVendorEnv(this.vaultBasePath), buildWeknoraEnv(this.vaultBasePath), buildOpengrokEnv(this.vaultBasePath), buildGerritEnv(this.vaultBasePath)),
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true
        });

        this.process.stdout.setEncoding('utf8');
        this.process.stderr.setEncoding('utf8');

        this.process.stdout.on('data', (chunk) => this.handleStdout(chunk));
        this.process.stderr.on('data', (chunk) => {
          const message = chunk.toString().trim();
          if (/fatal|error/i.test(message) && !this.isStreaming) {
            this.emit('error', { error: message });
          }
        });

        this.process.on('error', (error) => this.finish(false, error.message, resolve));
        this.process.on('close', (code) => {
          this.finish(code === 0, code === 0 ? '' : `Hermes exited with code ${code}`, resolve);
        });

        // Write prompt through stdin in UTF-8
        this.process.stdin.write(prompt, 'utf8');
        this.process.stdin.end();
      } catch (error) {
        this.finish(false, error.message, resolve);
      }
    });
  }

  finish(success, error, resolve) {
    if (this.stdoutBuffer) {
      this.handleStdoutLine(this.stdoutBuffer);
      this.stdoutBuffer = '';
    }
    if (this.currentToolCallId) {
      this.emit('tool_end', {
        toolCallId: this.currentToolCallId,
        toolName: this.currentToolName || 'tool',
        durationMs: Date.now() - (this.currentToolStartTime || Date.now()),
        isError: !success
      });
      this.currentToolCallId = null;
    }
    this.isStreaming = false;
    this.process = null;
    this.emit('turn_end');
    this.emit('agent_settled');
    this.setStatus(success ? 'connected' : 'error', error || 'Hermes CLI connected');
    resolve({ success, ...(error ? { error } : {}) });
  }

  handleStdout(chunk) {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split(/\r?\n/);
    this.stdoutBuffer = lines.pop() || '';

    for (const line of lines) {
      this.handleStdoutLine(line);
    }
  }

  handleStdoutLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const event = JSON.parse(trimmed);
      this.handleHermesEvent(event);
    } catch (_) {
      // Non-JSON fallback: if plain text output
      if (!trimmed.startsWith('{') && !trimmed.startsWith('session_id:')) {
        this.emit('text_delta', trimmed + '\n');
      }
    }
  }

  /**
   * Handle Hermes stream-json event and emit tool / delta events to AgentHub
   */
  handleHermesEvent(event) {
    if (!event || typeof event !== 'object') return;

    // 1. Tool execution started
    if (event.type === 'tool_use') {
      const rawName = event.name || '';
      const toolName = rawName.replace(/^mcp__tabonkb_vendor__/, '').replace(/^mcp__tabonkb_weknora__/, '').replace(/^mcp__tabonkb_opengrok__/, '').replace(/^mcp__tabonkb_gerrit__/, '').replace(/^mcp__codegraph_kernel__/, '').replace(/^mcp__codegraph_driver__/, '');
      const toolCallId = `hermes_${toolName}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      this.currentToolCallId = toolCallId;
      this.currentToolName = toolName;
      this.currentToolStartTime = Date.now();

      let actionDesc = `正在执行: ${toolName}`;
      if (toolName === 'vendor_portal_search') {
        const q = event.input?.query || '';
        const v = event.input?.vendor && event.input.vendor !== 'all' ? ` (${event.input.vendor})` : '';
        actionDesc = `正在检索芯片原厂资料${v}: "${q}"`;
      } else if (toolName === 'vendor_portal_get_detail') {
        const docId = event.input?.docId || '';
        actionDesc = `正在调取原厂技术方案: ${docId}`;
      } else if (toolName === 'tool_search') {
        actionDesc = '正在检索原厂工具定义...';
      } else if (toolName === 'tool_describe') {
        actionDesc = '正在解析原厂接口规范...';
      } else if (toolName === 'weknora_search') {
        actionDesc = `正在检索团队知识库: "${event.input?.query || ''}"`;
      } else if (toolName === 'weknora_ask') {
        actionDesc = `正在向知识库提问: "${event.input?.query || ''}"`;
      } else if (toolName === 'weknora_list_knowledge_bases') {
        actionDesc = '正在列出知识库...';
      } else if (toolName === 'weknora_list_documents') {
        actionDesc = '正在查看知识库文档清单...';
      } else if (toolName === 'weknora_read_document') {
        actionDesc = `正在读取知识文档: ${event.input?.knowledge_id || ''}`;
      } else if (toolName === 'weknora_add_document') {
        actionDesc = `正在写入知识库: ${event.input?.title || ''}`;
      } else if (toolName === 'weknora_update_document') {
        actionDesc = `正在更新知识文档: ${event.input?.knowledge_id || ''}`;
      } else if (toolName === 'weknora_delete_document') {
        actionDesc = `正在删除知识文档: ${event.input?.knowledge_id || ''}`;
      } else if (toolName === 'opengrok_search_code') {
        const q = event.input?.query || '';
        const p = event.input?.project ? ` [${event.input.project}]` : '';
        actionDesc = `正在检索 OpenGrok 代码${p}: "${q}"`;
      } else if (toolName === 'opengrok_read_file') {
        const f = event.input?.file_path ? path.basename(event.input.file_path) : '';
        actionDesc = `正在阅读 OpenGrok 源码: ${f || event.input?.file_path || ''}`;
      } else if (toolName === 'opengrok_list_projects') {
        actionDesc = '正在获取 OpenGrok 代码工程清单...';
      } else if (toolName === 'gerrit_search_changes') {
        const q = event.input?.query || (event.input?.project ? `工程: ${event.input.project}` : '');
        actionDesc = `正在检索 Gerrit 代码评审${q ? `: "${q}"` : ''}`;
      } else if (toolName === 'gerrit_get_change') {
        actionDesc = `正在查阅 Gerrit 评审详情: #${event.input?.change_id || ''}`;
      } else if (toolName === 'gerrit_get_diff') {
        const f = event.input?.file_path ? ` (${path.basename(event.input.file_path)})` : '';
        actionDesc = `正在查阅 Gerrit 代码变更 Diff: #${event.input?.change_id || ''}${f}`;
      } else if (toolName === 'gerrit_get_comments') {
        actionDesc = `正在查阅 Gerrit 行内评审意见: #${event.input?.change_id || ''}`;
      } else if (toolName === 'gerrit_list_projects') {
        actionDesc = '正在获取 Gerrit 代码工程仓库清单...';
      } else if (toolName === 'codegraph_explore') {
        const tree = /kernel/.test(rawName) ? '内核' : (/driver/.test(rawName) ? '私有驱动' : '');
        const q = event.input?.query || '';
        actionDesc = `正在查询 CodeGraph${tree ? ' ' + tree : ''}${q ? `: "${q}"` : ''}`;
      }

      this.setStatus('running_tool', actionDesc);
      this.emit('tool_start', {
        toolCallId,
        toolName,
        args: event.input,
        startTime: this.currentToolStartTime,
        actionDesc
      });
      return;
    }

    // 2. Tool execution ended
    if (event.type === 'tool_result') {
      const toolCallId = this.currentToolCallId || `hermes_tool_${Date.now()}`;
      const rawName = event.name || '';
      const toolName = rawName.replace(/^mcp__tabonkb_vendor__/, '').replace(/^mcp__tabonkb_weknora__/, '').replace(/^mcp__tabonkb_opengrok__/, '').replace(/^mcp__tabonkb_gerrit__/, '').replace(/^mcp__codegraph_kernel__/, '').replace(/^mcp__codegraph_driver__/, '') || this.currentToolName || 'tool';
      const durationMs = event.duration_ms || (Date.now() - (this.currentToolStartTime || Date.now()));

      this.emit('tool_end', {
        toolCallId,
        toolName,
        durationMs,
        isError: !!event.is_error,
        output: typeof event.output === 'string' ? event.output : JSON.stringify(event.output || '')
      });
      this.currentToolCallId = null;
      this.currentToolName = null;
      this.setStatus('thinking', 'Hermes is thinking');
      return;
    }

    // 3. Streaming text token
    if (event.type === 'text' && typeof event.text === 'string') {
      this.emit('text_delta', event.text);
      return;
    }

    // 4. Session init
    if (event.type === 'system' && event.subtype === 'init') {
      // session ready
      return;
    }
  }

  async abort() {
    if (this.process && !this.process.killed) {
      try { this.process.kill(); } catch (_) {}
    }
    this.process = null;
    this.isStreaming = false;
    this.currentToolCallId = null;
    this.setStatus('connected', 'Aborted');
    this.emit('agent_settled');
  }

  async newSession() {
    await this.abort();
    this.setStatus('connected', 'New session');
  }
}

module.exports = { HermesAdapter };