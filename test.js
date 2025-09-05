#!/usr/bin/env node

import { TrelloManager } from './trello-manager.js';
import { CommandProcessor } from './command-processor.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔧 Trello MCP Test Sistemi Başlatılıyor...\n');

// Test komutları
const testCommands = [
  {
    name: "Basit Görev Oluşturma",
    command: "Ziya'ya yeni website analizi görevi ata",
    type: "create_task"
  },
  {
    name: "Proje Görevi",
    command: "AI chatbot projesi için Ahmet'e araştırma görevi oluştur",
    type: "create_task"
  },
  {
    name: "Öncelikli Görev",
    command: "@ziya acil veritabanı optimizasyonu görevi yüksek öncelik",
    type: "create_task"
  },
  {
    name: "Mevcut Görev Atama",
    command: "Website analizi kartını Mehmet'e ata",
    type: "assign_task"
  },
  {
    name: "Detaylı Görev",
    command: "Ziya'ya e-ticaret platformu geliştirme görevi oluştur liste:yapılıyor etiket:geliştirme,yüksek öncelik",
    type: "create_task"
  }
];

class TrelloMCPTester {
  constructor() {
    this.trelloManager = null;
    this.commandProcessor = null;
  }

  async initialize() {
    try {
      console.log('🔌 Trello API bağlantısı kuruluyor...');
      this.trelloManager = new TrelloManager();
      this.commandProcessor = new CommandProcessor(this.trelloManager);
      console.log('✅ Bağlantı başarılı!\n');
    } catch (error) {
      console.error('❌ Bağlantı hatası:', error.message);
      process.exit(1);
    }
  }

