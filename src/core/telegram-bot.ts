/**
 * 🤖 NOVA Telegram Bot Gateway Service
 * Bridges Nova's autonomous agent engine with a secure Telegram bot interface.
 * 
 * Features:
 *  1. Strict UserID Whitelisting (Authentication & Security)
 *  2. Throttled Real-Time Status Streaming (Message Editing Engine)
 *  3. Dynamic Inline Confirmations (Interactive Prompts & Command Approvals)
 *  4. High-Contrast macOS Terminal Log Emulation
 *  5. Read-Only / Full Agent Sandbox Toggle
 */

import { Telegraf, Markup } from 'telegraf';
import type { Engine } from './engine.js';
import { logger } from '../utils/logger.js';
import chalk from 'chalk';
import { resolve } from 'node:path';

export class TelegramBotService {
  private bot: Telegraf;
  private engine: Engine;
  private authorizedUsers: Set<number>;
  private activeConfirmations = new Map<string, (approved: boolean) => void>();
  private isReadOnly = false;
  // Store IDs of bot messages to allow bulk deletion via /clear
  private botMessageIds: number[] = [];
  private browserSession: {
    browser: any;
    page: any;
    url: string;
    lastMessageId?: number;
  } | null = null;
  private pendingBrowserAction: 'click' | 'type' | 'navigate' | null = null;
  private explorerCurrentPath: string = process.cwd();
  private explorerPathCache = new Map<string, string>();
  private explorerCacheCounter = 0;
  private pendingExplorerAction: {
    action: 'create_file' | 'create_folder' | 'edit_file';
    filepath?: string;
  } | null = null;
  private explorerLastMessageId?: number;

  constructor(token: string, authorizedUsers: number[], engine: Engine) {
    this.bot = new Telegraf(token, {
      handlerTimeout: 3_600_000 // 1 hour timeout for long running local AI generation loops
    });
    this.authorizedUsers = new Set(authorizedUsers);
    this.engine = engine;

    this.setupHandlers();
  }

  private setupHandlers() {
    // ─── Intercept API Calls to Track Bot Messages ────────────────────
    const originalCallApi = this.bot.telegram.callApi.bind(this.bot.telegram);
    (this.bot.telegram as any).callApi = async (method: any, data: any, ...args: any[]) => {
      const result = await originalCallApi(method, data, ...args);
      if (
        ['sendMessage', 'sendPhoto', 'sendDocument', 'sendAudio', 'sendVideo', 'sendAnimation', 'sendVoice'].includes(method)
      ) {
        if (result && typeof result === 'object' && 'message_id' in result) {
          this.botMessageIds.push((result as any).message_id);
        }
      }
      return result;
    };

    // ─── Global Error Catch Handler ──────────────────────────────────
    this.bot.catch((err: any, ctx) => {
      logger.error(`Telegraf error: ${err.message}`, err);
      ctx.reply(`❌ **An unexpected error occurred:** ${err.message}`).catch(() => {});
    });

    // ─── Authentication Middleware ─────────────────────────────────────
    this.bot.use(async (ctx, next) => {
      const userId = ctx.from?.id;
      if (!userId || !this.authorizedUsers.has(userId)) {
        logger.warn(`⚠️ Unauthorized Telegram access attempt from User ID: ${userId}`);
        if (ctx.chat) {
          try {
            await ctx.reply(
              `⚠️ **Unauthorized Access Blocked.**\n\n` +
              `Your Telegram User ID is: \`${userId}\`.\n` +
              `To enable this integration, add this ID to your whitelisted authorized users.`,
              { parse_mode: 'Markdown' }
            );
          } catch {}
        }
        return;
      }
      return next();
    });

    // ─── Command: /start ───────────────────────────────────────────────
    this.bot.start(async (ctx) => {
      await ctx.reply(
        `🤖 **Welcome to Nova Agent Telegram Gateway!**\n\n` +
        `Authentication successful. You are authorized to control Nova.\n\n` +
        `*Available Commands:*\n` +
        `• Send any direct prompt to launch a coding or workspace task.\n` +
        `• \`/goal [objective]\` — Start or view active goal dashboard.\n` +
        `• \`/readonly\` — Toggle Read-Only safe execution mode (current: ${this.isReadOnly ? 'ON 🔒' : 'OFF 🔓'}).\n` +
        `• \`/status\` — View engine parameters and statistics.\n` +
        `• \`/model\` — View or switch the active Ollama model.\n` +
        `• \`/browse <url>\` — Start interactive remote browser session.\n` +
        `• \`/files\` — Launch visual interactive file explorer.\n` +
        `• \`/clear\` — Delete all previous bot messages from the chat.\n` +
        `• \`/cancel\` — Instantly terminate any running agent loop.`,
        { parse_mode: 'Markdown' }
      );
    });

    // ─── Command: /clear ───────────────────────────────────────────────
    this.bot.command('clear', async (ctx) => {
      const chatId = ctx.chat?.id;
      if (!chatId) return;

      const statusMsg = await ctx.reply('🧹 **Clearing bot messages...**');
      
      let deletedCount = 0;
      const idsToDelete = [...this.botMessageIds];
      this.botMessageIds = []; // Reset immediately
      
      for (const msgId of idsToDelete) {
        try {
          await ctx.telegram.deleteMessage(chatId, msgId);
          deletedCount++;
        } catch {
          // Message might have already been deleted or too old
        }
      }

      try {
        await ctx.telegram.deleteMessage(chatId, statusMsg.message_id);
      } catch {}

      const confirmation = await ctx.reply(`🧹 **Cleared ${deletedCount} bot messages.**`);
      setTimeout(() => {
        ctx.telegram.deleteMessage(chatId, confirmation.message_id).catch(() => {});
      }, 3000);
    });

    // ─── Command: /files ───────────────────────────────────────────────
    this.bot.command('files', async (ctx) => {
      await this.sendVisualExplorer(ctx);
    });

    // ─── Command: /readonly ────────────────────────────────────────────
    this.bot.command('readonly', async (ctx) => {
      this.isReadOnly = !this.isReadOnly;
      await ctx.reply(
        this.isReadOnly 
          ? `🔒 **Read-Only Mode Enabled.** Nova is strictly sandboxed from modifying files or executing CLI commands.`
          : `🔓 **Full Agent Mode Enabled.** Nova can run commands and edit workspace files (confirmations still required).`
      );
    });

    // ─── Command: /status ──────────────────────────────────────────────
    this.bot.command('status', async (ctx) => {
      const stats = this.engine.getStats();
      const activeCwd = process.cwd();
      const activeModel = this.engine.getModel();
      await ctx.reply(
        `📊 **Nova System Telemetry:**\n\n` +
        `• **Active Model:** \`${activeModel}\`\n` +
        `• **Session Requests:** ${stats.totalRequests}\n` +
        `• **Tool Calls Triggered:** ${stats.totalToolCalls}\n` +
        `• **Active CWD:** \`${activeCwd}\`\n` +
        `• **Safe Mode:** ${this.isReadOnly ? 'ON 🔒' : 'OFF 🔓'}\n` +
        `• **Uptime:** ${Math.round((Date.now() - stats.sessionStart) / 1000)} seconds`,
        { parse_mode: 'Markdown' }
      );
    });

    // ─── Command: /model ───────────────────────────────────────────────
    this.bot.command('model', async (ctx) => {
      const args = ctx.message.text.split(' ').slice(1);
      const newModel = args[0];

      if (!newModel) {
        const currentModel = this.engine.getModel();
        await ctx.reply(
          `🤖 **Current Active Model:** \`${currentModel}\`\n\n` +
          `To switch the model, send:\n` +
          `\`/model <model_name>\`\n\n` +
          `Example: \`/model llama3.2\`\n` +
          `*(Make sure the model is installed on your local Ollama library!)*`,
          { parse_mode: 'Markdown' }
        );
      } else {
        try {
          this.engine.setModel(newModel);
          // Dynamically persist in config
          const configManager = (this.engine as any).config;
          if (configManager) {
            configManager.set('ollama', { model: newModel });
            configManager.save();
          }
          await ctx.reply(`✅ **Model successfully switched to:** \`${newModel}\``);
        } catch (err: any) {
          await ctx.reply(`❌ **Failed to switch model:** ${err.message}`);
        }
      }
    });

    // ─── Command: /preview ─────────────────────────────────────────────
    this.bot.command('preview', async (ctx) => {
      const args = ctx.message.text.split(' ').slice(1);
      const url = args[0] || 'http://localhost:5173'; // Default to Vite standard dev port

      const statusMsg = await ctx.reply(`📸 **Capturing visual preview of:** \`${url}\`...\nPlease wait...`);

      const filename = `preview-${Date.now()}.png`;
      const outputPath = resolve(process.cwd(), filename);

      try {
        const { captureHeadlessScreenshot } = await import('../tools/browser.js');
        await captureHeadlessScreenshot(url, outputPath);

        await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);

        await ctx.replyWithPhoto(
          { source: outputPath },
          { caption: `📸 **Visual Preview:** [${url}](${url})\nCaptured at: \`${new Date().toLocaleTimeString()}\``, parse_mode: 'Markdown' }
        );

        const fs = await import('node:fs');
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch (err: any) {
        try {
          await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, `❌ **Screenshot failed:** ${err.message}`);
        } catch {
          await ctx.reply(`❌ **Screenshot failed:** ${err.message}`);
        }
      }
    });

