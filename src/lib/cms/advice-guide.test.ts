import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./client", () => ({ fetchCmsPage: vi.fn() }));

const { adviceGuideFromBlocks } = await import("./advice-guide");

const common = { id: null, blockName: null, markets: null };
const text = (value: string) => ({ type: "text", text: value, format: 0 });
const doc = (...children: unknown[]) => ({ root: { type: "root", children } }) as never;
const heading = (value: string) => ({ type: "heading", tag: "h2", children: [text(value)] });
const paragraph = (value: string) => ({ type: "paragraph", children: [text(value)] });

describe("advice guide outline", () => {
	it("takes the hero as the title and every anchored section as a topic", () => {
		const guide = adviceGuideFromBlocks([
			{
				...common,
				blockType: "hero",
				anchorId: "uvod",
				heading: "Ako vybrať strešný nosič",
				subheading: "Krok za krokom",
				media: null,
				links: [],
			},
			{
				...common,
				blockType: "richText",
				anchorId: "typ-strechy",
				content: doc(heading("Ako spoznať typ strechy"), paragraph("Pozrite sa na strechu zboku.")),
			},
			{ ...common, blockType: "richText", anchorId: null, content: doc(heading("Bez kotvy")) },
			{
				...common,
				blockType: "faq",
				anchorId: "caste-otazky",
				heading: "Časté otázky",
				items: [{ id: null, question: "Sedí nosič na každé auto?", answer: doc() }],
			},
		]);
		expect(guide).toEqual({
			title: "Ako vybrať strešný nosič",
			lead: "Krok za krokom",
			topics: [
				{ anchor: "typ-strechy", title: "Ako spoznať typ strechy", text: "Pozrite sa na strechu zboku." },
				{ anchor: "caste-otazky", title: "Časté otázky", text: "Sedí nosič na každé auto?" },
			],
		});
	});

	it("cuts a long line at a word, and gives no guide without a title", () => {
		const long =
			"Strešný nosič sa vyberá podľa auta, nie iba podľa dĺžky tyčí, a preto začnite vozidlom a typom strechy.";
		const guide = adviceGuideFromBlocks([
			{
				...common,
				blockType: "hero",
				anchorId: null,
				heading: "Návod",
				subheading: null,
				media: null,
				links: [],
			},
			{
				...common,
				blockType: "richText",
				anchorId: "vyber",
				content: doc(heading("Výber"), paragraph(long)),
			},
		]);
		expect(guide?.topics[0]?.text?.endsWith("…")).toBe(true);
		expect(guide?.topics[0]?.text?.length).toBeLessThanOrEqual(91);
		expect(adviceGuideFromBlocks([])).toBeNull();
	});
});
