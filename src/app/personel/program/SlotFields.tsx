import {
  hintClass,
  inputClass,
  labelClass,
} from "@/components/panel/form";

/**
 * Takvimde seçilen saatlerin ayarları.
 *
 * Bilinçli olarak İSTEMCİ BİLEŞENİ DEĞİL: hiçbir durum tutmaz, yalnız
 * `WeekBoard`un formuna giren alanlardır. Seçim durumu ızgarada, ayarlar
 * burada — ikisi aynı formda birleşir (bkz. `WeekBoard` → `Composer`).
 *
 * Alan sırası işe göre: önce "ne tür ders, kaç dakika" (çoğu salonda bir kez
 * ayarlanır ve değişmez), sonra kontenjan, en sonda tekrar. Tarih/saat alanı
 * YOK — onu takvim söyler.
 */

const KINDS = [
  { value: "boks", label: "Boks" },
  { value: "kickbox", label: "Kickbox" },
  { value: "fight_prep", label: "Fight Prep" },
  { value: "kondisyon", label: "Kondisyon" },
  { value: "teknik", label: "Teknik Çalışma" },
];

export function SlotFields() {
  return (
    <div className="space-y-4 rounded-sm border border-brand-border bg-brand-black/30 p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="slot-kind" className={labelClass}>
            Tür
          </label>
          <select
            id="slot-kind"
            name="kind"
            defaultValue="boks"
            className={inputClass}
          >
            {KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="slot-duration" className={labelClass}>
            Süre (dk)
          </label>
          <input
            id="slot-duration"
            name="durationMinutes"
            type="number"
            min={15}
            max={240}
            step={15}
            required
            defaultValue={60}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="slot-minute" className={labelClass}>
            Başlangıç dakikası
          </label>
          <select
            id="slot-minute"
            name="startMinute"
            defaultValue="0"
            className={inputClass}
          >
            <option value="0">Tam saat (19:00)</option>
            <option value="15">Çeyrek geçe (19:15)</option>
            <option value="30">Buçuk (19:30)</option>
            <option value="45">Çeyrek kala (19:45)</option>
          </select>
          <p className={hintClass}>Seçtiğin tüm saatlere uygulanır.</p>
        </div>

        <div>
          <label htmlFor="slot-capacity" className={labelClass}>
            Kontenjan
          </label>
          <input
            id="slot-capacity"
            name="capacity"
            type="number"
            min={1}
            max={20}
            required
            defaultValue={1}
            className={inputClass}
          />
          <p className={hintClass}>1 = birebir. İkinci kişi isterse onayınla grup olur.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="slot-repeat" className={labelClass}>
            Kaç hafta tekrarlansın
          </label>
          <input
            id="slot-repeat"
            name="repeatWeeks"
            type="number"
            min={1}
            max={12}
            required
            defaultValue={1}
            className={inputClass}
          />
          <p className={hintClass}>
            1 = yalnız bu hafta. 4 yazarsan seçtiğin saatler 4 hafta açılır.
          </p>
        </div>

        <div>
          <label htmlFor="slot-title" className={labelClass}>
            Başlık <span className="font-normal normal-case">(opsiyonel)</span>
          </label>
          <input
            id="slot-title"
            name="title"
            maxLength={80}
            placeholder="Sabah boks · teknik ağırlıklı"
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="slot-notes" className={labelClass}>
            Not <span className="font-normal normal-case">(opsiyonel)</span>
          </label>
          <input
            id="slot-notes"
            name="notes"
            maxLength={300}
            placeholder="Eldiven ve bandaj getir"
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
}
