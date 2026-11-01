# 72S Canlı Grafik

Telefon için, canlı **72S** bant paneli (Mazlum Yolbaş'ın "Future" listesi).

- Veriler **tarayıcıdan doğrudan** herkese açık borsa uç noktalarından çekilir: Binance USDT-M vadeli (`fapi.binance.com`), COREUSDT için Bybit (v5, linear). CATUSDT = Binance `1000CATUSDT`.
- Gri bantlar: Dynamic HMA+ ± 2×3×ATR(40); uyarlamalı periyot 172–233, ATR(14)/ATR(46) uyarlaması %3,141/mum, kaynak kapanış. Hesap `s72.js` içinde (TradingView ile doğrulanmış port).
- Zaman dilimleri: 1S, 4S (varsayılan), 1G. Grafik ~20 sn'de bir yenilenir, canlı mum websocket ile gelir. Özet tablo her sembolü ~60 sn'de bir, sırayla yeniler.
- Özet: fiyat, üst/alt bant, banda uzaklık (%), son veya önceki 4S mum banda değdiyse vurgu. Satıra dokununca grafik açılır.
- Ayarlar: sembol ekle/çıkar (tarayıcıda saklanır), bildirim/ses izni (yalnızca düğmeyle istenir).
- Saatler İstanbul saatidir. Veri uydurulmaz; istek başarısızsa hata yazılır.

## Yayınlama (GitHub Pages)
1. Bu klasörü bir GitHub deposuna gönderin (`git remote add origin …` → `git push -u origin main`).
2. Depo → Settings → Pages → "Deploy from a branch" → `main` / `(root)`.
3. Adres: `https://<kullanıcı>.github.io/<depo>/`. Telefonda açıp "Ana ekrana ekle" ile uygulama gibi kullanabilirsiniz.

## Test
- `node test/band-check.js` — sitenin veri yolu ile `s72.js` sonuçlarını AVAXUSDT 4S için karşılaştırır.
- `test/browser-smoke.js` — Playwright ile sayfanın hatasız açıldığını kontrol eder.

Grafik kütüphanesi: TradingView Lightweight Charts™ 5.2.1 (`vendor/`, Apache 2.0). Copyright (c) 2025 TradingView, Inc. — https://www.tradingview.com/

Yatırım tavsiyesi değildir.
