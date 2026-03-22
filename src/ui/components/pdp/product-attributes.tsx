"use client";

import { useTranslations } from "next-intl";
import { Shirt, Leaf, Droplets, Ruler, Sparkles } from "lucide-react";
import {
  Accordion,
  AccordionItemWithContext,
  AccordionTrigger,
  AccordionContent,
} from "@/ui/components/ui/accordion";
import { Badge } from "@/ui/components/ui/badge";
import { type ReactNode } from "react";

interface Attribute {
  name: string;
  value: string | boolean | string[];
}

interface ProductAttributesProps {
  descriptionHtml?: string[] | null;
  attributes?: Attribute[];
  careInstructions?: string | null;
}

const attributeIcons: Record<string, ReactNode> = {
  Material: <Shirt className="h-4 w-4" />,
  "Made with Recycled Fibers": <Leaf className="h-4 w-4" />,
  Waterproof: <Droplets className="h-4 w-4" />,
  Fit: <Ruler className="h-4 w-4" />,
  "Key Features": <Sparkles className="h-4 w-4" />,
};

function formatValue(value: string | boolean | string[]): ReactNode {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap justify-end gap-1">
        {value.map((v) => (
          <Badge key={v} variant="secondary" className="font-normal">
            {v}
          </Badge>
        ))}
      </div>
    );
  }
  return value;
}

export function ProductAttributes({
  descriptionHtml,
  attributes = [],
  careInstructions,
}: ProductAttributesProps) {
  const t = useTranslations("product");

  const displayAttributes = attributes.filter(
    (attr) => !["Size", "Color"].includes(attr.name),
  );

  return (
    <Accordion type="multiple" defaultValue={["description"]} className="w-full">
      {descriptionHtml && descriptionHtml.length > 0 && (
        <AccordionItemWithContext value="description" className="border-border-default">
          <AccordionTrigger className="py-4 text-sm font-medium text-text-primary hover:no-underline">
            {t("description")}
          </AccordionTrigger>
          <AccordionContent>
            <div className="prose prose-sm max-w-none text-text-secondary prose-headings:text-text-primary prose-p:text-text-secondary prose-a:text-text-link prose-strong:text-text-primary">
              {descriptionHtml.map((html) => (
                <div key={html} dangerouslySetInnerHTML={{ __html: html }} />
              ))}
            </div>
          </AccordionContent>
        </AccordionItemWithContext>
      )}

      {displayAttributes.length > 0 && (
        <AccordionItemWithContext value="details" className="border-border-default">
          <AccordionTrigger className="py-4 text-sm font-medium text-text-primary hover:no-underline">
            {t("productDetails")}
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-3">
              {displayAttributes.map((attr) => (
                <div
                  key={attr.name}
                  className="flex items-start justify-between gap-4 text-sm"
                >
                  <span className="flex items-center gap-2 text-text-secondary">
                    {attributeIcons[attr.name]}
                    {attr.name}
                  </span>
                  <span className="text-right font-medium text-text-primary">
                    {formatValue(attr.value)}
                  </span>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItemWithContext>
      )}

      {careInstructions && (
        <AccordionItemWithContext value="care" className="border-border-default">
          <AccordionTrigger className="py-4 text-sm font-medium text-text-primary hover:no-underline">
            {t("careInstructions")}
          </AccordionTrigger>
          <AccordionContent className="leading-relaxed text-text-secondary">
            {careInstructions}
          </AccordionContent>
        </AccordionItemWithContext>
      )}

      <AccordionItemWithContext value="shipping" className="border-border-default">
        <AccordionTrigger className="py-4 text-sm font-medium text-text-primary hover:no-underline">
          {t("shippingAndReturns")}
        </AccordionTrigger>
        <AccordionContent className="space-y-2 leading-relaxed text-text-secondary">
          <p>{t("freeShippingText", { amount: "€100" })}</p>
          <p>{t("freeReturnsText")}</p>
        </AccordionContent>
      </AccordionItemWithContext>
    </Accordion>
  );
}