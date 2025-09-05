#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import dotenv from 'dotenv';
import { TrelloManager } from './trello-manager.js';
import { CommandProcessor } from './command-processor.js';
import { getOAuthManager } from './oauth-manager.js';
import { TextToTrello } from './text-to-trello.js';
import { getGeminiManager } from './gemini-manager.js';

// Environment variables yükle
dotenv.config();

// Express sunucusu
const app = express();
app.use(express.json());
app.use(express.static('public'));

// Trello Manager, Command Processor ve OAuth Manager örnekleri
const trelloManager = new TrelloManager();
const commandProcessor = new CommandProcessor(trelloManager);
const oauthManager = getOAuthManager();
const textToTrello = new TextToTrello();
const geminiManager = getGeminiManager();

// MCP Server oluştur
const server = new Server(
  {
    name: 'trello-task-assignment',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// MCP Tools tanımla
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'create_task',
        description: 'Trello\'da yeni görev oluşturur ve atama yapar',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Türkçe doğal dil komutu (örn: "Ziya\'ya yeni proje analizi görevi ata")',
            },
            board_id: {
              type: 'string',
              description: 'Trello pano ID (opsiyonel, varsayılan pano kullanılır)',
            },
          },
          required: ['command'],
        },
      },
      {
        name: 'assign_task',
        description: 'Mevcut bir görevi kullanıcıya atar',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Atama komutu (örn: "Proje X kartını Ziya\'ya ata")',
            },
          },
          required: ['command'],
        },
      },
      {
        name: 'list_boards',
        description: 'Kullanılabilir Trello panolarını listeler',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_board_info',
        description: 'Pano bilgilerini ve listelerini gösterir',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: {
              type: 'string',
              description: 'Trello pano ID',
            },
          },
          required: ['board_id'],
        },
      },
      {
        name: 'search_cards',
        description: 'Kartları arar ve gösterir',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Arama sorgusu',
            },
          },
          required: ['query'],
        },
      },
    ],
  };
});

// MCP Tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'create_task':
        return await handleCreateTask(args);
      case 'assign_task':
        return await handleAssignTask(args);
      case 'list_boards':
        return await handleListBoards();
      case 'get_board_info':
        return await handleGetBoardInfo(args);
      case 'search_cards':
        return await handleSearchCards(args);
      default:
        throw new Error(`Bilinmeyen araç: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Hata: ${error.message}`,
        },
      ],
    };
  }
});

// Tool handlers
async function handleCreateTask(args) {
  const { command, board_id } = args;
  
  console.log(`📝 Görev oluşturma komutu alındı: "${command}"`);
  
  const result = await commandProcessor.processCreateTaskCommand(command, board_id);
  
  return {
    content: [
      {
        type: 'text',
        text: result.success 
          ? `✅ Görev başarıyla oluşturuldu!\n\n🎯 **Kart:** ${result.card.name}\n👤 **Atanan:** ${result.assignedMembers.join(', ')}\n📋 **Liste:** ${result.list}\n🔗 **Link:** ${result.card.url}`
          : `❌ Hata: ${result.error}`,
      },
    ],
  };
}

async function handleAssignTask(args) {
  const { command } = args;
  
  console.log(`👤 Atama komutu alındı: "${command}"`);
  
  const result = await commandProcessor.processAssignTaskCommand(command);
  
  return {
    content: [
      {
        type: 'text',
        text: result.success 
          ? `✅ Görev başarıyla atandı!\n\n🎯 **Kart:** ${result.card.name}\n👤 **Atanan:** ${result.assignedTo}\n🔗 **Link:** ${result.card.url}`
          : `❌ Hata: ${result.error}`,
      },
    ],
  };
}

async function handleListBoards() {
  console.log('📋 Panolar listeleniyor...');
  
  const boards = await trelloManager.getBoards();
  
  const boardList = boards.map(board => 
    `🔸 **${board.name}** (ID: ${board.id})`
  ).join('\n');
  
  return {
    content: [
      {
        type: 'text',
        text: `📋 **Trello Panolarınız:**\n\n${boardList}`,
      },
    ],
  };
}

