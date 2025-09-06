import axios from 'axios';
import dotenv from 'dotenv';
import Bottleneck from 'bottleneck';
import { getBoardMembers, getBoardLabels } from './trello-metadata.js';
import { mapAssigneesToIds, mapLabelsToIds } from './mapping-helpers.js';
import { findPossibleDuplicate } from './dupe-guard.js';

dotenv.config();

export class TrelloManager {
  constructor() {
    this.apiKey = process.env.TRELLO_API_KEY;
    this.token = process.env.TRELLO_TOKEN;
    this.defaultBoardId = process.env.DEFAULT_BOARD_ID;
    this.baseURL = 'https://api.trello.com/1';
    
    if (!this.apiKey || !this.token) {
      throw new Error('Trello API anahtarı veya token bulunamadı! .env dosyasını kontrol edin.');
    }
    
    // Axios varsayılan yapılandırma
    this.axiosConfig = {
      baseURL: this.baseURL,
      params: {
        key: this.apiKey,
        token: this.token
      }
    };

    // Rate limiters
    this.generalLimiter = new Bottleneck({
      reservoir: 90,
      reservoirRefreshInterval: 10_000,
      reservoirRefreshAmount: 90,
      minTime: 120,
    });
    this.membersLimiter = new Bottleneck({
      reservoir: 95,
      reservoirRefreshInterval: 900_000,
      reservoirRefreshAmount: 95,
      minTime: 9_000,
    });
    
    console.log('✅ Trello API bağlantısı hazır');
  }

  /**
   * Trello API isteği yapar (Bottleneck ile oran-limit güvenliği)
   */
  async makeRequest(method, endpoint, data = {}) {
    const config = {
      ...this.axiosConfig,
      method: method.toLowerCase(),
      url: endpoint,
    };
    if (method.toLowerCase() === 'get') {
      config.params = { ...config.params, ...data };
    } else {
      config.data = data;
    }

    const limiter = endpoint.startsWith('/members') ? this.membersLimiter : this.generalLimiter;

    // Retry on 429 with basic exponential backoff
    let attempt = 0;
    const maxAttempts = 3;
    // schedule within limiter
    const exec = async () => {
      try {
        const response = await axios(config);
        return response.data;
      } catch (error) {
        const status = error?.response?.status;
        if (status === 429 && attempt < maxAttempts) {
          const delay = 500 * Math.pow(2, attempt);
          attempt += 1;
          await new Promise((r) => setTimeout(r, delay));
          return exec();
        }
        console.error(`API İsteği Hatası: ${method} ${endpoint}`, error.response?.data || error.message);
        throw new Error(error.response?.data?.message || error.message);
      }
    };
    return limiter.schedule(exec);
  }

  /**
   * Tüm erişilebilir panoları getirir
   */
  async getBoards() {
    try {
      const boards = await this.makeRequest('GET', '/members/me/boards');
      return boards.filter(board => !board.closed).map(board => ({
        id: board.id,
        name: board.name,
        url: board.url,
        closed: board.closed
      }));
    } catch (error) {
      console.error('Panolar alınırken hata:', error);
      throw new Error(`Trello panolarına erişim hatası: ${error.message}`);
    }
  }

  /**
   * Belirli bir panonun detaylı bilgilerini getirir
   */
  async getBoardInfo(boardId) {
    try {
      const board = await this.makeRequest('GET', `/boards/${boardId}`);
      const lists = await this.makeRequest('GET', `/boards/${boardId}/lists`);
      const members = await this.makeRequest('GET', `/boards/${boardId}/members`);
      
      return {
        id: board.id,
        name: board.name,
        url: board.url,
        lists: lists.map(list => ({
          id: list.id,
          name: list.name,
          position: list.pos,
          closed: list.closed
        })),
        members: members.map(member => ({
          id: member.id,
          username: member.username,
          fullName: member.fullName,
          avatarUrl: member.avatarUrl
        }))
      };
    } catch (error) {
      console.error('Pano bilgileri alınırken hata:', error);
      throw new Error(`Pano bilgisi alınamadı: ${error.message}`);
    }
  }