  async testConnection() {
    console.log('🔍 Bağlantı testi yapılıyor...\n');
    
    try {
      // Panoları listele
      console.log('📋 Trello panolarınız:');
      const boards = await this.trelloManager.getBoards();
      
      if (boards.length === 0) {
        console.log('   ⚠️ Hiç pano bulunamadı!');
        return false;
      }

      boards.forEach((board, index) => {
        console.log(`   ${index + 1}. ${board.name} (ID: ${board.id})`);
      });

      // İlk panonun detaylarını al
      if (boards.length > 0) {
        console.log('\n🔍 İlk panonun detayları:');
        const boardInfo = await this.trelloManager.getBoardInfo(boards[0].id);
        
        console.log(`   📌 Pano: ${boardInfo.name}`);
        console.log(`   📝 Listeler (${boardInfo.lists.length}):`);
        boardInfo.lists.forEach(list => {
          console.log(`     - ${list.name}`);
        });
        
        console.log(`   👥 Üyeler (${boardInfo.members.length}):`);
        boardInfo.members.forEach(member => {
          console.log(`     - ${member.fullName} (@${member.username})`);
        });

        // Varsayılan pano olarak ayarla (eğer ayarlanmamışsa)
        if (process.env.DEFAULT_BOARD_ID === 'your_board_id_here') {
          console.log(`\n💡 İpucu: .env dosyasında DEFAULT_BOARD_ID değerini "${boards[0].id}" olarak güncelleyin.`);
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Bağlantı testi başarısız:', error.message);
      return false;
    }
  }

  async runCommandTests() {
    console.log('\n🧪 Komut işleme testleri başlatılıyor...\n');

    for (const test of testCommands) {
      console.log(`\n🔧 Test: ${test.name}`);
      console.log(`📝 Komut: "${test.command}"`);
      console.log('⏳ İşleniyor...');

      try {
        let result;
        
        if (test.type === 'create_task') {
          // Komut işlemeyi test et (gerçekte oluşturmadan)
          const taskInfo = this.commandProcessor.extractTaskInfo(test.command);
          console.log('📊 Çıkarılan bilgiler:');
          console.log(`   🎯 Görev Adı: ${taskInfo.name || 'Belirlenemedi'}`);
          console.log(`   👥 Atanan: ${taskInfo.assignedTo.length > 0 ? taskInfo.assignedTo.join(', ') : 'Kimse'}`);
          console.log(`   📋 Liste: ${taskInfo.listName || 'Varsayılan'}`);
          console.log(`   ⚡ Öncelik: ${taskInfo.priority || 'Normal'}`);
          console.log(`   🏷️ Etiketler: ${taskInfo.labels.length > 0 ? taskInfo.labels.join(', ') : 'Yok'}`);
          
          result = { success: true, test_only: true };
        } else if (test.type === 'assign_task') {
          // Atama bilgilerini test et
          const assignInfo = this.commandProcessor.extractAssignInfo(test.command);
          console.log('📊 Çıkarılan bilgiler:');
          console.log(`   🎯 Kart Adı: ${assignInfo.cardName || 'Belirlenemedi'}`);
          console.log(`   👤 Üye Adı: ${assignInfo.memberName || 'Belirlenemedi'}`);
          
          result = { success: true, test_only: true };
        }

        if (result.success) {
          if (result.test_only) {
            console.log('✅ Test başarılı (sadece komut işleme)');
          } else {
            console.log('✅ Test başarılı');
          }
        } else {
          console.log(`❌ Test başarısız: ${result.error}`);
        }

      } catch (error) {
        console.error(`❌ Test hatası: ${error.message}`);
      }
    }
  }

  async runInteractiveTest() {
    console.log('\n🎮 İnteraktif Test Modu');
    console.log('Ctrl+C ile çıkmak için');
    console.log('Komutlarınızı yazın (örnek: "Ziya\'ya yeni test görevi ata"):\n');

    // Terminal input için
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '🤖 Komut: '
    });

    rl.prompt();

    rl.on('line', async (line) => {
      const command = line.trim();
      
      if (!command) {
        rl.prompt();
        return;
      }

      if (command.toLowerCase() === 'exit' || command.toLowerCase() === 'çıkış') {
        console.log('👋 Güle güle!');
        rl.close();
        return;
      }

      console.log(`\n🔍 Komut analiz ediliyor: "${command}"`);

      try {
        // Komut tipini belirle
        const isCreateTask = /(?:görev|kart|task|iş)\s*(?:oluştur|ekle|yap|at)|(?:'ya|'ye|için).*(?:görev|kart)/i.test(command);
        const isAssignTask = /(?:kart|görev).*(?:ata|assign)/i.test(command);

        if (isCreateTask) {
          const taskInfo = this.commandProcessor.extractTaskInfo(command);
          console.log('📊 Görev oluşturma bilgileri:');
          console.log(`   🎯 Adı: ${taskInfo.name}`);
          console.log(`   👥 Atanan: ${taskInfo.assignedTo.join(', ') || 'Kimse'}`);
          console.log(`   📋 Liste: ${taskInfo.listName || 'Varsayılan'}`);
          console.log(`   ⚡ Öncelik: ${taskInfo.priority || 'Normal'}`);
          console.log(`   🏷️ Etiketler: ${taskInfo.labels.join(', ') || 'Yok'}`);
          
          // Gerçekten oluşturmak için onay al
          console.log('\n❓ Bu görevi gerçekten oluşturmak istiyor musunuz? (y/n)');
        } else if (isAssignTask) {
          const assignInfo = this.commandProcessor.extractAssignInfo(command);
          console.log('📊 Atama bilgileri:');
          console.log(`   🎯 Kart: ${assignInfo.cardName}`);
          console.log(`   👤 Üye: ${assignInfo.memberName}`);
          
          console.log('\n❓ Bu atamayı gerçekten yapmak istiyor musunuz? (y/n)');
        } else {
          console.log('❌ Komut türü belirlenemedi. Örnek komutlar:');
          console.log('   • "Ziya\'ya yeni proje analizi görevi ata"');
          console.log('   • "Website geliştirme kartını Ahmet\'e ata"');
        }

      } catch (error) {
        console.error(`❌ Hata: ${error.message}`);
      }

      console.log('');
      rl.prompt();
    });

    rl.on('close', () => {
      console.log('\n👋 Test tamamlandı!');
      process.exit(0);
    });
  }
}

// Ana test fonksiyonu
async function runTests() {
  const tester = new TrelloMCPTester();
  
  console.log('🚀 Trello MCP Test Süreci Başlatılıyor...\n');

  // Sistem kontrolü
  if (!process.env.TRELLO_API_KEY || !process.env.TRELLO_TOKEN) {
    console.error('❌ .env dosyasında TRELLO_API_KEY veya TRELLO_TOKEN bulunamadı!');
    process.exit(1);
  }

  await tester.initialize();

  // Bağlantı testi
  const connectionOk = await tester.testConnection();
  if (!connectionOk) {
    console.error('❌ Trello bağlantısı kurulamadı!');
    process.exit(1);
  }

  // Komut testleri
  await tester.runCommandTests();

  // Test tipini belirle
  const args = process.argv.slice(2);
  if (args.includes('--interactive') || args.includes('-i')) {
    await tester.runInteractiveTest();
  } else {
    console.log('\n✅ Tüm testler tamamlandı!');
    console.log('\n💡 İnteraktif test için: npm run test -- --interactive');
    console.log('💡 Sunucuyu başlatmak için: npm start');
  }
}

// Hata yakalama
process.on('unhandledRejection', (error) => {
  console.error('❌ Yakalanmamış hata:', error);
  process.exit(1);
});

// Test başlat
runTests().catch(error => {
  console.error('❌ Test hatası:', error);
  process.exit(1);
});
