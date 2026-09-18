/**
 * İstanbul ilçeleri — kayıt formundaki "nerede yaşıyorsun" alanı için.
 *
 * Neden liste: salonun sporcuları neredeyse tamamen İstanbul'da ve işe yarayan
 * kırılım il değil **ilçe** — "Kadıköy'den 12 kişi geliyor, Ataşehir'den 2"
 * bilgisi reklam hedeflemesini doğrudan değiştirir. Serbest metin bırakılırsa
 * aynı ilçe "Kadikoy", "kadıköy", "Kadıköy/İst" olarak üç kez yazılır ve
 * sayılamaz.
 *
 * Yine de alan `datalist` ile sunulur, `select` ile değil: İstanbul dışından
 * gelen (ya da ilçesini listede bulamayan) biri kendi yazabilsin.
 */
export const ISTANBUL_DISTRICTS = [
  "Adalar",
  "Arnavutköy",
  "Ataşehir",
  "Avcılar",
  "Bağcılar",
  "Bahçelievler",
  "Bakırköy",
  "Başakşehir",
  "Bayrampaşa",
  "Beşiktaş",
  "Beykoz",
  "Beylikdüzü",
  "Beyoğlu",
  "Büyükçekmece",
  "Çatalca",
  "Çekmeköy",
  "Esenler",
  "Esenyurt",
  "Eyüpsultan",
  "Fatih",
  "Gaziosmanpaşa",
  "Güngören",
  "Kadıköy",
  "Kâğıthane",
  "Kartal",
  "Küçükçekmece",
  "Maltepe",
  "Pendik",
  "Sancaktepe",
  "Sarıyer",
  "Silivri",
  "Sultanbeyli",
  "Sultangazi",
  "Şile",
  "Şişli",
  "Tuzla",
  "Ümraniye",
  "Üsküdar",
  "Zeytinburnu",
] as const;

/** Formun varsayılanları — İstanbul dışından gelen değiştirir. */
export const DEFAULT_CITY = "İstanbul";
export const DEFAULT_STATE = "İstanbul";
/** ISO-3166 alpha-2, küçük harf (Meta `country` alanının beklediği biçim). */
export const DEFAULT_COUNTRY = "tr";
