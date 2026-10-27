// Все операции со статьями — одна функция Vercel: на бесплатном тарифе клиента не больше 12 функций
// на выкат, а без этого их было бы 14 и выкат падал. Файлы с «_» в начале Vercel функциями не считает.
//   ?task=draft    — черновик по расписанию или вручную (_draft-article.js)
//   ?task=publish  — публикация одобренных по графику (_publish-scheduled.js)
//   без task       — раздел «На проверке» в кабинете (_articles-review.js)
import draft from "./_draft-article.js";
import publish from "./_publish-scheduled.js";
import review from "./_articles-review.js";

export default function handler(req, res) {
  const task = req.query?.task;
  return (task === "draft" ? draft : task === "publish" ? publish : review)(req, res);
}