  /**
   * Kullanıcı adından üye ID'si bulur
   */
  async findMemberByName(boardId, memberName) {
    try {
      const members = await this.makeRequest('GET', `/boards/${boardId}/members`);
      
      // Debug için mevcut üyeleri logla
      if (members.length === 0) {
        console.log(`  ⚠️ Panoda hiç üye yok!`);
        return null;
      }
      
      console.log(`  🔍 Panodaki üyeler (${members.length}): ${members.map(m => `@${m.username}`).join(', ')}`);
      console.log(`  🔍 Aranan kullanıcı: @${memberName}`);
      
      // Kullanıcı adı haritaları (sizin projenize özel)
      const userMappings = {
        'ziyaeyuboglu': ['ziya', 'ziyaeyuboglu', 'ziyaeyu'],
        'infoalieweb3': ['berkay', 'infoalieweb3', 'infoalie', 'alieweb3'],
        'alkannakliyat': ['tuncer', 'alkannakliyat', 'alkann']
      };
      
      // Önce haritalarda ara
      let targetUsername = memberName.toLowerCase();
      for (const [actualUsername, aliases] of Object.entries(userMappings)) {
        if (aliases.includes(memberName.toLowerCase())) {
          targetUsername = actualUsername;
          console.log(`  🔄 Haritalama bulundu: ${memberName} -> ${actualUsername}`);
          break;
        }
      }
      
      // Tam eşleşme önce (username)
      let member = members.find(m => m.username.toLowerCase() === targetUsername);
      
      // Username bulunamazsa fullName'de ara
      if (!member) {
        member = members.find(m => 
          m.fullName && (
            m.fullName.toLowerCase() === targetUsername ||
            m.fullName.toLowerCase().includes(targetUsername)
          )
        );
      }
      
      // Hala bulunamazsa kısmi eşleşme dene
      if (!member) {
        member = members.find(m => 
          m.username.toLowerCase().includes(targetUsername) ||
          (m.fullName && m.fullName.toLowerCase().split(' ').some(part => 
            part.startsWith(targetUsername)
          ))
        );
      }
      
      if (member) {
        console.log(`  ✅ Eşleşme bulundu: @${memberName} -> @${member.username} (${member.fullName || 'Ad yok'})`);
      } else {
        console.log(`  ❌ Eşleşme bulunamadı: @${memberName}`);
        console.log(`     💡 İpucu: Trello'da bu kullanıcıları panonuza eklemeyi unutmayın!`);
      }
      
      return member || null;
    } catch (error) {
      console.error('Üye aranırken hata:', error);
      return null;
    }
  }

  /**
   * Liste adından liste ID'si bulur
   */
  async findListByName(boardId, listName) {
    try {
      const lists = await this.makeRequest('GET', `/boards/${boardId}/lists`);
      
      // Tam eşleşme veya kısmi eşleşme ara
      const list = lists.find(l => 
        l.name.toLowerCase().includes(listName.toLowerCase()) ||
        listName.toLowerCase().includes(l.name.toLowerCase())
      );
      
      return list || null;
    } catch (error) {
      console.error('Liste aranırken hata:', error);
      return null;
    }
  }

