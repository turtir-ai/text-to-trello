import { TrelloManager } from './trello-manager.js';
import { CommandProcessor } from './command-processor.js';
import { getGeminiManager } from './gemini-manager.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

export class TextToTrello {
  constructor() {
    this.trelloManager = new TrelloManager();
    this.commandProcessor = new CommandProcessor(this.trelloManager);
    this.geminiManager = getGeminiManager();
    this.boardId = process.env.DEFAULT_BOARD_ID;
  }

  /**
   * Metni analiz edip Trello görevlerine dönüştürür
   */
  async processText(text, useAI = true) {
    console.log('📝 Metin analiz ediliyor...\n');

    // 1) First try structured JSON tasks via Gemini
    if (useAI && this.geminiManager && this.geminiManager.isAvailable()) {
      try {
        const json = await this.geminiManager.generateTasksWithSchema(text);
        if (json && Array.isArray(json.tasks) && json.tasks.length > 0) {
          const results = [];
          for (const t of json.tasks) {
            const priority = (t.labels || []).find((l) => ['kritik', 'yüksek', 'normal', 'düşük'].includes(l));
            const typeLabel = (t.labels || []).find((l) => ['görev', 'proje', 'araştırma'].includes(l));
            const dueISO = t.due ? new Date(t.due).toISOString() : null;

            const card = await this.trelloManager.createCard({
              title: t.title,
              description: t.description || '',
              listName: t.listName || undefined,
              assignees: Array.isArray(t.assignees) ? t.assignees : [],
              labels: (t.labels || []).filter(Boolean),
              dueDate: dueISO,
              checklist: Array.isArray(t.checklist) ? t.checklist : [],
            });
            results.push({ success: true, card, item: { title: t.title, priority: priority || 'normal', type: typeLabel || 'görev' } });
          }
          return results;
        }
      } catch (e) {
        console.warn('⚠️ Structured tasks üretilemedi, metin tabanlı işleme geçiliyor:', e?.message);
      }
    }

    // 2) Fallback: Enhance text and parse as before
    let processedText = text;
    if (useAI && this.geminiManager && this.geminiManager.isAvailable()) {
      console.log('🤖 Gemini AI ile metin düzenleniyor...');
      try {
        const enhancedText = await this.geminiManager.processAndEnhanceText(text);
        if (enhancedText && enhancedText.trim()) {
          processedText = enhancedText;
          console.log('✅ AI düzenlemesi tamamlandı\n');
        } else {
          console.log('⚠️ AI boş yanıt döndürdü, orijinal metin kullanılıyor\n');
        }
      } catch (error) {
        console.error('⚠️ AI işleme hatası:', error.message);
        console.log('Orijinal metin kullanılıyor...\n');
      }
    } else {
      console.log('⚠️ Gemini AI kullanılamıyor - manuel işleme yapılacak\n');
    }

    // Projeleri, araştırmaları ve görevleri tanımla
    const items = this.extractItems(processedText);
    const results = [];

    for (const item of items) {
      try {
        const result = await this.createTaskFromItem(item);
        results.push(result);
      } catch (error) {
        console.error(`❌ Hata: ${item.title} - ${error.message}`);
        results.push({ success: false, error: error.message, item });
      }
    }

    return results;
  }

