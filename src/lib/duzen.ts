/**
 * Sayfa kabının genişliği — TEK KAYNAK.
 *
 * Header ile hub ızgarası ayrı ayrı yazıldığında kaydılar: başlık `max-w-3xl`,
 * ızgara `lg:max-w-5xl` olunca "Günsel" logosu kartların soluna hizalanmıyordu
 * (kullanıcı bildirdi). İkisi de buradan besleniyor; biri değişirse öteki de
 * değişir.
 */
export const SAYFA_KABI = "mx-auto w-full max-w-md md:max-w-3xl lg:max-w-5xl";