  /**
   * Yeni kart oluşturur
   */
  async createCard(cardData) {
    try {
      const {
        // Backward-compat fields
        name,
        description = '',
        listId,
        memberIds = [],
        labels = [],
        dueDate = null,
        // Enhanced fields (optional)
        title,
        listName,
        assignees = [], // ['@handle']
        checklist = []
      } = cardData;

      const finalTitle = title || name;
      if (!finalTitle) {
        throw new Error('Kart adı (title/name) gerekli');
      }

      // Resolve target list
      let targetListId = listId;
      if (!targetListId) {
        if (listName) {
          const list = await this.findListByName(this.getDefaultBoardId(), listName);
          targetListId = list?.id;
        }
        if (!targetListId) {
          const boardInfo = await this.getBoardInfo(this.getDefaultBoardId());
          targetListId = boardInfo.lists[0]?.id;
        }
      }
      if (!targetListId) throw new Error('Hedef liste bulunamadı');

      // Dupe guard by title + due date (day-level)
      const possibleDupe = await findPossibleDuplicate({
        boardId: this.getDefaultBoardId(),
        title: finalTitle,
        due: dueDate,
        key: this.apiKey,
        token: this.token,
      });
      if (possibleDupe?.isDuplicate) {
        console.log(`↩️  Mevcut kart bulundu, yeniden oluşturulmadı: ${possibleDupe.url}`);
        return possibleDupe;
      }

      // Map assignees and labels to IDs if not already provided
      let idMembers = memberIds;
      if ((!idMembers || idMembers.length === 0) && assignees && assignees.length > 0) {
        const members = await getBoardMembers({
          boardId: this.getDefaultBoardId(),
          key: this.apiKey,
          token: this.token,
        });
        idMembers = mapAssigneesToIds({ assignees, boardMembers: members });
      }
      let idLabels = [];
      if (labels && labels.length > 0) {
        const labelsMeta = await getBoardLabels({
          boardId: this.getDefaultBoardId(),
          key: this.apiKey,
          token: this.token,
        });
        idLabels = mapLabelsToIds({ labels, boardLabels: labelsMeta });
      }

      const cardParams = {
        name: finalTitle,
        desc: description,
        idList: targetListId,
        pos: 'top',
      };

      if (idMembers && idMembers.length > 0) {
        cardParams.idMembers = idMembers.join(',');
      }
      if (idLabels && idLabels.length > 0) {
        cardParams.idLabels = idLabels.join(',');
      }
      if (dueDate) {
        cardParams.due = dueDate;
      }

      const card = await this.makeRequest('POST', '/cards', cardParams);

      // If we couldn't map labels to IDs, fallback to creating by name
      if ((idLabels?.length || 0) === 0 && labels.length > 0) {
        for (const label of labels) {
          await this.addLabelToCard(card.id, label);
        }
      }

      // Checklist items (each POST separately)
      if (checklist && checklist.length > 0) {
        const checklistResp = await this.makeRequest('POST', `/cards/${card.id}/checklists`, { name: 'Kontrol Listesi' });
        for (const item of checklist) {
          await this.makeRequest('POST', `/checklists/${checklistResp.id}/checkItems`, { name: item });
        }
      }

      console.log(`✅ Kart oluşturuldu: ${card.name} (ID: ${card.id})`);
      return card;
    } catch (error) {
      console.error('Kart oluşturulurken hata:', error);
      throw new Error(`Kart oluşturulamadı: ${error.message}`);
    }
  }

  /**
   * Kartı günceller
   */
  async updateCard(cardId, updates) {
    try {
      const card = await this.makeRequest('PUT', `/cards/${cardId}`, updates);
      console.log(`✅ Kart güncellendi: ${cardId}`);
      return card;
    } catch (error) {
      console.error('Kart güncellenirken hata:', error);
      throw new Error(`Kart güncellenemedi: ${error.message}`);
    }
  }

  /**
   * Karta üye atar
   */
  async assignMemberToCard(cardId, memberId) {
    try {
      await this.makeRequest('POST', `/cards/${cardId}/members`, { value: memberId });
      console.log(`✅ Üye atandı: ${memberId} -> ${cardId}`);
      return true;
    } catch (error) {
      console.error('Üye atanırken hata:', error);
      throw new Error(`Üye atanamadı: ${error.message}`);
    }
  }

  /**
   * Karttan üyeyi kaldırır
   */
  async removeMemberFromCard(cardId, memberId) {
    try {
      await this.makeRequest('DELETE', `/cards/${cardId}/members/${memberId}`);
      console.log(`✅ Üye kaldırıldı: ${memberId} <- ${cardId}`);
      return true;
    } catch (error) {
      console.error('Üye kaldırılırken hata:', error);
      throw new Error(`Üye kaldırılamadı: ${error.message}`);
    }
  }

