import { Web3Provider } from "../components/providers";
import ErrorBoundary from "../components/ui/ErrorBoundary";
import { SWRConfig } from 'swr';
import '../styles/globals.css'

function MyApp({ Component, pageProps }) {
  return(
    <ErrorBoundary>
      <SWRConfig 
        value={{
          refreshInterval: 30000,
          fetcher: (resource, init) => fetch(resource, init).then(res => res.json()),
          onError: (error, key) => {
            if (error.status !== 404) {
              console.error(`[SWR Error] ${key}:`, error);
            }
          },
          shouldRetryOnError: true,
          errorRetryCount: 3
        }}
      >
        <Web3Provider>
          <Component {...pageProps} />
        </Web3Provider>
      </SWRConfig>
    </ErrorBoundary>
  )
}

export default MyApp
