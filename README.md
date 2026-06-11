# World Cup Fantasy League

React Native / Expo ile geliştirilmiş FIFA Dünya Kupası 2026 tahmin uygulaması. Arkadaş grupları için özel ligler kurun, her maç için 8 farklı soruyu cevaplayın ve puan sıralamasında yarışın.

## Özellikler

- Maç başlamadan 24 saat önce açılan, 15 dakika öncesine kadar süren tahmin penceresi
- 8 soruluk tahmin seti: kazanan, goller, ilk yarı, kırmızı kart, ilk gol takımı ve daha fazlası
- Davet koduyla arkadaşları liginize ekleyin
- Canlı puan sıralaması
- Takvim + grup filtreli fikstür ekranı (Türkiye saatiyle)
- Karanlık / açık tema desteği

## Teknolojiler

- [Expo](https://expo.dev) SDK 56 (React Native, TypeScript)
- [Firebase](https://firebase.google.com) — Auth + Firestore
- [Luxon](https://moment.github.io/luxon/) — Saat dilimi dönüşümleri
- [EAS Build](https://docs.expo.dev/build/introduction/) — App Store dağıtımı

## Kurulum

### Gereksinimler

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Firebase projesi (Auth + Firestore etkin)

### Adımlar

```bash
git clone https://github.com/nidasarac/worldcup-fantasy-league.git
cd worldcup-fantasy-league
npm install
```

`.env.example` dosyasını kopyalayıp kendi değerlerinizi girin:

```bash
cp .env.example .env
```

```env
API_FOOTBALL_KEY=...
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
```

### Geliştirme sunucusu

```bash
npm start        # Expo Go ile QR kod
npm run ios      # iOS simülatörde
npm run android  # Android emülatörde
npm run web      # Tarayıcıda
```

## Firebase Yapılandırması

Firebase credentialları `app.json > expo.extra` alanından okunur ve EAS Build sırasında ortam değişkenleri aracılığıyla enjekte edilir. Lokal geliştirme için `.env` dosyasını doldurmak yeterlidir.

### Firestore Güvenlik Kuralları

```bash
firebase deploy --only firestore:rules
```

## EAS Build (App Store)

```bash
# İlk kurulum
eas init

# Ortam değişkenlerini yükle
eas env:push --scope project --env-file .env

# Production build
eas build --platform ios --profile production
```

## Firestore Şeması

```
users/{uid}
nicknames/{normalizedNickname}
leagues/{leagueId}
leagues/{leagueId}/members/{userId}
leagues/{leagueId}/predictions/{predId}
leagues/{leagueId}/predictions/{predId}/answers/{questionId}
users/{userId}/predictions/{matchId}
users/{userId}/predictions/{matchId}/answers/{questionId}
matches/{matchId}
matches/{matchId}/questions/{questionId}
matches/{matchId}/result/final
```

## Lisans

Bu proje kişisel kullanım amaçlıdır.