  /**
   * Karta etiket ekler
   */
  async addLabelToCard(cardId, labelName) {
    try {
      // Önce kartın panosunu bul
      const card = await this.makeRequest('GET', `/cards/${cardId}`);
      const boardLabels = await this.makeRequest('GET', `/boards/${card.idBoard}/labels`);
      
      // Etiket var mı kontrol et
      let label = boardLabels.find(l => 
        l.name.toLowerCase() === labelName.toLowerCase()
      );
      
      // Etiket yoksa oluştur
      if (!label) {
        label = await this.makeRequest('POST', '/labels', {
          name: labelName,
          color: this.getRandomLabelColor(),
          idBoard: card.idBoard
        });
      }
      
      // Etiketi karta ekle
      await this.makeRequest('POST', `/cards/${cardId}/idLabels`, { value: label.id });
      console.log(`✅ Etiket eklendi: ${labelName} -> ${cardId}`);
      
      return label;
    } catch (error) {
      console.error('Etiket eklenirken hata:', error);
      // Etiket ekleme başarısız olsa da devam et
      return null;
    }
  }

  /**
   * Kartları arar
   */
  async searchCards(query, boardId = null) {
    try {
      let searchQuery = query;
      
      // Eğer pano ID'si verilmişse, aramayı o pano ile sınırla
      if (boardId) {
        searchQuery = `${query} board:${boardId}`;
      }
      
      const results = await this.makeRequest('GET', '/search', {
        query: searchQuery,
        cards_limit: 50
      });
      
      return results.cards || [];
    } catch (error) {
      console.error('Kart aranırken hata:', error);
      return [];
    }
  }

  /**
   * Kart adından kart bulur
   */
  async findCardByName(cardName, boardId) {
    try {
      const cards = await this.searchCards(cardName, boardId);
      
      // Tam eşleşme veya kısmi eşleşme ara
      const card = cards.find(c => 
        c.name.toLowerCase().includes(cardName.toLowerCase()) ||
        cardName.toLowerCase().includes(c.name.toLowerCase())
      );
      
      return card || null;
    } catch (error) {
      console.error('Kart aranırken hata:', error);
      return null;
    }
  }

  /**
   * Kartı başka listeye taşır
   */
  async moveCard(cardId, newListId) {
    try {
      const card = await this.makeRequest('PUT', `/cards/${cardId}`, {
        idList: newListId
      });
      
      console.log(`✅ Kart taşındı: ${cardId} -> ${newListId}`);
      return card;
    } catch (error) {
      console.error('Kart taşınırken hata:', error);
      throw new Error(`Kart taşınamadı: ${error.message}`);
    }
  }

  /**
   * Karta yorum ekler
   */
  async addCommentToCard(cardId, comment) {
    try {
      const result = await this.makeRequest('POST', `/cards/${cardId}/actions/comments`, {
        text: comment
      });
      console.log(`✅ Yorum eklendi: ${cardId}`);
      return result;
    } catch (error) {
      console.error('Yorum eklenirken hata:', error);
      throw new Error(`Yorum eklenemedi: ${error.message}`);
    }
  }

  /**
   * Rastgele etiket rengi seçer
   */
  getRandomLabelColor() {
    const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'lime', 'sky', 'black'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Liste adlarını normalize eder (Türkçe karakter desteği)
   */
  normalizeListName(listName) {
    const mapping = {
      'yapilacak': 'yapılacak',
      'yapilacaklar': 'yapılacak',
      'to do': 'yapılacak',
      'todo': 'yapılacak',
      'backlog': 'yapılacak',
      'yapiliyor': 'yapılıyor',
      'in progress': 'yapılıyor',
      'progress': 'yapılıyor',
      'devam eden': 'yapılıyor',
      'yapildi': 'yapıldı',
      'yapilmis': 'yapıldı',
      'done': 'yapıldı',
      'completed': 'yapıldı',
      'tamamlandi': 'yapıldı',
      'bitti': 'yapıldı'
    };

    const normalized = listName.toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c');

    return mapping[normalized] || listName;
  }

  /**
   * Varsayılan pano ID'sini al
   */
  getDefaultBoardId() {
    if (!this.defaultBoardId || this.defaultBoardId === 'your_board_id_here') {
      throw new Error('Varsayılan pano ID ayarlanmamış! .env dosyasında DEFAULT_BOARD_ID değerini gúncelleyin.');
    }
    return this.defaultBoardId;
  }
}