async function handleGetBoardInfo(args) {
  const { board_id } = args;
  
  console.log(`🔍 Pano bilgileri alınıyor: ${board_id}`);
  
  const boardInfo = await trelloManager.getBoardInfo(board_id);
  
  const listsText = boardInfo.lists.map(list => 
    `  🔹 **${list.name}** (${list.cards?.length || 0} kart)`
  ).join('\n');
  
  return {
    content: [
      {
        type: 'text',
        text: `📋 **Pano:** ${boardInfo.name}\n\n📝 **Listeler:**\n${listsText}\n\n👥 **Üyeler:** ${boardInfo.members.map(m => m.fullName).join(', ')}`,
      },
    ],
  };
}

async function handleSearchCards(args) {
  const { query } = args;
  
  console.log(`🔍 Kart aranıyor: "${query}"`);
  
  const cards = await trelloManager.searchCards(query);
  
  if (cards.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `🔍 "${query}" araması için hiç kart bulunamadı.`,
        },
      ],
    };
  }
  
  const cardsText = cards.slice(0, 10).map(card => 
    `🔸 **${card.name}**\n  📋 Liste: ${card.list?.name || 'Bilinmiyor'}\n  👥 Atanan: ${card.members?.map(m => m.fullName).join(', ') || 'Kimse'}\n  🔗 ${card.url}`
  ).join('\n\n');
  
  return {
    content: [
      {
        type: 'text',
        text: `🔍 **"${query}" için ${cards.length} kart bulundu:**\n\n${cardsText}${cards.length > 10 ? '\n\n... ve daha fazlası' : ''}`,
      },
    ],
  };
}

// OAuth route'larını kur
oauthManager.setupRoutes(app);

// OAuth authentication middleware
const requireAuth = (req, res, next) => oauthManager.requireAuth(req, res, next);

// Authentication durumunu kontrol et
app.get('/api/auth/status', (req, res) => {
  const authStatus = oauthManager.getAuthStatus(req);
  res.json(authStatus);
});

// Express HTTP endpoint'leri (test için)
app.post('/api/task', requireAuth, async (req, res) => {
  try {
    const { command, board_id } = req.body;
    const result = await commandProcessor.processCreateTaskCommand(command, board_id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/assign', requireAuth, async (req, res) => {
  try {
    const { command } = req.body;
    const result = await commandProcessor.processAssignTaskCommand(command);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/boards', requireAuth, async (req, res) => {
  try {
    const boards = await trelloManager.getBoards();
    res.json(boards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI status endpoint
app.get('/api/ai/status', (req, res) => {
  const stats = geminiManager.getStats();
  res.json({
    available: geminiManager.isAvailable(),
    ...stats
  });
});

// AI text enhancement endpoint
app.post('/api/ai/enhance', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Metin gerekli' });
    }
    
    const enhanced = await geminiManager.processAndEnhanceText(text);
    res.json({ success: true, enhanced });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI suggestions endpoint
app.post('/api/ai/suggest', requireAuth, async (req, res) => {
  try {
    const { context } = req.body;
    const suggestions = await geminiManager.suggestTasks(context || {});
    res.json({ success: true, suggestions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Text to Trello endpoint
app.post('/api/text-to-trello', requireAuth, async (req, res) => {
  try {
    const { text, useAI = true } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Metin gerekli' });
    }
    
    const results = await textToTrello.processText(text, useAI);
    res.json({ 
      success: true, 
      results: results,
      stats: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Express sunucusunu başlat (geliştirme için)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.MCP_SERVER_PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Trello MCP Server HTTP API'si port ${PORT}'da çalışıyor`);
    console.log(`📝 Test için: POST http://localhost:${PORT}/api/task`);
  });
}

// MCP sunucusunu başlat
const transport = new StdioServerTransport();
console.log('🔧 Trello MCP Server başlatılıyor...');
await server.connect(transport);

console.log('✅ Trello MCP Server hazır! Doğal dil komutlarınızı bekliyor...');

export default server;
