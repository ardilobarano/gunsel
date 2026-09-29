import "server-only";
import validWordsData from "@/data/validWords.json";
import { trUpper } from "@/lib/utils";
import type { WordLength } from "@/lib/kelimesel";

/**
 * Sözlük kontrolü BİLEREK sadece sunucuda. Eskiden bu fonksiyon (ve beraberinde
 * 497 KB'lık validWords.json) `src/lib/kelimesel.ts` içindeydi; o dosya client
 * bileşenlerince de kullanıldığı için tüm kelime listesi her ziyaretçinin tarayıcısına
 * iniyordu — sitedeki en ağır varlıktı.
 *
 * Kaldırmak işlevsel olarak bedava çıktı çünkü doğrulama zaten sunucuda da yapılıyordu
 * (`/api/kelimesel/guess` geçersiz kelimeye `{valid:false}` dönüyor) ve client bu yanıtı
 * zaten işliyordu. Tek fark: geçersiz kelime uyarısı artık anında değil, bir istek
 * turu sonrası geliyor. Geçersiz tahmin deneme hakkı HARCAMIYOR (route erken dönüyor),
 * yani davranış aynı kaldı.
 */
const validWords = validWordsData as Record<string, string[]>;

export function isValidWord(word: string, length: WordLength): boolean {
  const pool = validWords[String(length)] ?? [];
  return pool.includes(trUpper(word));
}
