export class CommandProcessor {
  constructor(trelloManager) {
    this.trelloManager = trelloManager;
    
    // Türkçe komut kalıpları
    this.patterns = {
      createTask: [
        /(.+?)\s*(?:'ya|'ye|'a|'e|için)\s*(.+?)\s*(?:görev|kart|task|iş)\s*(?:oluştur|ekle|yap|at)/i,
        /(.+?)\s*(?:görev|kart|task|iş)\s*(?:oluştur|ekle|yap|at).*?(?:'ya|'ye|'a|'e|için)\s*(.+)/i,
        /(?:yeni|new)\s*(.+?)\s*(?:görev|kart|task|iş).*?(?:'ya|'ye|'a|'e|için)\s*(.+)/i,
        /(.+?)\s*(?:proje|project).*?(?:'ya|'ye|'a|'e|için)\s*(.+)/i
      ],
      assignTask: [
        /(.+?)\s*(?:kart|görev).*?(?:'ya|'ye|'a|'e|için)\s*(.+?)\s*(?:ata|assign)/i,
        /(.+?)\s*(?:'ya|'ye|'a|'e|için)\s*(.+?)\s*(?:kart|görev).*?(?:ata|assign)/i,
        /(?:ata|assign)\s*(.+?)\s*(?:kart|görev).*?(?:'ya|'ye|'a|'e|için)\s*(.+)/i
      ],
      memberNames: [
        /(?:'ya|'ye|'a|'e|için)\s*([a-zA-ZçğıöşüÇĞIİÖŞÜ\s]+?)(?:\s|$)/i,
        /(?:@|@\s*)([a-zA-ZçğıöşüÇĞIİÖŞÜ\s]+?)(?:\s|$)/i
      ],
      listNames: [
        /(?:liste|list)[:=\s]*([a-zA-ZçğıöşüÇĞIİÖŞÜ\s]+?)(?:\s|$)/i,
        /(?:yapılacak|todo|backlog|yapılıyor|progress|yapıldı|done)/i
      ],
      priority: [
        /(?:yüksek|high|acil|urgent|önemli|important)/i,
        /(?:orta|medium|normal)/i,
        /(?:düşük|low)/i
      ],
      labels: [
        /(?:etiket|label|tag)[:=\s]*([a-zA-ZçğıöşüÇĞIİÖŞÜ\s,]+?)(?:\s|$)/i,
        /(?:kategori|category)[:=\s]*([a-zA-ZçğıöşüÇĞIİÖŞÜ\s]+?)(?:\s|$)/i
      ]
    };
  }

