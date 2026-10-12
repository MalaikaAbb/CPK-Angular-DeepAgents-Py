// DOC VERBATIM: the three TypeScript blocks from
// https://docs.copilotkit.ai/angular/deepagents/guides/a2ui, in page order, nothing
// added. Only compiled under `--configuration doc-a2ui` (angular.json swaps it
// in for ./a2ui.stub.ts). Expect TS2304: the page imports nothing and never
// defines `dynamicString` or the catalogs.

// features/a2ui/a2ui-catalogs.ts
const fixedDefinitions = {
  Card: { props: z.object({ child: z.string() }) },
  Title: { props: z.object({ text: dynamicString }) },
  Airport: { props: z.object({ code: dynamicString }) },
  Arrow: { props: z.object({}) },
  AirlineBadge: { props: z.object({ name: dynamicString }) },
  PriceTag: { props: z.object({ amount: dynamicString }) },
  Button: {
    props: z.object({
      child: z.string(),
      variant: z.enum(["primary", "secondary", "ghost"]).optional(),
      action: z.unknown().optional(),
    }),
  },
};

// features/a2ui/a2ui-catalogs.ts
export function a2uiConfigForFeature(feature: string): A2UIConfig | undefined {
  switch (feature) {
    case "beautiful-chat":
      return { catalog: beautifulCatalog };
    case "declarative-gen-ui":
      return { catalog: declarativeCatalog };
    case "a2ui-recovery":
      return {
        catalog: declarativeCatalog,
        recovery: { showAfterMs: 2_000, showAfterAttempts: 2 },
      };
    case "a2ui-fixed-schema":
      return { catalog: fixedCatalog };
    default:
      return undefined;
  }
}

provideCopilotKit({
  runtimeUrl: "/api/copilotkit",
  a2ui: {
    catalog: productCatalog,
    recovery: { showAfterMs: 2_000, showAfterAttempts: 2 },
  },
});