    // ─── Command: /browse ──────────────────────────────────────────────
    this.bot.command('browse', async (ctx) => {
      const args = ctx.message.text.split(' ').slice(1);
      const url = args[0] || 'http://localhost:5173';

      const statusMsg = await ctx.reply(`🌐 **Starting remote browser session for:** \`${url}\`...\nPlease wait...`);

      try {
        await this.closeActiveBrowserSession();

        const { findBrowser } = await import('../tools/browser.js');
        const puppeteer = (await import('puppeteer-core')).default;
        const executablePath = findBrowser();
        if (!executablePath) {
          throw new Error('No Chrome/Edge found on system. Please install one first.');
        }

        const browser = await puppeteer.launch({
          executablePath,
          headless: true, // headless works perfectly on cloud servers
          defaultViewport: { width: 1024, height: 768 },
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        this.browserSession = { browser, page, url };

        await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
        await this.sendBrowserCapture(ctx, 'Remote Browser Connected');
      } catch (err: any) {
        try {
          await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, `❌ **Failed to open browser:** ${err.message}`);
        } catch {
          await ctx.reply(`❌ **Failed to open browser:** ${err.message}`);
        }
      }
    });

    // ─── Command: /goal ────────────────────────────────────────────────
    this.bot.command('goal', async (ctx) => {
      const args = ctx.message.text.split(' ').slice(1);
      const scratchpad = this.engine.getScratchpad();

      if (args.length > 0) {
        const goalStr = args.join(' ');
        
        // Reset scratchpad state
        scratchpad.reset();
        
        // Initialize with new goal
        scratchpad.update({
          goal: goalStr,
          phase: 'planning',
          currentTask: 'Analyzing project and planning implementation',
          nextSteps: ['Define requirements', 'Create implementation plan', 'Execute changes', 'Verify changes']
        });
	// Switch mode to agent mode
        this.engine.setMode('agent');

        await ctx.reply(
          `🎯 **New Goal Initialized!**\n\n` +
          `• **Goal:** ${goalStr}\n` +
          `• **Mode:** Switched to \`AGENT MODE\` for autonomous execution.\n` +
          `• **Tracker:** \`NOVA_GOAL_TRACKER.md\` is being maintained in the workspace.\n\n` +
          `⚡ *Starting autonomous execution...*`,
          { parse_mode: 'Markdown' }
        );

        // Run the agent loop
        await this.executeAgentLoop(ctx, `My goal is: ${goalStr}. Please start by creating the implementation plan and breaking it down into specific tasks.`);
        return;
      }

      // No args: show status dashboard
      const state = scratchpad.getState();
      if (!state.goal) {
        await ctx.reply(
          `⚠️ **No active goal found.**\n\n` +
          `To start a new goal and execute it autonomously, use:\n` +
          `\`/goal <your objective>\``,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Calculate progress
      const total = state.completed.length + state.nextSteps.length;
      let percent = total > 0 ? Math.round((state.completed.length / total) * 100) : 0;
      if (state.phase === 'done') percent = 100;

      const barWidth = 15;
      const filled = Math.round((percent / 100) * barWidth);
      const empty = barWidth - filled;
      const barStr = `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percent}%`;

      let msg = `🏆 **Active Goal Dashboard:**\n\n` +
        `🎯 **Goal:** ${state.goal}\n` +
        `📌 **Current Task:** ${state.currentTask || 'None'}\n` +
        `📊 **Phase:** \`${state.phase.toUpperCase()}\` (Step ${state.stepCount})\n` +
        `⏱ **Last Updated:** \`${new Date(state.lastUpdated).toLocaleTimeString()}\`\n` +
        `📈 **Milestone Progress:** \`${barStr}\`\n\n`;

      if (state.nextSteps.length > 0) {
        msg += `📝 **Next Steps:**\n`;
        for (const step of state.nextSteps.slice(0, 5)) {
          msg += `• [ ] ${step}\n`;
        }
        if (state.nextSteps.length > 5) {
          msg += `• *... and ${state.nextSteps.length - 5} more*\n`;
        }
        msg += `\n`;
      }

      if (state.completed.length > 0) {
        msg += `✅ **Completed Steps:**\n`;
        for (const step of state.completed.slice(-5)) {
          msg += `• [x] ${step}\n`;
        }
        if (state.completed.length > 5) {
          msg += `• *... and ${state.completed.length - 5} earlier*\n`;
        }
        msg += `\n`;
      }

      if (state.keyFiles.length > 0) {
        msg += `📂 **Key Files:** \`${state.keyFiles.join(', ')}\`\n`;
      }

      if (state.constraints.length > 0) {
        msg += `⚠️ **Constraints:** ${state.constraints.join(', ')}\n`;
      }

      await ctx.reply(msg, { parse_mode: 'Markdown' });
    });

    // ─── Callback Query (Confirmation responses & dynamic previews) ────
    this.bot.on('callback_query', async (ctx) => {
      const data = (ctx.callbackQuery as any).data;
      if (!data) return;

      // ⚡ Answer callback query IMMEDIATELY to stop Telegram loading spinner
      try { await ctx.answerCbQuery(); } catch {}

      logger.info(`📩 Callback received: "${data}"`);

      const parts = data.split(':');
      const action = parts[0];
      const confirmationId = parts.slice(1).join(':');

      // Intercept visual explorer commands
      if (data.startsWith('explorer:')) {
        const explorerAction = data.substring('explorer:'.length);
        const actionParts = explorerAction.split(':');
        const cmd = actionParts[0];
        const argId = actionParts.slice(1).join(':');

        if (cmd === 'close') {
          if (this.explorerLastMessageId) {
            try {
              const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
              if (chatId) {
                await ctx.telegram.deleteMessage(chatId, this.explorerLastMessageId);
              }
            } catch {}
            this.explorerLastMessageId = undefined;
          }
          this.pendingExplorerAction = null;
          await ctx.reply('🔒 **Visual File Explorer closed.**');
          return;
        }

        if (cmd === 'cd') {
          const folderpath = this.getAbsolutePathFromId(argId);
          if (folderpath) {
            await this.sendVisualExplorer(ctx, folderpath);
          } else {
            await ctx.reply('❌ Folder path not found in cache.');
            return;
          }
        } else if (cmd === 'view') {
          const filepath = this.getAbsolutePathFromId(argId);
          if (filepath) {
            await this.sendVisualFileDetails(ctx, filepath);
          } else {
            await ctx.reply('❌ File path not found in cache.');
            return;
          }
        } else if (cmd === 'read') {
          const filepath = this.getAbsolutePathFromId(argId);
          if (filepath) {
            const fs = await import('node:fs');
            const path = await import('node:path');
            try {
              const content = fs.readFileSync(filepath, 'utf-8');
              if (content.length < 3500) {
                const ext = path.extname(filepath).substring(1) || 'txt';
                await ctx.reply(`📄 **File Content: ${path.basename(filepath)}**\n\`\`\`${ext}\n${content}\n\`\`\``);
              } else {
                await ctx.replyWithDocument({ source: filepath, filename: path.basename(filepath) });
              }
              await this.sendVisualFileDetails(ctx, filepath);
            } catch (err: any) {
              await ctx.reply(`❌ **Failed to read file:** ${err.message}`);
            }
          } else {
            await ctx.reply('❌ File path not found in cache.');
            return;
          }
        } else if (cmd === 'edit') {
          const filepath = this.getAbsolutePathFromId(argId);
          if (filepath) {
            const path = await import('node:path');
            this.pendingExplorerAction = { action: 'edit_file', filepath };
            await ctx.reply(`✏ **Editing file:** \`${path.basename(filepath)}\`\nSend the new content you want to write to this file (This will completely overwrite the file).`);
          } else {
            await ctx.reply('❌ File path not found.');
            return;
          }
        } else if (cmd === 'delete_confirm') {
          const filepath = this.getAbsolutePathFromId(argId);
          if (filepath) {
            const path = await import('node:path');
            const text = `⚠️ **Are you sure you want to delete this file?**\n\n\`${path.basename(filepath)}\`\n\nThis action cannot be undone!`;
            const keyboard = Markup.inlineKeyboard([
              Markup.button.callback('🗑 Yes, Delete', `explorer:delete_exec:${argId}`),
              Markup.button.callback('❌ Cancel', `explorer:view:${argId}`)
            ]);
            if (this.explorerLastMessageId) {
              try {
                const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
                if (chatId) {
                  await ctx.telegram.deleteMessage(chatId, this.explorerLastMessageId);
                }
              } catch {}
            }
            const msg = await ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
            this.explorerLastMessageId = msg.message_id;
          } else {
            await ctx.reply('❌ File path not found.');
            return;
          }
        } else if (cmd === 'delete_exec') {
          const filepath = this.getAbsolutePathFromId(argId);
          if (filepath) {
            const fs = await import('node:fs');
            const path = await import('node:path');
            try {
              fs.unlinkSync(filepath);
              await ctx.reply(`🗑 **File deleted successfully:** \`${path.basename(filepath)}\``);
              await this.sendVisualExplorer(ctx, path.dirname(filepath));
            } catch (err: any) {
              await ctx.reply(`❌ **Delete failed:** ${err.message}`);
            }
          } else {
            await ctx.reply('❌ File path not found.');
            return;
          }
        } else if (cmd === 'back_to_folder') {
          await this.sendVisualExplorer(ctx);
        } else if (cmd === 'action_new_file') {
          this.pendingExplorerAction = { action: 'create_file' };
          await ctx.reply(`➕ **Create New File:**\nSend the name of the file you want to create (e.g. \`index.js\` or \`styles.css\`).`);
        } else if (cmd === 'action_new_folder') {
          this.pendingExplorerAction = { action: 'create_folder' };
          await ctx.reply(`📁 **Create New Folder:**\nSend the name of the folder you want to create (e.g. \`components\` or \`utils\`).`);
        }

        return;
      }

      // Intercept interactive browser commands
      if (data.startsWith('browser:')) {
        const browserAction = data.substring('browser:'.length);
        if (!this.browserSession) {
          await ctx.reply('❌ No active browser session. Run /browse <url>');
          return;
        }

        const { page } = this.browserSession;

        if (browserAction === 'close') {
          await this.closeActiveBrowserSession();
          await ctx.reply('🔒 **Remote browser session closed.**');
          return;
        }

        if (browserAction === 'scroll_down') {
          await page.evaluate(() => (globalThis as any).scrollBy(0, 350));
          await this.sendBrowserCapture(ctx, 'Scrolled Down');
        } else if (browserAction === 'scroll_up') {
          await page.evaluate(() => (globalThis as any).scrollBy(0, -350));
          await this.sendBrowserCapture(ctx, 'Scrolled Up');
        } else if (browserAction === 'scroll_left') {
          await page.evaluate(() => (globalThis as any).scrollBy(-200, 0));
          await this.sendBrowserCapture(ctx, 'Scrolled Left');
        } else if (browserAction === 'scroll_right') {
          await page.evaluate(() => (globalThis as any).scrollBy(200, 0));
          await this.sendBrowserCapture(ctx, 'Scrolled Right');
        } else if (browserAction === 'action_reload') {
          await page.reload({ waitUntil: 'networkidle2' });
          await this.sendBrowserCapture(ctx, 'Page Reloaded');
        } else if (browserAction === 'action_click') {
          this.pendingBrowserAction = 'click';
          await ctx.reply('🖱️ **Ready to Click:**\nSend the CSS selector or name/text of the element you want to click (e.g. `button.login` or `"Login"`).');
        } else if (browserAction === 'action_type') {
          this.pendingBrowserAction = 'type';
          await ctx.reply('⌨ **Ready to Type:**\nSend input field name/CSS selector and text separated by a colon, e.g. `input[name="email"]:user@domain.com` or `"Email":user@domain.com`');
        }

        return;
      }

      if (action === 'preview_url') {
        const url = confirmationId;
        const statusMsg = await ctx.reply(`📸 **Capturing visual preview of:** \`${url}\`...\nPlease wait...`);
        const filename = `preview-${Date.now()}.png`;
        const outputPath = resolve(process.cwd(), filename);

        try {
          const { captureHeadlessScreenshot } = await import('../tools/browser.js');
          await captureHeadlessScreenshot(url, outputPath);

          const chatId = ctx.chat?.id || statusMsg.chat.id;
          await ctx.telegram.deleteMessage(chatId, statusMsg.message_id);
          await ctx.replyWithPhoto(
            { source: outputPath },
            { caption: `📸 **Visual Preview:** [${url}](${url})\nCaptured at: \`${new Date().toLocaleTimeString()}\``, parse_mode: 'Markdown' }
          );

          const fs = await import('node:fs');
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch (err: any) {
          try {
            const chatId = ctx.chat?.id || statusMsg.chat.id;
            await ctx.telegram.editMessageText(chatId, statusMsg.message_id, undefined, `❌ **Screenshot failed:** ${err.message}`);
          } catch {
            await ctx.reply(`❌ **Screenshot failed:** ${err.message}`);
          }
        }
        return;
      }

      // ─── Handle Approve / Reject ───────────────────────────────────
      const resolveConfirm = this.activeConfirmations.get(confirmationId);

      if (resolveConfirm) {
        this.activeConfirmations.delete(confirmationId);
        const approved = action === 'approve';

        logger.info(`✅ Confirmation ${confirmationId}: ${approved ? 'APPROVED' : 'REJECTED'}`);

        try {
          await ctx.editMessageText(
            approved 
              ? `✅ **Approved:** Executing command...`
              : `❌ **Rejected:** Command execution skipped.`
          );
        } catch {}

        resolveConfirm(approved);
      } else {
        logger.warn(`⚠️ Confirmation not found: ${confirmationId} (active: ${this.activeConfirmations.size})`);
        await ctx.reply('⚠️ انتهت صلاحية هذا الطلب أو تم إعادة تشغيل البوت. يرجى إرسال الطلب مجدداً.');
      }
    });

    // ─── Standard Prompt Input ─────────────────────────────────────────
    this.bot.on('text', async (ctx) => {
      const text = ctx.message.text.trim();
      if (text.startsWith('/')) return; // Ignore other slash commands

      // Handle visual explorer text input
      if (this.pendingExplorerAction) {
        const explorerAction = this.pendingExplorerAction;
        this.pendingExplorerAction = null; // Reset state
        await this.handleExplorerTextInput(ctx, explorerAction, text);
        return;
      }

      // Handle interactive browser text input (selectors, typing)
      if (this.browserSession && this.pendingBrowserAction) {
        const action = this.pendingBrowserAction;
        this.pendingBrowserAction = null; // Reset state
        await this.handleBrowserTextInput(ctx, action, text);
        return;
      }

      await this.executeAgentLoop(ctx, text);
    });

    // ─── Handle Uploaded Files ─────────────────────────────────────────
    this.bot.on('document', async (ctx) => {
      const document = ctx.message.document;
      if (!document) return;

      const statusMsg = await ctx.reply(`📥 **Downloading uploaded file...**`);

      try {
        const fileId = document.file_id;
        const filename = document.file_name || `upload-${Date.now()}`;
        const fileUrl = await ctx.telegram.getFileLink(fileId);

        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error('Failed to fetch file from Telegram servers.');
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const fs = await import('node:fs');
        const path = await import('node:path');
        const outputPath = path.join(this.explorerCurrentPath, filename);

        fs.writeFileSync(outputPath, buffer);

        await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
        await ctx.reply(`✅ **Uploaded successfully!** Saved to: \`${filename}\``);
        
        // Refresh explorer
        await this.sendVisualExplorer(ctx);
      } catch (err: any) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
        } catch {}
        await ctx.reply(`❌ **Upload failed:** ${err.message}`);
      }
    });
  }

  private async executeAgentLoop(ctx: any, prompt: string) {
    const initialMessage = await ctx.reply(`🧠 **Initializing Nova Engine...**\nProcessing prompt: \`${prompt}\``);
    const messageId = initialMessage.message_id;

    let responseBuffer = '';
    let currentToolName = '';
    let currentToolArgs = '';
    let isProcessing = true;
    let lastEditTime = 0;
    let editPending = false;

    // ── Throttled Update Engine (Avoids Telegram Rate Limits) ─────────
    const updateTelegramMessage = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastEditTime < 1500) {
        editPending = true;
        return;
      }

      editPending = false;
      lastEditTime = now;

      let statusMarkdown = `🤖 **Nova Agent — Active Task**\n` +
        `• **Status:** ${isProcessing ? '⚡ Executing' : '🏁 Completed'}\n` +
        `• **Task:** \`${prompt.length > 60 ? prompt.slice(0, 60) + '...' : prompt}\`\n\n`;

      if (currentToolName) {
        statusMarkdown += `📂 **Active Tool:** \`${currentToolName}\`\n`;
        if (currentToolArgs) {
          const trimmedArgs = currentToolArgs.length > 800
            ? currentToolArgs.slice(0, 800) + '\n... (arguments truncated)'
            : currentToolArgs;
          statusMarkdown += `\`\`\`json\n${trimmedArgs}\n\`\`\`\n`;
        }
      }

      if (responseBuffer) {
        // Strip out ansi color codes before sending to Telegram
        const cleanResponse = responseBuffer.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
        const trimmedResponse = cleanResponse.length > 2000 
          ? '*(... earlier response truncated ...)*\n\n' + cleanResponse.slice(-2000)
          : cleanResponse;
        statusMarkdown += `🧠 **Cognitive Response:**\n${trimmedResponse}\n\n`;
      }

      try {
        await ctx.telegram.editMessageText(ctx.chat.id, messageId, undefined, statusMarkdown, { parse_mode: 'Markdown' });
      } catch (err: any) {
        if (!err.message?.includes('message is not modified')) {
          logger.warn(`Failed to update Telegram status: ${err.message}`);
        }
      }
    };

