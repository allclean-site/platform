/** RU/RO → ascii slug. Ported verbatim from cms-leadgenium ArticleEditor.slugify. */

const MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k",
  л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  ă: "a", â: "a", î: "i", ș: "s", ț: "t",
};

export function slugify(s: string): string {
  return (
    (s || "")
      .toLowerCase()
      .split("")
      .map((c) => MAP[c] ?? c)
      .join("")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "statya"
  );
}
