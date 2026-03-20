"use client";

import { useParams, usePathname } from "next/navigation";
import { REVERSE_MAP } from "@/lib/channel-map";

function useSelectedPathname() {
	const pathname = usePathname();

	const { channel } = useParams<{ channel?: string }>();

	const friendly = channel ? (REVERSE_MAP[channel] || channel) : null;
	const selectedPathname = channel ? pathname.replace(`/${channel}`, "").replace(`/${friendly}`, "") : pathname;
	return selectedPathname;
}

export default useSelectedPathname;
