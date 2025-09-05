# Gemini AI API Anahtarı Kurulumu

## 🔑 Yeni API Anahtarı Alma

1. **Google AI Studio'ya gidin:**
   - https://aistudio.google.ai/

2. **Google hesabınızla giriş yapın**

3. **"Get API Key" butonuna tıklayın**

4. **"Create API Key" seçeneğini seçin**

5. **Yeni oluşturulan API anahtarını kopyalayın**

## 🔧 API Anahtarını Güncelleme

`.env` dosyasını açın ve eski anahtarı yenisiyle değiştirin:

```env
GEMINI_API_KEY=yeni_api_anahtariniz_buraya
```

## ✅ API Anahtarını Test Etme

```bash
node test-gemini-integration.js
```

## 📊 Mevcut Durum

- **Mevcut API Anahtarı:** `AIzaSyBbhjn8P1gHPIi1xwPxOy66bYz09Dja5h0`
- **Durum:** ❌ Süresi dolmuş
- **Hata:** `API key expired. Please renew the API key.`

## 🎯 Gemini AI Özellikleri

Gemini AI aktif olduğunda:
- ✨ Metinleri otomatik olarak Trello görev formatına dönüştürür
- 🏷️ Uygun etiketler ekler (GÖREV:, PROJE:, ARAŞTIRMA:)
- 📌 Öncelikleri belirler
- 👥 Atama önerileri yapar
- 📝 Alt görevleri organize eder

## 🔄 Fallback Mekanizması

Gemini API çalışmadığında:
- Sistem otomatik olarak `smartFallbackProcessing` metodunu kullanır
- Basit kural tabanlı görev tanıma devreye girer
- Görevler yine de oluşturulur ancak AI destekli iyileştirmeler olmaz

## 💡 Öneriler

1. **Ücretsiz Kullanım:** Google AI Studio üzerinden ayda 60 istek ücretsiz
2. **Rate Limit:** Dakikada 60 istek limiti var
3. **Model Seçimi:** `gemini-pro` modeli metin işleme için ideal

## 🌟 Gemini Olmadan da Çalışır!

Sistem, Gemini API olmadan da çalışmaya devam eder:
- Açık görev tanımları (GÖREV:, PROJE: vb.) tanınır
- Alt görevler düzgün işlenir
- Atamalar çalışır

Ancak Gemini ile:
- Daha akıllı metin analizi
- Otomatik görev formatlaması
- Öncelik ve kategori önerileri

---

## Hızlı Kurulum

1. https://aistudio.google.ai/ adresine git
2. API Key oluştur
3. `.env` dosyasını güncelle:
   ```
   GEMINI_API_KEY=yeni_anahtarin
   ```
4. Test et:
   ```bash
   node test-gemini-integration.js
   ```

✅ **Not:** Sistem Gemini olmadan da tam fonksiyonel çalışır!
