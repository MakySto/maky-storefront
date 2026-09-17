import { redirect } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { marketHref } from "@/lib/channel-map";

export const SearchBar = ({ channel }: { channel: string }) => {
	async function onSubmit(formData: FormData) {
		"use server";
		const search = formData.get("search") as string;
		if (search && search.trim().length > 0) {
			redirect(marketHref(channel, `/search?query=${encodeURIComponent(search.trim())}`));
		}
	}

	return (
		<form action={onSubmit} className="group relative w-full max-w-md">
			<label className="relative block">
				<span className="sr-only">Search for products</span>
				{/* Search icon */}
				<span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
					<SearchIcon
						className="text-muted-foreground group-focus-within:text-foreground h-4 w-4 transition-colors"
						aria-hidden
					/>
				</span>
				{/* Input */}
				<input
					type="text"
					name="search"
					placeholder="Search for products..."
					autoComplete="off"
					required
					className="hover:bg-secondary/80 bg-secondary text-foreground placeholder:text-muted-foreground hover:border-border focus:border-ring focus:bg-background focus:ring-ring h-10 w-full rounded-lg border border-transparent py-2 pr-4 pl-11 text-sm transition-all focus:ring-1 focus:outline-hidden"
				/>
			</label>
		</form>
	);
};