  /**
   * Görev oluşturma komutunu işler
   */
  async processCreateTaskCommand(command, boardId = null) {
    try {
      console.log(`🔍 Komut analiz ediliyor: "${command}"`);
      
      // Pano ID'sini belirle
      const targetBoardId = boardId || this.trelloManager.getDefaultBoardId();
      
      // Komuttan bilgileri çıkar
      const taskInfo = this.extractTaskInfo(command);
      
      if (!taskInfo.name) {
        return {
          success: false,
          error: 'Görev adı belirlenemedi. Lütfen daha açık bir komut yazın.'
        };
      }

      // Pano bilgilerini al
      const boardInfo = await this.trelloManager.getBoardInfo(targetBoardId);
      
      // Üyeleri bul
      const memberIds = [];
      const assignedMembers = [];
      
      for (const memberName of taskInfo.assignedTo) {
        const member = await this.trelloManager.findMemberByName(targetBoardId, memberName);
        if (member) {
          memberIds.push(member.id);
          assignedMembers.push(member.fullName);
          console.log(`👤 Üye bulundu: ${memberName} -> ${member.fullName}`);
        } else {
          console.log(`⚠️ Üye bulunamadı: ${memberName}`);
        }
      }

      // Liste belirle
      let targetList = null;
      if (taskInfo.listName) {
        targetList = await this.trelloManager.findListByName(targetBoardId, taskInfo.listName);
      }
      
      // Liste bulunamazsa varsayılan listeyi seç
      if (!targetList) {
        // Önce "Yapılacak" tipinde liste ara
        targetList = boardInfo.lists.find(l => 
          l.name.toLowerCase().includes('yapılacak') ||
          l.name.toLowerCase().includes('todo') ||
          l.name.toLowerCase().includes('backlog')
        );
        
        // Bulunamazsa ilk listeyi seç
        if (!targetList) {
          targetList = boardInfo.lists[0];
        }
      }

      if (!targetList) {
        return {
          success: false,
          error: 'Hedef liste bulunamadı. Panoda hiç liste yok.'
        };
      }

      // Kartı oluştur
      const cardData = {
        name: taskInfo.name,
        description: taskInfo.description || this.generateDescription(taskInfo, command),
        listId: targetList.id,
        memberIds: memberIds,
        labels: taskInfo.labels
      };

      // Öncelik varsa tarih ekle
      if (taskInfo.priority) {
        cardData.dueDate = this.calculateDueDate(taskInfo.priority);
      }

      const card = await this.trelloManager.createCard(cardData);

      // Başarı yorumu ekle
      if (memberIds.length > 0) {
        const comment = `🤖 Bu görev MCP sistemi tarafından otomatik olarak oluşturuldu.\n📝 Komut: "${command}"\n👥 Atanan: ${assignedMembers.join(', ')}`;
        await this.trelloManager.addCommentToCard(card.id, comment);
      }

      return {
        success: true,
        card: card,
        list: targetList.name,
        assignedMembers: assignedMembers,
        boardName: boardInfo.name
      };

    } catch (error) {
      console.error('Görev oluşturma hatası:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Görev atama komutunu işler
   */
  async processAssignTaskCommand(command, boardId = null) {
    try {
      console.log(`🔍 Atama komutu analiz ediliyor: "${command}"`);
      
      // Pano ID'sini belirle
      const targetBoardId = boardId || this.trelloManager.getDefaultBoardId();
      
      // Komuttan bilgileri çıkar
      const assignInfo = this.extractAssignInfo(command);
      
      if (!assignInfo.cardName || !assignInfo.memberName) {
        return {
          success: false,
          error: 'Kart adı veya üye adı belirlenemedi. Örnek: "Proje X kartını Ziya\'ya ata"'
        };
      }

      // Kartı bul
      const card = await this.trelloManager.findCardByName(assignInfo.cardName, targetBoardId);
      if (!card) {
        return {
          success: false,
          error: `"${assignInfo.cardName}" adında kart bulunamadı.`
        };
      }

      // Üyeyi bul
      const member = await this.trelloManager.findMemberByName(targetBoardId, assignInfo.memberName);
      if (!member) {
        return {
          success: false,
          error: `"${assignInfo.memberName}" adında üye bulunamadı.`
        };
      }

      // Üyeyi ata
      await this.trelloManager.assignMemberToCard(card.id, member.id);

      // Atama yorumu ekle
      const comment = `🤖 ${member.fullName} bu göreve MCP sistemi tarafından atandı.\n📝 Komut: "${command}"`;
      await this.trelloManager.addCommentToCard(card.id, comment);

      return {
        success: true,
        card: card,
        assignedTo: member.fullName
      };

    } catch (error) {
      console.error('Görev atama hatası:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Komuttan görev bilgilerini çıkarır
   */
  extractTaskInfo(command) {
    const taskInfo = {
      name: null,
      assignedTo: [],
      listName: null,
      priority: null,
      labels: [],
      description: null
    };

    // Görev adını çıkar
    taskInfo.name = this.extractTaskName(command);

    // Atanan kişileri çıkar
    taskInfo.assignedTo = this.extractAssignedMembers(command);

    // Liste adını çıkar
    taskInfo.listName = this.extractListName(command);

    // Önceliği çıkar
    taskInfo.priority = this.extractPriority(command);

    // Etiketleri çıkar
    taskInfo.labels = this.extractLabels(command);

    // Açıklama çıkar
    taskInfo.description = this.extractDescription(command);

    return taskInfo;
  }

  /**
   * Görev adını çıkarır
   */
  extractTaskName(command) {
    // Farklı kalıpları dene
    const patterns = [
      /["']([^"']+)["']/,  // Tırnak içindeki metin
      /(?:yeni|new)\s+([^']+?)(?:\s+(?:görev|kart|task|iş)|$)/i,  // "yeni X görev"
      /([^']+?)(?:\s+(?:görev|kart|task|iş))/i,  // "X görev"
      /([^']+?)(?:\s+(?:'ya|'ye|'a|'e|için))/i,  // "X için"
      /([^']+?)(?:\s+proje)/i  // "X proje"
    ];

    for (const pattern of patterns) {
      const match = command.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Son çare olarak ilk kelime grubunu al
    const words = command.split(/\s+/);
    if (words.length > 0) {
      // "Görev", "kart" gibi kelimeler öncesindeki kısmı al
      const stopWords = ['görev', 'kart', 'task', 'iş', 'proje', 'için', 'ya', 'ye'];
      const taskWords = [];
      
      for (const word of words) {
        if (stopWords.some(sw => word.toLowerCase().includes(sw.toLowerCase()))) {
          break;
        }
        taskWords.push(word);
      }
      
      if (taskWords.length > 0) {
        return taskWords.join(' ').trim();
      }
    }

    return null;
  }

  /**
   * Atanan üyeleri çıkarır
   */
  extractAssignedMembers(command) {
    const members = [];

    // @ işaretli üyeler
    const atMatches = command.match(/@([a-zA-ZçğıöşüÇĞIİÖŞÜ\s]+?)(?:\s|,|$)/gi);
    if (atMatches) {
      atMatches.forEach(match => {
        const name = match.replace('@', '').trim();
        if (name) members.push(name);
      });
    }

    // 'ya, 'ye ekleriyle üyeler
    const suffixPatterns = [
      /(?:'ya|'ye|'a|'e|için)\s+([a-zA-ZçğıöşüÇĞIİÖŞÜ\s]+?)(?:\s+(?:ata|görev|kart|task)|$)/i
    ];

    suffixPatterns.forEach(pattern => {
      const match = command.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name && !members.includes(name)) {
          members.push(name);
        }
      }
    });

    return members.map(m => m.toLowerCase());
  }

  /**
   * Liste adını çıkarır
   */
  extractListName(command) {
    // Açık liste belirtimi
    const listMatch = command.match(/(?:liste|list)[:=\s]*([a-zA-ZçğıöşüÇĞIİÖŞÜ\s]+?)(?:\s|$)/i);
    if (listMatch && listMatch[1]) {
      return listMatch[1].trim();
    }

    // Yaygın liste isimleri
    const listKeywords = [
      { keywords: ['yapılacak', 'todo', 'backlog'], name: 'yapılacak' },
      { keywords: ['yapılıyor', 'progress', 'devam'], name: 'yapılıyor' },
      { keywords: ['yapıldı', 'done', 'tamamlandı'], name: 'yapıldı' },
      { keywords: ['test', 'testing'], name: 'test' },
      { keywords: ['review', 'inceleme', 'gözden geçirme'], name: 'review' }
    ];

    for (const listGroup of listKeywords) {
      for (const keyword of listGroup.keywords) {
        if (command.toLowerCase().includes(keyword)) {
          return listGroup.name;
        }
      }
    }

    return null;
  }

  /**
   * Öncelik çıkarır
   */
  extractPriority(command) {
    if (/(?:yüksek|high|acil|urgent|önemli|important)/i.test(command)) {
      return 'yüksek';
    }
    if (/(?:orta|medium|normal)/i.test(command)) {
      return 'orta';
    }
    if (/(?:düşük|low)/i.test(command)) {
      return 'düşük';
    }
    return null;
  }

  /**
   * Etiketleri çıkarır
   */
  extractLabels(command) {
    const labels = [];

    // Açık etiket belirtimi
    const labelMatch = command.match(/(?:etiket|label|tag)[:=\s]*([a-zA-ZçğıöşüÇĞIİÖŞÜ\s,]+?)(?:\s|$)/i);
    if (labelMatch && labelMatch[1]) {
      const labelNames = labelMatch[1].split(',').map(l => l.trim()).filter(l => l);
      labels.push(...labelNames);
    }

    // Kategori belirtimi
    const categoryMatch = command.match(/(?:kategori|category)[:=\s]*([a-zA-ZçğıöşüÇĞIİÖŞÜ\s]+?)(?:\s|$)/i);
    if (categoryMatch && categoryMatch[1]) {
      labels.push(categoryMatch[1].trim());
    }

    // Otomatik etiketler (öncelik, proje tipi vb.)
    const priority = this.extractPriority(command);
    if (priority) {
      labels.push(priority + ' öncelik');
    }

    if (/(?:proje|project)/i.test(command)) {
      labels.push('proje');
    }

    if (/(?:araştırma|research)/i.test(command)) {
      labels.push('araştırma');
    }

    if (/(?:geliştirme|development|dev)/i.test(command)) {
      labels.push('geliştirme');
    }

    return [...new Set(labels)]; // Dublörleri kaldır
  }

  /**
   * Açıklama çıkarır
   */
  extractDescription(command) {
    // Açıklama belirtimi
    const descPatterns = [
      /(?:açıklama|description)[:=\s]*([^.!?]+)/i,
      /(?:detay|detail)[:=\s]*([^.!?]+)/i,
      /(?:not|note)[:=\s]*([^.!?]+)/i
    ];

    for (const pattern of descPatterns) {
      const match = command.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Atama bilgilerini çıkarır
   */
  extractAssignInfo(command) {
    const assignInfo = {
      cardName: null,
      memberName: null
    };

    // Farklı atama kalıplarını dene
    const assignPatterns = [
      /["']([^"']+)["'].*?(?:'ya|'ye|'a|'e|için)\s*([a-zA-ZçğıöşüÇĞIİÖŞÜ\s]+?)\s*(?:ata|assign)/i,
      /([^\s]+.*?)\s*(?:kart|görev).*?(?:'ya|'ye|'a|'e|için)\s*([a-zA-ZçğıöşüÇĞIİÖŞÜ\s]+?)\s*(?:ata|assign)/i,
      /([^\s]+.*?)\s*(?:'ya|'ye|'a|'e|için)\s*([a-zA-ZçğıöşüÇĞIİÖŞÜ\s]+?)\s*(?:ata|assign)/i
    ];

    for (const pattern of assignPatterns) {
      const match = command.match(pattern);
      if (match && match[1] && match[2]) {
        assignInfo.cardName = match[1].trim();
        assignInfo.memberName = match[2].trim().toLowerCase();
        break;
      }
    }

    return assignInfo;
  }

  /**
   * Önceliğe göre son tarih hesaplar
   */
  calculateDueDate(priority) {
    const now = new Date();
    const days = {
      'yüksek': 1,
      'orta': 3,
      'düşük': 7
    };

    const dueDate = new Date(now);
    dueDate.setDate(now.getDate() + (days[priority] || 3));
    
    return dueDate.toISOString();
  }

  /**
   * Otomatik açıklama oluşturur
   */
  generateDescription(taskInfo, originalCommand) {
    let description = `🤖 **MCP Sistemi Tarafından Otomatik Oluşturuldu**\n\n`;
    description += `📝 **Orijinal Komut:** "${originalCommand}"\n\n`;
    
    if (taskInfo.assignedTo.length > 0) {
      description += `👥 **Atanan Kişiler:** ${taskInfo.assignedTo.join(', ')}\n`;
    }
    
    if (taskInfo.priority) {
      description += `⚡ **Öncelik:** ${taskInfo.priority.toUpperCase()}\n`;
    }
    
    if (taskInfo.labels.length > 0) {
      description += `🏷️ **Etiketler:** ${taskInfo.labels.join(', ')}\n`;
    }
    
    description += `\n📅 **Oluşturulma Zamanı:** ${new Date().toLocaleString('tr-TR')}\n`;
    
    if (taskInfo.description) {
      description += `\n📋 **Ek Bilgiler:**\n${taskInfo.description}`;
    }

    return description;
  }
}
