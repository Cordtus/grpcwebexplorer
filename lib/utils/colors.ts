// Network color scheme generator
export const networkColors = [
  { bg: 'bg-blue-500/20', border: 'border-blue-500/50', text: 'text-blue-400', accent: 'bg-blue-500' },
  { bg: 'bg-green-500/20', border: 'border-green-500/50', text: 'text-green-400', accent: 'bg-green-500' },
  { bg: 'bg-purple-500/20', border: 'border-purple-500/50', text: 'text-purple-400', accent: 'bg-purple-500' },
  { bg: 'bg-orange-500/20', border: 'border-orange-500/50', text: 'text-orange-400', accent: 'bg-orange-500' },
  { bg: 'bg-pink-500/20', border: 'border-pink-500/50', text: 'text-pink-400', accent: 'bg-pink-500' },
  { bg: 'bg-cyan-500/20', border: 'border-cyan-500/50', text: 'text-cyan-400', accent: 'bg-cyan-500' },
  { bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', text: 'text-yellow-400', accent: 'bg-yellow-500' },
  { bg: 'bg-indigo-500/20', border: 'border-indigo-500/50', text: 'text-indigo-400', accent: 'bg-indigo-500' },
];

export function getNetworkColor(index: number) {
  return networkColors[index % networkColors.length];
}

export interface MethodTab {
  id: string;
  networkId: string;
  networkName: string;
  service: string;
  method: string;
  fullPath: string;
  color: typeof networkColors[0];
}