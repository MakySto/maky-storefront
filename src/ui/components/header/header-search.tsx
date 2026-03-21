import { redirect } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function HeaderSearch({ channel }: { channel: string }) {
  const t = await getTranslations("nav");

  async function onSubmit(formData: FormData) {
    "use server";
    const search = formData.get("search") as string;
    if (search && search.trim().length > 0) {
      redirect(`/${encodeURIComponent(channel)}/search?query=${encodeURIComponent(search)}`);
    }
  }

  return (
    <form action={onSubmit} className="group relative w-full max-w-2xl">
      <label className="relative block">
        <span className="sr-only">{t("searchAriaLabel")}</span>
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <SearchIcon
            className="h-4 w-4 text-gray-400 transition-colors group-focus-within:text-gray-700"
            aria-hidden
          />
        </span>
        <input
          type="text"
          name="search"
          placeholder={t("searchPlaceholder")}
          autoComplete="off"
          required
          className="h-11 w-full rounded-sm border border-sand-300 bg-white py-2 pl-11 pr-4 text-sm text-gray-900 transition-all placeholder:text-gray-400 hover:border-gray-300 focus:border-copper-500 focus:bg-white focus:ring-1 focus:ring-copper-500 focus:outline-hidden"
        />
      </label>
    </form>
  );
}
