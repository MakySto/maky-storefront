import { SiteHeader } from "./header/site-header";

export async function Header({ channel }: { channel: string }) {
	return <SiteHeader channel={channel} />;
}