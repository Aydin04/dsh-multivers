# 🪐 @aydin/dsh-multivers — MULTIVERS Engine for DeepSeek Harness (DSH)

Plugin untuk DeepSeek Harness (DSH) yang mengadopsi arsitektur MULTIVERS Zero-Bloat Payload Diet dan Flatline Context Window untuk mencegah error HTTP 429 (Rate Limit / TPM / RPM Exceeded) pada sesi percakapan panjang.

## 🌟 Fitur Utama
1. Flatline Rolling Context Window (Membatasi N pesan riwayat aktif)
2. Tool Output Auto-Pruner (Memotong log terminal / PTC panjang)
3. Smart RPM Throttle (Jeda cerdas anti-rate limit)
4. Dedicated Web UI Dashboard di menu Settings DSH dengan nama '🪐 MULTIVERS'

## 📦 Struktur Berkas
- client.js: Antarmuka Web Dashboard di Settings DSH
- lib/index.js: Backend Cordis interceptor LLM & REST API
- cordis.patch.yml: Konfigurasi layer DSH loader
- package.json: Manifest DSH plugin