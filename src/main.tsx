import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { retryQuery } from './api/client.ts';
import { App } from './app/App.tsx';
import { DataProvider } from './app/DataProvider.tsx';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('The application root was not found.');
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 10000, gcTime: 300000, retry: retryQuery, retryDelay: 200, refetchOnMount: 'always', refetchOnWindowFocus: true } } });
createRoot(root).render(<StrictMode><QueryClientProvider client={queryClient}><DataProvider><App /></DataProvider></QueryClientProvider></StrictMode>);
