"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import ResultModal from "@/components/dahaAzCok/ResultModal";
import { useDahaAzCok } from "@/hooks/useDahaAzCok";
import { COUNT_UP_MS, DAHA_AZ_COK_CATEGORIES, olcu } from "@/lib/dahaAzCok";
import { cn } from "@/lib/utils";

/** "9.3" gibi ondalıklı bir hedefte kaç basamak korunması gerektiğini hedefin kendi
 * yazımından çıkarır (IMDB puanları 1 ondalıklı — 9.3, nüfus/izlenme/fiyat tam sayı). */
function countDecimals(value: number): number {
  const str = value.toString();
  const dotIndex = str.indexOf(".");
  return dotIndex === -1 ? 0 : str.length - dotIndex - 1;
}

/** target undefined -> tanımlı bir sayı olduğunda (yani kart o an açığa çıktığında)
 * 0'dan hedefe ~3sn'de sayarak yükselen bir "count-up" animasyonu üretir. Aynı sayı
 * tekrar render edilirse (ör. referans kart sola kayıp aynı değeri korurken) yeniden
 * BAŞLAMAZ — sadece undefined'dan gerçek bir değere geçiş "taze reveal" sayılır.
 * Üstel (quint) ease-out: başta hızlı sayıp sona doğru iyice yavaşlıyor — özellikle
 * birbirine yakın iki değerde son saniyelerdeki yavaşlama kimin kazandığını belli
 * etmeden gerilim yaratıyor. Basamak sayısı DIŞARIDAN veriliyor — hedefin kendi
 * ondalığından türetmek yetmiyor, bkz. ondalikBasamak. */
