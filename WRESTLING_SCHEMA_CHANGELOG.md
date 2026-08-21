# BlackBox Wrestling Lab — Schema Changelog

Farklı `protocolVersion` veya config hash taşıyan seanslar otomatik olarak karşılaştırılmaz.

## 18 Ağustos 2026 — Taslak `blackbox-wrestling-lab-session/1.0`

- Boxing `TrialResult` yapısı değiştirilmeden Wrestling için ayrı discriminated trial union planlandı.
- Ortak seans alanları: `sport`, `protocolId`, `protocolVersion`, `sessionId`, `athleteId`, kamera, calibration, config snapshot/hash, raw trials, summary ve quality flags.
- Wrestling calibration alt gövde, stance ve body-center baseline alanlarını içerir; Boxing calibration'ın yerini almaz.
- Kalıcı profil yalnız türetilmiş sayısal seansları saklar; kamera frame'i, fotoğraf, ses veya video şemaya dahil değildir.
- `WrestlingCalibrationSnapshot` uygulandı: omuz/hip genişliği, stance height, torso/hip/body center, knee/ankle/wrist baseline, stance width, knee-flexion proxy, torso angle, foot-lead relationship, stability ve kamera/FPS snapshot alanları eklendi.

## 18 Ağustos 2026 — Uygulanan session ve trial sözleşmesi

- Şema kimliği kesinleştirildi: `blackbox-wrestling-lab-session/1.0`; kök seans discriminator'ları `sport: "wrestling"`, `protocolId` ve `protocolVersion`.
- `WrestlingTrial` union'ı shot, sprawl, choice, recognition, movement, stance, hand-fighting, chain, scramble, fatigue, virtual-wrestler ve pattern sonuçlarını tip güvenli discriminator'larla saklar.
- Tüm hareket trial'larında T0/T1/T2/T3, reaction/execution/total/recovery süreleri, outcome, correctness, motion snapshot, tracking quality ve quality flags korunur.
- Summary; median reaction/execution/total/recovery, MAD tutarlılığı, stance consistency, false-defense oranı, sol/sağ medianları ile mutlak/göreli farkı içerir.
- `configSnapshot` ile deterministic `configHash` her seansa yazılır. Coach Test ayarları hash girdisinin parçasıdır.
- `blackbox-fight-lab` IndexedDB içindeki `wrestling-sessions` store'u yalnız bu sayısal sözleşmeyi saklar. Atlet kimliği sürümlü localStorage anahtarında tutulur; görüntü medyası şemanın parçası değildir.
