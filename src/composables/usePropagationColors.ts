export function usePropagationColors() {
  const kIndexColor = (kIndex: number) => {
    if (kIndex <= 2.25) return '#4ade80';
    if (kIndex <= 5.4) return '#fb923c';
    return '#ef4444';
  };

  const aIndexColor = (aIndex: number) => {
    if (aIndex <= 10) return '#4ade80';
    if (aIndex <= 12) return '#fb923c';
    return '#ef4444';
  };

  const sfiColor = (sfi: number) => {
    if (sfi <= 25) return '#ef4444';
    if (sfi <= 50) return '#fb923c';
    return '#4ade80';
  };

  return {
    kIndexColor,
    aIndexColor,
    sfiColor,
  };
}