function useCountUp(
  target: number | undefined,
  basamak: number,
  durationMs = COUNT_UP_MS,
): number | undefined {
  const [display, setDisplay] = useState<number | undefined>(target);
  const prevTargetRef = useRef<number | undefined>(target);

  useEffect(() => {
    if (target === prevTargetRef.current) return;

    const isFreshReveal = prevTargetRef.current === undefined && target !== undefined;
    prevTargetRef.current = target;

    if (!isFreshReveal || target === undefined) {
      setDisplay(target);
      return;
    }

    const factor = 10 ** basamak;
    let frameId: number;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - (1 - progress) ** 5;
      setDisplay(Math.round((target as number) * eased * factor) / factor);
      if (progress < 1) frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [target, basamak, durationMs]);

  return display;
}

function CategoryTabs({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex justify-center gap-1 rounded-lg border border-border-subtle bg-card p-1">
      {DAHA_AZ_COK_CATEGORIES.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onChange(category.id)}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:text-sm",
            value === category.id ? "bg-card-hover text-text-main" : "text-text-muted hover:text-text-main"
          )}
        >
          {category.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Ondalık basamak sayısı DEĞERİN kendisinden değil BİRİMDEN türetiliyor.
 *
 * Sebep (kullanıcı bildirdi): Film/Dizi puanı tam sayıysa TMDB onu JSON'a `8`
 * olarak yazıyor, `countDecimals(8)` 0 çıkıyor ve sayaç 1, 2, 3... diye tam
 * sayı sayıp ondalığı hiç göstermiyordu. Aynı kategorideki 8,4 doğru
 * çalışıyordu — yani davranış öğeden öğeye değişiyordu. Puan her zaman tek
 * ondalıkla gösterilmeli: "8,0".
 *
 * Diğer birimler değerin kendi ondalığını koruyor: nüfus/fiyat gibi tam sayı
 * alanlarda gereksiz ",0" çıkmasın, ama Trivia'daki kaplumbağa hızı (0,3 km/sa)
 * gibi gerçekten ondalıklı değerler de bozulmasın.
 */
function ondalikBasamak(value: number, unit: string): number {
  return unit === "puan" ? 1 : countDecimals(value);
}

function formatValue(value: number, unit: string, basamak: number): string {
  const sayi = value.toLocaleString("tr-TR", {
    minimumFractionDigits: basamak,
    maximumFractionDigits: basamak,
  });
  return `${sayi} ${unit}`;
}

function RoundDots({ roundResults, total }: { roundResults: boolean[]; total: number }) {
  return (
    <div className="flex justify-center gap-1.5">
      {Array.from({ length: total }, (_, i) => {
        const result = roundResults[i];
        return (
          <span
            key={i}
            className={cn(
              "h-2 w-2 rounded-full",
              result === true ? "bg-accent-green" : result === false ? "bg-accent-red" : "bg-card"
            )}
          />
        );
      })}
    </div>
  );
}

interface CardItem {
  id: string;
  label: string;
  unit: string;
  value?: number;
  imageUrl?: string | null;
}

// "animate" x/y belirtmiyor — layout=true zaten pozisyon değişimini (sağdan sola
// kayan referans kartı) kendi FLIP animasyonuyla yönetiyor; animate içinde x:0 gibi
// sabit bir hedef vermek bu projeksiyonla çakışıp kartın anında zıplamasına (smooth
// olmayan geçiş) yol açıyordu. AMA "initial"da x olup "animate"de hiç olmaması da
// kendi başına bir hataydı: Framer Motion "animate"de bulunmayan bir alanı asla geri
// tweenlemiyor, o yüzden TAZE mount olan (ör. kategori değiştirince ikisi de yeni
// olan) kartlar x:80'de SONSUZA DEK takılı kalıyordu (sağa kaymış duruyordu — bu da
// tüm satırın ortalanmamış görünmesine sebep oluyordu). Çözüm: initial'dan da x'i
// çıkarmak — taze mount'lar artık sadece fade-in yapıyor (kayma yok), ama layout
// zaten pozisyonu doğru yerde başlatıyor; x sadece exit'te kalıyor (unmount olacağı
// için sonsuza dek takılı kalma riski yok).
const CARD_MOTION_PROPS = {
  layout: true,
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, x: -120 },
  transition: { duration: 0.35, ease: "easeInOut" as const },
};

// Kartlar "flex-1" DEĞİL, satır genişliğine göre sabit bir w-[calc(...)] kullanıyor.
// Nedeni: AnimatePresence mode="popLayout" çıkan kartı (eski referans) anında akıştan
// (position:absolute) çıkarıyor — flex-1 olsaydı, o anda satırda TEK kart kalmış gibi
// davranıp genişliği geçici olarak satırın tamamına büyürdü (Şangay henüz mount
// olmamışken), sonra yeni kart gelince tekrar küçülürdü. layout=true bu genişlik
// değişimini de animasyona dahil ettiği için kart "ortada küçülüp büyüyor" gibi bir
// scale bozulmasıyla geçiş yapıyordu. Sabit genişlik bu genişlik salınımını (ve
// dolayısıyla scale distorsiyonunu) tamamen ortadan kaldırıyor — sadece x pozisyonu
// değişiyor, kart hiç büyüyüp küçülmüyor.
const CARD_WIDTH_CLASS = "w-[calc(50%-0.375rem)] shrink-0";

/** Görselin fotoğraf mı logo mu olduğu birimden anlaşılıyor: Fiyat kategorisi
 *  şirket logosu gösteriyor, diğerleri afiş/fotoğraf. */
function logoMu(unit: string): boolean {
  return unit === "milyon $";
}

/**
 * `ref` PROPU ŞART. AnimatePresence'in `mode="popLayout"` kipi çıkan kartı
 * akıştan almak (position:absolute) için ona bir ref bağlıyor; bu bileşen ref'i
 * aşağı geçirmediği sürece o ölçüm sessizce başarısız oluyor ve çıkan kart
 * AKIŞTA KALIYOR. Sonucu ölçüldü: geçiş anında satırda üç kart birden duruyor,
 * satır 390 piksellik ekranda 543 piksele taşıyor ve mobil tarayıcı sayfayı
 * küçültüp bir daha eski haline döndürmüyor — kullanıcı bunu "şıkların ismi
 * şekli falan bozuluyor" diye bildirdi. React 19'da ref düz bir prop.
 */
function ComparisonCard({
  item,
  outcome,
  onPick,
  disabled,
  showValue = true,
  ref,
}: {
  item: CardItem;
  outcome: "correct" | "wrong" | null;
  onPick: () => void;
  disabled: boolean;
  showValue?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  const revealed = item.value !== undefined && showValue;
  /* Gizemli kartta değer henüz yok; basamak zaten açılana kadar kullanılmıyor,
     "puan" birimi için de değerden bağımsız olarak 1 dönüyor. */
  const basamak = ondalikBasamak(item.value ?? 0, item.unit);
  const animatedValue = useCountUp(revealed ? item.value : undefined, basamak);
  const borderClass =
    outcome === "correct" ? "border-accent-green" : outcome === "wrong" ? "border-accent-red" : "border-border-subtle";

  if (item.imageUrl) {
    return (
      <motion.button
        {...CARD_MOTION_PROPS}
        key={item.id}
        ref={ref}
        type="button"
        onClick={onPick}
        disabled={disabled}
        className={cn(
          "relative flex aspect-[2/3] items-end overflow-hidden rounded-xl border-2",
          CARD_WIDTH_CLASS,
          borderClass,
          disabled ? "cursor-not-allowed" : "cursor-pointer"
        )}
      >
        {/* Afiş/fotoğraf kartı doldurur (object-cover), LOGO doldurmaz: Fiyat
            kategorisindeki görseller şirket logosu ve 2:3'lük karta kırpılınca
            tanınmaz oluyordu (Zynga'nın logosu ikiye bölünüyordu). Logolarda
            object-contain + kenar boşluğu, arkada da nötr bir zemin. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key="poster"
          src={item.imageUrl}
          alt=""
          className={cn(
            "absolute inset-0 h-full w-full",
            logoMu(item.unit) ? "bg-white object-contain p-4" : "object-cover"
          )}
        />
        {/* Koyu geçiş SADECE fotoğrafta: adın okunabilmesi için var. Beyaz zeminli
            logo kartında gereksiz (ad zaten kendi kutusunda okunuyor) ve kartın
            alt yarısını çamur rengine çeviriyordu. */}
        {!logoMu(item.unit) && (
          <div key="gradient" className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        )}
        <div key="content" className="relative z-10 flex w-full flex-col items-center gap-2 px-3 pb-4">
          <span className="rounded-full bg-background/90 px-3 py-1.5 text-base font-semibold text-text-main sm:text-lg">
            {item.label}
          </span>
          {revealed && animatedValue !== undefined && (
            <span
              className={cn(
                "rounded-full bg-background/90 px-3 py-1.5 text-lg font-bold sm:text-xl",
                outcome === "correct" ? "text-accent-green" : outcome === "wrong" ? "text-accent-red" : "text-text-main"
              )}
            >
              {formatValue(animatedValue, item.unit, basamak)}
            </span>
          )}
        </div>
      </motion.button>
    );
  }

  return (
    <motion.button
      {...CARD_MOTION_PROPS}
      key={item.id}
      ref={ref}
      type="button"
      onClick={onPick}
      disabled={disabled}
      className={cn(
        "flex h-56 flex-col items-center justify-center gap-3 rounded-xl border-2 px-4 py-5 text-center",
        CARD_WIDTH_CLASS,
        borderClass,
        outcome === "correct" ? "bg-accent-green/10" : outcome === "wrong" ? "bg-accent-red/10" : "bg-card hover:bg-card-hover",
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      )}
    >
      <p key="label" className="text-base font-medium text-text-main">
        {item.label}
      </p>
      <p key="value" className="text-2xl font-bold text-text-main">
        {revealed && animatedValue !== undefined ? formatValue(animatedValue, item.unit, basamak) : "?"}
      </p>
    </motion.button>
  );
}

function DahaAzCokBoard({ categoryId, onNext, arsivTarihi }: { categoryId: string; onNext: () => void; arsivTarihi?: string }) {
  const {
    loading,
    notFound,
    status,
    leftItem,
    rightItem,
    showOutcome,
    stepIndex,
    correctCount,
    roundResults,
    maxSteps,
    submitting,
    showResult,
    dismissResult,
    openResult,
    submitGuess,
  } = useDahaAzCok(categoryId, arsivTarihi);

  if (notFound) {
    return <p className="py-10 text-center text-sm text-text-muted">Bu kategori için veri bulunamadı.</p>;
  }

  const finished = status === "WON";
  const isLastCategory = DAHA_AZ_COK_CATEGORIES[DAHA_AZ_COK_CATEGORIES.length - 1].id === categoryId;

  const revealed = rightItem?.value !== undefined && leftItem;
  let leftOutcome: "correct" | "wrong" | null = null;
  let rightOutcome: "correct" | "wrong" | null = null;
  // Renkler (yeşil/kırmızı) sayı sayma animasyonu bitene kadar (showOutcome) gelmiyor —
  // sayı hâlâ sayarken sonucu göstermek "smooth değil" hissi veriyordu. Sayının kendisi
  // (revealed) yine anında görünüyor, sadece doğru/yanlış rengi ertelendi. Oyun bittiyse
  // (finished) — canlı animasyon hiç çalışmamış olsa bile (ör. sayfa yenilendi) — renkler
  // her zaman gösteriliyor, çünkü bu artık geçmiş/donmuş bir sonuç, animasyona gerek yok.
  if ((finished || showOutcome) && revealed && rightItem) {
    const tie = leftItem.value === rightItem.value;
    leftOutcome = tie || leftItem.value > (rightItem.value as number) ? "correct" : "wrong";
    rightOutcome = tie || (rightItem.value as number) > leftItem.value ? "correct" : "wrong";
  }

  // İlk tur henüz TAHMİN EDİLMEDEN önce referans kartın değeri de sağdaki gibi
  // gizli kalır. Ama tahmin yapılıp reveal anı geldiğinde (revealed=true, sağ kartın
  // gerçek değeri sayılmaya başladığı an) sol kart da AYNI ANDA açığa çıkıp saymaya
  // başlamalı — yoksa kullanıcı hangi değere göre doğru/yanlış olduğunu hiç
  // göremeden kart sola kayıp gidiyordu.
  const showLeftValue = stepIndex > 0 || Boolean(revealed);

  return (
    <div className="flex flex-1 flex-col items-center gap-6 py-6">
      <RoundDots roundResults={roundResults} total={maxSteps} />

      {/* NEYİ karşılaştırdığımız. Kartlarda yalnızca ad ve birim vardı; Trivia'da
          günün zinciri sekiz farklı büyüklükten biri olabildiği için "? milyon km"
          neyin uzaklığı, "? yıl" neyin süresi belli olmuyordu. */}
      {leftItem && (
        <div className="flex flex-col items-center gap-0.5 px-4 text-center">
          <p className="text-base font-semibold text-text-main">{olcu(leftItem.unit).ad}</p>
          {/* Soru da ölçüye bağlı: yükseklik için "daha çok" ters okunuyordu. */}
          <p className="text-xs text-text-muted">{olcu(leftItem.unit).soru}</p>
        </div>
      )}

      {/* overflow-x-clip bir EMNİYET KEMERİ, asıl düzeltme değil (o, kartın ref'i
          geçirmesi). Buradaki arıza kalıcı: satır tek bir kare bile taşsa mobil
          tarayıcı düzen genişliğini büyütüyor ve sayfa yenilenene kadar küçülmüş
          kalıyor. Kart çıkış animasyonu zaten sola kayıp yok oluyor, kırpılması
          görüntüyü bozmuyor. */}
      {leftItem && rightItem && (
        <div className="flex w-full gap-3 overflow-x-clip px-2">
          <AnimatePresence mode="popLayout">
            <ComparisonCard
              key={leftItem.id}
              item={leftItem}
              outcome={leftOutcome}
              onPick={() => submitGuess("lower")}
              disabled={submitting || loading || finished}
              showValue={showLeftValue}
            />
            <ComparisonCard
              key={rightItem.id}
              item={rightItem}
              outcome={rightOutcome}
              onPick={() => submitGuess("higher")}
              disabled={submitting || loading || finished}
            />
          </AnimatePresence>
        </div>
      )}

      {finished && (
        <p className="text-lg font-semibold text-text-main">
          {correctCount} / {maxSteps} doğru
        </p>
      )}

      {finished && !showResult && (
        <button
          type="button"
          onClick={openResult}
          className="text-sm font-medium text-accent-green underline-offset-2 hover:underline"
        >
          Sonucu gör
        </button>
      )}

      {finished && showResult && (
        <ResultModal
          correctCount={correctCount}
          maxSteps={maxSteps}
          roundResults={roundResults}
          onClose={dismissResult}
          onNext={onNext}
          isLastCategory={isLastCategory}
        />
      )}
    </div>
  );
}

export default function DahaAzCokGame({ arsivTarihi }: { arsivTarihi?: string }) {
  const [categoryId, setCategoryId] = useState(DAHA_AZ_COK_CATEGORIES[0].id);
  const router = useRouter();

  function handleNext() {
    const currentIndex = DAHA_AZ_COK_CATEGORIES.findIndex((c) => c.id === categoryId);
    const next = DAHA_AZ_COK_CATEGORIES[currentIndex + 1];
    if (next) setCategoryId(next.id);
    else router.push("/");
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4">
      <CategoryTabs value={categoryId} onChange={setCategoryId} />
      <DahaAzCokBoard key={categoryId} categoryId={categoryId} onNext={handleNext} arsivTarihi={arsivTarihi} />
    </div>
  );
}