  /**
   * Metinden görev öğelerini çıkarır
   */
  extractItems(text) {
    const items = [];
    const lines = text.split('\n');
    
    let currentProject = null;
    let currentDescription = '';
    let isInTaskBlock = false;
    let linesSinceLastTask = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Boş satır
      if (!trimmed) {
        linesSinceLastTask++;
        // 3 boş satırdan fazlaysa mevcut görevi sonlandır
        if (linesSinceLastTask > 3 && currentProject) {
          currentProject.description = currentDescription.trim();
          items.push(currentProject);
          currentProject = null;
          currentDescription = '';
          isInTaskBlock = false;
        }
        continue;
      }
      
      linesSinceLastTask = 0;
      
      // Açık görev tanımı (PROJE:, GÖREV:, ARAŞTIRMA: ile başlayan)
      if (this.isExplicitTask(trimmed)) {
        // Önceki görevi kaydet
        if (currentProject) {
          currentProject.description = currentDescription.trim();
          items.push(currentProject);
        }
        
        currentProject = this.parseProjectLine(trimmed);
        currentDescription = '';
        isInTaskBlock = true;
      }
      // Numaralı liste elemanı (1., 2., vb.) - sadece görev bloğunda değilse
      else if (!isInTaskBlock && /^\d+\./.test(trimmed)) {
        // Önceki görevi kaydet
        if (currentProject) {
          currentProject.description = currentDescription.trim();
          items.push(currentProject);
        }
        
        // Sadece gerçek görev içeriğiyse yeni görev oluştur
        if (this.isLikelyTask(trimmed)) {
          currentProject = this.parseProjectLine(trimmed);
          currentDescription = '';
          isInTaskBlock = true;
        } else {
          // Görev değilse açıklama olarak ekle
          if (currentProject) {
            currentDescription += trimmed + '\n';
          }
        }
      }
      // Alt görev veya liste elemanı
      else if ((trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) && currentProject) {
        const subTask = trimmed.substring(1).trim();
        if (subTask) {
          if (!currentProject.subTasks) currentProject.subTasks = [];
          currentProject.subTasks.push(subTask);
        }
      }
      // Açıklama satırı
      else if (currentProject && trimmed) {
        // İndentasyon kontrolü - girintili satırlar açıklama olarak eklenir
        const indent = line.search(/\S/);
        if (indent > 0 || isInTaskBlock) {
          currentDescription += trimmed + '\n';
        }
      }
    }
    
    // Son öğeyi ekle
    if (currentProject) {
      currentProject.description = currentDescription.trim();
      items.push(currentProject);
    }

