declare module '@web3modal/wagmi/react' {
  export function createWeb3Modal(config: any): void;
  export function useWeb3Modal(): { open: (opts?: any) => Promise<void>; close: () => Promise<void> };
}

declare module '@web3modal/wagmi' {
  export const defaultWagmiConfig: any;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'w3m-button': any;
    }
  }
}
