import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

export class GeminiManager {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    this.isConfigured = false;
    
    if (!this.apiKey || this.apiKey === 'your_gemini_api_key_here') {
      console.log('⚠️ Gemini API key yapılandırılmamış - AI özelliği devre dışı');
      return;
    }
    
    try {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ model: this.modelName });
      this.isConfigured = true;
      console.log('✅ Gemini AI bağlantısı hazır - HER ZAMAN AKTİF');
    } catch (error) {
      console.error('❌ Gemini AI başlatma hatası:', error.message);
    }
  }
  
  /**
   * Gemini'nin kullanılabilir olup olmadığını kontrol eder
   */
  isAvailable() {
    return this.isConfigured && this.model !== undefined;
  }

  /**
   * Metni analiz edip Trello görev formatına dönüştürür
   */
  async processAndEnhanceText(text) {
    if (!this.isConfigured) {
      console.log('⚠️ Gemini AI yapılandırılmamış - orijinal metin kullanılıyor');
      return this.smartFallbackProcessing(text);
    }

    const prompt = `
Sen bir proje yöneticisi asistanısın. Aşağıdaki metni analiz edip Trello görev kartlarına dönüştür.

ÖNEMLİ KURALLAR:
1. HER ANA BAŞLIĞI MUTLAKA "PROJE:", "ARAŞTIRMA:", "GÖREV:", "TODO:" veya "TASK:" ile başlat
2. Normal metin satırlarını GÖREV YAPMA, sadece gerçek görevleri tanımla
3. ATAMALAR VE ÖNCELİK SİRASİ (ALTIN KURAL):
   - Önce görev başlığı
   - Sonra @kullanıcı atamaları (birden fazla olabilir)
   - En son öncelik kelimesi (Kritik, Yüksek, Normal, Düşük)
   Örnek: GÖREV: Toplantı planlama @ziyaeyuboglu @infoalieweb3 Kritik
4. KULLANICI ATAMALARI:
   - Ziya için: @ziyaeyuboglu
   - Berkay için: @infoalieweb3
   - Tuncer için: @alkannakliyat
5. ÖNCELİK KELİMELERİ (sadece bunları kullan):
   - En yüksek: Kritik
   - Yüksek: Yüksek
   - Orta: Normal
   - Düşük: Düşük
6. Alt görevleri - ile başlat ve girintili yaz
7. Açıklamaları görev satırından sonra girintili olarak ekle
8. Her görev arasına boş satır koy

ÖRNEK FORMAT:
PROJE: Haftalık Büyüme Döngüsü @ziyaeyuboglu @infoalieweb3 @alkannakliyat Yüksek
  Bu haftanın teması ve odak projeleri
  - Tema belirleme
  - Proje seçimi

GÖREV: Strateji Toplantısı @ziyaeyuboglu @infoalieweb3 Kritik
  Haftalık strateji ve odak belirleme
  - Geçen hafta değerlendirmesi
  - Bu hafta hedefleri

ARAŞTIRMA: Kite AI Analizi @ziyaeyuboglu Kritik
  Projenin detaylı incelemesi
  - Teknik analiz
  - Pazar potansiyeli

VERİLEN METİN:
${text}

TÜRKÇE olarak, yukarıdaki formata uygun şekilde düzenle:`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const enhancedText = response.text();
      
      console.log('✅ Gemini AI metin düzenlemesi tamamlandı');
      return enhancedText;
    } catch (error) {
      console.error('❌ Gemini AI hatası:', error.message);
      return this.fallbackProcessing(text);
    }
  }

  /**
   * Araştırma projelerini analiz edip yapılandırır
   */
  async analyzeResearchProjects(text) {
    if (!this.isConfigured) {
      return this.fallbackAnalysis(text);
    }

    const prompt = `
Aşağıdaki araştırma/proje bilgilerini analiz et ve JSON formatında döndür.

Her proje için:
- name: Proje adı
- type: "araştırma", "proje" veya "görev"
- priority: "yüksek", "orta" veya "düşük"
- assignee: Atanacak kişi (varsa)
- description: Açıklama
- subtasks: Alt görevler listesi
- labels: Etiketler
- score: Güven/önem skoru (0-100)

METİN:
${text}

Sadece JSON döndür, başka açıklama ekleme:`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const jsonText = response.text();
      
      // JSON'u parse et
      const cleanJson = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const projects = JSON.parse(cleanJson);
      
      console.log(`✅ ${projects.length} proje analiz edildi`);
      return projects;
    } catch (error) {
      console.error('❌ Gemini analiz hatası:', error.message);
      return this.fallbackAnalysis(text);
    }
  }

  /**
   * Akıllı görev önerilerinde bulunur
   */
  async suggestTasks(context) {
    if (!this.isConfigured) {
      return this.getDefaultSuggestions(context);
    }

    const prompt = `
Bir ${context.type || 'proje'} için görev önerileri oluştur.
Konu: ${context.topic || 'Genel'}
Takım büyüklüğü: ${context.teamSize || '1 kişi'}
Süre: ${context.duration || '1 hafta'}

5-10 adet görev öner. Her görev için:
- Görev adı
- Açıklama (1-2 cümle)
- Tahmini süre
- Öncelik

TÜRKÇE olarak, Trello formatına uygun şekilde yaz:`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const suggestions = response.text();
      
      return suggestions;
    } catch (error) {
      console.error('❌ Öneri oluşturma hatası:', error.message);
      return this.getDefaultSuggestions(context);
    }
  }

  /**
   * Metni özetler
   */
  async summarizeText(text, maxLength = 200) {
    if (!this.isConfigured) {
      return text.substring(0, maxLength) + '...';
    }

    const prompt = `
Aşağıdaki metni maksimum ${maxLength} karakter olacak şekilde özetle.
Önemli noktaları koru, gereksiz detayları çıkar.

METİN:
${text}

ÖZET (Türkçe):`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('❌ Özetleme hatası:', error.message);
      return text.substring(0, maxLength) + '...';
    }
  }

  /**
   * Görev önceliğini belirler
   */
  async determinePriority(taskDescription) {
    if (!this.isConfigured) {
      return 'orta';
    }

    const prompt = `
Aşağıdaki görevin önceliğini belirle.
Seçenekler: yüksek, orta, düşük

GÖREV: ${taskDescription}

Sadece öncelik seviyesini yaz (yüksek/orta/düşük):`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const priority = response.text().toLowerCase().trim();
      
      if (['yüksek', 'orta', 'düşük'].includes(priority)) {
        return priority;
      }
      return 'orta';
    } catch (error) {
      console.error('❌ Öncelik belirleme hatası:', error.message);
      return 'orta';
    }
  }

  /**
   * Metni kategorize eder
   */
  async categorizeText(text) {
    if (!this.isConfigured) {
      return this.defaultCategorization(text);
    }

    const prompt = `
Aşağıdaki metni analiz et ve uygun kategorileri belirle.
Mevcut kategoriler: araştırma, geliştirme, pazarlama, analiz, tasarım, test, dokümantasyon, toplantı, planlama

METİN:
${text}

En uygun 1-3 kategoriyi virgülle ayırarak yaz:`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const categories = response.text().split(',').map(c => c.trim()).filter(c => c);
      
      return categories;
    } catch (error) {
      console.error('❌ Kategorileme hatası:', error.message);
      return this.defaultCategorization(text);
    }
  }

  /**
   * Alt görevleri otomatik oluşturur
   */
  async generateSubtasks(mainTask) {
    if (!this.isConfigured) {
      return [];
    }

    const prompt = `
"${mainTask}" görevi için 3-5 alt görev oluştur.
Her alt görev kısa ve net olmalı.
Sadece alt görevleri listele, tire (-) ile başlat:`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const lines = response.text().split('\n');
      
      const subtasks = lines
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim())
        .filter(task => task.length > 0);
      
      return subtasks;
    } catch (error) {
      console.error('❌ Alt görev oluşturma hatası:', error.message);
      return [];
    }
  }

  /**
   * Akıllı fallback: AI olmadan gelişmiş işleme
   */
  smartFallbackProcessing(text) {
    const lines = text.split('\n');
    const processed = [];
    let currentBlock = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Zaten uygun formatta ise değiştirme
      if (/^(PROJE|ARAŞTIRMA|GÖREV|TODO|TASK):/i.test(trimmed)) {
        if (currentBlock.length > 0) {
          processed.push(...currentBlock);
          processed.push(''); // Boş satır ekle
          currentBlock = [];
        }
        processed.push(trimmed);
      }
      // Alt görev veya girintili satır
      else if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) {
        processed.push('  ' + trimmed); // Girintili ekle
      }
      // Girintili satırlar (açıklama)
      else if (line.search(/\S/) > 0) {
        processed.push(line); // Orijinal girintiyi koru
      }
      // Potansiyel görev satırı
      else if (trimmed && trimmed.length > 10 && /[a-zışçöüği]/i.test(trimmed)) {
        // Görev gibi görünen kelimeler içeriyor mu?
        const taskWords = /yapılacak|hazırla|oluştur|geliştir|tasarla|analiz|incele|test|kontrol|güncelle/i;
        if (taskWords.test(trimmed)) {
          if (currentBlock.length > 0) {
            processed.push(...currentBlock);
            processed.push('');
            currentBlock = [];
          }
          processed.push(`GÖREV: ${trimmed}`);
        } else if (currentBlock.length > 0 || processed.length > 0) {
          // Açıklama olarak ekle
          processed.push('  ' + trimmed);
        }
      }
      // Boş satır
      else if (!trimmed) {
        if (currentBlock.length > 0) {
          processed.push(...currentBlock);
          currentBlock = [];
        }
        processed.push('');
      }
    }
    
    if (currentBlock.length > 0) {
      processed.push(...currentBlock);
    }
    
    return processed.join('\n');
  }
  
  /**
   * Eski fallback (geriye uyumluluk için)
   */
  fallbackProcessing(text) {
    return this.smartFallbackProcessing(text);
  }

  /**
   * Fallback: Basit analiz
   */
  fallbackAnalysis(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const projects = [];
    let currentProject = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (/^[A-ZÇĞİÖŞÜ]/.test(trimmed) && trimmed.length > 10) {
        if (currentProject) {
          projects.push(currentProject);
        }
        
        currentProject = {
          name: trimmed.replace(/^(PROJE|ARAŞTIRMA|GÖREV):?\s*/i, ''),
          type: 'görev',
          priority: 'orta',
          description: '',
          subtasks: [],
          labels: []
        };
        
        // Tip belirleme
        if (/PROJE/i.test(trimmed)) currentProject.type = 'proje';
        if (/ARAŞTIRMA/i.test(trimmed)) currentProject.type = 'araştırma';
        
        // Öncelik belirleme
        if (/acil|önemli|kritik|yüksek/i.test(trimmed)) {
          currentProject.priority = 'yüksek';
        }
      } else if (currentProject && trimmed.startsWith('-')) {
        currentProject.subtasks.push(trimmed.substring(1).trim());
      } else if (currentProject && trimmed) {
        currentProject.description += trimmed + ' ';
      }
    }
    
    if (currentProject) {
      projects.push(currentProject);
    }
    
    return projects;
  }

  /**
   * Varsayılan kategorileme
   */
  defaultCategorization(text) {
    const categories = [];
    const textLower = text.toLowerCase();
    
    if (/araştırma|research|analiz/.test(textLower)) categories.push('araştırma');
    if (/geliştirme|development|kod|code/.test(textLower)) categories.push('geliştirme');
    if (/pazarlama|marketing|satış/.test(textLower)) categories.push('pazarlama');
    if (/tasarım|design|ui|ux/.test(textLower)) categories.push('tasarım');
    if (/test|qa|bug/.test(textLower)) categories.push('test');
    
    return categories.length > 0 ? categories : ['genel'];
  }

  /**
   * Varsayılan görev önerileri
   */
  getDefaultSuggestions(context) {
    const suggestions = {
      araştırma: `
GÖREV: Literatür Taraması
İlgili akademik kaynakları ve makaleleri incele
Öncelik: Yüksek

GÖREV: Rakip Analizi
Sektördeki benzer çözümleri araştır ve karşılaştır
Öncelik: Yüksek

GÖREV: Teknik Fizibilite
Teknik gereksinimleri ve kısıtlamaları belirle
Öncelik: Orta

GÖREV: Maliyet Analizi
Proje maliyetlerini hesapla ve bütçe planı oluştur
Öncelik: Orta

GÖREV: Rapor Hazırlama
Araştırma bulgularını derle ve sunum hazırla
Öncelik: Düşük`,
      
      proje: `
GÖREV: Proje Planlama @TurTir
Detaylı proje planı ve zaman çizelgesi oluştur
Öncelik: Yüksek

GÖREV: Gereksinim Analizi
Fonksiyonel ve teknik gereksinimleri belirle
Öncelik: Yüksek

GÖREV: Tasarım Dokümanı
Sistem mimarisi ve tasarım dokümanını hazırla
Öncelik: Orta

GÖREV: Geliştirme Ortamı Kurulumu
Development ortamını hazırla ve araçları kur
Öncelik: Orta

GÖREV: Test Planı
Test senaryolarını ve kabul kriterlerini oluştur
Öncelik: Düşük`,
      
      default: `
GÖREV: İlk Toplantı
Kick-off toplantısı organize et
Öncelik: Yüksek

GÖREV: Dokümantasyon
Proje dokümantasyonunu başlat
Öncelik: Orta

GÖREV: Kaynak Planlama
Gerekli kaynakları belirle ve planla
Öncelik: Orta`
    };
    
    return suggestions[context.type] || suggestions.default;
  }

  /**
   * API anahtarının geçerli olup olmadığını kontrol eder
   */
  isAvailable() {
    return this.isConfigured;
  }

  /**
   * Kullanım istatistikleri
   */
  getStats() {
    return {
      configured: this.isConfigured,
      model: this.modelName,
      apiKeySet: !!this.apiKey && this.apiKey !== 'your_gemini_api_key_here'
    };
  }
}

// Singleton instance
let geminiManagerInstance = null;

export function getGeminiManager() {
  if (!geminiManagerInstance) {
    geminiManagerInstance = new GeminiManager();
  }
  return geminiManagerInstance;
}