    const throttleTimer = setInterval(() => {
      if (editPending) {
        updateTelegramMessage(false).catch(() => {});
      }
    }, 1000);

    // ── Custom Dynamic Confirm Handler for this run ───────────────────
    this.engine.setConfirmHandler(async (message: string) => {
      if (this.isReadOnly) {
        await ctx.reply(`🔒 **Read-Only Lock:** Blocked command: \`${message}\``);
        return false;
      }

      // Extract tool name and arguments from the message
      const toolMatch = message.match(/^Execute (\w+)\?/);
      const toolName = toolMatch ? toolMatch[1] : 'unknown';
      const args = message.slice(message.indexOf('\n') + 1 || 0);

      // Get configuration arrays, with fallbacks
      const toolsConfig = (this.engine as any).config?.get('tools') || {};
      const autoApprove = toolsConfig.autoApprove || [];
      const notifyApprove = toolsConfig.notifyApprove || [];
      const confirmTimeout = toolsConfig.confirmTimeout || 15000;

      // Tier 1: Silent Auto-Approve (safe read-only tools)
      if (autoApprove.includes(toolName)) {
        return true;
      }

      // Tier 2: Auto-Approve with Notification (writing, editing, browser navigation)
      if (notifyApprove.includes(toolName)) {
        ctx.reply(
          `⚡ **Auto-Approved:** \`${toolName}\`\n\`\`\`\n${args.slice(0, 300)}${args.length > 300 ? '...' : ''}\n\`\`\``,
          { parse_mode: 'Markdown' }
        ).catch(() => {});
        return true;
      }

      // Tier 3: TIMED CONFIRMATION (Shell commands and task delegation)
      const confirmId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      
      const confirmMsg = await ctx.reply(
        `⚠️ **Requires Approval:**\n\`${toolName}\`\n\`\`\`\n${args.slice(0, 500)}${args.length > 500 ? '...' : ''}\n\`\`\`\n\n⏳ *Auto-approving in ${Math.round(confirmTimeout / 1000)} seconds...*`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            Markup.button.callback('✅ Approve', `approve:${confirmId}`),
            Markup.button.callback('❌ Reject', `reject:${confirmId}`),
          ])
        }
      );

      return new Promise<boolean>((resolve) => {
        const autoTimer = setTimeout(async () => {
          this.activeConfirmations.delete(confirmId);
          try {
            await ctx.telegram.editMessageText(
              ctx.chat.id,
              confirmMsg.message_id,
              undefined,
              `✅ **Auto-Approved (timeout):** \`${toolName}\``
            );
          } catch {}
          resolve(true);
        }, confirmTimeout);

        this.activeConfirmations.set(confirmId, (approved: boolean) => {
          clearTimeout(autoTimer);
          resolve(approved);
        });
      });
    });

    // ── Listen to Engine Streaming Events ─────────────────────────────
    const onToken = (token: string) => {
      responseBuffer += token;
      editPending = true;
    };

    const onToolStart = (data: { name: string; args: any }) => {
      currentToolName = data.name;
      try {
        currentToolArgs = JSON.stringify(data.args, null, 2);
      } catch {
        currentToolArgs = '';
      }
      editPending = true;
    };

    const onToolEnd = (data: { name: string; success: boolean; output?: string; error?: string; metadata?: any }) => {
      currentToolName = '';
      currentToolArgs = '';

      // If there's a diff, send a beautiful colored diff in Telegram markdown!
      if (data.success && data.metadata?.diff) {
        const diffBlock = data.metadata.diff.length > 3000
          ? data.metadata.diff.slice(0, 2900) + '\n... [diff truncated due to size]'
          : data.metadata.diff;
        ctx.reply(`📝 **Changes diff:**\n\`\`\`diff\n${diffBlock}\n\`\`\``, { parse_mode: 'Markdown' }).catch(() => {});
      }

      // Intercept browser screenshot tool and send the picture directly to Telegram
      if (data.name === 'browser_screenshot' && data.success && data.output) {
        const match = data.output.match(/Screenshot saved:\s*(.+)/);
        if (match) {
          const filename = match[1].trim();
          const filepath = resolve(process.cwd(), filename);
          import('node:fs').then((fs) => {
            if (fs.existsSync(filepath)) {
              ctx.replyWithPhoto(
                { source: filepath },
                { caption: `📸 **Visual Observation:**\nHere is the live screenshot captured by Nova.` }
              ).then(() => {
                try {
                  fs.unlinkSync(filepath);
                } catch {}
              }).catch(() => {});
            }
          }).catch(() => {});
        }
      }

      if (data.output && data.output.length > 50) {
        const terminalHeader = `┌─── 🖥️ terminal.log [${data.name}] ────────────────────────\n`;
        const cleanOutput = data.output.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
        let terminalBody = cleanOutput.length > 1000 ? cleanOutput.slice(-1000) : cleanOutput;
        terminalBody = terminalBody.replace(/```/g, "'''");
        const terminalFooter = `\n└────────────────────────────────────────────`;

        ctx.reply(`\`\`\`text\n${terminalHeader}${terminalBody}${terminalFooter}\n\`\`\``, { parse_mode: 'Markdown' }).catch(() => {});

        // If a server daemon started, reply with an inline button to allow the user to easily capture a screenshot
        if (cleanOutput.includes('Server started as background daemon') || cleanOutput.includes('daemonized')) {
          const portMatch = cleanOutput.match(/port\s+(\d+)/i);
          const port = portMatch ? portMatch[1] : '5173';
          const previewUrl = `http://localhost:${port}`;

          ctx.reply(
            `🖥️ **Server Daemon is Active!**\nWould you like to capture a visual preview?`,
            {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                Markup.button.callback('📸 Take Visual Preview', `preview_url:${previewUrl}`)
              ])
            }
          ).catch(() => {});
        }
      }

      editPending = true;
    };

    this.engine.on('token', onToken);
    this.engine.on('tool_start', onToolStart);
    this.engine.on('tool_end', onToolEnd);

    // ── Skills & Sub-Agent Visibility Notifications ──────────────────
    const onSkillsActivated = (data: { skills: string[], reasons: Record<string, string> }) => {
      if (data.skills.length > 0) {
        const skillsList = data.skills.map(s => {
          const reason = data.reasons[s] || '';
          return `• 🧠 **${s.toUpperCase()}**: ${reason}`;
        }).join('\n');
        ctx.reply(`🧬 **Active Cognitive Skills:**\n${skillsList}`, { parse_mode: 'Markdown' }).catch(() => {});
      }
    };

    const onSubAgentSpawned = (data: { task: string, depth: number }) => {
      ctx.reply(
        `🤖 **Sub-Agent Spawned (Level ${data.depth}):**\n📋 Task: \`${(data.task as string).slice(0, 200)}\``,
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    };

    const onSubAgentCompleted = (data: { task: string, success: boolean, changes: number }) => {
      ctx.reply(
        `${data.success ? '✅' : '❌'} **Sub-Agent ${data.success ? 'Completed' : 'Failed'}:**\n` +
        `📋 Task: \`${(data.task as string).slice(0, 100)}\`\n` +
        `📦 Changes: ${data.changes} files`,
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    };

    this.engine.on('skills_activated', onSkillsActivated);
    this.engine.on('subagent_spawned', onSubAgentSpawned);
    this.engine.on('subagent_completed', onSubAgentCompleted);

    try {
      await this.engine.processMessage(prompt);
    } catch (err: any) {
      await ctx.reply(`❌ **Task Failed:** ${err.message}`);
    } finally {
      isProcessing = false;
      clearInterval(throttleTimer);

      this.engine.off('token', onToken);
      this.engine.off('tool_start', onToolStart);
      this.engine.off('tool_end', onToolEnd);
      this.engine.off('skills_activated', onSkillsActivated);
      this.engine.off('subagent_spawned', onSubAgentSpawned);
      this.engine.off('subagent_completed', onSubAgentCompleted);

      await updateTelegramMessage(true);
    }
  }

  private async closeActiveBrowserSession() {
    if (this.browserSession) {
      try {
        await this.browserSession.browser.close();
      } catch {}
      this.browserSession = null;
      this.pendingBrowserAction = null;
    }
  }

  private async sendBrowserCapture(ctx: any, captionPrefix = '') {
    if (!this.browserSession) return;
    const { page, url } = this.browserSession;
    const filename = `browse-${Date.now()}.png`;
    const outputPath = resolve(process.cwd(), filename);

    try {
      await page.screenshot({ path: outputPath });

      const caption = `${captionPrefix ? `✨ **${captionPrefix}**\n` : ''}` +
        `🌐 **Page:** \`${url}\`\n` +
        `📝 **Title:** \`${await page.title()}\``;

      // Remote desktop control panel inline keyboard
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('◀ Scroll Left', 'browser:scroll_left'),
          Markup.button.callback('▲ Scroll Up', 'browser:scroll_up'),
          Markup.button.callback('▼ Scroll Down', 'browser:scroll_down'),
          Markup.button.callback('▶ Scroll Right', 'browser:scroll_right'),
        ],
        [
          Markup.button.callback('🖱️ Click', 'browser:action_click'),
          Markup.button.callback('⌨ Type', 'browser:action_type'),
          Markup.button.callback('🔄 Reload', 'browser:action_reload'),
        ],
        [
          Markup.button.callback('❌ Close Browser', 'browser:close'),
        ]
      ]);

      if (this.browserSession.lastMessageId) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, this.browserSession.lastMessageId);
        } catch {}
      }

      const photoMsg = await ctx.replyWithPhoto(
        { source: outputPath },
        { caption, parse_mode: 'Markdown', ...keyboard }
      );

      this.browserSession.lastMessageId = photoMsg.message_id;

      const fs = await import('node:fs');
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch (err: any) {
      await ctx.reply(`❌ **Failed to capture browser screen:** ${err.message}`);
    }
  }

  private async handleBrowserTextInput(ctx: any, action: 'click' | 'type' | 'navigate', text: string) {
    if (!this.browserSession) return;
    const { page } = this.browserSession;

    const statusMsg = await ctx.reply(`⚡ **Executing browser control command...**`);

    try {
      if (action === 'click') {
        let selector = text;
        
        // Literal text clicking, e.g. "Login" or 'Click here'
        if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
          const innerText = text.slice(1, -1);
          const found = await page.evaluate((txt: string) => {
            const elements = Array.from((globalThis as any).document.querySelectorAll('a, button, input[type="button"], input[type="submit"], [role="button"], span, div'));
            const el = elements.find((e: any) => e.textContent?.trim().toLowerCase().includes(txt.toLowerCase()));
            if (el) {
              (el as any).click();
              return true;
            }
            return false;
          }, innerText);
          if (!found) {
            throw new Error(`Could not find button or text element with content: "${innerText}"`);
          }
        } else {
          // Normal CSS click
          await page.waitForSelector(selector, { timeout: 4000 });
          await page.click(selector);
        }

        await new Promise(r => setTimeout(r, 1500));
        await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
        await this.sendBrowserCapture(ctx, `Clicked: ${text}`);
      } else if (action === 'type') {
        let selector = '';
        let field = '';
        let value = '';
        const colonIndex = text.indexOf(':');

        if (colonIndex === -1) {
          // Ultra-Premium Fallback: Detect appropriate input field automatically
          value = text;
          const detectedSelector = await page.evaluate(() => {
            // 1. Google or search engines input box first
            const q = (globalThis as any).document.querySelector('textarea[name="q"], input[name="q"], input[type="search"]');
            if (q && q.offsetWidth > 0 && q.offsetHeight > 0) {
              return 'textarea[name="q"], input[name="q"], input[type="search"]';
            }
            // 2. Focused active element if it's editable
            const activeEl = (globalThis as any).document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
              if (activeEl.id) return `#${activeEl.id}`;
              const name = activeEl.getAttribute('name');
              if (name) return `${activeEl.tagName.toLowerCase()}[name="${name}"]`;
            }
            // 3. First visible editable input field
            const inputs = Array.from((globalThis as any).document.querySelectorAll('input[type="text"], input[type="search"], input:not([type]), textarea'));
            const visible = inputs.find((i: any) => i.offsetWidth > 0 && i.offsetHeight > 0);
            if (visible) {
              const element = visible as any;
              if (element.id) return `#${element.id}`;
              const name = element.getAttribute('name');
              if (name) return `${element.tagName.toLowerCase()}[name="${name}"]`;
              return element.tagName.toLowerCase();
            }
            return null;
          });

          if (!detectedSelector) {
            throw new Error('No colon found, and could not automatically detect an input field on this page.');
          }
          selector = detectedSelector;
          field = 'Auto-Detected Input';
        } else {
          field = text.slice(0, colonIndex).trim();
          value = text.slice(colonIndex + 1);

          // Label-based typing, e.g. "Email":test@domain.com
          if ((field.startsWith('"') && field.endsWith('"')) || (field.startsWith("'") && field.endsWith("'"))) {
            const innerText = field.slice(1, -1);
            const foundSelector = await page.evaluate((txt: string) => {
              const inputs = Array.from((globalThis as any).document.querySelectorAll('input, textarea'));
              const el = inputs.find((i: any) => {
                if (i.getAttribute('placeholder')?.toLowerCase().includes(txt.toLowerCase())) return true;
                if (i.getAttribute('name')?.toLowerCase().includes(txt.toLowerCase())) return true;
                if (i.id && (globalThis as any).document.querySelector(`label[for="${i.id}"]`)?.textContent?.toLowerCase().includes(txt.toLowerCase())) return true;
                return false;
              });
              if (el) {
                const element = el as any;
                if (element.id) return `#${element.id}`;
                const name = element.getAttribute('name');
                if (name) return `input[name="${name}"]`;
                const type = element.getAttribute('type');
                if (type) return `input[type="${type}"]`;
              }
              return null;
            }, innerText);

            if (!foundSelector) {
              throw new Error(`Could not locate input field matching label: "${innerText}"`);
            }
            selector = foundSelector;
          } else {
            selector = field;
          }
        }

        await page.waitForSelector(selector, { timeout: 4000 });
        await page.click(selector, { clickCount: 3 });
        await page.keyboard.press('Backspace');
        await page.type(selector, value);
        await page.keyboard.press('Enter'); // Automatically press Enter to search/submit!

        await new Promise(r => setTimeout(r, 2000));
        await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
        await this.sendBrowserCapture(ctx, `Typed "${value}" & pressed Enter`);
      }
    } catch (err: any) {
      try {
        await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, `❌ **Browser Action Failed:** ${err.message}`);
      } catch {
        await ctx.reply(`❌ **Browser Action Failed:** ${err.message}`);
      }
    }
  }

  private cachePath(absolutePath: string): string {
    for (const [key, val] of this.explorerPathCache.entries()) {
      if (val === absolutePath) return key;
    }
    const id = `p${this.explorerCacheCounter++}`;
    this.explorerPathCache.set(id, absolutePath);
    return id;
  }

  private getAbsolutePathFromId(id: string): string | undefined {
    return this.explorerPathCache.get(id);
  }

  private async sendVisualExplorer(ctx: any, folderpath?: string) {
    const fs = await import('node:fs');
    const path = await import('node:path');

    if (folderpath) {
      this.explorerCurrentPath = path.resolve(folderpath);
    }

    try {
      const items = fs.readdirSync(this.explorerCurrentPath, { withFileTypes: true });
      
      const folders = items
        .filter(item => item.isDirectory() && item.name !== '.git' && item.name !== 'node_modules')
        .sort((a, b) => a.name.localeCompare(b.name));
         
      const files = items
        .filter(item => item.isFile() && item.name !== '.nova-state.json')
        .sort((a, b) => a.name.localeCompare(b.name));

      const relativePath = path.relative(process.cwd(), this.explorerCurrentPath) || '.';
      let messageText = `📁 **Visual File Explorer**\n`;
      messageText += `📍 **Current Path:** \`${relativePath}\`\n\n`;
      messageText += `Select a folder to navigate or a file to view/edit:`;

      const keyboardButtons: any[][] = [];

      // Up folder button (Back)
      const parentDir = path.dirname(this.explorerCurrentPath);
      if (parentDir !== this.explorerCurrentPath) {
        const parentId = this.cachePath(parentDir);
        keyboardButtons.push([Markup.button.callback('⬅️ Up / Parent Directory', `explorer:cd:${parentId}`)]);
      }

      const maxItems = 25;
      const displayedFolders = folders.slice(0, maxItems);
      const displayedFiles = files.slice(0, maxItems);

      if (folders.length > maxItems || files.length > maxItems) {
        messageText += `\n\n⚠️ *Some files/folders were hidden due to list size limits.*`;
      }

      // List Folders
      for (const folder of displayedFolders) {
        const fullPath = path.join(this.explorerCurrentPath, folder.name);
        const cachedId = this.cachePath(fullPath);
        keyboardButtons.push([Markup.button.callback(`📁 ${folder.name}`, `explorer:cd:${cachedId}`)]);
      }

      // List Files
      for (const file of displayedFiles) {
        const fullPath = path.join(this.explorerCurrentPath, file.name);
        const cachedId = this.cachePath(fullPath);
        keyboardButtons.push([Markup.button.callback(`📄 ${file.name}`, `explorer:view:${cachedId}`)]);
      }

      // Control Panel Row
      const currentDirId = this.cachePath(this.explorerCurrentPath);
      keyboardButtons.push([
        Markup.button.callback('➕ New File', 'explorer:action_new_file'),
        Markup.button.callback('📁 New Folder', 'explorer:action_new_folder'),
      ]);
      keyboardButtons.push([
        Markup.button.callback('🔄 Refresh', `explorer:cd:${currentDirId}`),
        Markup.button.callback('❌ Close Explorer', 'explorer:close'),
      ]);

      messageText += `\n\n💡 *Tip:* You can upload/drag-and-drop any file directly into this chat, and it will be saved to the current directory!`;

      if (this.explorerLastMessageId) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, this.explorerLastMessageId);
        } catch {}
      }

      const msg = await ctx.reply(messageText, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(keyboardButtons)
      });
      this.explorerLastMessageId = msg.message_id;

    } catch (err: any) {
      await ctx.reply(`❌ **Failed to load directory:** ${err.message}`);
    }
  }

  private async sendVisualFileDetails(ctx: any, filepath: string) {
    const fs = await import('node:fs');
    const path = await import('node:path');

    try {
      const stats = fs.statSync(filepath);
      const relativePath = path.relative(process.cwd(), filepath);
      
      let infoText = `📄 **File Details**\n`;
      infoText += `• **Name:** \`${path.basename(filepath)}\`\n`;
      infoText += `• **Path:** \`${relativePath}\`\n`;
      infoText += `• **Size:** \`${(stats.size / 1024).toFixed(2)} KB\`\n`;
      infoText += `• **Modified:** \`${stats.mtime.toLocaleTimeString()} ${stats.mtime.toLocaleDateString()}\`\n`;

      const cachedId = this.cachePath(filepath);
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('📄 Read Content', `explorer:read:${cachedId}`),
          Markup.button.callback('✏ Edit (Overwrite)', `explorer:edit:${cachedId}`),
        ],
        [
          Markup.button.callback('🗑 Delete File', `explorer:delete_confirm:${cachedId}`),
          Markup.button.callback('⬅️ Back to Explorer', 'explorer:back_to_folder'),
        ]
      ]);

      if (this.explorerLastMessageId) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, this.explorerLastMessageId);
        } catch {}
      }

      const msg = await ctx.reply(infoText, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      this.explorerLastMessageId = msg.message_id;
    } catch (err: any) {
      await ctx.reply(`❌ **Failed to retrieve file details:** ${err.message}`);
    }
  }

  private async handleExplorerTextInput(ctx: any, actionInfo: { action: string; filepath?: string }, text: string) {
    const fs = await import('node:fs');
    const path = await import('node:path');

    if (actionInfo.action === 'create_file') {
      const filename = text.trim();
      const newFilePath = path.join(this.explorerCurrentPath, filename);
      try {
        if (fs.existsSync(newFilePath)) {
          throw new Error('File already exists.');
        }
        fs.writeFileSync(newFilePath, '', 'utf-8');
        await ctx.reply(`✅ **File created successfully:** \`${filename}\``);
        await this.sendVisualExplorer(ctx);
      } catch (err: any) {
        await ctx.reply(`❌ **Failed to create file:** ${err.message}`);
        await this.sendVisualExplorer(ctx);
      }
    } else if (actionInfo.action === 'create_folder') {
      const foldername = text.trim();
      const newFolderPath = path.join(this.explorerCurrentPath, foldername);
      try {
        if (fs.existsSync(newFolderPath)) {
          throw new Error('Folder already exists.');
        }
        fs.mkdirSync(newFolderPath, { recursive: true });
        await ctx.reply(`✅ **Folder created successfully:** \`${foldername}\``);
        await this.sendVisualExplorer(ctx);
      } catch (err: any) {
        await ctx.reply(`❌ **Failed to create folder:** ${err.message}`);
        await this.sendVisualExplorer(ctx);
      }
    } else if (actionInfo.action === 'edit_file') {
      const filepath = actionInfo.filepath!;
      try {
        fs.writeFileSync(filepath, text, 'utf-8');
        await ctx.reply(`✅ **File updated successfully:** \`${path.basename(filepath)}\``);
        await this.sendVisualFileDetails(ctx, filepath);
      } catch (err: any) {
        await ctx.reply(`❌ **Failed to save file:** ${err.message}`);
        await this.sendVisualExplorer(ctx);
      }
    }
  }

  async start() {
    logger.info('🤖 Launching Nova Telegram Bot...');
    await this.bot.launch({ dropPendingUpdates: true });
    logger.info('✅ Telegram Gateway is online and listening.');
  }

  stop() {
    this.bot.stop();
    this.closeActiveBrowserSession().catch(() => {});
  }
}
