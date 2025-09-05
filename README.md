# 📋 Text to Trello AI

<div align="center">
  <img src="https://img.shields.io/badge/Trello-0052CC?style=for-the-badge&logo=trello&logoColor=white" alt="Trello">
  <img src="https://img.shields.io/badge/Google%20Gemini-886FBF?style=for-the-badge&logo=google&logoColor=white" alt="Gemini">
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel">
</div>

<div align="center">
  <h3>🚀 Metinlerinizi Otomatik Olarak Trello Görevlerine Dönüştürün!</h3>
  <p>Gemini AI destekli akıllı görev yönetimi sistemi</p>
</div>

## 🌟 Özellikler

- ✨ **AI Destekli Metin İşleme**: Gemini AI ile düz metni otomatik olarak yapılandırılmış görevlere dönüştürür
- 📝 **Doğal Dil İşleme**: Türkçe komutları anlayıp Trello kartları oluşturur
- 🎯 **Akıllı Önceliklendirme**: Görevlere otomatik öncelik ataması
- 👥 **Otomatik Atama**: Ekip üyelerine görev atama
- 🏷️ **Etiketleme**: Görevlere otomatik etiket ekleme
- 📱 **Responsive Arayüz**: Her cihazda mükemmel çalışır
- 🔒 **Güvenli**: API anahtarları tarayıcıda güvenli şekilde saklanır

## 🎥 Demo

[🔗 Canlı Demo](https://text-to-trello.vercel.app)

## 🚀 Hızlı Başlangıç

### 1️⃣ Trello API Anahtarlarını Alın

1. [Trello Power-Ups Admin](https://trello.com/power-ups/admin) sayfasına gidin
2. **"New"** butonuna tıklayın ve bir Power-Up oluşturun
3. API Key'inizi kopyalayın
4. Token almak için aşağıdaki URL'yi kullanın (API_KEY yerine kendi anahtarınızı koyun):
   ```
   https://trello.com/1/authorize?expiration=never&name=Text-to-Trello&scope=read,write&response_type=token&key=API_KEY
   ```

### 2️⃣ Trello Board ID'sini Bulun

1. Trello panonuzu açın
2. URL'nin sonuna `.json` ekleyin
3. Açılan JSON'da `"id"` değerini kopyalayın

### 3️⃣ Gemini AI API Key (Opsiyonel)

1. [Google AI Studio](https://aistudio.google.ai/app/apikey) sayfasına gidin
2. Google hesabınızla giriş yapın
3. **"Create API Key"** butonuna tıklayın
4. API anahtarınızı kopyalayın

## 💻 Kurulum

### Vercel ile Deploy (Önerilen)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/turtir-ai/text-to-trello)

### Lokal Kurulum

```bash
# Projeyi klonlayın
git clone https://github.com/turtir-ai/text-to-trello.git
cd text-to-trello

# Bağımlılıkları yükleyin
npm install

# .env dosyasını oluşturun
cp .env.example .env

# .env dosyasını düzenleyin ve API anahtarlarınızı ekleyin

# Uygulamayı başlatın
npm start
```

Tarayıcınızda `http://localhost:3001` adresine gidin.

## 📖 Kullanım

### Web Arayüzü

1. API anahtarlarınızı üst panelden girin
2. Görevlerinizi metin kutusuna yazın veya yapıştırın
3. **"Görevleri Oluştur"** butonuna tıklayın
4. Görevler otomatik olarak Trello panonuza eklenecek!

### Görev Formatları

#### Yapılandırılmış Format:
```
GÖREV: Web sitesi tasarımı kritik
  Modern ve responsive tasarım hazırlanacak
  - Ana sayfa tasarımı
  - Ürün sayfası şablonu

ARAŞTIRMA: Pazar analizi
  Rakip firmalar incelenecek
  - Fiyat karşılaştırması
  - Özellik analizi

PROJE: Mobil uygulama geliştirme
  React Native ile cross-platform uygulama
```

#### Düz Metin (Gemini AI ile):
```
yeni web sitesi tasarımı yapılacak
mobil uygulama için api geliştirme
veritabanı optimizasyonu gerekiyor
müşteri toplantısı ayarla yarın için
```

### CLI Kullanımı

```bash
# Metin dosyasından görev oluşturma
npm run text-to-trello -- input.txt

# İnteraktif mod
npm run text-to-trello
```

## 🤖 Gemini AI Entegrasyonu

Gemini AI aktif olduğunda:
- Düz metni otomatik olarak yapılandırır
- Görevlere öncelik atar
- Alt görevler oluşturur
- Etiketler ekler
- Atama önerileri yapar

## 🛠️ Teknolojiler

- **Backend**: Node.js, Express.js
- **AI**: Google Gemini AI
- **API**: Trello REST API
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Deployment**: Vercel

## 📦 Proje Yapısı

```
text-to-trello/
├── public/              # Web arayüzü
│   └── index.html      # Ana sayfa
├── src/
│   ├── server.js       # Express sunucu
│   ├── text-to-trello.js   # Metin işleme
│   ├── trello-manager.js   # Trello API
│   ├── gemini-manager.js   # Gemini AI
│   └── command-processor.js # Komut işleme
├── .env.example        # Örnek yapılandırma
├── package.json        # Bağımlılıklar
└── README.md          # Dokümantasyon
```

## 🔧 Yapılandırma

`.env` dosyası örneği:

```env
# Trello API
TRELLO_API_KEY=your_api_key_here
TRELLO_TOKEN=your_token_here
DEFAULT_BOARD_ID=your_board_id_here

# Gemini AI (Opsiyonel)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# Server
PORT=3001
```

## 📝 API Endpoints

### POST `/api/text-to-trello`
Metni Trello görevlerine dönüştürür.

```javascript
{
  "text": "GÖREV: Yeni özellik geliştirme",
  "config": {
    "apiKey": "...",
    "token": "...",
    "boardId": "...",
    "geminiKey": "..." // opsiyonel
  }
}
```

## 🤝 Katkıda Bulunma

1. Projeyi fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 👨‍💻 Geliştirici

**Turtir AI**
- GitHub: [@turtir-ai](https://github.com/turtir-ai)
- Email: turtirhey@gmail.com

## 🙏 Teşekkürler

- [Trello](https://trello.com) - Harika API ve dokümantasyon için
- [Google Gemini](https://deepmind.google/technologies/gemini/) - AI desteği için
- [Vercel](https://vercel.com) - Hosting için

## 📚 Dokümantasyon

Detaylı dokümantasyon için [Wiki](https://github.com/turtir-ai/text-to-trello/wiki) sayfasını ziyaret edin.

## 🐛 Hata Bildirimi

Hata bulduysanız lütfen [Issues](https://github.com/turtir-ai/text-to-trello/issues) sayfasından bildirin.

---

<div align="center">
  <p>⭐ Bu projeyi beğendiyseniz yıldız vermeyi unutmayın!</p>
  <p>Made with ❤️ by <a href="https://github.com/turtir-ai">Turtir AI</a></p>
</div>
