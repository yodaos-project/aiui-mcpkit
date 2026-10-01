export const handlers = {
  benchmark_card: (input: { value: number }) => ({ content: [], structuredContent: { value: input.value + 1 } }),
};
