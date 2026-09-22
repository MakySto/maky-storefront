import { describe, expect, it } from "vitest";
import { jsonLdScriptProps, serializeJsonLd } from "./json-ld";

describe("JSON-LD serialization", () => {
	const hostile = {
		"@type": "Product",
		name: 'Box </script><script>alert("x")</script>',
		description: "<!-- not a comment --> 3 < 4",
	};

	it("cannot close its own script element", () => {
		const out = serializeJsonLd(hostile);
		expect(out).not.toContain("</script");
		expect(out).not.toContain("<!--");
		expect(out).not.toContain("<");
	});

	it("still parses to exactly the same data", () => {
		expect(JSON.parse(serializeJsonLd(hostile))).toEqual(hostile);
	});

	it("is what the script props carry", () => {
		expect(jsonLdScriptProps(hostile)?.dangerouslySetInnerHTML.__html).toBe(serializeJsonLd(hostile));
		expect(jsonLdScriptProps(null)).toBeNull();
	});
});