    return items;
  }

  /**
   * Açık görev tanımı mı kontrol eder (PROJE:, GÖREV: vb.)
   */
  isExplicitTask(line) {
    const patterns = [
      /^PROJE:/i,
      /^ARAŞTIRMA:/i,
      /^GÖREV:/i,
      /^TASK:/i,
      /^TODO:/i,
      /^\d+\.\s*(PROJE|ARAŞTIRMA|GÖREV|TASK|TODO):/i,
      /^-\s*(PROJE|ARAŞTIRMA|GÖREV|TASK|TODO):/i
    ];
    
    return patterns.some(pattern => pattern.test(line));
  }
  
  /**
   * Satırın görev gibi görünüp görünmediğini kontrol eder
   */
  isLikelyTask(line) {
    // Çok kısa satırlar görev değildir
    if (line.trim().length < 10) return false;
    
    // Açıklama gibi görünen satırlar
    const descriptionPatterns = [
      /^(ve|veya|ancak|fakat|ama|çünkü|because|and|or|but)/i,
      /^(bu|şu|o|bunlar|şunlar)/i,
      /[.,:;]$/  // Noktalama ile biten uzun cümleler
    ];
    
    if (descriptionPatterns.some(p => p.test(line.trim()))) {
      return false;
    }
    
    // Görev gibi görünen kelimeler
    const taskKeywords = [
      /hazırla/i, /oluştur/i, /yap/i, /kontrol et/i,
      /incele/i, /analiz/i, /tasarla/i, /geliştir/i,
      /test et/i, /düzenle/i, /güncelle/i, /ekle/i,
      /prepare/i, /create/i, /check/i, /review/i,
      /update/i, /implement/i, /design/i, /develop/i
    ];
    
    return taskKeywords.some(keyword => keyword.test(line));
  }

  /**
   * Proje satırını parse eder
   */
  parseProjectLine(line) {
    const item = {
      originalText: line,
      title: line,
      type: 'görev',
      priority: 'normal',
      assignee: null,
      labels: [],
      list: null
    };

    // Özel etiketleri çıkar
    if (/PROJE:/i.test(line)) {
      item.type = 'proje';
      item.title = line.replace(/PROJE:/i, '').trim();
      item.labels.push('proje');
    } else if (/ARAŞTIRMA:/i.test(line)) {
      item.type = 'araştırma';
      item.title = line.replace(/ARAŞTIRMA:/i, '').trim();
      item.labels.push('araştırma');
    } else if (/GÖREV:/i.test(line)) {
      item.type = 'görev';
      item.title = line.replace(/GÖREV:/i, '').trim();
    }

    // Numara prefixini kaldır
    item.title = item.title.replace(/^\d+\.\s*/, '');
    
    // Köşeli parantezleri kaldır ama etiket olarak ekle
    const bracketMatch = item.title.match(/\[(.*?)\]/);
    if (bracketMatch) {
      item.labels.push(bracketMatch[1].toLowerCase());
      item.title = item.title.replace(/\[.*?\]/, '').trim();
    }

    // Öncelik belirle (metindeki son kelime genelde öncelik)
    if (/kritik|critical/i.test(line)) {
      item.priority = 'kritik';
      item.labels.push('kritik');
    } else if (/yüksek|high|acil|urgent|önemli/i.test(line)) {
      item.priority = 'yüksek';
      item.labels.push('yüksek');
    } else if (/normal|medium|orta/i.test(line)) {
      item.priority = 'normal';
      item.labels.push('normal');
    } else if (/düşük|low|sonra/i.test(line)) {
      item.priority = 'düşük';
      item.labels.push('düşük');
    }

    // Atamalar yap (@kullanıcı) - birden fazla olabilir
    const assigneeMatches = line.match(/@\w+/g);
    if (assigneeMatches) {
      // @ işaretini kaldır ve liste olarak sakla
      item.assignees = assigneeMatches.map(a => a.substring(1));
      // Geriye uyumluluk için ilkini assignee olarak da sakla
      item.assignee = item.assignees[0];
      console.log(`  📌 Tespit edilen atamalar: ${assigneeMatches.join(', ')}`);
    }

    // Liste belirle
    if (/yapılacak|todo|bekliyor/i.test(line)) {
      item.list = 'Yapılacaklar';
    } else if (/yapılıyor|progress|devam/i.test(line)) {
      item.list = 'Yapılıyor';
    } else if (/tamamlandı|done|bitti/i.test(line)) {
      item.list = 'Tamamlandı';
    }

    return item;
  }

  /**
   * Öğeden Trello görevi oluşturur
   */
  async createTaskFromItem(item) {
    console.log(`\n🔄 İşleniyor: "${item.title}"`);
    
    // Liste bul veya varsayılan kullan
    let targetListId = null;
    if (item.list) {
      const list = await this.trelloManager.findListByName(this.boardId, item.list);
      targetListId = list?.id;
    }
    
    if (!targetListId) {
      // Varsayılan olarak "Yapılacaklar" listesini bul
      const list = await this.trelloManager.findListByName(this.boardId, 'Yapılacaklar');
      targetListId = list?.id;
      
      if (!targetListId) {
        // İlk listeyi kullan
        const boardInfo = await this.trelloManager.getBoardInfo(this.boardId);
        targetListId = boardInfo.lists[0]?.id;
      }
    }

    // Açıklama oluştur
    let description = `📝 **Otomatik oluşturuldu**: Text to Trello\n`;
    description += `📅 **Tarih**: ${new Date().toLocaleString('tr-TR')}\n`;
    description += `🏷️ **Tip**: ${item.type}\n`;
    description += `⚡ **Öncelik**: ${item.priority}\n\n`;
    
    if (item.description) {
      description += `📋 **Açıklama**:\n${item.description}\n\n`;
    }
    
    if (item.subTasks && item.subTasks.length > 0) {
      description += `✅ **Alt Görevler**:\n`;
      item.subTasks.forEach(task => {
        description += `- [ ] ${task}\n`;
      });
    }

    // Kart oluştur
    const cardData = {
      name: item.title,
      description: description,
      listId: targetListId,
      memberIds: [],
      labels: item.labels || []
    };

    // Atamalar yap (birden fazla olabilir)
    if (item.assignees && item.assignees.length > 0) {
      const memberIds = [];
      const assignedNames = [];
      
      for (const assigneeName of item.assignees) {
        const member = await this.trelloManager.findMemberByName(this.boardId, assigneeName);
        if (member) {
          memberIds.push(member.id);
          assignedNames.push(member.fullName);
        } else {
          console.log(`  ⚠️ Kullanıcı bulunamadı: @${assigneeName}`);
        }
      }
      
      if (memberIds.length > 0) {
        cardData.memberIds = memberIds;
        console.log(`  👤 Atananlar: ${assignedNames.join(', ')}`);
      }
    } else if (item.assignee) {
      // Tek atama (geriye uyumluluk)
      const member = await this.trelloManager.findMemberByName(this.boardId, item.assignee);
      if (member) {
        cardData.memberIds = [member.id];
        console.log(`  👤 Atanan: ${member.fullName}`);
      }
    }

    // Önceliğe göre tarih ekle
    if (item.priority === 'yüksek') {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 2); // 2 gün sonra
      cardData.dueDate = dueDate.toISOString();
    } else if (item.priority === 'düşük') {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7); // 1 hafta sonra
      cardData.dueDate = dueDate.toISOString();
    }

    const card = await this.trelloManager.createCard(cardData);
    
    console.log(`  ✅ Kart oluşturuldu: ${card.url}`);
    
    return {
      success: true,
      card: card,
      item: item
    };
  }

  /**
   * Dosyadan metin okur ve işler
   */
  async processFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      console.log(`📁 Dosya okundu: ${filePath}\n`);
      return await this.processText(content);
    } catch (error) {
      console.error(`❌ Dosya okuma hatası: ${error.message}`);
      throw error;
    }
  }

  /**
   * Özel format için şablon işleyici
   */
  async processResearchProjects(data) {
    const results = [];
    
    for (const project of data.projects || []) {
      const item = {
        title: project.name,
        type: 'araştırma',
        priority: this.calculatePriority(project.score),
        labels: ['araştırma', project.category || 'genel'],
        description: this.formatProjectDescription(project),
        assignee: project.assigned || null
      };

      try {
        const result = await this.createTaskFromItem(item);
        results.push(result);
      } catch (error) {
        console.error(`❌ Proje oluşturma hatası: ${project.name}`, error);
        results.push({ success: false, error: error.message, project });
      }
    }

    return results;
  }

  /**
   * Skor bazlı öncelik hesapla
   */
  calculatePriority(score) {
    if (score >= 80) return 'yüksek';
    if (score >= 50) return 'normal';
    return 'düşük';
  }

  /**
   * Proje açıklaması formatla
   */
  formatProjectDescription(project) {
    let desc = '';
    
    if (project.description) {
      desc += `${project.description}\n\n`;
    }
    
    if (project.score !== undefined) {
      desc += `📊 **Güven Skoru**: ${project.score}/100\n`;
    }
    
    if (project.team) {
      desc += `👥 **Ekip**: ${project.team}\n`;
    }
    
    if (project.funding) {
      desc += `💰 **Finansman**: ${project.funding}\n`;
    }
    
    if (project.timeline) {
      desc += `⏱️ **Zaman Çizelgesi**: ${project.timeline}\n`;
    }
    
    if (project.notes) {
      desc += `\n📝 **Notlar**:\n${project.notes}\n`;
    }
    
    return desc;
  }
}

// CLI kullanımı için
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  const textToTrello = new TextToTrello();
  
  // Komut satırı argümanları
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
📋 Text to Trello - Kullanım:

  node text-to-trello.js <metin>
  node text-to-trello.js --file <dosya_yolu>
  node text-to-trello.js --interactive

Örnekler:
  node text-to-trello.js "PROJE: Website Yenileme"
  node text-to-trello.js --file projeler.txt
  node text-to-trello.js --interactive
    `);
  } else if (args[0] === '--file' && args[1]) {
    // Dosyadan oku
    textToTrello.processFile(args[1])
      .then(results => {
        console.log('\n📊 Sonuçlar:');
        console.log(`✅ Başarılı: ${results.filter(r => r.success).length}`);
        console.log(`❌ Başarısız: ${results.filter(r => !r.success).length}`);
      })
      .catch(console.error);
  } else if (args[0] === '--interactive') {
    // İnteraktif mod
    console.log('📝 Metin girin (çıkmak için "exit" yazın):');
    
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });
    
    let buffer = '';
    
    rl.prompt();
    
    rl.on('line', async (line) => {
      if (line.toLowerCase() === 'exit') {
        if (buffer) {
          const results = await textToTrello.processText(buffer);
          console.log(`\n✅ ${results.filter(r => r.success).length} görev oluşturuldu`);
        }
        rl.close();
        return;
      }
      
      if (line.toLowerCase() === 'process' && buffer) {
        const results = await textToTrello.processText(buffer);
        console.log(`\n✅ ${results.filter(r => r.success).length} görev oluşturuldu`);
        buffer = '';
      } else {
        buffer += line + '\n';
      }
      
      rl.prompt();
    });
  } else {
    // Direkt metin işle
    const text = args.join(' ');
    textToTrello.processText(text)
      .then(results => {
        console.log('\n✅ İşlem tamamlandı!');
      })
      .catch(console.error);
  }
}
